import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import '@babylonjs/core/Meshes/Builders/sphereBuilder';
import '@babylonjs/core/Meshes/Builders/boxBuilder';
import '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { FresnelParameters } from '@babylonjs/core/Materials/fresnelParameters';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
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
  mat.specularColor = new Color3(0.05, 0.05, 0.06);
  if (emissiveHex) {
    mat.emissiveColor = Color3.FromHexString(emissiveHex);
  }
  return mat;
}

export function buildOrbitScene(scene: Scene): OrbitHandles {
  scene.clearColor = new Color4(0, 0, 0, 1);

  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.14;
  const sun = new DirectionalLight(
    'sun',
    new Vector3(-0.55, -0.35, -0.75),
    scene,
  );
  sun.intensity = 1.15;

  const roots: Array<{ dispose(doNotRecurse?: boolean, disposeMaterialAndTextures?: boolean): void }> = [];

  const starTex = new DynamicTexture(
    'star-tex',
    { width: 1024, height: 1024 },
    scene,
    false,
  );
  const ctx = starTex.getContext();
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 1024, 1024);
  const rng = mulberry32(42);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 700; i += 1) {
    const size = rng() * 1.6 + 0.5;
    ctx.fillRect(rng() * 1024, rng() * 1024, size, size);
  }
  starTex.update(false);
  const starMat = new StandardMaterial('star-mat', scene);
  starMat.emissiveTexture = starTex;
  starMat.disableLighting = true;
  starMat.backFaceCulling = false;
  const stars = MeshBuilder.CreateSphere(
    'starfield',
    { diameter: 4000, segments: 16 },
    scene,
  );
  stars.material = starMat;
  stars.isPickable = false;

  const earthRoot = new TransformNode('earth-root', scene);
  roots.push(earthRoot);
  const earth = MeshBuilder.CreateSphere(
    'earth',
    { diameter: 90, segments: 32 },
    scene,
  );
  earth.parent = earthRoot;
  earth.position.set(-260, -40, -420);
  earth.material = solidMat(scene, 'earth-mat', '#1565c0');

  const atmo = MeshBuilder.CreateSphere(
    'atmosphere',
    { diameter: 94.5, segments: 32 },
    scene,
  );
  atmo.parent = earthRoot;
  atmo.position.copyFrom(earth.position);
  const atmoMat = new StandardMaterial('atmo-mat', scene);
  atmoMat.alpha = 0.25;
  atmoMat.emissiveColor = Color3.FromHexString('#4fc3f7');
  atmoMat.disableLighting = true;
  atmoMat.emissiveFresnelParameters = new FresnelParameters();
  atmoMat.emissiveFresnelParameters.bias = 0.02;
  atmoMat.emissiveFresnelParameters.power = 2;
  atmo.material = atmoMat;

  const iss = new TransformNode('ISSRoot', scene);
  roots.push(iss);
  const hull = solidMat(scene, 'iss-hull', '#eceff1');
  const dark = solidMat(scene, 'iss-dark', '#37474f');
  const solar = solidMat(scene, 'iss-solar', '#1a237e', '#283593');

  const addPart = (
    name: string,
    options:
      | Parameters<typeof MeshBuilder.CreateBox>[1]
      | Parameters<typeof MeshBuilder.CreateCylinder>[1],
    box: boolean,
    mat: StandardMaterial,
  ) => {
    const part = box
      ? MeshBuilder.CreateBox(
          name,
          options as Parameters<typeof MeshBuilder.CreateBox>[1],
          scene,
        )
      : MeshBuilder.CreateCylinder(
          name,
          options as Parameters<typeof MeshBuilder.CreateCylinder>[1],
          scene,
        );
    part.parent = iss;
    part.material = mat;
    return part;
  };

  const core = addPart(
    'iss-core',
    { diameter: 4, height: 16, tessellation: 20 },
    false,
    hull,
  );
  core.rotation.z = Math.PI / 2;
  core.position.set(20, 0, 0);

  const node = addPart(
    'iss-node',
    { diameter: 3.6, height: 5, tessellation: 20 },
    false,
    hull,
  );
  node.rotation.z = Math.PI / 2;
  node.position.set(10.5, 0, 0);

  const cupola = addPart(
    'iss-cupola',
    { size: 2 },
    true,
    dark,
  );
  cupola.position.set(22, -2, 0);

  const truss = addPart(
    'iss-truss',
    { width: 0.5, height: 0.5, depth: 30 },
    true,
    dark,
  );
  truss.position.set(20, 2.8, 0);

  [-11, -6.5, 6.5, 11].forEach((z, i) => {
    const panel = addPart(
      `iss-panel-${i}`,
      { width: 0.15, height: 9, depth: 3.4 },
      true,
      solar,
    );
    panel.position.set(20, 2.8, z);
  });

  const boom = addPart(
    'port-boom',
    { diameter: 0.9, height: 10, tessellation: 12 },
    false,
    dark,
  );
  boom.rotation.z = Math.PI / 2;
  boom.position.set(5, 0, 0);

  const ring = addPart(
    'port-ring',
    { diameter: 1.8, height: 1, tessellation: 24 },
    false,
    dark,
  );
  ring.rotation.z = Math.PI / 2;
  ring.position.set(0.4, 0, 0);

  [
    new Vector3(0.4, 1.2, 1.2),
    new Vector3(0.4, 1.2, -1.2),
    new Vector3(0.4, -1.2, 1.2),
    new Vector3(0.4, -1.2, -1.2),
  ].forEach((pos, i) => {
    const marker = addPart(
      `port-marker-${i}`,
      { size: 0.3 },
      true,
      solidMat(scene, `marker-mat-${i}`, '#22c55e', '#22c55e'),
    );
    marker.position.copyFrom(pos);
  });

  const craftRoot = new TransformNode('craft-root', scene);
  roots.push(craftRoot);
  const craftBody = addPart('craft-body', { width: 1.6, height: 1.6, depth: 3.2 }, true, solidMat(scene, 'craft-mat', '#b0bec5'));
  craftBody.parent = craftRoot;
  const craftNose = addPart('craft-nose', { width: 1.2, height: 1.2, depth: 1 }, true, hull);
  craftNose.parent = craftRoot;
  craftNose.position.z = 2.1;
  const craftEngine = addPart('craft-engine', { width: 1.2, height: 1.2, depth: 0.25 }, true, solidMat(scene, 'engine-mat', '#ff9800', '#ff9800'));
  craftEngine.parent = craftRoot;
  craftEngine.position.z = -1.7;

  return {
    craftRoot,
    dispose() {
      stars.dispose(false, true);
      starTex.dispose();
      starMat.dispose();
      roots.forEach((root) => root.dispose(false, true));
      hemi.dispose();
      sun.dispose();
    },
  };
}
