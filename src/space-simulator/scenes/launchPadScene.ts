import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import '@babylonjs/core/Meshes/Builders/boxBuilder';
import '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Scene } from '@babylonjs/core/scene';

export interface LaunchPadHandles {
  root: TransformNode;
  rocketRoot: TransformNode;
  stage1Root: TransformNode;
  stage2Root: TransformNode;
  serviceArm: TransformNode;
  retractServiceArm(): void;
  separateStage1(): void;
  dispose(): void;
}

export function buildLaunchPadScene(scene: Scene): LaunchPadHandles {
  scene.clearColor = new Color4(0.04, 0.06, 0.1, 1.0);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.003;
  scene.fogColor = new Color3(0.05, 0.08, 0.12);

  const root = new TransformNode('launch-pad-root', scene);

  // Materials
  const concreteMat = new StandardMaterial('mat-concrete', scene);
  concreteMat.diffuseColor = new Color3(0.22, 0.24, 0.26);
  concreteMat.specularColor = new Color3(0.05, 0.05, 0.05);

  const steelMat = new StandardMaterial('mat-steel', scene);
  steelMat.diffuseColor = new Color3(0.7, 0.2, 0.15); // NASA red/orange gantry
  steelMat.specularColor = new Color3(0.2, 0.2, 0.2);

  const trussDarkMat = new StandardMaterial('mat-truss-dark', scene);
  trussDarkMat.diffuseColor = new Color3(0.18, 0.2, 0.22);

  const rocketWhiteMat = new StandardMaterial('mat-rocket-white', scene);
  rocketWhiteMat.diffuseColor = new Color3(0.92, 0.94, 0.96);
  rocketWhiteMat.specularColor = new Color3(0.4, 0.4, 0.4);

  const rocketBlackMat = new StandardMaterial('mat-rocket-black', scene);
  rocketBlackMat.diffuseColor = new Color3(0.12, 0.12, 0.14);

  const engineGlowMat = new StandardMaterial('mat-engine-glow', scene);
  engineGlowMat.diffuseColor = new Color3(0.1, 0.1, 0.1);
  engineGlowMat.emissiveColor = new Color3(1.0, 0.5, 0.1);

  // 1. Ground & Pad Foundation
  const ground = MeshBuilder.CreateGround(
    'ground',
    { width: 400, height: 400 },
    scene,
  );
  ground.parent = root;
  ground.material = concreteMat;

  const padBase = MeshBuilder.CreateCylinder(
    'pad-base',
    { diameter: 36, height: 2.5, tessellation: 32 },
    scene,
  );
  padBase.parent = root;
  padBase.position.y = 1.25;
  padBase.material = concreteMat;

  const trench = MeshBuilder.CreateBox(
    'flame-trench',
    { width: 14, height: 2, depth: 32 },
    scene,
  );
  trench.parent = root;
  trench.position.set(0, 0.5, 0);
  trench.material = trussDarkMat;

  // 2. Launch Tower (Gantry Structure)
  const towerRoot = new TransformNode('tower-root', scene);
  towerRoot.parent = root;
  towerRoot.position.set(-9, 0, 0);

  // Tower vertical columns
  for (let i = 0; i < 4; i++) {
    const x = i % 2 === 0 ? -2.5 : 2.5;
    const z = i < 2 ? -2.5 : 2.5;
    const col = MeshBuilder.CreateBox(
      `tower-col-${i}`,
      { width: 0.8, height: 48, depth: 0.8 },
      scene,
    );
    col.parent = towerRoot;
    col.position.set(x, 24, z);
    col.material = steelMat;
  }

  // Cross horizontal platforms
  for (let y = 6; y <= 48; y += 6) {
    const plat = MeshBuilder.CreateBox(
      `tower-plat-${y}`,
      { width: 6, height: 0.4, depth: 6 },
      scene,
    );
    plat.parent = towerRoot;
    plat.position.set(0, y, 0);
    plat.material = steelMat;
  }

  // Crane on top of tower
  const crane = MeshBuilder.CreateBox(
    'tower-crane',
    { width: 12, height: 1.2, depth: 1.2 },
    scene,
  );
  crane.parent = towerRoot;
  crane.position.set(2, 49, 0);
  crane.material = steelMat;

  // 3. Retractable Service Arm (Crew Access Arm)
  const serviceArm = new TransformNode('service-arm', scene);
  serviceArm.parent = towerRoot;
  serviceArm.position.set(0, 38, 0);

  const armBridge = MeshBuilder.CreateBox(
    'arm-bridge',
    { width: 9, height: 2.2, depth: 2.2 },
    scene,
  );
  armBridge.parent = serviceArm;
  armBridge.position.set(4.5, 0, 0);
  armBridge.material = rocketWhiteMat;

  const armCabin = MeshBuilder.CreateBox(
    'arm-cabin',
    { width: 2.5, height: 2.8, depth: 2.6 },
    scene,
  );
  armCabin.parent = serviceArm;
  armCabin.position.set(8.5, 0, 0);
  armCabin.material = rocketWhiteMat;

  // 4. Multi-Stage Rocket
  const rocketRoot = new TransformNode('rocket-root', scene);
  rocketRoot.parent = root;
  rocketRoot.position.set(0, 2.5, 0);

  // --- STAGE 1 ---
  const stage1Root = new TransformNode('stage1-root', scene);
  stage1Root.parent = rocketRoot;

  // Stage 1 Core Cylinder
  const stage1Core = MeshBuilder.CreateCylinder(
    'stage1-core',
    { diameter: 3.2, height: 24, tessellation: 28 },
    scene,
  );
  stage1Core.parent = stage1Root;
  stage1Core.position.y = 12;
  stage1Core.material = rocketWhiteMat;

  // Stage 1 Engine Base & Nozzles
  const engineBase = MeshBuilder.CreateCylinder(
    'engine-base',
    { diameter: 3.0, height: 1.8, tessellation: 24 },
    scene,
  );
  engineBase.parent = stage1Root;
  engineBase.position.y = 0.9;
  engineBase.material = rocketBlackMat;

  // 9 Engine Nozzles (Merlin 9 style)
  for (let i = 0; i < 9; i++) {
    const angle = (i * 2 * Math.PI) / 8;
    const r = i === 8 ? 0 : 0.9;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const nozzle = MeshBuilder.CreateCylinder(
      `nozzle-${i}`,
      { diameterTop: 0.35, diameterBottom: 0.75, height: 1.2, tessellation: 16 },
      scene,
    );
    nozzle.parent = stage1Root;
    nozzle.position.set(x, 0.4, z);
    nozzle.material = rocketBlackMat;
  }

  // 4 Grid fins near top of Stage 1
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const fin = MeshBuilder.CreateBox(
      `grid-fin-${i}`,
      { width: 0.1, height: 0.8, depth: 1.2 },
      scene,
    );
    fin.parent = stage1Root;
    fin.position.set(Math.cos(angle) * 1.8, 23, Math.sin(angle) * 1.8);
    fin.rotation.y = angle;
    fin.material = trussDarkMat;
  }

  // --- STAGE 2 ---
  const stage2Root = new TransformNode('stage2-root', scene);
  stage2Root.parent = rocketRoot;
  stage2Root.position.y = 24;

  // Interstage ring
  const interstage = MeshBuilder.CreateCylinder(
    'interstage-ring',
    { diameter: 3.2, height: 2.5, tessellation: 28 },
    scene,
  );
  interstage.parent = stage2Root;
  interstage.position.y = 1.25;
  interstage.material = rocketBlackMat;

  // Stage 2 Core
  const stage2Core = MeshBuilder.CreateCylinder(
    'stage2-core',
    { diameter: 3.2, height: 9.5, tessellation: 28 },
    scene,
  );
  stage2Core.parent = stage2Root;
  stage2Core.position.y = 7.25;
  stage2Core.material = rocketWhiteMat;

  // Spacecraft Capsule / Nosecone
  const capsule = MeshBuilder.CreateCylinder(
    'spacecraft-capsule',
    { diameterTop: 1.0, diameterBottom: 3.2, height: 4.5, tessellation: 28 },
    scene,
  );
  capsule.parent = stage2Root;
  capsule.position.y = 14.25;
  capsule.material = rocketWhiteMat;

  // Nose docking nose cone
  const noseCap = MeshBuilder.CreateCylinder(
    'nose-cap',
    { diameterTop: 0.1, diameterBottom: 1.0, height: 1.2, tessellation: 20 },
    scene,
  );
  noseCap.parent = stage2Root;
  noseCap.position.y = 17.1;
  noseCap.material = rocketBlackMat;

  // 5. Lighting
  const padSun = new DirectionalLight(
    'pad-sun',
    new Vector3(-0.4, -0.7, -0.6),
    scene,
  );
  padSun.intensity = 0.9;

  const padHemi = new HemisphericLight(
    'pad-hemi',
    new Vector3(0, 1, 0),
    scene,
  );
  padHemi.intensity = 0.35;
  padHemi.groundColor = new Color3(0.08, 0.1, 0.12);

  // Floodlights on pad
  const floodlight = new PointLight(
    'pad-floodlight',
    new Vector3(-12, 18, 12),
    scene,
  );
  floodlight.intensity = 1.5;
  floodlight.range = 70;
  floodlight.diffuse = new Color3(0.9, 0.95, 1.0);

  return {
    root,
    rocketRoot,
    stage1Root,
    stage2Root,
    serviceArm,
    retractServiceArm() {
      // Swing service arm out away from rocket
      serviceArm.rotation.y = -Math.PI / 2.8;
    },
    separateStage1() {
      // Detach stage 1 visually
      stage1Root.parent = null;
      // Drift down and away
      stage1Root.position.y -= 5;
    },
    dispose() {
      scene.fogMode = Scene.FOGMODE_NONE;
      root.dispose(false, true);
      padSun.dispose();
      padHemi.dispose();
      floodlight.dispose();
      concreteMat.dispose();
      steelMat.dispose();
      trussDarkMat.dispose();
      rocketWhiteMat.dispose();
      rocketBlackMat.dispose();
      engineGlowMat.dispose();
    },
  };
}
