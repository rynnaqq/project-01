import { describe, expect, it } from 'vitest';
import { MAX_SCORE, clampScore, computeWinner, rankScores } from './scoreHelpers';

describe('clampScore', () => {
  it('floors fractional scores', () => {
    expect(clampScore(12.9)).toBe(12);
  });
  it('clamps negatives to 0', () => {
    expect(clampScore(-5)).toBe(0);
  });
  it('clamps above the max', () => {
    expect(clampScore(MAX_SCORE + 100)).toBe(MAX_SCORE);
  });
  it('handles NaN/Infinity', () => {
    expect(clampScore(NaN)).toBe(0);
    expect(clampScore(Infinity)).toBe(MAX_SCORE);
  });
});

describe('computeWinner', () => {
  it('returns the highest scorer', () => {
    expect(
      computeWinner([
        { player_id: 'a', score: 3 },
        { player_id: 'b', score: 7 },
      ]),
    ).toBe('b');
  });
  it('returns null on a tie for first', () => {
    expect(
      computeWinner([
        { player_id: 'a', score: 5 },
        { player_id: 'b', score: 5 },
      ]),
    ).toBeNull();
  });
  it('returns null on empty', () => {
    expect(computeWinner([])).toBeNull();
  });
});

describe('rankScores', () => {
  it('sorts descending by score', () => {
    const ranked = rankScores([
      { player_id: 'a', score: 1 },
      { player_id: 'b', score: 9 },
      { player_id: 'c', score: 5 },
    ]);
    expect(ranked.map((r) => r.player_id)).toEqual(['b', 'c', 'a']);
  });
});
