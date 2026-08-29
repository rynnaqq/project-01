// space-sim/mission/runtime.ts
import type { Scene, TransformNode } from "@babylonjs/core";
import type { AudioBus } from "../core/audio";
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
  /** Procedural audio bus (engine bed, rumble, radio comms); unlocked on first user gesture. */
  audio: AudioBus;
  ui: UiSinks;
  /** Invoked when the mission script fires the enablePlayer command (zero-G rig takes over). */
  onPlayerEnabled?: () => void;
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
  let smokeDownAt = -1; // mission time to ramp pad smoke down; -1 = unscheduled
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
        deps.audio.engine(true);
        deps.audio.rumble(0.8);
        armRetract = 0;
        break;
      case "liftoff":
        deps.flight.liftoff(t);
        deps.audio.rumble(1);
        smokeDownAt = t + 30; // pad smoke clears 30 s into the climb
        break;
      case "separateSrb":
        deps.flight.separateSrb();
        break;
      case "separateCore":
        deps.flight.separateCore();
        deps.exhaust.ignite(false); // the detached core must not keep a burning plume
        break;
      case "orbitInsertion":
        deps.flight.orbitInsertion();
        deps.audio.engine(false);
        deps.audio.rumble(0);
        break;
      case "dockContact":
        startDocking();
        deps.docking.contact();
        deps.audio.clunk();
        break;
      case "dockCapture":
        startDocking();
        deps.docking.capture();
        deps.audio.clunk();
        break;
      case "dockHard":
        startDocking();
        deps.docking.hardDock();
        deps.audio.clunk();
        break;
      case "enterInterior":
        deps.audio.vent(true);
        break;
      case "enablePlayer":
        deps.onPlayerEnabled?.();
        break;
      default: // openHatch: interior is always live, no runtime side effects
        break;
    }
  };

  const engine = new MissionEngine(MISSION_SCRIPT, {
    onCommand: (c: Command, t: number) => handleCommand(c, t),
    onComms: (c: CommsLine) => {
      deps.audio.beep("soft");
      deps.audio.duck(c.style === "pa" ? 0.4 : 1); // duck the bed under PAO announcements
      deps.audio.speak(c);
      deps.ui.onComms(c);
    },
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
    if (smokeDownAt >= 0 && engine.t >= smokeDownAt) {
      deps.smoke.ramp(0);
      smokeDownAt = -1;
    }
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
