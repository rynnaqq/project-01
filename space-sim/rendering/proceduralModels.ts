/**
 * Procedural 3D Mesh and PBR Material Builder for Space Simulator.
 * Creates ultra high-fidelity, photorealistic PBR models for:
 * 1. Multi-stage Rocket (Octaweb 9-engines, titanium grid fins, landing legs, Dragon capsule)
 * 2. Launch Pad & Umbilical Service Tower (Lattice truss, cryo pipes, crew access arm, hold-down clamps)
 * 3. Earth Environment & Atmosphere (High-res continents, specular ocean mask, dynamic cloud shell, Rayleigh halo, cosmic sky)
 * 4. ISS Modular Exterior (Integrated truss, 8 solar array wings, Zarya, Zvezda, Destiny, Columbus, Kibo, Canadarm2, IDA docking)
 * 5. ISS Interior & Cupola Module (ISPR racks, handrails, emissive telemetry LCDs, science glovebox, 7-window observatory)
 */

import {
  Scene,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Color3,
  StandardMaterial,
  TransformNode,
} from '@babylonjs/core';

import {
  createEarthAlbedoTexture,
  createEarthCloudTexture,
  createCosmicSkyTexture,
  createRocketLiveryTexture,
  createISSSolarPanelTexture,
  createISSGoldFoilTexture,
  createISPRRackTexture,
  createConsoleScreenTexture,
  createLaunchPadConcreteTexture,
} from './textureGenerator';

export interface RocketModel {
  root: TransformNode;
  stage1: Mesh;
  stage2: Mesh;
  capsule: Mesh;
  exhaustPoint: TransformNode;
}

export interface LaunchPadModel {
  root: TransformNode;
  tower: Mesh;
  platform: Mesh;
  serviceArm: Mesh;
}

export interface ISSModel {
  root: TransformNode;
  dockingPort: TransformNode;
  truss: Mesh;
  solarPanels: Mesh[];
  modules: Mesh;
  cupola: Mesh;
}

export interface ISSInteriorModel {
  root: TransformNode;
  hull: Mesh;
  colliders: Mesh[];
  interactables: Array<{
    id: string;
    node: TransformNode;
    prompt: string;
    type: 'cupola' | 'panel' | 'experiment';
  }>;
  cupolaTarget: TransformNode;
}

