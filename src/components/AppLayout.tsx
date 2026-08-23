import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import AudioControls from './AudioControls';

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/games', label: 'Games' },
  { to: '/lobby', label: 'Lobby' },
  { to: '/profile', label: 'Profile' },
];

/**
 * Shared application shell: top navigation + routed content outlet.
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
      <header className="border-b border-white/10 bg-arcade-panel/60 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-y-2 px-4 py-3">
          <Link
            to="/"
            className="bg-gradient-to-r from-arcade-accent to-arcade-neon bg-clip-text text-lg font-bold text-transparent"
          >
            Arcade Hub
          </Link>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <AudioControls />
            <ul className="flex gap-1 text-sm">
              {NAV.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={`rounded-md px-3 py-1.5 transition-colors ${
                        active
                          ? 'bg-arcade-accent/20 text-arcade-neon'
                          : 'text-gray-300 hover:bg-white/5'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {session ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">{profile?.username ?? 'player'}</span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-md border border-white/10 px-3 py-1.5 text-gray-300 hover:bg-white/5"
                >
                  Log out
                </button>
              </div>
            ) : (
              <Link
                to="/auth"
                className="rounded-md bg-arcade-accent px-3 py-1.5 text-sm text-white hover:bg-arcade-accent/80"
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
          className="bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-300"
        >
          You're offline — actions will fail until the connection returns. Mid-game reloads
          resync automatically.
        </p>
      )}
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 outline-none"
      >
        <Outlet />
      </main>
    </div>
  );
}
