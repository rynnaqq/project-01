// space-sim/state.test.ts
import { describe, expect, it, vi } from 'vitest';
import { Mission, MissionPhase, phaseEventName } from './state';

describe('phaseEventName', () => {
  it('maps phases to PRD §I analytics names', () => {
    expect(phaseEventName(MissionPhase.Ascent)).toBe('phase_ascent_start');
    expect(phaseEventName(MissionPhase.Orbit)).toBe('phase_orbit_start');
    expect(phaseEventName(MissionPhase.Approach)).toBe('phase_approach_start');
    expect(phaseEventName(MissionPhase.Docking)).toBe('phase_docking_start');
    expect(phaseEventName(MissionPhase.Complete)).toBe('mission_completed');
    expect(phaseEventName(MissionPhase.Failed)).toBe('mission_failed');
  });
});

describe('Mission state machine', () => {
  it('starts in Loading with full fuel and oxygen', () => {
    const m = new Mission();
    expect(m.state.phase).toBe(MissionPhase.Loading);
    expect(m.state.fuel).toBe(100);
    expect(m.state.oxygen).toBe(100);
    expect(m.state.paused).toBe(false);
  });

  it('emits and tracks a phase change exactly once', () => {
    const m = new Mission();
    const onPhase = vi.fn();
    m.on('phase', onPhase);
    m.setPhase(MissionPhase.Ascent);
    expect(m.state.phase).toBe(MissionPhase.Ascent);
    expect(onPhase).toHaveBeenCalledTimes(1);
    expect(onPhase).toHaveBeenCalledWith(MissionPhase.Ascent);
    // no-op when unchanged
    m.setPhase(MissionPhase.Ascent);
    expect(onPhase).toHaveBeenCalledTimes(1);
  });

  it('toggles pause without changing phase', () => {
    const m = new Mission();
    m.setPhase(MissionPhase.Orbit);
    m.setPaused(true);
    expect(m.state.paused).toBe(true);
    expect(m.state.phase).toBe(MissionPhase.Orbit);
    m.setPaused(false);
    expect(m.state.paused).toBe(false);
  });

  it('update() merges telemetry fields', () => {
    const m = new Mission();
    m.update({ altitudeKm: 123.4, fuel: 42 });
    expect(m.state.altitudeKm).toBe(123.4);
    expect(m.state.fuel).toBe(42);
  });

  it('reset() returns to a fresh state', () => {
    const m = new Mission();
    m.setPhase(MissionPhase.Failed);
    m.update({ fuel: 3 });
    m.reset();
    expect(m.state.phase).toBe(MissionPhase.Loading);
    expect(m.state.fuel).toBe(100);
  });
});
