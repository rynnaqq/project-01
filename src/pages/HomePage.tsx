import { Link } from 'react-router-dom';
import ParticleGrid from '../components/ParticleGrid';
import TiltCard from '../components/TiltCard';
import { useAuth } from '../context/AuthProvider';

/** Landing page with an animated hero (P3.1). */
export default function HomePage() {
  const { session } = useAuth();

  return (
    <div className="flex flex-col gap-12">
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-arcade-panel/40">
        <div className="pointer-events-none absolute inset-0">
          <ParticleGrid />
        </div>
        <div className="relative flex flex-col items-center gap-6 px-6 py-20 text-center">
          <h1 className="max-w-2xl bg-gradient-to-r from-arcade-accent to-arcade-neon bg-clip-text text-4xl font-extrabold text-transparent sm:text-5xl">
            Interactive Arcade Hub
          </h1>
          <p className="max-w-xl text-gray-300">
            Real-time multiplayer mini-games with smooth animations. Create a room, invite
            friends, and battle for the top of the leaderboard.
          </p>
          <div className="flex gap-3">
            <Link
              to={session ? '/lobby' : '/auth'}
              className="rounded-md bg-arcade-accent px-6 py-3 font-medium text-white transition hover:bg-arcade-accent/80"
            >
              {session ? 'Enter the lobby' : 'Get started'}
            </Link>
            <Link
              to="/lobby"
              className="rounded-md border border-white/20 px-6 py-3 font-medium text-gray-200 transition hover:bg-white/5"
            >
              Browse games
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { title: 'Quick Math Duel', desc: 'Solo vs AI or 1v1 speed battle.', emoji: '➗' },
          { title: 'Terminal Cipher', desc: 'Memory & puzzle under pressure.', emoji: '🧩' },
          { title: 'Typing Race', desc: 'Real-time words-per-minute showdown.', emoji: '⌨️' },
        ].map((game) => (
          <TiltCard
            key={game.title}
            className="rounded-xl border border-white/10 bg-arcade-panel p-6"
          >
            <div className="text-3xl">{game.emoji}</div>
            <h3 className="mt-3 font-semibold">{game.title}</h3>
            <p className="mt-1 text-sm text-gray-400">{game.desc}</p>
          </TiltCard>
        ))}
      </section>
    </div>
  );
}
