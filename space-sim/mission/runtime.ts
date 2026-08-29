// space-sim/mission/runtime.ts
import type { Scene, TransformNode } from "@babylonjs/core";
import {
  MISSION_STATES,
  MissionEngine,
  type Command, type CommsLine, type FxCommand, type HudChange, type MissionState,
} from "./engine";
import { MISSION_SCRIPT, STATE_DURATIONS } from "./script";
import type { CinematicDirector } from "../cinema/director";
import type { SkyController } from "../effects/sky";
import type { FlightModel } from "../vehicles/flight";
import type { ExhaustSystem } from "../effects/exhaust";
import type { GroundSmoke } from "../effects/smoke";
import type { MobileLauncher } from "../world/ksc/launcher";
import type { DockingSequence, DockingTelemetry } from "../iss/docking";

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
  /** ISS frame Orion is re-parented into at ISS_REVEAL entry. */
  issRoot: TransformNode;
  /** Scripted approach driver: holds orionNode + the ISS docking port. */
  docking: DockingSequence;
  ui: UiSinks;
}

export interface MissionRuntime {
  engine: MissionEngine;
  /** Latest relative-motion telemetry for the docking HUD; null until the approach starts. */
  readonly lastTelemetry: DockingTelemetry | null;
  update(dt: number): void;
  skipTo(state: MissionState): void;
}

export function createMissionRuntime(deps: RuntimeDeps): MissionRuntime {
  let armRetract = -1; // seconds since ignition for the arm animation
  let dockingStarted = false;
  let approachStart: number | null = null;
  let lastTelemetry: DockingTelemetry | null = null;
  const APPROACH_WINDOW = STATE_DURATIONS.ISS_APPROACH + STATE_DURATIONS.DOCKING_SEQUENCE;

  // Re-parent Orion into the ISS frame on (or after) ISS_REVEAL entry; idempotent.
  // setProgress(0) immediately places Orion at the corridor start — port local
  // (0,-2.5,-11.4) + 200 m out along the -Z docking axis = (0,-2.5,-212.5).
  const startDocking = (): void => {
    if (dockingStarted) return;
    dockingStarted = true;
    deps.docking.node.setParent(deps.issRoot);
    deps.docking.setProgress(0);
  };
  // State-entry variant: holds until ISS_REVEAL so natural play never attaches early.
  const maybeStartDocking = (): void => {
    if (MISSION_STATES.indexOf(engine.current) >= MISSION_STATES.indexOf("ISS_REVEAL")) {
      startDocking();
    }
  };

  const handleCommand = (c: Command, t: number): void => {
    switch (c.kind) {
      case "ignite":
        deps.exhaust.ignite(true);
        deps.smoke.ramp(1);
        armRetract = 0;
        break;
      case "liftoff":
        deps.flight.liftoff(t);
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
      case "dockContact":
        startDocking();
        deps.docking.contact();
        break;
      case "dockCapture":
        startDocking();
        deps.docking.capture();
        break;
      case "dockHard":
        startDocking();
        deps.docking.hardDock();
        break;
      default: // openHatch/enterInterior/enablePlayer wired in Tasks 15–16
        break;
    }
  };

  const engine = new MissionEngine(MISSION_SCRIPT, {
    onCommand: (c: Command, t: number) => handleCommand(c, t),
    onComms: (c: CommsLine) => deps.ui.onComms(c),
    onHud: (h: HudChange) => deps.ui.onHud(h),
    onFx: (f: FxCommand) => {
      deps.sky.applyFx(f);
      if (f.smoke !== undefined) deps.smoke.ramp(f.smoke);
    },
    onShot: (shot, duration, t) => deps.director.playShot(shot, duration, t),
    onTransition: (kind) => deps.director.cut(kind),
    onState: (_prev, next, t) => {
      maybeStartDocking();
      if (next === "ISS_APPROACH" || (next === "DOCKING_SEQUENCE" && approachStart === null)) {
        approachStart = t;
      }
      deps.ui.onState(next);
    },
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
    if (dockingStarted) {
      const cur = engine.current;
      if (cur === "ISS_APPROACH" || cur === "DOCKING_SEQUENCE") {
        const elapsed = approachStart === null ? 0 : engine.t - approachStart;
        deps.docking.setProgress(Math.min(1, Math.max(0, elapsed / APPROACH_WINDOW)));
      } else if (cur === "DOCKING_COMPLETE") {
        deps.docking.setProgress(1); // seal the approach window at its endpoint
      }
      lastTelemetry = deps.docking.telemetry();
    }
    deps.director.update(engine.t, engine.current, engine.t);
  };

  const skipTo = (state: MissionState): void => {
    engine.seekToState(state);
  };

  return {
    engine,
    get lastTelemetry() { return lastTelemetry; },
    update,
    skipTo,
  };
}
