import { describe, it, expect } from 'vitest';
import { mulberry32, generateTarget, hashSeed } from './rng';

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
