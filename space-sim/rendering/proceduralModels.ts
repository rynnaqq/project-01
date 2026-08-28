/**
 * Procedural 3D Mesh and PBR Material Builder for Space Simulator.
 * Creates optimized, highly-detailed PBR models for:
 * 1. Multi-stage Rocket
 * 2. Launch Pad & Umbilical Tower
 * 3. Earth & Atmosphere
 * 4. ISS Modular Exterior
 * 5. ISS Interior & Cupola Module
 */

import {
  Scene,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Color3,
  StandardMaterial,
  TransformNode,
  DynamicTexture,
} from '@babylonjs/core';

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

export function buildRocket(scene: Scene): RocketModel {
  const root = new TransformNode('rocket-root', scene);

  // Materials
  const bodyMat = new PBRMaterial('rocket-body-mat', scene);
  bodyMat.albedoColor = new Color3(0.95, 0.95, 0.95);
  bodyMat.metallic = 0.6;
  bodyMat.roughness = 0.25;

  const blackMat = new PBRMaterial('rocket-black-mat', scene);
  blackMat.albedoColor = new Color3(0.1, 0.1, 0.12);
  blackMat.metallic = 0.8;
  blackMat.roughness = 0.3;

  const nozzleMat = new PBRMaterial('rocket-nozzle-mat', scene);
  nozzleMat.albedoColor = new Color3(0.2, 0.22, 0.25);
  nozzleMat.metallic = 0.95;
  nozzleMat.roughness = 0.15;

  // Stage 1 (Booster)
  const stage1 = MeshBuilder.CreateCylinder(
    'stage1-booster',
    { height: 28, diameter: 3.6, tessellation: 32 },
    scene
  );
  stage1.position.y = 14;
  stage1.material = bodyMat;
  stage1.parent = root;

  // Grid fins (4x)
  for (let i = 0; i < 4; i++) {
    const fin = MeshBuilder.CreateBox(`fin-${i}`, { width: 0.1, height: 1.6, depth: 1.2 }, scene);
    const angle = (i * Math.PI) / 2;
    fin.position.x = Math.cos(angle) * 1.9;
    fin.position.z = Math.sin(angle) * 1.9;
    fin.position.y = 26;
    fin.rotation.y = angle;
    fin.material = blackMat;
    fin.parent = stage1;
  }

  // Stage 1 Engines (9 Octaweb nozzles)
  const exhaustPoint = new TransformNode('exhaust-point', scene);
  exhaustPoint.position.y = 0;
  exhaustPoint.parent = root;

  const centerNozzle = MeshBuilder.CreateCylinder('nozzle-c', { height: 1.5, diameterTop: 0.8, diameterBottom: 1.4, tessellation: 20 }, scene);
  centerNozzle.position.y = 0.75;
  centerNozzle.material = nozzleMat;
  centerNozzle.parent = stage1;

  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const nozzle = MeshBuilder.CreateCylinder(`nozzle-${i}`, { height: 1.2, diameterTop: 0.6, diameterBottom: 1.1, tessellation: 16 }, scene);
    nozzle.position.x = Math.cos(angle) * 1.1;
    nozzle.position.z = Math.sin(angle) * 1.1;
    nozzle.position.y = 0.6;
    nozzle.material = nozzleMat;
    nozzle.parent = stage1;
  }

  // Interstage ring
  const interstage = MeshBuilder.CreateCylinder('interstage', { height: 2.5, diameter: 3.65, tessellation: 32 }, scene);
  interstage.position.y = 29.25;
  interstage.material = blackMat;
  interstage.parent = root;

  // Stage 2
  const stage2 = MeshBuilder.CreateCylinder('stage2', { height: 12, diameter: 3.6, tessellation: 32 }, scene);
  stage2.position.y = 36.5;
  stage2.material = bodyMat;
  stage2.parent = root;

  // Command Capsule & Nosecone
  const capsule = MeshBuilder.CreateCylinder('capsule-trunk', { height: 4.5, diameterTop: 3.2, diameterBottom: 3.6, tessellation: 32 }, scene);
  capsule.position.y = 44.75;
  capsule.material = blackMat;
  capsule.parent = root;

  const cone = MeshBuilder.CreateCylinder('capsule-nose', { height: 4.0, diameterTop: 0.6, diameterBottom: 3.2, tessellation: 32 }, scene);
  cone.position.y = 49.0;
  cone.material = bodyMat;
  cone.parent = root;

  return { root, stage1, stage2, capsule, exhaustPoint };
}

