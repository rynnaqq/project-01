// space-sim/vehicles/sls.ts
import {
  DynamicTexture, Mesh, MeshBuilder, StandardMaterial, TransformNode, type Scene,
} from "@babylonjs/core";
import type { Assets } from "../core/assets";

const STACK_Y = 24; // pad deck 14 + ML base 7.6 + mount 2.4 = mount top exactly

function wormMat(scene: Scene): StandardMaterial {
  const m = new StandardMaterial("coreWorm", scene);
  m.diffuseTexture = new DynamicTexture("coreWormTex", { width: 2048, height: 1024 }, scene, true);
  const c = m.diffuseTexture as DynamicTexture;
  const ctx = c.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 2048, 1024);
  // USA block letters + worm logo, black on transparent (overlaid on foam via second mesh)
  ctx.fillStyle = "#0a0a0a";
  ctx.font = "bold 240px monospace";
  ctx.fillText("USA", 120, 400);
  ctx.font = "bold 180px monospace";
  ctx.fillText("SLS", 120, 640);
  ctx.strokeStyle = "#0a0a0a"; ctx.lineWidth = 44; ctx.lineCap = "round";
  // worm: N-A-S-A curve approximation
  ctx.beginPath(); ctx.moveTo(1200, 520); ctx.quadraticCurveTo(1300, 360, 1400, 520);
  ctx.quadraticCurveTo(1500, 680, 1600, 520); ctx.quadraticCurveTo(1700, 360, 1800, 520);
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

  // --- 4x RS-25 engines in the SLS square pattern ---
  const enginesNode = new TransformNode("engines", scene);
  enginesNode.parent = coreNode;
  for (const [x, z] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) {
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

  // Re-root a node for independent physics (staging). Captures the WORLD pose first:
  // getAbsolutePosition() returns a live internal reference, so it must be cloned.
  // Rotation is taken from absoluteRotationQuaternion (world) — node.rotation is
  // local-only and would drop any root pitch/roll accumulated before staging.
  // setParent(null) already bakes the world pose into the local transform
  // (it decomposes the world matrix); the re-assert below is idempotent and keeps
  // the intent explicit. Scale is identity throughout the stack, so pos+quat suffice.
  const detach = (node: TransformNode): void => {
    node.computeWorldMatrix(true);
    const worldPos = node.getAbsolutePosition().clone();
    const worldRotQ = node.absoluteRotationQuaternion.clone();
    node.setParent(null);
    node.position = worldPos;
    node.rotationQuaternion = worldRotQ;
  };

  return { root, enginesNode, orionNode, srbL, srbR, coreNode, icpsNode, lasNode, detach };
}
