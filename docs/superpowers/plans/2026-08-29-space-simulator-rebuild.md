# Space Simulator Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a from-scratch cinematic NASA-style spaceflight experience (KSC → SLS launch → orbit → ISS docking → zero-G ISS interior exploration) as a standalone Babylon.js app in `space-sim/`.

**Architecture:** Standalone vanilla-TS Babylon.js app (Vite MPA entry, zero React coupling). A deterministic MissionClock drives a data-driven mission state machine whose typed commands are consumed by a CinematicDirector (camera rigs), a FlightModel, FX, Audio, and DOM-UI layers. Nothing reads the scene graph for logic; state lives in the mission engine.

**Tech Stack:** TypeScript 5.6 strict, Babylon.js 9.22 (`@babylonjs/core` meta-module), Vite 6 MPA, Vitest 2 (node env) for logic tests, plain CSS for DOM UI. Zero binary assets — all textures/geometry/audio synthesized in code.

**Spec:** `docs/superpowers/specs/2026-08-29-space-simulator-rebuild-design.md`

## Global Constraints

- Units: **1 unit = 1 meter**, Y-up. KSC pad center at origin `(0,0,0)`; ocean to the east (`+X`); downrange launch direction `+X`. Earth center at `(0, -6371000, 0)`.
- All Babylon imports use the `@babylonjs/core` meta-module (`import { Engine, Scene, ... } from "@babylonjs/core"`) — bundle size accepted trade-off per spec (visual quality > performance).
- Renderer: WebGPU engine when supported, else WebGL2 (`createBestEngine` in `core/engine.ts`). Quality tier gates SSAO/particles/DOF.
- Zero binary assets: no `.glb/.png/.mp3` files; everything procedural (canvas textures, Web Audio, SpeechSynthesis).
- Documented deviation (spec §6.3): `SpeechSynthesis` output cannot be routed through Web Audio nodes. Radio flavor = squelch/static bursts + heterodyne bed around each utterance, per-speaker rate/pitch, always-on captions.
- Mission timing: 20 states, scripted total **811 s (≈13.5 min)** — inside the approved 10–14 min window.
- Tests: `npm run test` (Vitest picks up `space-sim/**/__tests__/*.test.ts`; environment node — keep tests importing pure modules only, never Babylon scene setup). Lint: `npm run lint` (max-warnings 0). `tsconfig.json` already includes `"space-sim"`; `vite.config.ts` already has the `'space-sim/index'` rollup input (currently broken because the folder is deleted — Task 1 restores it).
- Commit after every task, conventional commits with `space-sim` scope.

---

### Task 1: Scaffold standalone app + engine + quality tiers

**Files:**
- Create: `space-sim/index.html`, `space-sim/style.css`, `space-sim/main.ts`, `space-sim/core/engine.ts`
- Test: `space-sim/__tests__/tier.test.ts`

**Interfaces:**
- Produces: `type QualityTier = "high" | "medium" | "low"`, `detectTier(info: { gpu: string | null; dpr: number; cores: number }): QualityTier`, `type TierCaps = { ssao: boolean; dof: boolean; motionBlur: boolean; gpuParticles: boolean; maxParticles: number; hardwareScaling: number }`, `capsForTier(tier): TierCaps`, `createBestEngine(canvas: HTMLCanvasElement): Promise<Engine | WebGPUEngine>` — all from `./core/engine`, used by every later task.

- [ ] **Step 1: Write the failing tier test**

```ts
// space-sim/__tests__/tier.test.ts
import { describe, expect, it } from "vitest";
import { capsForTier, detectTier } from "../core/engine";

describe("detectTier", () => {
  it("returns high for desktop-class GPU at dpr 1", () => {
    expect(detectTier({ gpu: "NVIDIA GeForce RTX 3070", dpr: 1, cores: 16 })).toBe("high");
  });
  it("returns medium for integrated GPUs", () => {
    expect(detectTier({ gpu: "Apple M1", dpr: 2, cores: 8 })).toBe("medium");
  });
  it("returns low for mobile GPUs", () => {
    expect(detectTier({ gpu: "Apple A15 GPU", dpr: 3, cores: 6 })).toBe("low");
  });
  it("returns low when GPU string is unknown", () => {
    expect(detectTier({ gpu: null, dpr: 1, cores: 4 })).toBe("low");
  });
});

describe("capsForTier", () => {
  it("enables ssao/dof/motionBlur only on high", () => {
    expect(capsForTier("high").ssao).toBe(true);
    expect(capsForTier("medium").ssao).toBe(false);
    expect(capsForTier("medium").dof).toBe(true);
    expect(capsForTier("low").dof).toBe(false);
  });
  it("scales particles and hardware scaling by tier", () => {
    expect(capsForTier("high").maxParticles).toBeGreaterThan(capsForTier("medium").maxParticles);
    expect(capsForTier("low").hardwareScaling).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- space-sim/__tests__/tier.test.ts`
Expected: FAIL — cannot resolve `../core/engine`.

- [ ] **Step 3: Implement `core/engine.ts`**

```ts
// space-sim/core/engine.ts
import { Engine, WebGPUEngine } from "@babylonjs/core";

export type QualityTier = "high" | "medium" | "low";

export interface TierCaps {
  ssao: boolean; dof: boolean; motionBlur: boolean; gpuParticles: boolean;
  maxParticles: number; hardwareScaling: number;
}

/** Pure tier logic — unit tested. */
export function detectTier(info: { gpu: string | null; dpr: number; cores: number }): QualityTier {
  const gpu = (info.gpu ?? "").toLowerCase();
  const mobile = /mali|adreno|apple a\d|apple gpu|powervr|kirin|exynos/.test(gpu);
  const integrated = /apple m\d|iris|uhd|radeon\(tm\)|vega|arc /.test(gpu);
  if (mobile || info.gpu === null) return "low";
  if (integrated || info.cores <= 4) return "medium";
  if (info.dpr > 2.5) return "medium";
  return "high";
}

export function capsForTier(tier: QualityTier): TierCaps {
  switch (tier) {
    case "high":
      return { ssao: true, dof: true, motionBlur: true, gpuParticles: true, maxParticles: 12000, hardwareScaling: 1 };
    case "medium":
      return { ssao: false, dof: true, motionBlur: false, gpuParticles: true, maxParticles: 5000, hardwareScaling: 1 };
    case "low":
      return { ssao: false, dof: false, motionBlur: false, gpuParticles: false, maxParticles: 1800, hardwareScaling: 1.25 };
  }
}

export async function createBestEngine(canvas: HTMLCanvasElement): Promise<Engine | WebGPUEngine> {
  try {
    if (await WebGPUEngine.IsSupportedAsync) {
      const gpu = new WebGPUEngine({ canvas });
      await gpu.initAsync();
      return gpu;
    }
  } catch {
    // fall through to WebGL2
  }
  return new Engine(canvas, true, { stencil: false, powerPreference: "high-performance" });
}

/** Read a GPU renderer string when available (tier detection input). */
export function gpuString(engine: Engine | WebGPUEngine): string | null {
  const gl = (engine as Engine)._gl as WebGL2RenderingContext | undefined;
  if (gl) {
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (ext) return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
  }
  return null;
}
```

- [ ] **Step 4: Create `index.html` + `style.css`**

