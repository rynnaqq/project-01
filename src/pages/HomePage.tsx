import { Link } from 'react-router-dom';
import ParticleGrid from '../components/ParticleGrid';
import TiltCard from '../components/TiltCard';
import { useAuth } from '../context/AuthProvider';
import { GAMES } from '../lib/games';
import { ArrowRightIcon, GameIcon, TrophyIcon, UsersIcon, ZapIcon } from '../components/icons';
import { gameTileGradient } from '../lib/gameArt';

/** Landing page: a glass vitrine with the prism spectrum playing behind it. */
export default function HomePage() {
  const { session } = useAuth();

  return (
    <div className="flex flex-col gap-16">
      {/* Hero — the display case */}
      <section className="glass-static sheen relative overflow-hidden rounded-[2rem]">
        <div aria-hidden className="dot-matrix absolute inset-0 opacity-60" />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-28 -top-28 h-80 w-80 rounded-full bg-arcade-neon/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-36 right-[-4rem] h-96 w-96 rounded-full bg-arcade-accent/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-arcade-primary/10 blur-3xl"
        />
        <div className="pointer-events-none absolute inset-0">
          <ParticleGrid />
        </div>
        <div className="relative flex flex-col items-center gap-6 px-6 py-20 text-center sm:py-28">
          <p className="glass-chip inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-arcade-neon">
            <ZapIcon size={13} />
            Real-time multiplayer
          </p>
          <h1 className="text-spectrum max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Interactive Arcade Hub
          </h1>
          <p className="max-w-xl text-slate-300">
            Real-time multiplayer mini-games behind frosted glass. Create a room, invite friends,
            and battle for the top of the leaderboard.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to={session ? '/lobby' : '/auth'}
              className="rounded-full bg-arcade-primary px-7 py-3 font-bold text-arcade-ink shadow-underglow-mint transition-all hover:scale-[1.03] hover:brightness-110"
            >
              {session ? 'Enter the lobby' : 'Get started'}
            </Link>
            <Link
              to="/games"
              className="glass-chip rounded-full px-7 py-3 font-semibold text-slate-200 transition-colors hover:text-white"
            >
              Browse games
            </Link>
          </div>
          <dl className="glass-chip mt-4 grid w-full max-w-md grid-cols-3 divide-x divide-white/10 rounded-2xl py-3">
            {[
              { term: 'Games', value: '3' },
              { term: 'Modes', value: 'Solo · 1v1 · Party' },
              { term: 'Scores', value: 'Live' },
            ].map((stat) => (
              <div key={stat.term} className="flex flex-col px-2">
                <dt className="order-2 text-[11px] uppercase tracking-widest text-slate-500">
                  {stat.term}
                </dt>
                <dd className="order-1 font-display text-xs text-arcade-gold sm:text-sm">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Featured games */}
      <section className="flex flex-col gap-5">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-xl uppercase tracking-tight sm:text-2xl">
              Pick your battle
            </h2>
            <p className="mt-1 text-sm text-slate-400">Three arenas, one leaderboard.</p>
          </div>
          <Link
            to="/games"
            className="group hidden items-center gap-1.5 text-sm font-semibold text-arcade-neon transition-colors hover:text-white sm:inline-flex"
          >
            All games
            <ArrowRightIcon size={15} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {GAMES.map((game) => (
            <TiltCard key={game.key} className="rounded-2xl">
              <article className="glass sheen flex h-full flex-col rounded-2xl p-6 transition-transform duration-200 hover:-translate-y-1">
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gameTileGradient(
                    game.key,
                  )} text-white shadow-glass-sm`}
                >
                  <GameIcon gameKey={game.key} size={24} />
                </span>
                <h3 className="mt-4 font-display text-base tracking-tight">{game.title}</h3>
                <p className="mt-1 flex-1 text-sm text-slate-400">{game.tagline}</p>
                <Link
                  to={`/lobby?game=${game.key}`}
                  className="group mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-arcade-primary transition-colors hover:text-white"
                >
                  Play now
                  <ArrowRightIcon size={15} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </article>
            </TiltCard>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="flex flex-col gap-5">
        <h2 className="font-display text-xl uppercase tracking-tight sm:text-2xl">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {[
            {
              step: '01',
              title: 'Create or join',
              desc: 'Spin up a room and share the 6-character code with your rivals.',
            },
            {
              step: '02',
              title: 'Ready up',
              desc: 'Everyone marks ready in the live roster — presence synced instantly.',
            },
            {
              step: '03',
              title: 'Battle & win',
              desc: 'Scores stream to a shared scoreboard; history is saved per room.',
            },
          ].map((item) => (
            <li key={item.step} className="glass-chip rounded-2xl p-6">
              <span className="font-display text-2xl text-transparent [background:linear-gradient(120deg,var(--spectrum-cyan),var(--spectrum-rose))] [-webkit-background-clip:text] [background-clip:text]">
                {item.step}
              </span>
              <h3 className="mt-3 font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-slate-400">{item.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA band */}
      <section className="glass-static relative overflow-hidden rounded-[2rem] p-10 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-44 w-[120%] -translate-x-1/2 rounded-full bg-gradient-to-r from-arcade-neon/25 via-arcade-primary/20 to-arcade-accent/25 blur-3xl"
        />
        <div className="relative flex flex-col items-center gap-5">
          <TrophyIcon size={36} className="animate-pulse-glow text-arcade-gold drop-shadow-[0_0_18px_rgba(255,200,87,0.45)]" />
          <h2 className="font-display text-xl uppercase tracking-tight sm:text-2xl">
            Ready for the leaderboard?
          </h2>
          <p className="max-w-md text-slate-300">
            Spin up a room in seconds — no installs, just a link and a code.
          </p>
          <Link
            to={session ? '/lobby' : '/auth'}
            className="flex items-center gap-2 rounded-full bg-arcade-primary px-7 py-3 font-bold text-arcade-ink shadow-underglow-mint transition-all hover:scale-[1.03] hover:brightness-110"
          >
            <UsersIcon size={17} />
            {session ? 'Enter the lobby' : 'Create free account'}
          </Link>
        </div>
      </section>
    </div>
  );
}