export function buildLaunchPad(scene: Scene): LaunchPadModel {
  const root = new TransformNode('launch-pad-root', scene);

  const concreteMat = new PBRMaterial('concrete-mat', scene);
  concreteMat.albedoColor = new Color3(0.35, 0.38, 0.4);
  concreteMat.metallic = 0.1;
  concreteMat.roughness = 0.8;

  const towerMat = new PBRMaterial('tower-mat', scene);
  towerMat.albedoColor = new Color3(0.7, 0.72, 0.75);
  towerMat.metallic = 0.85;
  towerMat.roughness = 0.35;

  // Main Concrete Platform & Blast Trench
  const platform = MeshBuilder.CreateBox('launch-platform', { width: 35, depth: 35, height: 4 }, scene);
  platform.position.y = 2;
  platform.material = concreteMat;
  platform.parent = root;

  const trench = MeshBuilder.CreateBox('blast-trench', { width: 12, depth: 40, height: 5 }, scene);
  trench.position.y = 1.5;
  trench.position.z = 0;
  trench.material = concreteMat;
  trench.parent = root;

  // Umbilical Service Tower (Truss structure)
  const tower = MeshBuilder.CreateBox('umbilical-tower', { width: 5, depth: 5, height: 62 }, scene);
  tower.position.set(-9, 33, 0);
  tower.material = towerMat;
  tower.parent = root;

  // Horizontal Crew Access Arm
  const serviceArm = MeshBuilder.CreateBox('service-arm', { width: 9, depth: 2.5, height: 2.8 }, scene);
  serviceArm.position.set(-4.5, 48, 0);
  serviceArm.material = towerMat;
  serviceArm.parent = root;

  // Support clamps (4x)
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const clamp = MeshBuilder.CreateBox(`clamp-${i}`, { width: 1.5, depth: 1.5, height: 3.5 }, scene);
    clamp.position.set(Math.cos(angle) * 3.2, 5.5, Math.sin(angle) * 3.2);
    clamp.material = concreteMat;
    clamp.parent = root;
  }

  // Terrain Base
  const terrain = MeshBuilder.CreateGround('ground-terrain', { width: 400, height: 400, subdivisions: 4 }, scene);
  terrain.position.y = 0;
  terrain.material = concreteMat;
  terrain.parent = root;

  return { root, tower, platform, serviceArm };
}

