# Space Simulator Rebuild — Design Specification

**Date:** 2026-08-29
**Status:** Approved (design sections approved by user in session)
**Scope:** Complete from-scratch replacement of the Space Simulator experience. The old `space-sim/` (deleted from working tree, still in git HEAD) must not be reused, referenced, or refactored.

---

## 1. Product Vision

A photorealistic, cinematic, NASA-documentary-style spaceflight experience rendered in the browser:

**Launch Preparation → Rocket Launch → Atmospheric Ascent → Orbit → ISS Approach → Docking → ISS Interior → First-Person Exploration**

The user is a passive cinematic observer for the entire mission (zero gameplay controls, camera/spacecraft/mission progression fully directed). Direct control unlocks **only** at `PLAYER_CONTROL_ENABLED`, when the player becomes a floating astronaut inside the ISS.

Quality target: "This looks like an actual NASA visualization." No cartoon styling, no game-y HUD, no low-poly look, no fake-quality placeholders.

---

## 2. Decisions (user-confirmed)

| Decision | Choice |
|---|---|
| Asset strategy | **Procedural-first** — all geometry and textures generated in code; zero binary assets; works offline (repo convention) |
| Audio | **Web Audio synthesis** for all SFX/ambience + **SpeechSynthesis** for comms voice lines through a radio filter; always-on captions |
| Pacing | **Condensed cinematic, ~10–14 min** total first-run mission |
| Architecture | **Standalone Babylon.js vanilla-TS app** in `space-sim/`, Vite MPA entry, zero React coupling (rail-rush isolation pattern) |
| Renderer | Babylon.js WebGPU engine with automatic WebGL2 fallback; feature-gated quality tiers |

---

## 3. Architecture

### 3.1 Module map

```
space-sim/
├── index.html            # standalone entry: fullscreen canvas + UI overlay roots
├── style.css             # HUD, loading screen, pause menu (plain CSS, no Tailwind)
├── main.ts               # bootstrapper: engine → loader → mission engine
├── core/
│   ├── engine.ts         # Babylon engine (WebGPU→WebGL2), quality tiers
│   ├── assets.ts         # procedural asset/texture/material registry
│   ├── audio.ts          # AudioBus: synthesized SFX + SpeechSynthesis comms
│   └── input.ts          # keyboard/mouse/touch, hold-to-skip
├── mission/
│   ├── types.ts          # MissionState, MissionEvent, Shot, Command types
│   ├── script.ts         # data-driven mission script (~20 states, ~60 events)
│   ├── engine.ts         # state machine + MissionClock (single source of truth)
│   └── transitions.ts    # cross-fades, dip-to-black, hard cuts
├── cinema/
│   ├── director.ts       # shot sequencing from per-state camera pools
│   ├── shots.ts          # shot library (crane, orbit, tracking, static, POV…)
│   └── transitions.ts    # interp / cut / rack-focus between shots
├── world/
│   ├── ksc/              # terrain, coastline, VAB, LC-39A, tower, crawler, roads, props
│   ├── earth/            # planet, clouds, atmosphere shell, night lights, ocean
│   └── space/            # starfield, Milky Way, sun
├── vehicles/
│   ├── sls.ts            # core stage, SRBs, ICPS, Orion stack (procedural builders)
│   └── flight.ts         # trajectory, staging events, exhaust plumes
├── iss/
│   ├── exterior.ts       # truss, modules, arrays, radiators (modular builder)
│   ├── interior.ts       # Node1/Unity/Harmony/Cupola walkthrough interior
│   └── docking.ts        # relative-motion animation + telemetry feed
├── player/
│   ├── controller.ts     # zero-G movement (accel/inertia/damping)
│   └── interact.ts       # raycast prompts, [E] interactions
├── effects/
│   ├── exhaust.ts        # engine plume + dynamic light
│   ├── smoke.ts          # ground smoke/steam, debris
│   └── sky.ts            # atmosphere color ramp, sun glare, exposure targets
└── ui/
    ├── hud.ts            # phase badge, telemetry, mission progress rail
    ├── subtitles.ts      # comms captions
    ├── loading.ts        # real-progress loading screen
    └── menu.ts           # start card, pause menu
```

### 3.2 Data flow

- `MissionClock` ticks (pausable, deterministic — pausing freezes the whole simulation).
- `MissionEngine` resolves `MissionEvent`s due at elapsed time and emits typed commands.
- Consumers: `CinemaDirector` (camera), `FlightModel` (vehicle/trajectory), `Effects`, `AudioBus`, `UI`.
- No system reads the Babylon scene graph for logic. State lives in the mission engine; visuals subscribe.
- Restart = reset engine state + rebuild entities; no page reload required.

