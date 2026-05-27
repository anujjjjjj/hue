import { getSupabase } from './client';
import { getPlayerId } from './player';

export type RunMode = 'daily' | 'free' | 'match';

export interface SubmitRunInput {
  gameId: string;
  mode: RunMode;
  seed: string;
  /** 'YYYY-MM-DD' UTC for Daily; omitted otherwise. */
  dateKey?: string;
  /** Set for runs that participate in a match (joiner path). */
  matchId?: string;
  roundScores: number[];
  totalScore: number;
  /** Free-form per-game payload — Hue stores `{ guesses: HSB[] }`. */
  gameData?: unknown;
}

/** Insert a completed run. Returns the inserted row's id, or null if the
 *  backend is unconfigured / the call errored. Never throws; caller treats
 *  null as "skip the leaderboard, the local UX is still authoritative". */
export async function submitRun(input: SubmitRunInput): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const row = {
      game_id: input.gameId,
      player_id: getPlayerId(),
      mode: input.mode,
      seed: input.seed,
      date_key: input.dateKey ?? null,
      match_id: input.matchId ?? null,
      round_scores: input.roundScores,
      total_score: input.totalScore,
      game_data: input.gameData ?? null,
    };
    const { data, error } = await supabase
      .from('runs')
      .insert(row)
      .select('id')
      .single();
    if (error || !data) {
      console.warn('[hue] submitRun failed (non-fatal)', error);
      return null;
    }
    return data.id as string;
  } catch (err) {
    console.warn('[hue] submitRun threw (non-fatal)', err);
    return null;
  }
}

/** Attach an existing run (originally inserted with match_id = null) to a
 *  newly-created match. Used by the "Challenge after I played" flow.
 *  Best-effort; returns true on success. */
export async function attachRunToMatch(
  runId: string,
  matchId: string,
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('runs')
      .update({ match_id: matchId })
      .eq('id', runId);
    if (error) {
      console.warn('[hue] attachRunToMatch failed (non-fatal)', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[hue] attachRunToMatch threw (non-fatal)', err);
    return false;
  }
}
