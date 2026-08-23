import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '../components/icons';

/** 404 fallback route. */
export default function NotFoundPage() {
  return (
    <section className="flex flex-col items-center gap-5 py-16 text-center">
      <p
        aria-hidden
        className="text-spectrum font-display text-8xl font-semibold tracking-widest sm:text-9xl"
      >
        404
      </p>
      <h1 className="font-display text-lg uppercase tracking-tight">
        Game over — page not found
      </h1>
      <p className="max-w-sm text-slate-400">
        That page does not exist. Insert coin to return to the arcade floor.
      </p>
      <Link
        to="/"
        className="group inline-flex items-center gap-2 rounded-full bg-arcade-primary px-6 py-3 font-bold text-arcade-ink shadow-underglow-mint transition-all hover:scale-[1.03] hover:brightness-110"
      >
        Back home
        <ArrowRightIcon size={16} className="transition-transform group-hover:translate-x-1" />
      </Link>
    </section>
  );
}