```html
<!-- space-sim/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
    <title>Artemis Transit — Space Simulator</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <div id="sim-root">
      <canvas id="render-canvas" touch-action="none"></canvas>
      <div id="ui-layer">
        <div id="cine-fade"></div>
        <div id="loading-screen" class="screen">
          <div class="loading-title">INITIALIZING MISSION</div>
          <div class="loading-bar"><div id="loading-fill"></div></div>
          <div id="loading-step"></div>
        </div>
        <div id="error-screen" class="screen hidden">
          <div class="loading-title">MISSION SYSTEM FAULT</div>
          <div id="error-text">The simulator could not initialize graphics.</div>
          <button id="error-retry" class="menu-btn">RETRY</button>
          <a href="/" class="menu-btn menu-link">EXIT TO HUB</a>
        </div>
      </div>
    </div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

```css
/* space-sim/style.css — base, loading, error, cinematic fade. HUD/menus added in Task 14. */
:root {
  --hud-fg: #cfe3ee; --hud-dim: #6d8494; --hud-accent: #7fd0ff;
  --hud-bg: rgba(8, 12, 16, 0.55); --hud-line: rgba(160, 200, 220, 0.35);
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
body { font-family: "IBM Plex Mono", "JetBrains Mono", ui-monospace, Menlo, monospace; color: var(--hud-fg); }
#sim-root { position: fixed; inset: 0; }
#render-canvas { width: 100%; height: 100%; display: block; outline: none; touch-action: none; }
#ui-layer { position: absolute; inset: 0; pointer-events: none; }
#ui-layer .screen, #ui-layer .menu-btn { pointer-events: auto; }
#cine-fade { position: absolute; inset: 0; background: #000; opacity: 0; pointer-events: none; z-index: 5; }
.screen { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 18px; align-items: center; justify-content: center;
  background: radial-gradient(ellipse at 50% 40%, rgba(10, 18, 26, 0.94), rgba(2, 4, 6, 0.99)); letter-spacing: 0.18em; z-index: 10; }
.hidden { display: none !important; }
.loading-title { font-size: 15px; color: var(--hud-accent); text-transform: uppercase; }
.loading-bar { width: min(420px, 70vw); height: 2px; background: rgba(127, 208, 255, 0.18); }
#loading-fill { height: 100%; width: 0%; background: var(--hud-accent); transition: width 0.2s ease; }
#loading-step { font-size: 11px; color: var(--hud-dim); text-transform: uppercase; min-height: 1em; }
.menu-btn { background: transparent; border: 1px solid var(--hud-line); color: var(--hud-fg); font: inherit; font-size: 12px;
  letter-spacing: 0.18em; text-transform: uppercase; padding: 10px 26px; cursor: pointer; text-decoration: none; }
.menu-btn:hover { border-color: var(--hud-accent); color: var(--hud-accent); }
#error-text { font-size: 12px; color: var(--hud-dim); max-width: 60ch; text-align: center; line-height: 1.6; }
```

- [ ] **Step 5: Create minimal `main.ts` boot (real scene assembly replaces this in Task 6)**

```ts
// space-sim/main.ts
import type { Engine, WebGPUEngine } from "@babylonjs/core";
import { capsForTier, createBestEngine, detectTier, gpuString } from "./core/engine";

type EngineLike = Engine | WebGPUEngine;

const canvas = document.getElementById("render-canvas") as HTMLCanvasElement;
const fill = document.getElementById("loading-fill")!;
const stepLabel = document.getElementById("loading-step")!;

export function setProgress(fraction: number, label: string): void {
  fill.style.width = `${Math.round(fraction * 100)}%`;
  stepLabel.textContent = label;
}

async function boot(): Promise<void> {
  setProgress(0.1, "Detecting graphics backend…");
  const engine = await createBestEngine(canvas);
  const tier = detectTier({ gpu: gpuString(engine), dpr: window.devicePixelRatio, cores: navigator.hardwareConcurrency || 4 });
  engine.setHardwareScalingLevel(capsForTier(tier).hardwareScaling);
  setProgress(0.4, `Graphics ready — ${tier.toUpperCase()} tier`);
  await new Promise((r) => setTimeout(r, 400));
  setProgress(1, "MISSION SYSTEM READY");
  await new Promise((r) => setTimeout(r, 500));
  document.getElementById("loading-screen")!.classList.add("hidden");
  void engine;
}

boot().catch((err: unknown) => {
  document.getElementById("loading-screen")!.classList.add("hidden");
  document.getElementById("error-screen")!.classList.remove("hidden");
  document.getElementById("error-text")!.textContent = `The simulator could not initialize graphics: ${String(err)}`;
});
```

- [ ] **Step 6: Run tests + build**

Run: `npm run test -- space-sim/__tests__/tier.test.ts && npm run build`
Expected: tier tests PASS; `vite build` succeeds (restores broken input) with `dist/space-sim/index.html` emitted.

- [ ] **Step 7: Visual verification**

Run `npm run dev`, open `http://localhost:5173/space-sim/`: loading bar fills and fades, no console errors.

- [ ] **Step 8: Commit**

```bash
git add space-sim && git commit -m "feat(space-sim): standalone Babylon app scaffold, engine + quality tiers"
```

---

### Task 2: Mission types, clock, state machine, script + integrity tests

**Files:**
- Create: `space-sim/mission/types.ts`, `space-sim/mission/engine.ts`, `space-sim/mission/script.ts`, `space-sim/cinema/registry.ts`
- Test: `space-sim/__tests__/mission-engine.test.ts`, `space-sim/__tests__/script.test.ts`

**Interfaces:**
- Produces (exact names used by all later tasks):
  - From `mission/engine.ts` (re-exported types): `MISSION_STATES: readonly MissionState[]`, `type Command = { kind: "ignite" | "liftoff" | "separateSrb" | "separateCore" | "orbitInsertion" | "dockContact" | "dockCapture" | "dockHard" | "openHatch" | "enterInterior" | "enablePlayer" }` variants, `interface CommsLine { speaker: string; text: string; style: "radio" | "pa" | "crew" }`, `interface HudChange { met?: boolean; phase?: string; telemetry?: "off" | "docking"; progressStage?: 1|2|3|4|5|6; countdown?: boolean }`, `interface FxCommand { smoke?: number; exposure?: number; shake?: number; glare?: number }`, `interface MissionEvent { id; state: MissionState; at: number; duration?: number; shot?: string; action?: Command; comms?: CommsLine; hud?: HudChange; fx?: FxCommand; transition?: "cut"|"dip"|"crossfade" }`, `interface MissionSinks { onCommand?(c,t); onComms?(c,t); onHud?(h,t); onFx?(f,t); onShot?(shot,duration,t); onTransition?(kind,t); onState?(prev,next,t) }`, `class MissionClock { paused; t; tick(dt); reset() }`, `class MissionEngine { constructor(script, sinks); current; t; stateDurations: Partial<Record<MissionState,number>>; update(dt); restart(); seekToState(state) }`
  - From `mission/script.ts`: `STATE_DURATIONS: Record<MissionState, number>`, `MISSION_SCRIPT: MissionEvent[]` (full ~90 events, all real dialogue).
  - From `cinema/registry.ts`: `SHOT_IDS: readonly string[]` (44 rig names).

- [ ] **Step 1: Write failing mission-engine tests**

```ts
// space-sim/__tests__/mission-engine.test.ts
import { describe, expect, it } from "vitest";
import { MISSION_STATES, MissionClock, MissionEngine, type MissionEvent } from "../mission/engine";

function tinyScript(): MissionEvent[] {
  return [
    { id: "e1", state: "MISSION_INIT", at: 0.5, hud: { phase: "INIT" } },
    { id: "e2", state: "MISSION_INIT", at: 1.5, action: { kind: "ignite" } },
    { id: "e3", state: "KSC_ESTABLISHING", at: 0, comms: { speaker: "PAO", text: "Standby.", style: "pa" } },
    { id: "e4", state: "KSC_ESTABLISHING", at: 2, shot: "est_wide" },
  ];
}
const D = { MISSION_INIT: 2, KSC_ESTABLISHING: 5 };

describe("MissionClock", () => {
  it("accumulates time only while unpaused", () => {
    const c = new MissionClock();
    c.tick(1); c.tick(2);
    expect(c.t).toBeCloseTo(3);
    c.paused = true; c.tick(10);
    expect(c.t).toBeCloseTo(3);
  });
  it("reset returns to zero", () => {
    const c = new MissionClock(); c.tick(5); c.reset();
    expect(c.t).toBe(0);
  });
});

describe("MissionEngine", () => {
  it("fires events in order and transitions states", () => {
    const seen: string[] = [];
    const eng = new MissionEngine(tinyScript(), {
      onHud: (h) => seen.push(`hud:${h.phase}`),
      onCommand: (c) => seen.push(`cmd:${c.kind}`),
      onState: (_p, n) => seen.push(`state:${n}`),
    });
    eng.stateDurations = D;
    eng.update(0.6);
    expect(seen).toEqual(["hud:INIT"]);
    eng.update(2.0);
    expect(seen).toEqual(["hud:INIT", "cmd:ignite", "state:KSC_ESTABLISHING"]);
    eng.update(4.0);
    expect(eng.current).toBe("KSC_ESTABLISHING");
  });

  it("is deterministic under different frame splits", () => {
    const run = (splits: number[]): MissionState => {
      const e = new MissionEngine(tinyScript(), {});
      e.stateDurations = D;
      for (const dt of splits) e.update(dt);
      return e.current;
    };
    expect(run([1, 1, 1])).toBe(run([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]));
    expect(run([1, 1, 1])).toBe("KSC_ESTABLISHING");
  });

  it("restart resets clock, state and replays from zero", () => {
    const eng = new MissionEngine(tinyScript(), {});
    eng.stateDurations = D;
    eng.update(6); eng.restart();
    expect(eng.t).toBe(0);
    expect(eng.current).toBe("MISSION_INIT");
    eng.update(0.6);
    expect(eng.current).toBe("MISSION_INIT");
  });

  it("seekToState fires only actions/hud/fx, skips shots/comms", () => {
    const seen: string[] = [];
    const eng = new MissionEngine(tinyScript(), {
      onShot: () => seen.push("shot"),
      onComms: () => seen.push("comms"),
      onHud: () => seen.push("hud"),
      onCommand: () => seen.push("cmd"),
    });
    eng.stateDurations = D;
    eng.seekToState("DOCKING_SEQUENCE");
    expect(eng.current).toBe("DOCKING_SEQUENCE");
    expect(seen).not.toContain("shot");
    expect(seen).not.toContain("comms");
    expect(seen).toContain("hud");
    expect(seen).toContain("cmd");
  });

  it("exposes the 20 ordered mission states", () => {
    expect(MISSION_STATES.length).toBe(20);
    expect(MISSION_STATES[0]).toBe("MISSION_INIT");
    expect(MISSION_STATES[19]).toBe("ISS_EXPLORATION");
  });
});
```

- [ ] **Step 2: Write failing script-integrity tests**

```ts
// space-sim/__tests__/script.test.ts
import { describe, expect, it } from "vitest";
import { MISSION_STATES } from "../mission/engine";
import { MISSION_SCRIPT, STATE_DURATIONS } from "../mission/script";
import { SHOT_IDS } from "../cinema/registry";

describe("STATE_DURATIONS", () => {
  it("defines all 20 states", () => {
    for (const s of MISSION_STATES) expect(STATE_DURATIONS[s]).toBeDefined();
  });
  it("sums to the approved 811s cinematic budget", () => {
    const total = MISSION_STATES.reduce((acc, s) => acc + STATE_DURATIONS[s], 0);
    expect(total).toBe(811);
  });
  it("uses the approved per-phase durations", () => {
    const want: Record<string, number> = {
      MISSION_INIT: 6, KSC_ESTABLISHING: 45, LAUNCH_PREPARATION: 70, CREW_PREPARATION: 50,
      COUNTDOWN: 80, ENGINE_IGNITION: 12, LIFTOFF: 28, ATMOSPHERIC_ASCENT: 75, BOOSTER_PHASE: 25,
      STAGE_TRANSITION: 30, ORBITAL_INSERTION: 25, ORBIT: 75, ISS_REVEAL: 50, ISS_APPROACH: 80,
      DOCKING_SEQUENCE: 100, DOCKING_COMPLETE: 12, CREW_TRANSFER: 33, ISS_INTERIOR_INTRO: 15,
      PLAYER_CONTROL_ENABLED: 0, ISS_EXPLORATION: Number.POSITIVE_INFINITY,
    };
    expect(STATE_DURATIONS).toEqual(want);
  });
});

describe("MISSION_SCRIPT integrity", () => {
  it("has unique event ids", () => {
    const ids = MISSION_SCRIPT.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("events fall within their state's duration (except terminal states)", () => {
    for (const e of MISSION_SCRIPT) {
      const dur = STATE_DURATIONS[e.state];
      if (!Number.isFinite(dur) || e.state === "PLAYER_CONTROL_ENABLED") continue;
      expect(e.at).toBeLessThanOrEqual(dur + 1e-9);
      expect(e.at).toBeGreaterThanOrEqual(0);
    }
  });
  it("covers every scripted state in mission order", () => {
    const scripted = new Set(MISSION_SCRIPT.map((e) => e.state));
    for (const s of MISSION_STATES) {
      if (s === "ISS_EXPLORATION") continue;
      expect(scripted.has(s)).toBe(true);
    }
  });
  it("every shot id references a registered rig", () => {
    for (const e of MISSION_SCRIPT) if (e.shot) expect(SHOT_IDS).toContain(e.shot);
  });
  it("has at least one event in every scripted state", () => {
    const counts = new Map<string, number>();
    for (const e of MISSION_SCRIPT) counts.set(e.state, (counts.get(e.state) ?? 0) + 1);
    for (const s of MISSION_STATES) {
      if (s === "ISS_EXPLORATION") continue;
      expect(counts.get(s) ?? 0).toBeGreaterThanOrEqual(1);
    }
  });
  it("enables the player exactly once, at PLAYER_CONTROL_ENABLED", () => {
    const enables = MISSION_SCRIPT.filter((e) => e.action?.kind === "enablePlayer");
    expect(enables.length).toBe(1);
    expect(enables[0].state).toBe("PLAYER_CONTROL_ENABLED");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test -- space-sim/__tests__/mission-engine.test.ts space-sim/__tests__/script.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `mission/types.ts` + `mission/engine.ts`**

```ts
// space-sim/mission/types.ts
export type MissionState =
  | "MISSION_INIT" | "KSC_ESTABLISHING" | "LAUNCH_PREPARATION" | "CREW_PREPARATION"
  | "COUNTDOWN" | "ENGINE_IGNITION" | "LIFTOFF" | "ATMOSPHERIC_ASCENT" | "BOOSTER_PHASE"
  | "STAGE_TRANSITION" | "ORBITAL_INSERTION" | "ORBIT" | "ISS_REVEAL" | "ISS_APPROACH"
  | "DOCKING_SEQUENCE" | "DOCKING_COMPLETE" | "CREW_TRANSFER" | "ISS_INTERIOR_INTRO"
  | "PLAYER_CONTROL_ENABLED" | "ISS_EXPLORATION";

export const MISSION_STATES: readonly MissionState[] = [
  "MISSION_INIT", "KSC_ESTABLISHING", "LAUNCH_PREPARATION", "CREW_PREPARATION",
  "COUNTDOWN", "ENGINE_IGNITION", "LIFTOFF", "ATMOSPHERIC_ASCENT", "BOOSTER_PHASE",
  "STAGE_TRANSITION", "ORBITAL_INSERTION", "ORBIT", "ISS_REVEAL", "ISS_APPROACH",
  "DOCKING_SEQUENCE", "DOCKING_COMPLETE", "CREW_TRANSFER", "ISS_INTERIOR_INTRO",
  "PLAYER_CONTROL_ENABLED", "ISS_EXPLORATION",
];

export type CommandKind =
  | "ignite" | "liftoff" | "separateSrb" | "separateCore" | "orbitInsertion"
  | "dockContact" | "dockCapture" | "dockHard" | "openHatch" | "enterInterior" | "enablePlayer";

export type Command = { kind: CommandKind };
export interface CommsLine { speaker: string; text: string; style: "radio" | "pa" | "crew" }
export interface HudChange { met?: boolean; phase?: string; telemetry?: "off" | "docking"; progressStage?: 1 | 2 | 3 | 4 | 5 | 6; countdown?: boolean }
export interface FxCommand { smoke?: number; exposure?: number; shake?: number; glare?: number }

export interface MissionEvent {
  id: string; state: MissionState; at: number; duration?: number; shot?: string;
  action?: Command; comms?: CommsLine; hud?: HudChange; fx?: FxCommand;
  transition?: "cut" | "dip" | "crossfade";
}
```

```ts
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
```

- [ ] **Step 5: Run mission-engine tests to verify they pass**

Run: `npm run test -- space-sim/__tests__/mission-engine.test.ts`
Expected: PASS (7 tests). Script tests still fail (no script.ts) — expected at this step.

- [ ] **Step 6: Implement `cinema/registry.ts` (shot names only, rigs in Task 3)**

```ts
// space-sim/cinema/registry.ts
/** Every shot id the mission script may reference. Rigs implemented in shots.ts (Task 3). */
export const SHOT_IDS = [
  "est_wide", "est_vab_crane", "vab_medium", "vab_closeup",
  "pad_wide", "tower_low", "tower_closeup", "rocket_closeup", "rocket_ecl",
  "crawler_ground", "svc_vehicles", "pad_ground_level",
  "plume_ground", "ignition_closeup", "rocket_side_track", "rocket_distant_track",
  "rocket_upward", "booster_cam", "horizon_ascent", "cockpit_orion",
  "stage_sep_side", "stage_sep_wide", "icps_perspective",
  "earth_wide", "earth_limb_drift", "sunrise_orbit", "orion_exterior_orbit",
  "orion_rear_orbit", "starfield_hold",
  "iss_reveal_far", "iss_reveal_close", "iss_approach_track", "docking_target_cam",
  "docking_side_cam", "docking_contact_ecl", "solar_array_perspective", "iss_earth_facing",
  "pov_crew_prep", "pov_hatch_open", "pov_transfer", "iss_interior_establish", "cupola_earth_gaze",
] as const;
```

- [ ] **Step 7: Implement `mission/script.ts` — full data-driven mission**

Durations sum to 811 s. All dialogue real. Write the complete file:

```ts
// space-sim/mission/script.ts
import type { MissionEvent, MissionState } from "./types";

export const STATE_DURATIONS: Record<MissionState, number> = {
  MISSION_INIT: 6, KSC_ESTABLISHING: 45, LAUNCH_PREPARATION: 70, CREW_PREPARATION: 50,
  COUNTDOWN: 80, ENGINE_IGNITION: 12, LIFTOFF: 28, ATMOSPHERIC_ASCENT: 75, BOOSTER_PHASE: 25,
  STAGE_TRANSITION: 30, ORBITAL_INSERTION: 25, ORBIT: 75, ISS_REVEAL: 50, ISS_APPROACH: 80,
  DOCKING_SEQUENCE: 100, DOCKING_COMPLETE: 12, CREW_TRANSFER: 33, ISS_INTERIOR_INTRO: 15,
  PLAYER_CONTROL_ENABLED: 0, ISS_EXPLORATION: Number.POSITIVE_INFINITY,
};

const E = (e: MissionEvent): MissionEvent => e;

export const MISSION_SCRIPT: MissionEvent[] = [
  // ---- MISSION_INIT (6s) ----
  E({ id: "init_01", state: "MISSION_INIT", at: 0, transition: "dip", hud: { met: true, phase: "ARTEMIS TRANSIT", progressStage: 1 } }),
  E({ id: "init_02", state: "MISSION_INIT", at: 2, comms: { speaker: "PAO", text: "Artemis Transit flight control is on console. Mission coverage begins shortly.", style: "pa" } }),
  // ---- KSC_ESTABLISHING (45s) ----
  E({ id: "ksc_01", state: "KSC_ESTABLISHING", at: 0, transition: "crossfade", shot: "est_wide", duration: 12, fx: { exposure: 0.9, glare: 0.4 },
      comms: { speaker: "PAO", text: "Kennedy Space Center, Florida. Six thirty-one a.m. Eastern.", style: "pa" } }),
  E({ id: "ksc_02", state: "KSC_ESTABLISHING", at: 12, transition: "cut", shot: "est_vab_crane", duration: 10, hud: { phase: "KENNEDY SPACE CENTER — LC-39" } }),
  E({ id: "ksc_03", state: "KSC_ESTABLISHING", at: 20, transition: "cut", shot: "vab_medium", duration: 8,
      comms: { speaker: "PAO", text: "The 325-foot Vehicle Assembly Building dominates the skyline — here, the Space Launch System that will carry Orion to the International Space Station was stacked.", style: "pa" } }),
  E({ id: "ksc_04", state: "KSC_ESTABLISHING", at: 28, transition: "cut", shot: "crawler_ground", duration: 9,
      comms: { speaker: "PAO", text: "Orion and the SLS ride the mobile launcher along the crawlerway to Pad 39-A.", style: "pa" } }),
  E({ id: "ksc_05", state: "KSC_ESTABLISHING", at: 37, transition: "cut", shot: "pad_wide", duration: 8, hud: { phase: "PAD 39-A — SLS / ORION" } }),
  // ---- LAUNCH_PREPARATION (70s) ----
  E({ id: "lp_01", state: "LAUNCH_PREPARATION", at: 0, transition: "cut", shot: "tower_low", duration: 10, hud: { phase: "LAUNCH PREPARATION — T-4 HOURS" },
      comms: { speaker: "CAPCOM", text: "Launch team is on console. Countdown clocks are running. T-minus four hours and holding for weather.", style: "radio" } }),
  E({ id: "lp_02", state: "LAUNCH_PREPARATION", at: 8, transition: "cut", shot: "svc_vehicles", duration: 8,
      comms: { speaker: "PAO", text: "Closeout crews service final consumables: cryogenic propellant, compressed gases, and electrical connections through the mobile launcher.", style: "pa" } }),
  E({ id: "lp_03", state: "LAUNCH_PREPARATION", at: 16, transition: "cut", shot: "rocket_closeup", duration: 9,
      comms: { speaker: "CAPCOM", text: "Frost lines are forming on the core stage — that's the cryo load doing its job.", style: "radio" } }),
  E({ id: "lp_04", state: "LAUNCH_PREPARATION", at: 25, transition: "cut", shot: "tower_closeup", duration: 8,
      comms: { speaker: "CAPCOM", text: "Swing arms are configured for launch. Weather is green across all recovery corridors.", style: "radio" } }),
  E({ id: "lp_05", state: "LAUNCH_PREPARATION", at: 33, transition: "cut", shot: "rocket_ecl", duration: 8,
      comms: { speaker: "PAO", text: "At 98 meters, the SLS is the most powerful rocket NASA has flown since the Saturn V.", style: "pa" } }),
  E({ id: "lp_06", state: "LAUNCH_PREPARATION", at: 41, transition: "cut", shot: "pad_ground_level", duration: 9,
      comms: { speaker: "CAPCOM", text: "Range is clear. Ground safety confirms pad perimeter is secure.", style: "radio" } }),
  E({ id: "lp_07", state: "LAUNCH_PREPARATION", at: 50, transition: "cut", shot: "pad_wide", duration: 10, fx: { exposure: 1.0 },
      comms: { speaker: "CAPCOM", text: "All stations, countdown will resume at T-minus one hour. Stand by for crew arrival.", style: "radio" } }),
  E({ id: "lp_08", state: "LAUNCH_PREPARATION", at: 60, transition: "cut", shot: "vab_closeup", duration: 10, hud: { phase: "LAUNCH PREPARATION — GO FOR TANKING" },
      comms: { speaker: "CAPCOM", text: "Launch vehicle is safed. Core stage tanking complete. Orion is configured for crew.", style: "radio" } }),
  // ---- CREW_PREPARATION (50s) ----
  E({ id: "cp_01", state: "CREW_PREPARATION", at: 0, transition: "dip", shot: "pov_crew_prep", duration: 12, hud: { phase: "CREW PREPARATION — O&C BUILDING" },
      comms: { speaker: "PAO", text: "Inside the Operations and Checkout Building, the crew suits up.", style: "pa" } }),
  E({ id: "cp_02", state: "CREW_PREPARATION", at: 10, comms: { speaker: "COMMANDER", text: "Com check. How do you hear me?", style: "radio" } }),
  E({ id: "cp_03", state: "CREW_PREPARATION", at: 18, comms: { speaker: "CAPCOM", text: "Read you loud and clear, Argo. You're one loud crew this morning.", style: "radio" } }),
  E({ id: "cp_04", state: "CREW_PREPARATION", at: 24, transition: "cut", shot: "cockpit_orion", duration: 12,
      comms: { speaker: "PAO", text: "The crew walks out, rides the elevator up the mobile launcher, and boards Orion through the crew access arm.", style: "pa" } }),
  E({ id: "cp_05", state: "CREW_PREPARATION", at: 36, comms: { speaker: "PILOT", text: "Restraints locked. Displays are up — vehicle looks beautiful from in here.", style: "crew" } }),
  E({ id: "cp_06", state: "CREW_PREPARATION", at: 44, transition: "cut", shot: "rocket_closeup", duration: 6,
      comms: { speaker: "CAPCOM", text: "Hatch is closed and locked. Cabin leak check in work.", style: "radio" } }),
  // ---- COUNTDOWN (80s) ----
  E({ id: "cd_01", state: "COUNTDOWN", at: 0, transition: "cut", shot: "pad_wide", duration: 10, hud: { phase: "FINAL COUNTDOWN", countdown: true },
      comms: { speaker: "CAPCOM", text: "T-minus ten minutes. All systems are nominal. Crew is ready.", style: "radio" } }),
  E({ id: "cd_02", state: "COUNTDOWN", at: 8, transition: "cut", shot: "tower_closeup", duration: 9,
      comms: { speaker: "CAPCOM", text: "Guidance is internal. Range is green.", style: "radio" } }),
  E({ id: "cd_03", state: "COUNTDOWN", at: 15, transition: "cut", shot: "rocket_side_track", duration: 8,
      comms: { speaker: "COMMANDER", text: "Orion's in the loop. We're go for launch.", style: "radio" } }),
  E({ id: "cd_04", state: "COUNTDOWN", at: 22, transition: "cut", shot: "vab_medium", duration: 8,
      comms: { speaker: "PAO", text: "T-minus five minutes. Inertial measurement alignment is complete.", style: "pa" } }),
  E({ id: "cd_05", state: "COUNTDOWN", at: 30, transition: "cut", shot: "rocket_ecl", duration: 8,
      comms: { speaker: "CAPCOM", text: "Flight computers are in startup. Launch vehicle is go.", style: "radio" } }),
  E({ id: "cd_06", state: "COUNTDOWN", at: 38, transition: "cut", shot: "pad_ground_level", duration: 10,
      comms: { speaker: "CAPCOM", text: "T-minus sixty seconds. Hydrogen burnoff igniters are active.", style: "radio" } }),
  E({ id: "cd_07", state: "COUNTDOWN", at: 48, transition: "cut", shot: "rocket_closeup", duration: 8,
      comms: { speaker: "CAPCOM", text: "Thirty seconds. Vehicle is on internal power. We are go for launch.", style: "radio" } }),
  E({ id: "cd_08", state: "COUNTDOWN", at: 56, transition: "cut", shot: "plume_ground", duration: 10,
      comms: { speaker: "CAPCOM", text: "Fifteen. Ten. Nine. Eight. Seven. Six.", style: "radio" } }),
  E({ id: "cd_09", state: "COUNTDOWN", at: 66, comms: { speaker: "CAPCOM", text: "Five. Four. Three. Two. One.", style: "radio" }, fx: { shake: 0.15 } }),
  E({ id: "cd_10", state: "COUNTDOWN", at: 74, comms: { speaker: "CAPCOM", text: "Ignition sequence start.", style: "radio" } }),
  // ---- ENGINE_IGNITION (12s) ----
  E({ id: "ig_01", state: "ENGINE_IGNITION", at: 0, transition: "cut", shot: "ignition_closeup", duration: 5, action: { kind: "ignite" }, fx: { shake: 0.6, exposure: 1.3, smoke: 1.0 },
      comms: { speaker: "CAPCOM", text: "Core stage engines are ignited.", style: "radio" } }),
  E({ id: "ig_02", state: "ENGINE_IGNITION", at: 5, transition: "cut", shot: "plume_ground", duration: 4,
      comms: { speaker: "PAO", text: "The four RS-25 engines build to full thrust — nearly nine million pounds with the boosters.", style: "pa" } }),
  E({ id: "ig_03", state: "ENGINE_IGNITION", at: 9, transition: "cut", shot: "tower_closeup", duration: 3,
      comms: { speaker: "CAPCOM", text: "All engines running. Booster ignition in three, two, one.", style: "radio" } }),
  // ---- LIFTOFF (28s) ----
  E({ id: "lo_01", state: "LIFTOFF", at: 0, transition: "cut", shot: "pad_ground_level", duration: 6, action: { kind: "liftoff" }, fx: { shake: 1.0, smoke: 1.0 },
      comms: { speaker: "CAPCOM", text: "Liftoff of Artemis Transit. The SLS has cleared Tower 39-A.", style: "radio" } }),
  E({ id: "lo_02", state: "LIFTOFF", at: 5, transition: "cut", shot: "rocket_side_track", duration: 7,
      comms: { speaker: "COMMANDER", text: "We have cleared the tower. Feels solid.", style: "radio" } }),
  E({ id: "lo_03", state: "LIFTOFF", at: 12, transition: "cut", shot: "rocket_distant_track", duration: 8, hud: { progressStage: 2 },
      comms: { speaker: "CAPCOM", text: "Vehicle is supersonic. Altitude four kilometers and climbing.", style: "radio" } }),
  E({ id: "lo_04", state: "LIFTOFF", at: 20, transition: "cut", shot: "rocket_upward", duration: 8,
      comms: { speaker: "PAO", text: "The twin solid rocket boosters burn for just over two minutes, providing most of the liftoff thrust.", style: "pa" } }),
  // ---- ATMOSPHERIC_ASCENT (75s) ----
  E({ id: "aa_01", state: "ATMOSPHERIC_ASCENT", at: 0, transition: "cut", shot: "booster_cam", duration: 8, hud: { phase: "ASCENT — MAX-Q" },
      comms: { speaker: "CAPCOM", text: "Max-Q. Maximum dynamic pressure.", style: "radio" } }),
  E({ id: "aa_02", state: "ATMOSPHERIC_ASCENT", at: 6, transition: "cut", shot: "horizon_ascent", duration: 9, fx: { exposure: 1.05 },
      comms: { speaker: "COMMANDER", text: "Throttling down through max-Q. Sky's getting dark up here.", style: "crew" } }),
  E({ id: "aa_03", state: "ATMOSPHERIC_ASCENT", at: 15, transition: "cut", shot: "cockpit_orion", duration: 8,
      comms: { speaker: "PILOT", text: "Cabin pressure nominal. Abort mode two armed.", style: "crew" } }),
  E({ id: "aa_04", state: "ATMOSPHERIC_ASCENT", at: 23, transition: "cut", shot: "rocket_distant_track", duration: 9,
      comms: { speaker: "CAPCOM", text: "Vehicle is through twenty kilometers. Trajectory is nominal.", style: "radio" } }),
  E({ id: "aa_05", state: "ATMOSPHERIC_ASCENT", at: 32, transition: "cut", shot: "stage_sep_side", duration: 7, action: { kind: "separateSrb" }, fx: { shake: 0.4 },
      comms: { speaker: "CAPCOM", text: "Booster separation confirmed.", style: "radio" } }),
  E({ id: "aa_06", state: "ATMOSPHERIC_ASCENT", at: 39, transition: "cut", shot: "horizon_ascent", duration: 9,
      comms: { speaker: "PAO", text: "The spent boosters fall away as the core stage carries Orion toward orbit on its RS-25 engines.", style: "pa" } }),
  E({ id: "aa_07", state: "ATMOSPHERIC_ASCENT", at: 48, transition: "cut", shot: "earth_wide", duration: 8, hud: { phase: "ASCENT — UPPER ATMOSPHERE" }, fx: { exposure: 0.95 } }),
  E({ id: "aa_08", state: "ATMOSPHERIC_ASCENT", at: 56, transition: "cut", shot: "rocket_upward", duration: 9,
      comms: { speaker: "CAPCOM", text: "Single engine core stage shutdown in preparation for staging.", style: "radio" } }),
  E({ id: "aa_09", state: "ATMOSPHERIC_ASCENT", at: 65, transition: "cut", shot: "stage_sep_wide", duration: 10, action: { kind: "separateCore" }, fx: { shake: 0.3 },
      comms: { speaker: "CAPCOM", text: "Core stage separation confirmed. ICPS is on the stack.", style: "radio" } }),
  // ---- BOOSTER_PHASE (25s) ----
  E({ id: "bp_01", state: "BOOSTER_PHASE", at: 0, transition: "cut", shot: "booster_cam", duration: 10, hud: { phase: "ASCENT — BOOSTER DESCENT" },
      comms: { speaker: "PAO", text: "The boosters tumble back toward the Atlantic, fitted with parachutes for recovery.", style: "pa" } }),
  E({ id: "bp_02", state: "BOOSTER_PHASE", at: 10, transition: "cut", shot: "icps_perspective", duration: 8,
      comms: { speaker: "COMMANDER", text: "We're riding quiet now. Good separation burn.", style: "crew" } }),
  E({ id: "bp_03", state: "BOOSTER_PHASE", at: 18, transition: "cut", shot: "starfield_hold", duration: 7, fx: { exposure: 0.9 } }),
  // ---- STAGE_TRANSITION (30s) ----
  E({ id: "st_01", state: "STAGE_TRANSITION", at: 0, transition: "cut", shot: "icps_perspective", duration: 10, hud: { phase: "ORBITAL BURN — ICPS" },
      comms: { speaker: "CAPCOM", text: "ICPS perigee raise burn, ten seconds.", style: "radio" } }),
  E({ id: "st_02", state: "STAGE_TRANSITION", at: 10, transition: "cut", shot: "earth_wide", duration: 12, fx: { exposure: 1.0 },
      comms: { speaker: "CAPCOM", text: "Burn is go. Velocity twenty-eight thousand kilometers per hour.", style: "radio" } }),
  E({ id: "st_03", state: "STAGE_TRANSITION", at: 22, transition: "cut", shot: "horizon_ascent", duration: 8,
      comms: { speaker: "CAPCOM", text: "Shutdown. Nominal insertion trajectory.", style: "radio" } }),
  // ---- ORBITAL_INSERTION (25s) ----
  E({ id: "oi_01", state: "ORBITAL_INSERTION", at: 0, transition: "cut", shot: "orion_exterior_orbit", duration: 10, action: { kind: "orbitInsertion" }, hud: { phase: "ORBITAL INSERTION", progressStage: 3 },
      comms: { speaker: "PAO", text: "Orion has separated from the ICPS. The spacecraft is now flying free in orbit, four hundred kilometers above Earth.", style: "pa" } }),
  E({ id: "oi_02", state: "ORBITAL_INSERTION", at: 10, transition: "cut", shot: "orion_rear_orbit", duration: 8,
      comms: { speaker: "COMMANDER", text: "Solar arrays deploying… arrays locked. Orion is healthy.", style: "crew" } }),
  E({ id: "oi_03", state: "ORBITAL_INSERTION", at: 18, transition: "cut", shot: "earth_limb_drift", duration: 7, fx: { exposure: 0.92, glare: 0.3 } }),
  // ---- ORBIT (75s) ----
  E({ id: "ob_01", state: "ORBIT", at: 0, transition: "dip", shot: "earth_wide", duration: 16, hud: { phase: "ORBIT — 400 KM" },
      comms: { speaker: "PAO", text: "From this altitude, the atmosphere is a thin blue line against the black of space.", style: "pa" } }),
  E({ id: "ob_02", state: "ORBIT", at: 14, transition: "cut", shot: "sunrise_orbit", duration: 14, fx: { exposure: 1.25, glare: 0.6 },
      comms: { speaker: "PILOT", text: "There's the sunrise. Sixteen orbits a day and it never gets old.", style: "crew" } }),
  E({ id: "ob_03", state: "ORBIT", at: 28, transition: "cut", shot: "orion_exterior_orbit", duration: 12,
      comms: { speaker: "CAPCOM", text: "Orion, Houston. You are go for far-field rendezvous with the International Space Station.", style: "radio" } }),
  E({ id: "ob_04", state: "ORBIT", at: 40, transition: "cut", shot: "starfield_hold", duration: 10, fx: { exposure: 0.85 },
      comms: { speaker: "COMMANDER", text: "Cabin lights down. Let's find the station.", style: "crew" } }),
  E({ id: "ob_05", state: "ORBIT", at: 50, transition: "cut", shot: "earth_limb_drift", duration: 12,
      comms: { speaker: "PAO", text: "Below, city lights trace the coastlines of the night side.", style: "pa" } }),
  E({ id: "ob_06", state: "ORBIT", at: 62, transition: "cut", shot: "orion_rear_orbit", duration: 13,
      comms: { speaker: "CAPCOM", text: "Radar has a track. Station is eighty kilometers ahead, closing slowly.", style: "radio" } }),
  // ---- ISS_REVEAL (50s) ----
  E({ id: "ir_01", state: "ISS_REVEAL", at: 0, transition: "dip", shot: "starfield_hold", duration: 12, hud: { phase: "APPROACH — ACQUIRING TARGET", progressStage: 4 },
      comms: { speaker: "PAO", text: "Out of the darkness, a structure takes shape — the International Space Station.", style: "pa" } }),
  E({ id: "ir_02", state: "ISS_REVEAL", at: 10, transition: "crossfade", shot: "iss_reveal_far", duration: 14, fx: { exposure: 1.0 } }),
  E({ id: "ir_03", state: "ISS_REVEAL", at: 24, transition: "cut", shot: "iss_reveal_close", duration: 14,
      comms: { speaker: "COMMANDER", text: "There she is. Solar wings are out. She looks great.", style: "crew" } }),
  E({ id: "ir_04", state: "ISS_REVEAL", at: 38, transition: "cut", shot: "solar_array_perspective", duration: 12,
      comms: { speaker: "PAO", text: "The station spans 109 meters — larger than a football field, home to crews continuously for over two decades.", style: "pa" } }),
  // ---- ISS_APPROACH (80s) ----
  E({ id: "ia_01", state: "ISS_APPROACH", at: 0, transition: "cut", shot: "iss_approach_track", duration: 14, hud: { phase: "APPROACH — R-BAR", telemetry: "docking" },
      comms: { speaker: "CAPCOM", text: "Orion, Houston. You are go for approach corridor entry. Station is in free drift.", style: "radio" } }),
  E({ id: "ia_02", state: "ISS_APPROACH", at: 12, transition: "cut", shot: "docking_target_cam", duration: 12,
      comms: { speaker: "CAPCOM", text: "Range two hundred meters. You're slightly left of the centerline — corrected.", style: "radio" } }),
  E({ id: "ia_03", state: "ISS_APPROACH", at: 24, transition: "cut", shot: "iss_earth_facing", duration: 12,
      comms: { speaker: "PILOT", text: "Station is holding attitude. Approach looks clean.", style: "crew" } }),
  E({ id: "ia_04", state: "ISS_APPROACH", at: 36, transition: "cut", shot: "iss_approach_track", duration: 14,
      comms: { speaker: "CAPCOM", text: "Hold at one hundred fifty meters. Attitude is stable — proceeding.", style: "radio" } }),
  E({ id: "ia_05", state: "ISS_APPROACH", at: 50, transition: "cut", shot: "docking_target_cam", duration: 14,
      comms: { speaker: "CAPCOM", text: "Range one hundred meters. Closing rate is nominal. Docking target alignment is good.", style: "radio" } }),
  E({ id: "ia_06", state: "ISS_APPROACH", at: 64, transition: "cut", shot: "orion_exterior_orbit", duration: 8, fx: { exposure: 0.98 },
      comms: { speaker: "COMMANDER", text: "Final approach mode. Taking it slow and steady.", style: "crew" } }),
  E({ id: "ia_07", state: "ISS_APPROACH", at: 72, transition: "cut", shot: "docking_side_cam", duration: 8,
      comms: { speaker: "CAPCOM", text: "Thirty meters. Stand by for soft capture sequence.", style: "radio" } }),
  // ---- DOCKING_SEQUENCE (100s) ----
  E({ id: "ds_01", state: "DOCKING_SEQUENCE", at: 0, transition: "cut", shot: "docking_target_cam", duration: 16, hud: { phase: "DOCKING — SOFT CAPTURE", telemetry: "docking" },
      comms: { speaker: "CAPCOM", text: "Range twenty meters. Closure rate five centimeters per second.", style: "radio" } }),
  E({ id: "ds_02", state: "DOCKING_SEQUENCE", at: 14, transition: "cut", shot: "docking_side_cam", duration: 14,
      comms: { speaker: "CAPCOM", text: "Ten meters. Alignment indicator is green across the board.", style: "radio" } }),
  E({ id: "ds_03", state: "DOCKING_SEQUENCE", at: 28, transition: "cut", shot: "docking_contact_ecl", duration: 14, action: { kind: "dockContact" }, fx: { shake: 0.08 },
      comms: { speaker: "CAPCOM", text: "Contact. Soft capture confirmed.", style: "radio" } }),
  E({ id: "ds_04", state: "DOCKING_SEQUENCE", at: 42, transition: "cut", shot: "docking_target_cam", duration: 12, action: { kind: "dockCapture" },
      comms: { speaker: "PAO", text: "Twelve hooks engage around the docking ring, pulling Orion to a hard seal.", style: "pa" } }),
  E({ id: "ds_05", state: "DOCKING_SEQUENCE", at: 54, transition: "cut", shot: "iss_earth_facing", duration: 12, action: { kind: "dockHard" }, fx: { shake: 0.05 },
      comms: { speaker: "CAPCOM", text: "Hard dock confirmed. Relative motion is zero. Orion and the International Space Station are one vehicle.", style: "radio" } }),
  E({ id: "ds_06", state: "DOCKING_SEQUENCE", at: 66, transition: "cut", shot: "docking_side_cam", duration: 12,
      comms: { speaker: "COMMANDER", text: "Copy hard dock. Pressure equalization in work.", style: "crew" } }),
  E({ id: "ds_07", state: "DOCKING_SEQUENCE", at: 78, transition: "cut", shot: "iss_reveal_close", duration: 10, hud: { telemetry: "off" },
      comms: { speaker: "CAPCOM", text: "Houston is showing vestibule pressure stable. You are go to open the hatches.", style: "radio" } }),
  E({ id: "ds_08", state: "DOCKING_SEQUENCE", at: 88, transition: "cut", shot: "orion_exterior_orbit", duration: 12,
      comms: { speaker: "PAO", text: "Docking complete — five hours and fifty-two minutes into the flight.", style: "pa" } }),
  // ---- DOCKING_COMPLETE (12s) ----
  E({ id: "dc_01", state: "DOCKING_COMPLETE", at: 0, transition: "cut", shot: "docking_contact_ecl", duration: 12, hud: { phase: "DOCKING COMPLETE", progressStage: 5 },
      comms: { speaker: "COMMANDER", text: "Thanks Houston. Let's go visit the neighbors.", style: "crew" } }),
  // ---- CREW_TRANSFER (33s) ----
  E({ id: "ct_01", state: "CREW_TRANSFER", at: 0, transition: "dip", shot: "pov_hatch_open", duration: 14, hud: { phase: "HATCH OPERATIONS" },
      comms: { speaker: "PAO", text: "Inside Orion, the crew equalizes the pressure, opens the forward hatch, and floats into the docking tunnel.", style: "pa" } }),
  E({ id: "ct_02", state: "CREW_TRANSFER", at: 12, action: { kind: "openHatch" },
      comms: { speaker: "COMMANDER", text: "Hatch is open. Here we go.", style: "crew" } }),
  E({ id: "ct_03", state: "CREW_TRANSFER", at: 21, transition: "cut", shot: "pov_transfer", duration: 12,
      comms: { speaker: "PILOT", text: "Hello, Harmony. It's been a while.", style: "crew" } }),
  // ---- ISS_INTERIOR_INTRO (15s) ----
  E({ id: "ii_01", state: "ISS_INTERIOR_INTRO", at: 0, transition: "dip", shot: "iss_interior_establish", duration: 15, action: { kind: "enterInterior" }, hud: { phase: "INTERNATIONAL SPACE STATION" },
      comms: { speaker: "PAO", text: "Welcome aboard. Beyond this vestibule: the laboratory, the Cupola, and the view of a lifetime.", style: "pa" } }),
  // ---- PLAYER_CONTROL_ENABLED (0s) ----
  E({ id: "pc_01", state: "PLAYER_CONTROL_ENABLED", at: 0, transition: "cut", shot: "cupola_earth_gaze", duration: 4, action: { kind: "enablePlayer" },
      hud: { phase: "EXPLORATION — YOU HAVE CONTROL", progressStage: 6 },
      comms: { speaker: "COMMANDER", text: "You have the vehicle. Explore the station — and don't miss the Cupola.", style: "crew" } }),
];
```

- [ ] **Step 8: Run all tests to verify they pass**

Run: `npm run test -- space-sim/__tests__/mission-engine.test.ts space-sim/__tests__/script.test.ts`
Expected: PASS (16 tests — 7 mission-engine + 9 script). If an `at` exceeds a duration, fix event data — never weaken the test.

- [ ] **Step 9: Commit**

```bash
git add space-sim/mission space-sim/cinema/registry.ts space-sim/__tests__ && git commit -m "feat(space-sim): mission state machine, clock, full mission script + integrity tests"
```

---

### Task 3: Cinematic director, camera rigs, transitions

**Files:**
- Create: `space-sim/cinema/shots.ts`, `space-sim/cinema/director.ts`, `space-sim/cinema/transitions.ts`
- Test: `space-sim/__tests__/director.test.ts`

**Interfaces:**
- Consumes: `SHOT_IDS` (Task 2); `MissionEngine` sinks `onShot`/`onTransition`.
- Produces:
  - `director.ts` (pure, testable): `hashRng(seed): number`, `pickNextShot(pool: string[], last: string | null, seed: number, fallback?: string[]): string`, `cutHoldSeconds(pacing: "dynamic" | "contemplative", seed: number): number`, `STATE_CINEMA: StateCinema` (per-state pools/pacing/fallbacks), `class CinematicDirector { constructor(lib: ShotLibrary, scene: Scene, transitions: TransitionLayer); playShot(id, duration, t); cut(kind); update(now, state, t) }`
  - `shots.ts`: `type RigKind`, `interface RigContext { scene: Scene; targetProviders: Record<string, () => TransformNode> }`, `interface CameraRig { id; kind; camera: UniversalCamera; activate(t); update(t) }`, `class ShotLibrary { constructor(ctx: RigContext); get(id): CameraRig | null }` — builds all 42 rigs from `SHOT_IDS`.
  - `transitions.ts`: `class TransitionLayer { constructor(root: HTMLElement); cut(kind) }`.
- World wiring contract (Tasks 6+ must provide these `targetProviders`): `"stack"` (rocket stack root), `"engines"` (RS-25 cluster), `"orion"` (Orion spacecraft), `"iss"` (ISS root), `"issInterior"` (interior spawn point node), `"crewQuarters"` (O&C building anchor at ground level, used by the `pov_crew_prep` rig).

- [ ] **Step 1: Write the failing director tests (pure logic only)**

```ts
// space-sim/__tests__/director.test.ts
import { describe, expect, it } from "vitest";
import { cutHoldSeconds, pickNextShot } from "../cinema/director";

describe("pickNextShot", () => {
  const pool = ["a", "b", "c"];
  it("never repeats the previous shot when alternatives exist", () => {
    for (let i = 0; i < 50; i++) {
      const pick = pickNextShot(pool, "a", i);
      expect(pick).not.toBe("a");
      expect(pool).toContain(pick);
    }
  });
  it("returns the only shot when pool has one entry", () => {
    expect(pickNextShot(["only"], "only", 0)).toBe("only");
  });
  it("falls back to fallback pool when primary is empty", () => {
    expect(pickNextShot([], "x", 0)).toBe("x");
    expect(pickNextShot([], null, 0, ["f1", "f2"])).toBe("f1");
  });
  it("is deterministic for a given seed", () => {
    expect(pickNextShot(pool, "a", 7)).toBe(pickNextShot(pool, "a", 7));
  });
});

describe("cutHoldSeconds", () => {
  it("returns 4–10s for dynamic pacing", () => {
    for (let i = 0; i < 30; i++) {
      const h = cutHoldSeconds("dynamic", i);
      expect(h).toBeGreaterThanOrEqual(4);
      expect(h).toBeLessThanOrEqual(10);
    }
  });
  it("returns 20–60s for contemplative pacing", () => {
    for (let i = 0; i < 30; i++) {
      const h = cutHoldSeconds("contemplative", i);
      expect(h).toBeGreaterThanOrEqual(20);
      expect(h).toBeLessThanOrEqual(60);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- space-sim/__tests__/director.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement pure logic in `cinema/director.ts` (pools + class)**

```ts
// space-sim/cinema/director.ts
import type { Scene } from "@babylonjs/core";

export type Pacing = "dynamic" | "contemplative";

/** Deterministic hash-based rng in [0,1). */
export function hashRng(seed: number): number {
  let x = (seed | 0) + 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 0xffffffff;
}

/** Pure pick: never repeats last when pool >1; falls back to fallback pool. */
export function pickNextShot(pool: string[], last: string | null, seed: number, fallback?: string[]): string {
  const candidates = pool.length > 0 ? pool : fallback ?? [];
  if (candidates.length === 0) return last ?? "";
  const filtered = candidates.length > 1 ? candidates.filter((s) => s !== last) : candidates;
  return filtered[Math.floor(hashRng(seed) * filtered.length) % filtered.length];
}

/** Pure cut-hold: dynamic 4–10s, contemplative 20–60s. */
export function cutHoldSeconds(pacing: Pacing, seed: number): number {
  const r = hashRng(seed * 7919 + 13);
  return pacing === "dynamic" ? 4 + r * 6 : 20 + r * 40;
}

export interface StateCinema {
  pools: Partial<Record<string, string[]>>;
  pacing: Partial<Record<string, Pacing>>;
  fallbackFor: Partial<Record<string, string[]>>;
}

export const STATE_CINEMA: StateCinema = {
  pools: {
    KSC_ESTABLISHING: ["est_wide", "est_vab_crane", "vab_medium", "pad_wide"],
    LAUNCH_PREPARATION: ["tower_low", "svc_vehicles", "rocket_closeup", "tower_closeup", "rocket_ecl", "pad_ground_level"],
    CREW_PREPARATION: ["pov_crew_prep", "cockpit_orion"],
    COUNTDOWN: ["pad_wide", "tower_closeup", "rocket_side_track", "vab_medium", "rocket_ecl", "pad_ground_level", "plume_ground"],
    ENGINE_IGNITION: ["ignition_closeup", "plume_ground", "tower_closeup"],
    LIFTOFF: ["pad_ground_level", "rocket_side_track", "rocket_distant_track", "rocket_upward"],
    ATMOSPHERIC_ASCENT: ["booster_cam", "horizon_ascent", "cockpit_orion", "rocket_distant_track", "stage_sep_side", "earth_wide", "rocket_upward"],
    BOOSTER_PHASE: ["booster_cam", "icps_perspective", "starfield_hold"],
    STAGE_TRANSITION: ["icps_perspective", "earth_wide", "horizon_ascent"],
    ORBITAL_INSERTION: ["orion_exterior_orbit", "orion_rear_orbit", "earth_limb_drift"],
    ORBIT: ["earth_wide", "sunrise_orbit", "orion_exterior_orbit", "starfield_hold", "earth_limb_drift", "orion_rear_orbit"],
    ISS_REVEAL: ["starfield_hold", "iss_reveal_far", "iss_reveal_close", "solar_array_perspective"],
    ISS_APPROACH: ["iss_approach_track", "docking_target_cam", "iss_earth_facing", "orion_exterior_orbit", "docking_side_cam"],
    DOCKING_SEQUENCE: ["docking_target_cam", "docking_side_cam", "docking_contact_ecl", "iss_earth_facing", "iss_reveal_close", "orion_exterior_orbit"],
    DOCKING_COMPLETE: ["docking_contact_ecl", "iss_reveal_close"],
    CREW_TRANSFER: ["pov_hatch_open", "pov_transfer"],
    ISS_INTERIOR_INTRO: ["iss_interior_establish"],
    PLAYER_CONTROL_ENABLED: ["cupola_earth_gaze"],
  },
  pacing: {
    KSC_ESTABLISHING: "contemplative", LAUNCH_PREPARATION: "dynamic", CREW_PREPARATION: "dynamic",
    COUNTDOWN: "dynamic", ENGINE_IGNITION: "dynamic", LIFTOFF: "dynamic",
    ATMOSPHERIC_ASCENT: "dynamic", BOOSTER_PHASE: "contemplative", STAGE_TRANSITION: "dynamic",
    ORBITAL_INSERTION: "contemplative", ORBIT: "contemplative", ISS_REVEAL: "contemplative",
    ISS_APPROACH: "contemplative", DOCKING_SEQUENCE: "contemplative", DOCKING_COMPLETE: "contemplative",
    CREW_TRANSFER: "contemplative", ISS_INTERIOR_INTRO: "contemplative", PLAYER_CONTROL_ENABLED: "contemplative",
  },
  fallbackFor: {
    pov_crew_prep: ["cockpit_orion"],
    cockpit_orion: ["rocket_closeup"],
    docking_contact_ecl: ["docking_target_cam"],
    iss_interior_establish: ["pov_transfer"],
    cupola_earth_gaze: ["iss_interior_establish"],
    pov_hatch_open: ["pov_transfer"],
    pov_transfer: ["iss_interior_establish"],
    ignition_closeup: ["plume_ground"],
    stage_sep_side: ["rocket_distant_track"],
    stage_sep_wide: ["rocket_distant_track"],
  },
};

interface RigLike { activate(t: number): void; update(t: number): void; camera: unknown }

export class CinematicDirector {
  private seed = 1;
  private last: string | null = null;
  private holdUntil = 0;
  constructor(
    private lib: { get(id: string): RigLike | null },
    private scene: Scene,
    private transitions: { cut(kind: "cut" | "dip" | "crossfade"): void },
  ) {}

  playShot(id: string, _duration: number, t: number): void {
    const rig = this.lib.get(id);
    if (!rig) return;
    this.scene.activeCamera = rig.camera as Scene["activeCamera"];
    rig.activate(t);
    this.last = id;
    this.seed = (this.seed * 31 + id.length * 101) | 0;
  }

  cut(kind: "cut" | "dip" | "crossfade"): void {
    this.transitions.cut(kind);
  }

  /** Per-frame; auto-advances cuts within a state when no scripted shot is active. */
  update(now: number, state: string, t: number): void {
    const pool = STATE_CINEMA.pools[state] ?? [];
    const fb = STATE_CINEMA.fallbackFor[this.last ?? ""] ?? [];
    const pacing = STATE_CINEMA.pacing[state] ?? "dynamic";
    const currentDead = this.last !== null && this.lib.get(this.last) === null;
    if (now >= this.holdUntil || this.last === null || currentDead) {
      const id = pickNextShot(pool, this.last, this.seed, fb);
      if (id) {
        if (id !== this.last) this.playShot(id, 0, t);
        this.holdUntil = now + cutHoldSeconds(pacing, this.seed);
      }
    }
    const rig = this.last ? this.lib.get(this.last) : null;
    rig?.update(t);
  }
}
```

- [ ] **Step 4: Implement `cinema/shots.ts` — all 42 rigs**

Camera conventions: every rig uses a `UniversalCamera` with `minZ = 0.1`, `maxZ = 2.5e7`; rigs anchored to entities use `targetProviders`. Full implementation:

```ts
// space-sim/cinema/shots.ts
import { UniversalCamera, Vector3, type Scene, type TransformNode } from "@babylonjs/core";

export type RigKind = "static" | "crane" | "orbit" | "track" | "pov" | "drift";

export interface RigContext {
  scene: Scene;
  targetProviders: Record<string, () => TransformNode | undefined>;
}

export interface CameraRig {
  id: string; kind: RigKind; camera: UniversalCamera;
  activate(t: number): void; update(t: number): void;
}

type Target = () => TransformNode | undefined;

function makeCam(scene: Scene, id: string, pos: Vector3, fov = 0.9): UniversalCamera {
  const cam = new UniversalCamera(id, pos, scene);
  cam.minZ = 0.1;
  cam.maxZ = 2.5e7;
  cam.fov = fov;
  return cam;
}

function lookAt(cam: UniversalCamera, target: Vector3): void {
  cam.setTarget(target, Vector3.Up());
}

export class ShotLibrary {
  private rigs = new Map<string, CameraRig>();
  private t0 = 0;

  constructor(private ctx: RigContext) {
    this.buildEnvironment();
    this.buildLaunch();
    this.buildOrbit();
    this.buildIss();
    this.buildInterior();
  }

  get(id: string): CameraRig | null { return this.rigs.get(id) ?? null; }
  ids(): string[] { return [...this.rigs.keys()]; }
  private add(rig: CameraRig): void { this.rigs.set(rig.id, rig); }
  private target(name: string): Target { return () => this.ctx.targetProviders[name]?.(); }
  /** Follow provider target with world offset; wobble adds gentle handheld drift. */
  private followRig(id: string, kind: RigKind, targetName: string, offset: Vector3, fov = 0.8, wobble = 0): void {
    const cam = makeCam(this.ctx.scene, `cam_${id}`, offset, fov);
    const get = this.target(targetName);
    const apply = (t: number): void => {
      const node = get();
      if (!node) return;
      const p = node.getAbsolutePosition();
      cam.position.copyFrom(p.add(offset));
      if (wobble > 0) {
        cam.position.y += Math.sin(t * 0.7) * wobble;
        cam.position.x += Math.cos(t * 0.5) * wobble * 0.6;
      }
      lookAt(cam, p);
    };
    this.add({ id, kind, camera: cam, activate: apply, update: apply });
  }

  private buildEnvironment(): void {
    const s = this.ctx.scene;
    const est = makeCam(s, "cam_est_wide", new Vector3(1800, 90, 500), 0.85);
    this.add({ id: "est_wide", kind: "crane", camera: est,
      activate: (t) => { this.t0 = t; est.position.set(1800, 90, 500); lookAt(est, new Vector3(0, 40, 0)); },
      update: (t) => {
        const k = Math.min(1, Math.max(0, (t - this.t0) / 14));
        est.position.set(1800 - 600 * k, 90 - 55 * k, 500 + 150 * k);
        lookAt(est, new Vector3(0, 40 + 10 * k, 0));
      } });
    const crane = makeCam(s, "cam_est_vab_crane", new Vector3(-3200, 8, -2350), 0.8);
    this.add({ id: "est_vab_crane", kind: "crane", camera: crane,
      activate: (t) => { this.t0 = t; crane.position.set(-3200, 8, -2350); },
      update: (t) => {
        const k = Math.min(1, Math.max(0, (t - this.t0) / 10));
        crane.position.y = 8 + 150 * k;
        lookAt(crane, new Vector3(-3200, 70 + 30 * k, -2800));
      } });
    const vabMed = makeCam(s, "cam_vab_medium", new Vector3(-2850, 60, -2100));
    this.add({ id: "vab_medium", kind: "static", camera: vabMed, activate: () => lookAt(vabMed, new Vector3(-3200, 70, -2800)), update: () => {} });
    const vabClose = makeCam(s, "cam_vab_closeup", new Vector3(-3080, 25, -2500), 0.6);
    this.add({ id: "vab_closeup", kind: "static", camera: vabClose, activate: () => lookAt(vabClose, new Vector3(-3200, 45, -2800)), update: () => {} });
    const padWide = makeCam(s, "cam_pad_wide", new Vector3(-260, 35, -260));
    this.add({ id: "pad_wide", kind: "orbit", camera: padWide,
      activate: (t) => { this.t0 = t; },
      update: (t) => {
        const a = (t - this.t0) * 0.02;
        padWide.position.set(-260 * Math.cos(a), 35, -260 * Math.sin(a));
        lookAt(padWide, new Vector3(0, 45, 0));
      } });
    const towerLow = makeCam(s, "cam_tower_low", new Vector3(30, 3, -55), 1.0);
    this.add({ id: "tower_low", kind: "static", camera: towerLow, activate: () => lookAt(towerLow, new Vector3(0, 70, 0)), update: () => {} });
    const towerClose = makeCam(s, "cam_tower_closeup", new Vector3(-18, 60, -30), 0.55);
    this.add({ id: "tower_closeup", kind: "static", camera: towerClose, activate: () => lookAt(towerClose, new Vector3(6, 55, 8)), update: () => {} });
    const ground = makeCam(s, "cam_pad_ground_level", new Vector3(-140, 2.5, 40), 0.95);
    this.add({ id: "pad_ground_level", kind: "static", camera: ground, activate: () => lookAt(ground, new Vector3(0, 50, 0)), update: () => {} });
    const crawler = makeCam(s, "cam_crawler_ground", new Vector3(-1500, 2.2, -1700), 1.05);
    this.add({ id: "crawler_ground", kind: "crane", camera: crawler,
      activate: (t) => { this.t0 = t; },
      update: (t) => {
        const k = Math.min(1, Math.max(0, (t - this.t0) / 9));
        crawler.position.set(-1500 + 400 * k, 2.2, -1700 + 300 * k);
        lookAt(crawler, new Vector3(0, 30, 0));
      } });
    const svc = makeCam(s, "cam_svc_vehicles", new Vector3(60, 4, -80), 0.85);
    this.add({ id: "svc_vehicles", kind: "static", camera: svc, activate: () => lookAt(svc, new Vector3(20, 2, -30)), update: () => {} });
    this.followRig("rocket_closeup", "track", "stack", new Vector3(25, 25, 25), 0.5);
    this.followRig("rocket_ecl", "track", "stack", new Vector3(12, -30, 12), 0.35);
  }

  private buildLaunch(): void {
    this.followRig("plume_ground", "track", "stack", new Vector3(-90, -2, 60), 0.8);
    this.followRig("ignition_closeup", "track", "engines", new Vector3(-28, -2, 18), 0.6);
    this.followRig("rocket_side_track", "track", "stack", new Vector3(120, 20, 0), 0.7);
    this.followRig("rocket_distant_track", "track", "stack", new Vector3(600, 100, -200), 0.6);
    this.followRig("rocket_upward", "track", "stack", new Vector3(6, -120, 6), 1.1);
    this.followRig("booster_cam", "track", "stack", new Vector3(9, -40, 0), 0.9, 0.4);
    this.followRig("horizon_ascent", "track", "stack", new Vector3(25, 60, 150), 1.0);
    this.followRig("cockpit_orion", "pov", "stack", new Vector3(0, -2.2, -1.2), 0.85, 0.15);
    this.followRig("stage_sep_side", "track", "stack", new Vector3(18, -5, 0), 0.75);
    this.followRig("stage_sep_wide", "track", "stack", new Vector3(45, -25, 30), 0.9);
    this.followRig("icps_perspective", "track", "stack", new Vector3(8, 6, -14), 0.8);
  }

  private buildOrbit(): void {
    const ORBIT_Y = 6371000 + 400000;
    const orbitRig = (id: string, kind: RigKind, dir: Vector3, dist: number, fov = 0.85, wobble = 0): void => {
      const cam = makeCam(this.ctx.scene, `cam_${id}`, dir.scale(dist).add(new Vector3(0, ORBIT_Y, 0)), fov);
      const get = this.target("orion");
      const apply = (t: number): void => {
        const node = get();
        if (!node) return;
        const p = node.getAbsolutePosition();
        cam.position.copyFrom(p.add(dir.scale(dist)));
        if (wobble > 0) {
          cam.position.y += Math.sin(t * 0.6) * wobble;
          cam.position.x += Math.cos(t * 0.4) * wobble * 0.7;
        }
        lookAt(cam, p);
      };
      this.add({ id, kind, camera: cam, activate: apply, update: apply });
    };
    orbitRig("earth_wide", "orbit", new Vector3(0.5, 0.15, 0.85).normalize(), 220, 1.0);
    orbitRig("earth_limb_drift", "drift", new Vector3(-0.7, 0.05, 0.7).normalize(), 90, 0.9, 0.8);
    orbitRig("sunrise_orbit", "orbit", new Vector3(0.9, 0.02, -0.4).normalize(), 140, 0.95);
    orbitRig("orion_exterior_orbit", "orbit", new Vector3(0.2, 0.25, 0.95).normalize(), 35, 0.7);
    orbitRig("orion_rear_orbit", "track", new Vector3(0, -0.1, -1).normalize(), 25, 0.75);
    orbitRig("solar_array_perspective", "track", new Vector3(0.6, 0.1, 0.8).normalize(), 14, 0.85);
    const stars = makeCam(this.ctx.scene, "cam_starfield_hold", new Vector3(0, ORBIT_Y, 0), 1.2);
    this.add({ id: "starfield_hold", kind: "drift", camera: stars,
      activate: () => stars.position.set(0, ORBIT_Y, 0),
      update: (t) => { stars.rotation.y = t * 0.004; } });
  }

  private buildIss(): void {
    const ORBIT_Y = 6371000 + 400000;
    const issRig = (id: string, kind: RigKind, offset: Vector3, fov = 0.75): void => {
      const cam = makeCam(this.ctx.scene, `cam_${id}`, offset.add(new Vector3(0, ORBIT_Y, 0)), fov);
      const get = this.target("iss");
      const apply = (t: number): void => {
        const node = get();
        if (!node) return;
        const p = node.getAbsolutePosition();
        cam.position.copyFrom(p.add(offset));
        if (kind !== "static") {
          cam.position.y += Math.sin(t * 0.5) * 0.3;
        }
        lookAt(cam, p);
      };
      this.add({ id, kind, camera: cam, activate: apply, update: apply });
    };
    issRig("iss_reveal_far", "orbit", new Vector3(350, 60, 350));
    issRig("iss_reveal_close", "orbit", new Vector3(120, 20, 90));
    issRig("iss_approach_track", "track", new Vector3(30, 6, 55));
    issRig("docking_target_cam", "track", new Vector3(0, 0.4, 12), 0.5);
    issRig("docking_side_cam", "track", new Vector3(9, 2, 8), 0.7);
    issRig("docking_contact_ecl", "track", new Vector3(3.5, 0.8, 3), 0.45);
    issRig("iss_earth_facing", "static", new Vector3(-60, -15, 0), 0.95);
  }

  private buildInterior(): void {
    const ORBIT_Y = 6371000 + 400000;
    const intRig = (id: string, offset: Vector3, look: Vector3, fov = 0.9): void => {
      const cam = makeCam(this.ctx.scene, `cam_${id}`, offset.add(new Vector3(0, ORBIT_Y, 0)), fov);
      const get = this.target("issInterior");
      const apply = (): void => {
        const node = get();
        if (!node) return;
        const p = node.getAbsolutePosition();
        cam.position.copyFrom(p.add(offset));
        lookAt(cam, p.add(look));
      };
      this.add({ id, kind: "static", camera: cam, activate: apply, update: apply });
    };
    intRig("iss_interior_establish", new Vector3(0, 0, -6), new Vector3(0, 0, 6));
    intRig("cupola_earth_gaze", new Vector3(0, -0.3, -1.2), new Vector3(0, -1.5, 0.5), 0.8);
    intRig("pov_hatch_open", new Vector3(0, 0, -2.2), new Vector3(0, 0, 2), 0.85);
    intRig("pov_transfer", new Vector3(0, 0, -1), new Vector3(0, 0, 3), 0.9);
    // Crew prep POV anchors to the O&C crew-quarters node on the GROUND (provider "crewQuarters"),
    // NOT the ISS interior — crew prep happens before launch.
    const prepCam = makeCam(this.ctx.scene, "cam_pov_crew_prep", new Vector3(-3050, 1.6, -2850), 0.9);
    const prepGet = this.target("crewQuarters");
    const prepApply = (): void => {
      const node = prepGet();
      if (!node) return;
      const p = node.getAbsolutePosition();
      prepCam.position.copyFrom(p.add(new Vector3(0, 0.9, 0)));
      prepCam.setTarget(p.add(new Vector3(0, 0.8, -1)), Vector3.Up());
    };
    this.add({ id: "pov_crew_prep", kind: "pov", camera: prepCam, activate: prepApply, update: prepApply });
  }
}
```

- [ ] **Step 5: Implement `cinema/transitions.ts`**

```ts
// space-sim/cinema/transitions.ts
export class TransitionLayer {
  private el: HTMLElement | null;
  constructor(root: HTMLElement) {
    this.el = document.getElementById("cine-fade");
  }
  cut(kind: "cut" | "dip" | "crossfade"): void {
    const el = this.el;
    if (!el || kind === "cut") return;
    const dipMs = kind === "dip" ? 900 : 450;
    el.style.transition = "none";
    el.style.opacity = "1";
    void (el as HTMLElement).offsetWidth; // force reflow
    el.style.transition = `opacity ${dipMs}ms ease`;
    el.style.opacity = "0";
  }
}
```

- [ ] **Step 6: Run tests to verify they pass + verify rig coverage**

Run: `npm run test -- space-sim/__tests__/director.test.ts`
Expected: PASS (6 tests). Then verify rig coverage by inspection: 11 environment + 11 launch + 7 orbit + 7 ISS + 6 interior = 42 rigs; every `SHOT_IDS` entry must have a rig — `grep` the rig ids against `SHOT_IDS` before commit.

- [ ] **Step 7: Commit**

```bash
git add space-sim/cinema space-sim/__tests__/director.test.ts && git commit -m "feat(space-sim): cinematic director, 42 camera rigs, transitions"
```

---

### Task 4: Procedural noise + material factory

**Files:**
- Create: `space-sim/core/noise.ts`, `space-sim/core/assets.ts`
- Test: `space-sim/__tests__/noise.test.ts`

**Interfaces:**
- Produces:
  - `noise.ts`: `valueNoise2(x, y): number`, `valueNoise3(x, y, z): number` in `[-1, 1]` deterministic; `fbm2(x, y, octaves): number`, `fbm3(x, y, z, octaves): number` in `[-1, 1]`.
  - `assets.ts`: `interface Assets` with getters `concrete(): PBRMaterial; asphalt(): PBRMaterial; grass(): PBRMaterial; marsh(): PBRMaterial; steelStructure(): PBRMaterial; paintedWhite(): PBRMaterial; foamOrange(): PBRMaterial; srbWhite(): PBRMaterial; foilGold(): PBRMaterial; solarCell(): PBRMaterial; radiator(): PBRMaterial; silverHull(): PBRMaterial; blackTile(): PBRMaterial; concretePad(): PBRMaterial; interiorWall(): PBRMaterial; handrail(): PBRMaterial; fabricBag(): PBRMaterial; laptop(): PBRMaterial; labelCanvas(text, w?, h?): DynamicTexture`, and `createAssets(scene: Scene): Assets`.

- [ ] **Step 1: Write the failing noise tests**

```ts
// space-sim/__tests__/noise.test.ts
import { describe, expect, it } from "vitest";
import { fbm2, fbm3, valueNoise2, valueNoise3 } from "../core/noise";

describe("valueNoise", () => {
  it("is deterministic", () => {
    expect(valueNoise3(1.2, 3.4, 5.6)).toBe(valueNoise3(1.2, 3.4, 5.6));
    expect(valueNoise2(7.7, 2.2)).toBe(valueNoise2(7.7, 2.2));
  });
  it("stays in [-1, 1]", () => {
    for (let i = 0; i < 500; i++) {
      const v = valueNoise3(i * 0.137, i * 0.291, i * 0.431);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
  it("is continuous across integer lattice", () => {
    expect(Math.abs(valueNoise2(2.0, 3.0) - valueNoise2(2.0001, 3.0001))).toBeLessThan(0.05);
  });
});

describe("fbm", () => {
  it("adds octaves deterministically and stays in [-1, 1]", () => {
    for (let i = 0; i < 300; i++) {
      const v = fbm3(i * 0.05, i * 0.037, i * 0.021, 5);
      expect(v).toBeGreaterThanOrEqual(-1.001);
      expect(v).toBeLessThanOrEqual(1.001);
    }
    expect(fbm2(1, 1, 4)).toBe(fbm2(1, 1, 4));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- space-sim/__tests__/noise.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `core/noise.ts`**

```ts
// space-sim/core/noise.ts
function hash2(ix: number, iy: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}
function hash3(ix: number, iy: number, iz: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(iz, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}
const smooth = (t: number): number => t * t * (3 - 2 * t);

export function valueNoise2(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smooth(x - ix), fy = smooth(y - iy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  const top = a + (b - a) * fx, bottom = c + (d - c) * fx;
  return (top + (bottom - top) * fy) * 2 - 1;
}

export function valueNoise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
  const n = (dx: number, dy: number, dz: number): number => hash3(ix + dx, iy + dy, iz + dz);
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
  const layer = (dz: number): number => lerp(lerp(n(0, 0, dz), n(1, 0, dz), fx), lerp(n(0, 1, dz), n(1, 1, dz), fx), fy);
  return lerp(layer(0), layer(1), fz) * 2 - 1;
}

export function fbm2(x: number, y: number, octaves: number): number {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2(x * freq, y * freq) * amp;
    norm += amp; amp *= 0.5; freq *= 2.03;
  }
  return sum / norm;
}

export function fbm3(x: number, y: number, z: number, octaves: number): number {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise3(x * freq, y * freq, z * freq) * amp;
    norm += amp; amp *= 0.5; freq *= 2.03;
  }
  return sum / norm;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- space-sim/__tests__/noise.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement `core/assets.ts` — full PBR material factory**

```ts
// space-sim/core/assets.ts
import { DynamicTexture, PBRMaterial, type Scene } from "@babylonjs/core";
import { fbm2 } from "./noise";

type Ctx = CanvasRenderingContext2D;

function canvasTex(scene: Scene, name: string, w: number, h: number, draw: (ctx: Ctx) => void): DynamicTexture {
  const tex = new DynamicTexture(name, { width: w, height: h }, scene, true);
  const ctx = tex.getContext() as unknown as Ctx;
  draw(ctx);
  tex.update();
  return tex;
}

function bumpy(ctx: Ctx, w: number, h: number, scale: number, octaves: number, strength: number): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = fbm2((x / w) * scale, (y / h) * scale, octaves);
      const k = (y * w + x) * 4;
      const m = 1 + n * strength;
      d[k] = Math.min(255, Math.max(0, d[k] * m));
      d[k + 1] = Math.min(255, Math.max(0, d[k + 1] * m));
      d[k + 2] = Math.min(255, Math.max(0, d[k + 2] * m));
    }
  }
  ctx.putImageData(img, 0, 0);
}

function streaks(ctx: Ctx, w: number, h: number, count: number, alpha: number): void {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y0 = Math.random() * h * 0.3;
    const len = h * (0.2 + Math.random() * 0.6);
    const g = ctx.createLinearGradient(x, y0, x, y0 + len);
    g.addColorStop(0, `rgba(60,45,35,${alpha * Math.random()})`);
    g.addColorStop(1, "rgba(60,45,35,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y0, 1 + Math.random() * 2.5, len);
  }
}

export interface Assets {
  concrete(): PBRMaterial; asphalt(): PBRMaterial; grass(): PBRMaterial; marsh(): PBRMaterial;
  steelStructure(): PBRMaterial; paintedWhite(): PBRMaterial; foamOrange(): PBRMaterial;
  srbWhite(): PBRMaterial; foilGold(): PBRMaterial; solarCell(): PBRMaterial; radiator(): PBRMaterial;
  silverHull(): PBRMaterial; blackTile(): PBRMaterial; concretePad(): PBRMaterial;
  interiorWall(): PBRMaterial; handrail(): PBRMaterial; fabricBag(): PBRMaterial; laptop(): PBRMaterial;
  labelCanvas(text: string, w?: number, h?: number): DynamicTexture;
}

export function createAssets(scene: Scene): Assets {
  const cache = new Map<string, PBRMaterial>();
  const memo = (key: string, make: () => PBRMaterial): PBRMaterial => {
    let m = cache.get(key);
    if (!m) { m = make(); cache.set(key, m); }
    return m;
  };
  const tex = (name: string, w: number, h: number, draw: (c: Ctx) => void): DynamicTexture =>
    canvasTex(scene, name, w, h, draw);
  const pbr = (name: string): PBRMaterial => {
    const m = new PBRMaterial(name, scene);
    m.metallic = 0; m.roughness = 0.9;
    return m;
  };

  const concrete = (): PBRMaterial => memo("concrete", () => {
    const m = pbr("concrete");
    m.albedoTexture = tex("concrete_alb", 512, 512, (c) => {
      c.fillStyle = "#8f8d86"; c.fillRect(0, 0, 512, 512);
      bumpy(c, 512, 512, 24, 5, 0.25);
    });
    return m;
  });

  const concretePad = (): PBRMaterial => memo("concretePad", () => {
    const m = pbr("concretePad");
    m.albedoTexture = tex("pad_alb", 1024, 1024, (c) => {
      c.fillStyle = "#77746c"; c.fillRect(0, 0, 1024, 1024);
      bumpy(c, 1024, 1024, 14, 5, 0.3);
      c.strokeStyle = "rgba(20,20,20,0.55)"; c.lineWidth = 3;
      for (let i = 0; i <= 8; i++) {
        c.beginPath(); c.moveTo((i * 1024) / 8, 0); c.lineTo((i * 1024) / 8, 1024); c.stroke();
        c.beginPath(); c.moveTo(0, (i * 1024) / 8); c.lineTo(1024, (i * 1024) / 8); c.stroke();
      }
      const g = c.createRadialGradient(512, 512, 60, 512, 512, 340);
      g.addColorStop(0, "rgba(25,18,14,0.9)"); g.addColorStop(1, "rgba(25,18,14,0)");
      c.fillStyle = g; c.fillRect(0, 0, 1024, 1024);
    });
    return m;
  });

  const asphalt = (): PBRMaterial => memo("asphalt", () => {
    const m = pbr("asphalt");
    m.albedoTexture = tex("asphalt_alb", 512, 512, (c) => {
      c.fillStyle = "#3c3d3f"; c.fillRect(0, 0, 512, 512);
      bumpy(c, 512, 512, 48, 4, 0.35);
    });
    return m;
  });

  const grass = (): PBRMaterial => memo("grass", () => {
    const m = pbr("grass");
    m.albedoTexture = tex("grass_alb", 512, 512, (c) => {
      c.fillStyle = "#5a6b3a"; c.fillRect(0, 0, 512, 512);
      bumpy(c, 512, 512, 30, 5, 0.5);
    });
    return m;
  });

  const marsh = (): PBRMaterial => memo("marsh", () => {
    const m = pbr("marsh");
    m.albedoTexture = tex("marsh_alb", 512, 512, (c) => {
      c.fillStyle = "#4c5d44"; c.fillRect(0, 0, 512, 512);
      bumpy(c, 512, 512, 12, 5, 0.45);
      c.fillStyle = "rgba(50,80,90,0.35)";
      for (let i = 0; i < 40; i++) {
        c.beginPath();
        c.ellipse(Math.random() * 512, Math.random() * 512, 8 + Math.random() * 30, 6 + Math.random() * 18, Math.random() * 3, 0, Math.PI * 2);
        c.fill();
      }
    });
    return m;
  });

  const steelStructure = (): PBRMaterial => memo("steelStructure", () => {
    const m = pbr("steelStructure");
    m.albedoTexture = tex("steel_alb", 256, 256, (c) => {
      c.fillStyle = "#7a7d80"; c.fillRect(0, 0, 256, 256);
      streaks(c, 256, 256, 30, 0.25);
      bumpy(c, 256, 256, 40, 3, 0.15);
    });
    m.metallic = 0.85; m.roughness = 0.55;
    return m;
  });

  const paintedWhite = (): PBRMaterial => memo("paintedWhite", () => {
    const m = pbr("paintedWhite");
    m.albedoTexture = tex("pw_alb", 256, 256, (c) => {
      c.fillStyle = "#d8d9d4"; c.fillRect(0, 0, 256, 256);
      bumpy(c, 256, 256, 20, 3, 0.08);
      streaks(c, 256, 256, 12, 0.15);
    });
    m.metallic = 0.1; m.roughness = 0.65;
    return m;
  });

  const foamOrange = (): PBRMaterial => memo("foamOrange", () => {
    const m = pbr("foamOrange");
    m.albedoTexture = tex("foam_alb", 512, 1024, (c) => {
      c.fillStyle = "#c2571f"; c.fillRect(0, 0, 512, 1024);
      c.strokeStyle = "rgba(120,50,18,0.6)"; c.lineWidth = 2;
      for (let x = 0; x <= 512; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 1024); c.stroke(); }
      bumpy(c, 512, 1024, 18, 4, 0.12);
      streaks(c, 512, 1024, 60, 0.35);
      const g = c.createLinearGradient(0, 1024, 0, 700);
      g.addColorStop(0, "rgba(40,25,15,0.5)"); g.addColorStop(1, "rgba(40,25,15,0)");
      c.fillStyle = g; c.fillRect(0, 700, 512, 324);
    });
    m.metallic = 0.02; m.roughness = 0.78;
    return m;
  });

  const srbWhite = (): PBRMaterial => memo("srbWhite", () => {
    const m = pbr("srbWhite");
    m.albedoTexture = tex("srb_alb", 512, 1024, (c) => {
      c.fillStyle = "#dcdcda"; c.fillRect(0, 0, 512, 1024);
      c.strokeStyle = "rgba(70,70,70,0.8)"; c.lineWidth = 4;
      for (const y of [170, 340, 512, 680, 850]) { c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke(); }
      streaks(c, 512, 1024, 40, 0.25);
      bumpy(c, 512, 1024, 16, 3, 0.07);
    });
    m.metallic = 0.08; m.roughness = 0.6;
    return m;
  });

  const foilGold = (): PBRMaterial => memo("foilGold", () => {
    const m = pbr("foilGold");
    m.albedoTexture = tex("foil_alb", 256, 256, (c) => {
      c.fillStyle = "#b98a2e"; c.fillRect(0, 0, 256, 256);
      bumpy(c, 256, 256, 10, 3, 0.55);
    });
    m.metallic = 0.9; m.roughness = 0.35;
    return m;
  });

  const solarCell = (): PBRMaterial => memo("solarCell", () => {
    const m = pbr("solarCell");
    m.albedoTexture = tex("solar_alb", 512, 256, (c) => {
      c.fillStyle = "#1a2f52"; c.fillRect(0, 0, 512, 256);
      c.strokeStyle = "#c9a13b"; c.lineWidth = 2;
      for (let x = 0; x <= 512; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 256); c.stroke(); }
      for (let y = 0; y <= 256; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke(); }
      c.fillStyle = "rgba(160,190,230,0.18)";
      for (let x = 0; x < 512; x += 32) for (let y = 0; y < 256; y += 32) if (Math.random() < 0.2) c.fillRect(x + 4, y + 4, 24, 24);
    });
    m.metallic = 0.4; m.roughness = 0.25;
    return m;
  });

  const radiator = (): PBRMaterial => memo("radiator", () => {
    const m = pbr("radiator");
    m.albedoTexture = tex("rad_alb", 256, 256, (c) => {
      c.fillStyle = "#e8e9ea"; c.fillRect(0, 0, 256, 256);
      c.strokeStyle = "rgba(120,125,130,0.8)"; c.lineWidth = 2;
      for (let y = 12; y < 256; y += 20) { c.beginPath(); c.moveTo(0, y); c.lineTo(256, y); c.stroke(); }
    });
    m.metallic = 0.3; m.roughness = 0.35;
    return m;
  });

  const silverHull = (): PBRMaterial => memo("silverHull", () => {
    const m = pbr("silverHull");
    m.metallic = 0.95; m.roughness = 0.3;
    return m;
  });

  const blackTile = (): PBRMaterial => memo("blackTile", () => {
    const m = pbr("blackTile");
    m.albedoTexture = tex("tile_alb", 256, 256, (c) => {
      c.fillStyle = "#14161a"; c.fillRect(0, 0, 256, 256);
      c.strokeStyle = "rgba(60,60,60,0.6)"; c.lineWidth = 1.5;
      for (let i = 0; i < 256; i += 24) {
        c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 256); c.stroke();
        c.beginPath(); c.moveTo(0, i); c.lineTo(256, i); c.stroke();
      }
    });
    return m;
  });

  const interiorWall = (): PBRMaterial => memo("interiorWall", () => {
    const m = pbr("interiorWall");
    m.albedoTexture = tex("wall_alb", 512, 512, (c) => {
      c.fillStyle = "#c8cdd0"; c.fillRect(0, 0, 512, 512);
      c.strokeStyle = "rgba(90,100,105,0.9)"; c.lineWidth = 3;
      for (let y = 0; y <= 512; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke(); }
      for (let i = 0; i < 120; i++) {
        c.fillStyle = `rgba(70,75,80,${Math.random() * 0.18})`;
        c.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 40, 1 + Math.random() * 3);
      }
      bumpy(c, 512, 512, 16, 3, 0.05);
    });
    m.metallic = 0.15; m.roughness = 0.7;
    return m;
  });

  const handrail = (): PBRMaterial => memo("handrail", () => {
    const m = pbr("handrail");
    m.albedoTexture = tex("rail_alb", 64, 64, (c) => {
      c.fillStyle = "#b9bec2"; c.fillRect(0, 0, 64, 64);
      bumpy(c, 64, 64, 8, 2, 0.12);
    });
    m.metallic = 0.8; m.roughness = 0.45;
    return m;
  });

  const fabricBag = (): PBRMaterial => memo("fabricBag", () => {
    const m = pbr("fabricBag");
    m.albedoTexture = tex("bag_alb", 256, 256, (c) => {
      c.fillStyle = "#7a7357"; c.fillRect(0, 0, 256, 256);
      bumpy(c, 256, 256, 40, 4, 0.4);
      c.strokeStyle = "rgba(40,38,25,0.7)"; c.lineWidth = 3;
      c.strokeRect(12, 12, 232, 232);
    });
    return m;
  });

  const laptop = (): PBRMaterial => memo("laptop", () => {
    const m = pbr("laptop");
    m.albedoTexture = tex("laptop_alb", 256, 256, (c) => {
      c.fillStyle = "#9aa0a4"; c.fillRect(0, 0, 256, 256);
      c.fillStyle = "#20262b"; c.fillRect(24, 24, 208, 130);
      c.fillStyle = "#31556e"; c.fillRect(30, 30, 196, 118);
      c.fillStyle = "#b9bec2"; c.fillRect(24, 170, 208, 70);
      for (let y = 176; y < 236; y += 10) for (let x = 30; x < 226; x += 12) c.fillRect(x, y, 8, 6);
    });
    m.emissiveTexture = tex("laptop_emi", 256, 256, (c) => {
      c.fillStyle = "#000"; c.fillRect(0, 0, 256, 256);
      c.fillStyle = "#5f9fd8"; c.fillRect(30, 30, 196, 118);
      c.fillStyle = "#cfe6f7";
      c.fillRect(40, 40, 90, 8); c.fillRect(40, 56, 140, 6); c.fillRect(40, 70, 110, 6);
    });
    m.emissiveIntensity = 0.7;
    m.metallic = 0.3; m.roughness = 0.5;
    return m;
  });

  const labelCanvas = (text: string, w = 256, h = 64): DynamicTexture =>
    tex(`label_${text}`, w, h, (c) => {
      c.fillStyle = "#d8dde0"; c.fillRect(0, 0, w, h);
      c.fillStyle = "#10161a";
      c.font = `bold ${Math.floor(h * 0.42)}px monospace`;
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(text, w / 2, h / 2);
      c.strokeStyle = "#10161a"; c.lineWidth = 3; c.strokeRect(2, 2, w - 4, h - 4);
    });

  return {
    concrete, asphalt, grass, marsh, steelStructure, paintedWhite, foamOrange, srbWhite,
    foilGold, solarCell, radiator, silverHull, blackTile, concretePad,
    interiorWall, handrail, fabricBag, laptop, labelCanvas,
  };
}
```

- [ ] **Step 6: Lint + full test suite + commit**

Run: `npm run lint && npm run test`
Expected: PASS, no unused imports (`fbm3` is intentionally NOT imported here — Task 8 imports it).

```bash
git add space-sim/core space-sim/__tests__/noise.test.ts && git commit -m "feat(space-sim): procedural noise + PBR material factory"
```

---

### Task 5: Sky, sun, stars, Earth — scene assembly in main.ts

**Files:**
- Create: `space-sim/effects/sky.ts`, `space-sim/world/space.ts`, `space-sim/world/earth/earth.ts`
- Modify: `space-sim/main.ts` (replace placeholder boot with real scene)

**Interfaces:**
- Consumes: `createBestEngine`/`capsForTier`/`detectTier`/`gpuString` (Task 1), `createAssets` (Task 4), `fbm2/fbm3` (Task 4 noise).
- Produces:
  - `effects/sky.ts`: `class SkyController { constructor(scene: Scene, tier: QualityTier); sunDir: Vector3; setAltitude(m: number): void; setExposure(target: number): void; setSunGlare(v: number): void; applyFx(fx: { exposure?: number; shake?: number; glare?: number }): void; update(dt: number): void; shakeAmp: number }`
  - `world/space.ts`: `createStarfield(scene: Scene): void` (point cloud on radius-3e7 shell + Milky Way band).
  - `earth.ts`: `interface Earth { root: TransformNode; setSunDir(d: Vector3): void; update(dt: number): void }`, `createEarth(scene: Scene): Earth` — true-scale planet at center `(0, -6371000, 0)`, radius 6371000, custom `ShaderMaterial` surface + cloud sphere + Fresnel atmosphere shell.
  - `main.ts` now: engine → scene → assets → sky → stars → Earth → default camera → pipeline (bloom/DOF/SSAO by tier) → render loop with `mission.update(dt)` placeholder stub (wired fully in Task 9).

- [ ] **Step 1: Implement `effects/sky.ts`**

```ts
// space-sim/effects/sky.ts
import {
  Color3, DirectionalLight, HemisphericLight, MeshBuilder, ShaderMaterial,
  Vector3, type Scene,
} from "@babylonjs/core";
import type { QualityTier } from "../core/engine";

const SKY_VS = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;

const SKY_FS = `
precision highp float;
varying vec3 vPos;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunDir;
uniform float uSunGlare;
void main() {
  vec3 dir = normalize(vPos);
  float h = dir.y;
  vec3 col = h >= 0.0
    ? mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.55))
    : mix(uHorizon, uGround, pow(clamp(-h, 0.0, 1.0), 0.7));
  float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
  col += vec3(1.0, 0.92, 0.78) * pow(sunDot, 220.0) * 3.0;          // sun disc
  col += vec3(1.0, 0.85, 0.6) * pow(sunDot, 8.0) * 0.35 * uSunGlare; // glare halo
  gl_FragColor = vec4(col, 1.0);
}`;

/** Altitude-driven color ramp (ground -> space). */
const RAMP = [
  { alt: 0, zenith: [0.18, 0.38, 0.66], horizon: [0.66, 0.78, 0.9], ground: [0.35, 0.4, 0.42], exposure: 1.0 },
  { alt: 8000, zenith: [0.1, 0.24, 0.55], horizon: [0.5, 0.68, 0.88], ground: [0.3, 0.36, 0.4], exposure: 1.02 },
  { alt: 25000, zenith: [0.03, 0.08, 0.25], horizon: [0.22, 0.4, 0.72], ground: [0.22, 0.28, 0.34], exposure: 1.05 },
  { alt: 60000, zenith: [0.005, 0.015, 0.06], horizon: [0.07, 0.16, 0.4], ground: [0.1, 0.14, 0.2], exposure: 1.0 },
  { alt: 120000, zenith: [0.001, 0.002, 0.01], horizon: [0.015, 0.045, 0.14], ground: [0.03, 0.05, 0.09], exposure: 0.95 },
  { alt: 400000, zenith: [0.0, 0.0, 0.004], horizon: [0.004, 0.012, 0.04], ground: [0.0, 0.002, 0.01], exposure: 0.92 },
];

export class SkyController {
  sunDir = new Vector3(0.45, 0.5, -0.35).normalize();
  shakeAmp = 0;
  sun: DirectionalLight;
  ambient: HemisphericLight;
  private exposureTarget = 1.0;
  private currentExposure = 1.0;
  private glare = 0.4;
  private altitude = 0;
  private mat: ShaderMaterial;

  constructor(private scene: Scene, tier: QualityTier) {
    const dome = MeshBuilder.CreateSphere("skyDome", { diameter: 6.0e7, segments: 24 }, scene);
    dome.isPickable = false;
    dome.infiniteDistance = true;
    this.mat = new ShaderMaterial("skyMat", scene, {
      vertex: SKY_VS, fragment: SKY_FS,
    }, {
      attributes: ["position"],
      uniforms: ["worldViewProjection", "uZenith", "uHorizon", "uGround", "uSunDir", "uSunGlare"],
      needAlphaBlending: false,
    });
    this.mat.backFaceCulling = false;
    dome.material = this.mat;
    this.sun = new DirectionalLight("sun", this.sunDir.scale(-1), scene);
    this.sun.intensity = 3.4;
    this.ambient = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    this.ambient.intensity = tier === "low" ? 0.9 : 0.55;
    this.applyRamp();
  }

  private applyRamp(): void {
    let lo = RAMP[0], hi = RAMP[RAMP.length - 1];
    for (let i = 0; i < RAMP.length - 1; i++) {
      if (this.altitude >= RAMP[i].alt && this.altitude <= RAMP[i + 1].alt) {
        lo = RAMP[i]; hi = RAMP[i + 1];
        break;
      }
    }
    const span = Math.max(1e-6, hi.alt - lo.alt);
    const k = Math.min(1, Math.max(0, (this.altitude - lo.alt) / span));
    const mix = (a: number[], b: number[]): Color3 =>
      new Color3(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
    this.mat.setColor3("uZenith", mix(lo.zenith, hi.zenith));
    this.mat.setColor3("uHorizon", mix(lo.horizon, hi.horizon));
    this.mat.setColor3("uGround", mix(lo.ground, hi.ground));
    this.mat.setVector3("uSunDir", this.sunDir);
    this.mat.setFloat("uSunGlare", this.glare);
    this.exposureTarget = lo.exposure + (hi.exposure - lo.exposure) * k;
  }

  setAltitude(m: number): void { this.altitude = m; this.applyRamp(); }
  setExposure(target: number): void { this.exposureTarget = target; }
  setSunGlare(v: number): void { this.glare = v; this.applyRamp(); }
  applyFx(fx: { exposure?: number; shake?: number; glare?: number }): void {
    if (fx.exposure !== undefined) this.exposureTarget = fx.exposure;
    if (fx.shake !== undefined) this.shakeAmp = fx.shake;
    if (fx.glare !== undefined) this.glare = fx.glare;
    this.applyRamp();
  }
  get exposure(): number { return this.currentExposure; }

  update(dt: number): void {
    const speed = 0.8;
    this.currentExposure += (this.exposureTarget - this.currentExposure) * Math.min(1, dt * speed);
    if (this.shakeAmp > 0.001) this.shakeAmp = Math.max(0, this.shakeAmp - dt * 0.25);
    const cam = this.scene.activeCamera;
    if (cam) cam.fov = 0.9 + Math.sin(performance.now() * 0.02) * 0.004 * this.shakeAmp * 10;
  }
}
```

- [ ] **Step 2: Implement `world/space.ts`**

```ts
// space-sim/world/space.ts
import {
  Color4, Mesh, PointsCloudSystem, Vector3, type Scene,
} from "@babylonjs/core";

/** Realistic starfield: small varied points + Milky Way density band. */
export function createStarfield(scene: Scene): void {
  const RADIUS = 3.0e7;
  const COUNT = 6500;
  const pcs = new PointsCloudSystem("stars", 1.2, scene);
  pcs.addPoints(COUNT, (p) => {
    // Uniform sphere direction
    let u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    let dir = new Vector3(r * Math.cos(theta), u, r * Math.sin(theta));
    // Milky Way: bias density toward a band (plane normal tilted)
    const band = Math.abs(dir.y * 0.5 + dir.x * 0.85);
    if (Math.random() < 0.55 && band < 0.18) {
      u = (Math.random() * 2 - 1) * 0.18;
      const th2 = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(1 - u * u);
      dir = new Vector3(rr * Math.cos(th2), u, rr * Math.sin(th2));
    }
    p.position = dir.scale(RADIUS);
    // Magnitude distribution: many dim, few bright; temperature tint
    const mag = Math.pow(Math.random(), 2.2);
    const warm = Math.random();
    const base = 0.35 + mag * 0.65;
    p.color = new Color4(
      base * (warm > 0.7 ? 1.0 : 0.85 + warm * 0.2),
      base * 0.92,
      base * (warm < 0.3 ? 1.0 : 0.85 + (1 - warm) * 0.15),
      0.5 + mag * 0.5,
    );
  });
  pcs.buildMeshAsync().then((mesh: Mesh) => {
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
  });
}
```

- [ ] **Step 3: Implement `world/earth/earth.ts` — true-scale Earth with custom shader**

```ts
// space-sim/world/earth/earth.ts
import {
  Mesh, MeshBuilder, ShaderMaterial, StandardMaterial, Texture, TransformNode,
  Vector3, type Scene,
} from "@babylonjs/core";
import { fbm2, fbm3 } from "../../core/noise";

const EARTH_R = 6371000;
const CENTER_Y = -EARTH_R;

const SURFACE_VS = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 worldViewProjection;
uniform mat4 world;
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec2 vUv;
void main() {
  vUv = uv;
  vNormalW = normalize((world * vec4(normal, 0.0)).xyz);
  vec4 wp = world * vec4(position, 1.0);
  vPosW = wp.xyz;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;

const SURFACE_FS = `
precision highp float;
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec2 vUv;
uniform sampler2D uAlbedo;
uniform sampler2D uNight;
uniform sampler2D uClouds;
uniform vec3 uSunDir;
uniform vec3 uCamPos;
void main() {
  vec3 albedo = texture2D(uAlbedo, vUv).rgb;
  vec3 night = texture2D(uNight, vUv).rgb;
  float land = texture2D(uAlbedo, vUv).a;      // land mask packed in alpha
  vec4 cl = texture2D(uClouds, vUv + vec2(0.02, 0.0));
  float cloud = cl.a;
  vec3 N = normalize(vNormalW);
  vec3 L = normalize(uSunDir);
  vec3 V = normalize(uCamPos - vPosW);
  float ndl = dot(N, L);
  float day = smoothstep(-0.12, 0.25, ndl);
  // Cloud shadow: offset sample toward sun
  float shadow = texture2D(uClouds, vUv + vec2(0.002, 0.0)).a;
  vec3 col = albedo * (0.04 + 1.5 * max(ndl, 0.0) * (1.0 - shadow * 0.55));
  // Ocean specular
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 90.0) * (1.0 - land) * day;
  col += vec3(1.0, 0.95, 0.85) * spec * 0.7;
  // Clouds lit
  col = mix(col, vec3(1.0) * (0.08 + 1.35 * max(ndl, 0.0)), cloud * 0.92);
  // Night lights on dark land
  col += night * (1.0 - day) * (1.0 - cloud * 0.85) * 1.6;
  // Atmosphere rim (Fresnel)
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.2);
  col += vec3(0.25, 0.5, 1.0) * rim * (0.25 + 0.75 * day);
  gl_FragColor = vec4(col, 1.0);
}`;

const ATMO_VS = SURFACE_VS;

const ATMO_FS = `
precision highp float;
varying vec3 vNormalW;
varying vec3 vPosW;
uniform vec3 uSunDir;
uniform vec3 uCamPos;
void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(uCamPos - vPosW);
  vec3 L = normalize(uSunDir);
  float rim = pow(1.0 - abs(dot(N, V)), 3.5);
  float day = smoothstep(-0.35, 0.35, dot(N, L));
  vec3 col = mix(vec3(0.02, 0.05, 0.16), vec3(0.3, 0.55, 1.0), day);
  gl_FragColor = vec4(col, rim * (0.12 + 0.75 * day));
}`;

/** Paint Earth maps onto canvas textures using fbm3 for seamless sphere sampling. */
function paintEarthMaps(
  scene: Scene,
): { albedo: Texture; night: Texture; clouds: Texture } {
  const W = 2048, H = 1024;
  const mk = (name: string, draw: (d: Uint8ClampedArray) => void): Texture => {
    const dt = new Texture(null, scene, false, false); // placeholder replaced below
    void dt;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(W, H);
    draw(img.data);
    ctx.putImageData(img, 0, 0);
    const tex = new Texture(canvas as unknown as string, scene, false, false);
    tex.name = name;
    return tex;
  };
  const albedo = mk("earth_albedo", (d) => {
    for (let y = 0; y < H; y++) {
      const lat = (0.5 - y / H) * Math.PI;
      for (let x = 0; x < W; x++) {
        const lon = (x / W) * Math.PI * 2;
        const px = Math.cos(lat) * Math.cos(lon), py = Math.sin(lat), pz = Math.cos(lat) * Math.sin(lon);
        const n = fbm3(px * 3.1, py * 3.1, pz * 3.1, 6);
        const detail = fbm3(px * 9, py * 9, pz * 9, 4);
        const landMask = n + detail * 0.25;
        const k = (y * W + x) * 4;
        const isLand = landMask > 0.12;
        if (isLand) {
          const green = fbm3(px * 6 + 40, py * 6, pz * 6, 4) * 0.5 + 0.5;
          const desert = Math.max(0, Math.sin(lat * 2.4)) * (fbm3(px * 5, py * 5, pz * 5, 3) * 0.5 + 0.5);
          const ice = Math.abs(py) > 0.78 ? 1 : 0;
          d[k] = (30 + green * 60 + desert * 120) * (1 - ice) + ice * 235;
          d[k + 1] = (45 + green * 75 + desert * 90) * (1 - ice) + ice * 240;
          d[k + 2] = (28 + green * 40 + desert * 55) * (1 - ice) + ice * 245;
          d[k + 3] = 255;
        } else {
          const deep = Math.min(1, (0.12 - landMask) * 4);
          d[k] = 8 + (1 - deep) * 24; d[k + 1] = 24 + (1 - deep) * 40; d[k + 2] = 55 + (1 - deep) * 60;
          d[k + 3] = 0;
        }
      }
    }
  });
  const night = mk("earth_night", (d) => {
    for (let y = 0; y < H; y++) {
      const lat = (0.5 - y / H) * Math.PI;
      for (let x = 0; x < W; x++) {
        const lon = (x / W) * Math.PI * 2;
        const px = Math.cos(lat) * Math.cos(lon), py = Math.sin(lat), pz = Math.cos(lat) * Math.sin(lon);
        const n = fbm3(px * 3.1, py * 3.1, pz * 3.1, 6);
        const k = (y * W + x) * 4;
        if (n > 0.14 && Math.abs(py) < 0.7) {
          const cl = fbm3(px * 22, py * 22, pz * 22, 4);
          const v = cl > 0.28 ? 200 + cl * 55 : 0;
          d[k] = v; d[k + 1] = v * 0.85; d[k + 2] = v * 0.55;
        } else { d[k] = 0; d[k + 1] = 0; d[k + 2] = 0; }
        d[k + 3] = 255;
      }
    }
  });
  const clouds = mk("earth_clouds", (d) => {
    for (let y = 0; y < H; y++) {
      const lat = (0.5 - y / H) * Math.PI;
      for (let x = 0; x < W; x++) {
        const lon = (x / W) * Math.PI * 2;
        const px = Math.cos(lat) * Math.cos(lon), py = Math.sin(lat), pz = Math.cos(lat) * Math.sin(lon);
        const n = fbm3(px * 5 + 90, py * 5, pz * 5 + 90, 6);
        const swirl = fbm2((x / W) * 40, (y / H) * 20, 4) * 0.3;
        const a = Math.max(0, n + swirl - 0.08) * 1.6;
        const k = (y * W + x) * 4;
        d[k] = 255; d[k + 1] = 255; d[k + 2] = 255;
        d[k + 3] = Math.min(255, a * 255);
      }
    }
  });
  return { albedo, night, clouds };
}

export interface Earth {
  root: TransformNode;
  setSunDir(d: Vector3): void;
  update(dt: number): void;
}

export function createEarth(scene: Scene): Earth {
  const root = new TransformNode("earthRoot", scene);
  root.position.y = CENTER_Y;

  const surface = MeshBuilder.CreateSphere("earth", { diameter: EARTH_R * 2, segments: 96 }, scene);
  surface.parent = root;
  const maps = paintEarthMaps(scene);
  const mat = new ShaderMaterial("earthMat", scene,
    { vertex: SURFACE_VS, fragment: SURFACE_FS },
    {
      attributes: ["position", "normal", "uv"],
      uniforms: ["worldViewProjection", "world", "uSunDir", "uCamPos"],
      samplers: ["uAlbedo", "uNight", "uClouds"],
    });
  mat.setVector3("uSunDir", new Vector3(0.45, 0.5, -0.35).normalize());
  mat.setTexture("uAlbedo", maps.albedo);
  mat.setTexture("uNight", maps.night);
  mat.setTexture("uClouds", maps.clouds);
  mat.backFaceCulling = true;
  surface.material = mat;

  // Cloud sphere (rotates slowly; shader samples uClouds with drift offset too)
  const clouds = MeshBuilder.CreateSphere("earthClouds", { diameter: EARTH_R * 2 * 1.004, segments: 64 }, scene);
  clouds.parent = root;
  const cloudMat = new StandardMaterial("earthCloudsMat", scene);
  cloudMat.diffuseTexture = null;
  cloudMat.alpha = 0.0; // clouds rendered in surface shader; sphere reserved for shadow layering
  cloudMat.disableLighting = true;
  clouds.material = cloudMat;
  clouds.isPickable = false;

  // Atmosphere shell (additive Fresnel)
  const atmo = MeshBuilder.CreateSphere("earthAtmo", { diameter: EARTH_R * 2 * 1.025, segments: 64 }, scene);
  atmo.parent = root;
  const atmoMat = new ShaderMaterial("atmoMat", scene,
    { vertex: ATMO_VS, fragment: ATMO_FS },
    { attributes: ["position", "normal"], uniforms: ["worldViewProjection", "world", "uSunDir", "uCamPos"] });
  atmoMat.setVector3("uSunDir", new Vector3(0.45, 0.5, -0.35).normalize());
  atmoMat.alphaBlendMode = 1; // additive-ish; use standard alpha with rim alpha
  atmoMat.needAlphaBlending = () => true;
  atmoMat.backFaceCulling = true;
  atmo.material = atmoMat;
  atmo.isPickable = false;

  const setSunDir = (d: Vector3): void => {
    mat.setVector3("uSunDir", d);
    atmoMat.setVector3("uSunDir", d);
  };
  const update = (dt: number): void => {
    surface.rotation.y += dt * 0.0015; // slow rotation
    const cam = scene.activeCamera;
    if (cam) {
      const camPos = cam.globalPosition.subtract(root.position);
      mat.setVector3("uCamPos", camPos);
      atmoMat.setVector3("uCamPos", camPos);
    }
  };
  return { root, setSunDir, update };
}
```

Note: `paintEarthMaps` builds a real `Texture` from a canvas element — if the `new Texture(canvas as unknown as string)` constructor overload misbehaves in Babylon 9, replace with `new RawTexture(data, W, H, Texture.RGBA_FORMAT, scene, false, false, Texture.TRILINEAR_SAMPLINGMODE)` fed from the same `Uint8ClampedArray` (drop alpha-channel land-mask into RGB B channel instead and read `.b` as mask in the shader — adjust `land` line accordingly). Verify visually in Step 6 before proceeding.

- [ ] **Step 4: Wire real scene in `main.ts`**

```ts
// space-sim/main.ts
import {
  DefaultRenderingPipeline, SSAO2RenderingPipeline, Scene, TargetCamera, UniversalCamera, Vector3,
} from "@babylonjs/core";
import { capsForTier, createBestEngine, detectTier, gpuString, type QualityTier } from "./core/engine";
import { createAssets } from "./core/assets";
import { SkyController } from "./effects/sky";
import { createStarfield } from "./world/space";
import { createEarth, type Earth } from "./world/earth/earth";

const canvas = document.getElementById("render-canvas") as HTMLCanvasElement;
const fill = document.getElementById("loading-fill")!;
const stepLabel = document.getElementById("loading-step")!;

function setProgress(fraction: number, label: string): void {
  fill.style.width = `${Math.round(fraction * 100)}%`;
  stepLabel.textContent = label;
}
const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

interface World { tier: QualityTier; sky: SkyController; earth: Earth }

async function boot(): Promise<void> {
  setProgress(0.05, "Detecting graphics backend…");
  const engine = await createBestEngine(canvas);
  const tier = detectTier({ gpu: gpuString(engine), dpr: window.devicePixelRatio, cores: navigator.hardwareConcurrency || 4 });
  engine.setHardwareScalingLevel(capsForTier(tier).hardwareScaling);
  const scene = new Scene(engine);
  scene.clearColor.set(0.002, 0.004, 0.01, 1);
  const camera = new UniversalCamera("bootCam", new Vector3(1400, 60, 900), scene);
  camera.minZ = 0.1; camera.maxZ = 2.5e7;
  camera.setTarget(new Vector3(0, 40, 0));
  scene.activeCamera = camera;

  setProgress(0.2, "Loading materials…");
  await nextFrame();
  createAssets(scene);

  setProgress(0.4, "Loading sky and starfield…");
  await nextFrame();
  const sky = new SkyController(scene, tier);
  createStarfield(scene);

  setProgress(0.6, "Loading Earth…");
  await nextFrame();
  const earth = createEarth(scene);

  setProgress(0.8, "Configuring cinematic pipeline…");
  await nextFrame();
  const caps = capsForTier(tier);
  const pipe = new DefaultRenderingPipeline("cinePipe", true, scene, [camera]);
  pipe.bloomEnabled = true;
  pipe.bloomThreshold = 0.85;
  pipe.bloomWeight = 0.35;
  pipe.bloomKernel = 48;
  pipe.bloomScale = 0.5;
  pipe.dofEnabled = caps.dof;
  if (pipe.dofEnabled) {
    pipe.dofFocusDistance = 5000;
    pipe.dofAperture = 0.00002;
  }
  pipe.imageProcessingEnabled = true;
  pipe.imageProcessing.toneMappingEnabled = true;
  if (caps.ssao) {
    const ssao = new SSAO2RenderingPipeline("ssao", scene, 0.75, [camera]);
    ssao.totalStrength = 0.85;
    ssao.radius = 1.2;
  }

  setProgress(0.95, "MISSION SYSTEM READY");
  await nextFrame();
  engine.runRenderLoop(() => {
    const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
    sky.update(dt);
    earth.update(dt);
    scene.render();
  });
  setProgress(1, "MISSION SYSTEM READY");
  await new Promise((r) => setTimeout(r, 400));
  document.getElementById("loading-screen")!.classList.add("hidden");
  void TargetCamera; // DELETE this line and remove `TargetCamera` from the import line
}

boot().catch((err: unknown) => {
  document.getElementById("loading-screen")!.classList.add("hidden");
  document.getElementById("error-screen")!.classList.remove("hidden");
  document.getElementById("error-text")!.textContent = `The simulator could not initialize graphics: ${String(err)}`;
});
```

The `main.ts` import line in this task must be exactly `import { DefaultRenderingPipeline, SSAO2RenderingPipeline, Scene, UniversalCamera, Vector3 } from "@babylonjs/core";` — apply the `void TargetCamera` DELETE marker, then ensure the final file has no `TargetCamera` reference and no unused imports.

- [ ] **Step 5: Run lint + tests**

Run: `npm run lint && npm run test`
Expected: PASS (all existing tests still green).

- [ ] **Step 6: Visual verification (critical gate)**

Run `npm run dev`, open `/space-sim/`:
- Sky dome gradient with sun disc and glare visible.
- Starfield: thousands of small stars, Milky Way band denser, no giant glowing dots.
- Earth visible from boot cam at 1400m altitude only as horizon curvature (we are inside atmosphere — check no z-fighting between sky dome and Earth: sky uses `infiniteDistance`, Earth is real geometry).
- If Earth appears black/wrong on WebGPU: switch its material path to WebGL2 fallback for this task (feature-detect via `engine.isWebGPU` and log a console warning), keep GLSL as source of truth.

- [ ] **Step 7: Commit**

```bash
git add space-sim/effects space-sim/world space-sim/main.ts && git commit -m "feat(space-sim): sky/atmosphere controller, starfield, true-scale procedural Earth"
```

---

### Task 6: KSC terrain, coastline, ocean, vegetation scatter

**Files:**
- Create: `space-sim/world/ksc/terrain.ts`
- Modify: `space-sim/main.ts` (add terrain build step + progress line "Loading Kennedy Space Center…")

**Interfaces:**
- Consumes: `createAssets` (Task 4), `fbm2` (Task 4).
- Produces: `createTerrain(scene: Scene, assets: Assets): TransformNode` — ground plane ~16 km², heightfield via fbm (±12 m), texture splat by height/noise (grass/marsh/asphalt corridor along crawlerway), Atlantic ocean plane east of x>2500 with animated normal offset, beach blend strip, and ~200 vegetation billboards scattered on grass/marsh zones.

- [ ] **Step 1: Implement `world/ksc/terrain.ts`**

```ts
// space-sim/world/ksc/terrain.ts
import {
  Color3, DynamicTexture, GroundMesh, Mesh, MeshBuilder, StandardMaterial,
  Texture, TransformNode, Vector3, type Scene,
} from "@babylonjs/core";
import { fbm2, valueNoise2 } from "../../core/noise";
import type { Assets } from "../../core/assets";

const SIZE = 16000;
const SUB = 128;

export function terrainHeight(x: number, z: number): number {
  const base = fbm2(x * 0.00008, z * 0.00008, 4) * 14;
  const dunes = valueNoise2(x * 0.0012, z * 0.0012) * 2.2;
  // Flat pad zone around origin
  const padDist = Math.hypot(x, z);
  const flat = Math.min(1, Math.max(0, (padDist - 220) / 400));
  return (base + dunes) * flat;
}

export function createTerrain(scene: Scene, assets: Assets): TransformNode {
  const root = new TransformNode("kscTerrain", scene);

  const ground = MeshBuilder.CreateGround("kscGround", { width: SIZE, height: SIZE, subdivisions: SUB }, scene) as GroundMesh;
  const pos = ground.getVerticesData("position")!;
  for (let i = 0; i < pos.length; i += 3) {
    pos[i + 1] = terrainHeight(pos[i], pos[i + 2]);
  }
  ground.updateVerticesData("position", pos);
  ground.createNormals(false);
  ground.material = ((): StandardMaterial => {
    const m = new StandardMaterial("terrainMat", scene);
    const splat = new DynamicTexture("splat", { width: 1024, height: 1024 }, scene, true);
    const ctx = splat.getContext() as unknown as CanvasRenderingContext2D;
    // Base grass
    ctx.fillStyle = "#5a6b3a"; ctx.fillRect(0, 0, 1024, 1024);
    // Marsh patches (low noise areas)
    for (let y = 0; y < 1024; y += 4) {
      for (let x = 0; x < 1024; x += 4) {
        const wx = (x / 1024 - 0.5) * SIZE;
        const wz = (0.5 - y / 1024) * SIZE; // canvas top row (y=0) -> world z=+8000 (flipY upload)
        const n = fbm2(wx * 0.0002, wz * 0.0002, 3);
        if (n < -0.25) { ctx.fillStyle = "#46583f"; ctx.fillRect(x, y, 4, 4); }
        if (n < -0.42) { ctx.fillStyle = "#3f5a54"; ctx.fillRect(x, y, 4, 4); }
        // Crawlerway corridor: from VAB (-3200,-2800) to pad (0,0), 30m wide, asphalt
        const t = (wx * -3200 + wz * -2800) / (3200 * 3200 + 2800 * 2800);
        const cx = -3200 * t, cz = -2800 * t;
        const dist = Math.hypot(wx - cx, wz - cz);
        if (t >= 0 && t <= 1 && dist < 15) { ctx.fillStyle = "#3c3d3f"; ctx.fillRect(x, y, 4, 4); }
        // Beach + ocean floor east
        if (wx > 2400) { ctx.fillStyle = wx > 2600 ? "#1d3a4d" : "#c9bd9a"; ctx.fillRect(x, y, 4, 4); }
      }
    }
    splat.update();
    m.diffuseTexture = splat;
    m.specularColor = new Color3(0.03, 0.03, 0.03);
    return m;
  })();
  ground.isPickable = false;
  ground.parent = root;

  // Ocean plane with animated shimmer (vertex shader-free: animated bump via uOffset)
  const ocean = MeshBuilder.CreateGround("ocean", { width: SIZE, height: SIZE, subdivisions: 32 }, scene);
  ocean.position.x = SIZE / 2 + 2400;
  ocean.position.y = 0.15;
  const oceanMat = new StandardMaterial("oceanMat", scene);
  oceanMat.diffuseColor = new Color3(0.05, 0.18, 0.28);
  oceanMat.specularColor = new Color3(0.9, 0.95, 1.0);
  oceanMat.specularPower = 180;
  oceanMat.bumpTexture = ((): Texture => {
    const dt = new DynamicTexture("oceanBump", { width: 512, height: 512 }, scene, true);
    const c = dt.getContext() as unknown as CanvasRenderingContext2D;
    c.fillStyle = "#8080ff"; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2200; i++) {
      const x = Math.random() * 512, y = Math.random() * 512;
      c.strokeStyle = `rgba(${160 + Math.random() * 60},${160 + Math.random() * 60},255,0.5)`;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 6 + Math.random() * 10, y + Math.random() * 3); c.stroke();
    }
    dt.update();
    dt.uOffset = 0;
    return dt;
  })();
  (oceanMat.bumpTexture as Texture).uScale = 40;
  (oceanMat.bumpTexture as Texture).vScale = 40;
  ocean.material = oceanMat;
  ocean.isPickable = false;
  ocean.parent = root;

  // Vegetation billboards scattered on land
  const veg = new TransformNode("vegetation", scene);
  veg.parent = root;
  const bushTex = new DynamicTexture("bushTex", { width: 128, height: 128 }, scene, true);
  const bc = bushTex.getContext() as unknown as CanvasRenderingContext2D;
  bc.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 60; i++) {
    bc.fillStyle = `rgba(${30 + Math.random() * 30},${70 + Math.random() * 50},${25 + Math.random() * 20},1)`;
    bc.beginPath();
    bc.ellipse(64 + (Math.random() - 0.5) * 50, 90 + (Math.random() - 0.5) * 30, 12 + Math.random() * 22, 8 + Math.random() * 14, 0, 0, Math.PI * 2);
    bc.fill();
  }
  bushTex.hasAlpha = true;
  bushTex.update();
  const bushMat = new StandardMaterial("bushMat", scene);
  bushMat.diffuseTexture = bushTex;
  bushMat.useAlphaFromDiffuseTexture = true;
  bushMat.backFaceCulling = false;
  bushMat.specularColor = new Color3(0, 0, 0);
  let placed = 0;
  for (let i = 0; i < 900 && placed < 220; i++) {
    const x = (Math.random() - 0.5) * SIZE * 0.9;
    const z = (Math.random() - 0.5) * SIZE * 0.9;
    const padDist = Math.hypot(x, z);
    if (padDist < 300 || x > 2400) continue;
    const h = terrainHeight(x, z);
    const card = MeshBuilder.CreatePlane(`bush${i}`, { width: 7, height: 4.5 }, scene);
    card.position.set(x, h + 2.0, z);
    card.billboardMode = Mesh.BILLBOARDMODE_Y;
    card.material = bushMat;
    card.isPickable = false;
    card.parent = veg;
    placed++;
  }

  void assets; // terrain uses its own splat texture; assets kept for API stability
  return root;
}
```

- [ ] **Step 2: Add terrain to `main.ts`**

In `boot()` between Earth and pipeline steps add:

```ts
  setProgress(0.7, "Loading Kennedy Space Center…");
  await nextFrame();
  const { createTerrain } = await import("./world/ksc/terrain");
  createTerrain(scene, assets);
```

(and keep a reference `const assets = createAssets(scene);` instead of the bare call in Step 4's current code).

- [ ] **Step 3: Lint + tests + visual verification**

Run: `npm run lint && npm run test`
Then browser: from `est_wide` style position, terrain shows grass/marsh mix, crawlerway strip runs to pad, ocean east with specular shimmer, vegetation billboards scattered. Fix any glaring visual defect (seams, ocean plane visible from west, billboard pop) before continuing.

- [ ] **Step 4: Commit**

```bash
git add space-sim/world/ksc/terrain.ts space-sim/main.ts && git commit -m "feat(space-sim): KSC terrain, coastline, ocean, vegetation"
```

---

### Task 7: VAB + distant facility cluster

**Files:**
- Create: `space-sim/world/ksc/vab.ts`
- Modify: `space-sim/main.ts` (add build step)

**Interfaces:**
- Consumes: `Assets` (Task 4).
- Produces: `createVab(scene: Scene, assets: Assets): TransformNode` at `(-3200, 0, -2800)`; `createFacilityCluster(scene: Scene, assets: Assets): TransformNode` — low-detail distant buildings at real KSC bearings (OPF, launch control center, hangars) west of the pad.

- [ ] **Step 1: Implement `world/ksc/vab.ts`**

VAB facts used: 160 m tall, 218 m long, 158 m wide; 4 high bays on the east face, low-bay annex south; ribbed side walls; US flag + NASA meatball painted on south façade.

```ts
// space-sim/world/ksc/vab.ts
import {
  Color3, DynamicTexture, MeshBuilder, StandardMaterial,
  TransformNode, type Scene,
} from "@babylonjs/core";
import type { Assets } from "../../core/assets";

const VAB_POS = new Vector3(-3200, 0, -2800);

function ribbedWallMat(scene: Scene): StandardMaterial {
  const m = new StandardMaterial("vabWall", scene);
  m.diffuseTexture = new DynamicTexture("vabWallTex", { width: 512, height: 512 }, scene, true);
  const c = m.diffuseTexture as DynamicTexture;
  const ctx = c.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = "#b9bcb9"; ctx.fillRect(0, 0, 512, 512);
  for (let x = 0; x <= 512; x += 24) {
    ctx.fillStyle = "rgba(140,145,142,0.85)"; ctx.fillRect(x, 0, 6, 512);
    ctx.fillStyle = "rgba(220,224,220,0.5)"; ctx.fillRect(x + 6, 0, 3, 512);
  }
  // weather streaks
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = `rgba(90,92,88,${Math.random() * 0.2})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 200, 1 + Math.random() * 2, 60 + Math.random() * 250);
  }
  c.update();
  return m;
}