export function buildEarthEnvironment(scene: Scene): { root: TransformNode; earth: Mesh; atmosphere: Mesh; starfield: Mesh } {
  const root = new TransformNode('earth-env-root', scene);

  // Earth Sphere
  const earthMat = new PBRMaterial('earth-mat', scene);
  earthMat.albedoColor = new Color3(0.12, 0.35, 0.65); // Deep ocean blue
  earthMat.metallic = 0.05;
  earthMat.roughness = 0.7;

  // Procedural Earth surface texture
  const earthTex = new DynamicTexture('earth-surface-tex', { width: 1024, height: 512 }, scene, true);
  const ctx = earthTex.getContext();
  ctx.fillStyle = '#0f3854'; // oceans
  ctx.fillRect(0, 0, 1024, 512);

  // Continents approximation
  ctx.fillStyle = '#2d6a4f';
  // Americas
  ctx.beginPath();
  ctx.arc(280, 200, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(340, 360, 50, 0, Math.PI * 2);
  ctx.fill();
  // Eurasia & Africa
  ctx.beginPath();
  ctx.arc(600, 180, 100, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(580, 290, 70, 0, Math.PI * 2);
  ctx.fill();
  // Australia
  ctx.beginPath();
  ctx.arc(820, 370, 45, 0, Math.PI * 2);
  ctx.fill();

  // Cloud layer swirls
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    ctx.arc((i * 55) % 1024, (i * 37 + 100) % 400, 30 + (i % 20), 0, Math.PI * 2);
    ctx.fill();
  }
  earthTex.update();
  earthMat.albedoTexture = earthTex;

  const earth = MeshBuilder.CreateSphere('earth-sphere', { diameter: 2400, segments: 48 }, scene);
  earth.position.set(0, -1250, 400);
  earth.material = earthMat;
  earth.parent = root;

  // Atmospheric Glow Shell
  const atmoMat = new StandardMaterial('atmosphere-mat', scene);
  atmoMat.emissiveColor = new Color3(0.2, 0.55, 0.95);
  atmoMat.alpha = 0.35;
  atmoMat.backFaceCulling = false;

  const atmosphere = MeshBuilder.CreateSphere('atmosphere-shell', { diameter: 2460, segments: 48 }, scene);
  atmosphere.position = earth.position;
  atmosphere.material = atmoMat;
  atmosphere.parent = root;

  // Starfield Inverted Sky Dome
  const starMat = new StandardMaterial('starfield-mat', scene);
  starMat.emissiveColor = new Color3(1, 1, 1);
  starMat.backFaceCulling = false;

  const starTex = new DynamicTexture('starfield-tex', { width: 512, height: 512 }, scene, true);
  const sCtx = starTex.getContext();
  sCtx.fillStyle = '#020408';
  sCtx.fillRect(0, 0, 512, 512);
  sCtx.fillStyle = '#ffffff';
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = Math.random() < 0.15 ? 1.5 : 0.8;
    sCtx.beginPath();
    sCtx.arc(x, y, r, 0, Math.PI * 2);
    sCtx.fill();
  }
  starTex.update();
  starMat.emissiveTexture = starTex;

  const starfield = MeshBuilder.CreateSphere('starfield', { diameter: 4500, segments: 24 }, scene);
  starfield.material = starMat;
  starfield.parent = root;

  return { root, earth, atmosphere, starfield };
}

