import { describe, it, expect } from 'vitest';
import { mulberry32, generateTarget, generateRun, hashSeed } from './rng';
import { RUN_LENGTH } from './run';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('produces values in [0,1)', () => {
    const r = mulberry32(99);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('different seeds diverge', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('generateTarget', () => {
  it('same seed -> same target', () => {
    expect(generateTarget(42)).toEqual(generateTarget(42));
  });

  it('same date string -> same target (Daily mode)', () => {
    expect(generateTarget('2026-05-14')).toEqual(generateTarget('2026-05-14'));
  });

  it('different date strings -> different targets', () => {
    expect(generateTarget('2026-05-14')).not.toEqual(
      generateTarget('2026-05-15'),
    );
  });

  it('stays in the gameable color range', () => {
    for (let i = 0; i < 200; i++) {
      const t = generateTarget(i);
      expect(t.h).toBeGreaterThanOrEqual(0);
      expect(t.h).toBeLessThan(360);
      expect(t.s).toBeGreaterThanOrEqual(45);
      expect(t.s).toBeLessThanOrEqual(95);
      expect(t.b).toBeGreaterThanOrEqual(55);
      expect(t.b).toBeLessThanOrEqual(95);
    }
  });
});

describe('hashSeed', () => {
  it('is stable', () => {
    expect(hashSeed('hello')).toBe(hashSeed('hello'));
  });
});

describe('generateRun', () => {
  it('returns RUN_LENGTH colors', () => {
    expect(generateRun(1)).toHaveLength(RUN_LENGTH);
  });

  it('same seed -> identical 5 colors (Daily-mode guarantee)', () => {
    expect(generateRun(2026)).toEqual(generateRun(2026));
  });

  it('same date string -> identical run', () => {
    expect(generateRun('2026-05-15')).toEqual(generateRun('2026-05-15'));
  });

  it('different seeds diverge', () => {
    expect(generateRun(1)).not.toEqual(generateRun(2));
  });

  it('every color stays in the gameable range', () => {
    for (let s = 0; s < 50; s++) {
      for (const c of generateRun(s)) {
        expect(c.h).toBeGreaterThanOrEqual(0);
        expect(c.h).toBeLessThan(360);
        expect(c.s).toBeGreaterThanOrEqual(45);
        expect(c.s).toBeLessThanOrEqual(95);
        expect(c.b).toBeGreaterThanOrEqual(55);
        expect(c.b).toBeLessThanOrEqual(95);
      }
    }
  });

  it('enforces hue spread (one hue per equal bucket of the wheel)', () => {
    const bucket = 360 / RUN_LENGTH;
    for (let s = 0; s < 50; s++) {
      const occupied = new Set<number>();
      for (const c of generateRun(s)) {
        occupied.add(Math.floor(c.h / bucket));
      }
      // All RUN_LENGTH buckets covered -> the run never clumps.
      expect(occupied.size).toBe(RUN_LENGTH);
    }
  });
});