function flagDoorMat(scene: Scene): StandardMaterial {
  const m = new StandardMaterial("vabFlag", scene);
  m.diffuseTexture = new DynamicTexture("vabFlagTex", { width: 1024, height: 512 }, scene, true);
  const c = m.diffuseTexture as DynamicTexture;
  const ctx = c.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = "#c3c6c3"; ctx.fillRect(0, 0, 1024, 512);
  // US flag 64.4m x 33.5m proportional
  const fw = 560, fh = 300, fx = 120, fy = 90;
  for (let i = 0; i < 13; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#b22234" : "#ffffff";
    ctx.fillRect(fx, fy + (i * fh) / 13, fw, fh / 13);
  }
  ctx.fillStyle = "#3c3b6e"; ctx.fillRect(fx, fy, fw * 0.4, fh * (7 / 13));
  ctx.fillStyle = "#fff";
  for (let r = 0; r < 9; r++) for (let s = 0; s < 11; s++) {
    if ((r + s) % 2 === 0) ctx.fillRect(fx + 8 + s * 18, fy + 8 + r * 20, 5, 5);
  }
  // NASA meatball right of flag
  const mx = 800, my = 200, mr = 130;
  ctx.fillStyle = "#0b3d91"; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(mx, my - 20, mr, mr * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#0b3d91"; ctx.font = "bold 44px monospace"; ctx.fillText("NASA", mx - 55, my + 16);
  ctx.strokeStyle = "#fc3d21"; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(mx - mr * 0.9, my + 60); ctx.quadraticCurveTo(mx, my - 90, mx + mr * 0.9, my + 40); ctx.stroke();
  c.update();
  return m;
}

export function createVab(scene: Scene, assets: Assets): TransformNode {
  const root = new TransformNode("vab", scene);
  root.position = VAB_POS;
  const wall = ribbedWallMat(scene);
  const roofMat = new StandardMaterial("vabRoof", scene);
  roofMat.diffuseColor = new Color3(0.35, 0.36, 0.37);

  // Main volume 218 x 160 x 158 (x=long axis, y=height, z=width)
  const body = MeshBuilder.CreateBox("vabBody", { width: 218, height: 160, depth: 158 }, scene);
  body.position.y = 80;
  body.material = wall;
  body.parent = root;

  // Ribbed vertical strip detail (east high-bay face): 4 bays separated by recessed columns
  for (let i = 0; i < 5; i++) {
    const col = MeshBuilder.CreateBox(`vabCol${i}`, { width: 14, height: 160, depth: 6 }, scene);
    col.position.set(-109 + 27.25 + i * 54.5, 80, 79 + 3);
    col.material = assets.steelStructure();
    col.parent = root;
  }

  // Transfer aisle / low bay (south annex, shorter)
  const lowBay = MeshBuilder.CreateBox("vabLowBay", { width: 96, height: 60, depth: 70 }, scene);
  lowBay.position.set(0, 30, -114);
  lowBay.material = wall;
  lowBay.parent = root;

  // Roof AC units
  for (let i = 0; i < 8; i++) {
    const ac = MeshBuilder.CreateBox(`vabAc${i}`, { width: 10, height: 4, depth: 8 }, scene);
    ac.position.set(-90 + i * 26, 162, -40 + (i % 2) * 60);
    ac.material = roofMat;
    ac.parent = root;
  }

  // Flag/meatball on the south face (facing launch complex + tourists)
  const face = MeshBuilder.CreatePlane("vabFace", { width: 102, height: 51 }, scene);
  face.position.set(0, 95, -158.6);
  face.rotation.y = Math.PI;
  face.material = flagDoorMat(scene);
  face.parent = root;

  // Four high-bay doors on east face (dark recessed rectangles)
  const doorMat = new StandardMaterial("vabDoor", scene);
  doorMat.diffuseColor = new Color3(0.12, 0.13, 0.14);
  for (let i = 0; i < 4; i++) {
    const door = MeshBuilder.CreatePlane(`vabDoor${i}`, { width: 45, height: 139 }, scene);
    door.position.set(-82 + i * 54.5, 69.5, 79.15);
    door.material = doorMat;
    door.parent = root;
  }

  // Ground apron
  const apron = MeshBuilder.CreateGround("vabApron", { width: 340, height: 300 }, scene);
  apron.position.y = 0.05;
  apron.material = assets.concrete();
  apron.parent = root;

  return root;
}

export function createFacilityCluster(scene: Scene, assets: Assets): TransformNode {
  const root = new TransformNode("facilityCluster", scene);
  const buildings: Array<[number, number, number, number, number, number]> = [
    // x, z, w, h, d  (relative to root at -2000, -3600)
    [0, 0, 120, 24, 60], [180, -80, 80, 14, 50], [-160, 60, 60, 30, 40],
    [320, 40, 90, 18, 55], [-60, -160, 70, 12, 45], [140, 160, 55, 40, 40],
  ];
  for (let i = 0; i < buildings.length; i++) {
    const [x, z, w, h, d] = buildings[i];
    const b = MeshBuilder.CreateBox(`fac${i}`, { width: w, height: h, depth: d }, scene);
    b.position.set(x, h / 2, z);
    b.material = i % 2 === 0 ? assets.paintedWhite() : assets.concrete();
    b.parent = root;
  }
  root.position.set(-2000, 0, -3600);
  return root;
}
```

Remove the `void fbm2;` line and the import if lint flags it — code must be clean.

- [ ] **Step 2: Wire into `main.ts`**

```ts
  const { createVab, createFacilityCluster } = await import("./world/ksc/vab");
  createVab(scene, assets);
  createFacilityCluster(scene, assets);
```

(inside the KSC build step, after `createTerrain`).

- [ ] **Step 3: Visual verification + commit**

Browser: `est_vab_crane` framing (crane from (-3200,8,-2350) rising 150 m) shows ribbed walls, four high-bay doors, flag + meatball legible, plausible massing against sky. Fix visual defects (scale, texture stretching) before commit.

```bash
git add space-sim/world/ksc/vab.ts space-sim/main.ts && git commit -m "feat(space-sim): VAB with high-bays, flag/meatball facade, facility cluster"
```

---

### Task 8: LC-39A pad complex + mobile launcher + crawler

**Files:**
- Create: `space-sim/world/ksc/pad.ts`, `space-sim/world/ksc/launcher.ts`
- Modify: `space-sim/main.ts`

**Interfaces:**
- Consumes: `Assets` (Task 4).
- Produces:
  - `createPad(scene: Scene, assets: Assets): TransformNode` — pad deck (concretePad), flame trench opening, 3 lightning masts (~180 m), water tower, perimeter berm, hold-down posts.
  - `createMobileLauncher(scene: Scene, assets: Assets): { root: TransformNode; arms: TransformNode[]; retractArms(t: number): void }` — ML base (~40×35×7.6 m) + tower (~120 m) + 9 swing arms; `retractArms(k: 0..1)` animates arms away at ignition.
  - `createCrawler(scene: Scene, assets: Assets): TransformNode` at crawlerway midpoint (parked during prep).

- [ ] **Step 1: Implement `world/ksc/pad.ts`**

```ts
// space-sim/world/ksc/pad.ts
import { MeshBuilder, TransformNode, Vector3, type Scene } from "@babylonjs/core";
import type { Assets } from "../../core/assets";

export function createPad(scene: Scene, assets: Assets): TransformNode {
  const root = new TransformNode("pad39a", scene);

  const deck = MeshBuilder.CreateBox("padDeck", { width: 130, depth: 130, height: 14 }, scene);
  deck.position.y = 7;
  deck.material = assets.concretePad();
  deck.parent = root;

  // Flame trench: two openings below deck (visual recess)
  const trench = MeshBuilder.CreateBox("trench", { width: 24, height: 12, depth: 60 }, scene);
  trench.position.set(0, 6, 0);
  trench.material = assets.blackTile();
  trench.parent = root;
  const mouth = MeshBuilder.CreateBox("trenchMouth", { width: 24, height: 12, depth: 60 }, scene);
  mouth.position.set(0, 6, -60);
  mouth.material = assets.blackTile();
  mouth.parent = root;

  // Hold-down posts (4 corners of engine area)
  for (const [x, z] of [[-18, -18], [18, -18], [-18, 18], [18, 18]]) {
    const post = MeshBuilder.CreateBox("holdPost", { width: 3, height: 6, depth: 3 }, scene);
    post.position.set(x, 17, z);
    post.material = assets.steelStructure();
    post.parent = root;
  }

  // Lightning masts (3, ~180 m)
  const mastPositions: Array<[number, number]> = [[-90, -90], [90, -90], [0, 105]];
  mastPositions.forEach(([x, z], i) => {
    const mast = MeshBuilder.CreateCylinder(`mast${i}`, { diameterTop: 1.2, diameterBottom: 3.4, height: 180, tessellation: 8 }, scene);
    mast.position.set(x, 14 + 90, z);
    mast.material = assets.steelStructure();
    mast.parent = root;
    const guy = MeshBuilder.CreateCylinder(`mastCable${i}`, { diameter: 0.08, height: 185 }, scene);
    guy.rotation.x = 0.12;
    guy.position.set(x, 14 + 92, z + 1.5);
    guy.material = assets.steelStructure();
    guy.parent = root;
  });

  // Water tower (sound suppression)
  const tower = MeshBuilder.CreateCylinder("waterTower", { diameter: 12, height: 34, tessellation: 16 }, scene);
  tower.position.set(-75, 14 + 17, 30);
  tower.material = assets.paintedWhite();
  tower.parent = root;
  const tank = MeshBuilder.CreateCylinder("waterTank", { diameter: 14, height: 12, tessellation: 16 }, scene);
  tank.position.set(-75, 14 + 40, 30);
  tank.material = assets.paintedWhite();
  tank.parent = root;

  // Perimeter berm
  const berm = MeshBuilder.CreateTorus("berm", { diameter: 300, thickness: 18, tessellation: 48 }, scene);
  berm.position.y = 1.4;
  berm.scaling.y = 0.16;
  berm.material = assets.grass();
  berm.parent = root;

  root.position = new Vector3(0, 0, 0);
  return root;
}
```

- [ ] **Step 2: Implement `world/ksc/launcher.ts`**

```ts
// space-sim/world/ksc/launcher.ts
import { MeshBuilder, TransformNode, Vector3, type Scene } from "@babylonjs/core";
import type { Assets } from "../../core/assets";

export interface MobileLauncher {
  root: TransformNode;
  arms: TransformNode[];
  /** k: 0 = mated, 1 = fully retracted. Called at ignition. */
  retractArms(k: number): void;
}

export function createMobileLauncher(scene: Scene, assets: Assets): MobileLauncher {
  const root = new TransformNode("mobileLauncher", scene);
  root.position.set(0, 14, 0); // sits on pad deck

  // Base
  const base = MeshBuilder.CreateBox("mlBase", { width: 40, depth: 34, height: 7.6 }, scene);
  base.position.y = 3.8;
  base.material = assets.steelStructure();
  base.parent = root;

  // Deck plate with launch mount hole illusion (darker center box)
  const mount = MeshBuilder.CreateBox("mlMount", { width: 18, depth: 18, height: 2.4 }, scene);
  mount.position.y = 8.8;
  mount.material = assets.steelStructure();
  mount.parent = root;

  // Tower (west of stack, like LC-39A ML)
  const tower = MeshBuilder.CreateBox("mlTower", { width: 12, depth: 12, height: 120 }, scene);
  tower.position.set(-26, 60 + 7.6, 0);
  tower.material = assets.steelStructure();
  tower.parent = root;
  // Tower lattice lines
  for (let y = 10; y < 120; y += 10) {
    const ring = MeshBuilder.CreateBox(`mlRing${y}`, { width: 13, depth: 13, height: 0.8 }, scene);
    ring.position.set(-26, y + 7.6, 0);
    ring.material = assets.steelStructure();
    ring.parent = root;
  }

  // Swing arms: 9, at increasing heights, extending east toward the stack
  const arms: TransformNode[] = [];
  const armHeights = [18, 30, 42, 54, 66, 78, 90, 102, 114];
  armHeights.forEach((h, i) => {
    const pivot = new TransformNode(`armPivot${i}`, scene);
    pivot.position.set(-20, h + 7.6, (i % 3 - 1) * 6);
    pivot.parent = root;
    const arm = MeshBuilder.CreateBox(`arm${i}`, { width: 16, depth: 1.6, height: 1.2 }, scene);
    arm.position.set(8, 0, 0);
    arm.material = assets.steelStructure();
    arm.parent = pivot;
    const boom = MeshBuilder.CreateCylinder(`armBoom${i}`, { diameter: 0.5, height: 12 }, scene);
    boom.rotation.z = Math.PI / 2;
    boom.position.set(8, -0.8, 0);
    boom.material = assets.steelStructure();
    boom.parent = pivot;
    arms.push(pivot);
  });

  const retractArms = (k: number): void => {
    arms.forEach((pivot, i) => {
      pivot.rotation.y = -k * (1.1 + i * 0.06);
    });
  };

  return { root, arms, retractArms };
}

export function createCrawler(scene: Scene, assets: Assets): TransformNode {
  const root = new TransformNode("crawler", scene);
  root.position.set(-1600, 0, -1400); // parked on crawlerway
  root.rotation.y = Math.atan2(3200, 2800); // aligned toward pad
  const body = MeshBuilder.CreateBox("crawlerBody", { width: 40, depth: 35, height: 6 }, scene);
  body.position.y = 3;
  body.material = assets.steelStructure();
  body.parent = root;
  for (const [x, z] of [[-14, -13], [14, -13], [-14, 13], [14, 13]]) {
    const treads = MeshBuilder.CreateBox("crawlerTread", { width: 10, depth: 8, height: 2.4 }, scene);
    treads.position.set(x, 1.2, z);
    treads.material = assets.blackTile();
    treads.parent = root;
  }
  const cab = MeshBuilder.CreateBox("crawlerCab", { width: 6, depth: 5, height: 3 }, scene);
  cab.position.set(-16, 7.5, 0);
  cab.material = assets.paintedWhite();
  cab.parent = root;
  return root;
}
```

- [ ] **Step 3: Wire into `main.ts`**

```ts
  const { createPad } = await import("./world/ksc/pad");
  createPad(scene, assets);
  const { createMobileLauncher, createCrawler } = await import("./world/ksc/launcher");
  const ml = createMobileLauncher(scene, assets);
  createCrawler(scene, assets);
```

Expose `ml` on the world object (return shape of `boot()` grows to `{ engine, scene, sky, earth, ml }` — used by Task 10's flight model for `retractArms`).

- [ ] **Step 4: Visual verification + commit**

Browser: pad deck with scorch center, three lightning masts, water tower, ML tower west of a (not-yet-present) rocket position, arms reaching east at graduated heights, crawler parked on the crawlerway strip. Correct scale defects before commit.

```bash
git add space-sim/world/ksc/pad.ts space-sim/world/ksc/launcher.ts space-sim/main.ts && git commit -m "feat(space-sim): LC-39A pad, lightning masts, mobile launcher w/ swing arms, crawler"
```

---

### Task 9: KSC ground props — roads, fences, signs, service vehicles, personnel

**Files:**
- Create: `space-sim/world/ksc/props.ts`
- Modify: `space-sim/main.ts`

**Interfaces:**
- Consumes: `Assets` (Task 4), `labelCanvas`.
- Produces: `createProps(scene: Scene, assets: Assets): TransformNode` — perimeter road ring, ~40 service vehicles near pad (white vans, red fire truck, fuel trucks), 6 personnel figures (simple capsule+suit shapes, no faces), light poles, fence posts along access road, 3 pad signs ("LC-39A"), distant parking lot.

- [ ] **Step 1: Implement `world/ksc/props.ts`**

```ts
// space-sim/world/ksc/props.ts
import {
  Color3, MeshBuilder, StandardMaterial, TransformNode, type Scene,
} from "@babylonjs/core";
import type { Assets } from "../../core/assets";

function van(scene: Scene, x: number, z: number, ry: number, color: Color3): TransformNode {
  const v = new TransformNode(`van_${x}_${z}`, scene);
  v.position.set(x, terrainHeightSafe(x, z), z);
  v.rotation.y = ry;
  const body = MeshBuilder.CreateBox("vanBody", { width: 5.5, height: 2.2, depth: 2.2 }, scene);
  body.position.y = 1.4;
  body.parent = v;
  const cab = MeshBuilder.CreateBox("vanCab", { width: 1.6, height: 1.6, depth: 2.1 }, scene);
  cab.position.set(-3.2, 1.1, 0);
  cab.parent = v;
  const m = new StandardMaterial("vanMat", scene);
  m.diffuseColor = color;
  body.material = m; cab.material = m;
  for (const [wx, wz] of [[-1.8, 1.1], [1.8, 1.1], [-1.8, -1.1], [1.8, -1.1]]) {
    const wheel = MeshBuilder.CreateCylinder("wheel", { diameter: 0.8, height: 0.4 }, scene);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.4, wz);
    wheel.parent = v;
  }
  return v;
}

