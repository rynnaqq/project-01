import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider';
import { AudioProvider } from './context/AudioProvider';
import { ToastProvider } from './context/ToastProvider';
import ErrorBoundary from './components/ErrorBoundary';
import { router } from './router';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AudioProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </AudioProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
