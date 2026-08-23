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
        <h1 className="font-display text-2xl uppercase tracking-wide sm:text-4xl">
          <span className="text-pop-shadow">Lobby</span>
        </h1>
        <p className="mt-1.5 font-medium text-stone-600">Create a room or join with a code.</p>
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border-[3px] border-arcade-ink bg-[#ffe3df] px-3 py-2.5 text-sm font-semibold text-[#7c2d24] shadow-pop-sm"
        >
          <ZapIcon size={15} className="mt-0.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {selectedGame && (
        <div className="slab flex rotate-[-0.5deg] items-center gap-3 p-4 shadow-pop-sm">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-[3px] border-arcade-ink bg-gradient-to-br ${gameTileGradient(
              selectedGame.key,
            )} text-white shadow-pop-sm`}
          >
            <GameIcon gameKey={selectedGame.key} size={18} />
          </span>
          <p className="text-sm font-medium text-stone-700">
            Pre-selected game:{' '}
            <span className="font-bold text-arcade-neon">{selectedGame.title}</span>
          </p>
        </div>
      )}

      <div className="grid gap-7 sm:grid-cols-2 lg:gap-8">
        <div className="slab relative -rotate-1 overflow-hidden p-6 pt-7 shadow-pop transition-transform hover:rotate-0">
          <span className="sticker absolute right-4 top-3 bg-arcade-pop px-2.5 py-0.5 text-[11px] text-arcade-ink">
            Host
          </span>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border-[3px] border-arcade-ink bg-arcade-sun text-arcade-ink shadow-pop-sm">
            <UsersIcon size={20} aria-hidden />
          </span>
          <h2 className="mt-4 font-display text-sm uppercase tracking-wide">Create a room</h2>
          <p className="mt-1 text-sm font-medium text-stone-600">
            {selectedGame ? "You'll host this game." : "You'll be the host."}
          </p>
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy !== null}
            className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border-[3px] border-arcade-ink bg-arcade-accent px-4 py-2.5 font-bold text-arcade-ink shadow-pop-sm transition-all hover:-translate-y-0.5 hover:shadow-pop disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
          >
            <PlayIcon size={16} aria-hidden />
            {busy === 'create' ? 'Creating…' : 'Create room'}
          </button>
        </div>

        <div className="slab relative rotate-1 overflow-hidden p-6 pt-7 shadow-pop transition-transform hover:rotate-0">
          <span className="sticker absolute right-4 top-3 bg-arcade-sea px-2.5 py-0.5 text-[11px] text-arcade-ink">
            Guest
          </span>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border-[3px] border-arcade-ink bg-arcade-sea text-arcade-ink shadow-pop-sm">
            <ZapIcon size={20} aria-hidden />
          </span>
          <h2 className="mt-4 font-display text-sm uppercase tracking-wide">Join a room</h2>
          <p className="mt-1 text-sm font-medium text-stone-600">
            Enter the 6-character room code.
          </p>
          <form onSubmit={handleJoin} className="mt-5 flex gap-2.5">
            <input
              value={code}
              onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
              maxLength={6}
              placeholder="ABC234"
              aria-label="Room code"
              className="field w-full min-w-0 flex-1 px-3 py-2.5 text-center font-mono text-lg uppercase tracking-[0.35em] text-arcade-ink"
            />
            <button
              type="submit"
              disabled={busy !== null || code.length !== 6}
              className="shrink-0 cursor-pointer rounded-full border-[3px] border-arcade-ink bg-arcade-panel px-5 font-bold text-arcade-ink shadow-pop-sm transition-all hover:-translate-y-0.5 hover:bg-arcade-sun hover:shadow-pop disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
            >
              {busy === 'join' ? 'Joining…' : 'Join'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