// Local import to avoid circular dep with terrain module
import { terrainHeight } from "./terrain";
function terrainHeightSafe(x: number, z: number): number {
  return Math.max(terrainHeight(x, z), 0.1) + 0.05;
}

function person(scene: Scene, x: number, z: number, suit: StandardMaterial): TransformNode {
  const p = new TransformNode(`person_${x}_${z}`, scene);
  p.position.set(x, terrainHeightSafe(x, z), z);
  p.rotation.y = Math.random() * Math.PI * 2;
  const torso = MeshBuilder.CreateCapsule("torso", { height: 0.9, radius: 0.22 }, scene);
  torso.position.y = 1.15;
  torso.material = suit;
  torso.parent = p;
  const head = MeshBuilder.CreateSphere("head", { diameter: 0.26 }, scene);
  head.position.y = 1.75;
  head.material = suit;
  head.parent = p;
  const legs = MeshBuilder.CreateBox("legs", { width: 0.34, height: 0.8, depth: 0.24 }, scene);
  legs.position.y = 0.4;
  legs.material = suit;
  legs.parent = p;
  return p;
}

export function createProps(scene: Scene, assets: Assets): TransformNode {
  const root = new TransformNode("kscProps", scene);

  // Perimeter road: ring of asphalt quads around pad (r=220)
  const road = MeshBuilder.CreateGround("perimeterRoad", { width: 620, height: 620 }, scene);
  road.position.y = 0.22;
  const roadMat = assets.asphalt();
  road.material = roadMat;
  road.isPickable = false;
  // Punch visual: road is a thin ring via scaling — approximate with large flat ring
  road.scaling.y = 0.0001;
  road.parent = root;
  const ring = MeshBuilder.CreateTorus("roadRing", { diameter: 460, thickness: 12, tessellation: 64 }, scene);
  ring.position.y = 0.24;
  ring.scaling.y = 0.02;
  ring.material = roadMat;
  ring.parent = root;

  // Fence posts along access road from VAB
  for (let i = 0; i < 40; i++) {
    const t = i / 39;
    const x = -3200 * (1 - t) + 0 * t - 30;
    const z = -2800 * (1 - t) + 30;
    const post = MeshBuilder.CreateBox("fencePost", { width: 0.15, height: 2.4, depth: 0.15 }, scene);
    post.position.set(x, terrainHeightSafe(x, z) + 1.2, z + 26);
    post.material = assets.steelStructure();
    post.parent = root;
  }

  // Pad signs
  for (const [x, z, ry] of [[-120, -60, 0.6], [90, 80, -2.2], [-40, 110, 0]]) {
    const post = MeshBuilder.CreateBox("signPost", { width: 0.3, height: 3.4, depth: 0.3 }, scene);
    post.position.set(x, terrainHeightSafe(x, z) + 1.7, z);
    post.material = assets.steelStructure();
    post.parent = root;
    const board = MeshBuilder.CreatePlane("signBoard", { width: 3.4, height: 1.4 }, scene);
    board.position.set(x, terrainHeightSafe(x, z) + 2.9, z);
    board.rotation.y = ry;
    const m = new StandardMaterial(`signMat_${x}`, scene);
    m.diffuseTexture = assets.labelCanvas("LC-39A", 512, 192);
    board.material = m;
    board.parent = root;
  }

  // Light poles around pad
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = Math.cos(a) * 200, z = Math.sin(a) * 200;
    const pole = MeshBuilder.CreateCylinder("lightPole", { diameter: 0.4, height: 14 }, scene);
    pole.position.set(x, terrainHeightSafe(x, z) + 7, z);
    pole.material = assets.steelStructure();
    pole.parent = root;
    const lamp = MeshBuilder.CreateBox("lamp", { width: 2, height: 0.4, depth: 1 }, scene);
    lamp.position.set(x, terrainHeightSafe(x, z) + 14, z);
    lamp.material = assets.paintedWhite();
    lamp.parent = root;
  }

  // Service vehicles cluster (pad west apron)
  const white = new Color3(0.92, 0.92, 0.9);
  const red = new Color3(0.75, 0.12, 0.1);
  const yellow = new Color3(0.85, 0.7, 0.1);
  van(scene, -70, -40, 0.4, white); van(scene, -78, -34, -0.8, white);
  van(scene, -62, -50, 1.2, white); van(scene, -88, -28, 0.1, red);
  van(scene, -56, -28, 2.4, yellow); van(scene, -70, -60, -1.1, white);
  van(scene, -95, -44, 0.7, white); van(scene, -48, -64, 2.9, white);

  // Personnel near vehicles
  const suit = new StandardMaterial("suit", scene);
  suit.diffuseColor = new Color3(0.85, 0.86, 0.88);
  const orange = new StandardMaterial("suitOrange", scene);
  orange.diffuseColor = new Color3(0.95, 0.45, 0.08);
  for (const [x, z] of [[-66, -36], [-74, -46], [-58, -44], [-84, -38], [-68, -28], [-90, -52]]) {
    person(scene, x, z, Math.random() < 0.5 ? suit : orange);
  }

  // Distant parking lot west
  const lot = MeshBuilder.CreateGround("parkingLot", { width: 120, height: 80 }, scene);
  lot.position.set(-400, terrainHeightSafe(-400, 200) + 0.03, 200);
  lot.material = assets.asphalt();
  lot.parent = root;

  // Crew-quarters anchor node at the O&C building (used by the pov_crew_prep rig)
  const crewQuarters = new TransformNode("crewQuarters", scene);
  crewQuarters.position.set(-3050, terrainHeightSafe(-3050, -2850), -2850);
  crewQuarters.parent = root;

  return root;
}
```

`createProps` returns `TransformNode`; for the provider, wrap the return: `const propsRoot = createProps(...); const crewQuarters = scene.getTransformNodeByName("crewQuarters");` (used in the wiring step below).

- [ ] **Step 2: Wire into `main.ts` and verify**

```ts
  const { createProps } = await import("./world/ksc/props");
  createProps(scene, assets);
  targetProviders.crewQuarters = () => scene.getTransformNodeByName("crewQuarters");
