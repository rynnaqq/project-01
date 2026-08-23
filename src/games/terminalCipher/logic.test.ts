import { describe, expect, it } from 'vitest';
import {
  GRID_CELLS,
  POINTS_PER_STEP,
  ROUND_MS,
  START_LENGTH,
  STEP_FLASH_MS,
  extendSequence,
  generateSequence,
  hashSeed,
  isMyTurn,
  makeRng,
  playbackMs,
  playbackStep,
  pointsForRound,
  roundAt,
  roundRemainingMs,
  scoreForRounds,
  sequenceForRound,
  sequenceLength,
  turnPlayerId,
  validateInput,
} from './logic';

describe('rng', () => {
  it('hashes deterministically and differs per input', () => {
    expect(hashSeed('match-1#0')).toBe(hashSeed('match-1#0'));
    expect(hashSeed('match-1#0')).not.toBe(hashSeed('match-1#1'));
  });

  it('produces a reproducible stream in [0,1)', () => {
    const a = makeRng(1234);
    const b = makeRng(1234);
    for (let i = 0; i < 50; i += 1) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('sequenceLength', () => {
  it('grows one step per round', () => {
    expect(sequenceLength(0)).toBe(START_LENGTH);
    expect(sequenceLength(3)).toBe(START_LENGTH + 3);
    expect(sequenceLength(-2)).toBe(START_LENGTH);
  });
});

describe('generateSequence', () => {
  it('returns the requested length within grid bounds', () => {
    const seq = generateSequence(8, makeRng(99));
    expect(seq).toHaveLength(8);
    for (const cell of seq) {
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(cell).toBeLessThan(GRID_CELLS);
      expect(Number.isInteger(cell)).toBe(true);
    }
  });

  it('never repeats the same cell twice in a row', () => {
    for (let seed = 0; seed < 25; seed += 1) {
      const seq = generateSequence(12, makeRng(seed));
      for (let i = 1; i < seq.length; i += 1) {
        expect(seq[i]).not.toBe(seq[i - 1]);
      }
    }
  });

  it('terminates and alternates with a degenerate rand', () => {
    expect(generateSequence(4, () => 0)).toEqual([0, 1, 0, 1]);
  });

  it('handles zero/negative lengths', () => {
    expect(generateSequence(0, makeRng(1))).toEqual([]);
    expect(generateSequence(-5, makeRng(1))).toEqual([]);
  });
});

describe('sequenceForRound', () => {
  it('is identical for the same match + round (cross-client agreement)', () => {
    expect(sequenceForRound('match-abc', 2)).toEqual(sequenceForRound('match-abc', 2));
  });

  it('differs across rounds and across matches', () => {
    expect(sequenceForRound('match-abc', 0)).not.toEqual(sequenceForRound('match-abc', 1));
    expect(sequenceForRound('match-abc', 0)).not.toEqual(sequenceForRound('match-xyz', 0));
  });

  it('grows with the round and tolerates a null matchId', () => {
    expect(sequenceForRound(null, 0)).toHaveLength(START_LENGTH);
    expect(sequenceForRound(null, 4)).toHaveLength(START_LENGTH + 4);
  });

  it('caps the ramp when maxLength is given (versus turn windows)', () => {
    expect(sequenceForRound('match-abc', 20)).toHaveLength(23); // uncapped
    expect(sequenceForRound('match-abc', 20, { maxLength: 7 })).toHaveLength(7);
    // Same seed ⇒ capped sequences stay identical across clients.
    expect(sequenceForRound('match-abc', 20, { maxLength: 7 })).toEqual(
      sequenceForRound('match-abc', 20, { maxLength: 7 }),
    );
  });
});

describe('extendSequence', () => {
  it('appends exactly one non-repeating step', () => {
    const base = [4, 1];
    const next = extendSequence(base, makeRng(5));
    expect(next).toHaveLength(3);
    expect(next.slice(0, 2)).toEqual(base);
    expect(next[2]).not.toBe(1);
    expect(base).toHaveLength(2); // input not mutated
  });
});

describe('validateInput', () => {
  const seq = [2, 5, 0];

  it('reports partial progress', () => {
    expect(validateInput(seq, [])).toBe('partial');
    expect(validateInput(seq, [2])).toBe('partial');
    expect(validateInput(seq, [2, 5])).toBe('partial');
  });

  it('reports completion only on a full match', () => {
    expect(validateInput(seq, [2, 5, 0])).toBe('complete');
  });

  it('reports a mismatch at the first wrong tap and on overlong input', () => {
    expect(validateInput(seq, [3])).toBe('wrong');
    expect(validateInput(seq, [2, 0])).toBe('wrong');
    expect(validateInput(seq, [2, 5, 0, 1])).toBe('wrong');
  });

  it('treats an empty target as not completable', () => {
    expect(validateInput([], [])).toBe('partial');
  });
});

describe('scoring', () => {
  it('pays per recalled step', () => {
    expect(pointsForRound(0)).toBe(START_LENGTH * POINTS_PER_STEP);
    expect(pointsForRound(2)).toBe((START_LENGTH + 2) * POINTS_PER_STEP);
  });

  it('accumulates cleared rounds', () => {
    expect(scoreForRounds(0)).toBe(0);
    expect(scoreForRounds(1)).toBe(pointsForRound(0));
    expect(scoreForRounds(3)).toBe(pointsForRound(0) + pointsForRound(1) + pointsForRound(2));
    expect(scoreForRounds(-3)).toBe(0);
  });
});

describe('turn-based rounds', () => {
  it('slices the match clock into rounds', () => {
    expect(roundAt(0)).toBe(0);
    expect(roundAt(ROUND_MS - 1)).toBe(0);
    expect(roundAt(ROUND_MS)).toBe(1);
    expect(roundAt(ROUND_MS * 3.5)).toBe(3);
    expect(roundAt(-100)).toBe(0);
  });

  it('reports time left in the current round', () => {
    expect(roundRemainingMs(0)).toBe(ROUND_MS);
    expect(roundRemainingMs(ROUND_MS - 1000)).toBe(1000);
    expect(roundRemainingMs(ROUND_MS + 500)).toBe(ROUND_MS - 500);
  });

  it('alternates turns round-robin over a stable roster', () => {
    const players = ['a', 'b', 'c'];
    expect(turnPlayerId(players, 0)).toBe('a');
    expect(turnPlayerId(players, 1)).toBe('b');
    expect(turnPlayerId(players, 2)).toBe('c');
    expect(turnPlayerId(players, 3)).toBe('a');
    expect(turnPlayerId([], 2)).toBeNull();
  });

  it('agrees on whose turn it is from any client', () => {
    const players = ['p1', 'p2'];
    const round = roundAt(ROUND_MS * 5 + 10);
    expect(isMyTurn(players, round, 'p2')).toBe(true);
    expect(isMyTurn(players, round, 'p1')).toBe(false);
  });
});

describe('playback', () => {
  it('computes total playback time', () => {
    expect(playbackMs(4)).toBe(4 * STEP_FLASH_MS);
    expect(playbackMs(0)).toBe(0);
  });

  it('lights one step at a time then finishes', () => {
    expect(playbackStep(0, 3)).toBe(0);
    expect(playbackStep(STEP_FLASH_MS, 3)).toBe(1);
    expect(playbackStep(STEP_FLASH_MS * 2.9, 3)).toBe(2);
    expect(playbackStep(STEP_FLASH_MS * 3, 3)).toBeNull();
    expect(playbackStep(-5, 3)).toBeNull();
  });
});
