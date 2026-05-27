// Deep-link parsing. The ?d= Daily branch and the ?m= multiplayer branch
// are independent — when both are present, ?m= wins (a recipient explicitly
// arriving via a match link should land in the match, not today's Daily).

import { parseUTCDate, todayUTC } from './daily';
import { normalizeMatchId } from './db/matches';

export type DeepLink =
  | { kind: 'daily-today'; date: string }
  | { kind: 'daily-past'; date: string }
  | { kind: 'match'; matchId: string }
  | { kind: 'none' };

export function parseDeepLink(search: string, today = todayUTC()): DeepLink {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return { kind: 'none' };
  }
  const m = params.get('m');
  if (m) {
    const normalized = normalizeMatchId(m);
    if (normalized) return { kind: 'match', matchId: normalized };
    return { kind: 'none' };
  }
  const d = params.get('d');
  if (d) {
    if (!parseUTCDate(d)) return { kind: 'none' };
    if (d === today) return { kind: 'daily-today', date: d };
    return { kind: 'daily-past', date: d };
  }
  return { kind: 'none' };
}

/** Clear deep-link params from the URL bar without reloading. Keeps the
 *  browser history single-entry so back doesn't re-trigger the deep link. */
export function clearDeepLink(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of ['d', 'm']) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (!changed) return;
  const search = url.searchParams.toString();
  window.history.replaceState(
    null,
    '',
    `${url.pathname}${search ? `?${search}` : ''}${url.hash}`,
  );
}
