import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { getAvatar } from '../lib/avatars';
import { friendlyMessage } from '../lib/errors';
import { getGame } from '../lib/games';
import { getGameComponent, getGameDuration } from '../games/registry';

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

  if (loading) return <p className="text-gray-400">Loading room…</p>;

  if (error) {
    return (
      <section>
        <h1 className="text-2xl font-bold">Room</h1>
        <p role="alert" className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {friendlyMessage(error)}
        </p>
        <button
          type="button"
          onClick={() => navigate('/lobby')}
          className="mt-4 rounded-md border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
        >
          Back to lobby
        </button>
      </section>
    );
  }

  if (!room) return <p className="text-gray-400">Room not found.</p>;

  const isHost = userId === room.host_id;
  const me = roster.find((r) => r.player_id === userId);
  const everyoneReady = roster.length >= 2 && roster.every((r) => r.is_ready);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Room</h1>
          <p className="mt-1 text-sm text-gray-400">
            Share this code:{' '}
            <span className="font-mono text-xl tracking-widest text-arcade-neon">{room.code}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-arcade-panel px-3 py-1 text-xs capitalize text-gray-300">
            {room.status}
          </span>
          <button
            type="button"
            onClick={handleLeave}
            className="rounded-md border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
          >
            Leave
          </button>
        </div>
      </header>


      {room.status === 'playing' && lifecycle.plan && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
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
              className="self-end rounded-md border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
            >
              Finish & back to lobby
            </button>
          )}
        </div>
      )}

      {history.length > 0 && room.status !== 'playing' && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">Recent matches</h2>
          <ul className="flex flex-col gap-1.5">
            {history.map((match) => {
              const iWon = userId != null && match.winner_id === userId;
              return (
                <li
                  key={match.id}
                  className="flex items-center gap-3 rounded-md border border-white/10 bg-arcade-panel px-3 py-1.5 text-sm"
                >
                  <span aria-hidden>{getGame(match.game_key)?.emoji ?? '🎮'}</span>
                  <span className="flex-1 text-gray-300">
                    {getGame(match.game_key)?.title ?? match.game_key}
                    {match.ended_at == null && (
                      <span className="ml-2 text-xs text-gray-500">in progress</span>
                    )}
                  </span>
                  {iWon ? (
                    <span className="text-xs font-medium text-arcade-neon">you won</span>
                  ) : match.winner_id != null ? (
                    <span className="text-xs text-gray-400">decided</span>
                  ) : (
                    <span className="text-xs text-gray-500">draw / unfinished</span>
                  )}
                  <time className="font-mono text-xs tabular-nums text-gray-500">
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
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Players ({roster.length}/{room.max_players})
          </h2>
          <button
            type="button"
            onClick={() => void toggleReady()}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              me?.is_ready
                ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                : 'bg-arcade-accent text-white hover:bg-arcade-accent/80'
            }`}
          >
            {me?.is_ready ? 'Ready ✓' : 'Mark ready'}
          </button>
        </div>

        <ul className="flex flex-col gap-2">
          {roster.map((entry) => {
            const avatar = getAvatar(entry.profile?.avatar);
            const connected = onlineIds.has(entry.player_id);
            const isEntryHost = entry.player_id === room.host_id;
            return (
              <li
                key={entry.player_id}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-arcade-panel px-4 py-2"
              >
                <span className="text-2xl" aria-hidden>
                  {avatar.emoji}
                </span>
                <span className="flex-1 font-medium">
                  {entry.profile?.username ?? 'player'}
                  {isEntryHost && (
                    <span className="ml-2 rounded bg-arcade-accent/20 px-1.5 py-0.5 text-xs text-arcade-neon">
                      host
                    </span>
                  )}
                  {entry.player_id === userId && (
                    <span className="ml-1 text-xs text-gray-500">(you)</span>
                  )}
                </span>
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    connected ? 'bg-green-400' : 'bg-gray-600'
                  }`}
                  title={connected ? 'Connected' : 'Offline'}
                  aria-label={connected ? 'Connected' : 'Offline'}
                />
                <span className={`text-xs ${entry.is_ready ? 'text-green-400' : 'text-gray-500'}`}>
                  {entry.is_ready ? 'ready' : 'waiting'}
                </span>
                {isHost && !isEntryHost && (
                  <button
                    type="button"
                    onClick={() => void handleKick(entry.player_id)}
                    className="rounded border border-red-500/30 px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/10"
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
        <div className="rounded-lg border border-white/10 bg-arcade-panel p-4">
          <h3 className="text-sm font-semibold text-gray-300">Host controls</h3>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">Max players</span>
              <select
                value={room.max_players}
                onChange={(e) => void handleCapacity(Number(e.target.value))}
                className="rounded-md border border-white/10 bg-arcade-bg px-2 py-1"
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
              className="rounded-md bg-arcade-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-arcade-accent/80 disabled:opacity-50"
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
