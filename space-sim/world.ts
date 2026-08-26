// space-sim/world.ts
/**
 * CONTENT layer: procedural Earth, clouds, atmosphere shell, starfield, pad.
 * No external assets (spec §3.3). setAscentProgress drives the atmospheric
 * transition (PRD §B.2): sky darkens, stars fade in, clouds/atmosphere fade.
 */
import {
  Color3, Color4, DynamicTexture, HemisphericLight, Mesh, MeshBuilder, Scene,
  StandardMaterial, TransformNode, Vector3,
} from '@babylonjs/core';
import { ALT } from './config';

export interface World {
  /** t: 0 at surface → 1 in orbit. */
  setAscentProgress(t: number): void;
  /** Slow cloud rotation. */
  rotate(dt: number): void;
  dispose(): void;
}

const SKY_BLUE = new Color3(0.45, 0.7, 1.0);
const SPACE_BLACK = new Color3(0.01, 0.01, 0.03);

/** Draw a starfield onto a DynamicTexture (deterministic LCG, no Math.random drift concerns). */
function starTexture(scene: Scene): DynamicTexture {
  const size = 1024;
  const tex = new DynamicTexture('stars', size, scene, false);
  const ctx = tex.getContext();
  ctx.fillStyle = '#010108';
  ctx.fillRect(0, 0, size, size);
  let s = 1234567;
  const rand = (): number => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  for (let i = 0; i < 900; i += 1) {
    const r = rand() < 0.92 ? 1 : 2;
    const b = 0.4 + rand() * 0.6;
    ctx.fillStyle = `rgba(255,255,255,${b.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  tex.update();
  return tex;
}

export function createWorld(scene: Scene): World {
  const nodes: TransformNode[] = [];
  const disposables: Array<{ dispose(): void }> = nodes;

  // Sun + ambient. Without a light every diffuse material renders pitch black.
  const sun = new HemisphericLight('sun', new Vector3(0.4, 1, 0.2), scene);
  sun.intensity = 1.1;
  sun.diffuse = new Color3(1, 0.98, 0.92);
  sun.groundColor = new Color3(0.12, 0.13, 0.18); // faint space bounce so dark sides stay readable
  disposables.push(sun);

  // Starfield: giant inverted sphere. Starts invisible (we're in atmosphere).
  const stars = MeshBuilder.CreateSphere('stars', { diameter: 900, sideOrientation: Mesh.BACKSIDE }, scene);
  const starMat = new StandardMaterial('starMat', scene);
  starMat.emissiveTexture = starTexture(scene);
  starMat.disableLighting = true;
  starMat.alpha = 0;
  stars.material = starMat;
  stars.isPickable = false;
  nodes.push(stars);

  // Earth surface.
  const earth = MeshBuilder.CreateSphere('earth', {
    diameter: ALT.EARTH_RADIUS_UNITS * 2, segments: 24,
  }, scene);
  const earthMat = new StandardMaterial('earthMat', scene);
  earthMat.diffuseColor = new Color3(0.15, 0.4, 0.25);
  earthMat.specularColor = Color3.Black();
  earth.material = earthMat;
  earth.isPickable = false;
  nodes.push(earth);

  // Cloud layer.
  const clouds = MeshBuilder.CreateSphere('clouds', {
    diameter: ALT.EARTH_RADIUS_UNITS * 2.03, segments: 20,
  }, scene);
  const cloudMat = new StandardMaterial('cloudMat', scene);
  cloudMat.diffuseColor = Color3.White();
  cloudMat.emissiveColor = new Color3(0.35, 0.35, 0.38);
  cloudMat.alpha = 0.3;
  clouds.material = cloudMat;
  clouds.isPickable = false;
  nodes.push(clouds);

  // Atmosphere shell (cheap rim: backside emissive blue).
  const atmo = MeshBuilder.CreateSphere('atmo', {
    diameter: ALT.EARTH_RADIUS_UNITS * 2.16, segments: 20, sideOrientation: Mesh.BACKSIDE,
  }, scene);
  const atmoMat = new StandardMaterial('atmoMat', scene);
  atmoMat.emissiveColor = new Color3(0.3, 0.55, 1.0);
  atmoMat.disableLighting = true;
  atmoMat.alpha = 0.35;
  atmo.material = atmoMat;
  atmo.isPickable = false;
  nodes.push(atmo);

  // Launch pad at the surface "north pole" (0, SURFACE_Y, 0).
  const pad = MeshBuilder.CreateCylinder('pad', { diameter: 3, height: 0.6, tessellation: 12 }, scene);
  pad.position = new Vector3(0, ALT.SURFACE_Y + 0.3, 0);
  const padMat = new StandardMaterial('padMat', scene);
  padMat.diffuseColor = new Color3(0.35, 0.35, 0.4);
  pad.material = padMat;
  pad.isPickable = false;
  nodes.push(pad);

  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

  return {
    setAscentProgress(t: number): void {
      const k = Math.min(1, Math.max(0, t));
      // ponytail: clearColor is Color4; brief's Color3 literal doesn't typecheck.
      const sky = new Color3(
        lerp(SKY_BLUE.r, SPACE_BLACK.r, k),
        lerp(SKY_BLUE.g, SPACE_BLACK.g, k),
        lerp(SKY_BLUE.b, SPACE_BLACK.b, k),
      );
      scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1);
      starMat.alpha = k;
      cloudMat.alpha = 0.3 * (1 - k);
      atmoMat.alpha = 0.35 * (1 - 0.5 * k);
    },
    rotate(dt: number): void {
      clouds.rotation.y += dt * 0.01;
    },
    dispose(): void {
      disposables.forEach((n) => n.dispose());
    },
  };
}