```

Browser: `svc_vehicles` and `pad_ground_level` framings show vehicles/personnel with believable scale vs the 98 m rocket-to-come; road ring and fence posts read at distance. Fix scale/placement defects before commit.

- [ ] **Step 3: Commit**

```bash
git add space-sim/world/ksc/props.ts space-sim/main.ts && git commit -m "feat(space-sim): KSC ground props — roads, fences, signs, service vehicles, personnel"
```

---

### Task 10: SLS + Orion stack (procedural builders)

**Files:**
- Create: `space-sim/vehicles/sls.ts`
- Modify: `space-sim/main.ts`

**Interfaces:**
- Consumes: `Assets` (Task 4).
- Produces: `interface SlsStack { root: TransformNode; enginesNode: TransformNode; orionNode: TransformNode; srbL: TransformNode; srbR: TransformNode; coreNode: TransformNode; icpsNode: TransformNode; lasNode: TransformNode; detach(node: TransformNode): void }`, `createSlsStack(scene: Scene, assets: Assets): SlsStack`.
  - Dimensions (real): core stage 65 m × Ø8.4 m; SRBs 54 m × Ø3.7 m (5-segment); ICPS 13.7 m × Ø5 m; Orion CM+SM 7.4 m total; LAS 13 m. Stack ~98 m on ML mount at y≈pad deck 14 + ML base 7.6 + mount ≈ **y0 = 24**.
  - `detach(node)`: unparents node from stack root, keeps world position (`node.setParent(null)` after baking transform), giving it independent physics (driven by flight model in Task 11).
  - Markings: `USA` + worm on core side (DynamicTexture), NASA meatball on Orion SM, `SLS` black roll pattern on SRBs.

- [ ] **Step 1: Implement `vehicles/sls.ts`**

```ts
// space-sim/vehicles/sls.ts
import {
  DynamicTexture, Mesh, MeshBuilder, StandardMaterial, Texture, TransformNode, Vector3, type Scene,
} from "@babylonjs/core";
import type { Assets } from "../core/assets";

const STACK_Y = 24; // pad deck 14 + ML base 7.6 + mount clearance

function wormMat(scene: Scene): StandardMaterial {
  const m = new StandardMaterial("coreWorm", scene);
  m.diffuseTexture = new DynamicTexture("coreWormTex", { width: 1024, height: 512 }, scene, true);
  const c = m.diffuseTexture as DynamicTexture;
  const ctx = c.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 1024, 512);
  // USA block letters + worm logo, black on transparent (overlaid on foam via second mesh)
  ctx.fillStyle = "#0a0a0a";
  ctx.font = "bold 120px monospace";
  ctx.fillText("USA", 60, 200);
  ctx.font = "bold 90px monospace";
  ctx.fillText("SLS", 60, 320);
  ctx.strokeStyle = "#0a0a0a"; ctx.lineWidth = 22; ctx.lineCap = "round";
  // worm: N-A-S-A curve approximation
  ctx.beginPath(); ctx.moveTo(600, 260); ctx.quadraticCurveTo(650, 180, 700, 260);
  ctx.quadraticCurveTo(750, 340, 800, 260); ctx.quadraticCurveTo(850, 180, 900, 260);
  ctx.stroke();
  c.hasAlpha = true;
  c.update();
  return m;
}

function srbMarkingMat(scene: Scene): StandardMaterial {
  const m = new StandardMaterial("srbMarking", scene);
  m.diffuseTexture = new DynamicTexture("srbMarkTex", { width: 256, height: 1024 }, scene, true);
  const c = m.diffuseTexture as DynamicTexture;
  const ctx = c.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 256, 1024);
  ctx.fillStyle = "#101010";
  ctx.fillRect(0, 880, 256, 60); // base band
  ctx.font = "bold 54px monospace";
  ctx.save();
  ctx.translate(128, 500); ctx.rotate(Math.PI / 2);
  ctx.fillText("SLS", -40, 20);
  ctx.restore();
  c.hasAlpha = true;
  c.update();
  return m;
}

export interface SlsStack {
  root: TransformNode;
  enginesNode: TransformNode;
  orionNode: TransformNode;
  srbL: TransformNode;
  srbR: TransformNode;
  coreNode: TransformNode;
  icpsNode: TransformNode;
  lasNode: TransformNode;
  detach(node: TransformNode): void;
}