export function buildISS(scene: Scene): ISSModel {
  const root = new TransformNode('iss-root', scene);

  // Materials
  const hullMat = new PBRMaterial('iss-hull-mat', scene);
  hullMat.albedoColor = new Color3(0.9, 0.92, 0.95);
  hullMat.metallic = 0.8;
  hullMat.roughness = 0.25;

  const trussMat = new PBRMaterial('iss-truss-mat', scene);
  trussMat.albedoColor = new Color3(0.65, 0.68, 0.72);
  trussMat.metallic = 0.9;
  trussMat.roughness = 0.3;

  const solarMat = new PBRMaterial('iss-solar-mat', scene);
  solarMat.albedoColor = new Color3(0.08, 0.15, 0.35); // Solar cell blue
  solarMat.emissiveColor = new Color3(0.02, 0.05, 0.12);
  solarMat.metallic = 0.95;
  solarMat.roughness = 0.1;

  const goldMat = new PBRMaterial('iss-foil-mat', scene);
  goldMat.albedoColor = new Color3(0.95, 0.75, 0.2); // Thermal insulation gold
  goldMat.metallic = 0.9;
  goldMat.roughness = 0.2;

  // Central Integrated Truss Structure (108 meters scaled ~25m)
  const truss = MeshBuilder.CreateBox('iss-main-truss', { width: 32, height: 1.4, depth: 1.4 }, scene);
  truss.position.set(0, 0, 0);
  truss.material = trussMat;
  truss.parent = root;

  // Solar Array Wings (8 major solar panels)
  const solarPanels: Mesh[] = [];
  const panelPositions = [-14, -10, -6, 6, 10, 14];
  for (const px of panelPositions) {
    // Upper panel
    const pTop = MeshBuilder.CreateBox(`solar-top-${px}`, { width: 3.2, height: 9.5, depth: 0.1 }, scene);
    pTop.position.set(px, 5.2, 0);
    pTop.material = solarMat;
    pTop.parent = truss;
    solarPanels.push(pTop);

    // Lower panel
    const pBot = MeshBuilder.CreateBox(`solar-bot-${px}`, { width: 3.2, height: 9.5, depth: 0.1 }, scene);
    pBot.position.set(px, -5.2, 0);
    pBot.material = solarMat;
    pBot.parent = truss;
    solarPanels.push(pBot);
  }

  // Habitation & Lab Modules (Destiny, Unity, Zvezda, Columbus, Kibo)
  const centralSpine = MeshBuilder.CreateCylinder('module-destiny-unity', { height: 14, diameter: 4.0, tessellation: 24 }, scene);
  centralSpine.rotation.x = Math.PI / 2;
  centralSpine.position.set(0, -1.8, 3.5);
  centralSpine.material = hullMat;
  centralSpine.parent = root;

  // Transverse modules (Columbus & Kibo)
  const crossModule = MeshBuilder.CreateCylinder('module-columbus-kibo', { height: 11, diameter: 3.8, tessellation: 24 }, scene);
  crossModule.rotation.z = Math.PI / 2;
  crossModule.position.set(0, -1.8, 2.0);
  crossModule.material = goldMat;
  crossModule.parent = root;

  // Cupola Observation Dome
  const cupola = MeshBuilder.CreateSphere('iss-cupola-dome', { diameter: 2.4, segments: 16 }, scene);
  cupola.position.set(0, -3.8, 4.5);
  cupola.material = hullMat;
  cupola.parent = root;

  // Docking Port & Target Reticle (Z=0 on the approach corridor)
  const dockingPort = new TransformNode('docking-port-target', scene);
  dockingPort.position.set(0, -1.8, 10.5); // Facing forward along +Z
  dockingPort.parent = root;

  const dockingRing = MeshBuilder.CreateTorus('docking-ring', { diameter: 1.8, thickness: 0.25, tessellation: 24 }, scene);
  dockingRing.rotation.x = Math.PI / 2;
  dockingRing.material = trussMat;
  dockingRing.parent = dockingPort;

  // Alignment crossbars on port
  const targetBarH = MeshBuilder.CreateBox('dock-target-h', { width: 1.2, height: 0.08, depth: 0.08 }, scene);
  targetBarH.material = goldMat;
  targetBarH.parent = dockingPort;

  const targetBarV = MeshBuilder.CreateBox('dock-target-v', { width: 0.08, height: 1.2, depth: 0.08 }, scene);
  targetBarV.material = goldMat;
  targetBarV.parent = dockingPort;

  return { root, dockingPort, truss, solarPanels, modules: centralSpine, cupola };
}

