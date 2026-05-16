import { describe, it, expect } from 'vitest';
import { parseDeepLink } from './deepLink';

describe('parseDeepLink', () => {
  it('returns none for an empty search string', () => {
    expect(parseDeepLink('', '2026-05-16')).toEqual({ kind: 'none' });
  });

  it("treats today's date as daily-today", () => {
    expect(parseDeepLink('?d=2026-05-16', '2026-05-16')).toEqual({
      kind: 'daily-today',
      date: '2026-05-16',
    });
  });

  it('treats a past date as daily-past', () => {
    expect(parseDeepLink('?d=2026-05-15', '2026-05-16')).toEqual({
      kind: 'daily-past',
      date: '2026-05-15',
    });
  });

  it('treats a future date as daily-past too (not playable yet)', () => {
    // Same closed-message branch — keeps logic simple.
    expect(parseDeepLink('?d=2026-05-17', '2026-05-16')).toEqual({
      kind: 'daily-past',
      date: '2026-05-17',
    });
  });

  it('ignores malformed dates', () => {
    expect(parseDeepLink('?d=not-a-date', '2026-05-16')).toEqual({
      kind: 'none',
    });
    expect(parseDeepLink('?d=2026-13-99', '2026-05-16')).toEqual({
      kind: 'none',
    });
  });

  it('ignores unknown params', () => {
    expect(parseDeepLink('?foo=bar', '2026-05-16')).toEqual({ kind: 'none' });
  });
});
