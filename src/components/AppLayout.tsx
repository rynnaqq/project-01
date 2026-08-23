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

  /** One nav entry; active state derived from the current path. */
  function NavTab({ item, layout }: { item: (typeof NAV)[number]; layout: 'pill' | 'cell' }) {
    const active =
      item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
    return (
      <Link
        to={item.to}
        aria-current={active ? 'page' : undefined}
        className={
          layout === 'pill'
            ? `block rounded-full border-2 px-3 py-1 font-semibold transition-all ${
                active
                  ? 'border-arcade-ink bg-arcade-sun text-arcade-ink shadow-pop-sm'
                  : 'border-transparent text-stone-600 hover:border-arcade-ink hover:bg-arcade-muted hover:text-arcade-ink'
              }`
            : `block rounded-xl border-2 px-2 py-2 text-center font-semibold transition-all ${
                active
                  ? 'border-arcade-ink bg-arcade-sun text-arcade-ink shadow-pop-sm'
                  : 'border-transparent bg-arcade-muted/60 text-stone-600 hover:bg-arcade-muted hover:text-arcade-ink'
              }`
        }
      >
        {item.label}
      </Link>
    );
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
        <nav className="slab mx-auto max-w-6xl rounded-2xl p-3 shadow-pop sm:px-4">
          {/* Row 1: identity · nav (desktop) · actions */}
          <div className="flex items-center justify-between gap-3">
            <Link to="/" className="group flex shrink-0 items-center gap-2.5">
              <span className="flex h-10 w-10 -rotate-6 items-center justify-center rounded-xl border-[3px] border-arcade-ink bg-arcade-pop text-arcade-ink transition-transform duration-200 group-hover:rotate-6 group-hover:scale-105">
                <GamepadIcon size={20} aria-hidden />
              </span>
              <span className="font-display text-xs uppercase tracking-wide text-arcade-ink sm:text-base">
                Arcade<span className="text-arcade-accent">Hub</span>
              </span>
            </Link>

            <ul className="hidden items-center gap-1.5 text-sm md:flex">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavTab item={item} layout="pill" />
                </li>
              ))}
            </ul>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <AudioControls />
              {session ? (
                <>
                  <span className="hidden max-w-28 truncate font-medium text-stone-600 lg:inline">
                    {profile?.username ?? 'player'}
                  </span>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full border-2 border-arcade-ink bg-arcade-panel px-3 py-1.5 font-semibold text-arcade-ink transition-all hover:bg-arcade-sea hover:shadow-pop-sm"
                  >
                    <LogOutIcon size={14} aria-hidden />
                    <span className="sr-only sm:not-sr-only">Log out</span>
                  </button>
                </>
              ) : (
                <Link
                  to="/auth"
                  className="rounded-full border-[3px] border-arcade-ink bg-arcade-accent px-4 py-1.5 text-sm font-bold text-arcade-ink shadow-pop-sm transition-all hover:-translate-y-0.5 hover:shadow-pop active:translate-y-0 active:shadow-none"
                >
                  Log in
                </Link>
              )}
            </div>
          </div>

          {/* Row 2 (mobile only): equal-width tab cells — cannot overflow. */}
          <ul className="mt-3 grid grid-cols-4 gap-1.5 border-t-[3px] border-dashed border-stone-300 pt-3 text-sm md:hidden">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavTab item={item} layout="cell" />
              </li>
            ))}
          </ul>
        </nav>
      </header>
      {!online && (
        <p
          role="alert"
          className="mt-3 mx-3 flex items-center justify-center gap-2 rounded-xl border-[3px] border-arcade-ink bg-[#ffe3df] px-4 py-2 text-center text-sm font-medium text-[#7c2d24] shadow-pop-sm sm:mx-4"
        >
          <WifiOffIcon size={16} aria-hidden />
          You're offline. Actions will fail until the connection returns. Mid-game reloads resync
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
          Arcade Hub
        </p>
      </footer>
    </div>
  );
}