// ==========================================
// 1. ULTRA HIGH-FIDELITY MULTI-STAGE ROCKET
// ==========================================
export function buildRocket(scene: Scene): RocketModel {
  const root = new TransformNode('rocket-root', scene);

  // High-Resolution Livery & Carbon PBR Materials
  const liveryTex = createRocketLiveryTexture(scene);

  const whiteFuselageMat = new PBRMaterial('rocket-fuselage-mat', scene);
  whiteFuselageMat.albedoTexture = liveryTex;
  whiteFuselageMat.metallic = 0.45;
  whiteFuselageMat.roughness = 0.25;

  const carbonMat = new PBRMaterial('rocket-carbon-mat', scene);
  carbonMat.albedoColor = new Color3(0.08, 0.09, 0.11);
  carbonMat.metallic = 0.85;
  carbonMat.roughness = 0.28;

  const titaniumMat = new PBRMaterial('rocket-titanium-mat', scene);
  titaniumMat.albedoColor = new Color3(0.35, 0.38, 0.42);
  titaniumMat.metallic = 0.95;
  titaniumMat.roughness = 0.2;

  const engineNozzleMat = new PBRMaterial('rocket-nozzle-mat', scene);
  engineNozzleMat.albedoColor = new Color3(0.18, 0.20, 0.24);
  engineNozzleMat.metallic = 0.98;
  engineNozzleMat.roughness = 0.15;

  const heatShieldMat = new PBRMaterial('rocket-heatshield-mat', scene);
  heatShieldMat.albedoColor = new Color3(0.05, 0.05, 0.06);
  heatShieldMat.metallic = 0.2;
  heatShieldMat.roughness = 0.65;

  // ----------------------------------------------------
  // Stage 1: Booster Hull (Height 28m, Diameter 3.66m)
  // ----------------------------------------------------
  const stage1 = MeshBuilder.CreateCylinder(
    'stage1-booster',
    { height: 28, diameter: 3.66, tessellation: 48 },
    scene
  );
  stage1.position.y = 14;
  stage1.material = whiteFuselageMat;
  stage1.parent = root;

  // External Conduits / Raceways (2x opposite sides)
  for (const angle of [0, Math.PI]) {
    const raceway = MeshBuilder.CreateBox(`raceway-${angle}`, { width: 0.25, height: 26, depth: 0.35 }, scene);
    raceway.position.set(Math.cos(angle) * 1.9, 0, Math.sin(angle) * 1.9);
    raceway.rotation.y = angle;
    raceway.material = carbonMat;
    raceway.parent = stage1;
  }

  // Titanium Grid Fins (4x 90-degree quadrant fins with lattice structure)
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const finRoot = new TransformNode(`grid-fin-root-${i}`, scene);
    finRoot.position.set(Math.cos(angle) * 1.92, 12, Math.sin(angle) * 1.92);
    finRoot.rotation.y = angle;
    finRoot.parent = stage1;

    // Outer Fin Frame
    const finFrame = MeshBuilder.CreateBox(`fin-frame-${i}`, { width: 0.12, height: 1.8, depth: 1.4 }, scene);
    finFrame.position.x = 0.7;
    finFrame.material = titaniumMat;
    finFrame.parent = finRoot;

    // Inner Grid Lattice Struts
    for (let g = -0.4; g <= 0.4; g += 0.25) {
      const strutH = MeshBuilder.CreateBox(`fin-strut-h-${i}-${g}`, { width: 0.08, height: 0.06, depth: 1.3 }, scene);
      strutH.position.set(0.7, g * 1.5, 0);
      strutH.material = titaniumMat;
      strutH.parent = finRoot;
    }
  }

  // Folded Carbon Fiber Landing Legs (4x around booster base)
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const legA = MeshBuilder.CreateCylinder(`landing-leg-a-${i}`, { height: 7.5, diameter: 0.22, tessellation: 16 }, scene);
    legA.position.set(Math.cos(angle) * 1.95, -9.5, Math.sin(angle) * 1.95);
    legA.material = carbonMat;
    legA.parent = stage1;

    // Aerodynamic base fairing
    const fairing = MeshBuilder.CreateBox(`leg-fairing-${i}`, { width: 0.45, height: 2.2, depth: 0.4 }, scene);
    fairing.position.set(Math.cos(angle) * 1.98, -12.8, Math.sin(angle) * 1.98);
    fairing.rotation.y = angle;
    fairing.material = carbonMat;
    fairing.parent = stage1;
  }

  // Octaweb 9-Engine Cluster Base at y=0
  const exhaustPoint = new TransformNode('exhaust-point', scene);
  exhaustPoint.position.y = 0;
  exhaustPoint.parent = root;

  // Center Merlin Engine Nozzle
  const centerEngine = MeshBuilder.CreateCylinder('nozzle-center', { height: 1.8, diameterTop: 0.7, diameterBottom: 1.5, tessellation: 28 }, scene);
  centerEngine.position.y = 0.9;
  centerEngine.material = engineNozzleMat;
  centerEngine.parent = stage1;

  // 8 Perimeter Octaweb Engines
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const eng = MeshBuilder.CreateCylinder(`nozzle-ring-${i}`, { height: 1.5, diameterTop: 0.55, diameterBottom: 1.25, tessellation: 24 }, scene);
    eng.position.set(Math.cos(angle) * 1.15, 0.75, Math.sin(angle) * 1.15);
    eng.material = engineNozzleMat;
    eng.parent = stage1;

    // Turbopump exhaust manifold pipe
    const manifold = MeshBuilder.CreateCylinder(`manifold-${i}`, { height: 0.8, diameter: 0.12, tessellation: 12 }, scene);
    manifold.position.set(Math.cos(angle) * 0.95, 0.6, Math.sin(angle) * 0.95);
    manifold.material = titaniumMat;
    manifold.parent = stage1;
  }

  // ----------------------------------------------------
  // Interstage Adapter & Stage Separation Pushers
  // ----------------------------------------------------
  const interstage = MeshBuilder.CreateCylinder('interstage-ring', { height: 3.0, diameter: 3.68, tessellation: 48 }, scene);
  interstage.position.y = 29.5;
  interstage.material = carbonMat;
  interstage.parent = root;

  // ----------------------------------------------------
  // Stage 2 (Upper Stage & Vacuum Engine)
  // ----------------------------------------------------
  const stage2 = MeshBuilder.CreateCylinder('stage2', { height: 11.5, diameter: 3.66, tessellation: 48 }, scene);
  stage2.position.y = 36.75;
  stage2.material = whiteFuselageMat;
  stage2.parent = root;

  // Large Vacuum Engine Nozzle (Expansion ratio bell)
  const vacNozzle = MeshBuilder.CreateCylinder('nozzle-vac', { height: 2.8, diameterTop: 0.9, diameterBottom: 2.4, tessellation: 32 }, scene);
  vacNozzle.position.y = -6.2;
  vacNozzle.material = engineNozzleMat;
  vacNozzle.parent = stage2;

  // 4x Cold-gas RCS thruster pods on Stage 2
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const rcs = MeshBuilder.CreateBox(`stage2-rcs-${i}`, { width: 0.3, height: 0.4, depth: 0.3 }, scene);
    rcs.position.set(Math.cos(angle) * 1.88, 4.5, Math.sin(angle) * 1.88);
    rcs.material = titaniumMat;
    rcs.parent = stage2;
  }

  // ----------------------------------------------------
  // Dragon Command Capsule & Trunk (y = 42.5 to y = 50.0)
  // ----------------------------------------------------
  // Trunk with integrated solar cells and aerodynamic fins
  const trunk = MeshBuilder.CreateCylinder('capsule-trunk', { height: 4.8, diameterTop: 3.4, diameterBottom: 3.66, tessellation: 48 }, scene);
  trunk.position.y = 44.9;
  trunk.material = carbonMat;
  trunk.parent = root;

  // Trunk aerodynamic stabilizer finlets (2x)
  for (const fAngle of [-Math.PI / 2, Math.PI / 2]) {
    const trunkFin = MeshBuilder.CreateBox(`trunk-fin-${fAngle}`, { width: 0.1, height: 3.5, depth: 1.1 }, scene);
    trunkFin.position.set(0, 0, Math.sin(fAngle) * 2.1);
    trunkFin.material = carbonMat;
    trunkFin.parent = trunk;
  }

  // Capsule Base Heatshield
  const heatshield = MeshBuilder.CreateCylinder('capsule-heatshield', { height: 0.4, diameter: 3.42, tessellation: 48 }, scene);
  heatshield.position.y = 47.4;
  heatshield.material = heatShieldMat;
  heatshield.parent = root;

  // Crew Cabin Cone (Dragon body)
  const capsule = MeshBuilder.CreateCylinder('capsule-crew-cone', { height: 4.2, diameterTop: 0.8, diameterBottom: 3.4, tessellation: 48 }, scene);
  capsule.position.y = 49.6;
  capsule.material = whiteFuselageMat;
  capsule.parent = root;

  // SuperDraco Emergency Abort Thruster Pods (4 embedded in capsule hull)
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const pod = MeshBuilder.CreateBox(`superdraco-pod-${i}`, { width: 0.45, height: 0.9, depth: 0.65 }, scene);
    pod.position.set(Math.cos(angle) * 1.5, -0.6, Math.sin(angle) * 1.5);
    pod.rotation.y = angle;
    pod.material = carbonMat;
    pod.parent = capsule;
  }

  // Nosecone Docking Hatch Cap
  const noseCap = MeshBuilder.CreateSphere('capsule-nose-cap', { diameter: 0.82, segments: 24 }, scene);
  noseCap.position.y = 2.1;
  noseCap.material = titaniumMat;
  noseCap.parent = capsule;

  return { root, stage1, stage2, capsule, exhaustPoint };
}

