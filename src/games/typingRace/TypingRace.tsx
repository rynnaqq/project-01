import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameComponentProps } from '../types';
import {
  computeProgress,
  nextChar,
  passageFor,
  progressPctFromScore,
  raceScore,
  wpm,
} from './logic';

/**
 * Typing Race (P5.3).
 *
 * Every racer gets the same passage (seeded from `matchId`), and progress is a
 * strict prefix match so mistakes stall you until they are corrected. Scores are
 * reported as `progress% × 10` (+ a finish bonus), which doubles as the data for
 * the live per-player progress bars — no extra realtime channel needed, the
 * existing scoreboard subscription already streams it.
 */
export default function TypingRace({
  userId,
  matchId,
  elapsedMs,
  remainingMs,
  scores,
  reportScore,
}: GameComponentProps) {
  const passage = useMemo(() => passageFor(matchId), [matchId]);
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const progress = useMemo(() => computeProgress(passage, typed), [passage, typed]);

  const reportRef = useRef(reportScore);
  useEffect(() => {
    reportRef.current = reportScore;
  }, [reportScore]);

  // Publish only when progress actually changes (the clock ticks ~10×/second).
  const lastPctRef = useRef(-1);
  useEffect(() => {
    if (progress.progressPct === lastPctRef.current) return;
    lastPctRef.current = progress.progressPct;
    reportRef.current(
      raceScore({ progressPct: progress.progressPct, done: progress.done, remainingMs }),
    );
  }, [progress.progressPct, progress.done, remainingMs]);

  const upcoming = nextChar(passage, typed);
  const speed = wpm(progress.correctChars, elapsedMs);
  const bars = scores.length > 0
    ? scores
    : [{ playerId: userId, username: 'you', avatar: null, score: 0 }];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-stone-500 sm:text-sm">
        <span>
          Progress{' '}
          <span className="font-mono text-base text-arcade-neon tabular-nums">
            {progress.progressPct}%
          </span>
        </span>
        <span>
          WPM <span className="font-mono tabular-nums">{speed}</span>
        </span>
        <span>
          Accuracy <span className="font-mono tabular-nums">{progress.accuracyPct}%</span>
        </span>
      </div>

      <p
        className="rounded-xl border-[3px] border-arcade-ink bg-arcade-panel p-3 font-mono text-sm leading-7 sm:text-base"
        aria-hidden
      >
        {passage.split('').map((char, index) => {
          const isTypedCorrect = index < progress.correctChars;
          const isCursor = index === progress.correctChars;
          const showError = isCursor && progress.errorChars > 0;
          return (
            <span
              key={`${index}-${char}`}
              className={
                isTypedCorrect
                  ? 'text-[#0e7a6d]'
                  : showError
                    ? 'rounded bg-[#ffb3ab] text-arcade-ink'
                    : isCursor
                      ? 'rounded bg-arcade-sea text-arcade-ink'
                      : 'text-stone-400'
              }
            >
              {char}
            </span>
          );
        })}
      </p>

      <label htmlFor="typing-race-input" className="sr-only">
        Type the passage
      </label>
      <input
        id="typing-race-input"
        ref={inputRef}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        disabled={progress.done}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        // Intentional: the race is already running when this mounts.
        autoFocus
        placeholder={progress.done ? 'Finished!' : 'Start typing…'}
        aria-describedby="typing-race-status"
        className={`field w-full px-3 py-2 font-mono text-sm sm:text-base ${
          progress.errorChars > 0 ? 'border-[#c2402f]' : 'border-arcade-ink focus:border-arcade-neon'
        } disabled:opacity-50`}
      />

      <p id="typing-race-status" role="status" aria-live="polite" className="min-h-5 text-sm">
        {progress.done ? (
          <span className="text-[#0e7a6d]">Finished — nice run!</span>
        ) : progress.errorChars > 0 ? (
          <span className="text-[#c2402f]">
            Mistake — delete {progress.errorChars} character{progress.errorChars > 1 ? 's' : ''} to
            continue.
          </span>
        ) : (
          <span className="text-stone-500">
            Next character: <span className="font-mono text-arcade-neon">{upcoming === ' ' ? '␣' : upcoming}</span>
          </span>
        )}
      </p>

      <ul className="flex flex-col gap-2" aria-label="Racer progress">
        {bars.map((entry) => {
          const pct = entry.playerId === userId ? progress.progressPct : progressPctFromScore(entry.score);
          const isMe = entry.playerId === userId;
          return (
            <li key={entry.playerId} className="flex items-center gap-3 text-xs sm:text-sm">
              <span className="w-24 shrink-0 truncate text-stone-700">
                {entry.username ?? 'player'}
                {isMe && <span className="ml-1 text-stone-400">(you)</span>}
              </span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full border-2 border-arcade-ink bg-arcade-panel">
                <span
                  role="progressbar"
                  aria-label={`${entry.username ?? 'player'} progress`}
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className={`block h-full rounded-full transition-[width] duration-200 ${
                    isMe ? 'bg-arcade-neon' : 'bg-arcade-accent'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="w-10 shrink-0 text-right font-mono tabular-nums text-stone-500">
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
