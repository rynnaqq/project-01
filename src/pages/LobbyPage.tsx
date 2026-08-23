import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { createRoom, joinRoom } from '../lib/rooms';
import { friendlyMessage } from '../lib/errors';
import { normalizeRoomCode } from '../lib/roomCode';
import { getGame } from '../lib/games';
import {
  GameIcon,
  PlayIcon,
  UsersIcon,
  ZapIcon,
} from '../components/icons';
import { gameTileGradient } from '../lib/gameArt';

/** Lobby: create a new room or join an existing one by code. */
export default function LobbyPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedGameKey = searchParams.get('game');
  const selectedGame = selectedGameKey ? getGame(selectedGameKey) : undefined;

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);

  async function handleCreate() {
    if (!session) return;
    setBusy('create');
    setError(null);
    const result = await createRoom(session.user.id, selectedGame?.key ?? null);
    setBusy(null);
    if (!result.ok) {
      setError(friendlyMessage(result.error));
      return;
    }
    navigate(`/room/${result.room.code}`);
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setBusy('join');
    setError(null);
    const result = await joinRoom(session.user.id, code);
    setBusy(null);
    if (!result.ok) {
      setError(friendlyMessage(result.error));
      return;
    }
    navigate(`/room/${result.room.code}`);
  }

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl uppercase tracking-tight sm:text-3xl">Lobby</h1>
        <p className="mt-1 text-slate-400">Create a room or join with a code.</p>
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 backdrop-blur-md"
        >
          <ZapIcon size={15} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {selectedGame && (
        <div className="glass-chip flex items-center gap-3 rounded-xl px-4 py-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${gameTileGradient(
              selectedGame.key,
            )} text-white`}
          >
            <GameIcon gameKey={selectedGame.key} size={18} />
          </span>
          <p className="text-sm text-slate-300">
            Pre-selected game: <span className="font-semibold text-arcade-neon">{selectedGame.title}</span>
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="glass sheen relative overflow-hidden rounded-2xl p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-arcade-neon/20 blur-2xl"
          />
          <span className="glass-chip flex h-10 w-10 items-center justify-center rounded-xl text-arcade-neon">
            <UsersIcon size={20} />
          </span>
          <h2 className="mt-4 font-display text-base tracking-tight">Create a room</h2>
          <p className="mt-1 text-sm text-slate-400">
            {selectedGame ? "You'll host this game." : "You'll be the host."}
          </p>
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy !== null}
            className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-arcade-primary px-4 py-2.5 font-bold text-arcade-ink shadow-underglow-mint transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            <PlayIcon size={16} />
            {busy === 'create' ? 'Creating…' : 'Create room'}
          </button>
        </div>

        <div className="glass sheen relative overflow-hidden rounded-2xl p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-arcade-accent/15 blur-2xl"
          />
          <span className="glass-chip flex h-10 w-10 items-center justify-center rounded-xl text-arcade-gold">
            <ZapIcon size={20} />
          </span>
          <h2 className="mt-4 font-display text-base tracking-tight">Join a room</h2>
          <p className="mt-1 text-sm text-slate-400">Enter the 6-character room code.</p>
          <form onSubmit={handleJoin} className="mt-5 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
              maxLength={6}
              placeholder="ABC234"
              aria-label="Room code"
              className="field w-full min-w-0 flex-1 px-3 py-2.5 text-center font-mono text-lg uppercase tracking-[0.35em] text-white"
            />
            <button
              type="submit"
              disabled={busy !== null || code.length !== 6}
              className="glass-chip shrink-0 cursor-pointer rounded-xl px-5 font-semibold text-slate-200 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'join' ? 'Joining…' : 'Join'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
