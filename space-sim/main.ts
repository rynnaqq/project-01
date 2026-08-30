// space-sim/main.ts
import {
  DefaultRenderingPipeline, Matrix, MeshBuilder, SSAO2RenderingPipeline, Scene, UniversalCamera, Vector3,
  WebGPUEngine,
} from "@babylonjs/core";
import type { Engine, Mesh, PBRMaterial, PointLight, TransformNode } from "@babylonjs/core";
import { capsForTier, createBestEngine, detectTier, gpuString, type QualityTier } from "./core/engine";
import { createAssets } from "./core/assets";
import { AudioBus } from "./core/audio";
import { SkyController } from "./effects/sky";
import { createStarfield } from "./world/space";
import { createEarth, type Earth } from "./world/earth/earth";
import type { MobileLauncher } from "./world/ksc/launcher";
import type { FlightModel } from "./vehicles/flight";
import type { ExhaustSystem } from "./effects/exhaust";
import type { GroundSmoke } from "./effects/smoke";
import { ShotLibrary } from "./cinema/shots";
import { CinematicDirector } from "./cinema/director";
import { TransitionLayer } from "./cinema/transitions";
import { MISSION_STATES, type MissionState } from "./mission/types";
import { STATE_DURATIONS } from "./mission/script";
import type { UiSinks } from "./mission/runtime";
import { InputManager } from "./core/input";
import { Hud } from "./ui/hud";
import { Subtitles } from "./ui/subtitles";
import { Menu } from "./ui/menu";
import { ZeroGState } from "./player/controller";
import { InteractionSystem } from "./player/interact";
import type { SlsStack } from "./vehicles/sls";

const canvas = document.getElementById("render-canvas") as HTMLCanvasElement;
const fill = document.getElementById("loading-fill")!;
const stepLabel = document.getElementById("loading-step")!;

function setProgress(fraction: number, label: string): void {
  fill.style.width = `${Math.round(fraction * 100)}%`;
  stepLabel.textContent = label;
}
const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

// Static boot-fault screen (index.html) RETRY button — reload the page.
document.getElementById("error-retry")?.addEventListener("click", () => { window.location.reload(); });

// The Menu comes up early in boot so any fault can surface on its error card;
// before it exists (or for module-load faults) the static #error-screen is used.
let bootMenu: Menu | null = null;

function showFault(msg: string, canContinue = false): void {
  document.getElementById("loading-screen")?.classList.add("hidden");
  // ponytail: devtools mirror; the menu error card can be missed on a half-failed boot
  console.error(`[space-sim] ${msg}`);
  if (bootMenu) {
    bootMenu.hide(); // start/pause cards must not paint through the error card
    bootMenu.showError(msg, canContinue);
  } else {
    document.getElementById("error-screen")?.classList.remove("hidden");
    const text = document.getElementById("error-text");
    if (text) text.textContent = msg;
  }
}

interface World {
  tier: QualityTier; sky: SkyController; earth: Earth; ml: MobileLauncher;
  sls: SlsStack; flight: FlightModel; exhaust: ExhaustSystem; smoke: GroundSmoke;
  shotLibrary: ShotLibrary;
  crewQuarters: () => TransformNode | null;
}

