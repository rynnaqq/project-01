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
 * Shared application shell: sticky top navigation + routed content outlet.
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
      <header className="sticky top-0 z-40 border-b border-arcade-line/40 bg-arcade-bg/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-4 py-3">
          <Link to="/" className="group flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-arcade-primary to-arcade-neon text-white shadow-glow-sm transition-shadow group-hover:shadow-glow">
              <GamepadIcon size={20} />
            </span>
            <span className="font-display text-lg uppercase tracking-wider text-white">
              Arcade<span className="text-arcade-neon">Hub</span>
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
                      className={`relative rounded-md px-3 py-1.5 transition-colors ${
                        active
                          ? 'bg-arcade-primary/15 text-arcade-neon'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {item.label}
                      {active && (
                        <span
                          aria-hidden
                          className="absolute inset-x-3 -bottom-[13px] h-px bg-gradient-to-r from-transparent via-arcade-neon to-transparent"
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {session ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="hidden text-gray-400 sm:inline">{profile?.username ?? 'player'}</span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-gray-300 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white"
                >
                  <LogOutIcon size={14} />
                  <span className="sr-only sm:not-sr-only">Log out</span>
                </button>
              </div>
            ) : (
              <Link
                to="/auth"
                className="rounded-md bg-arcade-accent px-4 py-1.5 text-sm font-semibold text-white shadow-glow-rose transition-all hover:brightness-110"
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
          className="flex items-center justify-center gap-2 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-300"
        >
          <WifiOffIcon size={16} />
          You're offline — actions will fail until the connection returns. Mid-game reloads resync
          automatically.
        </p>
      )}
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 outline-none"
      >
        <Outlet />
      </main>
      <footer className="border-t border-arcade-line/30 py-6">
        <p className="mx-auto max-w-6xl px-4 text-xs uppercase tracking-widest text-gray-600">
          Interactive Arcade Hub · real-time multiplayer mini-games
        </p>
      </footer>
    </div>
  );
}
