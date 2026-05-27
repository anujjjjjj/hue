import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HSB } from '../lib/color';
import { generateRun } from '../lib/rng';
import { RUN_LENGTH } from '../lib/run';
import { scoreGuess, type RoundResult } from '../lib/scoring';
import { getDailyRun, todayUTC } from '../lib/daily';
import {
  loadDaily,
  saveDaily,
  type DailyStored,
} from '../lib/dailyStorage';
import { submitRun } from '../lib/db/runs';
import { getMatch } from '../lib/db/matches';
import { getPlayerId } from '../lib/db/player';
import { track } from '../lib/analytics';

export type Phase =
  | 'intro'
  | 'memorize'
  | 'recall'
  | 'results'
  | 'summary'
  | 'lobby'
  | 'incoming'
  | 'matchResults'
  | 'matchUnavailable';
export type Mode = 'free' | 'daily' | 'match';
export type ShrinkStyle = 'scale' | 'densify' | 'calm';

export interface Settings {
  shrinkStyle: ShrinkStyle;
  /** seconds; range 3–12 */
  shrinkDuration: number;
}

/** The neutral mid-color the recall guess always starts from. */
export const NEUTRAL_GUESS: HSB = { h: 180, s: 50, b: 50 };

export interface RunRoundEntry {
  index: number; // 0..RUN_LENGTH-1
  target: HSB;
  guess: HSB;
  score: number; // 0..10
  deltaE: number;
}

export interface RunState {
  active: boolean;
  roundIndex: number; // 0..RUN_LENGTH-1
  targets: HSB[]; // the run's RUN_LENGTH colors, generated up front
  results: RunRoundEntry[];
  totalScore: number; // sum of results[].score
  /** Stable text seed for this run. Carried for backend submission and so
   *  the same RNG result can be reproduced (match joiner, future Daily
   *  rendering on the leaderboard). */
  seed: string;
}

const EMPTY_RUN: RunState = {
  active: false,
  roundIndex: 0,
  targets: [],
  results: [],
  totalScore: 0,
  seed: '',
};

interface GameState {
  phase: Phase;
  mode: Mode;
  /** The UTC date a Daily run belongs to. Set when mode === 'daily'. */
  dailyDate: string | null;
  /** Whether the current Daily was already completed before this session
   *  (i.e. the user is revisiting their result). Drives Summary's CTAs. */
  dailyRevisit: boolean;
  /** A 'YYYY-MM-DD' the user tried to deep-link to but which is no longer
   *  today's Daily. Surfaces the "Daily has closed" message on Intro. */
  pastDailyDate: string | null;
  /** The match this run participates in, if any. Set for both creator and
   *  joiner once they're playing inside a match. */
  matchId: string | null;
  /** Why we landed on the match-unavailable phase: 'not-found' | 'expired'. */
  matchUnavailableReason: 'not-found' | 'expired' | null;
  /** Backend runId for the most-recent Free Play submission. Path B
   *  ("Challenge a friend") needs this to attach the run to a new match. */
  freeRunId: string | null;
  /** Current round's target — mirrors run.targets[run.roundIndex]. */
  target: HSB | null;
  guess: HSB;
  /** Current round's result, or null until the round is locked in. */
  result: RoundResult | null;
  run: RunState;
  settings: Settings;

  startFreePlay: () => void;
  /** Start (or resume, or revisit) the Daily for the given UTC date.
   *  Defaults to today UTC. */
  startDaily: (date?: string) => void;
  /** Begin playing inside a match. Same UX as Free Play after this — blob,
   *  recall, scoring — but the run is tagged with matchId on submission. */
  startMatchPlay: (matchId: string, seed: string) => void;
  /** Surface the "that Daily has closed" Intro message. */
  showPastDailyMessage: (date: string) => void;
  clearPastDailyMessage: () => void;
  /** Show the Lobby for an existing match (just-created or join landing). */
  goToLobby: (matchId: string) => void;
  /** Show the "incoming match" landing for someone opening a ?m= link
   *  who hasn't yet played this match. */
  goToIncoming: (matchId: string) => void;
  /** Show the Match Results screen for an existing match. */
  goToMatchResults: (matchId: string) => void;
  /** Show the friendly not-found / expired screen. */
  goToMatchUnavailable: (reason: 'not-found' | 'expired') => void;
  /** Back to the mode picker. */
  goToIntro: () => void;
  setGuess: (guess: HSB) => void;
  lockGuess: () => void;
  advanceRound: () => void;
  /** From Summary's "Play free" CTA — always starts a fresh free run. */
  playAgain: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
}

function buildRunFromTargets(targets: HSB[], seed: string): RunState {
  return {
    active: true,
    roundIndex: 0,
    targets,
    results: [],
    totalScore: 0,
    seed,
  };
}

/** Random text seed for non-deterministic Free Play runs. Stable so the same
 *  RNG result can be reproduced from the seed alone (joiner sees same colors,
 *  Spec 06 can replay leaderboard rows). */
