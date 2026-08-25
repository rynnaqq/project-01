// space-sim/config.test.ts
import { describe, expect, it } from 'vitest';
import {
  ALT, DOCK, METERS_PER_UNIT, displayAltitudeKm, gravityAt,
  metersToUnits, unitsToMeters,
} from './config';

describe('unit conversion', () => {
  it('converts units to meters and back', () => {
    expect(METERS_PER_UNIT).toBe(100);
    expect(unitsToMeters(1)).toBe(100);
    expect(metersToUnits(100)).toBe(1);
    expect(unitsToMeters(metersToUnits(250))).toBeCloseTo(250);
  });
});

describe('displayAltitudeKm', () => {
  it('is 0 at or below the surface', () => {
    expect(displayAltitudeKm(ALT.SURFACE_Y)).toBe(0);
    expect(displayAltitudeKm(ALT.SURFACE_Y - 5)).toBe(0);
  });
  it('reaches orbit display altitude at the orbit threshold', () => {
    expect(displayAltitudeKm(ALT.ORBIT_Y)).toBe(ALT.ORBIT_DISPLAY_KM);
  });
  it('is monotonic and clamped above orbit', () => {
    const mid = displayAltitudeKm((ALT.SURFACE_Y + ALT.ORBIT_Y) / 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(ALT.ORBIT_DISPLAY_KM);
    expect(displayAltitudeKm(ALT.ORBIT_Y + 50)).toBe(ALT.ORBIT_DISPLAY_KM);
  });
  it('crosses the Kármán line partway up', () => {
    // 100 km is a quarter of the 400 km displayed span
    const karmanY = ALT.SURFACE_Y + (ALT.ORBIT_Y - ALT.SURFACE_Y) * (100 / ALT.ORBIT_DISPLAY_KM);
    expect(displayAltitudeKm(karmanY)).toBeCloseTo(100);
  });
});

describe('gravityAt', () => {
  it('is surface gravity at the surface', () => {
    expect(gravityAt(ALT.SURFACE_Y)).toBeCloseTo(9.8);
  });
  it('falls off to near-microgravity by orbit', () => {
    expect(gravityAt(ALT.ORBIT_Y)).toBeLessThan(1);
  });
  it('is monotonic non-increasing with altitude', () => {
    const a = gravityAt(ALT.SURFACE_Y + 5);
    const b = gravityAt(ALT.SURFACE_Y + 15);
    expect(a).toBeGreaterThanOrEqual(b);
  });
});

describe('docking thresholds are sane', () => {
  it('matches PRD §B.10 tuning', () => {
    expect(DOCK.distanceM).toBe(5);
    expect(DOCK.relSpeedMps).toBe(0.5);
    expect(DOCK.alignmentDeg).toBe(5);
  });
});
