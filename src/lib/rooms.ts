import { supabase } from './supabase';
import type { Database } from './database.types';
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from './roomCode';

export type Room = Database['public']['Tables']['rooms']['Row'];
export type RoomPlayer = Database['public']['Tables']['room_players']['Row'];

/** A room_players row enriched with the player's profile fields for display. */
export type RosterEntry = RoomPlayer & {
  profile: {
    username: string;
    avatar: string;
    online_status: boolean;
  } | null;
};

const MAX_CODE_ATTEMPTS = 8;
const PG_UNIQUE_VIOLATION = '23505';

export type CreateRoomResult =
  | { ok: true; room: Room }
  | { ok: false; error: string };

export type JoinRoomResult =
  | { ok: true; room: Room }
  | { ok: false; error: string };

/**
 * Create a room owned by the given host, retrying on the (rare) event of a
 * room-code collision. Also adds the host as the first room player.
 */
export async function createRoom(
  hostId: string,
  selectedGame?: string | null,
): Promise<CreateRoomResult> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = generateRoomCode();
    const { data, error } = await supabase
      .from('rooms')
      .insert({ code, host_id: hostId, selected_game: selectedGame ?? null })
      .select('*')
      .single();

    if (error) {
      if (error.code === PG_UNIQUE_VIOLATION) {
        continue; // collision — try a fresh code
      }
      return { ok: false, error: error.message };
    }

    // Add the host to the roster. Best-effort: if this fails the room still
    // exists and the host can be re-added on room load.
    const { error: joinError } = await supabase
      .from('room_players')
      .insert({ room_id: data.id, player_id: hostId });
    if (joinError && joinError.code !== PG_UNIQUE_VIOLATION) {
      return { ok: false, error: joinError.message };
    }

    return { ok: true, room: data };
  }

  return { ok: false, error: 'Could not allocate a unique room code. Please try again.' };
}

/** Look up a room by its (normalized) code. */
export async function getRoomByCode(code: string): Promise<Room | null> {
  const normalized = normalizeRoomCode(code);
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', normalized)
    .maybeSingle();
  if (error) {
    console.error('getRoomByCode failed:', error.message);
    return null;
  }
  return data;
}

/** Re-fetch a room row by id — used to resync after reconnects (P6.2). */
export async function getRoomById(roomId: string): Promise<Room | null> {
  const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).maybeSingle();
  if (error) {
    console.error('getRoomById failed:', error.message);
    return null;
  }
  return data;
}

/** Fetch the current roster for a room. */
export async function getRoomPlayers(roomId: string): Promise<RoomPlayer[]> {
  const { data, error } = await supabase
    .from('room_players')
    .select('*')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true });
  if (error) {
    console.error('getRoomPlayers failed:', error.message);
    return [];
  }
  return data ?? [];
}

/** Fetch the roster joined with each player's profile (username/avatar/status). */
export async function getRoomRoster(roomId: string): Promise<RosterEntry[]> {
  const { data, error } = await supabase
    .from('room_players')
    .select('*, profile:profiles!room_players_player_id_fkey(username, avatar, online_status)')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true });
  if (error) {
    console.error('getRoomRoster failed:', error.message);
    return [];
  }
  return (data as unknown as RosterEntry[]) ?? [];
}

/** Set the current player's ready flag within a room. */
export async function setReady(
  playerId: string,
  roomId: string,
  ready: boolean,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('room_players')
    .update({ is_ready: ready })
    .eq('room_id', roomId)
    .eq('player_id', playerId);
  return error ? { error: error.message } : {};
}

/**
 * Join a room by code. Validates that the code is well-formed and the room
 * exists; the room must not be full. Idempotent if the player is already a
 * member — including mid-game, so a page refresh during a match rejoins the
 * same room instead of bouncing the player out (P6.2).
 */
export async function joinRoom(playerId: string, rawCode: string): Promise<JoinRoomResult> {
  const code = normalizeRoomCode(rawCode);
  if (!isValidRoomCode(code)) {
    return { ok: false, error: 'Enter a valid 6-character room code.' };
  }

  const room = await getRoomByCode(code);
  if (!room) {
    return { ok: false, error: 'No room found with that code.' };
  }

  // Existing members always pass — this is the reconnect path.
  const players = await getRoomPlayers(room.id);
  if (players.some((p) => p.player_id === playerId)) {
    return { ok: true, room };
  }

  if (room.status === 'playing' || room.status === 'finished') {
    return { ok: false, error: 'That game has already started.' };
  }
  if (players.length >= room.max_players) {
    return { ok: false, error: 'That room is full.' };
  }

  const { error } = await supabase
    .from('room_players')
    .insert({ room_id: room.id, player_id: playerId });
  if (error && error.code !== PG_UNIQUE_VIOLATION) {
    return { ok: false, error: error.message };
  }

  return { ok: true, room };
}

/** Remove a player from a room. */
export async function leaveRoom(playerId: string, roomId: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('room_players')
    .delete()
    .eq('room_id', roomId)
    .eq('player_id', playerId);
  return error ? { error: error.message } : {};
}

/** Host action: remove another player from the room (RLS enforces host-only). */
export async function kickPlayer(
  roomId: string,
  targetPlayerId: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('room_players')
    .delete()
    .eq('room_id', roomId)
    .eq('player_id', targetPlayerId);
  return error ? { error: error.message } : {};
}

export type RoomSettings = {
  selected_game?: string | null;
  max_players?: number;
  rules?: Record<string, unknown>;
};

/** Host action: update room settings (game, capacity, rules). RLS host-only. */
export async function updateRoomSettings(
  roomId: string,
  settings: RoomSettings,
): Promise<{ error?: string }> {
  const { error } = await supabase.from('rooms').update(settings).eq('id', roomId);
  return error ? { error: error.message } : {};
}

/** Host action: transition the room into the "playing" state. RLS host-only. */
export async function startGame(roomId: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('rooms').update({ status: 'playing' }).eq('id', roomId);
  return error ? { error: error.message } : {};
}

/** Host action: return the room to the "waiting" state (e.g. after a match). */
export async function resetRoom(roomId: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('rooms').update({ status: 'waiting' }).eq('id', roomId);
  return error ? { error: error.message } : {};
}
