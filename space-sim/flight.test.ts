// space-sim/flight.test.ts
import { describe, expect, it } from 'vitest';
import { applyDamping, ascentStep, brakeVelocity, burnFuel } from './flight';

describe('applyDamping', () => {
  it('scales velocity toward zero', () => {
    const v = applyDamping({ x: 10, y: 0, z: -4 }, 0.5, 1);
    expect(v.x).toBeCloseTo(5);
    expect(v.z).toBeCloseTo(-2);
  });
  it('never flips sign on huge dt', () => {
    const v = applyDamping({ x: 1, y: 2, z: 3 }, 10, 5);
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
    expect(v.z).toBe(0);
  });
});

describe('brakeVelocity', () => {
  it('reduces each axis by brakeAccel*dt toward zero', () => {
    const v = brakeVelocity({ x: 3, y: -1, z: 0 }, 2, 1);
    expect(v.x).toBeCloseTo(1);
    expect(v.y).toBe(0); // |-1| <= 2*1, so the axis clamps to zero
    expect(v.z).toBe(0);
  });
  it('clamps at zero instead of overshooting', () => {
    const v = brakeVelocity({ x: 1, y: -0.5, z: 0.2 }, 2, 1);
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
    expect(v.z).toBe(0);
  });
});

describe('burnFuel', () => {
  it('consumes proportionally to thrust magnitude', () => {
    expect(burnFuel(100, 1, 1, 1)).toBeCloseTo(99);
    expect(burnFuel(100, 0.5, 2, 1)).toBeCloseTo(99);
  });
  it('does not consume at zero thrust and never goes negative', () => {
    expect(burnFuel(100, 0, 1, 10)).toBe(100);
    expect(burnFuel(0.4, 1, 1, 1)).toBe(0);
  });
});

describe('ascentStep', () => {
  it('climbs when thrust exceeds gravity (clamped at maxVy)', () => {
    const s = ascentStep(30, 0, 1, 9.8, 26, 14, 1);
    expect(s.vy).toBe(14); // 26 - 9.8 = 16.2, clamped to maxVy 14
    expect(s.y).toBeCloseTo(44);
  });
  it('falls back with no thrust', () => {
    const s = ascentStep(40, 5, 0, 9.8, 26, 14, 1);
    expect(s.vy).toBeCloseTo(-4.8);
  });
  it('clamps vertical speed at maxVy', () => {
    const s = ascentStep(30, 13.9, 1, 9.8, 26, 14, 1);
    expect(s.vy).toBe(14);
  });
});
