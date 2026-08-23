import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { useToast } from '../context/ToastProvider';
import { useRoom } from '../hooks/useRoom';
import { useGameLifecycle } from '../hooks/useGameLifecycle';
import { useScoreboard } from '../hooks/useScoreboard';
import GameStage from '../components/GameStage';
import Scoreboard from '../components/Scoreboard';
import { kickPlayer, leaveRoom, startGame, updateRoomSettings } from '../lib/rooms';
import {
  finalizeMatch,
  getMatchHistory,
  reportScore,
  type Match,
} from '../lib/matches';
import { computeWinner } from '../lib/scoreHelpers';
import { shouldAwardWalkover } from '../lib/walkover';
import { getAvatar } from '../lib/avatars';
import { friendlyMessage } from '../lib/errors';
import { getGame } from '../lib/games';
import { getGameComponent, getGameDuration } from '../games/registry';
import { GameIcon } from '../components/icons';

/**
 * Room view (P2.3 + P4.1 + P4.2 + Phase 5): live roster/presence/ready, host
 * controls, a synced game lifecycle, and a live scoreboard with match-history
 * persistence. The active phase renders the mini-game resolved from the game
 * registry, so each game plugs into the same engine.
 */
export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const { session } = useAuth();
  const navigate = useNavigate();
  const userId = session?.user.id;

  const { room, roster, onlineIds, loading, error, toggleReady } = useRoom(code, userId);
  const lifecycle = useGameLifecycle(room);
  const matchId = lifecycle.plan?.matchId ?? null;
  const { scores } = useScoreboard(matchId);
  const { push } = useToast();

  /** Surface a failed action as a toast with a friendly message. */
  const reportError = useCallback(
    (raw: string | undefined) => {
      if (raw) push(friendlyMessage(raw));
    },
    [push],
  );

  // Walkover (last player standing): while a match is live, watch the roster.
  // If a match that ever had two or more members drops to exactly one, that
  // survivor wins by default. The flag resets whenever the room leaves
  // 'playing', so solo rooms (roster of one from match start) never qualify.
  const sawMultiplayerRef = useRef(false);
  useEffect(() => {
    if (room?.status !== 'playing') {
      sawMultiplayerRef.current = false;
      return;
    }
    if (roster.length >= 2) sawMultiplayerRef.current = true;
  }, [room?.status, roster.length]);

  // Fire once per match: finalize it with the survivor as winner, announce,
  // then clear the plan so the room returns to the lobby. The leaver's own
  // host migration (migration 0004) promotes the survivor when needed, which
  // keeps both writes permitted under RLS.
  const walkoverDoneRef = useRef(new Set<string>());
  const endMatch = lifecycle.endMatch;
  useEffect(() => {
    if (!room || !userId || !matchId) return;
    if (walkoverDoneRef.current.has(matchId)) return;

    const last = roster.length === 1 ? roster[0] : null;
    const isWalkover = shouldAwardWalkover({
      roomStatus: room.status,
      matchId,
      rosterSize: roster.length,
      sawMultiplayer: sawMultiplayerRef.current,
    });
    // Only the remaining member acts; everyone else has already left.
    if (!isWalkover || !last || last.player_id !== userId) return;

    walkoverDoneRef.current.add(matchId);
    void (async () => {
      const { error: finalizeError } = await finalizeMatch(matchId, userId);
      reportError(finalizeError);
      push(
        `${getAvatar(last.profile?.avatar).emoji} Everyone else left. You win the match!`,
        'success',
      );
      const { error: endError } = await endMatch();
      reportError(endError);
    })();
  }, [room, roster, userId, matchId, endMatch, push, reportError]);

  const gameKey = lifecycle.plan?.gameKey ?? room?.selected_game ?? null;
  const GameComponent = useMemo(() => getGameComponent(lifecycle.plan?.gameKey), [lifecycle.plan?.gameKey]);
  const playerIds = useMemo(() => roster.map((entry) => entry.player_id), [roster]);

  // Recent match history for this room (P4.2): refetch on room load and
  // whenever the lifecycle leaves the results phase (a match just finished).
  const [history, setHistory] = useState<Match[]>([]);
  const phase = lifecycle.phase;
  useEffect(() => {
    if (!room) return;
    let active = true;
    void getMatchHistory(room.id, 5).then((rows) => {
      if (active) setHistory(rows);
    });
    return () => {
      active = false;
    };
  }, [room, phase]);

  /** Passed to the mounted mini-game; publishes an absolute score. */
  const handleReportScore = useCallback(
    (score: number) => {
      if (!userId || !matchId) return;
      void reportScore(matchId, userId, score).then(({ error: scoreError }) => {
        reportError(scoreError);
      });
    },
    [userId, matchId, reportError],
  );

  async function handleLeave() {
    if (userId && room) {
      await leaveRoom(userId, room.id);
    }
    navigate('/lobby');
  }

  async function handleKick(targetId: string) {
    if (!room) return;
    const { error: kickError } = await kickPlayer(room.id, targetId);
    reportError(kickError);
  }

  async function handleStart() {
    if (!room) return;
    const selected = room.selected_game ?? 'noop';
    // Flip room status, then schedule a synced match whose duration comes from
    // the game registry.
    const { error: startError } = await startGame(room.id);
    if (startError) {
      reportError(startError);
      return;
    }
    const { error: planError } = await lifecycle.startMatch(selected, getGameDuration(selected));
    reportError(planError);
  }

  async function handleEnd() {
    if (lifecycle.plan?.matchId) {
      await finalizeMatch(lifecycle.plan.matchId, computeWinner(scores));
    }
    const { error: endError } = await lifecycle.endMatch();
    reportError(endError);
  }

  async function handleCapacity(nextMax: number) {
    if (!room) return;
    const { error: settingsError } = await updateRoomSettings(room.id, { max_players: nextMax });
    reportError(settingsError);
  }

  if (loading) return <p className="font-medium text-stone-600">Loading room…</p>;

  if (error) {
    return (
      <section>
        <h1 className="font-display text-xl uppercase tracking-wide">Room</h1>
        <p
          role="alert"
          className="mt-3 rounded-xl border-[3px] border-arcade-ink bg-[#ffe3df] px-3 py-2.5 text-sm font-semibold text-[#7c2d24] shadow-pop-sm"
        >
          {friendlyMessage(error)}
        </p>
        <button
          type="button"
          onClick={() => navigate('/lobby')}
          className="mt-4 cursor-pointer rounded-full border-[3px] border-arcade-ink bg-arcade-panel px-4 py-2 text-sm font-bold text-arcade-ink shadow-pop-sm transition-all hover:-translate-y-0.5 hover:bg-arcade-sun hover:shadow-pop"
        >
          Back to lobby
        </button>
      </section>
    );
  }

  if (!room) return <p className="font-medium text-stone-600">Room not found.</p>;

  const isHost = userId === room.host_id;
  const me = roster.find((r) => r.player_id === userId);
  const everyoneReady = roster.length >= 2 && roster.every((r) => r.is_ready);

  return (
    <section className="flex flex-col gap-6">
      <header className="slab flex flex-wrap items-center justify-between gap-4 rotate-[0.5deg] p-5 shadow-pop">
        <div>
          <h1 className="font-display text-lg uppercase tracking-wide">Room</h1>
          <p className="mt-1.5 flex items-center gap-2 text-sm font-medium text-stone-600">
            Share this code:
            <span className="rounded-xl border-[3px] border-arcade-ink bg-arcade-sun px-2.5 py-0.5 font-mono text-xl font-bold tracking-[0.3em] text-arcade-ink shadow-pop-sm">
              {room.code}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="sticker bg-arcade-sea px-3 py-1 text-xs capitalize text-arcade-ink">
            {room.status}
          </span>
          <button
            type="button"
            onClick={handleLeave}
            className="cursor-pointer rounded-full border-[3px] border-arcade-ink bg-arcade-panel px-4 py-1.5 text-sm font-bold text-arcade-ink transition-all hover:-translate-y-0.5 hover:bg-arcade-sun hover:shadow-pop-sm"
          >
            Leave
          </button>
        </div>
      </header>


      {room.status === 'playing' && lifecycle.plan && (
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-base uppercase tracking-wide">
            {getGame(gameKey ?? '')?.title ?? 'Lifecycle demo'}
          </h2>
          <GameStage
            lifecycle={lifecycle}
            results={
              <Scoreboard
                scores={scores}
                currentUserId={userId}
                winnerId={computeWinner(scores)}
              />
            }
          >
            {userId && (
              <GameComponent
                key={`${lifecycle.plan.matchId ?? 'nomatch'}:${lifecycle.plan.gameKey}`}
                userId={userId}
                matchId={matchId}
                elapsedMs={lifecycle.elapsedMs}
                remainingMs={lifecycle.remainingMs}
                durationMs={lifecycle.plan.durationMs}
                playerCount={roster.length}
                playerIds={playerIds}
                scores={scores.map((entry) => ({
                  playerId: entry.player_id,
                  username: entry.profile?.username ?? null,
                  avatar: entry.profile?.avatar ?? null,
                  score: entry.score,
                }))}
                reportScore={handleReportScore}
              />
            )}
            <div className="mx-auto mt-4 w-full max-w-sm">
              <Scoreboard scores={scores} currentUserId={userId} />
            </div>
          </GameStage>
          {isHost && lifecycle.phase === 'results' && (
            <button
              type="button"
              onClick={handleEnd}
              className="cursor-pointer self-end rounded-full border-[3px] border-arcade-ink bg-arcade-panel px-4 py-2 text-sm font-bold text-arcade-ink shadow-pop-sm transition-all hover:-translate-y-0.5 hover:bg-arcade-sun hover:shadow-pop"
            >
              Finish & back to lobby
            </button>
          )}
        </div>
      )}

      {history.length > 0 && room.status !== 'playing' && (
        <div>
          <h2 className="mb-3 font-display text-base uppercase tracking-wide">Recent matches</h2>
          <ul className="flex flex-col gap-2.5">
            {history.map((match) => {
              const iWon = userId != null && match.winner_id === userId;
              return (
                <li
                  key={match.id}
                  className="slab flex items-center gap-3 px-4 py-2.5 text-sm shadow-pop-sm"
                >
                  <GameIcon
                    gameKey={match.game_key}
                    size={18}
                    className="shrink-0 text-arcade-neon"
                  />
                  <span className="flex-1 font-medium text-stone-700">
                    {getGame(match.game_key)?.title ?? match.game_key}
                    {match.ended_at == null && (
                      <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                        in progress
                      </span>
                    )}
                  </span>
                  {iWon ? (
                    <span className="sticker bg-arcade-sun px-2 py-0.5 text-[11px] normal-case text-arcade-ink">
                      you won
                    </span>
                  ) : match.winner_id != null ? (
                    <span className="text-xs font-medium text-stone-500">decided</span>
                  ) : (
                    <span className="text-xs font-medium text-stone-500">draw / unfinished</span>
                  )}
                  <time className="font-mono text-xs tabular-nums text-stone-500">
                    {new Date(match.started_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base uppercase tracking-wide">
            Players ({roster.length}/{room.max_players})
          </h2>
          <button
            type="button"
            onClick={() => void toggleReady()}
            className={`cursor-pointer rounded-full border-[3px] border-arcade-ink px-4 py-1.5 text-sm font-bold transition-all ${
              me?.is_ready
                ? 'bg-arcade-sea text-arcade-ink shadow-pop-sm hover:-translate-y-0.5'
                : 'bg-arcade-accent text-arcade-ink shadow-pop-sm hover:-translate-y-0.5 hover:shadow-pop'
            }`}
          >
            {me?.is_ready ? 'Ready ✓' : 'Mark ready'}
          </button>
        </div>

        <ul className="flex flex-col gap-3">
          {roster.map((entry) => {
            const avatar = getAvatar(entry.profile?.avatar);
            const connected = onlineIds.has(entry.player_id);
            const isEntryHost = entry.player_id === room.host_id;
            return (
              <li key={entry.player_id} className="slab flex items-center gap-3 px-4 py-2.5 shadow-pop-sm">
                <span className="text-2xl" aria-hidden>
                  {avatar.emoji}
                </span>
                <span className="flex-1 font-semibold">
                  {entry.profile?.username ?? 'player'}
                  {isEntryHost && (
                    <span className="sticker ml-2 bg-arcade-pop px-2 py-0.5 text-[10px] text-arcade-ink">
                      host
                    </span>
                  )}
                  {entry.player_id === userId && (
                    <span className="ml-1 text-xs font-medium text-stone-500">(you)</span>
                  )}
                </span>
                <span
                  className={`inline-block h-3 w-3 rounded-full border-2 border-arcade-ink ${
                    connected ? 'bg-arcade-neon' : 'bg-stone-400'
                  }`}
                  title={connected ? 'Connected' : 'Offline'}
                  aria-label={connected ? 'Connected' : 'Offline'}
                />
                <span
                  className={`text-xs font-bold uppercase tracking-wide ${
                    entry.is_ready ? 'text-arcade-neon' : 'text-stone-500'
                  }`}
                >
                  {entry.is_ready ? 'ready' : 'waiting'}
                </span>
                {isHost && !isEntryHost && (
                  <button
                    type="button"
                    onClick={() => void handleKick(entry.player_id)}
                    className="rounded-lg border-2 border-[#c2402f] px-2 py-0.5 text-xs font-bold text-[#c2402f] transition-colors hover:bg-[#ffe3df]"
                  >
                    Kick
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {isHost && (
        <div className="slab rotate-[0.5deg] p-5 pt-6 shadow-pop">
          <h3 className="font-display text-xs uppercase tracking-wide">Host controls</h3>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <span className="text-stone-600">Max players</span>
              <select
                value={room.max_players}
                onChange={(e) => void handleCapacity(Number(e.target.value))}
                className="field cursor-pointer px-2 py-1.5 font-semibold text-arcade-ink"
              >
                {[2, 4, 6, 8, 12, 16].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleStart}
              disabled={!everyoneReady || room.status === 'playing'}
              className="cursor-pointer rounded-full border-[3px] border-arcade-ink bg-arcade-accent px-4 py-2 text-sm font-bold text-arcade-ink shadow-pop-sm transition-all hover:-translate-y-0.5 hover:shadow-pop disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
              title={everyoneReady ? 'Start the game' : 'All players must be ready (min 2)'}
            >
              Start game
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
