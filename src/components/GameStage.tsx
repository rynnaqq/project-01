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
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-arcade-panel py-16">
        <p className="text-sm uppercase tracking-widest text-gray-400">Starting in</p>
        <p className="text-6xl font-extrabold text-arcade-neon tabular-nums">{seconds}</p>
      </div>
    );
  }

  if (lifecycle.phase === 'active') {
    return (
      <div className="rounded-xl border border-white/10 bg-arcade-panel p-6">
        <div className="mb-4 flex items-center justify-between text-sm text-gray-400">
          <span>Time left</span>
          <span className="font-mono text-arcade-neon tabular-nums">{seconds}s</span>
        </div>
        {children}
      </div>
    );
  }

  if (lifecycle.phase === 'results') {
    return (
      <div className="rounded-xl border border-white/10 bg-arcade-panel p-6">
        <h3 className="text-lg font-semibold">Results</h3>
        <div className="mt-3">{results ?? <p className="text-gray-400">Match complete.</p>}</div>
      </div>
    );
  }

  return null;
}
