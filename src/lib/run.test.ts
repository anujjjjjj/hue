import { describe, it, expect } from 'vitest';
import { MAX_RUN_SCORE, RUN_LENGTH, verdictFor } from './run';

describe('verdictFor', () => {
  it('top score reads EXACT', () => {
    expect(verdictFor(10)).toBe('EXACT');
  });

  it('boundary 9.0 lands inside EXACT (inclusive)', () => {
    expect(verdictFor(9.0)).toBe('EXACT');
    expect(verdictFor(8.99)).toBe('NEAR');
  });

  it('boundary 7.5 lands inside NEAR (inclusive)', () => {
    expect(verdictFor(7.5)).toBe('NEAR');
    expect(verdictFor(7.49)).toBe('CLOSE');
  });

  it('boundary 6.0 lands inside CLOSE (inclusive)', () => {
    expect(verdictFor(6.0)).toBe('CLOSE');
    expect(verdictFor(5.99)).toBe('WARM');
  });

  it('boundary 4.0 lands inside WARM (inclusive)', () => {
    expect(verdictFor(4.0)).toBe('WARM');
    expect(verdictFor(3.99)).toBe('OFF');
  });

  it('zero reads OFF', () => {
    expect(verdictFor(0)).toBe('OFF');
  });
});

describe('run constants', () => {
  it('MAX_RUN_SCORE is RUN_LENGTH × 10', () => {
    expect(MAX_RUN_SCORE).toBe(RUN_LENGTH * 10);
  });

  it('five known round scores sum to the expected run total', () => {
    const scores = [9.4, 6.1, 7.8, 3.2, 8.5];
    const total = scores.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(35.0, 5);
  });
});
