import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';

/** Guards child routes: redirects unauthenticated users to /auth. */
export default function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className="text-stone-500">Loading…</p>;
  }
  if (!session) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