// ==========================================
// 2. HIGH-DETAIL LAUNCH PAD & SERVICE TOWER
// ==========================================
export function buildLaunchPad(scene: Scene): LaunchPadModel {
  const root = new TransformNode('launch-pad-root', scene);

  // Materials
  const concreteTex = createLaunchPadConcreteTexture(scene);
  const concreteMat = new PBRMaterial('pad-concrete-pbr', scene);
  concreteMat.albedoTexture = concreteTex;
  concreteMat.metallic = 0.15;
  concreteMat.roughness = 0.85;

  const steelMat = new PBRMaterial('pad-steel-pbr', scene);
  steelMat.albedoColor = new Color3(0.62, 0.65, 0.68);
  steelMat.metallic = 0.92;
  steelMat.roughness = 0.32;

  const darkSteelMat = new PBRMaterial('pad-dark-steel', scene);
  darkSteelMat.albedoColor = new Color3(0.2, 0.22, 0.25);
  darkSteelMat.metallic = 0.9;
  darkSteelMat.roughness = 0.4;

  const yellowCraneMat = new PBRMaterial('pad-crane-yellow', scene);
  yellowCraneMat.albedoColor = new Color3(0.95, 0.72, 0.1);
  yellowCraneMat.metallic = 0.6;
  yellowCraneMat.roughness = 0.35;

  // ----------------------------------------------------
  // Heavy Concrete Launch Platform & Blast Trench
  // ----------------------------------------------------
  const platform = MeshBuilder.CreateBox('launch-platform', { width: 44, depth: 44, height: 4.5 }, scene);
  platform.position.y = 2.25;
  platform.material = concreteMat;
  platform.parent = root;

  // Deep Flame Blast Trench
  const trench = MeshBuilder.CreateBox('blast-trench', { width: 14, depth: 48, height: 6 }, scene);
  trench.position.set(0, 1.8, 0);
  trench.material = darkSteelMat;
  trench.parent = root;

  // Water Deluge Sound Suppression Manifolds (4 large industrial pipes)
  for (const dx of [-6.5, 6.5]) {
    const waterPipe = MeshBuilder.CreateCylinder(`water-pipe-${dx}`, { height: 38, diameter: 0.9, tessellation: 20 }, scene);
    waterPipe.rotation.x = Math.PI / 2;
    waterPipe.position.set(dx, 4.8, 0);
    waterPipe.material = steelMat;
    waterPipe.parent = root;
  }

  // ----------------------------------------------------
  // 4x Hydraulic Hold-Down Clamps with Release Latches
  // ----------------------------------------------------
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const clampRoot = new TransformNode(`clamp-assembly-${i}`, scene);
    clampRoot.position.set(Math.cos(angle) * 3.4, 4.5, Math.sin(angle) * 3.4);
    clampRoot.rotation.y = angle;
    clampRoot.parent = root;

    // Main Clamp Body
    const clampPillar = MeshBuilder.CreateBox(`clamp-pillar-${i}`, { width: 1.6, depth: 1.8, height: 4.2 }, scene);
    clampPillar.position.y = 1.5;
    clampPillar.material = darkSteelMat;
    clampPillar.parent = clampRoot;

    // Articulated Hold-Down Claw
    const claw = MeshBuilder.CreateBox(`clamp-claw-${i}`, { width: 0.9, depth: 1.2, height: 1.0 }, scene);
    claw.position.set(0, 3.4, -0.6);
    claw.material = yellowCraneMat;
    claw.parent = clampRoot;
  }

  // ----------------------------------------------------
  // 3D Lattice Umbilical Service Tower (Height 68m)
  // ----------------------------------------------------
  const tower = MeshBuilder.CreateBox('umbilical-tower', { width: 6.2, depth: 6.2, height: 68 }, scene);
  tower.position.set(-10.5, 36, 0);
  tower.material = steelMat;
  tower.parent = root;

  // Internal Cross-Lattice Framework Bracing on Tower
  for (let ty = 6; ty <= 60; ty += 9) {
    const walkway = MeshBuilder.CreateBox(`tower-walkway-${ty}`, { width: 7.2, depth: 7.2, height: 0.4 }, scene);
    walkway.position.set(0, ty - 34, 0);
    walkway.material = darkSteelMat;
    walkway.parent = tower;

    // Diagonal Cross Brace Rods
    const brace1 = MeshBuilder.CreateCylinder(`brace-1-${ty}`, { height: 10.5, diameter: 0.15, tessellation: 12 }, scene);
    brace1.rotation.z = Math.PI / 4;
    brace1.position.set(0, ty - 34 + 4.5, 3.1);
    brace1.material = steelMat;
    brace1.parent = tower;
  }

  // Cryogenic Propellant Pipe Line Runs (LOX & RP-1 conduits running up tower)
  const loxPipe = MeshBuilder.CreateCylinder('lox-cryo-pipe', { height: 64, diameter: 0.55, tessellation: 16 }, scene);
  loxPipe.position.set(2.8, 0, -2.8);
  loxPipe.material = steelMat;
  loxPipe.parent = tower;

  // Lightning Protection Mast on top of tower
  const lightningRod = MeshBuilder.CreateCylinder('lightning-rod', { height: 14, diameterTop: 0.05, diameterBottom: 0.6, tessellation: 16 }, scene);
  lightningRod.position.set(0, 41, 0);
  lightningRod.material = steelMat;
  lightningRod.parent = tower;

  // ----------------------------------------------------
  // Articulated Crew Access Arm & White Room
  // ----------------------------------------------------
  const armPivot = new TransformNode('crew-arm-pivot', scene);
  armPivot.position.set(-10.5, 52, 0);
  armPivot.parent = root;

  const serviceArm = MeshBuilder.CreateBox('service-arm', { width: 10.5, depth: 2.8, height: 3.2 }, scene);
  serviceArm.position.set(5.25, 0, 0);
  serviceArm.material = steelMat;
  serviceArm.parent = armPivot;

  // Enclosed White Room at arm end
  const whiteRoom = MeshBuilder.CreateBox('white-room', { width: 3.8, depth: 3.4, height: 3.6 }, scene);
  whiteRoom.position.set(4.8, 0, 0);
  whiteRoom.material = yellowCraneMat;
  whiteRoom.parent = serviceArm;

  // Wide ground terrain
  const terrain = MeshBuilder.CreateGround('ground-terrain', { width: 600, height: 600, subdivisions: 6 }, scene);
  terrain.position.y = 0;
  terrain.material = concreteMat;
  terrain.parent = root;

  return { root, tower, platform, serviceArm };
}