function freshFreeSeed(): string {
  // 12 hex chars from crypto.getRandomValues — plenty for collision-free
  // local use, and harmless if duplicated.
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Seed string we use for Daily runs. Mirrors the prefix used by daily.ts'
 *  dateToSeed so the backend `runs.seed` column is unambiguous. */
function dailySeedKey(dateKey: string): string {
  return `hue:daily:${dateKey}`;
}

function persistDaily(
  date: string,
  run: RunState,
  startedAtMs: number,
  completed: boolean,
  completedAtMs?: number,
): void {
  const stored: DailyStored = {
    date,
    targets: run.targets,
    results: run.results,
    totalScore: run.totalScore,
    completed,
    startedAtMs,
    completedAtMs,
  };
  saveDaily(stored);
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      phase: 'intro',
      mode: 'free',
      dailyDate: null,
      dailyRevisit: false,
      pastDailyDate: null,
      matchId: null,
      matchUnavailableReason: null,
      freeRunId: null,
      target: null,
      guess: { ...NEUTRAL_GUESS },
      result: null,
      run: EMPTY_RUN,
      settings: {
        shrinkStyle: 'densify',
        shrinkDuration: 7,
      },

      startFreePlay: () => {
        const seed = freshFreeSeed();
        const targets = generateRun(seed);
        set({
          phase: 'memorize',
          mode: 'free',
          dailyDate: null,
          dailyRevisit: false,
          pastDailyDate: null,
          matchId: null,
          freeRunId: null,
          target: targets[0],
          guess: { ...NEUTRAL_GUESS },
          result: null,
          run: buildRunFromTargets(targets, seed),
        });
      },

      // Mirrors startFreePlay but binds the run to a matchId — used by both
      // the creator (Path A "Start playing") and the joiner (after the
      // Incoming screen). The run is submitted with mode='match' on
      // completion, with match_id set so the comparison screen can pair it
      // up with the opponent's run.
      startMatchPlay: (matchId, seed) => {
        const targets = generateRun(seed);
        set({
          phase: 'memorize',
          mode: 'match',
          dailyDate: null,
          dailyRevisit: false,
          pastDailyDate: null,
          matchId,
          freeRunId: null,
          target: targets[0],
          guess: { ...NEUTRAL_GUESS },
          result: null,
          run: buildRunFromTargets(targets, seed),
        });
      },

      // Three branches:
      //   completed  -> route to Summary (revisit)
      //   in-progress -> resume at Memorize for the next unplayed round
      //   none       -> generate, persist initial state, enter round 0
      startDaily: (dateArg) => {
        const date = dateArg ?? todayUTC();
        const stored = loadDaily(date);

        const seed = dailySeedKey(date);

        if (stored && stored.completed) {
          const run: RunState = {
            active: true,
            roundIndex: stored.results.length - 1,
            targets: stored.targets,
            results: stored.results,
            totalScore: stored.totalScore,
            seed,
          };
          const last = stored.results[stored.results.length - 1];
          set({
            phase: 'summary',
            mode: 'daily',
            dailyDate: date,
            dailyRevisit: true,
            pastDailyDate: null,
            matchId: null,
            freeRunId: null,
            target: last?.target ?? null,
            guess: last?.guess ?? { ...NEUTRAL_GUESS },
            result: null,
            run,
          });
          return;
        }

        if (stored && stored.results.length > 0) {
          const nextIdx = stored.results.length;
          // Spec: anything less than fully restoring "the right round with
          // prior guesses preserved" can be cheesed by reload. Resume at the
          // start of Memorize for the next round; prior rounds are intact.
          set({
            phase: 'memorize',
            mode: 'daily',
            dailyDate: date,
            dailyRevisit: false,
            pastDailyDate: null,
            matchId: null,
            freeRunId: null,
            target: stored.targets[nextIdx],
            guess: { ...NEUTRAL_GUESS },
            result: null,
            run: {
              active: true,
              roundIndex: nextIdx,
              targets: stored.targets,
              results: stored.results,
              totalScore: stored.totalScore,
              seed,
            },
          });
          return;
        }

        const targets = stored?.targets ?? getDailyRun(date);
        const run = buildRunFromTargets(targets, seed);
        const startedAtMs = stored?.startedAtMs ?? Date.now();
        persistDaily(date, run, startedAtMs, false);
        set({
          phase: 'memorize',
          mode: 'daily',
          dailyDate: date,
          dailyRevisit: false,
          pastDailyDate: null,
          matchId: null,
          freeRunId: null,
          target: targets[0],
          guess: { ...NEUTRAL_GUESS },
          result: null,
          run,
        });
      },

      showPastDailyMessage: (date) => {
        set({ phase: 'intro', pastDailyDate: date });
      },
      clearPastDailyMessage: () => set({ pastDailyDate: null }),

      goToLobby: (matchId) => {
        set({
          phase: 'lobby',
          matchId,
          matchUnavailableReason: null,
        });
      },

      goToIncoming: (matchId) => {
        set({
          phase: 'incoming',
          matchId,
          matchUnavailableReason: null,
        });
      },

      goToMatchResults: (matchId) => {
        set({
          phase: 'matchResults',
          matchId,
          matchUnavailableReason: null,
        });
      },

      goToMatchUnavailable: (reason) => {
        set({
          phase: 'matchUnavailable',
          matchId: null,
          matchUnavailableReason: reason,
        });
      },

      goToIntro: () => {
        set({
          phase: 'intro',
          mode: 'free',
          dailyDate: null,
          dailyRevisit: false,
          matchId: null,
          matchUnavailableReason: null,
          freeRunId: null,
          target: null,
          guess: { ...NEUTRAL_GUESS },
          result: null,
          run: EMPTY_RUN,
        });
      },

      setGuess: (guess) => set({ guess }),

      // Commits the round: scores it, pushes to run.results, routes to
      // Results. For Daily mode, also persists the in-progress run so a
      // reload mid-Results doesn't lose the just-committed round.
      lockGuess: () => {
        const { guess, target, run, mode, dailyDate } = get();
        if (!target) return;
        const result = scoreGuess(guess, target);
        const entry: RunRoundEntry = {
          index: run.roundIndex,
          target,
          guess,
          score: result.score,
          deltaE: result.deltaE,
        };
        const nextRun: RunState = {
          ...run,
          results: [...run.results, entry],
          totalScore: run.totalScore + result.score,
        };
        const isLast = nextRun.results.length >= RUN_LENGTH;

        set({ phase: 'results', result, run: nextRun });

        if (mode === 'daily' && dailyDate) {
          const existing = loadDaily(dailyDate);
          const startedAtMs = existing?.startedAtMs ?? Date.now();
          persistDaily(
            dailyDate,
            nextRun,
            startedAtMs,
            isLast,
            isLast ? Date.now() : undefined,
          );
        }
      },

      advanceRound: () => {
        const { run, mode, dailyDate, matchId } = get();
        if (!run.active) return;
        const next = run.roundIndex + 1;
        if (next >= RUN_LENGTH) {
          // Run complete. Match runs land on matchResults; everything else
          // on summary. Fire-and-forget the backend write — best-effort by
          // contract (BACKEND.md). Failure leaves local UX untouched and
          // just means this run is absent from leaderboards / pairing.
          const completedRun = run;
          if (mode === 'match' && matchId) {
            set({ phase: 'matchResults' });
            void submitRun({
              gameId: 'hue',
              mode: 'match',
              seed: completedRun.seed,
              matchId,
              roundScores: completedRun.results.map((r) => r.score),
              totalScore: completedRun.totalScore,
              gameData: { guesses: completedRun.results.map((r) => r.guess) },
            }).then(async (id) => {
              // Match-run analytics. is_creator is derived from match.created_by;
              // we fetch lazily because the store doesn't carry that flag.
              if (!id) return;
              const m = await getMatch(matchId);
              const isCreator = m ? m.createdBy === getPlayerId() : false;
              track('match_run_submitted', {
                game_id: 'hue',
                is_creator: isCreator,
              });
            });
          } else {
            set({ phase: 'summary' });
            if (mode === 'free') {
              void submitRun({
                gameId: 'hue',
                mode: 'free',
                seed: completedRun.seed,
                roundScores: completedRun.results.map((r) => r.score),
                totalScore: completedRun.totalScore,
                gameData: {
                  guesses: completedRun.results.map((r) => r.guess),
                },
              }).then((id) => {
                // Capture the runId so "Challenge a friend" on Summary
                // can attachRunToMatch. Null = backend unreachable; the
                // button will gracefully disable.
                if (id) set({ freeRunId: id });
              });
            } else if (mode === 'daily' && dailyDate) {
              void submitRun({
                gameId: 'hue',
                mode: 'daily',
                seed: completedRun.seed,
                dateKey: dailyDate,
                roundScores: completedRun.results.map((r) => r.score),
                totalScore: completedRun.totalScore,
                gameData: {
                  guesses: completedRun.results.map((r) => r.guess),
                },
              });
            }
          }
          return;
        }
        set({
          phase: 'memorize',
          target: run.targets[next],
          guess: { ...NEUTRAL_GUESS },
          result: null,
          run: { ...run, roundIndex: next },
        });
      },

      playAgain: () => get().startFreePlay(),

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: 'hue-v1',
      // Only settings persist via Zustand. Daily run state has its own
      // per-date keys in lib/dailyStorage.
      partialize: (s) => ({ settings: s.settings }),
    },
  ),
);

/** Called by the Memorize phase once the blob has collapsed. */
export function advanceToRecall() {
  useGameStore.setState({ phase: 'recall' });
}
