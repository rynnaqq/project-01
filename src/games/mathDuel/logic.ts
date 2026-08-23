/**
 * Pure logic for Quick Math Duel (P5.1).
 *
 * Everything here is deterministic given an injected `rand`, so the whole game
 * can be unit-tested without a DOM, a clock, or a database.
 */

export type Operator = '+' | '-' | '*';

export type Problem = {
  a: number;
  b: number;
  op: Operator;
  answer: number;
  /** Human-readable prompt, e.g. `7 × 8`. */
  prompt: string;
};

/** Points awarded for a single correct answer at streak 1. */
export const BASE_POINTS = 10;
/** Streak multiplier is capped here so a long run cannot run away. */
export const MAX_STREAK_MULTIPLIER = 5;
/** Time penalty (input lockout) applied after a wrong answer. */
export const WRONG_PENALTY_MS = 1500;
/** Solo benchmark: how long the "AI" takes per problem. */
export const AI_MS_PER_PROBLEM = 3800;

const OPERATOR_SYMBOL: Record<Operator, string> = { '+': '+', '-': '−', '*': '×' };

/** Difficulty tier derived from how many problems the player has solved. */
export function levelFor(solved: number): number {
  if (solved < 0 || !Number.isFinite(solved)) return 0;
  return Math.min(4, Math.floor(solved / 5));
}

function pick<T>(rand: () => number, items: T[]): T {
  const index = Math.min(items.length - 1, Math.floor(rand() * items.length));
  return items[index];
}

function intBetween(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

/**
 * Build a problem for the given difficulty level. `rand` must return [0,1).
 * Subtraction is always ordered so the answer is non-negative.
 */
export function makeProblem(rand: () => number = Math.random, level = 0): Problem {
  const tier = Math.max(0, Math.min(4, Math.floor(level)));
  const operators: Operator[] = tier === 0 ? ['+', '-'] : ['+', '-', '*'];
  const op = pick(rand, operators);

  let a: number;
  let b: number;
  if (op === '*') {
    a = intBetween(rand, 2, 4 + tier * 2);
    b = intBetween(rand, 2, 4 + tier * 2);
  } else {
    const max = 10 + tier * 15;
    a = intBetween(rand, 1, max);
    b = intBetween(rand, 1, max);
    if (op === '-' && b > a) {
      [a, b] = [b, a];
    }
  }

  const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
  return { a, b, op, answer, prompt: `${a} ${OPERATOR_SYMBOL[op]} ${b}` };
}

/**
 * Check a raw player input against a problem. Accepts surrounding whitespace
 * and a leading `+`; rejects empty or non-numeric input.
 */
export function isCorrect(problem: Problem, guess: string | number): boolean {
  if (typeof guess === 'number') {
    return Number.isFinite(guess) && guess === problem.answer;
  }
  const trimmed = guess.trim();
  if (trimmed === '' || !/^[+-]?\d+$/.test(trimmed)) return false;
  return Number.parseInt(trimmed, 10) === problem.answer;
}

/** Points for a correct answer at the given streak (1 = first correct). */
export function pointsForStreak(streak: number): number {
  const safe = Math.max(1, Math.floor(streak) || 1);
  return BASE_POINTS * Math.min(MAX_STREAK_MULTIPLIER, safe);
}

/** Timestamp until which input stays locked after a wrong answer. */
export function applyPenalty(now: number, penaltyMs: number = WRONG_PENALTY_MS): number {
  return now + penaltyMs;
}

/** Whether the player is currently serving a wrong-answer penalty. */
export function isLockedOut(lockedUntil: number | null, now: number): boolean {
  return lockedUntil != null && now < lockedUntil;
}

/**
 * Solo benchmark score at a point in the match: a steady opponent that solves
 * one problem every `msPerProblem` with no streak bonus.
 */
export function aiScoreAt(elapsedMs: number, msPerProblem: number = AI_MS_PER_PROBLEM): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0 || msPerProblem <= 0) return 0;
  return Math.floor(elapsedMs / msPerProblem) * BASE_POINTS;
}
