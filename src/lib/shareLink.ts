// Helpers for the share link. The ?d=YYYY-MM-DD deep link bakes the Daily
// date into a URL so a recipient lands directly in that Daily on their own
// device — same colors, same puzzle. Build Spec 04 (Versus) will piggyback
// on this same pattern with a ?seed= variant.

export function shareUrlForDaily(date: string, origin?: string): string {
  const o =
    origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return `${o}/?d=${date}`;
}

export function shareUrlForFreePlay(origin?: string): string {
  const o =
    origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return o || '/';
}

export function buildShareCaption(
  mode: 'daily' | 'free',
  totalScore: number,
): string {
  // Editorial voice — no emoji, no exclamation marks. The image carries
  // the visual; text is meta.
  const label = mode === 'daily' ? 'My Hue daily' : 'My Hue run';
  return `${label} · ${totalScore.toFixed(1)} / 50`;
}
