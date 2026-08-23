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

export const router = createBrowserRouter([
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
