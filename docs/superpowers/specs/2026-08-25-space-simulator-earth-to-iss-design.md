# Space Simulator: Earth to ISS Mission — Design Spec

**Date:** 2026-08-25
**Source PRD:** `Space_Simulator_Earth_to_ISS_PRD.md`
**Status:** Approved design; ready for implementation planning

## 1. Overview

A standalone, single-player, web-based 3D mini-game: the player launches from
Earth, ascends through the atmosphere into orbit, maneuvers in zero-G, and
docks with the ISS. Simplified-but-plausible physics (not an aerospace
simulator). Target session: 5–10 minutes. Priority per PRD §O:
**Playability > Clarity > Performance > Visual Fidelity > Simulation Complexity.**

## 2. Placement & integration

- New folder `space-sim/` at repo root, following the existing **Rail Rush**
  precedent: a separate Vite MPA entry (`space-sim/index.html`) served at
  `/space-sim/`, written in **vanilla TypeScript** (no React) so Babylon.js
  owns the full-page lifecycle.
- `vite.config.ts`: add `'space-sim/index': 'space-sim/index.html'` to
  `build.rollupOptions.input`.
- `tsconfig.json`: add `"space-sim"` to `include` (currently `["src", "rail-rush"]`).
- `src/pages/HomePage.tsx`: add a standalone promo card linking to
  `/space-sim/`, styled like the existing Rail Rush card.
- Not part of the multiplayer arcade registry (`src/games/registry.ts`) — the
  experience is single-player and fullscreen, and does not fit the
  room/lobby lifecycle.

## 3. Scope

### 3.1 In scope (V1 — the PRD §Q vertical slice, complete mission loop)

- Mission phases: Loading → Briefing → Ascent → Orbit → Approach → Docking →
  Complete/Failed, plus Paused overlay (single Babylon `Scene`, PRD §D.3).
- Phase 1 ascent: thrust-controlled climb, simplified gravity, atmospheric
  visual transition (sky color darkening, starfield fade-in, Kármán line
  milestone at 100 km), handoff to orbital controller.
- Phase 2 zero-G: 6-DOF translation + rotation, inertia (velocity persists on
  key release), counter-thrust/brake, fuel consumption.
- Phase 3 approach & docking: ISS target marker, approach corridor, docking
  checks (distance < 5 m, relative velocity < 0.5 m/s, alignment < 5°),
  success/failure, retry.
- Babylon GUI HUD: altitude, speed, fuel bar, O₂ bar, distance to ISS,
  relative speed, alignment %, approach state (Safe/Caution/Critical/Docking
  Ready), mission timer, target marker, controls hint.
- Desktop keyboard controls (WASD/Space/Shift/QE/R/F/Esc per PRD §C.5) and
  mobile touch controls (left joystick translation, right drag look, up/down
  buttons, brake, assist, dock — PRD §C.6).
- Loading screen with real progress (engine init → scene build → ready).
- Pause: Esc key, pause button, and auto-pause on `document.hidden`; delta
  time clamped on resume (PRD §E.8).
- WebGL-unavailable fallback screen (no blank page, no uncaught fatal error).
- Adaptive quality: sustained-FPS sampling → render-scale downgrade
  (PRD §D.19/E.3), never on a single spike.
- Recenter control (PRD §E.10) and out-of-bounds warning + return
  (PRD §E.11).
- Mission complete screen: time, fuel remaining, docking accuracy, rating,
  replay.
- Analytics event stubs (console-based, PRD §I event names/properties).
- Assist toggle (F / touch button): stabilization damping + gentle
  velocity bleed.

### 3.2 Deferred (post-V1, per PRD §Q "after core loop is proven")

- Audio (all layers), GLB/glTF assets, KTX2 textures, LOD, cinematic camera
  sequences, atmosphere fresnel shader (V1 uses a simple gradient shell),
  floating-origin, Playwright E2E, localization, mission grades beyond the
  simple A–D rating, leaderboard.

### 3.3 Assets

All geometry is **procedural** (Babylon primitives built in code): low-poly
Earth sphere with gradient material, cloud layer, atmosphere shell, starfield
skybox (procedural cube texture), box/cylinder ISS with solar panels, docking
port ring, simple launch pad. No external asset downloads → the asset-failure
edge-case class (PRD §E.4/E.5) is eliminated for V1.

## 4. Architecture

### 4.1 Module layout (PRD §N simulation/presentation/content split)

```
space-sim/
├── index.html      # canvas + HTML shell screens (loading/briefing/pause/result/fallback)
├── style.css       # shell screen styling
├── main.ts         # bootstrap: feature detection, engine + Havok init, phase dispatch
├── config.ts       # ALL tuning constants: thrusters, gravity, docking thresholds, scale
├── state.ts        # MissionState, MissionPhase machine, event emitter, analytics stub
├── input.ts        # keyboard + touch → InputState abstraction (PRD §D.15)
├── world.ts        # CONTENT: Earth, clouds, atmosphere shell, starfield, launch pad
├── iss.ts          # CONTENT: procedural ISS, docking port transform, collision shell
├── player.ts       # SIMULATION: ascent + 6-DOF controllers, fuel, gravity model
├── docking.ts      # SIMULATION: pure docking criteria logic (distance/velocity/alignment)
└── hud.ts          # PRESENTATION: Babylon GUI telemetry, bars, target marker, states
```

### 4.2 State machine

```ts
enum MissionPhase { Loading, Briefing, Ascent, Orbit, Approach, Docking, Complete, Failed }
```

