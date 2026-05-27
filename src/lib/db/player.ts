import { getSupabase } from './client';

const PLAYER_ID_KEY = 'hue:playerId';
const NICKNAME_KEY = 'hue:nickname';

let cachedId: string | null = null;

/** A device-stable UUID, generated lazily and cached in localStorage. The
 *  `hue:` prefix is namespacing for the app, not game identity — the same
 *  player id is used for every game in the studio. */
export function getPlayerId(): string {
  if (cachedId) return cachedId;
  if (typeof window === 'undefined') {
    // SSR or test environment — synthesize a throwaway. The real id is
    // re-resolved from localStorage on first browser load.
    return crypto.randomUUID();
  }
  let id = window.localStorage.getItem(PLAYER_ID_KEY);
  if (!id || !isUuid(id)) {
    id = crypto.randomUUID();
    window.localStorage.setItem(PLAYER_ID_KEY, id);
  }
  cachedId = id;
  return id;
}

/** Reads the locally-stored nickname (no network). Empty string if unset. */
export function getNickname(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(NICKNAME_KEY) ?? '';
}

/** Writes nickname locally and (best-effort) syncs to the backend. */
export async function setNickname(nickname: string): Promise<void> {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(NICKNAME_KEY, nickname);
  }
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase
      .from('players')
      .upsert(
        {
          id: getPlayerId(),
          nickname: nickname || null,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
  } catch (err) {
    console.warn('[hue] setNickname failed (non-fatal)', err);
  }
}

/** Upserts the local player into the backend with current nickname and
 *  bumps last_seen_at. Call once on app boot. Best-effort: never throws. */
export async function ensurePlayer(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase
      .from('players')
      .upsert(
        {
          id: getPlayerId(),
          nickname: getNickname() || null,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
  } catch (err) {
    console.warn('[hue] ensurePlayer failed (non-fatal)', err);
  }
}

/** Fetches another player's nickname. Returns '' if unknown / missing. */
export async function fetchPlayerNickname(playerId: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) return '';
  try {
    const { data, error } = await supabase
      .from('players')
      .select('nickname')
      .eq('id', playerId)
      .maybeSingle();
    if (error || !data) return '';
    return (data.nickname as string | null) ?? '';
  } catch (err) {
    console.warn('[hue] fetchPlayerNickname failed (non-fatal)', err);
    return '';
  }
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    s,
  );
}
