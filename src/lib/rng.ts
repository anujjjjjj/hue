import type { HSB } from './color';

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
