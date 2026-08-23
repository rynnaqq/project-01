import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { createRoom, joinRoom } from '../lib/rooms';
import { friendlyMessage } from '../lib/errors';
import { normalizeRoomCode } from '../lib/roomCode';
import { getGame } from '../lib/games';

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
    <section className="mx-auto flex max-w-md flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Lobby</h1>
        <p className="mt-1 text-gray-400">Create a room or join with a code.</p>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="rounded-lg border border-white/10 bg-arcade-panel p-5">
        <h2 className="text-lg font-semibold">Create a room</h2>
        <p className="mt-1 text-sm text-gray-400">
          {selectedGame ? (
            <>
              Game: <span className="text-arcade-neon">{selectedGame.title}</span>. You'll be the
              host.
            </>
          ) : (
            "You'll be the host."
          )}
        </p>
        <button
          type="button"
          onClick={handleCreate}
          disabled={busy !== null}
          className="mt-4 w-full rounded-md bg-arcade-accent px-4 py-2 font-medium text-white transition hover:bg-arcade-accent/80 disabled:opacity-50"
        >
          {busy === 'create' ? 'Creating…' : 'Create room'}
        </button>
      </div>

      <div className="rounded-lg border border-white/10 bg-arcade-panel p-5">
        <h2 className="text-lg font-semibold">Join a room</h2>
        <form onSubmit={handleJoin} className="mt-4 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
            maxLength={6}
            placeholder="ABC234"
            aria-label="Room code"
            className="flex-1 rounded-md border border-white/10 bg-arcade-bg px-3 py-2 font-mono uppercase tracking-widest outline-none focus:border-arcade-accent"
          />
          <button
            type="submit"
            disabled={busy !== null || code.length !== 6}
            className="rounded-md border border-white/10 px-4 py-2 font-medium text-gray-200 transition hover:bg-white/5 disabled:opacity-50"
          >
            {busy === 'join' ? 'Joining…' : 'Join'}
          </button>
        </form>
      </div>
    </section>
  );
}
