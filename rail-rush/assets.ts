/* =============================================================================
   RAIL RUSH — shared geometry, materials, palettes, mesh helpers.
   Built once at boot from the procedural textures; never allocated per frame.
   ========================================================================== */
import * as THREE from 'three';
import { type Textures } from './textures';

export const TRAIN_PALETTES = [
  { body: 0xb5484d, accent: 0xf6e7cf }, // oxide red
  { body: 0x3f6bb5, accent: 0xf2d8a7 }, // dusk blue
  { body: 0xc98a3d, accent: 0x4a2c33 }, // sand
  { body: 0x5aa17a, accent: 0xf6e7cf }, // faded green
  { body: 0x8a5aa0, accent: 0xffd9a0 }, // violet freight
];

export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  coin: new THREE.CylinderGeometry(0.36, 0.36, 0.09, 18),
  torus: new THREE.TorusGeometry(0.42, 0.15, 10, 20),
  octa: new THREE.OctahedronGeometry(0.46),
  cone: new THREE.ConeGeometry(1, 1, 5),
  wheel: new THREE.CylinderGeometry(1, 1, 1, 12),
  puff: new THREE.SphereGeometry(1, 7, 5),
  circle: new THREE.CircleGeometry(0.5, 16),
  ring: new THREE.TorusGeometry(0.34, 0.05, 8, 26),
};

export function createAssets(t: Textures) {
  const MAT = {
    rail: new THREE.MeshPhongMaterial({ color: 0xb8a68e, shininess: 90, specular: 0xffd9a0 }),
    sleeper: new THREE.MeshLambertMaterial({ color: 0x4a3626 }),
    ground: new THREE.MeshLambertMaterial({ map: t.ground }),
    ballast: new THREE.MeshLambertMaterial({ map: t.ballast }),
    hazard: new THREE.MeshLambertMaterial({ map: t.hazard }),
    steel: new THREE.MeshLambertMaterial({ color: 0x39415a }),
    pole: new THREE.MeshLambertMaterial({ color: 0x3a2c33 }),
    darkMetal: new THREE.MeshLambertMaterial({ color: 0x23252d }),
    glass: new THREE.MeshLambertMaterial({ color: 0x1b2130 }),
    crateWood: new THREE.MeshLambertMaterial({ color: 0x8a5f33 }),
    crateFrame: new THREE.MeshLambertMaterial({ color: 0x6b4726 }),
    barrierLowLeg: new THREE.MeshLambertMaterial({ color: 0x2c2f3a }),
    cactus: new THREE.MeshLambertMaterial({ color: 0x4a7a5a }),
    patch: [
      new THREE.MeshLambertMaterial({ color: 0x3f3050 }),
      new THREE.MeshLambertMaterial({ color: 0x473659 }),
      new THREE.MeshLambertMaterial({ color: 0x38304a }),
    ],
    cloudShadow: new THREE.MeshBasicMaterial({
      map: t.cloudShadow, transparent: true, depthWrite: false,
    }),
    shrub: [new THREE.MeshLambertMaterial({ color: 0x8a744a }), new THREE.MeshLambertMaterial({ color: 0x77643f })],
    rust: new THREE.MeshLambertMaterial({ map: t.rust }),
    tunnelLiner: new THREE.MeshLambertMaterial({ color: 0x574e63 }),
    tunnelRib: new THREE.MeshLambertMaterial({ color: 0x3e3749 }),
    tunnelSkirt: new THREE.MeshLambertMaterial({ color: 0x463f52 }),
    cloud: new THREE.MeshLambertMaterial({ color: 0xffc9d6, emissive: 0x55283c }),
    coin: new THREE.MeshPhongMaterial({ color: 0xffce5c, emissive: 0x8a5a00, shininess: 80, specular: 0xfff2c0 }),
    magnet: new THREE.MeshPhongMaterial({ color: 0xff71ce, emissive: 0x5e1747, shininess: 60 }),
    shoes: new THREE.MeshPhongMaterial({ color: 0x43d9ff, emissive: 0x0b4c66, shininess: 70 }),
    halo: new THREE.MeshBasicMaterial({ color: 0xfff1c9, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }), // shared: all power-up rings pulse together
    body: new THREE.MeshLambertMaterial({ color: 0xe8927c }),   // runner shirt
    head: new THREE.MeshLambertMaterial({ color: 0xf3b58f }),   // skin, dusk-lit
    legs: new THREE.MeshLambertMaterial({ color: 0x33303e }),
    arms: new THREE.MeshLambertMaterial({ color: 0xd97f66 }),
    cap: new THREE.MeshLambertMaterial({ color: 0x86ccca }),
    pack: new THREE.MeshLambertMaterial({ color: 0xc9566b }),
    scarf: new THREE.MeshBasicMaterial({ color: 0xff71ce, side: THREE.DoubleSide }),
    ring: new THREE.MeshBasicMaterial({
      color: 0xffdf9e, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
    lightCone: new THREE.MeshBasicMaterial({
      map: t.glow, color: 0xffbf80, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
    tumbleweed: new THREE.MeshLambertMaterial({ color: 0x9a7f52, wireframe: true }),
    particle: new THREE.MeshBasicMaterial({ color: 0xffce5c }),
    streak: new THREE.MeshBasicMaterial({
      color: 0xffd9a0, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  };

  return { MAT, textures: t };
}

export type Assets = ReturnType<typeof createAssets>;

/* Materials come back as `Material | Material[]` unions; pooled meshes here
   always carry exactly one. */
export const matOf = (o: THREE.Object3D): THREE.MeshBasicMaterial =>
  (o as THREE.Mesh).material as THREE.MeshBasicMaterial;

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], sx: number, sy: number, sz: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(sx, sy, sz);
  return m;
}

export function shadows(root: THREE.Object3D, on = true) {
  root.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = on; });
}


