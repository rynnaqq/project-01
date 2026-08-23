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
      <div className="slab grid-paper relative flex flex-col items-center justify-center gap-2 overflow-hidden py-20 shadow-pop-lg">
        <p className="sticker bg-arcade-sea px-4 py-1 text-xs text-arcade-ink">Starting in</p>
        {/* key={seconds} remounts the numeral each tick, replaying the pop. */}
        <p
          key={seconds}
          aria-hidden
          className="text-pop-shadow animate-tick font-display text-6xl tabular-nums text-arcade-accent"
        >
          {seconds}
        </p>
        <span className="sr-only" role="timer">{seconds}</span>
      </div>
    );
  }

  if (lifecycle.phase === 'active') {
    return (
      <div className="slab p-6 shadow-pop">
        <div className="mb-4 flex items-center justify-between border-b-[3px] border-dashed border-stone-300 pb-3 text-sm font-semibold text-stone-600">
          <span className="uppercase tracking-widest">Time left</span>
          <span className="rounded-lg border-2 border-arcade-ink bg-arcade-sun px-2 py-0.5 font-mono font-bold tabular-nums text-arcade-ink">
            {seconds}s
          </span>
        </div>
        {children}
      </div>
    );
  }

  if (lifecycle.phase === 'results') {
    return (
      <div className="slab rotate-[0.5deg] p-6 shadow-pop">
        <h3 className="font-display text-base uppercase tracking-wide">Results</h3>
        <div className="mt-3">{results ?? <p className="font-medium text-stone-600">Match complete.</p>}</div>
      </div>
    );
  }

  return null;
}
