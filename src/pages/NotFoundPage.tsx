import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '../components/icons';

/** 404 fallback route. */
export default function NotFoundPage() {
  return (
    <section className="flex flex-col items-center gap-5 py-16 text-center">
      <p
        aria-hidden
        className="text-glow font-display text-8xl tracking-widest text-transparent sm:text-9xl"
        style={{
          backgroundImage: 'linear-gradient(120deg, #a78bfa, #22d3ee, #f43f5e)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
        }}
      >
        404
      </p>
      <h1 className="font-display text-xl uppercase tracking-wide">Game over — page not found</h1>
      <p className="max-w-sm text-gray-400">
        That page does not exist. Insert coin to return to the arcade floor.
      </p>
      <Link
        to="/"
        className="group inline-flex items-center gap-2 rounded-lg bg-arcade-accent px-6 py-3 font-semibold text-white shadow-glow-rose transition-all hover:scale-[1.03] hover:brightness-110"
      >
        Back home
        <ArrowRightIcon size={16} className="transition-transform group-hover:translate-x-1" />
      </Link>
    </section>
  );
}
