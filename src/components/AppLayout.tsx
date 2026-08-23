import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import AudioControls from './AudioControls';
import { ZigzagBand } from './decor';
import { GamepadIcon, LogOutIcon, WifiOffIcon } from './icons';

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/games', label: 'Games' },
  { to: '/lobby', label: 'Lobby' },
  { to: '/profile', label: 'Profile' },
];

/**
 * Shared application shell: an inked navigation slab + routed content outlet.
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
        className="sticker sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-arcade-sun focus:px-4 focus:py-2 focus:text-sm focus:text-arcade-ink"
      >
        Skip to content
      </a>
      <header className="sticky top-3 z-40 px-3 sm:px-4">
        <nav className="slab mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 rounded-2xl px-3 py-2.5 shadow-pop sm:px-4">
          <Link to="/" className="group flex items-center gap-2.5">
            <span className="flex h-10 w-10 -rotate-6 items-center justify-center rounded-xl border-[3px] border-arcade-ink bg-arcade-pop text-arcade-ink transition-transform duration-200 group-hover:rotate-6 group-hover:scale-105">
              <GamepadIcon size={20} />
            </span>
            <span className="font-display text-xs uppercase tracking-wide text-arcade-ink sm:text-base">
              Arcade<span className="text-arcade-accent">Hub</span>
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <AudioControls />
            <ul className="flex gap-1.5 text-sm">
              {NAV.map((item) => {
                const active =
                  item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      className={`block rounded-full border-2 px-3 py-1 font-semibold transition-all ${
                        active
                          ? 'border-arcade-ink bg-arcade-sun text-arcade-ink shadow-pop-sm'
                          : 'border-transparent text-stone-600 hover:border-arcade-ink hover:bg-arcade-muted hover:text-arcade-ink'
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
                <span className="hidden font-medium text-stone-600 sm:inline">
                  {profile?.username ?? 'player'}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border-2 border-arcade-ink bg-arcade-panel px-3 py-1 font-semibold text-arcade-ink transition-all hover:bg-arcade-sea hover:shadow-pop-sm"
                >
                  <LogOutIcon size={14} />
                  <span className="sr-only sm:not-sr-only">Log out</span>
                </button>
              </div>
            ) : (
              <Link
                to="/auth"
                className="rounded-full border-[3px] border-arcade-ink bg-arcade-accent px-4 py-1.5 text-sm font-bold text-arcade-ink shadow-pop-sm transition-all hover:-translate-y-0.5 hover:shadow-pop active:translate-y-0 active:shadow-none"
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
          className="mt-3 mx-3 flex items-center justify-center gap-2 rounded-xl border-[3px] border-arcade-ink bg-[#ffe3df] px-4 py-2 text-center text-sm font-medium text-[#7c2d24] shadow-pop-sm sm:mx-4"
        >
          <WifiOffIcon size={16} aria-hidden />
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
      <footer className="relative mt-8">
        <ZigzagBand className="h-4 w-full text-arcade-ink" />
        <p className="mx-auto max-w-6xl px-4 pt-4 pb-6 text-xs font-bold uppercase tracking-[0.25em] text-stone-500">
          Interactive Arcade Hub · real-time multiplayer mini-games
        </p>
      </footer>
    </div>
  );
}
