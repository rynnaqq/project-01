import { describe, expect, it } from 'vitest';
import {
  AI_MS_PER_PROBLEM,
  BASE_POINTS,
  MAX_STREAK_MULTIPLIER,
  WRONG_PENALTY_MS,
  aiScoreAt,
  applyPenalty,
  isCorrect,
  isLockedOut,
  levelFor,
  makeProblem,
  pointsForStreak,
} from './logic';

/** Deterministic `rand` that walks a fixed list of values (then repeats). */
function seq(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
}

/** Small LCG so "many problems" assertions stay reproducible. */
function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('makeProblem', () => {
  it('is deterministic for a given rand sequence', () => {
    const a = makeProblem(seq([0, 0, 0]), 0);
    const b = makeProblem(seq([0, 0, 0]), 0);
    expect(a).toEqual(b);
    expect(a.prompt).toBe('1 + 1');
    expect(a.answer).toBe(2);
  });

  it('orders subtraction so the answer is never negative', () => {
    // op index 1 of ['+','-'] => '-', then a=1, b=10 => swapped.
    const p = makeProblem(seq([0.6, 0, 0.9]), 0);
    expect(p.op).toBe('-');
    expect(p.a).toBe(10);
    expect(p.b).toBe(1);
    expect(p.answer).toBe(9);
  });

  it('never produces a negative answer across many draws', () => {
    const rand = lcg(42);
    for (let level = 0; level <= 4; level += 1) {
      for (let i = 0; i < 200; i += 1) {
        const p = makeProblem(rand, level);
        expect(p.answer).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(p.answer)).toBe(true);
      }
    }
  });

  it('only uses + and - at level 0 and unlocks × later', () => {
    const rand = lcg(7);
    const easy = new Set<string>();
    for (let i = 0; i < 100; i += 1) easy.add(makeProblem(rand, 0).op);
    expect(easy.has('*')).toBe(false);

    const hard = new Set<string>();
    for (let i = 0; i < 100; i += 1) hard.add(makeProblem(rand, 3).op);
    expect(hard.has('*')).toBe(true);
  });

  it('scales operand size with level', () => {
    const low = makeProblem(seq([0, 0.999, 0.999]), 0); // '+' with max operands
    const high = makeProblem(seq([0, 0.999, 0.999]), 4);
    expect(high.answer).toBeGreaterThan(low.answer);
  });

  it('clamps out-of-range levels instead of throwing', () => {
    expect(() => makeProblem(seq([0.5, 0.5, 0.5]), -3)).not.toThrow();
    expect(() => makeProblem(seq([0.5, 0.5, 0.5]), 99)).not.toThrow();
  });
});

describe('levelFor', () => {
  it('advances every five solved problems and caps at 4', () => {
    expect(levelFor(0)).toBe(0);
    expect(levelFor(4)).toBe(0);
    expect(levelFor(5)).toBe(1);
    expect(levelFor(19)).toBe(3);
    expect(levelFor(500)).toBe(4);
    expect(levelFor(-1)).toBe(0);
  });
});

describe('isCorrect', () => {
  const problem = makeProblem(seq([0, 0.5, 0.5]), 0);

  it('accepts the exact answer as a number or a string', () => {
    expect(isCorrect(problem, problem.answer)).toBe(true);
    expect(isCorrect(problem, String(problem.answer))).toBe(true);
    expect(isCorrect(problem, `  ${problem.answer}  `)).toBe(true);
    expect(isCorrect(problem, `+${problem.answer}`)).toBe(true);
  });

  it('rejects wrong, empty and malformed input', () => {
    expect(isCorrect(problem, problem.answer + 1)).toBe(false);
    expect(isCorrect(problem, '')).toBe(false);
    expect(isCorrect(problem, '   ')).toBe(false);
    expect(isCorrect(problem, '12abc')).toBe(false);
    expect(isCorrect(problem, 'NaN')).toBe(false);
    expect(isCorrect(problem, Number.NaN)).toBe(false);
  });
});

describe('pointsForStreak', () => {
  it('multiplies by the streak up to the cap', () => {
    expect(pointsForStreak(1)).toBe(BASE_POINTS);
    expect(pointsForStreak(3)).toBe(BASE_POINTS * 3);
    expect(pointsForStreak(50)).toBe(BASE_POINTS * MAX_STREAK_MULTIPLIER);
  });

  it('treats a zero/negative streak as the first correct answer', () => {
    expect(pointsForStreak(0)).toBe(BASE_POINTS);
    expect(pointsForStreak(-4)).toBe(BASE_POINTS);
  });
});

describe('penalty', () => {
  it('locks input out for the penalty window', () => {
    const until = applyPenalty(1000);
    expect(until).toBe(1000 + WRONG_PENALTY_MS);
    expect(isLockedOut(until, 1000)).toBe(true);
    expect(isLockedOut(until, until - 1)).toBe(true);
    expect(isLockedOut(until, until)).toBe(false);
    expect(isLockedOut(null, 999_999)).toBe(false);
  });
});

describe('aiScoreAt', () => {
  it('accrues one benchmark solve per interval', () => {
    expect(aiScoreAt(0)).toBe(0);
    expect(aiScoreAt(AI_MS_PER_PROBLEM - 1)).toBe(0);
    expect(aiScoreAt(AI_MS_PER_PROBLEM)).toBe(BASE_POINTS);
    expect(aiScoreAt(AI_MS_PER_PROBLEM * 4.5)).toBe(BASE_POINTS * 4);
  });

  it('is safe with degenerate inputs', () => {
    expect(aiScoreAt(-500)).toBe(0);
    expect(aiScoreAt(Number.NaN)).toBe(0);
    expect(aiScoreAt(5000, 0)).toBe(0);
  });
});
