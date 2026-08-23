import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { error: Error | null };

/**
 * Top-level crash guard (P6.1): a render error in any route shows a recoverable
 * message instead of a blank screen. Reloading remounts the tree cleanly; the
 * synced lifecycle means a mid-game reload resyncs from the room plan.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', error.message, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <section className="mx-auto max-w-md py-16 text-center">
        <h1 role="alert" className="font-display text-base uppercase tracking-wide text-[#7c2d24]">
          Something went wrong
        </h1>
        <p className="mt-3 font-medium text-stone-600">
          The screen hit an unexpected error. Your match state is safe. Reload to pick up where
          you left off.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          className="mt-6 cursor-pointer rounded-full border-[3px] border-arcade-ink bg-arcade-accent px-4 py-2 text-sm font-bold text-arcade-ink shadow-pop-sm transition-all hover:-translate-y-0.5 hover:shadow-pop"
        >
          Reload
        </button>
      </section>
    );
  }
}
