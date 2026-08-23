import { Link } from 'react-router-dom';
import { Sparkle, Squiggle } from '../components/decor';
import { ArrowRightIcon } from '../components/icons';

/** 404 fallback route. */
export default function NotFoundPage() {
  return (
    <section className="relative flex flex-col items-center gap-6 py-20 text-center">
      <Sparkle className="pointer-events-none absolute left-1/4 top-10 h-8 w-8 animate-spin-slow text-arcade-accent" />
      <Squiggle className="pointer-events-none absolute bottom-16 right-1/4 h-7 w-24 -rotate-6 text-arcade-peri" />
      <p
        aria-hidden
        className="text-pop-shadow font-display text-7xl tracking-widest text-arcade-pop sm:text-9xl"
      >
        404
      </p>
      <h1 className="font-display text-lg uppercase tracking-wide">
        Game over. Page not found.
      </h1>
      <p className="max-w-sm font-medium text-stone-600">
        This page doesn't exist. Insert coin to head back.
      </p>
      <Link
        to="/"
        className="group inline-flex items-center gap-2 rounded-full border-[3px] border-arcade-ink bg-arcade-accent px-6 py-3 font-bold text-arcade-ink shadow-pop lift"
      >
        Back home
        <ArrowRightIcon size={16} className="transition-transform group-hover:translate-x-1" aria-hidden />
      </Link>
    </section>
  );
}
