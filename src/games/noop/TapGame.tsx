import { useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '../types';

/**
 * Fallback "game" used to exercise the lifecycle + scoreboard (P4.1/P4.2) and
 * rendered whenever a room's selected game has no implementation yet.
 */
export default function TapGame({ reportScore }: GameComponentProps) {
  const [taps, setTaps] = useState(0);
  const reportRef = useRef(reportScore);
  useEffect(() => {
    reportRef.current = reportScore;
  }, [reportScore]);
  useEffect(() => {
    reportRef.current(0);
  }, []);

  function handleTap() {
    const next = taps + 1;
    setTaps(next);
    reportScore(next);
  }

  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <p className="text-sm font-medium text-stone-600">Tap to score — lifecycle &amp; scoreboard demo.</p>
      <button
        type="button"
        onClick={handleTap}
        className="cursor-pointer rounded-full border-[3px] border-arcade-ink bg-arcade-pop px-8 py-8 text-2xl font-bold text-arcade-ink shadow-pop transition-transform hover:scale-105 active:scale-95"
      >
        +1 ({taps})
      </button>
    </div>
  );
}