// ==========================================
// 3. PHOTOREALISTIC EARTH & ATMOSPHERE
// ==========================================
export function buildEarthEnvironment(scene: Scene): {
  root: TransformNode;
  earth: Mesh;
  atmosphere: Mesh;
  starfield: Mesh;
} {
  const root = new TransformNode('earth-env-root', scene);

  // 1. Earth Sphere with High-Res Multi-Layer Textures
  const earthMat = new PBRMaterial('earth-pbr-mat', scene);
  const earthAlbedoTex = createEarthAlbedoTexture(scene);
  earthMat.albedoTexture = earthAlbedoTex;
  earthMat.metallic = 0.02;
  earthMat.roughness = 0.35; // Glossy oceans, matte continents
  earthMat.emissiveColor = new Color3(0.9, 0.85, 0.7); // Highlights city lights
  earthMat.emissiveTexture = earthAlbedoTex;

  const earth = MeshBuilder.CreateSphere('earth-sphere', { diameter: 2400, segments: 96 }, scene);
  earth.position.set(0, -1250, 400);
  earth.material = earthMat;
  earth.parent = root;

  // 2. Dynamic Rotating Cloud Layer Shell
  const cloudMat = new StandardMaterial('earth-clouds-mat', scene);
  const cloudTex = createEarthCloudTexture(scene);
  cloudMat.diffuseTexture = cloudTex;
  cloudMat.opacityTexture = cloudTex;
  cloudMat.alpha = 0.85;
  cloudMat.backFaceCulling = false;

  const cloudShell = MeshBuilder.CreateSphere('earth-clouds-shell', { diameter: 2420, segments: 96 }, scene);
  cloudShell.position = earth.position;
  cloudShell.material = cloudMat;
  cloudShell.parent = root;

  // Register smooth independent orbital cloud rotation
  scene.registerBeforeRender(() => {
    cloudShell.rotation.y += 0.00015;
  });

  // 3. Atmospheric Rayleigh & Mie Scattering Horizon Halo
  const atmoMat = new StandardMaterial('atmosphere-glow-mat', scene);
  atmoMat.emissiveColor = new Color3(0.18, 0.65, 1.0); // Cyan-blue horizon glow
  atmoMat.alpha = 0.38;
  atmoMat.backFaceCulling = false;

  const atmosphere = MeshBuilder.CreateSphere('atmosphere-shell', { diameter: 2470, segments: 64 }, scene);
  atmosphere.position = earth.position;
  atmosphere.material = atmoMat;
  atmosphere.parent = root;

  // 4. Outer Cosmic Exosphere Twilight Glow
  const exosphereMat = new StandardMaterial('exosphere-glow-mat', scene);
  exosphereMat.emissiveColor = new Color3(0.45, 0.25, 0.85); // Violet twilight rim
  exosphereMat.alpha = 0.18;
  exosphereMat.backFaceCulling = false;

  const exosphere = MeshBuilder.CreateSphere('exosphere-shell', { diameter: 2510, segments: 48 }, scene);
  exosphere.position = earth.position;
  exosphere.material = exosphereMat;
  exosphere.parent = root;

  // 5. Deep Space Celestial Sky Dome (Nebula dust, Milky Way, 2500+ stars)
  const starMat = new StandardMaterial('starfield-cosmic-mat', scene);
  const starTex = createCosmicSkyTexture(scene);
  starMat.emissiveTexture = starTex;
  starMat.disableLighting = true;
  starMat.backFaceCulling = false;

  const starfield = MeshBuilder.CreateSphere('starfield-dome', { diameter: 6000, segments: 36 }, scene);
  starfield.material = starMat;
  starfield.parent = root;

  return { root, earth, atmosphere, starfield };
}

