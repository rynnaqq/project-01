// space-sim/state.ts
/**
 * Mission state machine + telemetry store + analytics stub.
 * The HUD reads `state`; it never computes physics itself (PRD §D.16).
 */
import { THRUST } from './config';

export enum MissionPhase {
  Loading, Briefing, Ascent, Orbit, Approach, Docking, Complete, Failed,
}

export interface MissionState {
  phase: MissionPhase;
  paused: boolean;
  altitudeKm: number;
  speedMps: number;
  relativeVelocityMps: number;
  fuel: number;
  oxygen: number; // 0..100
  distanceToISSm: number;
  alignmentDeg: number;
  missionTimeS: number;
}

/** PRD §I analytics event names for phase transitions. */
export function phaseEventName(p: MissionPhase): string | null {
  switch (p) {
    case MissionPhase.Ascent: return 'phase_ascent_start';
    case MissionPhase.Orbit: return 'phase_orbit_start';
    case MissionPhase.Approach: return 'phase_approach_start';
    case MissionPhase.Docking: return 'phase_docking_start';
    case MissionPhase.Complete: return 'mission_completed';
    case MissionPhase.Failed: return 'mission_failed';
    default: return null;
  }
}

/** Console analytics stub (PRD §I); swap for a real backend later. */
export function track(event: string, props: Record<string, unknown> = {}): void {
  // eslint-disable-next-line no-console
  console.info(`[analytics] ${event}`, props);
}

type Listener<T> = (payload: T) => void;

const freshState = (): MissionState => ({
  phase: MissionPhase.Loading,
  paused: false,
  altitudeKm: 0,
  speedMps: 0,
  relativeVelocityMps: 0,
  fuel: THRUST.fuelCapacity,
  oxygen: 100,
  distanceToISSm: 0,
  alignmentDeg: 0,
  missionTimeS: 0,
});

export class Mission {
  state: MissionState = freshState();
  private listeners = new Map<string, Set<Listener<never>>>();

  on<T>(event: string, fn: Listener<T>): () => void {
    let set = this.listeners.get(event);
    if (!set) { set = new Set(); this.listeners.set(event, set); }
    set.add(fn as Listener<never>);
    return () => { set!.delete(fn as Listener<never>); };
  }

  private emit<T>(event: string, payload: T): void {
    this.listeners.get(event)?.forEach((fn) => (fn as Listener<T>)(payload));
  }

  setPhase(p: MissionPhase): void {
    if (p === this.state.phase) return;
    this.state.phase = p;
    this.emit('phase', p);
    const name = phaseEventName(p);
    if (name) track(name, { missionTime: Math.round(this.state.missionTimeS) });
  }

  setPaused(paused: boolean): void {
    if (paused === this.state.paused) return;
    this.state.paused = paused;
    this.emit(paused ? 'pause' : 'resume', undefined);
    track(paused ? 'mission_paused' : 'mission_resumed');
  }

  update(partial: Partial<MissionState>): void {
    Object.assign(this.state, partial);
  }

  reset(): void {
    this.state = freshState();
    this.emit('reset', undefined);
  }
}
