import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { validatePassword, validateUsername } from '../lib/authHelpers';
import { friendlyMessage } from '../lib/errors';

type Mode = 'login' | 'register';

/** Login / registration page (username + password). */
export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const u = validateUsername(username);
    if (!u.valid) return setError(u.reason);
    const p = validatePassword(password);
    if (!p.valid) return setError(p.reason);

    setBusy(true);
    const result = mode === 'login' ? await signIn(username, password) : await signUp(username, password);
    setBusy(false);

    if (!result.ok) {
      setError(friendlyMessage(result.error));
      return;
    }
    navigate('/lobby');
  }

  return (
    <section className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold">{mode === 'login' ? 'Log in' : 'Create account'}</h1>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-300">Username</span>
          <input
            className="rounded-md border border-white/10 bg-arcade-panel px-3 py-2 outline-none focus:border-arcade-accent"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-300">Password</span>
          <input
            type="password"
            className="rounded-md border border-white/10 bg-arcade-panel px-3 py-2 outline-none focus:border-arcade-accent"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
          />
        </label>

        {error && (
          <p role="alert" className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-arcade-accent px-4 py-2 font-medium text-white transition hover:bg-arcade-accent/80 disabled:opacity-50"
        >
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
      </form>

      <button
        type="button"
        className="mt-4 text-sm text-arcade-neon underline"
        onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login');
          setError(null);
        }}
      >
        {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
      </button>
    </section>
  );
}
