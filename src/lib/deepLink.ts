// Deep-link parsing. Structured so adding ?seed= (Build Spec 04 — Versus)
// is one extra branch, not a rewrite.

import { parseUTCDate, todayUTC } from './daily';

export type DeepLink =
  | { kind: 'daily-today'; date: string }
  | { kind: 'daily-past'; date: string }
  | { kind: 'none' };

export function parseDeepLink(search: string, today = todayUTC()): DeepLink {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
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
  if (!url.searchParams.has('d')) return;
  url.searchParams.delete('d');
  const search = url.searchParams.toString();
  window.history.replaceState(
    null,
    '',
    `${url.pathname}${search ? `?${search}` : ''}${url.hash}`,
  );
}
