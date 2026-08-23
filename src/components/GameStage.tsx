import type { ReactNode } from 'react';
import type { LifecycleState } from '../lib/gameLifecycle';

type GameStageProps = {
  lifecycle: LifecycleState;
  /** Rendered during the active phase. */
  children: ReactNode;
  /** Rendered on the results screen (scoreboard etc.). */
  results?: ReactNode;
};

/**
 * Presentational wrapper for the synced game lifecycle. Shows a countdown, then
 * the active game content, then a results view. The phase/timers come from
 * `useGameLifecycle` so all clients render in lockstep.
 */
export default function GameStage({ lifecycle, children, results }: GameStageProps) {
  const seconds = Math.ceil(lifecycle.remainingMs / 1000);

  if (lifecycle.phase === 'countdown') {
    return (
      <div className="glass-deep relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-arcade-neon/15 blur-3xl"
        />
        <p className="relative text-sm uppercase tracking-[0.3em] text-slate-400">Starting in</p>
        <p className="text-spectrum relative font-display text-6xl tabular-nums">{seconds}</p>
      </div>
    );
  }

  if (lifecycle.phase === 'active') {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between text-sm text-slate-400">
          <span>Time left</span>
          <span className="font-mono text-arcade-neon tabular-nums">{seconds}s</span>
        </div>
        {children}
      </div>
    );
  }

  if (lifecycle.phase === 'results') {
    return (
      <div className="glass rounded-2xl p-6">
        <h3 className="font-display text-base uppercase tracking-tight">Results</h3>
        <div className="mt-3">{results ?? <p className="text-slate-400">Match complete.</p>}</div>
      </div>
    );
  }

  return null;
}
