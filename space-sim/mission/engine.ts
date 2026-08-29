// space-sim/mission/engine.ts
export {
  MISSION_STATES,
  type Command, type CommandKind, type CommsLine, type FxCommand,
  type HudChange, type MissionEvent, type MissionState,
} from "./types";

import { MISSION_STATES, type MissionEvent, type MissionState } from "./types";

export interface MissionSinks {
  onCommand?(c: { kind: string }, t: number): void;
  onComms?(c: { speaker: string; text: string; style: string }, t: number): void;
  onHud?(h: { phase?: string; telemetry?: string; progressStage?: number; countdown?: boolean; met?: boolean }, t: number): void;
  onFx?(f: { smoke?: number; exposure?: number; shake?: number; glare?: number }, t: number): void;
  onShot?(shot: string, duration: number, t: number): void;
  onTransition?(kind: "cut" | "dip" | "crossfade", t: number): void;
  onState?(prev: MissionState, next: MissionState, t: number): void;
}

export class MissionClock {
  paused = false;
  private _t = 0;
  get t(): number { return this._t; }
  tick(dt: number): void { if (!this.paused) this._t += dt; }
  reset(): void { this._t = 0; }
}

export class MissionEngine {
  stateDurations: Partial<Record<MissionState, number>> = {};
  current: MissionState = MISSION_STATES[0];
  private clock = new MissionClock();
  private pending = new Map<string, MissionEvent>(); // consumed events removed by id
  private script: MissionEvent[];
  private sinks: MissionSinks;
  private stateStart = 0;

  constructor(script: MissionEvent[], sinks: MissionSinks) {
    this.script = [...script];
    this.sinks = sinks;
    this.refill();
  }

  get t(): number { return this.clock.t; }
  get paused(): boolean { return this.clock.paused; }
  set paused(v: boolean) { this.clock.paused = v; }

  private durationOf(s: MissionState): number {
    const d = this.stateDurations[s];
    if (d !== undefined) return d;
    if (s === "ISS_EXPLORATION") return Number.POSITIVE_INFINITY;
    if (s === "PLAYER_CONTROL_ENABLED") return 0;
    return 10;
  }

  /** Events for the current state, ordered by `at`. */
  private refill(): void {
    this.pending.clear();
    for (const ev of this.script) {
      if (ev.state === this.current) this.pending.set(ev.id, ev);
    }
  }

  update(dt: number): void {
    this.clock.tick(dt);
    for (let guard = 0; guard < 10000; guard++) {
      const fired = this.fireDue();
      const advanced = this.advanceStates();
      if (!fired && !advanced) break;
    }
  }

  private fireDue(): boolean {
    let any = false;
    for (const [id, ev] of this.pending) {
      if (this.clock.t - this.stateStart >= ev.at - 1e-9) {
        this.dispatch(ev, this.clock.t);
        this.pending.delete(id);
        any = true;
      } else break; // pending is state-ordered; first not-due ends scan
    }
    return any;
  }

  private advanceStates(): boolean {
    const dur = this.durationOf(this.current);
    if (!Number.isFinite(dur)) return false;
    if (this.clock.t - this.stateStart < dur - 1e-9) return false;
    const idx = MISSION_STATES.indexOf(this.current);
    const next = MISSION_STATES[Math.min(idx + 1, MISSION_STATES.length - 1)];
    const prev = this.current;
    this.current = next;
    this.stateStart = this.clock.t;
    this.refill();
    this.sinks.onState?.(prev, next, this.clock.t);
    return true;
  }

  private dispatch(ev: MissionEvent, now: number): void {
    if (ev.transition) this.sinks.onTransition?.(ev.transition, now);
    if (ev.shot) this.sinks.onShot?.(ev.shot, ev.duration ?? 6, now);
    if (ev.action) this.sinks.onCommand?.(ev.action, now);
    if (ev.comms) this.sinks.onComms?.(ev.comms, now);
    if (ev.hud) this.sinks.onHud?.(ev.hud, now);
    if (ev.fx) this.sinks.onFx?.(ev.fx, now);
  }

  restart(): void {
    this.clock.reset();
    this.current = MISSION_STATES[0];
    this.stateStart = 0;
    this.refill();
  }

  /** Skip system: fast-forward to a state, firing only actions/hud/fx (no shots/comms). */
  seekToState(state: MissionState): void {
    const targetIdx = MISSION_STATES.indexOf(state);
    let idx = MISSION_STATES.indexOf(this.current);
    while (idx < targetIdx) {
      for (const ev of this.script) {
        if (ev.state === MISSION_STATES[idx]) {
          if (ev.action) this.sinks.onCommand?.(ev.action, this.clock.t);
          if (ev.hud) this.sinks.onHud?.(ev.hud, this.clock.t);
          if (ev.fx) this.sinks.onFx?.(ev.fx, this.clock.t);
        }
      }
      idx++;
    }
    this.current = state;
    this.stateStart = this.clock.t;
    this.refill();
    this.sinks.onState?.(MISSION_STATES[Math.max(0, idx - 1)], state, this.clock.t);
  }
}