// ==========================================
// 4. MODULAR PHOTOREALISTIC ISS EXTERIOR
// ==========================================
export function buildISS(scene: Scene): ISSModel {
  const root = new TransformNode('iss-root', scene);

  // Materials
  const solarTex = createISSSolarPanelTexture(scene);
  const goldFoilTex = createISSGoldFoilTexture(scene);

  const hullMat = new PBRMaterial('iss-hull-mat', scene);
  hullMat.albedoColor = new Color3(0.92, 0.94, 0.98);
  hullMat.metallic = 0.85;
  hullMat.roughness = 0.22;

  const russianHullMat = new PBRMaterial('iss-russian-hull', scene);
  russianHullMat.albedoColor = new Color3(0.72, 0.76, 0.74);
  russianHullMat.metallic = 0.8;
  russianHullMat.roughness = 0.3;

  const trussMat = new PBRMaterial('iss-truss-mat', scene);
  trussMat.albedoColor = new Color3(0.68, 0.72, 0.76);
  trussMat.metallic = 0.92;
  trussMat.roughness = 0.28;

  const solarMat = new PBRMaterial('iss-solar-pbr', scene);
  solarMat.albedoTexture = solarTex;
  solarMat.metallic = 0.95;
  solarMat.roughness = 0.12;

  const goldMat = new PBRMaterial('iss-foil-pbr', scene);
  goldMat.albedoTexture = goldFoilTex;
  goldMat.metallic = 0.9;
  goldMat.roughness = 0.18;

  const radiatorMat = new PBRMaterial('iss-radiator-mat', scene);
  radiatorMat.albedoColor = new Color3(0.96, 0.96, 0.98);
  radiatorMat.metallic = 0.3;
  radiatorMat.roughness = 0.4;

  // ----------------------------------------------------
  // Integrated Truss Structure (ITS S0, S1, P1, S3/S4, P3/P4)
  // ----------------------------------------------------
  const truss = MeshBuilder.CreateBox('iss-main-truss', { width: 36, height: 1.6, depth: 1.6 }, scene);
  truss.position.set(0, 0, 0);
  truss.material = trussMat;
  truss.parent = root;

  // Solar Alpha Rotary Joints (SARJ) on Port & Starboard
  for (const sjX of [-11, 11]) {
    const sarj = MeshBuilder.CreateCylinder(`sarj-${sjX}`, { height: 1.2, diameter: 2.2, tessellation: 28 }, scene);
    sarj.rotation.z = Math.PI / 2;
    sarj.position.set(sjX, 0, 0);
    sarj.material = trussMat;
    sarj.parent = truss;
  }

  // Deployable Thermal Control Radiators (3 large accordion assemblies)
  for (const rx of [-4, 0, 4]) {
    const rad = MeshBuilder.CreateBox(`radiator-panel-${rx}`, { width: 2.2, height: 0.1, depth: 7.5 }, scene);
    rad.position.set(rx, 1.2, -4.5);
    rad.material = radiatorMat;
    rad.parent = truss;
  }

  // ----------------------------------------------------
  // 8 Solar Array Wings (SAW) with Mast Struts
  // ----------------------------------------------------
  const solarPanels: Mesh[] = [];
  const panelPositions = [-16, -13, 13, 16];

  for (const px of panelPositions) {
    // Upper Dual-Blanket Wing
    const pTop = MeshBuilder.CreateBox(`solar-wing-top-${px}`, { width: 2.8, height: 11.5, depth: 0.1 }, scene);
    pTop.position.set(px, 6.4, 0);
    pTop.material = solarMat;
    pTop.parent = truss;
    solarPanels.push(pTop);

    // Mast deployment canister
    const mastTop = MeshBuilder.CreateCylinder(`mast-top-${px}`, { height: 11.5, diameter: 0.25, tessellation: 12 }, scene);
    mastTop.position.set(px, 6.4, 0.12);
    mastTop.material = goldMat;
    mastTop.parent = truss;

    // Lower Dual-Blanket Wing
    const pBot = MeshBuilder.CreateBox(`solar-wing-bot-${px}`, { width: 2.8, height: 11.5, depth: 0.1 }, scene);
    pBot.position.set(px, -6.4, 0);
    pBot.material = solarMat;
    pBot.parent = truss;
    solarPanels.push(pBot);

    const mastBot = MeshBuilder.CreateCylinder(`mast-bot-${px}`, { height: 11.5, diameter: 0.25, tessellation: 12 }, scene);
    mastBot.position.set(px, -6.4, 0.12);
    mastBot.material = goldMat;
    mastBot.parent = truss;
  }

  // ----------------------------------------------------
  // Pressurized Laboratory & Habitation Modules Complex
  // ----------------------------------------------------
  // Central US Lab Spine (Destiny, Unity Node 1, Harmony Node 2)
  const centralSpine = MeshBuilder.CreateCylinder('module-destiny-spine', { height: 16, diameter: 4.2, tessellation: 32 }, scene);
  centralSpine.rotation.x = Math.PI / 2;
  centralSpine.position.set(0, -2.0, 3.8);
  centralSpine.material = hullMat;
  centralSpine.parent = root;

  // Russian Segment (Zarya FGB & Zvezda Service Module at aft -Z)
  const zarya = MeshBuilder.CreateCylinder('module-zarya-fgb', { height: 8.5, diameter: 3.8, tessellation: 28 }, scene);
  zarya.rotation.x = Math.PI / 2;
  zarya.position.set(0, -2.0, -8.0);
  zarya.material = russianHullMat;
  zarya.parent = root;

  const zvezda = MeshBuilder.CreateCylinder('module-zvezda', { height: 9.2, diameter: 4.0, tessellation: 28 }, scene);
  zvezda.rotation.x = Math.PI / 2;
  zvezda.position.set(0, -2.0, -16.5);
  zvezda.material = russianHullMat;
  zvezda.parent = root;

  // Russian Solar Arrays on Zvezda
  for (const zx of [-5.5, 5.5]) {
    const rusSolar = MeshBuilder.CreateBox(`rus-solar-${zx}`, { width: 6.5, height: 1.8, depth: 0.08 }, scene);
    rusSolar.position.set(zx, -2.0, -16.5);
    rusSolar.material = solarMat;
    rusSolar.parent = root;
  }

  // Transverse International Labs: European Columbus (+X) & Japanese Kibo (-X)
  const columbusLab = MeshBuilder.CreateCylinder('module-columbus-esa', { height: 6.8, diameter: 4.0, tessellation: 28 }, scene);
  columbusLab.rotation.z = Math.PI / 2;
  columbusLab.position.set(4.8, -2.0, 4.2);
  columbusLab.material = goldMat;
  columbusLab.parent = root;

  const kiboLab = MeshBuilder.CreateCylinder('module-kibo-jaxa', { height: 9.5, diameter: 4.2, tessellation: 28 }, scene);
  kiboLab.rotation.z = Math.PI / 2;
  kiboLab.position.set(-6.2, -2.0, 4.2);
  kiboLab.material = hullMat;
  kiboLab.parent = root;

  // Kibo Exposed Facility (JEM-EF) platform
  const jemEf = MeshBuilder.CreateBox('kibo-jem-ef', { width: 3.8, height: 1.2, depth: 3.4 }, scene);
  jemEf.position.set(-11.5, -2.0, 4.2);
  jemEf.material = trussMat;
  jemEf.parent = root;

  // Canadarm2 Articulated Robotic Manipulator Arm
  const armRoot = new TransformNode('canadarm2-root', scene);
  armRoot.position.set(2.0, 0.2, 2.0);
  armRoot.parent = root;

  const armBoom1 = MeshBuilder.CreateCylinder('canadarm-boom-1', { height: 6.2, diameter: 0.35, tessellation: 16 }, scene);
  armBoom1.position.set(0, 3.0, 0);
  armBoom1.material = hullMat;
  armBoom1.parent = armRoot;

  const armBoom2 = MeshBuilder.CreateCylinder('canadarm-boom-2', { height: 6.2, diameter: 0.35, tessellation: 16 }, scene);
  armBoom2.rotation.x = Math.PI / 3;
  armBoom2.position.set(0, 7.5, 2.5);
  armBoom2.material = hullMat;
  armBoom2.parent = armRoot;

  // Cupola Nadir Observation Turret
  const cupola = MeshBuilder.CreateSphere('iss-cupola-dome', { diameter: 2.6, segments: 24 }, scene);
  cupola.position.set(0, -4.2, 5.5);
  cupola.material = hullMat;
  cupola.parent = root;

  // ----------------------------------------------------
  // International Docking Adapter (IDA) & Approach Port
  // ----------------------------------------------------
  const dockingPort = new TransformNode('docking-port-target', scene);
  dockingPort.position.set(0, -2.0, 12.0); // Facing forward along +Z
  dockingPort.parent = root;

  // Pressurized Mating Adapter (PMA) Cone
  const pmaCone = MeshBuilder.CreateCylinder('pma-cone', { height: 2.2, diameterTop: 2.2, diameterBottom: 3.2, tessellation: 28 }, scene);
  pmaCone.rotation.x = Math.PI / 2;
  pmaCone.position.set(0, 0, -1.1);
  pmaCone.material = goldMat;
  pmaCone.parent = dockingPort;

  // IDA Docking Ring
  const dockingRing = MeshBuilder.CreateTorus('docking-ring', { diameter: 2.0, thickness: 0.28, tessellation: 32 }, scene);
  dockingRing.rotation.x = Math.PI / 2;
  dockingRing.material = trussMat;
  dockingRing.parent = dockingPort;

  // 3x Capture Guide Petals
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    const petal = MeshBuilder.CreateBox(`petal-${i}`, { width: 0.35, height: 0.1, depth: 0.6 }, scene);
    petal.position.set(Math.cos(angle) * 0.95, Math.sin(angle) * 0.95, 0.25);
    petal.rotation.z = angle;
    petal.material = trussMat;
    petal.parent = dockingPort;
  }

  // Crosshair Optical Target Reticle
  const targetBarH = MeshBuilder.CreateBox('dock-target-h', { width: 1.4, height: 0.06, depth: 0.06 }, scene);
  targetBarH.material = goldMat;
  targetBarH.parent = dockingPort;

  const targetBarV = MeshBuilder.CreateBox('dock-target-v', { width: 0.06, height: 1.4, depth: 0.06 }, scene);
  targetBarV.material = goldMat;
  targetBarV.parent = dockingPort;

  return { root, dockingPort, truss, solarPanels, modules: centralSpine, cupola };
}

