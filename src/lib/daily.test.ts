import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  todayUTC,
  dateToUTCString,
  parseUTCDate,
  dateToSeed,
  getDailyRun,
  msUntilNextUTCMidnight,
  formatDailyDate,
} from './daily';
import { RUN_LENGTH } from './run';

afterEach(() => {
  vi.useRealTimers();
});

describe('todayUTC / dateToUTCString', () => {
  it('formats as YYYY-MM-DD', () => {
    const d = new Date(Date.UTC(2026, 4, 16, 12, 0, 0));
    expect(dateToUTCString(d)).toBe('2026-05-16');
  });

  it('uses UTC, not local time — 23:30 in a UTC-X timezone is still today UTC', () => {
    // 2026-05-16T23:30:00Z is May 16 in UTC regardless of local zone
    const d = new Date(Date.UTC(2026, 4, 16, 23, 30, 0));
    expect(dateToUTCString(d)).toBe('2026-05-16');
  });

  it('rolls into the next UTC day at 00:00 UTC', () => {
    const before = new Date(Date.UTC(2026, 4, 16, 23, 59, 59));
    const after = new Date(Date.UTC(2026, 4, 17, 0, 0, 0));
    expect(dateToUTCString(before)).toBe('2026-05-16');
    expect(dateToUTCString(after)).toBe('2026-05-17');
  });

  it('todayUTC respects mocked time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 16, 8, 0, 0)));
    expect(todayUTC()).toBe('2026-05-16');
  });
});

describe('parseUTCDate', () => {
  it('parses a valid date string', () => {
    const d = parseUTCDate('2026-05-16');
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2026);
    expect(d!.getUTCMonth()).toBe(4);
    expect(d!.getUTCDate()).toBe(16);
  });

  it('rejects malformed strings', () => {
    expect(parseUTCDate('2026/05/16')).toBeNull();
    expect(parseUTCDate('not a date')).toBeNull();
    expect(parseUTCDate('')).toBeNull();
    expect(parseUTCDate('2026-5-16')).toBeNull();
  });

  it('rejects out-of-range dates (Feb 30)', () => {
    expect(parseUTCDate('2026-02-30')).toBeNull();
    expect(parseUTCDate('2026-13-01')).toBeNull();
  });
});

describe('dateToSeed', () => {
  it('is stable for a given date', () => {
    expect(dateToSeed('2026-05-16')).toBe(dateToSeed('2026-05-16'));
  });

  it('different dates yield different seeds', () => {
    expect(dateToSeed('2026-05-16')).not.toBe(dateToSeed('2026-05-17'));
  });
});

describe('getDailyRun', () => {
  it('returns RUN_LENGTH colors', () => {
    expect(getDailyRun('2026-05-16')).toHaveLength(RUN_LENGTH);
  });

  it('same date string -> identical 5 colors (the core Daily guarantee)', () => {
    expect(getDailyRun('2026-05-16')).toEqual(getDailyRun('2026-05-16'));
  });

  it('different dates -> different runs', () => {
    expect(getDailyRun('2026-05-16')).not.toEqual(getDailyRun('2026-05-17'));
  });

  it('produces the same run across many calls (regression: no shared RNG state)', () => {
    const first = getDailyRun('2026-05-16');
    for (let i = 0; i < 10; i++) {
      expect(getDailyRun('2026-05-16')).toEqual(first);
    }
  });

  it('defaults to todayUTC when no date provided', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 16, 12, 0, 0)));
    expect(getDailyRun()).toEqual(getDailyRun('2026-05-16'));
  });
});

describe('msUntilNextUTCMidnight', () => {
  it('returns ~24h at the very start of a UTC day', () => {
    const now = new Date(Date.UTC(2026, 4, 16, 0, 0, 1));
    // Approx 24h minus one second
    expect(msUntilNextUTCMidnight(now)).toBeCloseTo(24 * 3600 * 1000 - 1000, -2);
  });

  it('returns ~1ms when called just before UTC midnight', () => {
    const now = new Date(Date.UTC(2026, 4, 16, 23, 59, 59, 999));
    expect(msUntilNextUTCMidnight(now)).toBe(1);
  });
});

describe('formatDailyDate', () => {
  it('formats to MMM D', () => {
    expect(formatDailyDate('2026-05-16')).toBe('MAY 16');
    expect(formatDailyDate('2026-01-01')).toBe('JAN 1');
    expect(formatDailyDate('2026-12-31')).toBe('DEC 31');
  });

  it('returns the original string if malformed', () => {
    expect(formatDailyDate('not a date')).toBe('not a date');
  });
});

describe('Daily date locking — UTC handoff edge case', () => {
  it("a run started at 23:59 UTC keeps yesterday's date even when finished after midnight", () => {
    // This is the contract the store enforces: store the date the run STARTED
    // under, not the date it ended. Confirm getDailyRun(startDate) is what we
    // get regardless of when we ask.
    const startedAt = new Date(Date.UTC(2026, 4, 16, 23, 59, 0));
    const startDate = dateToUTCString(startedAt);
    expect(startDate).toBe('2026-05-16');

    const finishedAt = new Date(Date.UTC(2026, 4, 17, 0, 1, 0));
    expect(dateToUTCString(finishedAt)).toBe('2026-05-17');

    // The run's colors remain those of 05-16, the day it started.
    expect(getDailyRun(startDate)).toEqual(getDailyRun('2026-05-16'));
  });
});
