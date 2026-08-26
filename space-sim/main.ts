// space-sim/main.ts
/**
 * Bootstrap + game loop. Owns the Babylon engine/scene, Havok (with a
 * kinematic fallback), phase dispatch, pause, adaptive quality, and the
 * HTML shell screens. All gameplay math lives in the other modules.
 */
import { Engine, Matrix, Scene, Vector3 } from '@babylonjs/core';
import { ALT, DOCK, MISSION, PLAYER, displayAltitudeKm, metersToUnits, unitsToMeters } from './config';
import { Mission, MissionPhase, track } from './state';
import {
  approachState, canDock, dockingAccuracy, rating, type DockInput,
} from './docking';
import {
  createKeyboardInput, createTouchInput, emptyInput, type InputAction,
  type LookHandler,
} from './input';
import { createWorld } from './world';
import { createIss } from './iss';
import { createPlayer } from './player';
import { createHud } from './hud';
import { createAudio } from './audio';

// ---------- DOM helpers ----------
const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
};
const show = (id: string, visible: boolean): void => {
  $(id).hidden = !visible;
};
const isTouch = window.matchMedia('(pointer: coarse)').matches;

function setProgress(pct: number, label: string): void {
  ($('load-bar') as HTMLDivElement).style.width = `${pct}%`;
  $('load-msg').textContent = label;
}

