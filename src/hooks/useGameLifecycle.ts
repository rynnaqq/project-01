import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { correctedNow, syncServerClock } from '../lib/serverClock';
import {
  buildPlan,
  parseGamePlan,
  phaseAt,
  type GamePlan,
  type LifecycleState,
} from '../lib/gameLifecycle';
import { resetRoom, updateRoomSettings, type Room } from '../lib/rooms';
import { createMatch } from '../lib/matches';

export type UseGameLifecycle = LifecycleState & {
  plan: GamePlan | null;
  /** Server-clock offset in ms (0 until synced). */
  clockOffset: number;
  /** Host: schedule a match with a synced countdown. */
  startMatch: (gameKey: string, durationMs: number) => Promise<{ error?: string }>;
  /** Host: clear the plan and return the room to lobby/waiting. */
  endMatch: () => Promise<{ error?: string }>;
};

/**
 * Drives the synced game lifecycle for a room. Reads the plan from the room's
 * `rules.game_plan` (so it survives reconnects and reaches late joiners), syncs
 * the server clock to correct for skew, and ticks the phase locally.
 */
export function useGameLifecycle(room: Room | null): UseGameLifecycle {
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const rafRef = useRef<number | null>(null);

  const plan = useMemo(() => parseGamePlan(room?.rules), [room?.rules]);

  // Sync the server clock once on mount…
  useEffect(() => {
    let active = true;
    void syncServerClock().then((offset) => {
      if (active) setClockOffset(offset);
    });
    return () => {
      active = false;
    };
  }, []);

  // …and keep it fresh (P6.2): drift grows over long sessions and reconnects,
  // so re-sync periodically and whenever connectivity returns. Keyed on plan
  // *presence* (not identity) so unrelated room updates don't reset the timer.
  const hasPlan = plan != null;
  useEffect(() => {
    if (!hasPlan) return;
    function resync() {
      void syncServerClock().then((offset) => setClockOffset(offset));
    }
    const id = setInterval(resync, 5 * 60 * 1000);
    window.addEventListener('online', resync);
    return () => {
      clearInterval(id);
      window.removeEventListener('online', resync);
    };
  }, [hasPlan]);

  // Tick the local clock (~10Hz) while a plan is active so the phase updates.
  useEffect(() => {
    if (!plan) return;
    let stop = false;
    let last = 0;
    const loop = (t: number) => {
      if (stop) return;
      if (t - last >= 100) {
        last = t;
        setNow(Date.now());
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      stop = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [plan]);

  const state = useMemo(
    () => phaseAt(now + clockOffset, plan),
    [now, clockOffset, plan],
  );

  const startMatch = useCallback(
    async (gameKey: string, durationMs: number) => {
      if (!room) return { error: 'No room.' };
      // Open a persisted match so all clients can report scores against it.
      const created = await createMatch(room.id, gameKey);
      if (!created.ok) return { error: created.error };

      const serverNow = correctedNow(clockOffset);
      const newPlan = buildPlan(gameKey, serverNow, { durationMs, matchId: created.match.id });
      const nextRules = { ...(room.rules ?? {}), game_plan: newPlan };
      const settings = await updateRoomSettings(room.id, {
        rules: nextRules,
        selected_game: gameKey,
      });
      if (settings.error) return settings;
      return { error: undefined };
    },
    [room, clockOffset],
  );

  const endMatch = useCallback(async () => {
    if (!room) return { error: 'No room.' };
    const nextRules = { ...(room.rules ?? {}) };
    delete (nextRules as Record<string, unknown>).game_plan;
    const settings = await updateRoomSettings(room.id, { rules: nextRules });
    if (settings.error) return settings;
    return resetRoom(room.id);
  }, [room]);

  return { ...state, plan, clockOffset, startMatch, endMatch };
}
