import { ciede2000, hsbToLab, type HSB } from './color';

export interface RoundResult {
  deltaE: number;
  score: number; // 0..10
  dH: number; // shortest signed angular distance, -180..180
  dS: number;
  dB: number;
}

/** Shortest signed hue distance, target - guess, in [-180, 180]. */
export function hueDelta(guessH: number, targetH: number): number {
  let d = (targetH - guessH) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/**
 * Map a CIEDE2000 ΔE to a 0..10 score. Kept in one place so it's easy to tune.
 * ΔE 0 -> 10, ΔE >= 30 -> 0.
 */
export function scoreFromDeltaE(deltaE: number): number {
  return Math.max(0, 10 - deltaE / 3);
}

/** Score a guess against a target. */
export function scoreGuess(guess: HSB, target: HSB): RoundResult {
  const deltaE = ciede2000(
    hsbToLab(guess.h, guess.s, guess.b),
    hsbToLab(target.h, target.s, target.b),
  );
  return {
    deltaE,
    score: scoreFromDeltaE(deltaE),
    dH: hueDelta(guess.h, target.h),
    dS: target.s - guess.s,
    dB: target.b - guess.b,
  };
}
