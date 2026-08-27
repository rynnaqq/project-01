import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import '@babylonjs/core/Meshes/Builders/boxBuilder';
import '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import '@babylonjs/core/Meshes/Builders/sphereBuilder';
import '@babylonjs/core/Meshes/Builders/torusBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { SpotLight } from '@babylonjs/core/Lights/spotLight';
import type { Scene } from '@babylonjs/core/scene';
import type { BoxCollider } from '../gameplay/collision';

export interface ISSInteractableObject {
  id: string;
  name: string;
  position: Vector3;
  interactionDistance: number;
  prompt: string;
  infoTitle: string;
  infoDescription: string;
  isCupola?: boolean;
}

export interface ISSInteriorHandles {
  root: TransformNode;
  cupolaCameraPos: Vector3;
  cupolaLookTarget: Vector3;
  colliders: BoxCollider[];
  interactables: ISSInteractableObject[];
  flashlight: SpotLight;
  setFlashlight(enabled: boolean): void;
  updateFlashlight(pos: Vector3, dir: Vector3): void;
  dispose(): void;
}

export function buildISSInteriorScene(scene: Scene): ISSInteriorHandles {
  scene.clearColor = new Color4(0.01, 0.02, 0.04, 1);

  const root = new TransformNode('iss-interior-root', scene);
  const colliders: BoxCollider[] = [];

  // Materials
  const wallMat = new StandardMaterial('iss-wall-mat', scene);
  wallMat.diffuseColor = new Color3(0.85, 0.88, 0.9);
  wallMat.specularColor = new Color3(0.1, 0.1, 0.1);

  const floorMat = new StandardMaterial('iss-floor-mat', scene);
  floorMat.diffuseColor = new Color3(0.2, 0.25, 0.3);

  const rackMat = new StandardMaterial('iss-rack-mat', scene);
  rackMat.diffuseColor = new Color3(0.35, 0.4, 0.45);

  const panelMat = new StandardMaterial('iss-panel-screen', scene);
  panelMat.diffuseColor = new Color3(0.05, 0.15, 0.3);
  panelMat.emissiveColor = new Color3(0.1, 0.45, 0.85);

  const cupolaGlassMat = new StandardMaterial('iss-cupola-glass', scene);
  cupolaGlassMat.alpha = 0.2;
  cupolaGlassMat.emissiveColor = new Color3(0.2, 0.6, 1.0);

  const goldMat = new StandardMaterial('iss-handrail-gold', scene);
  goldMat.diffuseColor = new Color3(0.9, 0.75, 0.2);
  goldMat.emissiveColor = new Color3(0.2, 0.15, 0.05);

  const ceilingLightMat = new StandardMaterial('iss-light-mat', scene);
  ceilingLightMat.emissiveColor = new Color3(1.0, 1.0, 0.95);

  // 1. Module Hallway Structure (Destiny Lab Module: Length 24m, Width 4.2m, Height 4.2m)
  // Back & Front Endcaps
  const backWall = MeshBuilder.CreateBox('back-wall', { width: 4.8, height: 4.8, depth: 0.5 }, scene);
  backWall.parent = root;
  backWall.position.set(0, 0, -12);
  backWall.material = wallMat;
  colliders.push({ center: new Vector3(0, 0, -12), halfExtents: new Vector3(2.5, 2.5, 0.5) });

  const frontWall = MeshBuilder.CreateBox('front-wall', { width: 4.8, height: 4.8, depth: 0.5 }, scene);
  frontWall.parent = root;
  frontWall.position.set(0, 0, 12);
  frontWall.material = wallMat;
  colliders.push({ center: new Vector3(0, 0, 12), halfExtents: new Vector3(2.5, 2.5, 0.5) });

  // Floor & Ceiling
  const floor = MeshBuilder.CreateBox('floor-track', { width: 2.8, height: 0.3, depth: 24 }, scene);
  floor.parent = root;
  floor.position.set(0, -2.1, 0);
  floor.material = floorMat;
  colliders.push({ center: new Vector3(0, -2.2, 0), halfExtents: new Vector3(2.5, 0.3, 12.5) });

  const ceiling = MeshBuilder.CreateBox('ceiling-track', { width: 2.8, height: 0.3, depth: 24 }, scene);
  ceiling.parent = root;
  ceiling.position.set(0, 2.1, 0);
  ceiling.material = wallMat;
  colliders.push({ center: new Vector3(0, 2.2, 0), halfExtents: new Vector3(2.5, 0.3, 12.5) });

  // Left & Right Outer Walls
  const leftWall = MeshBuilder.CreateBox('left-hull', { width: 0.4, height: 4.8, depth: 24 }, scene);
  leftWall.parent = root;
  leftWall.position.set(-2.2, 0, 0);
  leftWall.material = wallMat;
  colliders.push({ center: new Vector3(-2.3, 0, 0), halfExtents: new Vector3(0.4, 2.5, 12.5) });

  const rightWall = MeshBuilder.CreateBox('right-hull', { width: 0.4, height: 4.8, depth: 24 }, scene);
  rightWall.parent = root;
  rightWall.position.set(2.2, 0, 0);
  rightWall.material = wallMat;
  colliders.push({ center: new Vector3(2.3, 0, 0), halfExtents: new Vector3(0.4, 2.5, 12.5) });

  // 2. Equipment Racks along the sides
  for (let z = -9; z <= 9; z += 3.2) {
    // Left rack
    const rackL = MeshBuilder.CreateBox(`rack-l-${z}`, { width: 0.8, height: 3.4, depth: 2.6 }, scene);
    rackL.parent = root;
    rackL.position.set(-1.6, 0, z);
    rackL.material = rackMat;

    // Right rack
    const rackR = MeshBuilder.CreateBox(`rack-r-${z}`, { width: 0.8, height: 3.4, depth: 2.6 }, scene);
    rackR.parent = root;
    rackR.position.set(1.6, 0, z);
    rackR.material = rackMat;

    // Handrails along ceiling and floor
    const rail = MeshBuilder.CreateCylinder(`rail-l-${z}`, { diameter: 0.06, height: 2.4 }, scene);
    rail.parent = root;
    rail.rotation.x = Math.PI / 2;
    rail.position.set(-1.1, 1.6, z);
    rail.material = goldMat;
  }

  // 3. Overhead Strip Lighting
  for (let z = -8; z <= 8; z += 4) {
    const lightFixture = MeshBuilder.CreateBox(`light-fix-${z}`, { width: 0.4, height: 0.08, depth: 2.2 }, scene);
    lightFixture.parent = root;
    lightFixture.position.set(0, 1.95, z);
    lightFixture.material = ceilingLightMat;

    const pLight = new PointLight(`int-light-${z}`, new Vector3(0, 1.5, z), scene);
    pLight.parent = root;
    pLight.intensity = 0.45;
    pLight.range = 8;
    pLight.diffuse = new Color3(0.9, 0.95, 1.0);
  }

  // 4. Cupola Observation Bay (Located at Front of Module, z = 8..11)
  const cupolaRoot = new TransformNode('cupola-bay', scene);
  cupolaRoot.parent = root;
  cupolaRoot.position.set(0, -1.2, 9.5);

  const cupolaBase = MeshBuilder.CreateCylinder(
    'cupola-base',
    { diameter: 3.2, height: 1.2, tessellation: 8 },
    scene,
  );
  cupolaBase.parent = cupolaRoot;
  cupolaBase.material = rackMat;

  // Cupola Windows overlooking Earth
  const cupolaCenterWindow = MeshBuilder.CreateCylinder(
    'cupola-main-window',
    { diameter: 1.6, height: 0.1, tessellation: 24 },
    scene,
  );
  cupolaCenterWindow.parent = cupolaRoot;
  cupolaCenterWindow.position.y = -0.55;
  cupolaCenterWindow.material = cupolaGlassMat;

  // 5. Mini Earth model visible right through Cupola window!
  const earthVisible = MeshBuilder.CreateSphere(
    'cupola-earth-view',
    { diameter: 45, segments: 24 },
    scene,
  );
  earthVisible.parent = cupolaRoot;
  earthVisible.position.set(0, -32, 0);
  const cupolaEarthMat = new StandardMaterial('cupola-earth-mat', scene);
  cupolaEarthMat.diffuseColor = Color3.FromHexString('#1565c0');
  cupolaEarthMat.emissiveColor = Color3.FromHexString('#0d47a1');
  earthVisible.material = cupolaEarthMat;

  // 6. Interactive Terminals
  const interactables: ISSInteractableObject[] = [
    {
      id: 'eclss_panel',
      name: 'Life Support / ECLSS',
      position: new Vector3(-1.15, 0.2, -6.5),
      interactionDistance: 2.5,
      prompt: '[E] / [TAP] DIAGNOSE ECLSS',
      infoTitle: 'ENVIRONMENTAL CONTROL & LIFE SUPPORT (ECLSS)',
      infoDescription: 'Atmosphere: 78% N2, 21% O2 | Pressure: 101.3 kPa (1.0 atm)\nCabin Temp: 22.4°C | CO2 Scrubber: NOMINAL (99.8%)',
    },
    {
      id: 'nav_terminal',
      name: 'Orbital Navigation Terminal',
      position: new Vector3(1.15, 0.2, -1.5),
      interactionDistance: 2.5,
      prompt: '[E] / [TAP] FLIGHT TELEMETRY',
      infoTitle: 'ISS ORBITAL FLIGHT GUIDANCE TERMINAL',
      infoDescription: 'Orbit: 408.2 km x 410.5 km | Inclination: 51.6°\nVelocity: 7.66 km/s (27,600 km/h) | Next Sunrise: 24m 12s',
    },
    {
      id: 'science_rack',
      name: 'Microgravity Science Glovebox',
      position: new Vector3(-1.15, 0.2, 3.5),
      interactionDistance: 2.5,
      prompt: '[E] / [TAP] INSPECT EXPERIMENTS',
      infoTitle: 'MICROGRAVITY SCIENCE EXPERIMENT RACK',
      infoDescription: 'Sample #402: Protein crystal growth in microgravity.\nObservation: Uniform crystal lattice structure with zero convection defects.',
    },
    {
      id: 'cupola_view',
      name: 'Cupola Earth Observation Window',
      position: new Vector3(0, -0.6, 9.5),
      interactionDistance: 3.0,
      prompt: '[E] / [TAP] OBSERVE EARTH FROM CUPOLA',
      infoTitle: 'CUPOLA 360° EARTH OBSERVATION BAY',
      infoDescription: 'Viewing: Pacific Ocean & Cloud Vortex\nAltitude: 408 km | Atmosphere Rim: Horizon Blue Glow\nSolar Terminator: Day/Night Transition Zone',
      isCupola: true,
    },
  ];

  // Visual screen boxes for terminals
  interactables.forEach((item, idx) => {
    if (!item.isCupola) {
      const scr = MeshBuilder.CreateBox(`term-scr-${idx}`, { width: 0.1, height: 0.7, depth: 1.0 }, scene);
      scr.parent = root;
      scr.position.copyFrom(item.position);
      scr.material = panelMat;
    }
  });

  // 7. Flashlight (Spotlight on player camera)
  const flashlight = new SpotLight(
    'astronaut-flashlight',
    new Vector3(0, 0, 0),
    new Vector3(0, 0, 1),
    Math.PI / 3.2,
    12,
    scene,
  );
  flashlight.intensity = 1.6;
  flashlight.diffuse = new Color3(1.0, 0.98, 0.92);
  flashlight.setEnabled(true);

  return {
    root,
    cupolaCameraPos: new Vector3(0, -0.5, 9.5),
    cupolaLookTarget: new Vector3(0, -15, 9.5),
    colliders,
    interactables,
    flashlight,
    setFlashlight(enabled: boolean) {
      flashlight.setEnabled(enabled);
    },
    updateFlashlight(pos: Vector3, dir: Vector3) {
      flashlight.position.copyFrom(pos);
      flashlight.direction.copyFrom(dir);
    },
    dispose() {
      root.dispose(false, true);
      flashlight.dispose();
      wallMat.dispose();
      floorMat.dispose();
      rackMat.dispose();
      panelMat.dispose();
      cupolaGlassMat.dispose();
      goldMat.dispose();
      ceilingLightMat.dispose();
    },
  };
}
