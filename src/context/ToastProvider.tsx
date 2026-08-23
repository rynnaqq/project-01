import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastKind = 'info' | 'success' | 'error';
export type Toast = { id: number; kind: ToastKind; message: string };

type ToastContextValue = {
  /** Show a transient toast (auto-dismisses). Returns its id. */
  push: (message: string, kind?: ToastKind) => number;
  /** Remove a toast early. */
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 4500;

/**
 * Minimal toast system (P6.1): transient, screen-reader-friendly feedback for
 * action results (score errors, host actions, …). Rendered bottom-right and
 * announced politely via aria-live, so gameplay is never interrupted.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextIdRef = useRef(1);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, kind: ToastKind = 'error') => {
      const id = nextIdRef.current;
      nextIdRef.current += 1;
      setToasts((current) => [...current.slice(-(MAX_VISIBLE - 1)), { id, kind, message }]);
      timersRef.current.set(
        id,
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
      );
      return id;
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            data-testid={`toast-${toast.kind}`}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm backdrop-blur-xl shadow-glass ${
              toast.kind === 'error'
                ? 'border-red-400/40 bg-red-950/80 text-red-200'
                : toast.kind === 'success'
                  ? 'border-arcade-primary/40 bg-[#062018]/85 text-emerald-200'
                  : 'glass-deep text-slate-200'
            }`}
          >
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="rounded p-0.5 leading-none opacity-70 transition hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- matches the AuthProvider pattern
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
