import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameComponentProps } from '../types';
import {
  GRID_CELLS,
  ROUND_MS,
  VERSUS_MAX_STEPS,
  extendSequence,
  generateSequence,
  isMyTurn,
  playbackStep,
  pointsForRound,
  roundAt,
  roundRemainingMs,
  sequenceForRound,
  sequenceLength,
  turnPlayerId,
  validateInput,
} from './logic';

type Status = 'watch' | 'input' | 'cleared' | 'failed';

/**
 * Terminal Cipher (P5.2) — memorise the flashed grid sequence, then reproduce it.
 *
 * Solo/timed: rounds advance as soon as you clear them, one step longer each
 * time, until the match clock ends.
 *
 * Versus (2+ players): rounds are fixed windows of the server-anchored match
 * clock, and turns rotate round-robin over the roster. Because both the round
 * and the sequence are derived from (`matchId`, round), every client shows the
 * same puzzle and agrees on whose turn it is with no extra realtime traffic.
 *
 * All state is component-local, so nothing leaks across rounds, matches, or the
 * other mini-games.
 */
export default function TerminalCipher({
  userId,
  matchId,
  elapsedMs,
  playerCount,
  playerIds,
  reportScore,
}: GameComponentProps) {
  const versus = playerCount >= 2 && playerIds.length >= 2;

  const [soloRound, setSoloRound] = useState(0);
  const [soloRoundStart, setSoloRoundStart] = useState(0);
  const [soloSequence, setSoloSequence] = useState<number[]>(() =>
    generateSequence(sequenceLength(0)),
  );
  const [input, setInput] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [status, setStatus] = useState<Status>('watch');

  const reportRef = useRef(reportScore);
  useEffect(() => {
    reportRef.current = reportScore;
  }, [reportScore]);
  useEffect(() => {
    reportRef.current(0);
  }, []);

  const versusRound = roundAt(elapsedMs);
  const round = versus ? versusRound : soloRound;

  const versusSequence = useMemo(
    // Capped so playback always fits the fixed turn window on every client.
    () => sequenceForRound(matchId, versusRound, { maxLength: VERSUS_MAX_STEPS }),
    [matchId, versusRound],
  );
  const sequence = versus ? versusSequence : soloSequence;

  const sinceRoundStart = versus ? elapsedMs - versusRound * ROUND_MS : elapsedMs - soloRoundStart;
  const litStep = playbackStep(sinceRoundStart, sequence.length);
  const watching = litStep !== null;

  const myTurn = versus ? isMyTurn(playerIds, versusRound, userId) : true;
  const turnId = versus ? turnPlayerId(playerIds, versusRound) : userId;
  const turnNumber = turnId ? playerIds.indexOf(turnId) + 1 : 0;
  const canPlay = !watching && myTurn && status !== 'cleared';

  // New round (versus windows or solo progression) resets the attempt.
  useEffect(() => {
    setInput([]);
    setStatus('watch');
  }, [round]);

  const handleCell = useCallback(
    (cell: number) => {
      if (!canPlay) return;
      const next = [...input, cell];
      const result = validateInput(sequence, next);

      if (result === 'wrong') {
        setInput([]);
        setStatus('failed');
        return;
      }
      if (result === 'partial') {
        setInput(next);
        setStatus('input');
        return;
      }

      const nextScore = score + pointsForRound(round);
      setScore(nextScore);
      setCleared((c) => c + 1);
      setInput([]);
      setStatus('cleared');
      reportScore(nextScore);

      if (!versus) {
        // Timed mode: immediately start a longer round.
        setSoloSequence(extendSequence(sequence));
        setSoloRound(round + 1);
        setSoloRoundStart(elapsedMs);
      }
    },
    [canPlay, input, sequence, score, round, reportScore, versus, elapsedMs],
  );

  // Number-key shortcuts (1…9) mirror the grid for keyboard-only play.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.length !== 1) return;
      const digit = Number.parseInt(event.key, 10);
      if (!Number.isInteger(digit) || digit < 1 || digit > GRID_CELLS) return;
      handleCell(digit - 1);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCell]);

  const roundLeftSeconds = versus ? Math.ceil(roundRemainingMs(elapsedMs) / 1000) : null;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-stone-500 sm:text-sm">
        <span>
          Score <span className="font-mono text-base text-arcade-neon tabular-nums">{score}</span>
        </span>
        <span>
          Round <span className="font-mono tabular-nums">{round + 1}</span>
        </span>
        <span>
          Cleared <span className="font-mono tabular-nums">{cleared}</span>
        </span>
        <span>
          Steps <span className="font-mono tabular-nums">{sequence.length}</span>
        </span>
        {roundLeftSeconds != null && (
          <span>
            Turn ends in{' '}
            <span className="font-mono tabular-nums text-arcade-neon">{roundLeftSeconds}s</span>
          </span>
        )}
      </div>

      <p role="status" aria-live="polite" className="min-h-5 text-center text-sm">
        {watching ? (
          <span className="text-arcade-neon">Watch the sequence…</span>
        ) : versus && !myTurn ? (
          <span className="text-[#8a5b00]">Player {turnNumber} is cracking the cipher…</span>
        ) : status === 'cleared' ? (
          <span className="text-[#0e7a6d]">
            Cracked! +{pointsForRound(round)}
            {versus ? ' Wait for the next round.' : ''}
          </span>
        ) : status === 'failed' ? (
          <span className="text-[#c2402f]">Wrong cell. Start over.</span>
        ) : (
          <span className="text-stone-500">
            Your turn. Repeat {sequence.length} steps ({input.length} entered).
          </span>
        )}
      </p>

      <div
        role="group"
        aria-label="Cipher grid"
        className="grid grid-cols-3 gap-2 sm:gap-3"
      >
        {Array.from({ length: GRID_CELLS }, (_, cell) => {
          const isLit = watching && sequence[litStep as number] === cell;
          const isEntered = input[input.length - 1] === cell;
          return (
            <button
              key={cell}
              type="button"
              onClick={() => handleCell(cell)}
              disabled={!canPlay}
              aria-label={`Cell ${cell + 1}`}
              className={`h-16 w-16 rounded-xl border-[3px] border-arcade-ink font-mono text-sm font-bold transition sm:h-20 sm:w-20 ${
                isLit
                  ? 'bg-arcade-sun text-arcade-ink shadow-pop'
                  : isEntered
                    ? 'bg-arcade-pop text-arcade-ink shadow-pop-sm'
                    : 'bg-arcade-panel text-arcade-ink shadow-pop-sm'
              } ${canPlay ? 'hover:-translate-y-0.5 hover:bg-arcade-sea hover:shadow-pop' : 'cursor-not-allowed'}`}
            >
              {cell + 1}
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-stone-500">
        {versus
          ? 'Turn-based versus: rounds rotate between players on the shared clock.'
          : 'Timed mode: clear as many rounds as you can before time runs out.'}{' '}
        Keys 1–9 work too.
      </p>
    </div>
  );
}
