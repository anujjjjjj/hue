// localStorage layer for Daily runs. One key per UTC date, so a Daily run
// in progress survives a page reload and a completed Daily can be revisited.
//
// Stored under `hue:daily:YYYY-MM-DD`. Old keys are lazily pruned on app
// load so a year of dailies (~50KB worst case) doesn't accumulate.

import type { HSB } from './color';
import type { RunRoundEntry } from '../store/gameStore';
import { parseUTCDate, todayUTC } from './daily';

const KEY_PREFIX = 'hue:daily:';
const PRUNE_MAX_AGE_DAYS = 30;

/** What we persist for a Daily — enough to resume in progress OR show the
 *  same Summary on a revisit. */
export interface DailyStored {
  date: string;
  targets: HSB[];
  results: RunRoundEntry[];
  totalScore: number;
  completed: boolean;
  startedAtMs: number;
  completedAtMs?: number;
}

function key(date: string): string {
  return `${KEY_PREFIX}${date}`;
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadDaily(date: string): DailyStored | null {
  const store = safeStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(key(date));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailyStored;
    if (!parsed || parsed.date !== date) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDaily(value: DailyStored): void {
  const store = safeStorage();
  if (!store) return;
  try {
    store.setItem(key(value.date), JSON.stringify(value));
  } catch {
    // Quota / private-mode failures shouldn't crash a run.
  }
}

/** Lazy GC: drop hue:daily:* keys older than 30 days. Cheap on every app
 *  load — at most ~30 keys to consider, so we keep it inline rather than
 *  scheduling. */
export function pruneOldDailies(now: Date = new Date()): void {
  const store = safeStorage();
  if (!store) return;
  const today = parseUTCDate(todayUTC(now));
  if (!today) return;
  const cutoffMs = today.getTime() - PRUNE_MAX_AGE_DAYS * 24 * 3600 * 1000;
  const toDelete: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (!k || !k.startsWith(KEY_PREFIX)) continue;
    const date = k.slice(KEY_PREFIX.length);
    const d = parseUTCDate(date);
    if (!d) {
      toDelete.push(k);
      continue;
    }
    if (d.getTime() < cutoffMs) toDelete.push(k);
  }
  for (const k of toDelete) {
    try {
      store.removeItem(k);
    } catch {
      // Swallow; pruning is best-effort.
    }
  }
}
