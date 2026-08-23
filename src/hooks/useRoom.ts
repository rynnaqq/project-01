import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  getRoomById,
  getRoomRoster,
  joinRoom,
  setReady as setReadyRpc,
  type Room,
  type RosterEntry,
} from '../lib/rooms';

export type UseRoomState = {
  room: Room | null;
  roster: RosterEntry[];
  /** Set of player ids currently connected via Realtime presence. */
  onlineIds: Set<string>;
  loading: boolean;
  error: string | null;
  toggleReady: () => Promise<void>;
};

/**
 * Subscribe to a room by code: initial load + live updates for the roster
 * (room_players changes), room status (rooms changes), and connected players
 * (Realtime presence).
 *
 * Reconnection (P6.2): if the realtime channel errors or times out, the setup
 * re-runs after a short backoff — rejoining the room and resubscribing. When
 * the browser regains connectivity or the tab becomes visible again, the room
 * row and roster are refetched so missed updates are reconciled. The game plan
 * lives in `rooms.rules`, so a refresh mid-match restores the in-progress game
 * automatically.
 */
export function useRoom(code: string | undefined, userId: string | undefined): UseRoomState {
  const [room, setRoom] = useState<Room | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Bumped to force the subscribe effect to re-run after a channel drop. */
  const [retryCount, setRetryCount] = useState(0);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const backoffRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshRoster = useCallback(async (roomId: string) => {
    setRoster(await getRoomRoster(roomId));
  }, []);

  /** Pull the authoritative room row + roster again (reconnect recovery). */
  const resync = useCallback(async () => {
    const roomId = roomIdRef.current;
    if (!roomId) return;
    const fresh = await getRoomById(roomId);
    if (fresh) setRoom(fresh);
    await refreshRoster(roomId);
  }, [refreshRoster]);

  useEffect(() => {
    let active = true;

    async function setup() {
      if (!code || !userId) return;
      setLoading(true);
      setError(null);

      const join = await joinRoom(userId, code);
      if (!active) return;
      if (!join.ok) {
        setError(join.error);
        setLoading(false);
        return;
      }

      const loadedRoom = join.room;
      setRoom(loadedRoom);
      roomIdRef.current = loadedRoom.id;
      await refreshRoster(loadedRoom.id);
      if (!active) return;
      setLoading(false);

      const channel = supabase.channel(`room:${loadedRoom.id}`, {
        config: { presence: { key: userId } },
      });

      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${loadedRoom.id}` },
          () => {
            void refreshRoster(loadedRoom.id);
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${loadedRoom.id}` },
          (payload) => {
            setRoom(payload.new as Room);
          },
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'rooms', filter: `id=eq.${loadedRoom.id}` },
          () => {
            setError('This room has been closed by the host.');
            setRoom(null);
          },
        )
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          setOnlineIds(new Set(Object.keys(state)));
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            void channel.track({ user_id: userId, at: Date.now() });
            return;
          }
          // Dropped connection: tear down and retry with a short backoff.
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (channelRef.current) {
              void supabase.removeChannel(channelRef.current);
              channelRef.current = null;
            }
            if (backoffRef.current) clearTimeout(backoffRef.current);
            backoffRef.current = setTimeout(() => {
              if (active) setRetryCount((c) => c + 1);
            }, 1500);
          }
        });

      channelRef.current = channel;
    }

    void setup();

    return () => {
      active = false;
      if (backoffRef.current) {
        clearTimeout(backoffRef.current);
        backoffRef.current = null;
      }
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [code, userId, retryCount, refreshRoster]);

  // Recover missed updates when connectivity or tab visibility returns.
  useEffect(() => {
    function onOnline() {
      void resync();
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') void resync();
    }
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [resync]);

  const toggleReady = useCallback(async () => {
    if (!userId || !roomIdRef.current) return;
    const me = roster.find((r) => r.player_id === userId);
    const next = !(me?.is_ready ?? false);
    await setReadyRpc(userId, roomIdRef.current, next);
    // Optimistic; the realtime event will reconcile.
    await refreshRoster(roomIdRef.current);
  }, [userId, roster, refreshRoster]);

  return { room, roster, onlineIds, loading, error, toggleReady };
}
