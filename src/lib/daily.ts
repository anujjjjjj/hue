// Daily mode: a UTC date string -> a deterministic 5-color run.
//
// Every player worldwide sees the same colors for a given UTC date. Reset is
// 00:00 UTC — Wordle / NYT Connections converged on UTC for the same reason:
// it makes "today's Daily" globally consistent so a share posted at 23:00 NYC
// time doesn't disagree with the same date in London.

import type { HSB } from './color';
import { generateRun, hashSeed } from './rng';

/** YYYY-MM-DD for "today" in UTC. */
export function todayUTC(now: Date = new Date()): string {
  return dateToUTCString(now);
}

/** A Date -> 'YYYY-MM-DD' in UTC. Exposed for the resume-vs-finish edge case. */
export function dateToUTCString(d: Date): string {
  const y = d.getUTCFullYear();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Validates a 'YYYY-MM-DD' string and returns it as a UTC Date, or null. */
export function parseUTCDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

/** A date string -> a stable 32-bit seed. Prefix-namespaced so future
 *  seed-able features (Versus, themed events) won't collide. */
export function dateToSeed(dateString: string): number {
  return hashSeed(`hue:daily:${dateString}`);
}

/** The 5 colors for a given UTC date. Same date in, same colors out — every
 *  call, every device. This is the determinism guarantee Daily depends on. */
export function getDailyRun(dateString: string = todayUTC()): HSB[] {
  return generateRun(dateToSeed(dateString));
}

/** Milliseconds until the next UTC midnight. Used for the "Tomorrow's
 *  colors at 00:00 UTC · 9h 47m" countdown on a completed Daily. */
export function msUntilNextUTCMidnight(now: Date = new Date()): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return next - now.getTime();
}

/** Human-readable "MAY 15" from a 'YYYY-MM-DD' string. Used on the Intro
 *  sub-line and the Summary's Daily marker. */
export function formatDailyDate(dateString: string): string {
  const d = parseUTCDate(dateString);
  if (!d) return dateString;
  const months = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  ];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
