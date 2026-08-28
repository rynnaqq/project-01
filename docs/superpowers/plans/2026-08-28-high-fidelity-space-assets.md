# High-Fidelity 3D Space Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade all 3D assets (Multi-Stage Rocket, Earth Environment & Atmosphere, Launch Pad & Umbilical Tower, ISS Exterior Station, and ISS Interior & Cupola Module) to ultra high-fidelity quality with rich procedural geometry, high-resolution procedural PBR canvas textures, realistic lighting, and detailed components.

**Architecture:** A standalone procedural texture synthesis engine (`textureGenerator.ts`) produces 2K/4K PBR albedo, roughness, metallic, emissive, and normal bump maps dynamically. The model builders in `proceduralModels.ts` use these textures alongside high-subdivision Babylon.js geometries (lattice trusses, engine manifolds, grid fins, solar panels, radiators, ISPR payload racks, and handrails) to deliver AAA-level visuals.

**Tech Stack:** TypeScript, Babylon.js 9.x (`@babylonjs/core`), HTML5 Canvas 2D Texture Synthesis, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-28-high-fidelity-space-assets-design.md`

## Global Constraints
- Target 60 FPS in WebGL2 environment.
- 100% self-contained: no external CDN asset dependencies or third-party image URLs that could fail or suffer from CORS.
- Retain all public exported interfaces (`RocketModel`, `LaunchPadModel`, `ISSModel`, `ISSInteriorModel`, `buildRocket`, `buildLaunchPad`, `buildEarthEnvironment`, `buildISS`, `buildISSInterior`) and compatibility with existing scene orchestrators (`LaunchPadScene`, `AscentScene`, `OrbitDockingScene`, `ISSInteriorScene`).
- Full unit test coverage in Vitest without regression.

---

### Task 1: Procedural PBR Texture Generator Module

**Files:**
- Create: `space-sim/rendering/textureGenerator.ts`
- Modify: `space-sim/spaceSim.test.ts`

**Interfaces:**
- Produces:
  - `createEarthAlbedoTexture(scene: Scene): DynamicTexture`
  - `createEarthCloudTexture(scene: Scene): DynamicTexture`
  - `createCosmicSkyTexture(scene: Scene): DynamicTexture`
  - `createRocketLiveryTexture(scene: Scene): DynamicTexture`
  - `createISSSolarPanelTexture(scene: Scene): DynamicTexture`
  - `createISSGoldFoilTexture(scene: Scene): DynamicTexture`
  - `createISPRRackTexture(scene: Scene): DynamicTexture`
  - `createConsoleScreenTexture(scene: Scene, title: string, readouts: string[]): DynamicTexture`
  - `createLaunchPadConcreteTexture(scene: Scene): DynamicTexture`

- [ ] **Step 1: Write tests for textureGenerator**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `textureGenerator.ts` with high-resolution canvas synthesis**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 2: Ultra High-Fidelity Rocket Model Builder

**Files:**
- Modify: `space-sim/rendering/proceduralModels.ts`
- Test: `space-sim/spaceSim.test.ts`

**Interfaces:**
- Consumes: `createRocketLiveryTexture` from `textureGenerator.ts`
- Produces: `buildRocket(scene: Scene): RocketModel` (Booster Stage 1 with 9 Octaweb engines, turbopumps, titanium grid fins, landing legs, interstage pushers, Stage 2 vacuum engine, Dragon capsule with heatshield tiles and RCS Draco thruster quads).

- [ ] **Step 1: Write unit tests for enhanced `buildRocket` geometry & hierarchy**
- [ ] **Step 2: Run test to verify it fails or runs baseline**
- [ ] **Step 3: Implement enhanced `buildRocket` in `proceduralModels.ts`**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 3: Photorealistic Earth & Atmospheric Environment

**Files:**
- Modify: `space-sim/rendering/proceduralModels.ts`
- Test: `space-sim/spaceSim.test.ts`

**Interfaces:**
- Consumes: `createEarthAlbedoTexture`, `createEarthCloudTexture`, `createCosmicSkyTexture` from `textureGenerator.ts`
- Produces: `buildEarthEnvironment(scene: Scene): { root: TransformNode; earth: Mesh; atmosphere: Mesh; starfield: Mesh }` (High-subdivision Earth with specular ocean mask, dynamic cloud shell, Rayleigh/Mie atmospheric limb glow shells, cosmic starfield).

- [ ] **Step 1: Write unit tests for `buildEarthEnvironment`**
- [ ] **Step 2: Implement photorealistic Earth, dynamic cloud layer, and atmospheric halo**
- [ ] **Step 3: Run test to verify it passes**
- [ ] **Step 4: Commit**

---

### Task 4: High-Detail Launch Pad & Umbilical Service Tower

**Files:**
- Modify: `space-sim/rendering/proceduralModels.ts`
- Test: `space-sim/spaceSim.test.ts`

**Interfaces:**
- Consumes: `createLaunchPadConcreteTexture` from `textureGenerator.ts`
- Produces: `buildLaunchPad(scene: Scene): LaunchPadModel` (3D steel lattice umbilical tower, elevator frame, cryo pipes, crew access arm with White Room, 4 hold-down hydraulic clamps, flame deflector trench).

- [ ] **Step 1: Write unit tests for `buildLaunchPad`**
- [ ] **Step 2: Implement high-detail launch pad in `proceduralModels.ts`**
- [ ] **Step 3: Run test to verify it passes**
- [ ] **Step 4: Commit**

---

### Task 5: Modular Photorealistic ISS Exterior

**Files:**
- Modify: `space-sim/rendering/proceduralModels.ts`
- Test: `space-sim/spaceSim.test.ts`

**Interfaces:**
- Consumes: `createISSSolarPanelTexture`, `createISSGoldFoilTexture` from `textureGenerator.ts`
- Produces: `buildISS(scene: Scene): ISSModel` (Integrated Truss Structure with open lattice segments, 8 solar array wings with photovoltaic textures and gold kapton backing, thermal radiators, Zarya, Zvezda, Destiny, Unity, Harmony, Tranquility, Columbus, Kibo, Canadarm2, IDA docking port).

- [ ] **Step 1: Write unit tests for `buildISS`**
- [ ] **Step 2: Implement full modular ISS exterior in `proceduralModels.ts`**
- [ ] **Step 3: Run test to verify it passes**
- [ ] **Step 4: Commit**

---

### Task 6: Immersive ISS Interior Lab & Cupola Observatory

**Files:**
- Modify: `space-sim/rendering/proceduralModels.ts`
- Test: `space-sim/spaceSim.test.ts`

**Interfaces:**
- Consumes: `createISPRRackTexture`, `createConsoleScreenTexture` from `textureGenerator.ts`
- Produces: `buildISSInterior(scene: Scene): ISSInteriorModel` (Curved laboratory corridor hull, ISPR equipment payload racks, blue/yellow handrails, overhead LED light panels, active telemetry display monitors, science glovebox, 7-window Cupola observation turret).

- [ ] **Step 1: Write unit tests for `buildISSInterior`**
- [ ] **Step 2: Implement immersive ISS interior & Cupola in `proceduralModels.ts`**
- [ ] **Step 3: Run test to verify it passes**
- [ ] **Step 4: Commit**

---

### Task 7: Integration, Scene Compatibility & Final Verification

**Files:**
- Modify: `space-sim/scenes/LaunchPadScene.ts`
- Modify: `space-sim/scenes/AscentScene.ts`
- Modify: `space-sim/scenes/OrbitDockingScene.ts`
- Modify: `space-sim/scenes/ISSInteriorScene.ts`
- Modify: `space-sim/spaceSim.test.ts`

- [ ] **Step 1: Verify all 4 scenes seamlessly integrate with enhanced models & textures**
- [ ] **Step 2: Run complete Vitest test suite**
- [ ] **Step 3: Build application with Vite and verify clean compilation**
- [ ] **Step 4: Commit**