async function boot(): Promise<World> {
  // Environment posture: touch devices run the low tier; reduced-motion users
  // get a steadier camera (no handheld wobble, no launch shake).
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  setProgress(0.05, "Detecting graphics backend...");
  const engine: Engine | WebGPUEngine = await createBestEngine(canvas, { allowWebGPU: !coarsePointer });
  // Early-probe: a no-context engine still exists (Babylon swallows the throw
  // and falls back to a bare WebGL2 engine) and would silently render a black
  // frame forever. Probe the canvas directly so the user gets a real error
  // message instead of staring at the clearColor.
  const hasContext = engine instanceof WebGPUEngine
    || !!canvas.getContext("webgl2") || !!canvas.getContext("webgl");
  if (!hasContext) {
    throw new Error("Your browser does not support WebGL2 or WebGPU.");
  }
  const tier: QualityTier = coarsePointer
    ? "low" // touch devices are always force-capped to the low tier
    : detectTier({
        gpu: engine instanceof WebGPUEngine ? "WebGPU-capable" : gpuString(engine),
        dpr: window.devicePixelRatio,
        cores: navigator.hardwareConcurrency || 4,
      });
  // Render at native device resolution (user brief: quality over perf). The old
  // min(dpr,2) cap left hi-dpi screens at 1x = the top source of global blur.
  engine.setHardwareScalingLevel(1 / window.devicePixelRatio);
  const scene = new Scene(engine);
  scene.clearColor.set(0.002, 0.004, 0.01, 1);
  const camera = new UniversalCamera("bootCam", new Vector3(1400, 60, 900), scene);
  camera.minZ = 0.1; camera.maxZ = 2.5e7;
  camera.setTarget(new Vector3(0, 40, 0));
  scene.activeCamera = camera;

  // Resize: Babylon usually fits on its own, but orientation changes on mobile
  // can land the backbuffer at the wrong aspect if the rotation animation hasn't
  // settled. The 200 ms delay lets the browser finish before we re-fit.
  window.addEventListener("resize", () => engine.resize());
  window.addEventListener("orientationchange", () => {
    setTimeout(() => engine.resize(), 200);
  });

  // --- DOM UI comes up before the world so build faults can surface on the menu
  // error card (with hide() first, per ledger, so no other card paints through) ---
  const uiRoot = document.getElementById("ui-layer")!;
  const hud = new Hud(uiRoot);
  const subtitles = new Subtitles(uiRoot);
  let started = false;
  let paused = false;
  // engine.t captured at the current state's entry — time base for the countdown MET.
  let stateEnteredAt = 0;
  let telemetryOn = false;
  let muted = false;

  const input = new InputManager(canvas);
  // Audio bus: unlocked on the first user gesture (canvas click or any keypress);
  // every method no-ops until then and Web Audio/SpeechSynthesis failures are silent.
  const audio = new AudioBus();
  window.addEventListener("keydown", () => { void audio.unlock(); }, { once: true });

  const MAJOR_STATES: readonly MissionState[] = [
    "LAUNCH_PREPARATION", "ENGINE_IGNITION", "ORBIT", "ISS_REVEAL",
    "DOCKING_SEQUENCE", "ISS_INTERIOR_INTRO", "PLAYER_CONTROL_ENABLED",
  ];
  const nextMajorState = (cur: MissionState): MissionState | null => {
    const majorIdx = MAJOR_STATES.indexOf(cur);
    if (majorIdx >= 0) return MAJOR_STATES[majorIdx + 1] ?? null;
    const curIdx = MISSION_STATES.indexOf(cur);
    for (const m of MAJOR_STATES) {
      if (MISSION_STATES.indexOf(m) > curIdx) return m;
    }
    return null;
  };

  const toggleFullscreen = (): void => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => { /* best effort */ });
    } else {
      void document.documentElement.requestFullscreen().catch(() => { /* best effort */ });
    }
  };
  const toggleMute = (): void => {
    muted = !muted;
    audio.setMuted(muted);
  };
  const pauseGame = (): void => {
    if (!started || paused) return;
    paused = true; // freezes mission.update/updatePlayer in the render loop
    audio.setPaused(true); // mute-while-paused: bed silenced, radio speech cancelled
    input.unlockPointer();
    menu.showPause();
  };
  const resumeGame = (): void => {
    if (!paused) return;
    paused = false;
    audio.setPaused(false);
    menu.hide();
  };
  const skipCinematic = (): void => {
    const next = nextMajorState(mission.engine.current);
    if (!next) return;
    mission.skipTo(next);
    resumeGame(); // continue playback at the new state when skipping from the pause menu
  };
  const startMission = (): void => {
    void audio.unlock();
    audio.setPaused(false);
    menu.hide();
    started = true; // mission clock starts ticking on the next frame
  };
  // Callbacks are late-bound wrappers: the Menu is built before mission/audio
  // bindings below finish initializing, and its cards are only shown afterwards.
  const menu = new Menu(uiRoot, {
    onStart: () => startMission(),
    onRestart: () => { window.location.reload(); },
    onSkip: () => skipCinematic(),
    onExit: () => { window.location.href = "/"; },
    onResume: () => resumeGame(),
    onFullscreen: () => toggleFullscreen(),
  });
  bootMenu = menu;
  if (coarsePointer) menu.setStartNote("Touch and drag to look — tap [E] targets to interact.");

  input.onEscape(() => {
    if (!started) return;
    if (paused) resumeGame(); else pauseGame();
  });
  // Chrome consumes the Esc keydown that exits pointer lock — pause on lock loss too.
  document.addEventListener("pointerlockchange", () => {
    if (started && !paused && !document.pointerLockElement) pauseGame();
  });
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code === "KeyM") toggleMute();
    if (e.code === "KeyF") toggleFullscreen();
  });

  // WebGL/WebGPU context loss: graceful recovery message; hide it again on restore.
  engine.onContextLostObservable.add(() => {
    showFault("Graphics context was lost. Attempting recovery — if the view stays dark, press RETRY to reload.");
  });
  engine.onContextRestoredObservable.add(() => {
    bootMenu?.hide();
    document.getElementById("error-screen")?.classList.add("hidden");
  });

  // --- World build (dynamic imports): decorative subsystems degrade gracefully —
  // a missing landmark must not black-screen the mission. Required systems
  // (mobile launcher, vehicle, station, runtime) rethrow into showFault. ---
  const buildFaults: string[] = [];
  const buildStep = async (label: string, run: () => Promise<void>): Promise<void> => {
    try { await run(); } catch (err) { buildFaults.push(label); console.warn(`[space-sim] scenery build failed: ${label}`, err); }
  };

  setProgress(0.2, "Loading materials...");
  await nextFrame();
  const assets = createAssets(scene);

  setProgress(0.4, "Loading sky and starfield...");
  await nextFrame();
  const sky = new SkyController(scene, tier, reducedMotion);
  createStarfield(scene);

  setProgress(0.6, "Loading Earth...");
  await nextFrame();
  const earth = createEarth(scene);

  setProgress(0.7, "Loading Kennedy Space Center...");
  await nextFrame();
  await buildStep("KSC terrain", async () => {
    const { createTerrain } = await import("./world/ksc/terrain");
    createTerrain(scene, assets);
  });
  await buildStep("Vehicle Assembly Building", async () => {
    const { createVab, createFacilityCluster } = await import("./world/ksc/vab");
    createVab(scene, assets);
    createFacilityCluster(scene, assets);
  });
  await buildStep("Launch Pad 39-A", async () => {
    const { createPad } = await import("./world/ksc/pad");
    createPad(scene, assets);
  });
  const { createMobileLauncher, createCrawler } = await import("./world/ksc/launcher");
  const ml = createMobileLauncher(scene, assets);
  createCrawler(scene, assets);
  await buildStep("KSC site props", async () => {
    const { createProps } = await import("./world/ksc/props");
    createProps(scene, assets);
  });

  setProgress(0.75, "Loading SLS + Orion stack...");
  await nextFrame();
  // ShotLibrary target providers (cinema/shots.ts contract) — populated as world
  // objects come online, consumed lazily by active rigs.
  const targetProviders: Record<string, () => TransformNode | undefined> = {};
  targetProviders.crewQuarters = () => scene.getTransformNodeByName("crewQuarters") ?? undefined;
  const { createSlsStack } = await import("./vehicles/sls");
  const sls = createSlsStack(scene, assets);
  targetProviders.stack = () => sls.root;
  targetProviders.engines = () => sls.enginesNode;
  targetProviders.orion = () => sls.orionNode;
  setProgress(0.78, "Loading International Space Station...");
  await nextFrame();
  const { createIssExterior } = await import("./iss/exterior");
  const iss = createIssExterior(scene, assets);
  targetProviders.iss = () => iss.root;
  const { createIssInterior } = await import("./iss/interior");
  const interior = createIssInterior(scene, assets, iss);
  targetProviders.issInterior = () => interior.spawn;
  // Providers live in main (world objects) — docking "port" target = the PMA-2 node.
  targetProviders.port = () => iss.dockingPort;
  // Docking rig: drives sls.orionNode down the ISS docking axis from ISS_REVEAL on.
  const { DockingSequence } = await import("./iss/docking");
  const docking = new DockingSequence(sls.orionNode, iss.dockingPort);
  const shotLibrary = new ShotLibrary({ scene, targetProviders, reducedMotion });

  setProgress(0.8, "Configuring cinematic pipeline...");
  await nextFrame();
  const caps = capsForTier(tier);
  // Pipeline rides EVERY camera: director auto-cuts swap scene.activeCamera, and
  // a boot-cam-only pipeline would render every scripted shot raw (no bloom,
  // no tonemapping grade, no AA) — the "graphics look like a mess" report.
  const pipe = new DefaultRenderingPipeline("cinePipe", true, scene, [
    camera, ...shotLibrary.ids().map((id) => shotLibrary.get(id)!.camera),
  ]);
  pipe.bloomEnabled = true;
  pipe.bloomThreshold = 0.85;
  pipe.bloomWeight = 0.35;
  pipe.bloomKernel = 48;
  pipe.bloomScale = 0.5;
  pipe.fxaaEnabled = false; // MSAA 8x below instead — FXAA blurs what MSAA keeps crisp
  pipe.samples = 8; // hardware MSAA on every pipeline camera (WebGL2/WebGPU clamp to max)
  pipe.imageProcessingEnabled = true;
  pipe.imageProcessing.toneMappingEnabled = true;
  pipe.imageProcessing.contrast = 1.15;
  pipe.imageProcessing.exposure = 1.0;
  pipe.sharpenEnabled = true; // counteract procedural-texture softness
  pipe.sharpen.edgeAmount = 0.25;
  if (caps.ssao) {
    const ssao = new SSAO2RenderingPipeline("ssao", scene, 0.75, [camera]);
    ssao.totalStrength = 0.85;
    ssao.radius = 1.2;
  }

  setProgress(0.9, "Loading flight systems...");
  await nextFrame();
  const { FlightModel } = await import("./vehicles/flight");
  const flight = new FlightModel(sls);
  const { ExhaustSystem } = await import("./effects/exhaust");
  const exhaust = new ExhaustSystem(scene, sls.enginesNode, caps.maxParticles, caps.gpuParticles);
  exhaust.plumeLight.parent = sls.enginesNode;
  const { GroundSmoke } = await import("./effects/smoke");
  const smoke = new GroundSmoke(scene, new Vector3(0, 16, -70), caps.maxParticles, caps.gpuParticles);

  setProgress(0.95, "MISSION SYSTEM READY");
  await nextFrame();
  const director = new CinematicDirector(shotLibrary, scene, new TransitionLayer(uiRoot));

  // --- Zero-G player (activated by the enablePlayer mission command) ---
  // Player state lives in ISS-local space — the same frame as interior.colliders.
  // Space/C thrust stays world-vertical; WASD is camera-local, mapped through
  // the yaw/pitch basis (Babylon: rotation.x positive pitches DOWN, +yaw turns +Z->+X).
  let playerCam: UniversalCamera | null = null;

  const uiSinks: UiSinks = {
    onComms: (c) => subtitles.show(c),
    onHud: (h) => {
      if (h.phase !== undefined) hud.setPhase(h.phase);
      if (h.progressStage !== undefined) hud.setProgress(h.progressStage);
      if (h.telemetry !== undefined) telemetryOn = h.telemetry === "docking";
    },
    onState: (s) => {
      stateEnteredAt = mission.engine.t;
      // Coarse-pointer devices have no keyboard: never show HOLD SPACE TO SKIP.
      hud.setSkipHint(!coarsePointer && MISSION_STATES.indexOf(s) < MISSION_STATES.indexOf("PLAYER_CONTROL_ENABLED"));
      if (s === "ENGINE_IGNITION") hud.setMet(0, false); // T+ counts from ignition
    },
  };
  const player = new ZeroGState();
  iss.root.computeWorldMatrix(true);
  interior.spawn.computeWorldMatrix(true);
  const issWorld = iss.root.getWorldMatrix();
  const spawnLocal = Vector3.TransformCoordinates(
    interior.spawn.getAbsolutePosition().clone(),
    issWorld.clone().invert(),
  );
  player.pos = { x: spawnLocal.x, y: spawnLocal.y, z: spawnLocal.z };
  player.yaw = Math.PI; // face aft down the Harmony -> Unity route (-Z)

  const LOCAL_FWD = new Vector3(0, 0, 1);
  const LOCAL_SIDE = new Vector3(1, 0, 0);

  const enablePlayer = (): void => {
    if (playerCam) {
      scene.activeCamera = playerCam;
      return;
    }
    const p0 = Vector3.TransformCoordinates(
      new Vector3(player.pos.x, player.pos.y, player.pos.z), issWorld,
    );
    playerCam = new UniversalCamera("playerCam", p0, scene);
    playerCam.minZ = 0.1; playerCam.maxZ = 2.5e7;
    playerCam.rotation.set(player.pitch, player.yaw, 0);
    scene.activeCamera = playerCam;
    if (!interactions) setupInteractions(playerCam);
    pipe.addCamera(playerCam);
    if (caps.ssao) {
      // SSAO2 only exists as a pipeline when caps.ssao — attaching unconditionally
      // threw for pipeline-not-found on medium/low tiers.
      scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("ssao", [playerCam]);
    }
    input.lockPointer();
    // Enable touch look-around only while the player is live. The director still
    // owns the cinematic camera and would fight any touch deltas, so we gate this
    // on the player rig coming online (and on the touch listener having wired up).
    input.touchLookActive = true;
  };
  canvas.addEventListener("click", () => {
    void audio.unlock();
    if (playerCam && !input.locked) input.lockPointer();
  });

  // --- Interactions (built with the player rig; interior.ts is authoritative and only
  // exposes root/spawn/colliders/cupolaLook, so props are addressed by their mesh names) ---
  let interactions: InteractionSystem | null = null;
  const setupInteractions = (cam: UniversalCamera): void => {
    const sys = new InteractionSystem(scene, cam, uiRoot);
    const findMesh = (name: string): Mesh | null => {
      const m = scene.getMeshByName(name);
      return m ? (m as Mesh) : null;
    };

    // Destiny lab laptops: clone the shared asset material so each screen toggles alone
    for (const name of ["destR_lap0", "destR_lap2", "destR_lap4"]) {
      const laptop = findMesh(name);
      if (!laptop) continue;
      const mat = laptop.material ? (laptop.material.clone(`${name}_mat`) as PBRMaterial) : null;
      let screenOn = true;
      sys.register(laptop, "Laptop", () => {
        screenOn = !screenOn;
        if (mat) mat.emissiveIntensity = screenOn ? 0.7 : 0;
        sys.showCaption("Experiment status reviewed");
      });
    }

    // Destiny light switch: cycles the three route ceiling lights (intLight_-1.3_*)
    // white -> warm -> off; berth/Cupola lights are unaffected
    const routeLights = scene.lights.filter((l) => l.name.startsWith("intLight_-1.3_")) as PointLight[];
    const lightSwitch = MeshBuilder.CreateBox("destinyLightSwitch", { width: 0.16, height: 0.26, depth: 0.06 }, scene);
    lightSwitch.position.set(1.16, -2.0, -5.6); // Destiny starboard rack face, hand height
    lightSwitch.rotation.y = -Math.PI / 2;
    lightSwitch.material = assets.steelStructure();
    lightSwitch.parent = interior.root;
    let lightMode = 0; // 0 white, 1 warm, 2 off
    sys.register(lightSwitch, "Destiny lights", () => {
      lightMode = (lightMode + 1) % 3;
      for (const l of routeLights) {
        if (lightMode === 0) { l.diffuse.set(0.95, 0.97, 1.0); l.intensity = 7; }
        else if (lightMode === 1) { l.diffuse.set(1.0, 0.88, 0.7); l.intensity = 7; }
        else { l.intensity = 0; }
      }
      sys.showCaption(lightMode === 0 ? "Lighting: white" : lightMode === 1 ? "Lighting: warm" : "Lighting: off");
    });

    // Cupola windows: short eased camera push toward the aimed window, then return
    for (const name of ["cupFrame0", "cupFrame1", "cupFrame2", "cupFrame3", "cupFrame4", "cupFrame5", "cupNadir"]) {
      const win = findMesh(name);
      if (!win) continue;
      sys.register(win, "Cupola window", () => {
        sys.pushToward(win.getAbsolutePosition().clone());
      });
    }

    // Bulkhead hatch rings between the modules: sealed, caption only
    for (const name of ["hatch-2.75", "hatch2.75"]) {
      const hatch = findMesh(name);
      if (!hatch) continue;
      sys.register(hatch, "Hatch", () => {
        sys.showCaption("Hatch is sealed — station keeping");
      });
    }

    input.onInteract(() => sys.use());
    interactions = sys;
  };

  const updatePlayer = (dt: number): void => {
    if (!playerCam) return;
    const md = input.mouseDelta();
    const thrust = input.thrustVector();
    const rot = Matrix.RotationYawPitchRoll(player.yaw, player.pitch, 0);
    const fwd = Vector3.TransformCoordinates(LOCAL_FWD, rot);
    const side = Vector3.TransformCoordinates(LOCAL_SIDE, rot);
    const world = new Vector3(
      thrust.x * side.x + thrust.z * fwd.x,
      thrust.y + thrust.z * fwd.y,
      thrust.x * side.z + thrust.z * fwd.z,
    );
    player.step(dt, {
      thrust: { x: world.x, y: world.y, z: world.z },
      yawDelta: md.dx * 0.0022,
      pitchDelta: md.dy * 0.0022,
      boost: input.boostHeld(),
    }, interior.colliders);
    playerCam.position.copyFrom(Vector3.TransformCoordinates(
      new Vector3(player.pos.x, player.pos.y, player.pos.z), issWorld,
    ));
    playerCam.rotation.set(player.pitch, player.yaw, 0);
  };

  const { createMissionRuntime } = await import("./mission/runtime");
  const mission = createMissionRuntime({ scene, director, sky, flight, exhaust, smoke, ml, issRoot: iss.root, docking, audio, ui: uiSinks, onPlayerEnabled: enablePlayer });
  hud.setSkipHint(!coarsePointer && MISSION_STATES.indexOf(mission.engine.current) < MISSION_STATES.indexOf("PLAYER_CONTROL_ENABLED"));
  if (import.meta.env.DEV) {
    // Dev QA gates: ?skip=COUNTDOWN (or any MISSION_STATE) fast-forwards the mission;
    // ?skip=interior is shorthand for ?skip=PLAYER_CONTROL_ENABLED;
    // ?view=iss aims the boot camera at the ISS for exterior visual checks.
    const params = new URLSearchParams(window.location.search);
    const skipAliases: Partial<Record<string, MissionState>> = { INTERIOR: "PLAYER_CONTROL_ENABLED" };
    const skip = params.get("skip")?.toUpperCase();
    const state = MISSION_STATES.find((s) => s === skip) ?? (skip ? skipAliases[skip] : undefined);
    if (state) mission.skipTo(state);
    if (params.get("view") === "iss") {
      const p = iss.root.getAbsolutePosition().clone();
      camera.position.copyFrom(p.add(new Vector3(350, 60, 350)));
      camera.setTarget(p);
    }
    if (params.get("view") === "interior") {
      const p = interior.spawn.getAbsolutePosition().clone();
      camera.position.copyFrom(p);
      camera.setTarget(p.add(new Vector3(0, 0, -3)));
    }
  }

  engine.runRenderLoop(() => {
    try {
      runFrame();
    } catch (err) {
      engine.stopRenderLoop();
      showFault(`Runtime fault — the frame loop stopped: ${String(err)}`);
    }
  });

  function runFrame(): void {
    const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
    sky.update(dt);
    pipe.imageProcessing.exposure = sky.exposure; // altitude/fx ramp drives the grade
    earth.update(dt);
    if (started && !paused) {
      mission.update(dt);
      if (mission.engine.current === "COUNTDOWN") {
        // Fictional launch MET: the 80 s COUNTDOWN state maps onto T-600 → T-0
        // (met = 600·(1 − stateLocal/80)); setMet drives it, update() does not accumulate.
        const stateLocal = Math.max(0, mission.engine.t - stateEnteredAt);
        hud.setMet(Math.max(0, 600 * (1 - stateLocal / STATE_DURATIONS.COUNTDOWN)), true);
      }
      hud.setTelemetry(telemetryOn ? mission.lastTelemetry : null);
      if (!playerCam && input.consumeHoldSpace(dt)) skipCinematic();
      hud.update(dt);
      subtitles.update(dt);
    }
    if (playerCam) {
      if (!paused) {
        updatePlayer(dt);
        interactions?.update(); // after the controller writes the base camera position
      }
      scene.activeCamera = playerCam; // hold the view against cinematic auto-cuts
    }
    scene.render();
  }
  setProgress(1, "MISSION SYSTEM READY");
  await new Promise((r) => setTimeout(r, 400));
  document.getElementById("loading-screen")!.classList.add("hidden");
  menu.showStart();
  if (buildFaults.length > 0) {
    // Recoverable: the mission can still run without the missing scenery.
    menu.hide();
    menu.showError(`Some scenery failed to load (${buildFaults.join("; ")}) — the mission can still run.`, true);
  }
  return {
    tier, sky, earth, ml, sls, flight, exhaust, smoke, shotLibrary,
    crewQuarters: () => targetProviders.crewQuarters?.() ?? null,
  };
}

boot().catch((err: unknown) => {
  showFault(`The simulator could not initialize: ${String(err)}`);
});
