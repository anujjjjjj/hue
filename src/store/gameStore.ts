import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HSB } from '../lib/color';
import { generateTarget } from '../lib/rng';
import { scoreGuess, type RoundResult } from '../lib/scoring';

export type Phase = 'intro' | 'memorize' | 'recall' | 'results';
export type ShrinkStyle = 'scale' | 'densify' | 'calm';

export interface Settings {
  shrinkStyle: ShrinkStyle;
  /** seconds; range 3–12 */
  shrinkDuration: number;
}

/** The neutral mid-color the recall guess always starts from. */
export const NEUTRAL_GUESS: HSB = { h: 180, s: 50, b: 50 };

interface GameState {
  phase: Phase;
  target: HSB | null;
  guess: HSB;
  result: RoundResult | null;
  settings: Settings;

  begin: () => void;
  setGuess: (guess: HSB) => void;
  lockGuess: () => void;
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
      settings: {
        shrinkStyle: 'densify',
        shrinkDuration: 7,
      },

      begin: () =>
        set({
          phase: 'memorize',
          target: generateTarget(),
          guess: { ...NEUTRAL_GUESS },
          result: null,
        }),

      setGuess: (guess) => set({ guess }),

      lockGuess: () => {
        const { guess, target } = get();
        if (!target) return;
        set({ phase: 'results', result: scoreGuess(guess, target) });
      },

      playAgain: () =>
        set({
          phase: 'intro',
          target: null,
          guess: { ...NEUTRAL_GUESS },
          result: null,
        }),

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: 'hue-v1',
      // Only settings persist — round state is ephemeral.
      partialize: (s) => ({ settings: s.settings }),
    },
  ),
);

/** Called by the Memorize phase once the blob has collapsed. */
export function advanceToRecall() {
  useGameStore.setState({ phase: 'recall' });
}