export function buildISSInterior(scene: Scene): ISSInteriorModel {
  const root = new TransformNode('iss-interior-root', scene);

  // Materials
  const interiorWallMat = new PBRMaterial('interior-wall-mat', scene);
  interiorWallMat.albedoColor = new Color3(0.92, 0.93, 0.96);
  interiorWallMat.metallic = 0.3;
  interiorWallMat.roughness = 0.4;
  interiorWallMat.backFaceCulling = false;

  const rackMat = new PBRMaterial('rack-mat', scene);
  rackMat.albedoColor = new Color3(0.4, 0.44, 0.48);
  rackMat.metallic = 0.7;
  rackMat.roughness = 0.35;

  const screenMat = new PBRMaterial('screen-emissive-mat', scene);
  screenMat.albedoColor = new Color3(0.05, 0.15, 0.3);
  screenMat.emissiveColor = new Color3(0.2, 0.6, 0.9);
  screenMat.roughness = 0.2;

  const windowMat = new PBRMaterial('cupola-glass-mat', scene);
  windowMat.albedoColor = new Color3(0.1, 0.3, 0.5);
  windowMat.alpha = 0.3;
  windowMat.roughness = 0.05;

  // Main Laboratory Corridor (Length 24m, Width 3.2m, Height 3.2m)
  const hull = MeshBuilder.CreateBox('lab-corridor-hull', { width: 3.4, height: 3.4, depth: 26 }, scene);
  hull.position.set(0, 0, 0);
  hull.material = interiorWallMat;
  hull.parent = root;

  // Ceiling LED Light strips
  for (let z = -10; z <= 10; z += 4) {
    const lightStrip = MeshBuilder.CreateBox(`led-strip-${z}`, { width: 1.2, height: 0.05, depth: 2.5 }, scene);
    lightStrip.position.set(0, 1.65, z);
    const ledMat = new PBRMaterial(`led-mat-${z}`, scene);
    ledMat.emissiveColor = new Color3(0.95, 0.98, 1.0);
    lightStrip.material = ledMat;
    lightStrip.parent = root;
  }

  // Equipment Racks along left and right walls
  const colliders: Mesh[] = [];
  for (let z = -10; z <= 10; z += 3.5) {
    // Left rack
    const rackL = MeshBuilder.CreateBox(`rack-l-${z}`, { width: 0.6, height: 2.8, depth: 2.8 }, scene);
    rackL.position.set(-1.35, 0, z);
    rackL.material = rackMat;
    rackL.parent = root;
    colliders.push(rackL);

    // Right rack
    const rackR = MeshBuilder.CreateBox(`rack-r-${z}`, { width: 0.6, height: 2.8, depth: 2.8 }, scene);
    rackR.position.set(1.35, 0, z);
    rackR.material = rackMat;
    rackR.parent = root;
    colliders.push(rackR);
  }

  // Cupola Observation Dome Room (at +Z end of corridor)
  const cupolaRoom = MeshBuilder.CreateCylinder('cupola-room', { height: 3.5, diameter: 4.5, tessellation: 16 }, scene);
  cupolaRoom.position.set(0, -0.5, 14.5);
  cupolaRoom.material = interiorWallMat;
  cupolaRoom.parent = root;

  // Cupola Windows (7-window multi-bay bay overlooking Earth)
  const cupolaWindow = MeshBuilder.CreateDisc('cupola-main-window', { radius: 1.8, tessellation: 16 }, scene);
  cupolaWindow.position.set(0, -2.1, 14.5);
  cupolaWindow.rotation.x = Math.PI / 2;
  cupolaWindow.material = windowMat;
  cupolaWindow.parent = root;

  const cupolaTarget = new TransformNode('cupola-look-target', scene);
  cupolaTarget.position.set(0, -1.8, 14.5);
  cupolaTarget.parent = root;

  // Interactable items list
  const interactables: ISSInteriorModel['interactables'] = [];

  // 1. Life Support & Telemetry Console (Left wall at z=-4)
  const consoleNode = new TransformNode('console-life-support', scene);
  consoleNode.position.set(-1.0, 0, -4);
  consoleNode.parent = root;

  const screen1 = MeshBuilder.CreatePlane('console-screen-1', { width: 0.8, height: 0.5 }, scene);
  screen1.rotation.y = Math.PI / 2;
  screen1.position.set(-0.95, 0.1, -4);
  screen1.material = screenMat;
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

  const screen2 = MeshBuilder.CreatePlane('console-screen-2', { width: 0.8, height: 0.5 }, scene);
  screen2.rotation.y = -Math.PI / 2;
  screen2.position.set(0.95, 0.1, 4);
  screen2.material = screenMat;
  screen2.parent = root;

  interactables.push({
    id: 'science-glovebox',
    node: gloveboxNode,
    prompt: 'Activate Microgravity Crystal Experiment',
    type: 'experiment',
  });

  // 3. Cupola Earth Observation Deck (at z=14.5)
  interactables.push({
    id: 'cupola-earth-view',
    node: cupolaTarget,
    prompt: 'Look through Cupola Windows at Earth',
    type: 'cupola',
  });

  return { root, hull, colliders, interactables, cupolaTarget };
}
