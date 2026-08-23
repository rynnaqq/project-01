import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import AudioControls from './AudioControls';
import { GamepadIcon, LogOutIcon, WifiOffIcon } from './icons';

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/games', label: 'Games' },
  { to: '/lobby', label: 'Lobby' },
  { to: '/profile', label: 'Profile' },
];

/**
 * Shared application shell: a floating glass navigation slab + routed content.
 * Feature content is rendered by child routes via <Outlet />.
 */
export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const { session, profile, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-arcade-accent focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <header className="sticky top-3 z-40 px-3 sm:px-4">
        <nav className="glass-deep mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 rounded-2xl px-3 py-2.5 sm:px-4">
          <Link to="/" className="group flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-arcade-neon to-arcade-primary text-[#04241a] shadow-underglow-cyan transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
              <GamepadIcon size={20} />
            </span>
            <span className="font-display text-sm font-semibold uppercase tracking-widest text-white sm:text-base">
              Arcade
              <span className="bg-gradient-to-r from-arcade-neon via-arcade-primary to-arcade-accent bg-clip-text text-transparent">
                Hub
              </span>
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <AudioControls />
            <ul className="flex gap-1 text-sm">
              {NAV.map((item) => {
                const active =
                  item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      className={`relative block rounded-full px-3 py-1.5 transition-all duration-200 ${
                        active
                          ? 'bg-white/10 text-white shadow-glass-sm'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {item.label}
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-1/2 top-1.5 h-1 w-1 -translate-x-1/2 rounded-full bg-arcade-primary shadow-underglow-mint"
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {session ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="hidden text-slate-400 sm:inline">{profile?.username ?? 'player'}</span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="glass-chip flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-slate-300 transition-colors hover:text-white"
                >
                  <LogOutIcon size={14} />
                  <span className="sr-only sm:not-sr-only">Log out</span>
                </button>
              </div>
            ) : (
              <Link
                to="/auth"
                className="rounded-full bg-arcade-primary px-4 py-1.5 text-sm font-bold text-arcade-ink shadow-underglow-mint transition-all hover:brightness-110"
              >
                Log in
              </Link>
            )}
          </div>
        </nav>
      </header>
      {!online && (
        <p
          role="alert"
          className="mt-3 mx-3 flex items-center justify-center gap-2 rounded-xl border border-amber-300/25 bg-amber-400/10 px-4 py-2 text-center text-sm text-amber-200 backdrop-blur-md sm:mx-4"
        >
          <WifiOffIcon size={16} />
          You're offline — actions will fail until the connection returns. Mid-game reloads resync
          automatically.
        </p>
      )}
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-8 outline-none sm:pt-12"
      >
        <Outlet />
      </main>
      <footer className="border-t border-white/5 py-6">
        <p className="mx-auto max-w-6xl px-4 text-xs uppercase tracking-[0.25em] text-slate-600">
          Interactive Arcade Hub · real-time multiplayer mini-games
        </p>
      </footer>
    </div>
  );
}
