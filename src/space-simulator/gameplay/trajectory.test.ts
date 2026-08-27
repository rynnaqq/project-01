import { describe, expect, it } from 'vitest';
import {
  ASCENT_DURATION_S,
  SEPARATION_TIME_S,
  sampleAscent,
} from './trajectory';

describe('sampleAscent', () => {
  it('starts on the pad', () => {
    const s = sampleAscent(0);
    expect(s.altitudeM).toBe(0);
    expect(s.speedMs).toBe(0);
    expect(s.pitchDeg).toBe(90);
    expect(s.stage).toBe(1);
  });

  it('climbs monotonically', () => {
    let prev = 0;
    for (let t = 0; t <= ASCENT_DURATION_S; t += 0.5) {
      const alt = sampleAscent(t).altitudeM;
      expect(alt).toBeGreaterThanOrEqual(prev);
      prev = alt;
    }
  });

  it('matches the velocity and altitude profile at burnout', () => {
    const s = sampleAscent(ASCENT_DURATION_S);
    expect(s.altitudeM).toBeCloseTo(129_000, 0);
    expect(s.speedMs).toBeCloseTo(7_800, 0);
  });

  it('pitches over smoothly and never goes negative', () => {
    let prev = 91;
    for (let t = 0; t <= ASCENT_DURATION_S; t += 0.5) {
      const p = sampleAscent(t).pitchDeg;
      expect(p).toBeLessThanOrEqual(prev);
      expect(p).toBeGreaterThanOrEqual(0);
      prev = p;
    }
  });

  it('separates the first stage at the separation event', () => {
    expect(sampleAscent(SEPARATION_TIME_S - 0.1).stage).toBe(1);
    expect(sampleAscent(SEPARATION_TIME_S + 0.1).stage).toBe(2);
  });

  it('holds the final state beyond burnout', () => {
    expect(sampleAscent(ASCENT_DURATION_S + 999)).toEqual(
      sampleAscent(ASCENT_DURATION_S),
    );
  });

  it('is deterministic', () => {
    expect(sampleAscent(17.3)).toEqual(sampleAscent(17.3));
  });
});
