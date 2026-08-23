import { Link } from 'react-router-dom';

/** 404 fallback route. */
export default function NotFoundPage() {
  return (
    <section>
      <h1 className="text-3xl font-bold">404</h1>
      <p className="mt-2 text-gray-400">That page does not exist.</p>
      <Link to="/" className="mt-4 inline-block text-arcade-neon underline">
        Back home
      </Link>
    </section>
  );
}
