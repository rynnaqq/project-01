import { describe, expect, it } from 'vitest';
import {
  FINISH_BONUS_MS_PER_POINT,
  PASSAGES,
  PROGRESS_POINTS,
  computeProgress,
  correctPrefixLength,
  nextChar,
  passageFor,
  progressPctFromScore,
  raceScore,
  wpm,
} from './logic';

const target = 'race the clock';

describe('passageFor', () => {
  it('is stable per match so all racers share one passage', () => {
    expect(passageFor('match-1')).toBe(passageFor('match-1'));
    expect(PASSAGES).toContain(passageFor('match-1'));
  });

  it('varies across matches and tolerates a null id', () => {
    const picks = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => passageFor(id)));
    expect(picks.size).toBeGreaterThan(1);
    expect(PASSAGES).toContain(passageFor(null));
  });

  it('only ships typeable ASCII passages', () => {
    for (const passage of PASSAGES) {
      expect(passage.length).toBeGreaterThan(40);
      expect(/^[ -~]+$/.test(passage)).toBe(true);
    }
  });
});

describe('correctPrefixLength', () => {
  it('counts the matching prefix only', () => {
    expect(correctPrefixLength(target, '')).toBe(0);
    expect(correctPrefixLength(target, 'race')).toBe(4);
    expect(correctPrefixLength(target, 'rack')).toBe(3);
    expect(correctPrefixLength(target, target)).toBe(target.length);
    expect(correctPrefixLength(target, `${target} extra`)).toBe(target.length);
  });
});

describe('computeProgress', () => {
  it('is empty at the start', () => {
    const p = computeProgress(target, '');
    expect(p).toEqual({
      correctChars: 0,
      errorChars: 0,
      progressPct: 0,
      accuracyPct: 100,
      done: false,
    });
  });

  it('tracks a clean partial run', () => {
    const p = computeProgress(target, 'race ');
    expect(p.correctChars).toBe(5);
    expect(p.errorChars).toBe(0);
    expect(p.progressPct).toBe(Math.floor((5 / target.length) * 100));
    expect(p.accuracyPct).toBe(100);
    expect(p.done).toBe(false);
  });

  it('stops progress at the first mistake and reports accuracy', () => {
    const p = computeProgress(target, 'racq');
    expect(p.correctChars).toBe(3);
    expect(p.errorChars).toBe(1);
    expect(p.accuracyPct).toBe(75);
    expect(p.done).toBe(false);
  });

  it('completes only on an exact full match', () => {
    expect(computeProgress(target, target).done).toBe(true);
    expect(computeProgress(target, target).progressPct).toBe(100);
    expect(computeProgress(target, `${target}!`).done).toBe(false);
  });

  it('never exceeds 100% and handles an empty passage', () => {
    expect(computeProgress(target, `${target}xxxx`).progressPct).toBe(100);
    expect(computeProgress('', 'abc').progressPct).toBe(0);
  });
});

describe('nextChar', () => {
  it('points at the next required character', () => {
    expect(nextChar(target, '')).toBe('r');
    expect(nextChar(target, 'race')).toBe(' ');
    expect(nextChar(target, 'racq')).toBe('e');
    expect(nextChar(target, target)).toBeNull();
  });
});

describe('wpm', () => {
  it('uses five characters per word', () => {
    expect(wpm(300, 60_000)).toBe(60);
    expect(wpm(150, 30_000)).toBe(60);
  });

  it('is zero for degenerate input', () => {
    expect(wpm(0, 10_000)).toBe(0);
    expect(wpm(100, 0)).toBe(0);
    expect(wpm(100, Number.NaN)).toBe(0);
  });
});

describe('raceScore', () => {
  it('scales progress', () => {
    expect(raceScore({ progressPct: 0, done: false, remainingMs: 5000 })).toBe(0);
    expect(raceScore({ progressPct: 42, done: false, remainingMs: 5000 })).toBe(42 * PROGRESS_POINTS);
  });

  it('adds a finish bonus that rewards finishing earlier', () => {
    const early = raceScore({ progressPct: 100, done: true, remainingMs: 20_000 });
    const late = raceScore({ progressPct: 100, done: true, remainingMs: 4000 });
    expect(early).toBeGreaterThan(late);
    expect(late).toBe(100 * PROGRESS_POINTS + 4000 / FINISH_BONUS_MS_PER_POINT);
  });

  it('clamps out-of-range progress and ignores negative time', () => {
    expect(raceScore({ progressPct: 300, done: false, remainingMs: 0 })).toBe(100 * PROGRESS_POINTS);
    expect(raceScore({ progressPct: -20, done: false, remainingMs: 0 })).toBe(0);
    expect(raceScore({ progressPct: 100, done: true, remainingMs: -50 })).toBe(100 * PROGRESS_POINTS);
  });
});

describe('progressPctFromScore', () => {
  it('recovers the progress bar percentage', () => {
    expect(progressPctFromScore(0)).toBe(0);
    expect(progressPctFromScore(420)).toBe(42);
    expect(progressPctFromScore(raceScore({ progressPct: 100, done: true, remainingMs: 9000 }))).toBe(
      100,
    );
    expect(progressPctFromScore(-10)).toBe(0);
  });
});
