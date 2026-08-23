import { Link } from 'react-router-dom';
import ParticleGrid from '../components/ParticleGrid';
import TiltCard from '../components/TiltCard';
import { useAuth } from '../context/AuthProvider';
import { GAMES } from '../lib/games';
import { ArrowRightIcon, GameIcon, TrophyIcon, UsersIcon, ZapIcon } from '../components/icons';
import { gameTileGradient } from '../lib/gameArt';

/** Landing page with an animated synthwave hero (P3.1). */
export default function HomePage() {
  const { session } = useAuth();

  return (
    <div className="flex flex-col gap-16">
      {/* Hero */}
      <section className="scanlines relative overflow-hidden rounded-3xl border border-arcade-line/50 bg-arcade-panel/30">
        <div aria-hidden className="retro-grid absolute inset-0 opacity-70" />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-arcade-primary/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-arcade-accent/20 blur-3xl"
        />
        <div className="pointer-events-none absolute inset-0">
          <ParticleGrid />
        </div>
        <div className="relative flex flex-col items-center gap-6 px-6 py-20 text-center sm:py-24">
          <p className="inline-flex items-center gap-2 rounded-full border border-arcade-neon/30 bg-arcade-neon/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-arcade-neon">
            <ZapIcon size={13} />
            Real-time multiplayer
          </p>
          <h1 className="max-w-3xl font-display text-4xl uppercase leading-tight tracking-wide sm:text-6xl">
            <span className="text-glow bg-gradient-to-r from-arcade-soft via-arcade-neon to-arcade-accent bg-clip-text text-transparent">
              Interactive Arcade Hub
            </span>
          </h1>
          <p className="max-w-xl text-gray-300">
            Real-time multiplayer mini-games with smooth animations. Create a room, invite friends,
            and battle for the top of the leaderboard.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to={session ? '/lobby' : '/auth'}
              className="rounded-lg bg-arcade-accent px-7 py-3 font-semibold text-white shadow-glow-rose transition-all hover:scale-[1.03] hover:brightness-110"
            >
              {session ? 'Enter the lobby' : 'Get started'}
            </Link>
            <Link
              to="/games"
              className="rounded-lg border border-white/15 px-7 py-3 font-semibold text-gray-200 transition-colors hover:border-arcade-neon/40 hover:bg-white/5 hover:text-white"
            >
              Browse games
            </Link>
          </div>
          <dl className="mt-4 grid w-full max-w-md grid-cols-3 divide-x divide-white/10 rounded-xl border border-white/10 bg-arcade-bg/60 py-3 backdrop-blur">
            {[
              { term: 'Games', value: '3' },
              { term: 'Modes', value: 'Solo · 1v1 · Party' },
              { term: 'Scores', value: 'Live' },
            ].map((stat) => (
              <div key={stat.term} className="flex flex-col px-2">
                <dt className="order-2 text-[11px] uppercase tracking-widest text-gray-500">
                  {stat.term}
                </dt>
                <dd className="order-1 font-display text-sm text-arcade-neon">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Featured games */}
      <section className="flex flex-col gap-5">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl uppercase tracking-wide">Pick your battle</h2>
            <p className="mt-1 text-sm text-gray-400">Three arenas, one leaderboard.</p>
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
              <article className="flex h-full flex-col rounded-2xl border border-white/10 bg-arcade-panel p-6 transition-colors hover:border-arcade-line/70">
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gameTileGradient(
                    game.key,
                  )} text-white shadow-glow-sm`}
                >
                  <GameIcon gameKey={game.key} size={24} />
                </span>
                <h3 className="mt-4 font-display text-lg tracking-wide">{game.title}</h3>
                <p className="mt-1 flex-1 text-sm text-gray-400">{game.tagline}</p>
                <Link
                  to={`/lobby?game=${game.key}`}
                  className="group mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-arcade-neon transition-colors hover:text-white"
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
        <h2 className="font-display text-2xl uppercase tracking-wide">How it works</h2>
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
            <li
              key={item.step}
              className="rounded-2xl border border-white/10 bg-arcade-panel/60 p-6"
            >
              <span className="font-display text-3xl text-arcade-primary/80">{item.step}</span>
              <h3 className="mt-3 font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-gray-400">{item.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA band */}
      <section className="relative overflow-hidden rounded-3xl border border-arcade-line/50 bg-gradient-to-br from-arcade-primary/25 via-arcade-panel to-arcade-accent/20 p-10 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-40 w-[120%] -translate-x-1/2 rounded-full bg-arcade-primary/30 blur-3xl"
        />
        <div className="relative flex flex-col items-center gap-5">
          <TrophyIcon size={36} className="animate-pulse-glow text-arcade-neon" />
          <h2 className="font-display text-2xl uppercase tracking-wide sm:text-3xl">
            Ready for the leaderboard?
          </h2>
          <p className="max-w-md text-gray-300">
            Spin up a room in seconds — no installs, just a link and a code.
          </p>
          <Link
            to={session ? '/lobby' : '/auth'}
            className="flex items-center gap-2 rounded-lg bg-arcade-accent px-7 py-3 font-semibold text-white shadow-glow-rose transition-all hover:scale-[1.03] hover:brightness-110"
          >
            <UsersIcon size={17} />
            {session ? 'Enter the lobby' : 'Create free account'}
          </Link>
        </div>
      </section>
    </div>
  );
}