// ---------- boot ----------
async function boot(): Promise<void> {
  track('space_simulator_open', { deviceType: isTouch ? 'mobile' : 'desktop' });
  track('space_simulator_load_start');

  const canvas = $('game-canvas') as HTMLCanvasElement;
  let engine: Engine;
  try {
    engine = new Engine(canvas, true, { adaptToDeviceRatio: true });
  } catch {
    show('screen-loading', false);
    show('screen-fallback', true);
    return;
  }
  window.addEventListener('resize', () => engine.resize());
  setProgress(20, 'Engine ready');

  const scene = new Scene(engine);
  // ponytail: Havok dropped — no physics bodies existed, it was a dead ~1.5 MB
  // WASM download (§A.6 first-playable/memory targets). Collision is handled by
  // the ISS keep-out check below; add Havok back when rigid bodies are needed.

  const mission = new Mission();
  const world = createWorld(scene);
  setProgress(50, 'World built');

  const issPos = new Vector3(40, ALT.ORBIT_Y + 0.8, 40);
  const iss = createIss(scene, issPos);
  setProgress(65, 'ISS on station');

  const startPos = new Vector3(0, ALT.SURFACE_Y + 1, 0);
  const player = createPlayer(scene, startPos);
  // ponytail: no module sets activeCamera; without it render draws nothing and
  // getTransformMatrix() (marker projection) is uninitialized. Upgrade path: none needed.
  scene.activeCamera = player.camera;
  const hud = createHud(scene);
  setProgress(90, 'Systems check');
  // Audio starts on the START click (user gesture — §D.17 autoplay rules).
  let audio: ReturnType<typeof createAudio> | null = null;

  const input = emptyInput();
  const look = { yaw: 0, pitch: 0 };
  const onLook: LookHandler = (dx, dy) => { look.yaw += dx; look.pitch += dy; };
  const disposers = [
    createKeyboardInput(canvas, input, onAction, onLook),
  ];
  if (isTouch) disposers.push(createTouchInput(canvas, input, onAction, onLook));

  // ---------- shell screen wiring ----------
  function onAction(a: InputAction): void {
    if (a === 'pause') togglePause();
    if (a === 'assist') {
      player.assist = !player.assist;
      hud.setHint(player.assist ? 'ASSIST ON — stabilizing' : 'ASSIST OFF');
    }
    if (a === 'recenter') recenter();
    if (a === 'dock') tryDock();
  }

  function togglePause(): void {
    const p = mission.state.phase;
    if (p === MissionPhase.Complete || p === MissionPhase.Failed || p === MissionPhase.Briefing) return;
    const next = !mission.state.paused;
    mission.setPaused(next);
    show('screen-paused', next);
    audio?.setPaused(next);
  }

  function recenter(): void {
    if (outOfBounds()) {
      // Return to mission (PRD §E.11): pull back to 100 m from the ISS.
      const toPlayer = player.root.position.subtract(issPos).normalize();
      player.root.position.copyFrom(issPos.add(toPlayer.scale(metersToUnits(100))));
      player.velocity.set(0, 0, 0);
    }
    player.recenterTo(iss.port.getAbsolutePosition());
    hud.setHint('Recentered on ISS');
  }

  function outOfBounds(): boolean {
    return Vector3.Distance(player.root.position, issPos) > MISSION.boundsRadiusUnits;
  }

  function dockInput(): DockInput {
    const portPos = iss.port.getAbsolutePosition();
    const distM = unitsToMeters(Vector3.Distance(player.root.position, portPos));
    const relMps = unitsToMeters(player.velocity.length()); // ISS is static
    const fwd = player.camera.getDirection(Vector3.Forward());
    const axis = iss.portAxisWorld();
    const alignmentDeg = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(fwd, axis)))) * (180 / Math.PI);
    const toPort = portPos.subtract(player.root.position).normalize();
    const coneDeg = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(toPort, axis.scale(-1))))) * (180 / Math.PI);
    return {
      distanceM: distM,
      relSpeedMps: relMps,
      alignmentDeg,
      inCorridor: coneDeg < DOCK.corridorHalfAngleDeg,
    };
  }

  function tryDock(): void {
    if (mission.state.phase !== MissionPhase.Approach && mission.state.phase !== MissionPhase.Docking) return;
    const di = dockInput();
    if (canDock(di)) completeMission(di);
    else hud.setHint('Docking not possible — check speed, distance, alignment');
  }

  function completeMission(di: DockInput): void {
    const accuracy = dockingAccuracy(di);
    const fuelPct = player.fuel;
    const grade = rating(accuracy, fuelPct);
    audio?.dock();
    mission.setPhase(MissionPhase.Complete);
    track('docking_success', { dockingAccuracy: accuracy, fuelRemaining: Math.round(fuelPct) });
    $('result-title').textContent = 'MISSION COMPLETE';
    $('result-sub').textContent = 'ISS DOCKED ✓';
    $('result-time').textContent = fmtClock(mission.state.missionTimeS);
    $('result-fuel').textContent = `${fuelPct.toFixed(0)}%`;
    $('result-accuracy').textContent = `${accuracy}%`;
    $('result-grade').textContent = grade;
    show('screen-result', true);
  }

  function failMission(reason: string): void {
    mission.setPhase(MissionPhase.Failed);
    track('docking_failed', { reason });
    $('result-title').textContent = 'MISSION FAILED';
    $('result-sub').textContent = reason;
    $('result-time').textContent = fmtClock(mission.state.missionTimeS);
    $('result-fuel').textContent = `${player.fuel.toFixed(0)}%`;
    $('result-accuracy').textContent = '—';
    $('result-grade').textContent = '—';
    show('screen-result', true);
  }

  function fmtClock(s: number): string {
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  function restart(): void {
    track('mission_restart');
    mission.reset();
    player.root.position.copyFrom(startPos);
    player.velocity.set(0, 0, 0);
    player.fuel = 100;
    player.camera.rotation.set(0, 0, 0);
    world.setAscentProgress(0);
    karmanAnnounced = false;
    fuelWarned = false;
    player.thrustLevel = 0;
    show('screen-result', false);
    show('screen-briefing', true);
  }

  $('btn-start').addEventListener('click', () => {
    show('screen-briefing', false);
    mission.setPhase(MissionPhase.Ascent);
    track('mission_start');
    hud.setHint(isTouch ? 'Hold the joystick to thrust — reach orbit!' : 'Hold W to thrust — reach orbit!');
    if (!audio) audio = createAudio();
  });
  $('btn-resume').addEventListener('click', togglePause);
  const sensInput = $('look-sensitivity') as HTMLInputElement;
  const sensOut = $('sens-out');
  sensInput.addEventListener('input', () => {
    const pct = Number(sensInput.value);
    player.lookSensitivity = PLAYER.lookSensitivity * (pct / 100);
    sensOut.textContent = `${pct}%`;
  });
  $('btn-replay').addEventListener('click', restart);
  $('btn-exit').addEventListener('click', () => {
    track('mission_exit');
    window.location.href = '/';
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !mission.state.paused
      && mission.state.phase >= MissionPhase.Ascent
      && mission.state.phase <= MissionPhase.Docking) {
      togglePause();
    }
  });
  window.addEventListener('pagehide', () => {
    track('mission_exit');
    disposers.forEach((d) => d());
    audio?.dispose();
  });

  // ---------- render loop ----------
  let last = performance.now();
  let hudAccum = 0;
  let fpsAccum = 0;
  let fpsSamples = 0;
  let lowStreak = 0;
  const renderScales = [1, 0.8, 0.66, 0.5];
  let scaleIdx = 0;
  let karmanAnnounced = false;
  let fuelWarned = false;

  engine.runRenderLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000); // clamp (PRD §E.8)
    last = now;

    const st = mission.state;
    const playing = !st.paused && st.phase >= MissionPhase.Ascent && st.phase <= MissionPhase.Docking;

    if (playing) {
      audio?.setThrust(player.thrustLevel);
      mission.update({ missionTimeS: st.missionTimeS + dt });
      mission.update({ oxygen: Math.max(0, st.oxygen - (100 / MISSION.oxygenSeconds) * dt) });

      if (st.phase === MissionPhase.Ascent) {
        const reachedOrbit = player.updateAscent(input, dt);
        const t = Math.min(1, Math.max(0,
          (player.root.position.y - ALT.SURFACE_Y) / (ALT.ORBIT_Y - ALT.SURFACE_Y)));
        world.setAscentProgress(t);

        // HUD ~10 Hz (PRD §C.4) with ascent telemetry; no docking fields yet.
        hudAccum += dt;
        if (hudAccum >= 0.1) {
          hudAccum = 0;
          mission.update({
            altitudeKm: displayAltitudeKm(player.root.position.y),
            speedMps: unitsToMeters(player.velocity.length()),
            fuel: player.fuel,
          });
          // ponytail: HUD signature requires approach args; SAFE/false are the
          // neutral ascent values until the orbit branch starts feeding real ones.
          hud.update(mission.state, 'SAFE', false);
        }
        if (!karmanAnnounced && displayAltitudeKm(player.root.position.y) >= ALT.KARMAN_LINE_KM) {
          karmanAnnounced = true;
          hud.setHint('Kármán line crossed — welcome to space');
        }
        if (reachedOrbit) {
          mission.setPhase(MissionPhase.Orbit);
          hud.setHint('Orbit reached. Zero-G: thrust persists — tap R to brake.');
        } else if (player.root.position.y < ALT.SURFACE_Y - 0.5) {
          failMission('Fell back to Earth — keep thrusting');
        }
      } else {
        player.updateOrbit(input, look, dt);
        world.rotate(dt);

        const di = dockInput();
        const as = approachState(di);
        if (as !== 'SAFE') audio?.warn(as);
        // Phase promotion by proximity.
        if (st.phase === MissionPhase.Orbit && di.distanceM < 150) {
          mission.setPhase(MissionPhase.Approach);
          hud.setHint('Approach corridor: slow down and align with the port');
        } else if (st.phase === MissionPhase.Approach && di.distanceM < 25) {
          mission.setPhase(MissionPhase.Docking);
        }

        // Failure checks.
        if (di.distanceM < 3 && di.relSpeedMps > 1.5) {
          failMission('Collision with the ISS — approach too fast');
        } else if (player.fuel <= 0 && di.distanceM > 20) {
          if (!fuelWarned) { fuelWarned = true; track('thruster_depleted'); }
          failMission('Out of fuel, adrift far from the ISS');
        } else if (st.oxygen <= 0) {
          failMission('Oxygen depleted');
        }

        if (outOfBounds()) hud.setHint('You are leaving the mission area — press C to return');

        // HUD ~10 Hz (PRD §C.4).
        hudAccum += dt;
        if (hudAccum >= 0.1) {
          hudAccum = 0;
          const portPos = iss.port.getAbsolutePosition();
          mission.update({
            altitudeKm: displayAltitudeKm(player.root.position.y),
            speedMps: unitsToMeters(player.velocity.length()),
            relativeVelocityMps: di.relSpeedMps,
            fuel: player.fuel,
            distanceToISSm: di.distanceM,
            alignmentDeg: di.alignmentDeg,
          });
          hud.update(mission.state, as, canDock(di));

          // Project the ISS marker to screen space.
          const w = engine.getRenderWidth();
          const h = engine.getRenderHeight();
          // ponytail: Babylon 9 has no Vector3.Identity() — identity Matrix is the equivalent transform
          const proj = Vector3.Project(portPos, Matrix.Identity(),
            scene.getTransformMatrix(), player.camera.viewport.toGlobal(w, h));
          const behind = Vector3.Dot(portPos.subtract(player.root.position),
            player.camera.getDirection(Vector3.Forward())) < 0;
          // Marker is anchored LEFT/TOP (measures from top-left edge),
          // so it takes raw screen coords, y flipped to top-origin.
          hud.setMarker(behind ? null : proj.x, behind ? null : h - proj.y);
        }
      }

      if (player.fuel <= 0 && !fuelWarned && st.phase === MissionPhase.Ascent) {
        fuelWarned = true;
        track('thruster_depleted');
      }
    }
    if (!playing) audio?.setThrust(0); // hiss must not outlive thrust (§D.17)

    // Adaptive quality (PRD §D.19): sustained low FPS → step render scale down.
    fpsAccum += dt; fpsSamples += 1;
    if (fpsAccum >= 1) {
      const fps = fpsSamples / fpsAccum;
      fpsAccum = 0; fpsSamples = 0;
      lowStreak = fps < (isTouch ? 24 : 45) ? lowStreak + 1 : 0;
      if (lowStreak >= 3 && scaleIdx < renderScales.length - 1) {
        scaleIdx += 1;
        engine.setHardwareScalingLevel(1 / renderScales[scaleIdx]);
        lowStreak = 0;
        track('quality_downgrade', { qualityTier: renderScales[scaleIdx] });
      }
    }

    // Consume accumulated look deltas once per frame.
    look.yaw = 0; look.pitch = 0;
    scene.render();
  });

  setProgress(100, 'Ready');
  track('space_simulator_load_complete');
  show('screen-loading', false);
  show('screen-briefing', true);
}

boot().catch((err) => {
  // Never a blank page (PRD §E.1).
  // eslint-disable-next-line no-console
  console.error(err);
  show('screen-loading', false);
  show('screen-fallback', true);
});
