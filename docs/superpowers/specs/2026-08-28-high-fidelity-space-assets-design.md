# Ultra High-Fidelity 3D Space Assets Design Specification

**Author:** DeepMind Antigravity Team
**Date:** 2026-08-28
**Status:** Approved

## 1. Executive Summary
This design specification defines the architecture, procedural mesh synthesis, dynamic PBR texture generation, and material pipelines to dramatically upgrade the graphical quality of all 3D assets in the Space Simulator application (`space-sim`). The upgrade covers the Multi-Stage Rocket, Earth & Atmosphere Environment, Launch Pad & Umbilical Service Tower, ISS Modular Exterior, and ISS Interior & Cupola Module.

---

## 2. Architecture & Pipeline

### 2.1 Procedural Synthesis vs Asset Bundling
To guarantee zero network latency, immunity against broken external asset links / CORS errors, and direct parametric animation hooks (for staging separation, grid fin actuation, solar panel articulation, and docking ring mechanics), all models are procedurally synthesized using Babylon.js PBR materials, high-polygon geometric primitives, and dynamic multi-layer procedural textures.

### 2.2 Texture Generation Pipeline (`textureGenerator.ts`)
A dedicated texture generator module provides high-resolution 2D Canvas-generated procedural textures for Babylon.js PBR:
1. **Earth Multi-Layer Textures**:
   - `EarthAlbedo`: 2048x1024 / 4096x2048 procedural planetary map with realistic continental contours, biomes (deep oceans, coastal shallows, lush landmasses, mountain relief shading, polar ice caps).
   - `EarthSpecularMask`: Specular roughness mask distinguishing reflective oceans from matte continents.
   - `EarthNightLights`: Golden city illumination clusters distributed realistically across landmasses on the night side.
   - `EarthClouds`: Multi-octave fractal Perlin noise cloud layer with dynamic transparency and soft atmospheric density.
2. **Cosmos & Starfield Texture**:
   - High-density starfield with multi-magnitude stars, diffraction spikes on bright stars, colorful celestial nebulas (magenta, cyan, indigo), and galactic core dust lanes.
3. **Rocket Livery & Thermal Tiles**:
   - High-resolution carbon composite textures, heat shield tile grids, safety markings, panel seams, and livery decals.
4. **ISS Exterior PBR Textures**:
   - Photovoltaic solar array cell grids with cyan-blue specular sheen and gold Kapton foil backing.
   - Multi-layer insulation (MLI) gold/amber wrinkled foil texture.
   - Aluminum hull micrometeoroid shielding plates with rivet patterns and agency insignia.
5. **ISS Interior Science & Telemetry Textures**:
   - International Standard Payload Racks (ISPR) with modular dials, circuit breakers, and switches.
   - High-contrast emissive HUD telemetry monitors (live graph waveforms, orbit vectors, ECLSS status).
6. **Launch Pad & Concrete Textures**:
   - Weathered concrete with scorch marks, warning hazard stripes (yellow/black), and brushed industrial steel.

---

## 3. Detailed Asset Specifications

### 3.1 Multi-Stage Rocket (`buildRocket`)
- **Stage 1 (Booster)**:
  - High-polygon cylindrical hull (`tessellation: 64`) with external raceways and conduits.
  - 9x Merlin-style Octaweb engine cluster: regeneratively cooled engine bells, turbopump exhaust manifolds, and hydraulic gimbal actuators.
  - 4x Titanium Grid Fins: 3D lattice mesh with structural perforation and rotation hinges.
  - 4x Foldable Landing Legs: Aerodynamic external fairings and telescoping hydraulic deployment cylinders.
- **Interstage & Stage 2**:
  - Carbon composite interstage adapter ring with pneumatic stage separation pusher pistons.
  - Stage 2 vacuum engine nozzle with large expansion ratio and niobium stiffening rings.
  - Cold-gas RCS reaction control system thruster clusters.
- **Dragon-Style Command Capsule & Trunk**:
  - Aerodynamic trunk with integrated solar array panels and stabilizing finlets.
  - Pressurized crew cabin with PICA-X heat shield base, 4x SuperDraco thruster pods, Draco RCS quads, and nosecone docking hatch.

### 3.2 Earth, Atmosphere & Cosmic Environment (`buildEarthEnvironment`)
- **Earth Sphere**: High-subdivision sphere (`segments: 96-128`) mapped with the procedural albedo, specular roughness mask, and night-lights emissive layer.
- **Dynamic Cloud Shell**: Dedicated outer sphere (`segments: 96`, `radius: 1.008x`) with fractal cloud noise, rotating smoothly at an independent orbital velocity with alpha blending and depth writing.
- **Rayleigh & Mie Atmospheric Halo**: Double-shell Fresnel glow shader producing cyan-blue horizon limb scattering and warm twilight terminator illumination.
- **Cosmic Starfield**: Celestial sky dome with thousands of stars and multi-spectral nebula dust.

### 3.3 Launch Pad & Umbilical Tower (`buildLaunchPad`)
- **Umbilical Service Tower**: Full 3D steel truss latticework with vertical structural beams, diagonal cross-braces, elevator shafts, cryo pipe runs (LOX/RP-1 lines), and lightning mast.
- **Crew Access Arm**: Articulated access arm with enclosed White Room and umbilical interface.
- **Launch Mount & Flame Trench**: 4-point heavy hold-down clamps with release actuators, water deluge sound suppression manifold pipes, and weathered blast trench.

### 3.4 ISS Exterior Station (`buildISS`)
- **Integrated Truss Structure (ITS)**: Multi-segment open lattice truss (S0, S1, P1, S3/S4, P3/P4) with Solar Alpha Rotary Joints (SARJ) and deployable white ammonia thermal radiator assemblies.
- **Solar Array Wings (SAW)**: 8 massive dual-blanket solar wings with photovoltaic cell texturing, gold kapton backing, and deployable mast canisters.
- **Modular Laboratory Complex**:
  - Zarya FGB & Zvezda Service Module with Russian solar wings and spherical docking compartments.
  - US Destiny Laboratory, Node 1 Unity, Node 2 Harmony, and Node 3 Tranquility.
  - European Columbus Laboratory and Japanese Kibo Module with JEM-EF external exposure platform.
  - Canadarm2 robotic manipulator arm with 6-DOF articulated joint pivots.
  - International Docking Adapter (IDA) ring with visual alignment crossbars and optical retroreflectors.

### 3.5 ISS Interior & Cupola (`buildISSInterior`)
- **Habitation & Lab Corridor**: Curvilinear structural hull with International Standard Payload Racks (ISPR) lining the walls, ceiling, and floor.
- **Astronaut Handrails & Utility Ducts**: Blue and yellow guidance handrails, overhead LED light panels, and ducted ventilation lines.
- **Active Consoles & Science Glovebox**: Emissive telemetry displays and crystal growth experiment chamber.
- **Cupola Observation Module**: 7-window observation turret with metallic frames, rivets, and expansive downward view of Earth and space.

---

## 4. Verification & Testing Strategy
- Unit and integration tests in `spaceSim.test.ts` verifying that all procedural builder functions return well-formed hierarchies, transform nodes, meshes, materials, and interactables without null references or regression.
- Performance profiling to ensure 60 FPS rendering under WebGL2 on target hardware.
