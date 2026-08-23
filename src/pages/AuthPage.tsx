import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { validatePassword, validateUsername } from '../lib/authHelpers';
import { friendlyMessage } from '../lib/errors';
import { PlusMark, Sparkle, Squiggle } from '../components/decor';
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
    <section className="relative mx-auto w-full max-w-sm pt-6">
      <Sparkle className="pointer-events-none absolute -left-10 top-0 h-9 w-9 animate-spin-slow text-arcade-accent" />
      <Squiggle className="pointer-events-none absolute -right-12 bottom-16 hidden h-7 w-24 text-arcade-peri sm:block" />
      <PlusMark className="pointer-events-none absolute -top-4 right-2 h-6 w-6 rotate-12 text-arcade-neon" />
      <div className="slab relative rotate-[-1deg] p-8 shadow-pop-lg">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 -rotate-6 items-center justify-center rounded-2xl border-[3px] border-arcade-ink bg-arcade-pop text-arcade-ink shadow-pop">
            <GamepadIcon size={26} aria-hidden />
          </span>
          <h1 className="font-display text-base uppercase tracking-wide">
            {mode === 'login' ? 'Welcome back' : 'Join the arcade'}
          </h1>
          <p className="-mt-1 text-sm font-medium text-stone-600">
            {mode === 'login'
              ? 'Log in to enter your rooms.'
              : 'Create an account to host matches.'}
          </p>
        </div>

        <div
          role="group"
          aria-label="Authentication mode"
          className="mt-6 grid grid-cols-2 gap-1 rounded-full border-[3px] border-arcade-ink bg-arcade-muted p-1"
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
              className={`cursor-pointer rounded-full py-1.5 text-sm font-bold transition-all ${
                mode === value
                  ? 'bg-arcade-sun text-arcade-ink shadow-pop-sm'
                  : 'text-stone-500 hover:text-arcade-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-stone-500">
              Username
            </span>
            <input
              className="field px-3 py-2.5 font-semibold text-arcade-ink"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="pixel-player"
              required
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-stone-500">
              Password
            </span>
            <input
              type="password"
              className="field px-3 py-2.5 font-semibold text-arcade-ink"
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
              className="flex items-start gap-2 rounded-xl border-[3px] border-arcade-ink bg-[#ffe3df] px-3 py-2.5 text-sm font-semibold text-[#7c2d24]"
            >
              <ZapIcon size={15} className="mt-0.5 shrink-0" aria-hidden />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-full border-[3px] border-arcade-ink bg-arcade-accent px-4 py-2.5 font-bold text-arcade-ink shadow-pop transition-all hover:-translate-y-0.5 hover:shadow-pop-lg disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
          >
            {!busy && <UserIcon size={16} aria-hidden />}
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