`Paused` is a boolean overlay flag on the state (stores nothing extra; the
render loop simply stops advancing simulation while paused). Phase transitions
emit events consumed by HUD and analytics. `MissionState` (PRD §D.16) is the
single source of truth the HUD reads:
`{ phase, paused, altitude, velocity, relativeVelocity, fuel, oxygen, distanceToISS, alignment, missionTime }`.

### 4.3 World scale (PRD §D.8)

- 1 gameplay unit = 100 m for orbital/docking ranges; telemetry converts back
  to meters/km for display.
- Ascent altitude uses a compressed configurable mapping (displayed km vs.
  scene units) so the full Earth-to-orbit journey fits float precision without
  floating-origin. Earth radius in scene units is small (tens of units); the
  displayed altitude is derived from a mapping function in `config.ts`.

### 4.4 Physics (PRD §B.7)

Havok via `@babylonjs/havok` + `HavokPlugin`, used minimally:
- Player rigid body (capsule) — controllers set linear/angular velocity
  directly each frame; Havok provides collision response only.
- ISS static collision shell (separate low-poly shape from visual mesh,
  PRD §E.9).
- Docking trigger volume at the port.
The game controller owns feel; the physics engine never owns the player
(PRD §B.7 explicit warning).

Havok WASM loads from the npm package (`@babylonjs/havok` default export);
loading failure falls back to a kinematic mode (no collision) with a console
warning rather than blocking the mission — collision is not required for the
core loop to be playable.

### 4.5 Controllers

- **AscentController** (Phase 1): vertical thrust vs. simplified gravity
  (`g` scales down with altitude, configurable), slight lateral damping.
  Ends when altitude crosses the orbit threshold → phase Orbit.
- **OrbitController** (Phases 2–3): 6-DOF. Translation impulses along camera
  axes, rotation via pitch/yaw/roll input, linear/angular damping per PRD §B.6
  tuning table, fuel consumed per thrust, brake (R) applies counter-thrust
  toward zero velocity, assist toggle raises damping.

### 4.6 Docking logic (pure, unit-testable)

```
dockSuccess = distance < 5 && relSpeed < 0.5 && alignmentDeg < 5 && inCorridor
```

Thresholds live in `config.ts` (gameplay tuning, PRD §B.10). Alignment =
angle between player forward axis and the port approach axis; corridor =
player inside the approach cone. Failure conditions: collision with ISS
shell above safe contact speed, fuel depletion while far from port
(retry offered), oxygen depletion (long-mission failure).

### 4.7 HUD (Babylon GUI, per user decision)

`AdvancedDynamicTexture` fullscreen UI: top telemetry row (altitude/speed),
fuel + O₂ bars, bottom-left docking panel (distance, relative speed,
alignment %, approach state), center target marker projected from 3D,
controls hint, pause/recenter/dock buttons (touch). HTML is used only for
full-screen shell states (loading, briefing, pause overlay, result,
WebGL fallback) — matching PRD §C.1's split.

### 4.8 Input abstraction (PRD §D.15)

`InputState { forward, backward, left, right, up, down, pitch, yaw, roll, brake }`
plus discrete events (pause, assist toggle, recenter, dock confirm). Keyboard
and touch providers both write into the same state; gameplay never touches
DOM events directly.

## 5. Edge cases (V1 coverage)

| PRD ref | Handling |
|---|---|
| E.1 WebGL disabled | Engine creation wrapped in try/catch → HTML compatibility screen |
| E.3/E.8 Low FPS, tab switch | FPS sampler (N consecutive samples) → render scale step-down; `visibilitychange` → auto-pause; dt clamp |
| E.6 Resize/orientation | Babylon engine resize handler; portrait works, landscape recommended banner |
| E.7 Accessibility | Keyboard-accessible shell screens, visible focus, contrast, reduced-motion (disable camera shake), pause anytime, text for all warnings |
| E.10 Lost | Recenter button: camera faces ISS, guidance marker emphasized |
| E.11 Out-of-bounds | Mission-volume check → warning + "Return to Mission" action |

## 6. Performance targets

Desktop 60 FPS / mobile 30 FPS (PRD §D.18). Procedural low-poly content keeps
draw calls and triangle counts tiny; adaptive render scale is the V1 quality
lever. No shadows, no post-processing in V1.

## 7. Testing & verification

- **Vitest unit tests** (repo already has vitest): docking criteria
  (pass/fail boundaries), phase machine transitions, ascent integration
  (thrust vs. gravity reaches orbit), fuel consumption/brake math, altitude
  display mapping.
- **Build/typecheck:** `npm run build` (tsc -b includes `space-sim`),
  `npm run lint`.
- **Manual smoke:** `npm run dev` → `/space-sim/` → full mission loop on
  desktop + mobile viewport.

## 8. Analytics

Console-logged event stubs with PRD §I names and properties
(`deviceType`, `qualityTier`, `missionTime`, `fuelRemaining`,
`dockingAccuracy`). Single `track(event, props)` function in `state.ts`;
swappable for a real backend later. No personal data.

## 9. Definition of done (V1)

- [ ] `/space-sim/` serves the game; WebGL fallback screen when unavailable
- [ ] Full loop: launch → ascent → orbit → approach → dock → result → replay
- [ ] 6-DOF with inertia, fuel, brake, assist
- [ ] Babylon GUI HUD with all telemetry + approach states
- [ ] Desktop keyboard + mobile touch controls
- [ ] Pause (Esc/button/tab-hidden) with dt clamp
- [ ] Adaptive render scale on sustained FPS drop
- [ ] Unit tests green; build + lint clean
- [ ] HomePage card linking to the game