export function createSlsStack(scene: Scene, assets: Assets): SlsStack {
  const root = new TransformNode("slsStack", scene);
  root.position.y = STACK_Y;

  // --- Core stage: 65m x Ø8.4, engine section + intertank detail ---
  const coreNode = new TransformNode("core", scene);
  coreNode.parent = root;
  const core = MeshBuilder.CreateCylinder("coreBody", { diameter: 8.4, height: 65, tessellation: 32 }, scene);
  core.position.y = 65 / 2 + 4;
  core.material = assets.foamOrange();
  core.parent = coreNode;
  const intertank = MeshBuilder.CreateCylinder("intertank", { diameter: 8.5, height: 2.2, tessellation: 32 }, scene);
  intertank.position.y = 38;
  intertank.material = assets.steelStructure();
  intertank.parent = coreNode;
  const engineSection = MeshBuilder.CreateCylinder("engSection", { diameter: 8.4, height: 4, tessellation: 32 }, scene);
  engineSection.position.y = 2;
  engineSection.material = assets.steelStructure();
  engineSection.parent = coreNode;

  // USA/worm overlay (slightly larger radius, alpha texture)
  const marking = MeshBuilder.CreateCylinder("coreMarking", { diameter: 8.45, height: 24, tessellation: 32 }, scene);
  marking.position.y = 14;
  marking.material = wormMat(scene);
  marking.parent = coreNode;

  // --- 4x RS-25 engines ---
  const enginesNode = new TransformNode("engines", scene);
  enginesNode.parent = coreNode;
  for (const [x, z] of [[-2.6, -1.5], [2.6, -1.5], [0, 3]]) {
    const nozzle = MeshBuilder.CreateCylinder("rs25", { diameterTop: 1.2, diameterBottom: 2.3, height: 4.2, tessellation: 24 }, scene);
    nozzle.position.set(x, -2.6, z);
    nozzle.material = assets.steelStructure();
    nozzle.parent = enginesNode;
    const bellInner = MeshBuilder.CreateCylinder("rs25Inner", { diameterTop: 1.0, diameterBottom: 2.0, height: 4.0, tessellation: 24 }, scene);
    bellInner.position.set(x, -2.6, z);
    bellInner.material = assets.blackTile();
    bellInner.parent = enginesNode;
  }

  // --- SRBs: 54m x Ø3.7 with nose cones, flanking core ---
  const makeSrb = (name: string, x: number): TransformNode => {
    const node = new TransformNode(name, scene);
    node.parent = root;
    const body = MeshBuilder.CreateCylinder(`${name}Body`, { diameter: 3.7, height: 44, tessellation: 24 }, scene);
    body.position.y = 22 + 4;
    body.material = assets.srbWhite();
    body.parent = node;
    const aftSkirt = MeshBuilder.CreateCylinder(`${name}Skirt`, { diameter: 3.9, height: 6, tessellation: 24 }, scene);
    aftSkirt.position.y = 4 + 3;
    aftSkirt.material = assets.steelStructure();
    aftSkirt.parent = node;
    const nose = MeshBuilder.CreateCylinder(`${name}Nose`, { diameterTop: 0.4, diameterBottom: 3.7, height: 8, tessellation: 24 }, scene);
    nose.position.y = 44 + 4 + 4;
    nose.material = assets.srbWhite();
    nose.parent = node;
    const marking = MeshBuilder.CreateCylinder(`${name}Mark`, { diameter: 3.74, height: 30, tessellation: 24 }, scene);
    marking.position.y = 24 + 4;
    marking.material = srbMarkingMat(scene);
    marking.parent = node;
    const nozzle = MeshBuilder.CreateCylinder(`${name}Nozzle`, { diameterTop: 1.6, diameterBottom: 2.6, height: 3.6, tessellation: 24 }, scene);
    nozzle.position.y = 4 - 1.4;
    nozzle.material = assets.blackTile();
    nozzle.parent = node;
    node.position.x = x;
    return node;
  };
  const srbL = makeSrb("srbL", -7.2);
  const srbR = makeSrb("srbR", 7.2);

  // --- ICPS: 13.7m x Ø5 ---
  const icpsNode = new TransformNode("icps", scene);
  icpsNode.parent = root;
  const icps = MeshBuilder.CreateCylinder("icpsBody", { diameter: 5, height: 13.7, tessellation: 24 }, scene);
  icps.position.y = 65 + 4 + 13.7 / 2;
  icps.material = assets.paintedWhite();
  icps.parent = icpsNode;

  // --- Orion: SM (Ø5, 4.1m) + CM (truncated cone) + LAS tower ---
  const orionNode = new TransformNode("orion", scene);
  orionNode.parent = root;
  orionNode.position.y = 65 + 4 + 13.7;
  const sm = MeshBuilder.CreateCylinder("orionSM", { diameter: 5, height: 4.1, tessellation: 24 }, scene);
  sm.position.y = 2.05;
  sm.material = assets.foilGold();
  sm.parent = orionNode;
  // 4 X-wing solar arrays (folded pre-launch; deployed flag later by flight model)
  const arrays: Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const wing = MeshBuilder.CreateBox(`orionArray${i}`, { width: 3.6, height: 0.06, depth: 1.2 }, scene);
    wing.position.set(Math.cos(a) * 3.4, 2.05, Math.sin(a) * 3.4);
    wing.rotation.y = -a;
    wing.material = assets.solarCell();
    wing.parent = orionNode;
    arrays.push(wing);
    const strut = MeshBuilder.CreateBox(`orionStrut${i}`, { width: 1.6, height: 0.12, depth: 0.3 }, scene);
    strut.position.set(Math.cos(a) * 1.6, 2.05, Math.sin(a) * 1.6);
    strut.rotation.y = -a;
    strut.material = assets.steelStructure();
    strut.parent = orionNode;
  }
  (orionNode as TransformNode & { deployed?: boolean }).deployed = false;
  const cm = MeshBuilder.CreateCylinder("orionCM", { diameterTop: 5, diameterBottom: 3.95, height: 3.3, tessellation: 24 }, scene);
  cm.position.y = 5.75;
  cm.material = assets.silverHull();
  cm.parent = orionNode;
  const heatshield = MeshBuilder.CreateCylinder("orionHS", { diameter: 3.95, height: 0.5, tessellation: 24 }, scene);
  heatshield.position.y = 3.9;
  heatshield.material = assets.blackTile();
  heatshield.parent = orionNode;

  // --- LAS abort tower: 13m ---
  const lasNode = new TransformNode("las", scene);
  lasNode.parent = root;
  lasNode.position.y = 65 + 4 + 13.7 + 7.4;
  const lasTower = MeshBuilder.CreateCylinder("lasTower", { diameter: 1.4, height: 10, tessellation: 12 }, scene);
  lasTower.position.y = 5;
  lasTower.material = assets.paintedWhite();
  lasTower.parent = lasNode;
  const lasBoost = MeshBuilder.CreateCylinder("lasBoost", { diameterTop: 0.9, diameterBottom: 1.8, height: 3, tessellation: 12 }, scene);
  lasBoost.position.y = 11.5;
  lasBoost.material = assets.blackTile();
  lasBoost.parent = lasNode;
  // canards
  for (const side of [-1, 1]) {
    const canard = MeshBuilder.CreateBox("lasCanard", { width: 2.2, height: 0.1, depth: 0.8 }, scene);
    canard.position.set(side * 0.9, 10.5, 0);
    canard.rotation.z = side * 0.2;
    canard.material = assets.paintedWhite();
    canard.parent = lasNode;
  }

  const detach = (node: TransformNode): void => {
    const worldPos = node.getAbsolutePosition();
    const worldRot = node.rotation.clone();
    node.setParent(null);
    node.position = worldPos;
    node.rotation = worldRot;
  };

  return { root, enginesNode, orionNode, srbL, srbR, coreNode, icpsNode, lasNode, detach };
}
```

Note: keep the code above clean — no `as never` casts anywhere in `sls.ts`.

- [ ] **Step 2: Wire into `main.ts` + register target providers**

```ts
  const { createSlsStack } = await import("./vehicles/sls");
  const sls = createSlsStack(scene, assets);
  // targetProviders for the ShotLibrary (Task 3 contract):
  targetProviders.stack = () => sls.root;
  targetProviders.engines = () => sls.enginesNode;
  targetProviders.orion = () => sls.orionNode;
```

(`targetProviders` is an object created before `new ShotLibrary(...)` — assemble world init in this order: assets → sky/stars/earth → terrain/VAB/pad/ML/props → SLS → ShotLibrary → director.)

- [ ] **Step 3: Visual verification + commit**

Browser: framing `rocket_closeup`/`rocket_ecl` shows: orange core with black USA/worm, two white SRBs with black SLS bands, gold-foil SM with 4 folded arrays, silver cone, white LAS with canards — proportions believable against the 120 m ML tower. Fix proportion/texture defects before commit.

```bash
git add space-sim/vehicles/sls.ts space-sim/main.ts && git commit -m "feat(space-sim): SLS core + SRBs + ICPS + Orion + LAS procedural stack"
```

---

### Task 11: Flight model + staging (TDD) + exhaust/smoke FX

**Files:**
- Create: `space-sim/vehicles/flight.ts`, `space-sim/effects/exhaust.ts`, `space-sim/effects/smoke.ts`
- Test: `space-sim/__tests__/flight.test.ts`
- Modify: `space-sim/main.ts`

**Interfaces:**
- Consumes: `SlsStack` (Task 10), `SkyController` (Task 5), `capsForTier` (Task 1).
- Produces:
  - `flight.ts` pure math: `type FlightPhase = "pad" | "liftoff" | "ascent" | "orbit"`, `altitudeAt(t: number): number`, `downrangeAt(t: number): number`, `pitchAt(t: number): number` (radians from vertical), `maxQWindow(): [number, number]` — piecewise smooth trajectories matching script beats (liftoff@0, SRB sep ≈ t=110, core sep ≈ t=210, orbit ≈ t=280 in mission seconds after LIFTOFF starts).
  - `flight.ts` class: `class FlightModel { constructor(stack: SlsStack, scene: Scene); ignite(): void; liftoff(): void; separateSrb(): void; separateCore(): void; orbitInsertion(): void; update(t: number, dt: number): void; currentAltitude: number; jettisoned: Set<string> }`
  - `exhaust.ts`: `class ExhaustSystem { constructor(scene: Scene, enginesNode: TransformNode, maxParticles: number); ignite(on: boolean); throttle(v: number); plumeLight: PointLight; update(dt: number, altitude: number) }` — RS-25 core plume + SRB plumes, dynamic light.
  - `smoke.ts`: `class GroundSmoke { constructor(scene: Scene, origin: Vector3, maxParticles: number); ramp(v: number); update(dt: number) }` — billowing steam clouds at pad trench mouth.

- [ ] **Step 1: Write the failing flight math tests**

```ts
// space-sim/__tests__/flight.test.ts
import { describe, expect, it } from "vitest";
import { altitudeAt, downrangeAt, maxQWindow, pitchAt } from "../vehicles/flight";

