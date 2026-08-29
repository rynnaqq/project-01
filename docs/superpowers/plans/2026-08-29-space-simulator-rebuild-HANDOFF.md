# HANDOFF — Space Simulator Rebuild (for the next AI session)

**Read this first. Then read the plan, then the ledger. You are resuming a partially-executed, carefully-reviewed build — do not restart, do not redesign.**

---

## 1. What this project is

A from-scratch cinematic NASA-style spaceflight experience (KSC → SLS launch → orbit → ISS docking → zero-G ISS interior exploration) as a standalone Babylon.js app in `space-sim/`, mounted into an existing React "arcade hub" site as a Vite MPA entry at `/space-sim/`.

**Binding documents, in order of authority:**
1. Spec: `docs/superpowers/specs/2026-08-29-space-simulator-rebuild-design.md`
2. Plan (20 tasks, full code in briefs): `docs/superpowers/plans/2026-08-29-space-simulator-rebuild.md`
3. Execution ledger (what's done, all rulings): `.superpowers/sdd/2026-08-29-space-simulator-rebuild/progress.md`

**Branch:** `feat/space-sim-rebuild` — HEAD at handoff: `203f918`. All 152 tests pass, tsc clean, lint (max-warnings 0) clean.

## 2. Current state (at handoff)

| Tasks | Status |
|---|---|
| 1–11 | **COMPLETE** (each implemented by a subagent, reviewed, fix-looped where needed). Commits `32fb98a..203f918`. |
| 12 | **NEXT — dispatch was cancelled by the user, zero work done on it.** |
| 13–20 | Not started. |
| Final whole-branch review | Not started (after Task 20). |

Built so far: standalone scaffold + WebGPU/WebGL2 engine + quality tiers (T1); mission state machine, deterministic clock, full 87-event mission script + integrity tests, 42-shot registry (T2); cinematic director + 42 camera rigs + transition fades (T3); procedural noise + PBR material factory (T4); sky/atmosphere controller, starfield, true-scale procedural Earth with custom GLSL (T5); KSC terrain/ocean/vegetation (T6); VAB + facility cluster (T7); LC-39A pad + mobile launcher + crawler (T8); ground props + crewQuarters anchor (T9); SLS+Orion stack with staging-capable detach() (T10); flight model + staging math (TDD) + exhaust plume + ground smoke (T11).

**There is NO runtime wiring yet**: the mission script does not drive the world. That is Task 12.

## 3. Environment facts (Termux on Android — important)

- **`/usr/bin/env` does not exist.** Never run the superpowers scripts directly; either `bash <script>` (sdd-workspace works this way) or use the extractor already written: `.superpowers/sdd/2026-08-29-space-simulator-rebuild/tbrief` (usage: `tbrief PLAN_FILE N OUTFILE` — extracts Task N's full text).
- **`tsc` is not on PATH**: use `npx tsc --noEmit` or `node node_modules/typescript/bin/tsc --noEmit`.
- **`npm run build` takes ~23 minutes.** Run it ONLY at checkpoint gates: end of Task 12 (user asked for it there) and Task 20 acceptance. Everything else verifies with `npm run test` (fast) + `npm run lint` + `npx tsc --noEmit`.
- **Headless device — no browser.** Visual gates were deferred by standing ruling to the human partner at the Task 12 checkpoint and Task 20 acceptance. Do not attempt browser verification; do static gates, then tell the user what to check in their browser.
- Don't touch the pre-existing unstaged deletions in git status (user's own files: `Screenshot_*.jpg`, `next.md`, `next.prd`, `prd.md`, `session-ses_*.md`); never `git add` them.

## 4. The execution process you must follow (subagent-driven development)

For each remaining task (12–20):

1. **Extract the brief**: `$WS/tbrief docs/superpowers/plans/2026-08-29-space-simulator-rebuild.md N $WS/task-N-brief.md` where `$WS=/data/data/com.termux/files/home/project/.superpowers/sdd/2026-08-29-space-simulator-rebuild`. The brief is the implementer's single source of requirements (it contains complete code — transcription + tests).
2. **Record BASE**: `git rev-parse HEAD` before dispatching.
3. **Dispatch ONE implementer subagent** (`task` tool, `subagent_type: "general"`). Dispatch contract: (a) one line on where the task fits; (b) the brief path, introduced as "read this first — it is your requirements, with exact values verbatim"; (c) the per-task guidance from §6 of this handoff; (d) the report-file path `$WS/task-N-report.md`; (e) the return contract: ONLY status (DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED), commit hash(es), one-line test summary, concerns. Include in every dispatch: **"You must NOT dispatch any subagents"**, the lint/test conventions (below), and the no-build rule.
4. **Review**: write the diff package to a file (NOT into your context): `git log --oneline BASE..HEAD`, `git diff --stat BASE..HEAD`, `git diff -U10 BASE..HEAD` appended into `$WS/task-N-review.diff`, then dispatch a reviewer subagent with brief+report+diff paths, the task's binding constraints (copy from the plan's Interfaces/Global Constraints), and instruction: verify spec compliance AND code quality, both verdicts, findings as Critical/Important/Minor, plus "⚠️ Cannot verify from diff" items; do NOT re-run tests (accept report evidence).
5. **Fix loop** (max 5 rounds) if spec ❌ or Critical/Important findings: resume the implementer subagent (same `task_id`) with findings verbatim; implementer fixes, appends fix report, commits; then a SCOPED re-review (fix diff only) verdicting each finding ADDRESSED/NOT ADDRESSED. Rounds 4–5: fresh implementer with "a prior implementer attempted this N times".
6. **Ledger** every completion/finding/ruling in `$WS/progress.md` (`Task N: complete (commits X..Y, review clean)` / `Task N: minor (deferred): ...` / `Task N: Ruling: ...`). Mark todos. Never fix findings yourself in the controller session.
7. After Task 20: **final whole-branch review** (`git diff -U10 32fb98a..HEAD` package, most capable reasoning, triage the ledger's deferred minors), one fix wave max, then present the branch to the user (merge decision is theirs).

Repo conventions for every dispatch: strict TS; `npm run lint` (max-warnings 0 — zero unused imports/vars/params); tests `npm run test` (Vitest, node env — new logic tests must stay Babylon-free and pure); conventional commits (`feat(space-sim): ...`, `fix(space-sim): ...`); never weaken tests to make them pass; fix the code or the plan (with a ruling).

## 5. Hard-won context (trap list — each of these was a real review finding)

Babylon 9.22 API facts verified against installed typings:
- `WebGPUEngine` ctor is positional: `new WebGPUEngine(canvas)` — NOT `{ canvas }`.
- `cam.setTarget(vec)` — single-arg in 9.22.
- `ShaderMaterial` inline shaders use `{ vertexSource, fragmentSource }` keys; `vertex`/`fragment` mean shader-store keys. `alphaBlendMode` does NOT exist — use `needAlphaBlending`/`alphaMode`. Constants.TEXTUREFORMAT_RGBA = 5 (no `Texture.RGBA_FORMAT`).
- `ParticleSystem.manualEmitCount = 0` PERMANENTLY kills emission (Babylon resets it to 0, not −1). Never use; gate via `emitRate` instead. Exhaust plume is throttle-gated (`baseRates[i] * throttleValue`) and smoke is ramp-gated for this reason — keep it that way.
- Writing Euler `rotation` is inert once `rotationQuaternion` is set — detached SRB/core tumble uses incremental `Quaternion.RotationAxis(...).multiply(...)` (see flight.ts:126–136).
- `getAbsolutePosition()`/`absoluteRotationQuaternion` return live refs — clone before caching (sls.ts detach()).
- `GroundMesh` vertex edits: modify position array, `updateVerticesData`, `createNormals`.
- Ground splat textures upload with flipY: canvas top row (y=0) → world z=+8000. Mapping is `(0.5 - y/H) * SIZE` (this bug was caught and fixed — T6 C1).
- `MeshBuilder.DOUBLESIDE` doesn't exist — `Mesh.DOUBLESIDE` (needed for T15 interior panels).
- WebGPU engine reports no GL renderer string — main.ts passes `gpu: "WebGPU-capable"` so detectTier doesn't misclassify. Keep.
- Known deferred visual risks (one-boolean fixes at the browser gate): Earth RawTexture `invertY=false` possible N/S flip; flag texture mirroring on VAB façade; trench mouth slab protrusion (visual-gate checklist in ledger); WebGPU GLSL transpile (WebGL2 fallback documented).

## 6. Per-task dispatch guidance for the remaining work

**Task 12 — mission runtime wiring (NEXT).** Brief: `$WS/task-12-brief.md`. Key guidance:
- New `space-sim/mission/runtime.ts` per brief: `createMissionRuntime(deps)` mapping MissionSinks → world (onShot→director.playShot, onTransition→director.cut, onCommand→flight/exhaust/ml/smoke, onFx→sky.applyFx, onComms/onHud/onState→UiSinks).
- Command mapping: `ignite` → exhaust.ignite(true) + smoke.ramp(1) + armRetract timer → `ml.retractArms(min(1, t/3))`; `liftoff` → flight.liftoff(); `separateSrb`/`separateCore`/`orbitInsertion` → flight methods; dock*/openHatch/enterInterior/enablePlayer → no-op (Tasks 14–16).
- Flight clock: `const tFlight = flight.liftoffTime >= 0 ? engine.t - flight.liftoffTime : -1;` → `flight.update(tFlight, dt)`. Per frame: engine.update(dt) → flight → exhaust.update(dt, flight.currentAltitude) → smoke.update(dt) → sky.setAltitude(flight.currentAltitude) → arm retract → director.update(engine.t, engine.current, engine.t). `engine.stateDurations = STATE_DURATIONS;` after constructing MissionEngine (import from mission/engine.ts).
- Constructor signatures to match: `new FlightModel(sls)` (NO scene), `new CinematicDirector(shotLibrary, scene, new TransitionLayer(uiLayerEl))`, `new ExhaustSystem(scene, sls.enginesNode, caps.maxParticles, caps.gpuParticles)`, `new GroundSmoke(scene, new Vector3(0,16,-70), caps.maxParticles, caps.gpuParticles)` — verify against repo files and adapt.
- UiSinks interim noop; expose `skipTo(state)`; dev-only `?skip=<MISSION_STATE>` URL param behind `import.meta.env.DEV` (this substitutes for the visual gate) — also support `?skip=COUNTDOWN` style values for later tasks.
- World already returns `{ tier, sky, earth, ml, sls, flight, exhaust, smoke, shotLibrary, crewQuarters }` (verified at HEAD). Wire mission into the render loop at the marked `// Task 12: mission.update(dt) wires here` line. **After review passes, run `npm run build` once (checkpoint) and hand the user a browser checklist** (loading → establishing shots → countdown at `?skip=COUNTDOWN` → ignition plume lights pad → liftoff pitch-over → SRB tumble → orbit Earth).

**Task 13 — ISS exterior.** Kit-bash builder at ISS orbit origin `(0, 6371000+400000, 0)`; 109 m truss along X, 8 solar wings, radiators, 10 pressurized modules on Z axis, PMA-2/IDA at Destiny forward (−Z) = `dockingPort` node at local `(0,-2.5,-11.4)`. Register `targetProviders.iss = () => iss.root`. Remove the brief's no-op `box.lookAt` line and unused `Mesh` import. Watch for `Mesh.DOUBLESIDE` if needed.

**Task 14 — docking telemetry (TDD) + sequence.** Pure `dockingTelemetry(relPos, relVel)` (range/closure/lateral/alignErrorDeg/phase thresholds: <30 approach, <0.6 contact, <0.45 captured, <−0.5 hardDocked) + `DockingSequence` class driving orionNode from +Z 200 m → contact with decelerating ease (`setProgress(k)`), `contact()/capture()/hardDock()` set positions (0,0,0.5)/(0,0,-0.2)/(0,0,-0.4). Runtime: parent orionNode to issRoot at ISS_REVEAL entry (offset (0,2.5,200)), `setProgress(k)` across ISS_APPROACH+DOCKING_SEQUENCE, map dockContact/dockCapture/dockHard commands. Store `lastTelemetry` on runtime for Task 19's HUD (no console.log in committed code).

**Task 15 — ISS interior + Cupola.** Interior tubes INSIDE exterior modules (route Harmony z≈6.4 → Unity 0 → Destiny −7 → Cupola nadir below Tranquility), 12 wall panels/tube with `Mesh.DOUBLESIDE`, handrails every 1.5 m, rack walls with laptops/bags/labels, practical PointLights, Cupola with 7 window frames + translucent shell, spawn at Harmony vestibule, `colliders: BoxCollider[]` exported for Task 16, `cupolaLook` vector. Register `targetProviders.issInterior = () => interior.spawn`.

**Task 16 — zero-G controller (TDD) + input.** `ZeroGState.step(dt, input, colliders)`: accel 2.5 (boost ×2), damping exp(−2.2·dt), capsule r=0.35 axis-resolve vs colliders, rotation smoothing; tests must pass exactly as brief specifies. `InputManager`: WASD/Space/Ctrl/Shift/E/Esc, pointer lock, `consumeHoldSpace(dt)` (0.7 s hold-to-skip). Runtime: on `enablePlayer` create playerCam at interior.spawn, per-frame transform camera-local thrust to world, mouse deltas → yaw/pitch, position camera from ZeroGState.

**Task 17 — interactions.** `InteractionSystem` (center-ray 2.5 m, `[E] label` DOM prompt): laptops toggle emissive, Destiny lights toggle, Cupola window push, hatch captions. Note the brief's interact.ts was already cleaned in the plan — transcribe the clean version.

**Task 18 — audio.** `AudioBus` (brown-noise engine bed + sub osc, rumble, vent, beeps, clunks, duck, mute) + `speak(CommsLine)` via SpeechSynthesis with per-speaker profiles + squelch/heterodyne bed. Browser limitation ruling: speech CANNOT route through Web Audio — squelch+bed around utterance is the agreed flavor; captions always render (Task 19). Wire commands in runtime (ignite→engine+rumble, comms→beep+speak, dock*→clunk, enterInterior→vent). `unlock()` on first user gesture.

**Task 19 — UI.** `Hud` (phase badge, MET T-/T+ with COUNTDOWN mapping 600·(1−stateLocal/80), 6-stage progress rail, docking telemetry grid, skip hint), `Subtitles` (speaker + typewriter reveal, 6 s), `Menu` (start card BEGIN MISSION/FULLSCREEN, pause Resume/Restart/Skip Cinematic/Exit, error). Runtime ui sinks feed these; ESC pauses; Skip Cinematic = `mission.skipTo(nextMajorState)` with majors `[LAUNCH_PREPARATION, ENGINE_IGNITION, ORBIT, ISS_REVEAL, DOCKING_SEQUENCE, ISS_INTERIOR_INTRO, PLAYER_CONTROL_ENABLED]`; `F` fullscreen; `M` mute. Hud.update must NOT accumulate met while countingDown (setMet drives it — the brief already fixed the double-count).

**Task 20 — robustness + integration + acceptance.** try/catch around world-build dynamic imports; context-loss handler; `?skip` behind `import.meta.env.DEV`; coarse-pointer → low tier + note; prefers-reduced-motion → no wobble/shake; update `src/lib/games.ts` mechanics + `src/pages/HomePage.tsx` tagline (~line 219) per brief; write `space-sim/README.md`; **run `npm run build` (checkpoint) + full test suite + lint**; give the user the full §10 acceptance browser checklist.

## 7. Rulings already made (do not re-litigate; full list in ledger)

811-sum test excludes ∞ (plan defect fixed); 42 shot ids authoritative; MISSION_INIT has no camera pool (intended dip-to-black); terrain splat z-flip + 30 m crawlerway (plan corrected); VAB columns between bays at z=76; berm Ø300 normative; trench illusion deferred to visual gate; flight model has no scene param; plume throttle-gated, smoke ramp-gated, tumble via quaternion; 4 RS-25 bells square pattern; browser visual gates deferred to human partner (headless device).

## 8. Definition of done

Spec §10 acceptance sequence works in the user's browser with no broken transitions: start → KSC establishing → prep → crew → countdown → ignition → liftoff → ascent + 2 stagings → orbit → ISS reveal → approach → docking → transfer → hatch → interior → PLAYER CONTROL ENABLED → zero-G to Cupola. Then final review, then merge decision belongs to the user.
