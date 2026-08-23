/**
 * Pure logic for Typing Race (P5.3).
 *
 * Progress is a prefix match: a racer advances only while what they have typed
 * still matches the passage, so accuracy directly gates speed. Scores are
 * reported as `progress% × 10` plus a finish bonus, which lets the shared
 * scoreboard rank racers *and* preserve finishing order without new tables.
 */
import { hashSeed, makeRng } from '../../lib/rng';

/** Shared passages. ASCII only so every keyboard can type them. */
export const PASSAGES: string[] = [
  'Neon light spills across the arcade floor as the next challenger steps up to the machine.',
  'Every high score is temporary, but the story of a perfect run gets told for years.',
  'Quick hands win rounds; steady hands win tournaments, so breathe and keep your rhythm.',
  'The cabinet hums, the countdown drops, and for ten glorious seconds nothing else exists.',
  'Press start, trust your practice, and let the muscle memory do the difficult part for you.',
];

/** Score scale: a full 100% of the passage is worth this many points. */
export const PROGRESS_POINTS = 10;
/** Finish bonus granularity: one point per this many ms left on the clock. */
export const FINISH_BONUS_MS_PER_POINT = 100;

export type RaceProgress = {
  /** Length of the correctly typed prefix. */
  correctChars: number;
  /** Characters typed past the first mistake (0 when clean). */
  errorChars: number;
  /** Whole-percent progress through the passage (0–100). */
  progressPct: number;
  /** Whole-percent accuracy over everything typed (100 when nothing typed). */
  accuracyPct: number;
  /** True once the whole passage has been typed correctly. */
  done: boolean;
};

/** Pick the shared passage for a match (identical on every client). */
export function passageFor(matchId: string | null | undefined): string {
  const rng = makeRng(hashSeed(`passage#${matchId ?? 'local'}`));
  const index = Math.min(PASSAGES.length - 1, Math.floor(rng() * PASSAGES.length));
  return PASSAGES[index];
}

/** Length of the longest common prefix between the passage and the input. */
export function correctPrefixLength(target: string, typed: string): number {
  const max = Math.min(target.length, typed.length);
  let i = 0;
  while (i < max && target[i] === typed[i]) i += 1;
  return i;
}

/** Progress, accuracy and completion for a racer's current input. */
export function computeProgress(target: string, typed: string): RaceProgress {
  if (target.length === 0) {
    return { correctChars: 0, errorChars: typed.length, progressPct: 0, accuracyPct: 100, done: false };
  }
  const correctChars = correctPrefixLength(target, typed);
  const errorChars = Math.max(0, typed.length - correctChars);
  const progressPct = Math.min(100, Math.floor((correctChars / target.length) * 100));
  const accuracyPct =
    typed.length === 0 ? 100 : Math.max(0, Math.round((correctChars / typed.length) * 100));
  return {
    correctChars,
    errorChars,
    progressPct,
    accuracyPct,
    done: correctChars === target.length && typed.length === target.length,
  };
}

/** The next character the racer must type, or null when finished. */
export function nextChar(target: string, typed: string): string | null {
  const at = correctPrefixLength(target, typed);
  return at < target.length ? target[at] : null;
}

/** Words per minute from correct characters (the standard 5-chars-per-word rule). */
export function wpm(correctChars: number, elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0 || correctChars <= 0) return 0;
  const minutes = elapsedMs / 60_000;
  return Math.round(correctChars / 5 / minutes);
}

/**
 * Reported score: progress dominates, and finishing early adds a bonus so the
 * first racer to finish outranks a later finisher.
 */
export function raceScore(input: {
  progressPct: number;
  done: boolean;
  remainingMs: number;
}): number {
  const pct = Math.max(0, Math.min(100, Math.floor(input.progressPct)));
  const base = pct * PROGRESS_POINTS;
  if (!input.done || !Number.isFinite(input.remainingMs) || input.remainingMs <= 0) return base;
  return base + Math.floor(input.remainingMs / FINISH_BONUS_MS_PER_POINT);
}

/** Inverse of the score scale: recover a progress bar percentage from a score. */
export function progressPctFromScore(score: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  return Math.min(100, Math.floor(score / PROGRESS_POINTS));
}
