import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import '@babylonjs/core/Meshes/Builders/sphereBuilder';
import '@babylonjs/core/Meshes/Builders/boxBuilder';
import '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import '@babylonjs/core/Meshes/Builders/torusBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { FresnelParameters } from '@babylonjs/core/Materials/fresnelParameters';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface OrbitHandles {
  craftRoot: TransformNode;
  issRoot: TransformNode;
  earthRoot: TransformNode;
  dockingPortPos: Vector3;
  update(dt: number): void;
  dispose(): void;
}

function solidMat(
  scene: Scene,
  name: string,
  hex: string,
  emissiveHex?: string,
): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = Color3.FromHexString(hex);
  mat.specularColor = new Color3(0.08, 0.08, 0.1);
  if (emissiveHex) {
    mat.emissiveColor = Color3.FromHexString(emissiveHex);
  }
  return mat;
}

export function buildOrbitScene(scene: Scene): OrbitHandles {
  scene.clearColor = new Color4(0, 0, 0, 1);

  // Space directional sun + soft earth reflection light
  const sun = new DirectionalLight(
    'sun',
    new Vector3(-0.6, -0.4, -0.7).normalize(),
    scene,
  );
  sun.intensity = 1.35;
  sun.diffuse = new Color3(1.0, 0.98, 0.92);

  const earthAlbedoLight = new HemisphericLight(
    'earth-albedo',
    new Vector3(0, -1, 0),
    scene,
  );
  earthAlbedoLight.intensity = 0.25;
  earthAlbedoLight.diffuse = new Color3(0.3, 0.5, 0.8);
  earthAlbedoLight.groundColor = new Color3(0.02, 0.02, 0.05);

  const roots: Array<{ dispose(doNotRecurse?: boolean, disposeMaterialAndTextures?: boolean): void }> = [];

  // 1. Starfield Sphere
  const starTex = new DynamicTexture(
    'star-tex',
    { width: 1024, height: 1024 },
    scene,
    false,
  );
  const ctx = starTex.getContext();
  ctx.fillStyle = '#010204';
  ctx.fillRect(0, 0, 1024, 1024);
  const rng = mulberry32(1337);
  for (let i = 0; i < 900; i += 1) {
    const size = rng() * 1.8 + 0.4;
    const brightness = Math.floor(rng() * 155 + 100);
    ctx.fillStyle = `rgb(${brightness},${brightness},${Math.min(255, brightness + 20)})`;
    ctx.fillRect(rng() * 1024, rng() * 1024, size, size);
  }
  starTex.update(false);

  const starMat = new StandardMaterial('star-mat', scene);
  starMat.emissiveTexture = starTex;
  starMat.disableLighting = true;
  starMat.backFaceCulling = false;

  const stars = MeshBuilder.CreateSphere(
    'starfield',
    { diameter: 6000, segments: 16 },
    scene,
  );
  stars.material = starMat;
  stars.isPickable = false;

  // 2. Multi-Layer PBR Earth
  const earthRoot = new TransformNode('earth-root', scene);
  roots.push(earthRoot);
  earthRoot.position.set(-320, -120, -550);

  // Earth dynamic procedural texture (Oceans & Continents)
  const earthTex = new DynamicTexture(
    'earth-tex',
    { width: 1024, height: 512 },
    scene,
    false,
  );
  const eCtx = earthTex.getContext();
  // Deep Blue Ocean
  eCtx.fillStyle = '#0d274c';
  eCtx.fillRect(0, 0, 1024, 512);

  // Continents shapes (approximations using organic circular landmasses)
  eCtx.fillStyle = '#2d5a27'; // Lush Green / Brown land
  // Americas
  eCtx.beginPath();
  eCtx.arc(280, 200, 75, 0, Math.PI * 2);
  eCtx.fill();
  eCtx.beginPath();
  eCtx.arc(340, 360, 85, 0, Math.PI * 2);
  eCtx.fill();
  // Eurasia & Africa
  eCtx.fillStyle = '#6b663b';
  eCtx.beginPath();
  eCtx.arc(650, 180, 110, 0, Math.PI * 2);
  eCtx.fill();
  eCtx.fillStyle = '#3a5f2d';
  eCtx.beginPath();
  eCtx.arc(600, 310, 90, 0, Math.PI * 2);
  eCtx.fill();
  // Australia
  eCtx.beginPath();
  eCtx.arc(820, 380, 45, 0, Math.PI * 2);
  eCtx.fill();

  earthTex.update(false);

  const earthMat = new StandardMaterial('earth-mat', scene);
  earthMat.diffuseTexture = earthTex;
  earthMat.specularColor = new Color3(0.2, 0.3, 0.4);

  const earth = MeshBuilder.CreateSphere(
    'earth-surface',
    { diameter: 220, segments: 36 },
    scene,
  );
  earth.parent = earthRoot;
  earth.material = earthMat;

  // Cloud Layer
  const clouds = MeshBuilder.CreateSphere(
    'earth-clouds',
    { diameter: 222, segments: 32 },
    scene,
  );
  clouds.parent = earthRoot;
  const cloudMat = new StandardMaterial('clouds-mat', scene);
  cloudMat.alpha = 0.32;
  cloudMat.diffuseColor = new Color3(1, 1, 1);
  cloudMat.specularColor = new Color3(0.1, 0.1, 0.1);
  clouds.material = cloudMat;

  // Atmosphere Rim Shell (Fresnel glow)
  const atmo = MeshBuilder.CreateSphere(
    'earth-atmosphere',
    { diameter: 228, segments: 32 },
    scene,
  );
  atmo.parent = earthRoot;
  const atmoMat = new StandardMaterial('atmo-mat', scene);
  atmoMat.alpha = 0.35;
  atmoMat.emissiveColor = Color3.FromHexString('#38bdf8');
  atmoMat.disableLighting = true;
  atmoMat.emissiveFresnelParameters = new FresnelParameters();
  atmoMat.emissiveFresnelParameters.bias = 0.05;
  atmoMat.emissiveFresnelParameters.power = 2.4;
  atmo.material = atmoMat;

  // 3. Detailed Modular ISS
  const iss = new TransformNode('ISSRoot', scene);
  roots.push(iss);

  const hullMat = solidMat(scene, 'iss-hull', '#e2e8f0');
  const darkTrussMat = solidMat(scene, 'iss-truss', '#334155');
  const solarMat = solidMat(scene, 'iss-solar', '#1e3a8a', '#172554');
  const goldFoilMat = solidMat(scene, 'iss-gold', '#d97706', '#b45309');
  const portMat = solidMat(scene, 'iss-port', '#475569');

  const addBox = (
    name: string,
    width: number,
    height: number,
    depth: number,
    mat: StandardMaterial,
    pos: Vector3,
  ) => {
    const b = MeshBuilder.CreateBox(name, { width, height, depth }, scene);
    b.parent = iss;
    b.position.copyFrom(pos);
    b.material = mat;
    return b;
  };

  const addCyl = (
    name: string,
    diameter: number,
    height: number,
    mat: StandardMaterial,
    pos: Vector3,
    rotZ = 0,
  ) => {
    const c = MeshBuilder.CreateCylinder(
      name,
      { diameter, height, tessellation: 24 },
      scene,
    );
    c.parent = iss;
    c.position.copyFrom(pos);
    c.rotation.z = rotZ;
    c.material = mat;
    return c;
  };

  // Main Pressurized Modules
  // Destiny Lab (Core Module)
  addCyl('module-destiny', 4.2, 16, hullMat, new Vector3(20, 0, 0), Math.PI / 2);
  // Harmony Node 2
  addCyl('module-harmony', 3.8, 6, hullMat, new Vector3(10.5, 0, 0), Math.PI / 2);
  // Columbus European Lab
  addCyl('module-columbus', 3.8, 8, hullMat, new Vector3(10.5, 0, 6.5), 0);
  // Kibo Japanese Experiment Module
  addCyl('module-kibo', 4.0, 11, hullMat, new Vector3(10.5, 0, -8), 0);
  // Zvezda Service Module
  addCyl('module-zvezda', 4.0, 13, goldFoilMat, new Vector3(32, 0, 0), Math.PI / 2);

  // Cupola Observation Window Module (facing Earth)
  addBox('module-cupola', 2.8, 1.8, 2.8, darkTrussMat, new Vector3(20, -2.4, 0));
  // 7 Windows in Cupola
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    addBox(
      `cupola-win-${i}`,
      0.8,
      0.8,
      0.1,
      solidMat(scene, `c-win-${i}`, '#38bdf8', '#0284c7'),
      new Vector3(20 + Math.cos(angle) * 1.2, -3.2, Math.sin(angle) * 1.2),
    );
  }

  // Integrated Truss Structure (ITS)
  addBox('iss-truss-main', 1.0, 1.0, 48, darkTrussMat, new Vector3(20, 3.5, 0));

  // 8 Giant Solar Array Wings
  [-20, -14, -8, 8, 14, 20].forEach((z, i) => {
    // Upper & Lower Solar panels
    addBox(
      `solar-upper-${i}`,
      0.2,
      12,
      4.2,
      solarMat,
      new Vector3(20, 9.5, z),
    );
    addBox(
      `solar-lower-${i}`,
      0.2,
      12,
      4.2,
      solarMat,
      new Vector3(20, -2.5, z),
    );
  });

  // Radiator Panels
  [-5, 5].forEach((z, i) => {
    addBox(
      `radiator-${i}`,
      0.15,
      6.0,
      2.5,
      hullMat,
      new Vector3(26, 3.5, z),
    );
  });

  // Docking Port & Approach Adapter (PMA-2 / IDA)
  addCyl('docking-boom', 1.2, 8, portMat, new Vector3(5, 0, 0), Math.PI / 2);
  const ring = MeshBuilder.CreateTorus(
    'docking-ring',
    { diameter: 2.2, thickness: 0.35, tessellation: 32 },
    scene,
  );
  ring.parent = iss;
  ring.rotation.z = Math.PI / 2;
  ring.position.set(0.4, 0, 0);
  ring.material = solidMat(scene, 'ring-mat', '#e2e8f0', '#0ea5e9');

  // Docking alignment guide cross & target lights
  [
    new Vector3(0.4, 1.4, 1.4),
    new Vector3(0.4, 1.4, -1.4),
    new Vector3(0.4, -1.4, 1.4),
    new Vector3(0.4, -1.4, -1.4),
  ].forEach((pos, i) => {
    addBox(
      `port-marker-${i}`,
      0.35,
      0.35,
      0.35,
      solidMat(scene, `marker-mat-${i}`, '#22c55e', '#22c55e'),
      pos,
    );
  });

  // Docking port spotlight
  const portLight = new PointLight('port-light', new Vector3(1.5, 0, 0), scene);
  portLight.parent = iss;
  portLight.intensity = 0.8;
  portLight.range = 25;
  portLight.diffuse = new Color3(0.85, 0.95, 1.0);

  // 4. Crew Spacecraft (Player Craft)
  const craftRoot = new TransformNode('craft-root', scene);
  roots.push(craftRoot);

  const craftBody = MeshBuilder.CreateCylinder(
    'craft-body',
    { diameterTop: 1.8, diameterBottom: 2.8, height: 3.6, tessellation: 24 },
    scene,
  );
  craftBody.parent = craftRoot;
  craftBody.rotation.x = Math.PI / 2;
  craftBody.material = solidMat(scene, 'craft-body-mat', '#f8fafc');

  const craftNose = MeshBuilder.CreateCylinder(
    'craft-nose',
    { diameterTop: 0.9, diameterBottom: 1.8, height: 1.2, tessellation: 20 },
    scene,
  );
  craftNose.parent = craftRoot;
  craftNose.rotation.x = Math.PI / 2;
  craftNose.position.z = 2.4;
  craftNose.material = darkTrussMat;

  const craftServiceTrunk = MeshBuilder.CreateCylinder(
    'craft-trunk',
    { diameter: 2.8, height: 2.2, tessellation: 24 },
    scene,
  );
  craftServiceTrunk.parent = craftRoot;
  craftServiceTrunk.rotation.x = Math.PI / 2;
  craftServiceTrunk.position.z = -2.6;
  craftServiceTrunk.material = solidMat(scene, 'craft-trunk-mat', '#475569');

  // Trunk Solar Panel Wrap
  const trunkSolar = MeshBuilder.CreateCylinder(
    'trunk-solar',
    { diameter: 2.85, height: 1.6, tessellation: 24 },
    scene,
  );
  trunkSolar.parent = craftRoot;
  trunkSolar.rotation.x = Math.PI / 2;
  trunkSolar.position.z = -2.6;
  trunkSolar.material = solarMat;

  return {
    craftRoot,
    issRoot: iss,
    earthRoot,
    dockingPortPos: new Vector3(0.4, 0, 0),
    update(dt: number) {
      earth.rotation.y += dt * 0.01;
      clouds.rotation.y += dt * 0.015;
    },
    dispose() {
      stars.dispose(false, true);
      starTex.dispose();
      starMat.dispose();
      earthTex.dispose();
      earthMat.dispose();
      cloudMat.dispose();
      atmoMat.dispose();
      roots.forEach((root) => root.dispose(false, true));
      sun.dispose();
      earthAlbedoLight.dispose();
      portLight.dispose();
    },
  };
}
