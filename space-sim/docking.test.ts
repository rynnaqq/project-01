// space-sim/docking.test.ts
import { describe, expect, it } from 'vitest';
import {
  alignmentPct, approachState, canDock, dockingAccuracy, rating, type DockInput,
} from './docking';

const perfect: DockInput = { distanceM: 1, relSpeedMps: 0.1, alignmentDeg: 1, inCorridor: true };

describe('canDock', () => {
  it('passes when all criteria are inside thresholds', () => {
    expect(canDock(perfect)).toBe(true);
  });
  it('fails when any single criterion is out of bounds', () => {
    expect(canDock({ ...perfect, distanceM: 6 })).toBe(false);
    expect(canDock({ ...perfect, relSpeedMps: 0.6 })).toBe(false);
    expect(canDock({ ...perfect, alignmentDeg: 6 })).toBe(false);
    expect(canDock({ ...perfect, inCorridor: false })).toBe(false);
  });
  it('treats the threshold values themselves as failing (strict <)', () => {
    expect(canDock({ ...perfect, distanceM: 5 })).toBe(false);
    expect(canDock({ ...perfect, relSpeedMps: 0.5 })).toBe(false);
    expect(canDock({ ...perfect, alignmentDeg: 5 })).toBe(false);
  });
});

describe('approachState', () => {
  it('is DOCKING_READY when canDock', () => {
    expect(approachState(perfect)).toBe('DOCKING_READY');
  });
  it('is CRITICAL when approaching far too fast', () => {
    expect(approachState({ ...perfect, distanceM: 4, relSpeedMps: 3 })).toBe('CRITICAL');
  });
  it('is CAUTION when mildly too fast or misaligned', () => {
    expect(approachState({ ...perfect, relSpeedMps: 0.8, distanceM: 20 })).toBe('CAUTION');
  });
  it('is SAFE when far and slow', () => {
    expect(approachState({ distanceM: 200, relSpeedMps: 0.2, alignmentDeg: 40, inCorridor: false }))
      .toBe('SAFE');
  });
});

describe('alignmentPct', () => {
  it('is 100 when perfectly aligned and 0 at 90°', () => {
    expect(alignmentPct(0)).toBe(100);
    expect(alignmentPct(90)).toBe(0);
    expect(alignmentPct(45)).toBe(50);
  });
});

describe('dockingAccuracy + rating', () => {
  it('scores a perfect dock at 100', () => {
    expect(dockingAccuracy({ distanceM: 0, relSpeedMps: 0, alignmentDeg: 0, inCorridor: true }))
      .toBe(100);
  });
  it('assigns higher ratings to better accuracy/fuel', () => {
    expect(rating(95, 80)).toBe('A');
    expect(rating(60, 40)).toBe('B');
    expect(rating(35, 20)).toBe('C');
    expect(rating(10, 5)).toBe('D');
  });
});
