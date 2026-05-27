import { getSupabase } from './client';
import { getPlayerId } from './player';

// 31-char base32 alphabet with ambiguous characters dropped (no 0, O, 1, I, L).
// 6 chars → ~887M combinations; plenty for v1, retry-on-conflict guards
// against the vanishingly small collision case.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const MATCH_ID_LENGTH = 6;
const MATCH_ID_RE = new RegExp(`^[${ALPHABET}]{${MATCH_ID_LENGTH}}$`);

const EXPIRY_DAYS = 30;

export type MatchStatus = 'open' | 'full' | 'expired';

export interface MatchRow {
  id: string;
  gameId: string;
  seed: string;
  createdBy: string;
  createdByRunId: string | null;
  status: MatchStatus;
  maxPlayers: number;
  createdAt: string;
  expiresAt: string | null;
}

export interface MatchRunRow {
  id: string;
  playerId: string;
  matchId: string;
  totalScore: number;
  roundScores: number[];
  /** Hue stores `{ guesses: HSB[] }` here; future games may store more. */
  gameData: unknown;
  createdAt: string;
}

export interface CreateMatchInput {
  gameId: string;
  seed: string;
  /** For "Challenge after I played": the just-finished Free Play run's id.
   *  Null/omitted for "Play together". */
  createdByRunId?: string | null;
}

/** Generate a fresh match id. Module-level so tests can mock crypto if needed. */
export function generateMatchId(): string {
  const bytes = new Uint8Array(MATCH_ID_LENGTH);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < MATCH_ID_LENGTH; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** Validate / normalize a match id from user input (or a URL param). Returns
 *  null if it doesn't conform to the 6-char base32 shape after uppercasing. */
export function normalizeMatchId(raw: string): string | null {
  const upper = raw.trim().toUpperCase();
  return MATCH_ID_RE.test(upper) ? upper : null;
}

/** Insert a new match with retry-on-conflict (capped at 3 attempts). */
export async function createMatch(
  input: CreateMatchInput,
): Promise<MatchRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const expiresAt = new Date(
    Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const createdBy = getPlayerId();

  for (let attempt = 0; attempt < 3; attempt++) {
    const id = generateMatchId();
    try {
      const { data, error } = await supabase
        .from('matches')
        .insert({
          id,
          game_id: input.gameId,
          seed: input.seed,
          created_by: createdBy,
          created_by_run_id: input.createdByRunId ?? null,
          status: 'open',
          max_players: 2,
          expires_at: expiresAt,
        })
        .select('*')
        .single();
      if (error) {
        // 23505 = unique_violation. Retry on collision; bail on anything else.
        if (error.code === '23505') continue;
        console.warn('[hue] createMatch failed', error);
        return null;
      }
      return rowToMatch(data);
    } catch (err) {
      console.warn('[hue] createMatch threw', err);
      return null;
    }
  }
  console.warn('[hue] createMatch exhausted retries — id collisions');
  return null;
}

/** Fetch a match by id. Returns null on not-found. */
export async function getMatch(matchId: string): Promise<MatchRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const normalized = normalizeMatchId(matchId);
  if (!normalized) return null;
  try {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('id', normalized)
      .maybeSingle();
    if (error || !data) return null;
    return rowToMatch(data);
  } catch (err) {
    console.warn('[hue] getMatch threw', err);
    return null;
  }
}

/** All runs participating in a match, newest first. Used by the Match
 *  Results screen both for the initial fetch and the polling loop. */
export async function getMatchRuns(matchId: string): Promise<MatchRunRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const normalized = normalizeMatchId(matchId);
  if (!normalized) return [];
  try {
    const { data, error } = await supabase
      .from('runs')
      .select(
        'id, player_id, match_id, total_score, round_scores, game_data, created_at',
      )
      .eq('match_id', normalized)
      .order('created_at', { ascending: true });
    if (error || !data) return [];
    return data.map((r) => ({
      id: r.id,
      playerId: r.player_id,
      matchId: r.match_id,
      totalScore: Number(r.total_score),
      roundScores: (r.round_scores as number[]).map(Number),
      gameData: r.game_data,
      createdAt: r.created_at,
    }));
  } catch (err) {
    console.warn('[hue] getMatchRuns threw', err);
    return [];
  }
}

/** Transition status (typically 'open' → 'full' once both runs are in, or
 *  'expired' for an expired-on-access cleanup). Best-effort. */
export async function updateMatchStatus(
  matchId: string,
  status: MatchStatus,
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const normalized = normalizeMatchId(matchId);
  if (!normalized) return false;
  try {
    const { error } = await supabase
      .from('matches')
      .update({ status })
      .eq('id', normalized);
    if (error) {
      console.warn('[hue] updateMatchStatus failed', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[hue] updateMatchStatus threw', err);
    return false;
  }
}

/** True if `match.expires_at` is in the past. Used by the join flow to
 *  surface the "match has closed" screen without depending on a server-side
 *  cleanup job (we don't have one in v1). */
export function isMatchExpired(match: MatchRow): boolean {
  if (match.status === 'expired') return true;
  if (!match.expiresAt) return false;
  return new Date(match.expiresAt).getTime() < Date.now();
}

function rowToMatch(row: Record<string, unknown>): MatchRow {
  return {
    id: row.id as string,
    gameId: row.game_id as string,
    seed: row.seed as string,
    createdBy: row.created_by as string,
    createdByRunId: (row.created_by_run_id as string | null) ?? null,
    status: row.status as MatchStatus,
    maxPlayers: Number(row.max_players),
    createdAt: row.created_at as string,
    expiresAt: (row.expires_at as string | null) ?? null,
  };
}
