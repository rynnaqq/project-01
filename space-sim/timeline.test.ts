// space-sim/timeline.test.ts
import { describe, expect, it } from 'vitest';
import { SHOTS, TOTAL_S, shotAt, tickAt, easeInOut, clamp01 } from './timeline';

describe('timeline', () => {
  it('covers the six shots in order', () => {
    expect(SHOTS.map((s) => s.name)).toEqual([
      'pad', 'ignition', 'tracker', 'onboard', 'orbit', 'dock',
    ]);
  });

  it('has no gaps or overlaps between shots', () => {
    for (let i = 1; i < SHOTS.length; i += 1) {
      expect(SHOTS[i].start).toBe(SHOTS[i - 1].start + SHOTS[i - 1].dur);
    }
    expect(TOTAL_S).toBe(SHOTS[SHOTS.length - 1].start + SHOTS[SHOTS.length - 1].dur);
  });

  it('resolves the active shot at boundaries', () => {
    expect(shotAt(0).name).toBe('pad');
    expect(shotAt(11.9).name).toBe('pad');
    expect(shotAt(12.0).name).toBe('ignition');
    expect(shotAt(TOTAL_S - 0.01).name).toBe('dock');
  });

  it('clamps out-of-range times', () => {
    expect(shotAt(-5).name).toBe('pad');
    expect(shotAt(999).name).toBe('dock');
  });

  it('emits a countdown tick each second during the pad shot', () => {
    const ticks: number[] = [];
    for (let t = 0; t < 12; t += 0.05) {
      const n = tickAt(t);
      if (n !== null && !ticks.includes(n)) ticks.push(n);
    }
    expect(ticks).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it('emits the liftoff flash only inside the ignition window', () => {
    // Flash covers [12, 12.5); callers edge-detect to fire it once.
    expect(tickAt(11.99)).not.toBe(0);
    expect(tickAt(12)).toBe(0);
    expect(tickAt(12.4)).toBe(0);
    expect(tickAt(12.6)).toBeNull();
    expect(tickAt(TOTAL_S - 0.01)).toBeNull();
  });

  it('eases monotonically and stays in [0,1]', () => {
    let prev = -Infinity;
    for (let t = 0; t <= 1; t += 0.05) {
      const v = easeInOut(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      prev = v;
    }
    expect(easeInOut(0)).toBeCloseTo(0);
    expect(easeInOut(1)).toBeCloseTo(1);
  });

  it('clamp01 clamps', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(2)).toBe(1);
  });
});