describe("flight profile", () => {
  it("starts on the pad", () => {
    expect(altitudeAt(-5)).toBe(0);
    expect(altitudeAt(0)).toBe(0);
    expect(downrangeAt(0)).toBe(0);
  });
  it("is monotonically climbing after liftoff", () => {
    let prev = 0;
    for (let t = 1; t <= 280; t += 5) {
      const a = altitudeAt(t);
      expect(a).toBeGreaterThan(prev);
      prev = a;
    }
  });
  it("reaches ~400km orbital altitude by insertion", () => {
    expect(altitudeAt(280)).toBeGreaterThan(380000);
    expect(altitudeAt(280)).toBeLessThan(420000);
  });
  it("pitches from vertical toward horizontal", () => {
    expect(pitchAt(1)).toBeLessThan(0.1);
    expect(pitchAt(280)).toBeGreaterThan(1.2);
  });
  it("has a max-Q window in the first 90 seconds", () => {
    const [q0, q1] = maxQWindow();
    expect(q0).toBeGreaterThan(20);
    expect(q1).toBeLessThan(90);
    expect(q1).toBeGreaterThan(q0);
  });
  it("downrange grows to hundreds of km by insertion", () => {
    expect(downrangeAt(280)).toBeGreaterThan(50000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- space-sim/__tests__/flight.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement pure trajectory math in `vehicles/flight.ts`**

```ts
// space-sim/vehicles/flight.ts
export type FlightPhase = "pad" | "liftoff" | "ascent" | "orbit";

/** Cinematic (compressed) ascent: 280 s from liftoff to insertion. */
const T_INSERT = 280;
const T_SRB_SEP = 110;
const T_CORE_SEP = 210;
const TARGET_ALT = 400000; // m
const TARGET_DOWNRANGE = 120000; // m

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function altitudeAt(t: number): number {
  if (t <= 0) return 0;
  // Ease-in start (slow initial climb), long exponential-ish climb, flatten at insertion
  const k = smoothstep(0, T_INSERT, t);
  const eased = Math.pow(k, 2.1) * (3 - 2 * Math.pow(k, 0.35));
  return Math.max(0, eased * TARGET_ALT);
}

export function downrangeAt(t: number): number {
  if (t <= 0) return 0;
  const k = smoothstep(20, T_INSERT, t);
  return k * TARGET_DOWNRANGE;
}

export function pitchAt(t: number): number {
  if (t <= 0) return 0;
  return smoothstep(8, T_INSERT, t) * (Math.PI / 2 - 0.12);
}

export function maxQWindow(): [number, number] {
  return [38, 62];
}

export function phaseOf(t: number): FlightPhase {
  if (t <= 0) return "pad";
  if (t > T_INSERT) return "orbit";
  return t < 12 ? "liftoff" : "ascent";
}

export { T_INSERT, T_SRB_SEP, T_CORE_SEP };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- space-sim/__tests__/flight.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Implement `FlightModel` class (append to `vehicles/flight.ts`)**

```ts
// appended to space-sim/vehicles/flight.ts
import type { Scene, TransformNode, Vector3 } from "@babylonjs/core";

export interface StackNodes {
  root: TransformNode;
  coreNode: TransformNode;
  srbL: TransformNode;
  srbR: TransformNode;
  icpsNode: TransformNode;
  orionNode: TransformNode;
  lasNode: TransformNode;
  detach(node: TransformNode): void;
}

export class FlightModel {
  currentAltitude = 0;
  jettisoned = new Set<string>();
  private t0 = -1; // mission time of liftoff
  private srbDrift = new Map<TransformNode, { v: Vector3; spin: number }>();
  private coreDrift: { v: Vector3 } | null = null;

  constructor(private stack: StackNodes, private scene: Scene) {}

  get liftoffTime(): number { return this.t0; }

  ignite(): void { /* visual handled by ExhaustSystem; ML arms retract handled by UI sink */ }

  liftoff(): void { this.t0 = 0; }

  separateSrb(): void {
    if (this.jettisoned.has("srb")) return;
    this.jettisoned.add("srb");
    for (const srb of [this.stack.srbL, this.stack.srbR]) {
      this.stack.detach(srb);
      const outward = srb.name === "srbL" ? -1 : 1;
      this.srbDrift.set(srb, {
        v: new Vector3(outward * 6, -4, 0),
        spin: outward * 0.6,
      });
    }
  }

  separateCore(): void {
    if (this.jettisoned.has("core")) return;
    this.jettisoned.add("core");
    this.stack.detach(this.stack.coreNode);
    this.coreDrift = { v: new Vector3(0, -8, 0) };
  }

  orbitInsertion(): void {
    if (this.jettisoned.has("icps")) return;
    this.jettisoned.add("icps");
    this.stack.detach(this.stack.icpsNode);
    this.stack.detach(this.stack.lasNode);
  }

  /** t = seconds since liftoff (negative before). dt in seconds. */
  update(t: number, dt: number): void {
    this.currentAltitude = altitudeAt(t);
    const alt = this.currentAltitude;
    const pitch = pitchAt(t);
    const dr = downrangeAt(t);
    if (t >= 0 && !this.jettisoned.has("stackMoved")) {
      this.stack.root.position.y = 24 + alt;
      // Downrange east (+X), pitch over: rotate stack about Z toward +X
      this.stack.root.rotation.z = -pitch;
      this.stack.root.position.x = dr * Math.cos(pitch);
      this.jettisoned.add("stackMoved");
    } else if (t >= 0) {
      this.stack.root.position.y = 24 + alt;
      this.stack.root.rotation.z = -pitch;
      this.stack.root.position.x = dr * Math.cos(pitch);
    }
    // Jettisoned pieces keep their own motion
    for (const [node, drift] of this.srbDrift) {
      node.position.addInPlace(drift.v.scale(dt));
      drift.v.y -= 9.8 * dt * 0.4;
      node.rotation.z += drift.spin * dt;
    }
    if (this.coreDrift) {
      this.stack.coreNode.position.addInPlace(this.coreDrift.v.scale(dt));
      this.coreDrift.v.y -= 9.8 * dt * 0.3;
      this.stack.coreNode.rotation.x += 0.05 * dt;
    }
  }
}
```

Note: the `Scene` import in `flight.ts` is unused after this class — import only `{ TransformNode, Vector3 }` (`import type { TransformNode, Vector3 } from "@babylonjs/core";`) and drop the `private scene: Scene` constructor param, or keep it without `void` and without the private modifier. The cleanest is: constructor takes no `scene`; update the `new FlightModel(sls, scene)` call in Task 12 accordingly.

- [ ] **Step 6: Implement `effects/exhaust.ts`**

```ts
// space-sim/effects/exhaust.ts
import {
  Color4, GPUParticleSystem, ParticleSystem, PointLight, Texture, TransformNode,
  Vector3, type Scene,
} from "@babylonjs/core";
import { DynamicTexture } from "@babylonjs/core";

function glowTex(scene: Scene): Texture {
  const dt = new DynamicTexture("plumeGlow", { width: 128, height: 128 }, scene, true);
  const c = dt.getContext() as unknown as CanvasRenderingContext2D;
  const g = c.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,230,180,0.9)");
  g.addColorStop(0.6, "rgba(255,140,60,0.5)");
  g.addColorStop(1, "rgba(255,80,20,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  dt.hasAlpha = true;
  dt.update();
  return dt;
}

export class ExhaustSystem {
  plumeLight: PointLight;
  private systems: Array<ParticleSystem | GPUParticleSystem> = [];
  private throttle = 0;
  private targetThrottle = 0;

  constructor(private scene: Scene, enginesNode: TransformNode, maxParticles: number, gpu: boolean) {
    this.plumeLight = new PointLight("plumeLight", Vector3.Zero(), scene);
    this.plumeLight.diffuse = new Color3(1, 0.72, 0.4);
    this.plumeLight.intensity = 0;
    this.plumeLight.range = 400;
    const tex = glowTex(scene);
    const makeOne = (localY: number, offsetX: number, capacity: number, size: number, emitRate: number): void => {
      const emitter = new TransformNode(`exhEmitter${localY}_${offsetX}`, scene);
      emitter.parent = enginesNode;
      emitter.position.set(offsetX, localY, 0);
      const sys = gpu
        ? new GPUParticleSystem(`exhaust${localY}_${offsetX}`, { capacity }, scene)
        : new ParticleSystem(`exhaust${localY}_${offsetX}`, capacity, scene);
      (sys as ParticleSystem).particleTexture = tex;
      (sys as ParticleSystem).emitter = emitter;
      (sys as ParticleSystem).minEmitBox = new Vector3(-0.6, 0, -0.6);
      (sys as ParticleSystem).maxEmitBox = new Vector3(0.6, 0, 0.6);
      (sys as ParticleSystem).color1 = new Color4(1.0, 0.85, 0.5, 0.9);
      (sys as ParticleSystem).color2 = new Color4(1.0, 0.5, 0.15, 0.8);
      (sys as ParticleSystem).colorDead = new Color4(0.3, 0.1, 0.05, 0);
      (sys as ParticleSystem).minSize = size * 0.6;
      (sys as ParticleSystem).maxSize = size;
      (sys as ParticleSystem).minLifeTime = 0.25;
      (sys as ParticleSystem).maxLifeTime = 0.7;
      (sys as ParticleSystem).emitRate = emitRate;
      (sys as ParticleSystem).direction1 = new Vector3(-1.5, -60, -1.5);
      (sys as ParticleSystem).direction2 = new Vector3(1.5, -90, 1.5);
      (sys as ParticleSystem).gravity = new Vector3(0, -9.8, 0);
      (sys as ParticleSystem).blendMode = ParticleSystem.BLENDMODE_ADD;
      (sys as ParticleSystem).start();
      this.systems.push(sys);
    };
    // Core 4-engine cluster (positions mirror SLS engine layout)
    makeOne(-4.5, -2.6, Math.floor(maxParticles * 0.4), 9, Math.floor(maxParticles * 0.35));
    makeOne(-4.5, 2.6, Math.floor(maxParticles * 0.2), 9, Math.floor(maxParticles * 0.2));
    makeOne(-4.5, 0, Math.floor(maxParticles * 0.2), 9, Math.floor(maxParticles * 0.2));
  }

  ignite(on: boolean): void { this.targetThrottle = on ? 1 : 0; }
  throttle(v: number): void { this.targetThrottle = v; }

  update(dt: number, altitude: number): void {
    this.throttle += (this.targetThrottle - this.throttle) * Math.min(1, dt * 3);
    const flicker = 0.85 + Math.sin(performance.now() * 0.045) * 0.15;
    this.plumeLight.intensity = 900 * this.throttle * flicker;
    // In vacuum: plumes widen (size growth stands in for lower ambient pressure)
    const widen = Math.min(1, altitude / 60000);
    for (const sys of this.systems) {
      (sys as ParticleSystem).maxSize = 9 + widen * 26;
    }
  }
}
```

Ensure the `Color3` import is present in `exhaust.ts` and there are no `as never` casts or unused fields (`scene` constructor param is used for systems only — remove the private modifier if lint flags it).

- [ ] **Step 7: Implement `effects/smoke.ts`**

```ts
// space-sim/effects/smoke.ts
import {
  Color3, Color4, DynamicTexture, GPUParticleSystem, ParticleSystem, Texture,
  Vector3, type Scene,
} from "@babylonjs/core";

function smokeTex(scene: Scene): Texture {
  const dt = new DynamicTexture("smokeTex", { width: 128, height: 128 }, scene, true);
  const c = dt.getContext() as unknown as CanvasRenderingContext2D;
  const g = c.createRadialGradient(64, 64, 8, 64, 64, 62);
  g.addColorStop(0, "rgba(255,255,255,0.85)");
  g.addColorStop(0.6, "rgba(230,228,224,0.45)");
  g.addColorStop(1, "rgba(220,218,214,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  dt.hasAlpha = true;
  dt.update();
  return dt;
}

export class GroundSmoke {
  private sys: ParticleSystem | GPUParticleSystem;
  private targetRamp = 0;
  private ramp = 0;

  constructor(scene: Scene, origin: Vector3, maxParticles: number, gpu: boolean) {
    const capacity = Math.max(600, Math.floor(maxParticles * 0.5));
    this.sys = gpu
      ? new GPUParticleSystem("padSmoke", { capacity }, scene)
      : new ParticleSystem("padSmoke", capacity, scene);
    const ps = this.sys as ParticleSystem;
    ps.particleTexture = smokeTex(scene);
    ps.emitter = origin;
    ps.minEmitBox = new Vector3(-14, 0, -14);
    ps.maxEmitBox = new Vector3(14, 4, 14);
    ps.color1 = new Color4(0.95, 0.94, 0.92, 0.55);
    ps.color2 = new Color4(0.8, 0.79, 0.78, 0.5);
    ps.colorDead = new Color4(0.7, 0.7, 0.7, 0);
    ps.minSize = 14; ps.maxSize = 60;
    ps.minLifeTime = 4; ps.maxLifeTime = 11;
    ps.emitRate = 400;
    ps.direction1 = new Vector3(-24, 6, -24);
    ps.direction2 = new Vector3(24, 14, 24);
    ps.gravity = new Vector3(0, 0.35, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.start();
    ps.manualEmitCount = 0;
  }

  ramp(v: number): void { this.targetRamp = v; }

  update(dt: number): void {
    this.ramp += (this.targetRamp - this.ramp) * Math.min(1, dt * 0.8);
    (this.sys as ParticleSystem).emitRate = 500 * this.ramp;
  }
}
```

- [ ] **Step 8: Wire into `main.ts`**

```ts
  const { FlightModel } = await import("./vehicles/flight");
  const flight = new FlightModel(sls, scene);
  const { ExhaustSystem } = await import("./effects/exhaust");
  const exhaust = new ExhaustSystem(scene, sls.enginesNode, caps.maxParticles, caps.gpuParticles);
  exhaust.plumeLight.parent = sls.enginesNode;
  const { GroundSmoke } = await import("./effects/smoke");
  const smoke = new GroundSmoke(scene, new Vector3(0, 16, -70), caps.maxParticles, caps.gpuParticles);
```

Expose `{ flight, exhaust, smoke, ml }` from boot's world object for the mission sinks in Task 12.

- [ ] **Step 9: Lint + tests + commit**

Run: `npm run lint && npm run test`
Expected: PASS.

```bash
git add space-sim/vehicles space-sim/effects space-sim/__tests__/flight.test.ts space-sim/main.ts && git commit -m "feat(space-sim): flight model + staging, exhaust plume + ground smoke FX"
```

---

### Task 12: Mission wiring — sinks connect engine to world (full launch works end-to-end)

**Files:**
- Create: `space-sim/mission/runtime.ts`
- Modify: `space-sim/main.ts`

**Interfaces:**
- Consumes: everything so far (Task 2 engine/script, Task 3 director, Tasks 5–11 world/flight/FX).
- Produces: `createMissionRuntime(deps: { scene: Scene; director: CinematicDirector; sky: SkyController; flight: FlightModel; exhaust: ExhaustSystem; smoke: GroundSmoke; ml: MobileLauncher; ui: UiSinks }): { engine: MissionEngine; update(dt: number): void }` where `interface UiSinks { onComms(c: CommsLine): void; onHud(h: HudChange): void; onState(s: MissionState): void }` (Task 14 implements the UI side; interim no-op acceptable).
- The runtime maps `MissionSinks`:
  - `onShot` → `director.playShot`
  - `onTransition` → `director.cut`
  - `onCommand` → flight/exhaust/ml actions (`ignite`: `exhaust.ignite(true)` + `ml.retractArms(1)` animated over 3 s + `smoke.ramp(1)`; `liftoff`: `flight.liftoff()`; `separateSrb`/`separateCore`/`orbitInsertion` → flight model; `enablePlayer` → stub until Task 15)
  - `onFx` → `sky.applyFx`, `smoke.ramp`
  - `onComms`/`onHud`/`onState` → `ui` sinks; also `sky.setAltitude(flight.currentAltitude)` each frame.

- [ ] **Step 1: Implement `mission/runtime.ts`**

```ts
// space-sim/mission/runtime.ts
import type { Scene } from "@babylonjs/core";
import { MISSION_SCRIPT, STATE_DURATIONS, MissionEngine, type Command, type CommsLine, type FxCommand, type HudChange, type MissionState } from "./engine";
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
  let armRetract = -1; // seconds since ignition for arm animation

  const handleCommand = (c: Command): void => {
    switch (c.kind) {
      case "ignite":
        deps.exhaust.ignite(true);
        deps.smoke.ramp(1);
        armRetract = 0;
        break;
      case "liftoff":
        deps.flight.liftoff();
        break;
      case "separateSrb": deps.flight.separateSrb(); break;
      case "separateCore": deps.flight.separateCore(); break;
      case "orbitInsertion": deps.flight.orbitInsertion(); break;
      default: break; // dock*/hatch/interior/player handled in later tasks
    }
  };

  const engine = new MissionEngine(MISSION_SCRIPT, {
    onCommand: handleCommand,
    onComms: (c) => deps.ui.onComms(c),
    onHud: (h) => deps.ui.onHud(h),
    onFx: (f: FxCommand) => deps.sky.applyFx(f),
    onShot: (shot, duration, t) => deps.director.playShot(shot, duration, t),
    onTransition: (kind) => deps.director.cut(kind),
    onState: (_p, n) => deps.ui.onState(n),
  });
  engine.stateDurations = STATE_DURATIONS;

  const update = (dt: number): void => {
    engine.update(dt);
    // Flight clock: seconds since liftoff (negative before)
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
```

Note: `flight.liftoffTime` starts at `-1` — adjust `FlightModel` (Task 11) so `t0 = -1` initially and `liftoffTime` returns `-1` until `liftoff()` sets `t0 = 0`; then `tFlight = engine.t - 0`. Keep the contract: `liftoffTime` is the engine-time at which liftoff occurred; implement as `private t0: number | null = null; get liftoffTime(): number { return this.t0 ?? -1; }` and `tFlight = this.t0 === null ? -1 : engine.t - this.t0`.

- [ ] **Step 2: Wire into `main.ts` (replace stub update loop)**

In `boot()` after director/ShotLibrary construction:

```ts
  const { createMissionRuntime } = await import("./mission/runtime");
  const uiNoop = { onComms: () => {}, onHud: () => {}, onState: () => {} };
  const mission = createMissionRuntime({ scene, director, sky, flight, exhaust, smoke, ml, ui: uiNoop });
```

and in the render loop call `mission.update(dt)` before `scene.render()`. Remove the old placeholder `sky.update(dt); earth.update(dt);` duplication — keep both but ensure `mission.update` drives flight/sky altitude.

- [ ] **Step 3: Visual verification (major gate — first launch run)**

Browser: wait through the first ~2 minutes (or temporarily add `mission.skipTo("COUNTDOWN")` behind `?skip=countdown` URL param for QA):
- Establishing shots cut between rigs with dips; VAB/pad/rocket framed correctly.
- Countdown captions absent (UI comes in Task 14) but no errors.
- Ignition: plume particles + flickering point light light the pad/ML; arms retract; smoke billows from trench mouth.
- Liftoff: stack rises with pitch-over; sky darkens with altitude; stars emerge.
- SRB separation: boosters tumble away; core continues.
- Orbit: Earth fills view; exposure adapts.
Fix all visual defects (plume direction, light radius, smoke origin, rig framing) before commit.

- [ ] **Step 4: Commit**

```bash
git add space-sim/mission/runtime.ts space-sim/main.ts space-sim/vehicles/flight.ts && git commit -m "feat(space-sim): mission runtime wiring — full launch playable end-to-end"
```

---

### Task 13: ISS exterior — modular kit-bash builder

**Files:**
- Create: `space-sim/iss/exterior.ts`
- Modify: `space-sim/main.ts`

**Interfaces:**
- Consumes: `Assets` (Task 4).
- Produces: `interface IssExterior { root: TransformNode; dockingPort: TransformNode; solarWings: TransformNode[]; setSunAngle(a: number): void }`, `createIssExterior(scene: Scene, assets: Assets): IssExterior`.
- Layout (real, 1:1): ITS main truss 109 m along X centered at orbit station origin `(0, 6371000+400000, 0)`. Pairs of solar wings (each ~35×12 m) at truss ends (S4/N4) + mids (P4/N4 edge); 4 radiator sets perpendicular below truss; pressurized modules along Z axis through center: Zarya (Ø4.1×12.6) +Z end, Zvezda (Ø4.15×13.1) +Z end beyond, Unity node (Ø4.6×5.5) center, Destiny lab (Ø4.3×8.5) −Z, Harmony (Ø4.6×7.2) +Z between Zarya/Unity side-port, Columbus (Ø4.5×6.9) on Harmony starboard, Kibo JEM (Ø4.4×9.2 + exposed facility) on Harmony port, Tranquility+Cupola (Ø4.6×6.7) on Unity nadir, Quest airlock (Ø4×5.5) on Unity starboard, PMA-2/IDA at Destiny forward (−Z) = **dockingPort** node (Orion docks here along −Z axis).

- [ ] **Step 1: Implement `iss/exterior.ts`**

```ts
// space-sim/iss/exterior.ts
import {
  Mesh, MeshBuilder, StandardMaterial, TransformNode, Vector3, type Scene,
} from "@babylonjs/core";
import type { Assets } from "../core/assets";

export interface IssExterior {
  root: TransformNode;
  dockingPort: TransformNode;
  solarWings: TransformNode[];
  setSunAngle(a: number): void;
}

/** Kit-bashed module: pressurized cylinder + end cones + detail band + handrails. */
function module(scene: Scene, assets: Assets, name: string, len: number, dia: number): TransformNode {
  const node = new TransformNode(name, scene);
  const body = MeshBuilder.CreateCylinder(`${name}Body`, { diameter: dia, height: len, tessellation: 20 }, scene);
  body.rotation.x = Math.PI / 2; // align along Z
  body.material = assets.interiorWall(); // exterior uses white panel look
  body.parent = node;
  for (const z of [len / 2, -len / 2]) {
    const cone = MeshBuilder.CreateCylinder(`${name}Cone${z}`, { diameterTop: z > 0 ? dia * 0.8 : dia, diameterBottom: z > 0 ? dia : dia * 0.8, height: 0.6, tessellation: 20 }, scene);
    cone.rotation.x = Math.PI / 2;
    cone.position.z = z + (z > 0 ? 0.3 : -0.3);
    cone.material = assets.steelStructure();
    cone.parent = node;
  }
  // Equipment detail band (kit-bash: boxes/cylinders on hull)
  for (let i = 0; i < 5; i++) {
    const box = MeshBuilder.CreateBox(`${name}Box${i}`, { width: 0.8 + Math.random() * 0.6, height: 0.4, depth: 0.25 }, scene);
    const a = Math.random() * Math.PI * 2;
    box.position.set(Math.cos(a) * (dia / 2 + 0.12), Math.sin(a) * (dia / 2 + 0.12), (Math.random() - 0.5) * len * 0.8);
    box.lookAt(new Vector3(0, 0, box.position.z).add(node.getAbsolutePosition().subtract(node.getAbsolutePosition())));
    box.material = assets.foilGold();
    box.parent = node;
  }
  return node;
}

function place(node: TransformNode, pos: Vector3, rotX = 0): void {
  node.position = pos;
  node.rotation.x = rotX;
}

export function createIssExterior(scene: Scene, assets: Assets): IssExterior {
  const root = new TransformNode("issRoot", scene);
  const ORBIT_Y = 6371000 + 400000;
  root.position.set(0, ORBIT_Y, 0);

  // --- ITS truss (109 m along X) ---
  const truss = MeshBuilder.CreateBox("itsTruss", { width: 109, height: 1.6, depth: 2.4 }, scene);
  truss.material = assets.steelStructure();
  truss.parent = root;
  // Truss lattice detail
  for (let x = -52; x <= 52; x += 6) {
    const diag = MeshBuilder.CreateBox(`trussDiag${x}`, { width: 0.2, height: 3.2, depth: 0.2 }, scene);
    diag.position.set(x, -0.8, 0);
    diag.rotation.z = 0.6;
    diag.material = assets.steelStructure();
    diag.parent = root;
  }

  // --- Solar arrays: 8 wings (2 per SAW group) ---
  const solarWings: TransformNode[] = [];
  const makeWingGroup = (x: number): void => {
    for (const [dy, flip] of [[7, 1], [-7, -1]] as const) {
      const mast = MeshBuilder.CreateCylinder("sawMast", { diameter: 0.25, height: Math.abs(dy) }, scene);
      mast.position.set(x, dy / 2, 0);
      mast.material = assets.steelStructure();
      mast.parent = root;
      const wing = new TransformNode("sawWing", scene);
      wing.position.set(x, dy + flip * 6, 0);
      wing.parent = root;
      const blanket = MeshBuilder.CreatePlane("sawBlanket", { width: 34, height: 12 }, scene);
      blanket.rotation.x = Math.PI / 2;
      blanket.material = assets.solarCell();
      blanket.parent = wing;
      const blanket2 = blanket.clone("sawBlanket2");
      blanket2.position.y = flip * 0.05;
      blanket2.parent = wing;
      solarWings.push(wing);
    }
  };
  for (const x of [-45, -22, 22, 45]) makeWingGroup(x);

  // --- Radiators (3 sets, below truss, perpendicular) ---
  for (const x of [-32, 0, 32]) {
    const rad = MeshBuilder.CreatePlane("radiator", { width: 12, height: 3.4 }, scene);
    rad.position.set(x, -4.5, 0);
    rad.rotation.y = Math.PI / 2;
    rad.rotation.z = Math.PI / 2;
    rad.material = assets.radiator();
    rad.parent = root;
  }

  // --- Pressurized modules along Z (docking axis −Z toward Destiny forward) ---
  const unity = module(scene, assets, "unity", 5.5, 4.6);
  place(unity, new Vector3(0, -2.5, 0));
  const destiny = module(scene, assets, "destiny", 8.5, 4.3);
  place(destiny, new Vector3(0, -2.5, -7));
  const harmony = module(scene, assets, "harmony", 7.2, 4.6);
  place(harmony, new Vector3(0, -2.5, 6.4));
  const zarya = module(scene, assets, "zarya", 12.6, 4.1);
  place(zarya, new Vector3(0, -2.5, 16.4));
  const zvezda = module(scene, assets, "zvezda", 13.1, 4.15);
  place(zvezda, new Vector3(0, -2.5, 29));
  const columbus = module(scene, assets, "columbus", 6.9, 4.5);
  place(columbus, new Vector3(5.8, -2.5, 6.4));
  columbus.rotation.y = Math.PI / 2;
  const kibo = module(scene, assets, "kibo", 9.2, 4.4);
  place(kibo, new Vector3(-6, -2.5, 6.4));
  kibo.rotation.y = Math.PI / 2;
  // Kibo exposed facility + boom
  const jef = MeshBuilder.CreateBox("kiboJEF", { width: 5, height: 2, depth: 4.2 }, scene);
  jef.position.set(-11.5, -2.5, 6.4);
  jef.material = assets.steelStructure();
  jef.parent = root;
  // Tranquility + Cupola (nadir from Unity)
  const tranquility = module(scene, assets, "tranquility", 6.7, 4.6);
  place(tranquility, new Vector3(0, -2.5 - 5.6, -1.5), Math.PI / 2);
  const cupola = MeshBuilder.CreatePolyhedron("cupola", { type: 3, size: 1.6 }, scene);
  cupola.position.set(0, -2.5 - 5.6 - 4.2, -1.5);
  cupola.material = assets.steelStructure();
  cupola.parent = root;
  // Quest airlock (starboard of Unity)
  const quest = module(scene, assets, "quest", 5.5, 4);
  place(quest, new Vector3(5.4, -2.5, -1.5));
  quest.rotation.y = Math.PI / 2;
  // PMA-2/IDA at Destiny forward = docking port
  const dockingPort = new TransformNode("dockingPort", scene);
  dockingPort.parent = root;
  dockingPort.position.set(0, -2.5, -11.4);
  const pma = MeshBuilder.CreateCylinder("pma2", { diameterTop: 1.6, diameterBottom: 2.4, height: 1.6, tessellation: 16 }, scene);
  pma.rotation.x = Math.PI / 2;
  pma.position.set(0, -2.5, -11.4);
  pma.material = assets.steelStructure();
  pma.parent = root;
  const ida = MeshBuilder.CreateCylinder("idaRing", { diameter: 1.6, height: 0.4, tessellation: 16 }, scene);
  ida.rotation.x = Math.PI / 2;
  ida.position.set(0, -2.5, -12.3);
  ida.material = assets.paintedWhite();
  ida.parent = root;

  // External handrails along Destiny/Unity
  for (let z = -10; z <= 9; z += 1.5) {
    const rail = MeshBuilder.CreateTorus("extRail", { diameter: 0.5, thickness: 0.04, tessellation: 12 }, scene);
    rail.position.set(2.2, -1.2, z);
    rail.rotation.x = Math.PI / 2;
    rail.material = assets.handrail();
    rail.parent = root;
  }

  const setSunAngle = (a: number): void => {
    for (const wing of solarWings) wing.rotation.x = a;
  };

  return { root, dockingPort, solarWings, setSunAngle };
}
```

The `module()` helper's `box.lookAt(...)` line must be `box.lookAt(box.getAbsolutePosition().scale(2).subtract(root.getAbsolutePosition()));` — or simply delete that line (boxes are small hull details; orientation is cosmetic). Also fix the exterior.ts imports: it needs `MeshBuilder, StandardMaterial, TransformNode, Vector3, type Scene` only — no bare `Mesh`.

- [ ] **Step 2: Wire into `main.ts` + target provider**

```ts
  const { createIssExterior } = await import("./iss/exterior");
  const iss = createIssExterior(scene, assets);
  targetProviders.iss = () => iss.root;
```

- [ ] **Step 3: Visual verification + commit**

Temporarily aim `bootCam` at ISS (add `?view=iss` debug param: position camera at ISS + (350, 60, 350) looking at station). Verify: 109 m truss with 8 gold-framed blue wings, radiators, white modules clustered on the Z axis, gold foil detail boxes, Cupola nadir polyhedron. Fix scale/positions before commit.

```bash
git add space-sim/iss/exterior.ts space-sim/main.ts && git commit -m "feat(space-sim): ISS exterior kit-bash — truss, 8 solar wings, 10 modules, Cupola"
```

---

### Task 14: Docking telemetry (TDD) + approach/docking animation

**Files:**
- Create: `space-sim/iss/docking.ts`
- Test: `space-sim/__tests__/docking.test.ts`
- Modify: `space-sim/main.ts` (Orion repositioned at ISS; runtime handles dock commands)

**Interfaces:**
- Consumes: `SlsStack.orionNode` (Task 10), `IssExterior.dockingPort` (Task 13).
- Produces (pure, testable): `interface DockingTelemetry { range: number; closure: number; lateralOffset: number; alignErrorDeg: number; phase: "range" | "approach" | "contact" | "captured" | "hardDocked" }`, `dockingTelemetry(relPos: { x: number; y: number; z: number }, relVel: { x: number; y: number; z: number }): DockingTelemetry` (range = |relPos|, closure = −(relPos·relVel)/|relPos|, lateral = sqrt(x²+y²) relative to approach axis Z, align from lateral), and animation: `class DockingSequence { constructor(scene: Scene, orion: TransformNode, port: TransformNode); contact(): void; capture(): void; hardDock(): void; update(t: number): void; telemetry(): DockingTelemetry }` — drives Orion along −Z from 200 m to contact over the scripted states.

- [ ] **Step 1: Write the failing telemetry tests**

```ts
// space-sim/__tests__/docking.test.ts
import { describe, expect, it } from "vitest";
import { dockingTelemetry } from "../iss/docking";

describe("dockingTelemetry", () => {
  it("computes range as distance along approach", () => {
    const t = dockingTelemetry({ x: 0, y: 0, z: 200 }, { x: 0, y: 0, z: -0.05 });
    expect(t.range).toBeCloseTo(200);
  });
  it("closure is positive when closing", () => {
    const t = dockingTelemetry({ x: 0, y: 0, z: 200 }, { x: 0, y: 0, z: -0.05 });
    expect(t.closure).toBeCloseTo(0.05);
  });
  it("closure negative when receding", () => {
    const t = dockingTelemetry({ x: 0, y: 0, z: 200 }, { x: 0, y: 0, z: 0.1 });
    expect(t.closure).toBeCloseTo(-0.1);
  });
  it("lateral offset from xy", () => {
    const t = dockingTelemetry({ x: 0.4, y: 0.3, z: 50 }, { x: 0, y: 0, z: 0 });
    expect(t.lateralOffset).toBeCloseTo(0.5);
  });
  it("align error grows with lateral offset", () => {
    const onAxis = dockingTelemetry({ x: 0, y: 0, z: 50 }, { x: 0, y: 0, z: 0 });
    const off = dockingTelemetry({ x: 2, y: 0, z: 50 }, { x: 0, y: 0, z: 0 });
    expect(off.alignErrorDeg).toBeGreaterThan(onAxis.alignErrorDeg);
  });
  it("phase maps by range", () => {
    expect(dockingTelemetry({ x: 0, y: 0, z: 120 }, { x: 0, y: 0, z: 0 }).phase).toBe("range");
    expect(dockingTelemetry({ x: 0, y: 0, z: 20 }, { x: 0, y: 0, z: 0 }).phase).toBe("approach");
    expect(dockingTelemetry({ x: 0, y: 0, z: 0.2 }, { x: 0, y: 0, z: 0 }).phase).toBe("contact");
    expect(dockingTelemetry({ x: 0, y: 0, z: -0.3 }, { x: 0, y: 0, z: 0 }).phase).toBe("captured");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- space-sim/__tests__/docking.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `iss/docking.ts`**

```ts
// space-sim/iss/docking.ts
import type { TransformNode } from "@babylonjs/core";

export type DockingPhase = "range" | "approach" | "contact" | "captured" | "hardDocked";

export interface DockingTelemetry {
  range: number;
  closure: number;
  lateralOffset: number;
  alignErrorDeg: number;
  phase: DockingPhase;
}

export function dockingTelemetry(
  relPos: { x: number; y: number; z: number },
  relVel: { x: number; y: number; z: number },
): DockingTelemetry {
  const range = Math.hypot(relPos.x, relPos.y, relPos.z);
  const closure = range > 1e-6 ? -(relPos.x * relVel.x + relPos.y * relVel.y + relPos.z * relVel.z) / range : 0;
  const lateralOffset = Math.hypot(relPos.x, relPos.y);
  const alignErrorDeg = range > 1e-6 ? Math.atan2(lateralOffset, Math.abs(relPos.z)) * (180 / Math.PI) : 0;
  const phase: DockingPhase =
    range < -0.5 ? "hardDocked"
    : range < 0.45 ? "captured"
    : range < 0.6 ? "contact"
    : range < 30 ? "approach"
    : "range";
  return { range, closure, lateralOffset, alignErrorDeg, phase };
}

/** Drives Orion from 200 m +Z to contact over `approachSeconds`, then capture/hard-dock offsets. */
export class DockingSequence {
  private contactAt = false;
  private captured = false;
  private hardDocked = false;
  private approachSeconds: number;
  private startOffset = 200;

  constructor(
    private orion: TransformNode,
    private port: TransformNode,
    approachSeconds = 180,
  ) {
    this.approachSeconds = approachSeconds;
  }

  /** Progress input: 0..1 across the scripted approach window (ISS_APPROACH+DOCKING states). */
  setProgress(k: number): void {
    const eased = 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 1.8); // decelerating approach
    const z = this.startOffset * (1 - eased);
    this.orion.position.set(0, 0, z);
    this.orion.lookAt(this.port.getAbsolutePosition());
  }

  contact(): void { this.contactAt = true; this.orion.position.set(0, 0, 0.5); }
  capture(): void { this.captured = true; this.orion.position.set(0, 0, -0.2); }
  hardDock(): void { this.hardDocked = true; this.orion.position.set(0, 0, -0.4); }

  telemetry(): DockingTelemetry {
    const rel = this.orion.position.subtract(this.port.getAbsolutePosition());
    return dockingTelemetry(
      { x: rel.x, y: rel.y, z: rel.z },
      { x: 0, y: 0, z: this.contactAt || this.captured || this.hardDocked ? 0 : -0.05 },
    );
  }

  get state(): { contact: boolean; captured: boolean; hardDocked: boolean } {
    return { contact: this.contactAt, captured: this.captured, hardDocked: this.hardDocked };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- space-sim/__tests__/docking.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Wire docking into runtime + Orion relocation**

In `main.ts` after ISS creation: at `orbitInsertion` command time the Orion node is already detached; on `ISS_REVEAL` state entry, reposition `sls.orionNode` near ISS:

```ts
  const { DockingSequence } = await import("./iss/docking");
  const docking = new DockingSequence(sls.orionNode, iss.dockingPort, 180);
```

In `mission/runtime.ts` handle the ISS_REVEAL state transition by parenting `orionNode` to `issRoot` and offsetting `(0, 2.5, 200)` (call `docking.setProgress(0)`), and during `ISS_APPROACH`/`DOCKING_SEQUENCE` map state-local progress: `docking.setProgress(k)` where k = elapsed/approachSeconds; handle `dockContact/dockCapture/dockHard` commands → `docking.contact()/capture()/hardDock()`. Wire `docking.telemetry()` into the HUD telemetry sink (rendered in Task 15's HUD; interim `console.log` at 2 Hz acceptable but remove before commit — store `lastTelemetry` on the runtime for the HUD to poll).

- [ ] **Step 6: Visual verification + commit**

Browser with `?skip=orbit` debug param: Orion appears 200 m ahead of ISS, drifts in decelerating, aligns to IDA ring, contact flash (light intensity blip acceptable), hooks message; telemetry numbers change during approach. Commit.

```bash
git add space-sim/iss/docking.ts space-sim/__tests__/docking.test.ts space-sim/main.ts space-sim/mission/runtime.ts && git commit -m "feat(space-sim): docking telemetry + scripted approach/capture sequence"
```

---

### Task 15: ISS interior + Cupola walkthrough space

**Files:**
- Create: `space-sim/iss/interior.ts`
- Modify: `space-sim/main.ts`

**Interfaces:**
- Consumes: `Assets` (Task 4), `IssExterior` (Task 13).
- Produces: `interface IssInterior { root: TransformNode; spawn: TransformNode; colliders: Array<{ min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }>; cupolaLook: Vector3 }`, `createIssInterior(scene: Scene, assets: Assets, exterior: IssExterior): IssInterior`.
- Design: interiors of Destiny/Harmony/Unity/Ttranquility placed INSIDE the exterior modules (aligned on the same Z axis at the module center height). Tunnel route: Harmony → Unity → Destiny lab → Tranquility → Cupola nadir viewing platform. Handrails every 1.5 m on both walls; equipment racks with laptops/bags/labels; practical lights; Cupola with 7 window openings looking at Earth.
- `colliders`: axis-aligned box list (module walls as segmented boxes, rack fronts) consumed by the player controller (Task 16).
- `spawn`: node in Harmony vestibule where the player appears.

- [ ] **Step 1: Implement `iss/interior.ts`**

```ts
// space-sim/iss/interior.ts
import {
  Color3, MeshBuilder, PointLight, StandardMaterial, TransformNode, Vector3, type Scene,
} from "@babylonjs/core";
import type { Assets } from "../core/assets";

export interface BoxCollider { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }

export interface IssInterior {
  root: TransformNode;
  spawn: TransformNode;
  colliders: BoxCollider[];
  cupolaLook: Vector3;
}

const R = 2.0; // usable interior radius (module Ø4.6)
const INTERIOR_Y = -2.5; // module axis height on ISS root

export function createIssInterior(scene: Scene, assets: Assets, exterior: IssExterior): IssInterior {
  const root = new TransformNode("issInterior", scene);
  root.parent = exterior.root;
  const colliders: BoxCollider[] = [];

  const wall = assets.interiorWall();
  const rail = assets.handrail();
  const bag = assets.fabricBag();
  const lap = assets.laptop();

  /** Build a tube section: 12 wall panels around radius R over length L centered at z. */
  const tube = (name: string, z: number, len: number): void => {
    const sections = 12;
    for (let i = 0; i < sections; i++) {
      const a0 = (i / sections) * Math.PI * 2;
      const a1 = ((i + 1) / sections) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const panel = MeshBuilder.CreatePlane(`${name}_p${i}`, { width: (2 * Math.PI * R) / sections + 0.06, height: len }, scene);
      panel.position.set(Math.cos(am) * (R + 0.01), INTERIOR_Y + Math.sin(am) * (R + 0.01), z);
      panel.rotation.y = -am + Math.PI / 2;
      panel.rotation.z = Math.PI / 2;
      panel.rotation.x = 0;
      panel.material = wall;
      panel.sideOrientation = MeshBuilder.DOUBLESIDE;
      panel.parent = root;
      // collider: coarse AABB from arc extremes
      colliders.push({
        min: { x: Math.min(Math.cos(a0), Math.cos(a1)) * (R + 0.2) - 0.3, y: INTERIOR_Y - R, z: z - len / 2 },
        max: { x: Math.max(Math.cos(a0), Math.cos(a1)) * (R + 0.2) + 0.3, y: INTERIOR_Y + R, z: z + len / 2 },
      });
    }
    // End bulkhead rings (visual)
    for (const zz of [z - len / 2, z + len / 2]) {
      const ring = MeshBuilder.CreateTorus(`${name}_ring${zz}`, { diameter: R * 2, thickness: 0.12, tessellation: 24 }, scene);
      ring.position.set(0, INTERIOR_Y, zz);
      ring.material = rail;
      ring.parent = root;
    }
  };

  /** Handrails: pairs at ±80° every 1.5 m. */
  const handrails = (z0: number, z1: number): void => {
    for (let z = z0; z < z1; z += 1.5) {
      for (const side of [-1, 1]) {
        const bar = MeshBuilder.CreateCylinder("handrail", { diameter: 0.045, height: 0.7, tessellation: 8 }, scene);
        bar.rotation.x = Math.PI / 2;
        bar.position.set(side * R * 0.78, INTERIOR_Y + R * 0.45, z);
        bar.material = rail;
        bar.parent = root;
      }
    }
  };

  /** Equipment rack wall segment with laptops + labeled bags. */
  const rackWall = (name: string, z: number, side: number, count: number): void => {
    for (let i = 0; i < count; i++) {
      const zz = z + i * 1.1;
      const rack = MeshBuilder.CreateBox(`${name}_rack${i}`, { width: 0.9, height: 1.9, depth: 0.6 }, scene);
      rack.position.set(side * (R - 0.35), INTERIOR_Y + 0.2, zz);
      rack.material = wall;
      rack.parent = root;
      colliders.push({
        min: { x: side > 0 ? R - 0.7 : -R, y: INTERIOR_Y - 0.8, z: zz - 0.5 },
        max: { x: side > 0 ? R : -R + 0.7, y: INTERIOR_Y + 1.2, z: zz + 0.5 },
      });
      if (i % 2 === 0) {
        const laptop = MeshBuilder.CreateBox(`${name}_lap${i}`, { width: 0.55, height: 0.02, depth: 0.38 }, scene);
        laptop.position.set(side * (R - 0.75), INTERIOR_Y + 0.75, zz + 0.1);
        laptop.rotation.x = -0.35;
        laptop.material = lap;
        laptop.parent = root;
      } else {
        const stow = MeshBuilder.CreateBox(`${name}_bag${i}`, { width: 0.5, height: 0.5, depth: 0.45 }, scene);
        stow.position.set(side * (R - 0.7), INTERIOR_Y - 0.35, zz);
        stow.material = bag;
        stow.parent = root;
      }
      const label = MeshBuilder.CreatePlane(`${name}_lbl${i}`, { width: 0.5, height: 0.14 }, scene);
      label.position.set(side * (R - 0.68), INTERIOR_Y + 1.1, zz);
      label.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      const lm = new StandardMaterial(`${name}_lblmat${i}`, scene);
      lm.diffuseTexture = assets.labelCanvas(i % 2 === 0 ? "EXP RACK" : "STOWAGE", 256, 64);
      lm.emissiveColor = new Color3(0.25, 0.25, 0.25);
      label.material = lm;
      label.parent = root;
    }
  };

  // Cables strung along walls (catenary-ish cylinders)
  const cable = (z0: number, z1: number, height: number, side: number): void => {
    const len = Math.hypot(z1 - z0, 0.2);
    const c = MeshBuilder.CreateCylinder("cable", { diameter: 0.03, height: len, tessellation: 6 }, scene);
    c.rotation.x = Math.PI / 2;
    c.rotation.y = Math.atan2(0.2, z1 - z0);
    c.position.set(side * (R - 0.1), INTERIOR_Y + height, (z0 + z1) / 2);
    c.material = assets.blackTile();
    c.parent = root;
  };

  // Practical lights
  const light = (z: number, color: Color3): void => {
    const pl = new PointLight(`intLight${z}`, new Vector3(0, INTERIOR_Y + 1.2, z), scene);
    pl.diffuse = color;
    pl.intensity = 0.55;
    pl.range = 7;
  };

  // --- Build route (world Z positions matching exterior module centers) ---
  // Harmony (z≈6.4) → Unity (0) → Destiny (−7) → Tranquility (−1.5 offset x0? uses nadir: special)
  const SPAWN_Z = 8.5;
  tube("harmony", 6.4, 6.2);
  tube("unity", 0, 4.5);
  tube("destiny", -7, 7.5);
  handrails(4.0, 10.0);
  handrails(-2.4, 2.4);
  handrails(-10.5, -3.5);
  rackWall("destR", -10.2, 1, 6);
  rackWall("destL", -10.2, -1, 6);
  rackWall("harmR", 4.2, 1, 5);
  cable(4, 10, 1.6, 1);
  cable(-10, 4, 1.4, -1);
  light(6.4, new Color3(0.95, 0.97, 1.0));
  light(0, new Color3(0.95, 0.97, 1.0));
  light(-7, new Color3(1.0, 0.98, 0.92));
  // Bulkhead hatches between sections (open rings with door panels aside)
  for (const z of [-2.6, 2.8]) {
    const hatch = MeshBuilder.CreateTorus(`hatch${z}`, { diameter: R * 1.7, thickness: 0.22, tessellation: 24 }, scene);
    hatch.position.set(0, INTERIOR_Y, z);
    hatch.material = assets.steelStructure();
    hatch.parent = root;
  }

  // --- Cupola: nadir platform below Tranquility (world y ≈ INTERIOR_Y - 2R - 2) ---
  const cupolaY = INTERIOR_Y - 2 * R - 1.4;
  const cupolaZ = -1.5;
  const shell = MeshBuilder.CreatePolyhedron("cupolaShell", { type: 3, size: 1.5 }, scene);
  shell.position.set(0, cupolaY, cupolaZ);
  const shellMat = new StandardMaterial("cupolaShellMat", scene);
  shellMat.alpha = 0.15;
  shellMat.diffuseColor = new Color3(0.6, 0.75, 0.9);
  shellMat.emissiveColor = new Color3(0.05, 0.08, 0.12);
  shell.material = shellMat;
  shell.parent = root;
  // Window frames: 7 planes ringed around the lower hemisphere
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const frame = MeshBuilder.CreateTorus(`cupFrame${i}`, { diameter: 0.85, thickness: 0.09, tessellation: 16 }, scene);
    frame.position.set(Math.cos(a) * 1.15, cupolaY - 0.5, cupolaZ + Math.sin(a) * 1.15);
    frame.rotation.y = -a;
    frame.material = rail;
    frame.parent = root;
  }
  const nadir = MeshBuilder.CreateTorus("cupNadir", { diameter: 1.2, thickness: 0.1, tessellation: 20 }, scene);
  nadir.position.set(0, cupolaY - 1.05, cupolaZ);
  nadir.rotation.x = Math.PI / 2;
  nadir.material = rail;
  nadir.parent = root;
  // Padded floor ring
  const floor = MeshBuilder.CreateCylinder("cupFloor", { diameter: 2.4, height: 0.1, tessellation: 20 }, scene);
  floor.position.set(0, cupolaY - 1.2, cupolaZ);
  floor.material = assets.interiorWall();
  floor.parent = root;

  // Spawn point (Harmony vestibule)
  const spawn = new TransformNode("playerSpawn", scene);
  spawn.parent = root;
  spawn.position.set(0, INTERIOR_Y, SPAWN_Z);

  // Safety colliders for Cupola shell
  colliders.push({
    min: { x: -1.7, y: cupolaY - 1.4, z: cupolaZ - 1.7 },
    max: { x: 1.7, y: cupolaY + 1.4, z: cupolaZ + 1.7 },
  });

  return { root, spawn, colliders, cupolaLook: new Vector3(0, cupolaY - 2, cupolaZ) };
}
```

Note: tranq tube omitted (Cupola approach is via open vestibule) — acceptable route simplification, documented. Remove the unused `exterior` param if lint flags (keep param for parent linking — it IS used: `root.parent = exterior.root`).

- [ ] **Step 2: Wire into `main.ts` + target provider**

```ts
  const { createIssInterior } = await import("./iss/interior");
  const interior = createIssInterior(scene, assets, iss);
  targetProviders.issInterior = () => interior.spawn;
```

- [ ] **Step 3: Visual verification + commit**

Browser `?view=interior` debug param: camera inside Harmony — ribbed white walls, handrails both sides, racks with glowing laptops and labeled stowage bags, cables strung, rings at hatches, Cupola visible below with window frames; Earth visible through the translucent shell. Fix darkness (raise light intensity/range) and panel gaps before commit.

```bash
git add space-sim/iss/interior.ts space-sim/main.ts && git commit -m "feat(space-sim): ISS interior — Harmony/Unity/Destiny route, racks, Cupola nadir"
```

---

### Task 16: Zero-G player controller + input (TDD)

**Files:**
- Create: `space-sim/player/controller.ts`, `space-sim/core/input.ts`
- Test: `space-sim/__tests__/zeroG.test.ts`
- Modify: `space-sim/main.ts`

**Interfaces:**
- Produces:
  - `controller.ts` pure integrator: `interface ZeroGInput { thrust: { x: number; y: number; z: number }; yawDelta: number; pitchDelta: number; boost: boolean }`, `class ZeroGState { pos: { x,y,z }; vel: { x,y,z }; yaw: number; pitch: number; yawVel: number; pitchVel: number; step(dt: number, input: ZeroGInput, colliders?: BoxCollider[]): void; speed(): number }` — accel 2.5 m/s² (boost ×2), linear damping `vel *= exp(-2.2·dt)`, rotational smoothing toward target, capsule radius 0.35 axis-resolve vs colliders.
  - `input.ts`: `class InputManager { constructor(canvas: HTMLCanvasElement); thrustVector(): { x: number; y: number; z: number }; mouseDelta(): { dx: number; dy: number }; consumeHoldSpace(dt: number): boolean; boostHeld(): boolean; onEscape(cb: () => void): void; lockPointer(): void; unlockPointer(): void }` (W/A/S/D + Space/Ctrl + Shift + E + Esc; pointer lock; hold-space timer ≥ 0.7 s emits skip once per hold).
- Controller applied only after `enablePlayer` command: camera = `UniversalCamera("playerCam")` at `interior.spawn`, mouse-look through `ZeroGState.yaw/pitch` each frame; WASD thrust in camera-local XZ, Space/Ctrl world-Y thrust.

- [ ] **Step 1: Write the failing zero-G tests**

```ts
// space-sim/__tests__/zeroG.test.ts
import { describe, expect, it } from "vitest";
import { ZeroGState, type ZeroGInput } from "../player/controller";

const idle: ZeroGInput = { thrust: { x: 0, y: 0, z: 0 }, yawDelta: 0, pitchDelta: 0, boost: false };

describe("ZeroGState", () => {
  it("accelerates while thrusting and coasts when idle", () => {
    const s = new ZeroGState();
    s.step(0.5, { ...idle, thrust: { x: 0, y: 0, z: 1 } });
    expect(s.vel.z).toBeGreaterThan(0.5);
    const vCoast = s.vel.z;
    s.step(0.0001, idle);
    expect(s.vel.z).toBeCloseTo(vCoast, 2);
  });
  it("damps velocity over time", () => {
    const s = new ZeroGState();
    s.step(0.5, { ...idle, thrust: { x: 0, y: 0, z: 1 } });
    const v0 = s.vel.z;
    s.step(1, idle);
    expect(s.vel.z).toBeLessThan(v0 * 0.5);
  });
  it("integrates position from velocity", () => {
    const s = new ZeroGState();
    s.step(1, { ...idle, thrust: { x: 1, y: 0, z: 0 } });
    expect(s.pos.x).toBeGreaterThan(0.3);
  });
  it("boost increases acceleration", () => {
    const a = new ZeroGState();
    a.step(0.5, { ...idle, thrust: { x: 0, y: 0, z: 1 }, boost: true });
    const b = new ZeroGState();
    b.step(0.5, { ...idle, thrust: { x: 0, y: 0, z: 1 }, boost: false });
    expect(a.vel.z).toBeGreaterThan(b.vel.z * 1.5);
  });
  it("resolves capsule against a wall collider (no tunneling)", () => {
    const s = new ZeroGState();
    s.pos = { x: 0, y: 0, z: 0 };
    const wall = { min: { x: 1.0, y: -2, z: -2 }, max: { x: 1.2, y: 2, z: 2 } };
    for (let i = 0; i < 60; i++) s.step(0.1, { ...idle, thrust: { x: 1, y: 0, z: 0 } }, [wall]);
    expect(s.pos.x).toBeLessThan(0.66); // radius 0.35 margin
  });
  it("smooths rotation toward mouse deltas", () => {
    const s = new ZeroGState();
    s.step(0.1, { ...idle, yawDelta: 1 });
    expect(s.yaw).toBeGreaterThan(0);
    expect(s.yaw).toBeLessThan(0.6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- space-sim/__tests__/zeroG.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `player/controller.ts`**

```ts
// space-sim/player/controller.ts
import type { BoxCollider } from "../iss/interior";

export interface ZeroGInput {
  thrust: { x: number; y: number; z: number };
  yawDelta: number; pitchDelta: number; boost: boolean;
}

const ACCEL = 2.5;
const DAMPING = 2.2;
const ROT_SPEED = 1.6;
const MAX_PITCH = Math.PI / 2 - 0.05;
const CAPSULE_R = 0.35;

export class ZeroGState {
  pos = { x: 0, y: 0, z: 0 };
  vel = { x: 0, y: 0, z: 0 };
  yaw = 0; pitch = 0;
  private yawVel = 0; private pitchVel = 0;

  speed(): number { return Math.hypot(this.vel.x, this.vel.y, this.vel.z); }

  step(dt: number, input: ZeroGInput, colliders: BoxCollider[] = []): void {
    // Thrust in world space (caller transforms camera-local to world)
    const a = ACCEL * (input.boost ? 2 : 1);
    this.vel.x += input.thrust.x * a * dt;
    this.vel.y += input.thrust.y * a * dt;
    this.vel.z += input.thrust.z * a * dt;
    // Linear damping (inertia decay)
    const damp = Math.exp(-DAMPING * dt);
    this.vel.x *= damp; this.vel.y *= damp; this.vel.z *= damp;
    // Integrate + collide (axis resolve, capsule radius)
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;
    for (const c of colliders) {
      if (
        this.pos.x > c.min.x - CAPSULE_R && this.pos.x < c.max.x + CAPSULE_R &&
        this.pos.y > c.min.y - CAPSULE_R && this.pos.y < c.max.y + CAPSULE_R &&
        this.pos.z > c.min.z - CAPSULE_R && this.pos.z < c.max.z + CAPSULE_R
      ) {
        // push out along smallest penetration axis, zero that velocity
        const pens = [
          { axis: "x", v: this.vel.x, pen: c.max.x + CAPSULE_R - this.pos.x, dir: 1 },
          { axis: "x", v: this.vel.x, pen: this.pos.x - (c.min.x - CAPSULE_R), dir: -1 },
          { axis: "y", v: this.vel.y, pen: c.max.y + CAPSULE_R - this.pos.y, dir: 1 },
          { axis: "y", v: this.vel.y, pen: this.pos.y - (c.min.y - CAPSULE_R), dir: -1 },
          { axis: "z", v: this.vel.z, pen: c.max.z + CAPSULE_R - this.pos.z, dir: 1 },
          { axis: "z", v: this.vel.z, pen: this.pos.z - (c.min.z - CAPSULE_R), dir: -1 },
        ].filter((p) => p.pen > 0).sort((p, q) => p.pen - q.pen);
        const fix = pens[0];
        if (fix) {
          if (fix.axis === "x") { this.pos.x += fix.pen * fix.dir; this.vel.x = 0; }
          else if (fix.axis === "y") { this.pos.y += fix.pen * fix.dir; this.vel.y = 0; }
          else { this.pos.z += fix.pen * fix.dir; this.vel.z = 0; }
        }
      }
    }
    // Rotational momentum toward target
    this.yawVel += (input.yawDelta * ROT_SPEED - this.yawVel) * Math.min(1, dt * 6);
    this.pitchVel += (input.pitchDelta * ROT_SPEED - this.pitchVel) * Math.min(1, dt * 6);
    this.yaw += this.yawVel * dt;
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch + this.pitchVel * dt));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- space-sim/__tests__/zeroG.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Implement `core/input.ts`**

```ts
// space-sim/core/input.ts
export class InputManager {
  private keys = new Set<string>();
  private dx = 0; private dy = 0;
  private holdSpace = 0;
  private escapeCbs: Array<() => void> = [];
  private interactCbs: Array<() => void> = [];
  locked = false;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape") { this.escapeCbs.forEach((cb) => cb()); return; }
      if (e.code === "KeyE") { this.interactCbs.forEach((cb) => cb()); }
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      if (e.code === "Space") this.holdSpace = 0;
    });
    window.addEventListener("mousemove", (e) => {
      if (this.locked) { this.dx += e.movementX; this.dy += e.movementY; }
    });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
  }

  thrustVector(): { x: number; y: number; z: number } {
    const k = this.keys;
    return {
      x: (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0),
      y: (k.has("Space") ? 1 : 0) - (k.has("ControlLeft") || k.has("ControlRight") ? 1 : 0),
      z: (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0),
    };
  }

  mouseDelta(): { dx: number; dy: number } {
    const d = { dx: this.dx, dy: this.dy };
    this.dx = 0; this.dy = 0;
    return d;
  }

  /** Hold-to-skip: returns true once per completed 0.7 s hold of SPACE. */
  consumeHoldSpace(dt: number): boolean {
    if (this.keys.has("Space")) {
      this.holdSpace += dt;
      if (this.holdSpace >= 0.7) { this.holdSpace = -1; return true; }
      return false;
    }
    this.holdSpace = 0;
    return false;
  }

  boostHeld(): boolean { return this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"); }

  onEscape(cb: () => void): void { this.escapeCbs.push(cb); }
  onInteract(cb: () => void): void { this.interactCbs.push(cb); }

  lockPointer(): void { void this.canvas.requestPointerLock(); }
  unlockPointer(): void { if (document.pointerLockElement) document.exitPointerLock(); }
}
```

- [ ] **Step 6: Wire player into `main.ts`**

In runtime `enablePlayer` handling: create `UniversalCamera("playerCam")`, attach `ZeroGState` at `interior.spawn.position`, set `scene.activeCamera = playerCam`, `input.lockPointer()`. Per frame while player enabled:

```ts
  const thrust = input.thrustVector();
  const fwd = new Vector3(Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), Math.cos(player.yaw) * Math.cos(player.pitch));
  const right = new Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const world = new Vector3(
    thrust.x * right.x + thrust.z * fwd.x,
    thrust.y + thrust.z * fwd.y,
    thrust.x * right.z + thrust.z * fwd.z,
  );
  const md = input.mouseDelta();
  player.step(dt, { thrust: { x: world.x, y: world.y, z: world.z }, yawDelta: -md.dx * 0.0022, pitchDelta: -md.dy * 0.0022, boost: input.boostHeld() }, interior.colliders);
  playerCam.position.set(player.pos.x, player.pos.y, player.pos.z);
  playerCam.rotation.set(player.pitch, player.yaw + Math.PI, 0);
```

ESC opens pause (Task 17 menu). Player remains inside interior colliders only.

- [ ] **Step 7: Visual verification + commit**

Browser: after `?skip=interior` (debug param that seeks to `PLAYER_CONTROL_ENABLED`), click to lock pointer; float with inertia; walls stop the capsule; Cupola reachable through route; Shift boost doubles speed; Space/Ctrl move vertically. Tune damping/accel if floaty-vs-sticky feels wrong (target: half speed loss in ~0.3 s).

```bash
git add space-sim/player space-sim/core/input.ts space-sim/__tests__/zeroG.test.ts space-sim/main.ts space-sim/mission/runtime.ts && git commit -m "feat(space-sim): zero-G player controller, input manager, pointer lock"
```

---

### Task 17: Interaction system

**Files:**
- Create: `space-sim/player/interact.ts`
- Modify: `space-sim/main.ts`

**Interfaces:**
- Consumes: `scene`, `playerCam`, `InputManager.onInteract`.
- Produces: `class InteractionSystem { constructor(scene: Scene, camera: UniversalCamera, root: HTMLElement); register(mesh: Mesh, label: string, onUse: () => void): void; update(): void; dispose(): void }` — center-screen raycast every frame (2.5 m range); shows `[E] {label}` DOM prompt; E triggers `onUse`.
- Interactions registered in `main.ts`: 3 laptops (toggle screen emissive + caption "Experiment status reviewed"), Cupola windows (short camera push toward window: 1.5 s ease, returns), hatch rings (caption "Hatch is sealed — station keeping"), emergency mask box (caption "Emergency mask: nominal"), light switches in Destiny (toggle the 3 interior PointLights between white/warm/off).

- [ ] **Step 1: Implement `player/interact.ts`**

```ts
// space-sim/player/interact.ts
import { Vector3, type Mesh, type Scene, type UniversalCamera } from "@babylonjs/core";

interface Interactable { mesh: Mesh; label: string; onUse: () => void }

export class InteractionSystem {
  private target: Interactable | null = null;
  private entries: Interactable[] = [];
  private prompt: HTMLDivElement;

  constructor(private scene: Scene, private camera: UniversalCamera, root: HTMLElement) {
    this.prompt = document.createElement("div");
    this.prompt.className = "interact-prompt";
    this.prompt.style.display = "none";
    root.appendChild(this.prompt);
  }

  register(mesh: Mesh, label: string, onUse: () => void): void {
    this.entries.push({ mesh, label, onUse });
  }

  update(): void {
    // Center-screen ray, 2.5 m reach
    const ray = this.scene.createPickingRay(
      this.scene.getEngine().getRenderWidth() / 2,
      this.scene.getEngine().getRenderHeight() / 2,
      null,
      this.camera,
    );
    ray.length = 2.5;
    const pick = this.scene.pickWithRay(ray, (m) => this.entries.some((e) => e.mesh === m || m.name.startsWith(e.mesh.name)));
    const found = pick?.pickedMesh
      ? this.entries.find((e) => pick.pickedMesh === e.mesh || pick.pickedMesh!.name.startsWith(e.mesh.name)) ?? null
      : null;
    this.target = found;
    if (found) {
      this.prompt.style.display = "block";
      this.prompt.textContent = `[E] ${found.label}`;
    } else {
      this.prompt.style.display = "none";
    }
  }

  use(): void { this.target?.onUse(); }

  dispose(): void { this.prompt.remove(); }
}
```


- [ ] **Step 2: Add prompt CSS**

```css
/* style.css */
.interact-prompt { position: absolute; left: 50%; top: 58%; transform: translateX(-50%); background: var(--hud-bg);
  border: 1px solid var(--hud-line); padding: 6px 14px; font-size: 12px; letter-spacing: 0.14em; z-index: 4; pointer-events: none; }
```

- [ ] **Step 3: Register interactables in `main.ts` + verify + commit**

Register per interfaces list; verify in browser: aim at laptop → prompt; E toggles glow; Cupola E does window push; switch toggles Destiny lights. Commit:

```bash
git add space-sim/player/interact.ts space-sim/style.css space-sim/main.ts && git commit -m "feat(space-sim): interaction system — laptops, lights, Cupola window push, hatches"
```

---

### Task 18: Audio system — synthesis bus + SpeechSynthesis comms

**Files:**
- Create: `space-sim/core/audio.ts`
- Modify: `space-sim/main.ts`, `space-sim/mission/runtime.ts`

**Interfaces:**
- Produces: `class AudioBus { constructor(); unlock(): Promise<void>; engine(on: boolean): void; engineLevel(v: number): void; rumble(intensity: number): void; vent(on: boolean): void; beep(kind: "soft" | "alert"): void; clunk(): void; speak(c: CommsLine): void; duck(level: number): void; setMuted(m: boolean): void }`.
- Design (Web Audio graph):
  - `ctx = new AudioContext()` on first user gesture (`unlock()` on BEGIN button).
  - Master → `duckGain` → destination. Buses: `sfxGain`, `ambGain`, `radioGain` → duckGain.
  - Engine: brown-noise buffer (loop) → lowpass 120 Hz → gain; sub-oscillator 38 Hz w/ slow LFO on gain; `engine(on/level)` ramps gain.
  - Rumble: same brown-noise source → bandpass 30–70 Hz → gain (`rumble(i)`).
  - Vent ambience: white noise → bandpass 900 Hz Q 0.7 → gain 0.05 (`vent`).
  - Beeps: oscillator envelopes (soft: 880 Hz sine 80 ms; alert: 620→880 Hz square 200 ms).
  - Clunk: filtered noise burst + 90 Hz sine thump 120 ms.
  - Radio: `speak(c)` — squelch burst (white noise 60 ms through bandpass 1800 Hz), then `speechSynthesis.speak(utterance)` with per-speaker profile (CAPCOM rate 1.05 pitch 0.9; COMMANDER 1.0/0.8; PILOT 1.08/1.05; PAO 0.95/1.0), and a low-level heterodyne bed (noise → bandpass 1400 Hz gain 0.02) while utterance is active (`onend`/`onerror` cleanup). Captions always render (Task 19) — audio is additive.
- Runtime wiring: `onCommand ignite` → `engine(true)` + `rumble(0.8)`; `liftoff` → `rumble(1)`; during ascent `engineLevel` follows throttle; `orbitInsertion` → `engine(false)`, `vent(true)` (interior) after `enterInterior`; `onComms` → `speak(c)` + `beep("soft")` before each; `dockContact/dockCapture/dockHard` → `clunk()`; state → `duck(0.4)` during PAO lines.

- [ ] **Step 1: Implement `core/audio.ts`**

```ts
// space-sim/core/audio.ts
import type { CommsLine } from "../mission/engine";

function noiseBuffer(ctx: AudioContext, seconds: number, brown: boolean): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    else d[i] = w;
  }
  return buf;
}

const SPEAKER_PROFILES: Record<string, { rate: number; pitch: number }> = {
  CAPCOM: { rate: 1.05, pitch: 0.9 },
  COMMANDER: { rate: 1.0, pitch: 0.8 },
  PILOT: { rate: 1.08, pitch: 1.05 },
  PAO: { rate: 0.95, pitch: 1.0 },
};

export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private amb: GainNode | null = null;
  private radio: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineOscGain: GainNode | null = null;
  private rumbleGain: GainNode | null = null;
  private ventGain: GainNode | null = null;
  private muted = false;

  async unlock(): Promise<void> {
    if (this.ctx) { await this.ctx.resume(); return; }
    this.ctx = new AudioContext();
    const ctx = this.ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
    const duck = ctx.createGain(); duck.gain.value = 1; duck.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.8; this.sfx.connect(duck);
    this.amb = ctx.createGain(); this.amb.gain.value = 0.6; this.amb.connect(duck);
    this.radio = ctx.createGain(); this.radio.gain.value = 0.9; this.radio.connect(duck);
    // Engine bed: brown noise + sub osc
    const engSrc = ctx.createBufferSource();
    engSrc.buffer = noiseBuffer(ctx, 3, true);
    engSrc.loop = true;
    const engFilter = ctx.createBiquadFilter(); engFilter.type = "lowpass"; engFilter.frequency.value = 120;
    this.engineGain = ctx.createGain(); this.engineGain.gain.value = 0;
    engSrc.connect(engFilter).connect(this.engineGain).connect(this.sfx);
    engSrc.start();
    const sub = ctx.createOscillator(); sub.type = "sine"; sub.frequency.value = 38;
    this.engineOscGain = ctx.createGain(); this.engineOscGain.gain.value = 0;
    sub.connect(this.engineOscGain).connect(this.sfx);
    sub.start();
    // Rumble path
    const rumSrc = ctx.createBufferSource();
    rumSrc.buffer = noiseBuffer(ctx, 3, true);
    rumSrc.loop = true;
    const rumFilter = ctx.createBiquadFilter(); rumFilter.type = "bandpass"; rumFilter.frequency.value = 50; rumFilter.Q.value = 0.6;
    this.rumbleGain = ctx.createGain(); this.rumbleGain.gain.value = 0;
    rumSrc.connect(rumFilter).connect(this.rumbleGain).connect(this.sfx);
    rumSrc.start();
    // Vent ambience
    const ventSrc = ctx.createBufferSource();
    ventSrc.buffer = noiseBuffer(ctx, 2, false);
    ventSrc.loop = true;
    const ventFilter = ctx.createBiquadFilter(); ventFilter.type = "bandpass"; ventFilter.frequency.value = 900; ventFilter.Q.value = 0.7;
    this.ventGain = ctx.createGain(); this.ventGain.gain.value = 0;
    ventSrc.connect(ventFilter).connect(this.ventGain).connect(this.amb);
    ventSrc.start();
  }

  private ramp(param: AudioParam | undefined, v: number, t = 0.4): void {
    if (!param || !this.ctx) return;
    param.cancelScheduledValues(this.ctx.currentTime);
    param.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, t);
  }

  engine(on: boolean): void {
    this.ramp(this.engineGain?.gain, on ? 0.55 : 0, 1.2);
    this.ramp(this.engineOscGain?.gain, on ? 0.3 : 0, 1.2);
  }
  engineLevel(v: number): void { this.ramp(this.engineGain?.gain, 0.55 * v, 0.8); }
  rumble(intensity: number): void { this.ramp(this.rumbleGain?.gain, 0.5 * intensity, 0.3); }
  vent(on: boolean): void { this.ramp(this.ventGain?.gain, on ? 0.06 : 0, 1.5); }
  duck(level: number): void { this.ramp(this.master?.gain, 0.9 * level, 0.2); }
  setMuted(m: boolean): void { this.muted = m; if (this.master && this.ctx) this.ramp(this.master.gain, m ? 0 : 0.9, 0.1); }

  beep(kind: "soft" | "alert"): void {
    if (!this.ctx || !this.sfx || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = kind === "soft" ? "sine" : "square";
    osc.frequency.value = kind === "soft" ? 880 : 620;
    if (kind === "alert") osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.2);
    g.gain.setValueAtTime(0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind === "soft" ? 0.08 : 0.2));
    osc.connect(g).connect(this.sfx);
    osc.start(); osc.stop(ctx.currentTime + 0.25);
  }

  clunk(): void {
    if (!this.ctx || !this.sfx || this.muted) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 0.15, false);
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 300;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
    src.connect(f).connect(g).connect(this.sfx);
    src.start();
    const thump = ctx.createOscillator(); thump.type = "sine"; thump.frequency.value = 90;
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.3, ctx.currentTime);
    tg.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    thump.connect(tg).connect(this.sfx);
    thump.start(); thump.stop(ctx.currentTime + 0.15);
  }

  /** Squelch + SpeechSynthesis + heterodyne bed. Fails silently when unsupported. */
  speak(c: CommsLine): void {
    if (!this.ctx || !this.radio || this.muted) return;
    const ctx = this.ctx;
    const squelch = ctx.createBufferSource();
    squelch.buffer = noiseBuffer(ctx, 0.08, false);
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800;
    const sg = ctx.createGain(); sg.gain.value = 0.12;
    squelch.connect(bp).connect(sg).connect(this.radio);
    squelch.start();
    if (typeof speechSynthesis === "undefined") return;
    const profile = SPEAKER_PROFILES[c.speaker] ?? { rate: 1, pitch: 1 };
    const u = new SpeechSynthesisUtterance(c.text);
    u.rate = profile.rate; u.pitch = profile.pitch; u.volume = 0.9;
    const bed = ctx.createBufferSource();
    bed.buffer = noiseBuffer(ctx, 1, false);
    bed.loop = true;
    const bedF = ctx.createBiquadFilter(); bedF.type = "bandpass"; bedF.frequency.value = 1400;
    const bedG = ctx.createGain(); bedG.gain.value = 0.015;
    bed.connect(bedF).connect(bedG).connect(this.radio);
    bed.start();
    const stopBed = (): void => {
      try { bed.stop(); } catch { /* already stopped */ }
    };
    u.onend = stopBed;
    u.onerror = stopBed;
    speechSynthesis.speak(u);
  }
}
```

- [ ] **Step 2: Wire into runtime + begin flow**

In `main.ts`: create `const audio = new AudioBus();` and pass to runtime deps (`RuntimeDeps` gains `audio: AudioBus`); map commands per interfaces; `onComms` → `audio.beep("soft")` then `audio.speak(c)`.

- [ ] **Step 3: Verify + commit**

Browser: BEGIN click unlocks audio; countdown beeps; ignition rumble fills low end; comms voices with squelch; interior ventilation after hatch; clunks at docking. Mute toggle (M key) works. Audio failures must not break the mission — wrap `speak` body in try/catch. Commit:

```bash
git add space-sim/core/audio.ts space-sim/main.ts space-sim/mission/runtime.ts && git commit -m "feat(space-sim): synthesized audio bus + SpeechSynthesis radio comms"
```

---

### Task 19: UI — HUD, subtitles, telemetry, countdown, menus, fullscreen, skip

**Files:**
- Create: `space-sim/ui/hud.ts`, `space-sim/ui/subtitles.ts`, `space-sim/ui/menu.ts`
- Modify: `space-sim/style.css`, `space-sim/main.ts`, `space-sim/mission/runtime.ts`

**Interfaces:**
- Produces:
  - `class Hud { constructor(root: HTMLElement); setPhase(p: string): void; setMet(seconds: number, countingDown: boolean): void; setTelemetry(t: { range: number; closure: number; alignErrorDeg: number; phase: string } | null): void; setProgress(stage: 1|2|3|4|5|6): void; setSkipHint(on: boolean): void; update(dt: number): void }` — MET clock shows `T-00:10:00 → T+…` mapping (countdown mode maps the COUNTDOWN state's 80 s to a fictional T-600…T-0); progress rail: 6 stages `01 LAUNCH PREPARATION / 02 ASCENT / 03 ORBIT / 04 ISS APPROACH / 05 DOCKING / 06 ISS EXPLORATION` with current emphasized.
  - `class Subtitles { constructor(root: HTMLElement); show(c: CommsLine): void; update(dt: number): void }` — bottom-center captions, speaker prefix, 6 s hold + typewriter reveal.
  - `class Menu { constructor(root: HTMLElement, callbacks: { onStart(): void; onRestart(): void; onSkip(): void; onExit(): void; onResume(): void; onFullscreen(): void }); showStart(): void; showPause(): void; hide(): void; showError(msg: string): void }` — start card (title ARTEMIS TRANSIT, BEGIN MISSION, FULLSCREEN), pause overlay (Resume/Restart Mission/Skip Cinematic/Exit), both DOM.
- UI keys wired in main: `M` mute, `F` fullscreen, `Esc` pause.

- [ ] **Step 1: Add HUD/subtitle/menu CSS**

```css
/* style.css additions */
.hud { position: absolute; inset: 0; pointer-events: none; z-index: 3; font-size: 11px; }
.hud-phase { position: absolute; top: 28px; left: 32px; letter-spacing: 0.22em; color: var(--hud-fg); text-transform: uppercase; }
.hud-met { position: absolute; top: 28px; right: 32px; letter-spacing: 0.22em; color: var(--hud-accent); }
.hud-progress { position: absolute; bottom: 26px; left: 50%; transform: translateX(-50%); display: flex; gap: 26px; }
.hud-stage { color: var(--hud-dim); letter-spacing: 0.16em; }
.hud-stage.active { color: var(--hud-accent); }
.hud-stage.active::before { content: "▸ "; }
.hud-telemetry { position: absolute; top: 96px; right: 32px; display: grid; grid-template-columns: auto auto; gap: 2px 14px;
  background: var(--hud-bg); border: 1px solid var(--hud-line); padding: 10px 14px; letter-spacing: 0.14em; }
.hud-skip { position: absolute; bottom: 84px; left: 50%; transform: translateX(-50%); color: var(--hud-dim); letter-spacing: 0.18em; }
.subtitles { position: absolute; bottom: 130px; left: 50%; transform: translateX(-50%); max-width: 72ch; text-align: center;
  background: var(--hud-bg); border-left: 2px solid var(--hud-accent); padding: 8px 18px; font-size: 13px; line-height: 1.5; letter-spacing: 0.04em; }
.subtitles .speaker { color: var(--hud-accent); letter-spacing: 0.18em; margin-right: 10px; }
.menu-card { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 14px; align-items: center; justify-content: center;
  background: radial-gradient(ellipse at 50% 40%, rgba(10, 18, 26, 0.88), rgba(2, 4, 6, 0.97)); z-index: 9; }
.menu-title { font-size: 30px; letter-spacing: 0.5em; color: var(--hud-fg); text-transform: uppercase; }
.menu-sub { font-size: 11px; color: var(--hud-dim); letter-spacing: 0.3em; text-transform: uppercase; }
```

- [ ] **Step 2: Implement `ui/hud.ts`**

```ts
// space-sim/ui/hud.ts
export interface TelemetryView { range: number; closure: number; alignErrorDeg: number; phase: string }

const STAGES = ["01 LAUNCH PREPARATION", "02 ASCENT", "03 ORBIT", "04 ISS APPROACH", "05 DOCKING", "06 ISS EXPLORATION"];

export class Hud {
  private phaseEl: HTMLDivElement;
  private metEl: HTMLDivElement;
  private teleEl: HTMLDivElement;
  private skipEl: HTMLDivElement;
  private stageEls: HTMLDivElement[] = [];
  private met = 0;
  private countingDown = false;
  private telemetry: TelemetryView | null = null;

  constructor(root: HTMLElement) {
    const wrap = document.createElement("div");
    wrap.className = "hud";
    this.phaseEl = document.createElement("div");
    this.phaseEl.className = "hud-phase";
    this.metEl = document.createElement("div");
    this.metEl.className = "hud-met";
    this.teleEl = document.createElement("div");
    this.teleEl.className = "hud-telemetry";
    this.teleEl.style.display = "none";
    this.skipEl = document.createElement("div");
    this.skipEl.className = "hud-skip";
    this.skipEl.textContent = "HOLD SPACE TO SKIP";
    this.skipEl.style.opacity = "0";
    for (const s of STAGES) {
      const el = document.createElement("div");
      el.className = "hud-stage";
      el.textContent = s;
      wrap.appendChild(el);
      this.stageEls.push(el);
    }
    wrap.prepend(this.phaseEl, this.metEl, this.teleEl, this.skipEl);
    root.appendChild(wrap);
  }

  setPhase(p: string): void { this.phaseEl.textContent = p; }
  setMet(seconds: number, countingDown: boolean): void { this.met = seconds; this.countingDown = countingDown; }
  setTelemetry(t: TelemetryView | null): void {
    this.telemetry = t;
    this.teleEl.style.display = t ? "grid" : "none";
  }
  setProgress(stage: 1 | 2 | 3 | 4 | 5 | 6): void {
    this.stageEls.forEach((el, i) => el.classList.toggle("active", i === stage - 1));
  }
  setSkipHint(on: boolean): void { this.skipEl.style.opacity = on ? "1" : "0"; }

  private fmt(): string {
    const total = Math.max(0, Math.round(this.met));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const core = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return this.countingDown ? `T-${core}` : `T+${core}`;
  }

  update(dt: number): void {
    if (!this.countingDown) this.met += dt; // countdown mode: setMet() drives the value each frame
    this.metEl.textContent = this.fmt();
    if (this.telemetry) {
      const t = this.telemetry;
      this.teleEl.innerHTML =
        `<span>RANGE</span><span>${t.range < 1000 ? `${t.range.toFixed(1)} M` : `${(t.range / 1000).toFixed(1)} KM`}</span>` +
        `<span>CLOSURE</span><span>${(t.closure * 100).toFixed(1)} CM/S</span>` +
        `<span>ALIGN</span><span>${t.alignErrorDeg.toFixed(2)}°</span>` +
        `<span>MODE</span><span>${t.phase.toUpperCase()}</span>`;
    }
  }
}
```

- [ ] **Step 3: Implement `ui/subtitles.ts`**

```ts
// space-sim/ui/subtitles.ts
import type { CommsLine } from "../mission/engine";

export class Subtitles {
  private el: HTMLDivElement;
  private current: CommsLine | null = null;
  private hold = 0;
  private reveal = 0;

  constructor(root: HTMLElement) {
    this.el = document.createElement("div");
    this.el.className = "subtitles";
    this.el.style.display = "none";
    root.appendChild(this.el);
  }

  show(c: CommsLine): void {
    this.current = c;
    this.hold = 6;
    this.reveal = 0;
    this.el.style.display = "block";
  }

  update(dt: number): void {
    if (!this.current) return;
    this.reveal = Math.min(this.current.text.length, this.reveal + dt * 45);
    this.hold -= dt;
    if (this.hold <= 0) {
      this.current = null;
      this.el.style.display = "none";
      return;
    }
    const speaker = `<span class="speaker">${this.current.speaker}:</span>`;
    this.el.innerHTML = speaker + this.current.text.slice(0, Math.floor(this.reveal));
  }
}
```

- [ ] **Step 4: Implement `ui/menu.ts`**

```ts
// space-sim/ui/menu.ts
export interface MenuCallbacks {
  onStart(): void; onRestart(): void; onSkip(): void; onExit(): void; onResume(): void; onFullscreen(): void;
}

function btn(label: string, cb: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "menu-btn";
  b.textContent = label;
  b.onclick = cb;
  return b;
}

export class Menu {
  private startCard: HTMLDivElement;
  private pauseCard: HTMLDivElement;

  constructor(root: HTMLElement, cb: MenuCallbacks) {
    this.startCard = document.createElement("div");
    this.startCard.className = "menu-card hidden";
    const title = document.createElement("div");
    title.className = "menu-title";
    title.textContent = "Artemis Transit";
    const sub = document.createElement("div");
    sub.className = "menu-sub";
    sub.textContent = "KSC → Orbit → ISS — A cinematic mission";
    this.startCard.append(title, sub,
      btn("BEGIN MISSION", cb.onStart),
      btn("FULLSCREEN", cb.onFullscreen));
    this.pauseCard = document.createElement("div");
    this.pauseCard.className = "menu-card hidden";
    const ptitle = document.createElement("div");
    ptitle.className = "loading-title";
    ptitle.textContent = "MISSION PAUSED";
    this.pauseCard.append(ptitle,
      btn("RESUME", cb.onResume),
      btn("RESTART MISSION", cb.onRestart),
      btn("SKIP CINEMATIC", cb.onSkip),
      btn("EXIT", cb.onExit));
    root.append(this.startCard, this.pauseCard);
  }

  showStart(): void { this.startCard.classList.remove("hidden"); }
  showPause(): void { this.pauseCard.classList.remove("hidden"); }
  hide(): void {
    this.startCard.classList.add("hidden");
    this.pauseCard.classList.add("hidden");
  }
}
```

- [ ] **Step 5: Wire everything in `main.ts`**

Flow: loading → `menu.showStart()` → BEGIN click → `audio.unlock()` + `mission` starts ticking. Runtime `ui` sinks now feed `hud.setPhase`, `subtitles.show`, `hud.setProgress(h.progressStage)`, `hud.setTelemetry(docking.telemetry())` when phase has telemetry (from `h.telemetry === "docking"`), `hud.setMet(engine.t, engine.current === "COUNTDOWN")` (countdown mode maps state-local 0–80 s to T-600→0: `met = 600 * (1 - stateLocal / 80)`). `hud.update(dt)` + `subtitles.update(dt)` in render loop. ESC → pause: `mission.engine.paused = true`, `menu.showPause()`; Resume reverses. Skip Cinematic → `mission.skipTo(nextMajorState(engine.current))` where major states = `["LAUNCH_PREPARATION","ENGINE_IGNITION","ORBIT","ISS_REVEAL","DOCKING_SEQUENCE","ISS_INTERIOR_INTRO","PLAYER_CONTROL_ENABLED"]`. Restart → `mission.engine.restart()` + reset flight/FX/docking/player. `F`/`onFullscreen` → `document.documentElement.requestFullscreen()` toggle. `hud.setSkipHint(true)` only during cinematic states (before `PLAYER_CONTROL_ENABLED`).

- [ ] **Step 6: Full-run verification + commit**

Browser: complete first run start-to-player-control without errors: subtitles sync with voice, MET correct in countdown, progress rail advances 01→06, telemetry grid during approach/docking, pause/skip/restart all function, fullscreen works. Commit:

```bash
git add space-sim/ui space-sim/style.css space-sim/main.ts space-sim/mission/runtime.ts && git commit -m "feat(space-sim): HUD, subtitles, telemetry, menus, fullscreen, skip"
```

---

### Task 20: Robustness, mobile degrade, hub integration, README, final acceptance

**Files:**
- Modify: `space-sim/main.ts`, `space-sim/style.css`, `src/lib/games.ts`, `src/pages/HomePage.tsx`
- Create: `space-sim/README.md`
- Modify: `space-sim/index.html` (final meta)

**Interfaces:**
- `games.ts` entry `space-simulator` gets updated mechanics text (new experience): cinematic launch→dock mission, zero-G exploration, Cupola.
- `HomePage.tsx` line ~219 tagline updated to match.
- Robustness checklist implemented in `main.ts`.

- [ ] **Step 1: Robustness pass in `main.ts`**

- Wrap every dynamic `await import(...)` world-build step in try/catch that logs and continues (missing subsystem ≠ black screen); only engine failure shows the error screen.
- Context loss: `engine.onContextLostObservable.add(() => { document.getElementById("error-screen")?.classList.remove("hidden"); })` with reload hint.
- `?skip=<state>` debug params retained behind `import.meta.env.DEV` guard (QA aid only).
- Mobile/touch degrade: if `matchMedia("(pointer: coarse)").matches` → set tier low caps, hide `HOLD SPACE TO SKIP`, add note "Best experienced on desktop" on start card.
- Reduced motion: `prefers-reduced-motion` → disable camera wobble (`wobble` param 0) and shake.

- [ ] **Step 2: Hub integration copy**

In `src/lib/games.ts` replace the `space-simulator` mechanics array:

```ts
    mechanics: [
      'Cinematic mission: KSC launch, ascent, orbit and automated ISS docking.',
      'Directed NASA-style camera work with mission-control radio comms.',
      'Zero-G first-person exploration inside the ISS after docking.',
      'Cupola viewing moment with procedural Earth below.',
      'Fully procedural — no downloads, works offline.',
    ],
```

In `src/pages/HomePage.tsx` line ~219 replace tagline text with:

```tsx
                Cinematic crewed mission. Watch the SLS leave Pad 39-A, ride to orbit, dock with the ISS — then float the station yourself.
```

- [ ] **Step 3: `space-sim/README.md`**

```markdown
# Space Simulator — Artemis Transit

Standalone cinematic spaceflight experience (Babylon.js, zero binary assets).
Built per `docs/superpowers/specs/2026-08-29-space-simulator-rebuild-design.md`.

- Mission: KSC → SLS launch → ascent → orbit → ISS docking → zero-G interior exploration
- Architecture: deterministic mission clock + data-driven script (`mission/script.ts`),
  cinematic director with 42 camera rigs, procedural materials/audio
- Runs at `/space-sim/` (Vite MPA entry). Debug: `?skip=COUNTDOWN` (dev only), `?view=iss|interior`.
- Controls (after docking): WASD thrust, Space/Ctrl vertical, Shift boost, mouse look, E interact, Esc pause.
```

- [ ] **Step 4: Final acceptance run**

Run the full spec §10 acceptance sequence in a fresh browser profile, both backends (WebGPU on/off via chrome flags):
OPEN WEBSITE → card → START → loading → KSC establishing → launch prep → crew prep → countdown → ignition → liftoff → ascent → staging ×2 → orbit → Earth reveal → ISS reveal → approach → docking → confirmation → transfer → hatch → interior → PLAYER CONTROL ENABLED → zero-G to Cupola. No broken transitions, no console errors.

Run: `npm run lint && npm run test && npm run build` — all green.

- [ ] **Step 5: Commit**

```bash
git add space-sim src/lib/games.ts src/pages/HomePage.tsx && git commit -m "feat(space-sim): robustness pass, hub integration copy, README — acceptance complete"
```
