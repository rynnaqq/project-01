import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameComponentProps } from '../types';
import {
  WRONG_PENALTY_MS,
  aiScoreAt,
  applyPenalty,
  isCorrect,
  isLockedOut,
  levelFor,
  makeProblem,
  pointsForStreak,
  type Problem,
} from './logic';

type Feedback = 'idle' | 'correct' | 'wrong';

/**
 * Quick Math Duel (P5.1).
 *
 * Solo: race a steady AI benchmark. 1v1/Party: highest score when the clock
 * runs out wins (the shared scoreboard does the ranking). Wrong answers lock
 * the input briefly instead of costing points, which is the "time penalty".
 *
 * All timing is derived from the lifecycle's `elapsedMs` (server-anchored), so
 * penalties and the AI benchmark stay consistent across clients.
 */
export default function MathDuel({
  elapsedMs,
  playerCount,
  reportScore,
}: GameComponentProps) {
  const [problem, setProblem] = useState<Problem>(() => makeProblem(Math.random, 0));
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [solved, setSolved] = useState(0);
  const [misses, setMisses] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>('idle');

  const inputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef(reportScore);
  useEffect(() => {
    reportRef.current = reportScore;
  }, [reportScore]);

  // Claim a scoreboard row immediately so opponents see this player at 0.
  useEffect(() => {
    reportRef.current(0);
  }, []);

  const locked = isLockedOut(lockedUntil, elapsedMs);
  const solo = playerCount <= 1;
  const aiScore = useMemo(() => aiScoreAt(elapsedMs), [elapsedMs]);

  // Refocus as soon as the penalty lockout expires.
  useEffect(() => {
    if (!locked) inputRef.current?.focus();
  }, [locked]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || input.trim() === '') return;

    if (isCorrect(problem, input)) {
      const nextStreak = streak + 1;
      const nextSolved = solved + 1;
      const nextScore = score + pointsForStreak(nextStreak);
      setStreak(nextStreak);
      setSolved(nextSolved);
      setScore(nextScore);
      setProblem(makeProblem(Math.random, levelFor(nextSolved)));
      setFeedback('correct');
      reportScore(nextScore);
    } else {
      setStreak(0);
      setMisses((m) => m + 1);
      setLockedUntil(applyPenalty(elapsedMs));
      setFeedback('wrong');
    }
    setInput('');
  }

  const accuracy = solved + misses === 0 ? 100 : Math.round((solved / (solved + misses)) * 100);

  return (
    <div className="flex flex-col items-center gap-5 py-2">
      <div className="flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-stone-500 sm:text-sm">
        <span>
          Score <span className="font-mono text-base text-arcade-neon tabular-nums">{score}</span>
        </span>
        <span>
          Streak <span className="font-mono text-arcade-neon tabular-nums">×{Math.min(5, Math.max(1, streak))}</span>
        </span>
        <span>
          Level <span className="font-mono tabular-nums">{levelFor(solved) + 1}</span>
        </span>
        <span>
          Accuracy <span className="font-mono tabular-nums">{accuracy}%</span>
        </span>
      </div>

      {solo && (
        <p className="text-xs text-stone-500 sm:text-sm">
          AI benchmark:{' '}
          <span className="font-mono tabular-nums text-arcade-neon">{aiScore}</span>{' '}
          <span className={score >= aiScore ? 'text-[#0e7a6d]' : 'text-[#8a5b00]'}>
            ({score >= aiScore ? 'you lead' : `behind by ${aiScore - score}`})
          </span>
        </p>
      )}

      <p
        className="select-none text-center text-4xl font-extrabold tabular-nums sm:text-6xl"
        aria-label={`Problem: ${problem.a} ${problem.op} ${problem.b}`}
      >
        {problem.prompt}
      </p>

      <form onSubmit={handleSubmit} className="flex w-full max-w-xs items-center gap-2">
        <label htmlFor="math-duel-answer" className="sr-only">
          Your answer
        </label>
        <input
          id="math-duel-answer"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={locked}
          autoComplete="off"
          inputMode="numeric"
          // Intentional: the round is already running, so the field must accept
          // keystrokes the moment the game mounts.
          autoFocus
          placeholder={locked ? 'Penalty…' : 'Answer'}
          className="field min-w-0 flex-1 px-3 py-2 text-center text-lg font-semibold tabular-nums text-arcade-ink disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={locked}
          className="cursor-pointer rounded-full border-[3px] border-arcade-ink bg-arcade-accent px-4 py-2 text-sm font-bold text-arcade-ink shadow-pop-sm transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none"
        >
          Enter
        </button>
      </form>

      <p role="status" aria-live="polite" className="min-h-5 text-sm">
        {locked ? (
          <span className="text-[#c2402f]">
            Wrong. Locked for {(WRONG_PENALTY_MS / 1000).toFixed(1)}s
          </span>
        ) : feedback === 'correct' ? (
          <span className="text-[#0e7a6d]">Correct! +{pointsForStreak(streak)}</span>
        ) : feedback === 'wrong' ? (
          <span className="text-stone-500">Try the next one.</span>
        ) : (
          <span className="text-stone-500">Type the answer and press Enter.</span>
        )}
      </p>
    </div>
  );
}
