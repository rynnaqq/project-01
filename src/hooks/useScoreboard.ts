import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getMatchScores, type ScoreEntry } from '../lib/matches';
import { rankScores } from '../lib/scoreHelpers';

/**
 * Live scoreboard for a match: initial load + realtime updates as players
 * report scores. Entries are returned ranked (highest first).
 */
export function useScoreboard(matchId: string | null | undefined): {
  scores: ScoreEntry[];
  refresh: () => Promise<void>;
} {
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const refresh = useCallback(async () => {
    if (!matchId) return;
    const rows = await getMatchScores(matchId);
    setScores(rankScores(rows));
  }, [matchId]);

  useEffect(() => {
    if (!matchId) {
      setScores([]);
      return;
    }
    void refresh();

    const channel = supabase.channel(`scores:${matchId}`);
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scores', filter: `match_id=eq.${matchId}` },
        () => {
          void refresh();
        },
      )
      .subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [matchId, refresh]);

  return { scores, refresh };
}