---

## 4. Mission Script & Cinematic Director

### 4.1 State machine (20 states)

`MISSION_INIT → KSC_ESTABLISHING → LAUNCH_PREPARATION → CREW_PREPARATION → COUNTDOWN → ENGINE_IGNITION → LIFTOFF → ATMOSPHERIC_ASCENT → BOOSTER_PHASE → STAGE_TRANSITION → ORBITAL_INSERTION → ORBIT → ISS_REVEAL → ISS_APPROACH → DOCKING_SEQUENCE → DOCKING_COMPLETE → CREW_TRANSFER → ISS_INTERIOR_INTRO → PLAYER_CONTROL_ENABLED → ISS_EXPLORATION`

Each state: entry logic, event timeline, camera pool, audio bed, narration, UI changes, exit condition.

### 4.2 Event format

```ts
interface MissionEvent {
  id: string;
  state: MissionState;
  at: number;              // seconds into state
  duration?: number;       // shot hold / timed moment
  shot?: ShotId;           // e.g. "crane_up_vab", "plume_ground"
  action?: Command;        // ignition(), stageSeparate(), openHatch()…
  comms?: CommsLine;       // speaker, text, radio style
  hud?: HudChange;         // telemetry on/off, phase badge, captions
  fx?: FxCommand;          // smoke ramp, particle burst, exposure target
  transition?: "cut" | "dip" | "crossfade";
}
```

### 4.3 Cinematic Director rules

- Per-state **shot pools** with weights and min-holds; director sequences them.
- Cut discipline: never the same rig twice consecutively; 4–10 s cuts during dynamic phases; 20–60 s contemplative holds in orbit/docking.
- Shot types: establishing, crane, orbit, tracking, ground-level, rocket POV cams, ascent horizon, Earth-limb slow drift, docking target-cam, first-person astronaut POV (prep + transfer moments).
- All motion time-anchored to mission time (deterministic under pause/skip).
- Fallback: if a shot's target is disabled by quality tier, director picks nearest valid rig — never a black frame.

### 4.4 Timing budget (~12 min condensed)

| Phase | Duration |
|---|---|
| KSC establishing | 45 s |
| Launch preparation | 70 s |
| Crew preparation | 50 s |
| Countdown (T-10:00 compressed w/ time-jump captions) | 80 s |
| Ignition + liftoff | 40 s |
| Atmospheric ascent (2 staging events) | 130 s |
| Orbital insertion + orbit | 100 s |
| ISS reveal | 50 s |
| Approach | 80 s |
| Docking | 100 s |
| Crew transfer + hatch | 45 s |
| → player control | — |

**Cinematic total: 790 s ≈ 13.2 min** (within the 10–14 min budget; `PLAYER_CONTROL_ENABLED` and `ISS_EXPLORATION` are open-ended and excluded).

### 4.5 Skip & pause

- **Hold SPACE to skip** current shot (subtle hint, never default behavior).
- Pause menu: Resume / Restart Mission / Skip Cinematic (jump to next major phase) / Exit (back to hub).
- Input locked during cinematic phases; unlocked only at `PLAYER_CONTROL_ENABLED`.

---

## 5. Visual World (procedural-first)

### 5.1 Kennedy Space Center (~4 km² modeled, 1 unit = 1 m)

- Heightfield terrain, Florida marsh texture blend (grass→wetland→asphalt).
- Atlantic coastline + ocean plane with animated normals.
- VAB: 160 m, ribbed side walls, low-bay/high-bay massing, US flag decal.
- LC-39A: pad deck, lightning towers, water tower, mobile launcher with umbilical tower + retracting swing arms (retract at T-0), crawler/transporter, crawlerway.
- Perimeter roads, fences, signs, low-poly distant facility cluster.
- Ground detail: ~40 service vehicles/personnel props near pad.

### 5.2 SLS + Orion (98 m stack)

- Core stage: orange foam texture with streak/weathering decals, USA + worm logo, NASA meatball.
- Two 5-segment SRBs with nose cones + nozzles; ICPS upper stage.
- Orion: silver capsule + service module with four X-wing solar arrays; LAS abort tower with canards.
- Real proportions throughout; markings communicate the specific vehicle.

### 5.3 Earth (r = 6,371 km, true scale)

- Procedural albedo (continents from noise/height rules, not photos).
- Animated cloud layer with cloud shadows; Fresnel atmosphere shell.
- Day/night terminator with city lights; ocean specular; sun glare on limb.
- At 400 km ISS altitude the horizon fills the frame — Earth must feel enormous.

### 5.4 ISS (109 m)

