import { supabase } from './supabase';
import type { Database } from './database.types';
import { clampScore } from './scoreHelpers';

export type Match = Database['public']['Tables']['matches']['Row'];
export type Score = Database['public']['Tables']['scores']['Row'];

/** A score row enriched with the player's profile for scoreboard display. */
export type ScoreEntry = Score & {
  profile: { username: string; avatar: string } | null;
};

export type CreateMatchResult = { ok: true; match: Match } | { ok: false; error: string };

/** Host action: open a new match for a room. */
export async function createMatch(roomId: string, gameKey: string): Promise<CreateMatchResult> {
  const { data, error } = await supabase
    .from('matches')
    .insert({ room_id: roomId, game_key: gameKey })
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, match: data };
}

/**
 * Report the current player's score for a match. Client-trusted but lightly
 * validated (clamped to a safe integer range). Upserts on (match_id, player_id).
 */
export async function reportScore(
  matchId: string,
  playerId: string,
  rawScore: number,
): Promise<{ error?: string }> {
  const score = clampScore(rawScore);
  const { error } = await supabase
    .from('scores')
    .upsert({ match_id: matchId, player_id: playerId, score }, { onConflict: 'match_id,player_id' });
  return error ? { error: error.message } : {};
}

/** Host action: finalise a match with the winner and end time. */
export async function finalizeMatch(
  matchId: string,
  winnerId: string | null,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('matches')
    .update({ winner_id: winnerId, ended_at: new Date().toISOString() })
    .eq('id', matchId);
  return error ? { error: error.message } : {};
}

/** Fetch the scores for a match, joined with player profiles. */
export async function getMatchScores(matchId: string): Promise<ScoreEntry[]> {
  const { data, error } = await supabase
    .from('scores')
    .select('*, profile:profiles!scores_player_id_fkey(username, avatar)')
    .eq('match_id', matchId);
  if (error) {
    console.error('getMatchScores failed:', error.message);
    return [];
  }
  return (data as unknown as ScoreEntry[]) ?? [];
}

/** Fetch recent match history for a room (most recent first). */
export async function getMatchHistory(roomId: string, limit = 10): Promise<Match[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('room_id', roomId)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('getMatchHistory failed:', error.message);
    return [];
  }
  return data ?? [];
}
