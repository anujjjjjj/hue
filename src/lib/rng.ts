import type { HSB } from './color';
import { RUN_LENGTH } from './run';

/** mulberry32 — small, fast, seedable PRNG. Returns a function yielding [0,1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash an arbitrary string to a 32-bit seed (used for Daily mode date strings). */
export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Generate a target color biased toward memorable, gameable colors —
 * not near-black, near-white, or near-grey.
 * Pass a seed (number or string) for deterministic output (Daily mode).
 */
export function generateTarget(seed?: number | string): HSB {
  const rand =
    seed === undefined
      ? Math.random
      : mulberry32(typeof seed === 'string' ? hashSeed(seed) : seed);
  return {
    h: rand() * 360,
    s: 45 + rand() * 50,
    b: 55 + rand() * 40,
  };
}

function resolveRand(seed: number | string | undefined): () => number {
  if (seed === undefined) return Math.random;
  return mulberry32(typeof seed === 'string' ? hashSeed(seed) : seed);
}

/**
 * Generate the 5 target colors for a run. Hue spread is enforced by carving
 * the wheel into RUN_LENGTH equal buckets and sampling one hue per bucket,
 * then shuffling the order so the run doesn't feel like it walks the wheel.
 * Sat/brightness use the same gameable bias as generateTarget.
 *
 * Seed it (number or date string) for deterministic output — Daily mode and
 * Versus will lean on this; it's seed-ready even though nothing seeds it yet.
 */
export function generateRun(seed?: number | string): HSB[] {
  const rand = resolveRand(seed);
  const bucket = 360 / RUN_LENGTH;
  const colors: HSB[] = [];
  for (let i = 0; i < RUN_LENGTH; i++) {
    colors.push({
      h: (i + rand()) * bucket,
      s: 45 + rand() * 50,
      b: 55 + rand() * 40,
    });
  }
  // Fisher-Yates with the same RNG keeps determinism intact.
  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }
  return colors;
}
