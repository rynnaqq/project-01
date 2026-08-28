import { Link } from 'react-router-dom';
import ParticleGrid from '../components/ParticleGrid';
import { DotCluster, HalfRing, PlusMark, Sparkle, Squiggle, TriShape, ZigzagBand } from '../components/decor';
import { Magnetic, Reveal, Spotlight } from '../components/motion';
import { useAuth } from '../context/AuthProvider';
import { GAMES } from '../lib/games';
import { ArrowRightIcon, GameIcon, TrophyIcon, UsersIcon } from '../components/icons';
import { gameTileGradient } from '../lib/gameArt';

const TICKER_ITEMS = [
  'Multiplayer mini-games',
  'Three arenas, one leaderboard',
  'Solo, 1v1, or party mode',
  'Scores update live',
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
          <Reveal index={0} className="w-full">
            <h1 className="font-display text-4xl uppercase leading-[1.08] tracking-wide sm:text-5xl lg:text-6xl">
              Interactive{' '}
              <span className="text-arcade-accent">Arcade</span>{' '}
              <span className="text-arcade-neon">Hub</span>
            </h1>
          </Reveal>
          <Reveal index={1}>
            <p className="max-w-md text-lg font-medium text-stone-600">
              Quick mini-games against your friends. Make a room, send them the code, and fight for
              the top score.
            </p>
          </Reveal>
          <Reveal index={2}>
            <div className="flex flex-wrap gap-4">
            <Magnetic>
              <Link
                to={session ? '/lobby' : '/auth'}
                className="lift block rounded-full border-[3px] border-arcade-ink bg-arcade-accent px-7 py-3 font-bold text-arcade-ink shadow-pop transition-colors hover:bg-[#ff8ad8]"
              >
                {session ? 'Enter the lobby' : 'Get started'}
              </Link>
            </Magnetic>
            <Link
              to="/games"
              className="lift rounded-full border-[3px] border-arcade-ink bg-arcade-panel px-7 py-3 font-bold text-arcade-ink shadow-pop-sm transition-colors hover:bg-arcade-sun"
            >
                  Browse games
            </Link>
            </div>
          </Reveal>
          <Reveal index={3}>
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
          </Reveal>
        </div>

        <Reveal index={2} className="relative mt-10 hidden h-[380px] sm:block lg:mt-0">
          <HalfRing className="absolute -left-5 top-6 z-10 h-10 w-20 -rotate-45 text-arcade-sun" />
          <TriShape className="absolute -right-3 bottom-10 z-10 h-9 w-9 rotate-12 text-arcade-accent" />
          <DotCluster className="absolute -bottom-6 left-8 z-10 h-12 w-12 text-arcade-peri" />
          <Spotlight className="slab h-full rotate-2 overflow-hidden shadow-pop-lg" color="rgba(255,255,255,0.22)">
            <div className="stripes absolute inset-x-0 top-0 h-3 opacity-80" aria-hidden />
            <ParticleGrid />
            <ZigzagBand className="absolute inset-x-0 bottom-0 h-4 w-full text-arcade-ink" />
          </Spotlight>
        </Reveal>
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
            className="group hidden items-center gap-1.5 rounded-full border-2 border-arcade-ink bg-arcade-panel px-4 py-1.5 text-sm font-bold text-arcade-ink transition-colors hover:bg-arcade-sun sm:inline-flex"
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
              <Reveal key={game.key} index={i} className="h-full">
                <Spotlight className="h-full" color="rgba(255,255,255,0.4)">
                  <article
                    className={`slab ${tilts[i % tilts.length]} h-full overflow-hidden p-6 shadow-pop transition-transform duration-300 ease-expo hover:-translate-y-1.5 hover:rotate-0`}
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
                </Spotlight>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Rail Rush & Space Simulator — standalone 3D games */}
      <section className="grid gap-6 sm:grid-cols-2">
        <Reveal index={0}>
          <a
            href="/rail-rush/"
            target="_blank"
            rel="noopener noreferrer"
            className="slab lift group relative flex h-full flex-col items-start gap-5 overflow-hidden bg-arcade-peri p-8 shadow-pop"
          >
            <TriShape className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rotate-12 text-white/15" />
            <Squiggle className="pointer-events-none absolute bottom-3 right-8 hidden h-6 w-24 text-white/25 sm:block" />
            <div className="relative flex-1">
              <p className="sticker bg-arcade-sun px-3 py-0.5 text-[10px] text-arcade-ink">
                3D · runs in your browser
              </p>
              <h2 className="mt-3 font-display text-xl uppercase tracking-wide text-white sm:text-2xl">
                Rail Rush
              </h2>
              <p className="mt-1 max-w-md text-sm font-medium text-[#e6ecff]">
                Dodge oncoming trains on a 3-lane railway. Grab coins, snag
                power-ups, and outrun the schedule.
              </p>
            </div>
            <span className="lift relative mt-auto inline-flex items-center gap-2 rounded-full border-[3px] border-arcade-ink bg-arcade-accent px-6 py-3 font-bold text-arcade-ink shadow-pop transition-colors group-hover:bg-[#ff8ad8]">
              Play now
              <ArrowRightIcon size={16} className="transition-transform group-hover:translate-x-1" aria-hidden />
            </span>
          </a>
        </Reveal>

        <Reveal index={1}>
          <a
            href="/space-sim/"
            target="_blank"
            rel="noopener noreferrer"
            className="slab lift group relative flex h-full flex-col items-start gap-5 overflow-hidden bg-arcade-ink p-8 shadow-pop"
          >
            <Sparkle className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rotate-12 text-arcade-neon/20" />
            <DotCluster className="pointer-events-none absolute bottom-3 right-8 hidden h-6 w-24 text-arcade-accent/20 sm:block" />
            <div className="relative flex-1">
              <p className="sticker bg-arcade-neon px-3 py-0.5 text-[10px] text-arcade-ink">
                3D · WebGPU / WebGL2
              </p>
              <h2 className="mt-3 font-display text-xl uppercase tracking-wide text-white sm:text-2xl">
                Space Simulator
              </h2>
              <p className="mt-1 max-w-md text-sm font-medium text-stone-300">
                Earth to ISS Journey. Launch a rocket, navigate orbit, dock with the space station, and explore zero-G in first person.
              </p>
            </div>
            <span className="lift relative mt-auto inline-flex items-center gap-2 rounded-full border-[3px] border-arcade-ink bg-arcade-neon px-6 py-3 font-bold text-arcade-ink shadow-pop transition-colors group-hover:bg-[#34d399]">
              Launch Mission
              <ArrowRightIcon size={16} className="transition-transform group-hover:translate-x-1" aria-hidden />
            </span>
          </a>
        </Reveal>
      </section>
      {/* How it works */}
      <section className="flex flex-col gap-6">
        <h2 className="font-display text-xl uppercase tracking-wide sm:text-2xl">How it works</h2>
        <ol className="grid gap-6 sm:grid-cols-3 lg:gap-8">
          {[
            {
              step: '01',
              title: 'Create or join',
              desc: 'Start a room and give your friends the 6-character code.',
              tint: 'bg-arcade-pop',
            },
            {
              step: '02',
              title: 'Ready up',
              desc: 'Everyone marks ready in the roster. Presence syncs as people join.',
              tint: 'bg-arcade-sea',
            },
            {
              step: '03',
              title: 'Battle & win',
              desc: 'Scores land on a shared scoreboard. Each room keeps its match history.',
              tint: 'bg-arcade-sun',
            },
          ].map((item, i) => (
            <li key={item.step} className="relative">
              <Reveal index={i}>
                <div className={`slab relative p-6 pt-7 shadow-pop ${i % 2 === 0 ? '-rotate-1' : 'rotate-1'}`}>
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-arcade-ink font-display text-sm text-arcade-ink ${item.tint} absolute -top-4 left-5`}
                  >
                    {item.step}
                  </span>
                  <h3 className="mt-2 font-display text-xs uppercase tracking-wide">{item.title}</h3>
                  <p className="mt-1.5 text-sm font-medium text-stone-600">{item.desc}</p>
                </div>
              </Reveal>
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
            It runs in your browser. Send a link and a code, and you're playing.
          </p>
          <Link
            to={session ? '/lobby' : '/auth'}
            className="mt-1 flex items-center gap-2 rounded-full border-[3px] border-arcade-ink bg-arcade-accent px-7 py-3 font-bold text-arcade-ink shadow-pop lift"
          >
            <UsersIcon size={17} aria-hidden />
            {session ? 'Enter the lobby' : 'Create free account'}
          </Link>
        </div>
      </section>
    </div>
  );
}
