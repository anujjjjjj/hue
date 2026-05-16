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

export type Phase = 'intro' | 'memorize' | 'recall' | 'results' | 'summary';
export type Mode = 'free' | 'daily';
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
}

const EMPTY_RUN: RunState = {
  active: false,
  roundIndex: 0,
  targets: [],
  results: [],
  totalScore: 0,
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
  /** Surface the "that Daily has closed" Intro message. */
  showPastDailyMessage: (date: string) => void;
  clearPastDailyMessage: () => void;
  /** Back to the mode picker. */
  goToIntro: () => void;
  setGuess: (guess: HSB) => void;
  lockGuess: () => void;
  advanceRound: () => void;
  /** From Summary's "Play free" CTA — always starts a fresh free run. */
  playAgain: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
}

function buildRunFromTargets(targets: HSB[]): RunState {
  return {
    active: true,
    roundIndex: 0,
    targets,
    results: [],
    totalScore: 0,
  };
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
      target: null,
      guess: { ...NEUTRAL_GUESS },
      result: null,
      run: EMPTY_RUN,
      settings: {
        shrinkStyle: 'densify',
        shrinkDuration: 7,
      },

      startFreePlay: () => {
        const targets = generateRun();
        set({
          phase: 'memorize',
          mode: 'free',
          dailyDate: null,
          dailyRevisit: false,
          pastDailyDate: null,
          target: targets[0],
          guess: { ...NEUTRAL_GUESS },
          result: null,
          run: buildRunFromTargets(targets),
        });
      },

      // Three branches:
      //   completed  -> route to Summary (revisit)
      //   in-progress -> resume at Memorize for the next unplayed round
      //   none       -> generate, persist initial state, enter round 0
      startDaily: (dateArg) => {
        const date = dateArg ?? todayUTC();
        const stored = loadDaily(date);

        if (stored && stored.completed) {
          const run: RunState = {
            active: true,
            roundIndex: stored.results.length - 1,
            targets: stored.targets,
            results: stored.results,
            totalScore: stored.totalScore,
          };
          const last = stored.results[stored.results.length - 1];
          set({
            phase: 'summary',
            mode: 'daily',
            dailyDate: date,
            dailyRevisit: true,
            pastDailyDate: null,
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
            target: stored.targets[nextIdx],
            guess: { ...NEUTRAL_GUESS },
            result: null,
            run: {
              active: true,
              roundIndex: nextIdx,
              targets: stored.targets,
              results: stored.results,
              totalScore: stored.totalScore,
            },
          });
          return;
        }

        const targets = stored?.targets ?? getDailyRun(date);
        const run = buildRunFromTargets(targets);
        const startedAtMs = stored?.startedAtMs ?? Date.now();
        persistDaily(date, run, startedAtMs, false);
        set({
          phase: 'memorize',
          mode: 'daily',
          dailyDate: date,
          dailyRevisit: false,
          pastDailyDate: null,
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

      goToIntro: () => {
        set({
          phase: 'intro',
          mode: 'free',
          dailyDate: null,
          dailyRevisit: false,
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
        const { run } = get();
        if (!run.active) return;
        const next = run.roundIndex + 1;
        if (next >= RUN_LENGTH) {
          set({ phase: 'summary' });
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
