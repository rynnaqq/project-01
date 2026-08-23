import { Link } from 'react-router-dom';
import ParticleGrid from '../components/ParticleGrid';
import { DotCluster, HalfRing, PlusMark, Sparkle, Squiggle, TriShape, ZigzagBand } from '../components/decor';
import { useAuth } from '../context/AuthProvider';
import { GAMES } from '../lib/games';
import { ArrowRightIcon, GameIcon, TrophyIcon, UsersIcon, ZapIcon } from '../components/icons';
import { gameTileGradient } from '../lib/gameArt';

const TICKER_ITEMS = [
  'Real-time multiplayer',
  'Three arenas, one leaderboard',
  'No installs — just a link and a code',
  'Scores stream live',
];

/** Landing page: an asymmetric Memphis playground with tumbling confetti. */
export default function HomePage() {
  const { session } = useAuth();

  return (
    <div className="flex flex-col gap-20">
      {/* Hero — asymmetric split with a tilted confetti case */}
      <section className="relative lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12">
        {/* Scattered decorations */}
        <Sparkle className="pointer-events-none absolute -top-6 left-1/3 h-8 w-8 animate-spin-slow text-arcade-accent" />
        <Squiggle className="pointer-events-none absolute -left-2 bottom-2 hidden h-8 w-24 text-arcade-peri lg:block" />
        <PlusMark className="pointer-events-none absolute right-6 -bottom-4 h-6 w-6 rotate-12 text-arcade-neon" />

        <div className="relative flex flex-col items-start gap-6 pt-4">
          <p className="sticker -rotate-2 bg-arcade-sea px-4 py-1.5 text-xs text-arcade-ink">
            <ZapIcon size={13} aria-hidden />
            Real-time multiplayer
          </p>
          <h1 className="font-display text-4xl uppercase leading-[1.08] tracking-wide sm:text-5xl lg:text-6xl">
            Interactive{' '}
            <span className="text-arcade-accent">Arcade</span>{' '}
            <span className="text-arcade-neon">Hub</span>
          </h1>
          <p className="max-w-md text-lg font-medium text-stone-600">
            Real-time multiplayer mini-games with smooth animations. Create a room, invite friends,
            and battle for the top of the leaderboard.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              to={session ? '/lobby' : '/auth'}
              className="rounded-full border-[3px] border-arcade-ink bg-arcade-accent px-7 py-3 font-bold text-arcade-ink shadow-pop transition-all hover:-translate-y-0.5 hover:shadow-pop-lg active:translate-y-0 active:shadow-pop-sm"
            >
              {session ? 'Enter the lobby' : 'Get started'}
            </Link>
            <Link
              to="/games"
              className="rounded-full border-[3px] border-arcade-ink bg-arcade-panel px-7 py-3 font-bold text-arcade-ink shadow-pop-sm transition-all hover:-translate-y-0.5 hover:bg-arcade-sun hover:shadow-pop active:translate-y-0 active:shadow-none"
            >
              Browse games
            </Link>
          </div>
          <dl className="mt-2 flex flex-wrap gap-3">
            {[
              { term: 'Games', value: '3', tint: 'bg-arcade-sun', tilt: '-rotate-1' },
              { term: 'Modes', value: 'Solo · 1v1 · Party', tint: 'bg-arcade-sea', tilt: 'rotate-1' },
              { term: 'Scores', value: 'Live', tint: 'bg-arcade-pop', tilt: '-rotate-2' },
            ].map((stat) => (
              <div key={stat.term} className={`sticker ${stat.tilt} ${stat.tint} px-4 py-2 text-xs text-arcade-ink`}>
                <dt className="order-2">{stat.term}</dt>
                <dd className="order-1 font-display">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative mt-10 hidden h-[380px] sm:block lg:mt-0">
          <HalfRing className="absolute -left-5 top-6 z-10 h-10 w-20 -rotate-45 text-arcade-sun" />
          <TriShape className="absolute -right-3 bottom-10 z-10 h-9 w-9 rotate-12 text-arcade-accent" />
          <DotCluster className="absolute -bottom-6 left-8 z-10 h-12 w-12 text-arcade-peri" />
          <div className="slab relative h-full rotate-2 overflow-hidden shadow-pop-lg">
            <div className="stripes absolute inset-x-0 top-0 h-3 opacity-80" aria-hidden />
            <ParticleGrid />
            <ZigzagBand className="absolute inset-x-0 bottom-0 h-4 w-full text-arcade-ink" />
          </div>
        </div>
      </section>

      {/* Ticker strip */}
      <div className="slab relative overflow-hidden rounded-xl bg-arcade-ink py-2.5 shadow-pop" aria-hidden>
        <div className="flex w-max animate-marquee gap-10 pr-10">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center gap-10">
              {TICKER_ITEMS.map((item) => (
                <span
                  key={`${copy}-${item}`}
                  className="flex items-center gap-10 whitespace-nowrap font-display text-xs uppercase tracking-widest text-arcade-bg"
                >
                  {item}
                  <Sparkle className="h-4 w-4 shrink-0 text-arcade-sun" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Featured games */}
      <section className="flex flex-col gap-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl uppercase tracking-wide sm:text-2xl">
              Pick your <span className="text-arcade-accent">battle</span>
            </h2>
            <p className="mt-1 font-medium text-stone-600">Three arenas, one leaderboard.</p>
          </div>
          <Link
            to="/games"
            className="group hidden items-center gap-1.5 rounded-full border-2 border-arcade-ink bg-arcade-panel px-4 py-1.5 text-sm font-bold text-arcade-ink transition-all hover:bg-arcade-sun hover:shadow-pop-sm sm:inline-flex"
          >
            All games
            <ArrowRightIcon size={15} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-3 lg:gap-8">
          {GAMES.map((game, i) => {
            const tints = ['bg-arcade-pop', 'bg-arcade-sea', 'bg-arcade-sun'];
            const tilts = ['-rotate-2', 'rotate-1', '-rotate-1'];
            return (
              <article
                key={game.key}
                className={`slab ${tilts[i % tilts.length]} p-6 shadow-pop transition-all duration-200 hover:-translate-y-1 hover:rotate-0 hover:shadow-pop-lg`}
              >
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl border-[3px] border-arcade-ink bg-gradient-to-br ${gameTileGradient(
                    game.key,
                  )} text-white shadow-pop-sm`}
                >
                  <GameIcon gameKey={game.key} size={26} />
                </span>
                <h3 className="mt-4 font-display text-sm uppercase leading-snug tracking-wide">
                  {game.title}
                </h3>
                <p className="mt-1.5 flex-1 text-sm font-medium text-stone-600">{game.tagline}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {game.modes.map((m) => (
                    <span
                      key={m}
                      className={`rounded-full border-2 border-arcade-ink px-2.5 py-0.5 text-xs font-bold ${tints[i % tints.length]} text-arcade-ink`}
                    >
                      {m}
                    </span>
                  ))}
                </div>
                <Link
                  to={`/lobby?game=${game.key}`}
                  className="group mt-4 inline-flex items-center gap-1.5 border-b-[3px] border-arcade-ink pb-0.5 text-sm font-bold uppercase tracking-wide text-arcade-ink transition-colors hover:text-arcade-neon"
                >
                  Play now
                  <ArrowRightIcon size={15} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="flex flex-col gap-6">
        <h2 className="font-display text-xl uppercase tracking-wide sm:text-2xl">How it works</h2>
        <ol className="grid gap-6 sm:grid-cols-3 lg:gap-8">
          {[
            {
              step: '01',
              title: 'Create or join',
              desc: 'Spin up a room and share the 6-character code with your rivals.',
              tint: 'bg-arcade-pop',
            },
            {
              step: '02',
              title: 'Ready up',
              desc: 'Everyone marks ready in the live roster — presence synced instantly.',
              tint: 'bg-arcade-sea',
            },
            {
              step: '03',
              title: 'Battle & win',
              desc: 'Scores stream to a shared scoreboard; history is saved per room.',
              tint: 'bg-arcade-sun',
            },
          ].map((item, i) => (
            <li
              key={item.step}
              className={`slab relative p-6 shadow-pop ${i % 2 === 0 ? '-rotate-1' : 'rotate-1'}`}
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-arcade-ink font-display text-sm text-arcade-ink ${item.tint} absolute -top-4 left-5`}
              >
                {item.step}
              </span>
              <h3 className="mt-4 font-display text-xs uppercase tracking-wide">{item.title}</h3>
              <p className="mt-1.5 text-sm font-medium text-stone-600">{item.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA band */}
      <section className="slab relative overflow-hidden bg-arcade-sun p-10 text-center shadow-pop-lg sm:p-14">
        <PlusMark className="pointer-events-none absolute left-6 top-6 h-7 w-7 rotate-12 text-arcade-ink" />
        <TriShape className="pointer-events-none absolute right-8 top-8 h-8 w-8 -rotate-6 text-arcade-accent" />
        <Squiggle className="pointer-events-none absolute bottom-5 left-10 h-7 w-28 text-arcade-ink" />
        <div className="relative mx-auto flex max-w-md flex-col items-center gap-5">
          <span className="flex h-16 w-16 animate-bob items-center justify-center rounded-full border-[3px] border-arcade-ink bg-arcade-panel text-arcade-gold shadow-pop">
            <TrophyIcon size={30} />
          </span>
          <h2 className="font-display text-xl uppercase leading-snug tracking-wide sm:text-2xl">
            Ready for the leaderboard?
          </h2>
          <p className="font-medium text-stone-700">
            Spin up a room in seconds — no installs, just a link and a code.
          </p>
          <Link
            to={session ? '/lobby' : '/auth'}
            className="mt-1 flex items-center gap-2 rounded-full border-[3px] border-arcade-ink bg-arcade-accent px-7 py-3 font-bold text-arcade-ink shadow-pop transition-all hover:-translate-y-0.5 hover:shadow-pop-lg active:translate-y-0 active:shadow-pop-sm"
          >
            <UsersIcon size={17} aria-hidden />
            {session ? 'Enter the lobby' : 'Create free account'}
          </Link>
        </div>
      </section>
    </div>
  );
}
