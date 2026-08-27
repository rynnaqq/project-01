import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import RequireAuth from './components/RequireAuth';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import GamesPage from './pages/GamesPage';
import LobbyPage from './pages/LobbyPage';
import RoomPage from './pages/RoomPage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';

const SpaceSimulatorApp = lazy(
  () => import('./space-simulator/SpaceSimulatorApp'),
);

export const router = createBrowserRouter([
  {
    path: '/space-simulator',
    element: (
      <Suspense
        fallback={
          <div className="fixed inset-0 grid place-items-center bg-black font-mono text-white">
            LOADING MISSION ASSETS...
          </div>
        }
      >
        <SpaceSimulatorApp />
      </Suspense>
    ),
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'auth', element: <AuthPage /> },
      { path: 'games', element: <GamesPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: 'lobby', element: <LobbyPage /> },
          { path: 'room/:code', element: <RoomPage /> },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
