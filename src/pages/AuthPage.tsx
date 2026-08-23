import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { validatePassword, validateUsername } from '../lib/authHelpers';
import { friendlyMessage } from '../lib/errors';
import { GamepadIcon, UserIcon, ZapIcon } from '../components/icons';

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
    const result =
      mode === 'login' ? await signIn(username, password) : await signUp(username, password);
    setBusy(false);

    if (!result.ok) {
      setError(friendlyMessage(result.error));
      return;
    }
    navigate('/lobby');
  }

  return (
    <section className="mx-auto w-full max-w-sm">
      <div className="rounded-2xl border border-white/10 bg-arcade-panel/70 p-8 shadow-glow-sm backdrop-blur">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-arcade-primary to-arcade-neon text-white shadow-glow">
            <GamepadIcon size={24} />
          </span>
          <h1 className="font-display text-2xl uppercase tracking-wide">
            {mode === 'login' ? 'Welcome back' : 'Join the arcade'}
          </h1>
          <p className="-mt-1 text-sm text-gray-400">
            {mode === 'login'
              ? 'Log in to enter your rooms.'
              : 'Create an account to host matches.'}
          </p>
        </div>

        <div
          role="group"
          aria-label="Authentication mode"
          className="mt-6 grid grid-cols-2 gap-1 rounded-lg bg-arcade-bg p-1"
        >
          {(
            [
              ['login', 'Log in'],
              ['register', 'Sign up'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value);
                setError(null);
              }}
              className={`cursor-pointer rounded-md py-1.5 text-sm font-semibold transition-colors ${
                mode === value
                  ? 'bg-arcade-primary text-white shadow-glow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium uppercase tracking-widest text-gray-400">
              Username
            </span>
            <input
              className="rounded-lg border border-white/10 bg-arcade-bg px-3 py-2.5 outline-none transition-colors placeholder:text-gray-600 focus:border-arcade-neon"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="pixel-player"
              required
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium uppercase tracking-widest text-gray-400">
              Password
            </span>
            <input
              type="password"
              className="rounded-lg border border-white/10 bg-arcade-bg px-3 py-2.5 outline-none transition-colors placeholder:text-gray-600 focus:border-arcade-neon"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              required
            />
          </label>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-400"
            >
              <ZapIcon size={15} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-arcade-accent px-4 py-2.5 font-semibold text-white shadow-glow-rose transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {!busy && <UserIcon size={16} />}
            {busy ? (
              <span aria-live="polite">Please wait…</span>
            ) : mode === 'login' ? (
              'Log in'
            ) : (
              'Sign up'
            )}
          </button>
        </form>
      </div>
    </section>
  );
}
