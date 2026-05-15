import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HSB } from '../lib/color';
import { generateRun } from '../lib/rng';
import { RUN_LENGTH } from '../lib/run';
import { scoreGuess, type RoundResult } from '../lib/scoring';

export type Phase = 'intro' | 'memorize' | 'recall' | 'results' | 'summary';
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
  /** Current round's target — mirrors run.targets[run.roundIndex]. */
  target: HSB | null;
  guess: HSB;
  /** Current round's result, or null until the round is locked in. */
  result: RoundResult | null;
  run: RunState;
  settings: Settings;

  begin: () => void;
  setGuess: (guess: HSB) => void;
  lockGuess: () => void;
  advanceRound: () => void;
  playAgain: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      phase: 'intro',
      target: null,
      guess: { ...NEUTRAL_GUESS },
      result: null,
      run: EMPTY_RUN,
      settings: {
        shrinkStyle: 'densify',
        shrinkDuration: 7,
      },

      // Start a new run. The single-round flow from v1 is gone — Intro's
      // Begin button enters round 0 of a fresh run.
      begin: () => {
        const targets = generateRun();
        set({
          phase: 'memorize',
          target: targets[0],
          guess: { ...NEUTRAL_GUESS },
          result: null,
          run: {
            active: true,
            roundIndex: 0,
            targets,
            results: [],
            totalScore: 0,
          },
        });
      },

      setGuess: (guess) => set({ guess }),

      // Locks the round's guess in: scores it, pushes it to the run, and
      // routes to Results. Does not advance — the player still sees this
      // round's Results screen until they hit "Next" / "See results".
      lockGuess: () => {
        const { guess, target, run } = get();
        if (!target) return;
        const result = scoreGuess(guess, target);
        const entry: RunRoundEntry = {
          index: run.roundIndex,
          target,
          guess,
          score: result.score,
          deltaE: result.deltaE,
        };
        set({
          phase: 'results',
          result,
          run: {
            ...run,
            results: [...run.results, entry],
            totalScore: run.totalScore + result.score,
          },
        });
      },

      // Called from the Results screen. Either kicks off the next round's
      // Memorize, or — on the final round — routes to Summary.
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

      // From Summary: drop straight into a fresh run. Once someone finishes,
      // the friction to start another should be near zero.
      playAgain: () => get().begin(),

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: 'hue-v1',
      // Only settings persist — round/run state is ephemeral.
      partialize: (s) => ({ settings: s.settings }),
    },
  ),
);

/** Called by the Memorize phase once the blob has collapsed. */
export function advanceToRecall() {
  useGameStore.setState({ phase: 'recall' });
}