- Modular kit-bash from shared detail primitives (beams, racks, foil-wrapped cylinders) — no bare boxes.
- ITS main truss, 8 solar array wings (two-sided, emissive cells), 4 radiator sets.
- Pressurized modules: Zarya, Zvezda, Unity, Harmony, Destiny, Columbus, Kibo+JEM, Tranquility, Quest, Cupola; PMAs on the docking axis; external equipment boxes and handrails.

### 5.5 Materials & lighting

- PBR everywhere with per-material procedural roughness/dirt variation; no uniform-perfect surfaces.
- Sun: single directional key + sky-derived ambient; launch plume: additive particle core + real point light illuminating pad/tower/ML; plume-lit smoke.
- ISS interior: practical lighting (panel lights, instruments) + Cupola window Earth-light bounce.
- Post stack: bloom, SSAO (desktop tier), DOF, motion blur, ACES tonemapping, per-phase auto-exposure targets.

---

## 6. Player, Interaction, Audio, UI

### 6.1 Zero-G movement (post `PLAYER_CONTROL_ENABLED`)

- Velocity-based: WASD thrust, Space/Ctrl vertical, Shift boost, mouse-look.
- Acceleration + inertia + exponential damping; subtle rotational momentum; never instant stop ("controlled movement through a zero-G environment").
- Collision: capsule vs. AABB set against module geometry (no physics engine dependency).
- [E] near handrails = controlled pull.

### 6.2 Interaction system

- Center-screen raycast → contextual `[E] Interact` prompt; no screen clutter.
- Targets: laptops, panel switches (lights/flags), Cupola windows (zoom-to-window moment), experiment racks, emergency gear. Flavor + feedback, not puzzles.

### 6.3 Audio

- Single `AudioBus` with layered synthesis: engine rumble (filtered brown noise + sub-oscillator), pad ambience, ISS fans/ventilation, mechanical clunks, radio beeps.
- SpeechSynthesis comms through Web Audio radio chain (bandpass + light distortion + static); per-speaker rate/pitch (CAPCOM, Commander, PAO); always-on captions.
- Exterior space scenes: no ambient sound except radio — no unrealistic explosions in vacuum.

### 6.4 UI (DOM overlay, not canvas — crisp text)

- Minimal aerospace language: thin lines, uppercase mono labels, restrained NASA-inspired palette. No neon, no game HUD.
- Elements: phase badge, MET clock, mission progress rail (6 numbered stages: LAUNCH PREPARATION / ASCENT / ORBIT / ISS APPROACH / DOCKING / ISS EXPLORATION with current emphasized), contextual telemetry (docking: RANGE / CLOSURE RATE / ALIGN), subtitles bottom-center, hold-SPACE skip hint, fullscreen toggle, loading screen with real progress ("INITIALIZING MISSION … Loading Kennedy Space Center …"), start card, pause menu.

---

## 7. Robustness & Failure Handling

- Engine init failure → styled error card with retry; never a blank canvas.
- WebGPU unavailable → WebGL2 tier (reduced particles, SSAO off); feature-gated post effects.
- WebGL context-loss handler restores the session.
- Loading: real per-builder progress + timeout fallback.
- Audio failures never block the mission (silent playback + captions remain).
- Every subsystem wrapped so a thrown error degrades that subsystem only.

---

## 8. Testing Strategy

- **Vitest** (already configured) for pure logic:
  - Mission script integrity: no overlapping events, all states reachable, shot IDs reference existing rigs, timing budget sums correctly.
  - State machine: legal transitions, restart reset.
  - Zero-G integrator: damping/inertia math.
  - Docking telemetry math (range/closure from relative positions).
- Rendering/visual quality verified manually per phase (build vertically, fix visual defects before advancing — per master prompt §60).

---

## 9. Website Integration

- New Vite MPA rollup entry: `space-sim/index.html` → served at `/space-sim/`.
- `HomePage.tsx`: "Launch Mission" card links to `/space-sim/` (new tab).
- `src/lib/games.ts`: re-register `space-simulator` catalog entry.
- Folder fully self-contained; shares nothing with the React bundle.
- Fullscreen mode expands the canvas and hides overlay chrome.
- Old deleted `space-sim/` stays deleted; no resurrection from git HEAD.

---

## 10. Acceptance Sequence

Open website → Start Space Simulator → KSC establishing → Launch prep → Crew prep → Countdown → SLS ignition → Liftoff → Atmospheric ascent → Staging → Orbit → Earth reveal → ISS reveal → ISS approach → Docking → Docking confirmation → Crew transfer → ISS hatch → ISS interior → PLAYER CONTROL ENABLED → zero-G exploration.

No broken transitions anywhere; the cinematic-to-first-person transition is the core payoff moment.
