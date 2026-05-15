// Run-layer constants and helpers. A run is RUN_LENGTH rounds played in
// sequence; the Summary screen reads these to keep the editorial voice
// consistent.

/** Number of rounds in a run. Tunable after playtesting. */
export const RUN_LENGTH = 5;

/** Max possible score for a single round (from scoring.ts: 10 at ΔE 0). */
export const MAX_ROUND_SCORE = 10;

/** Max possible run score. */
export const MAX_RUN_SCORE = RUN_LENGTH * MAX_ROUND_SCORE;

export type Verdict = 'EXACT' | 'NEAR' | 'CLOSE' | 'WARM' | 'OFF';

interface VerdictBand {
  min: number;
  word: Verdict;
}

// Ordered high → low. Inclusive lower bound: a score equal to `min` falls
// inside the band. Tune these alongside scoreFromDeltaE in scoring.ts.
const VERDICT_BANDS: readonly VerdictBand[] = [
  { min: 9.0, word: 'EXACT' },
  { min: 7.5, word: 'NEAR' },
  { min: 6.0, word: 'CLOSE' },
  { min: 4.0, word: 'WARM' },
  { min: 0, word: 'OFF' },
] as const;

export function verdictFor(score: number): Verdict {
  for (const band of VERDICT_BANDS) {
    if (score >= band.min) return band.word;
  }
  return 'OFF';
}
