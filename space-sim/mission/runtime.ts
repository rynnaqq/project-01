// space-sim/mission/runtime.ts
import type { Scene } from "@babylonjs/core";
import {
  MissionEngine,
  type CommsLine, type FxCommand, type HudChange, type MissionState,
} from "./engine";
import { MISSION_SCRIPT, STATE_DURATIONS } from "./script";
import type { CinematicDirector } from "../cinema/director";
import type { SkyController } from "../effects/sky";
import type { FlightModel } from "../vehicles/flight";
import type { ExhaustSystem } from "../effects/exhaust";
import type { GroundSmoke } from "../effects/smoke";
import type { MobileLauncher } from "../world/ksc/launcher";

export interface UiSinks {
  onComms(c: CommsLine): void;
  onHud(h: HudChange): void;
  onState(s: MissionState): void;
}

export interface RuntimeDeps {
  scene: Scene;
  director: CinematicDirector;
  sky: SkyController;
  flight: FlightModel;
  exhaust: ExhaustSystem;
  smoke: GroundSmoke;
  ml: MobileLauncher;
  ui: UiSinks;
}

export interface MissionRuntime {
  engine: MissionEngine;
  update(dt: number): void;
  skipTo(state: MissionState): void;
}

export function createMissionRuntime(deps: RuntimeDeps): MissionRuntime {
  let armRetract = -1; // seconds since ignition for the arm animation

  const handleCommand = (c: { kind: string }): void => {
    switch (c.kind) {
      case "ignite":
        deps.exhaust.ignite(true);
        deps.smoke.ramp(1);
        armRetract = 0;
        break;
      case "liftoff":
        deps.flight.liftoff();
        break;
      case "separateSrb":
        deps.flight.separateSrb();
        break;
      case "separateCore":
        deps.flight.separateCore();
        break;
      case "orbitInsertion":
        deps.flight.orbitInsertion();
        break;
      default: // dock*/openHatch/enterInterior/enablePlayer wired in Tasks 14–16
        break;
    }
  };

  const engine = new MissionEngine(MISSION_SCRIPT, {
    onCommand: (c) => handleCommand(c),
    onComms: (c: CommsLine) => deps.ui.onComms(c),
    onHud: (h: HudChange) => deps.ui.onHud(h),
    onFx: (f: FxCommand) => {
      deps.sky.applyFx(f);
      if (f.smoke !== undefined) deps.smoke.ramp(f.smoke);
    },
    onShot: (shot, duration, t) => deps.director.playShot(shot, duration, t),
    onTransition: (kind) => deps.director.cut(kind),
    onState: (_prev, next) => deps.ui.onState(next),
  });
  engine.stateDurations = STATE_DURATIONS;

  const update = (dt: number): void => {
    engine.update(dt);
    // Flight clock: seconds since liftoff (negative before liftoff)
    const tFlight = deps.flight.liftoffTime >= 0 ? engine.t - deps.flight.liftoffTime : -1;
    deps.flight.update(tFlight, dt);
    deps.exhaust.update(dt, deps.flight.currentAltitude);
    deps.smoke.update(dt);
    deps.sky.setAltitude(deps.flight.currentAltitude);
    if (armRetract >= 0) {
      armRetract += dt;
      deps.ml.retractArms(Math.min(1, armRetract / 3));
    }
    deps.director.update(engine.t, engine.current, engine.t);
  };

  const skipTo = (state: MissionState): void => {
    engine.seekToState(state);
  };

  return { engine, update, skipTo };
}