// ==========================================
// 5. IMMERSIVE ISS INTERIOR & CUPOLA MODULE
// ==========================================
export function buildISSInterior(scene: Scene): ISSInteriorModel {
  const root = new TransformNode('iss-interior-root', scene);

  // High-Resolution Materials
  const isprTex = createISPRRackTexture(scene);

  const wallMat = new PBRMaterial('interior-wall-pbr', scene);
  wallMat.albedoColor = new Color3(0.93, 0.95, 0.97);
  wallMat.metallic = 0.35;
  wallMat.roughness = 0.35;
  wallMat.backFaceCulling = false;

  const rackMat = new PBRMaterial('ispr-rack-pbr', scene);
  rackMat.albedoTexture = isprTex;
  rackMat.metallic = 0.65;
  rackMat.roughness = 0.32;

  const blueRailMat = new PBRMaterial('iss-handrail-blue', scene);
  blueRailMat.albedoColor = new Color3(0.1, 0.45, 0.9);
  blueRailMat.metallic = 0.85;
  blueRailMat.roughness = 0.25;

  const yellowRailMat = new PBRMaterial('iss-handrail-yellow', scene);
  yellowRailMat.albedoColor = new Color3(0.95, 0.75, 0.1);
  yellowRailMat.metallic = 0.85;
  yellowRailMat.roughness = 0.25;

  const cupolaGlassMat = new PBRMaterial('cupola-glass-pbr', scene);
  cupolaGlassMat.albedoColor = new Color3(0.08, 0.25, 0.45);
  cupolaGlassMat.alpha = 0.25;
  cupolaGlassMat.metallic = 0.1;
  cupolaGlassMat.roughness = 0.02;

  // ----------------------------------------------------
  // Main Cylindrical Laboratory Corridor (Length 26m)
  // ----------------------------------------------------
  const hull = MeshBuilder.CreateBox('lab-corridor-hull', { width: 3.6, height: 3.6, depth: 26 }, scene);
  hull.position.set(0, 0, 0);
  hull.material = wallMat;
  hull.parent = root;

  // Bulkhead Structural Ribs
  for (let z = -12; z <= 12; z += 3.5) {
    const rib = MeshBuilder.CreateTorus(`bulkhead-rib-${z}`, { diameter: 4.2, thickness: 0.25, tessellation: 24 }, scene);
    rib.position.set(0, 0, z);
    rib.material = wallMat;
    rib.parent = root;
  }

  // Overhead LED Light Panels
  for (let z = -10; z <= 10; z += 3.5) {
    const ledFixture = MeshBuilder.CreateBox(`led-fixture-${z}`, { width: 1.4, height: 0.08, depth: 2.2 }, scene);
    ledFixture.position.set(0, 1.72, z);
    const ledMat = new PBRMaterial(`led-pbr-${z}`, scene);
    ledMat.emissiveColor = new Color3(0.98, 0.98, 1.0);
    ledMat.albedoColor = new Color3(1, 1, 1);
    ledFixture.material = ledMat;
    ledFixture.parent = root;
  }

  // Astronaut Guide Handrails (Floor & Ceiling paths)
  for (let z = -10; z <= 10; z += 3.5) {
    // Floor blue handrail
    const railF = MeshBuilder.CreateCylinder(`rail-f-${z}`, { height: 2.5, diameter: 0.05, tessellation: 12 }, scene);
    railF.rotation.x = Math.PI / 2;
    railF.position.set(0, -1.68, z);
    railF.material = blueRailMat;
    railF.parent = root;

    // Ceiling yellow handrail
    const railC = MeshBuilder.CreateCylinder(`rail-c-${z}`, { height: 2.5, diameter: 0.05, tessellation: 12 }, scene);
    railC.rotation.x = Math.PI / 2;
    railC.position.set(0.6, 1.65, z);
    railC.material = yellowRailMat;
    railC.parent = root;
  }

  // International Standard Payload Racks (ISPR) along left and right walls
  const colliders: Mesh[] = [];
  for (let z = -10; z <= 10; z += 3.5) {
    // Left Equipment Rack
    const rackL = MeshBuilder.CreateBox(`rack-ispr-l-${z}`, { width: 0.7, height: 2.9, depth: 2.9 }, scene);
    rackL.position.set(-1.42, 0, z);
    rackL.material = rackMat;
    rackL.parent = root;
    colliders.push(rackL);

    // Right Equipment Rack
    const rackR = MeshBuilder.CreateBox(`rack-ispr-r-${z}`, { width: 0.7, height: 2.9, depth: 2.9 }, scene);
    rackR.position.set(1.42, 0, z);
    rackR.material = rackMat;
    rackR.parent = root;
    colliders.push(rackR);
  }

  // ----------------------------------------------------
  // Cupola Observation Turret & 7-Window Observatory Bay
  // ----------------------------------------------------
  const cupolaRoom = MeshBuilder.CreateCylinder('cupola-observatory-room', { height: 4.0, diameter: 4.8, tessellation: 24 }, scene);
  cupolaRoom.position.set(0, -0.6, 14.8);
  cupolaRoom.material = wallMat;
  cupolaRoom.parent = root;

  // Central Circular Observation Window
  const cupolaCenterWindow = MeshBuilder.CreateDisc('cupola-center-window', { radius: 1.4, tessellation: 24 }, scene);
  cupolaCenterWindow.position.set(0, -2.4, 14.8);
  cupolaCenterWindow.rotation.x = Math.PI / 2;
  cupolaCenterWindow.material = cupolaGlassMat;
  cupolaCenterWindow.parent = root;

  // 6 Surrounding Trapezoidal Windows with Metallic Frame
  for (let w = 0; w < 6; w++) {
    const angle = (w * Math.PI) / 3;
    const sideWindow = MeshBuilder.CreatePlane(`cupola-side-win-${w}`, { width: 1.2, height: 1.4 }, scene);
    sideWindow.position.set(Math.cos(angle) * 1.8, -2.0, 14.8 + Math.sin(angle) * 1.8);
    sideWindow.rotation.y = angle + Math.PI / 2;
    sideWindow.rotation.x = Math.PI / 6;
    sideWindow.material = cupolaGlassMat;
    sideWindow.parent = root;
  }

  const cupolaTarget = new TransformNode('cupola-look-target', scene);
  cupolaTarget.position.set(0, -1.8, 14.8);
  cupolaTarget.parent = root;

  // ----------------------------------------------------
  // Interactive Scientific Instrument Consoles & Glovebox
  // ----------------------------------------------------
  const interactables: ISSInteriorModel['interactables'] = [];

  // 1. ECLSS Life Support Workstation (Left wall at z=-4)
  const consoleNode = new TransformNode('console-life-support', scene);
  consoleNode.position.set(-1.0, 0, -4);
  consoleNode.parent = root;

  const eclssTex = createConsoleScreenTexture(
    scene,
    'ECLSS Life Support',
    ['O2: 21.2 kPa [NOMINAL]', 'CO2: 0.32 kPa [OPTIMAL]', 'Cabin Press: 101.3 kPa', 'Water Recov: 99.4% Eff']
  );
  const eclssScreenMat = new PBRMaterial('eclss-screen-pbr', scene);
  eclssScreenMat.emissiveTexture = eclssTex;
  eclssScreenMat.albedoTexture = eclssTex;
  eclssScreenMat.roughness = 0.15;

  const screen1 = MeshBuilder.CreatePlane('console-screen-1', { width: 1.0, height: 0.65 }, scene);
  screen1.rotation.y = Math.PI / 2;
  screen1.position.set(-1.05, 0.15, -4);
  screen1.material = eclssScreenMat;
  screen1.parent = root;

  interactables.push({
    id: 'life-support-console',
    node: consoleNode,
    prompt: 'Inspect ECLSS Life Support Systems',
    type: 'panel',
  });

  // 2. Microgravity Science Glovebox (Right wall at z=4)
  const gloveboxNode = new TransformNode('science-glovebox', scene);
  gloveboxNode.position.set(1.0, 0, 4);
  gloveboxNode.parent = root;

  const labTex = createConsoleScreenTexture(
    scene,
    'Microgravity Lab',
    ['Chamber Temp: 295.2 K', 'Crystal Growth: Active', 'Diffusion: 0.002 mm/s', 'Zero-G Drift: <0.001 G']
  );
  const labScreenMat = new PBRMaterial('lab-screen-pbr', scene);
  labScreenMat.emissiveTexture = labTex;
  labScreenMat.albedoTexture = labTex;
  labScreenMat.roughness = 0.15;

  const screen2 = MeshBuilder.CreatePlane('console-screen-2', { width: 1.0, height: 0.65 }, scene);
  screen2.rotation.y = -Math.PI / 2;
  screen2.position.set(1.05, 0.15, 4);
  screen2.material = labScreenMat;
  screen2.parent = root;

  // Science Chamber Glowing Specimen Box
  const chamber = MeshBuilder.CreateBox('glovebox-chamber', { width: 0.5, height: 0.5, depth: 0.7 }, scene);
  chamber.position.set(1.15, -0.4, 4);
  const chamberMat = new PBRMaterial('chamber-specimen-pbr', scene);
  chamberMat.emissiveColor = new Color3(0.2, 0.9, 0.5);
  chamberMat.albedoColor = new Color3(0.1, 0.4, 0.2);
  chamber.material = chamberMat;
  chamber.parent = root;

  interactables.push({
    id: 'science-glovebox',
    node: gloveboxNode,
    prompt: 'Activate Microgravity Crystal Experiment',
    type: 'experiment',
  });

  // 3. Cupola Observation Deck (at z=14.8)
  interactables.push({
    id: 'cupola-earth-view',
    node: cupolaTarget,
    prompt: 'Look through Cupola Windows at Earth',
    type: 'cupola',
  });

  return { root, hull, colliders, interactables, cupolaTarget };
}
