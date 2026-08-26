// space-sim/cutscene.ts
/**
 * PRESENTATION layer: intro cutscene choreography. Drives a dedicated cinematic
 * camera through the six timeline shots; loads the rocket GLB with a procedural
 * fallback (PRD §E.4). Gameplay camera is untouched — main.ts swaps
 * scene.activeCamera and restores it when the cutscene ends.
 */
import {
  Color3, FreeCamera, MeshBuilder, Scene, StandardMaterial, TransformNode,
  Vector3, LoadAssetContainerAsync,
} from '@babylonjs/core';
import { ALT, PLAYER } from './config';
import type { IssRig } from './iss';
import { TOTAL_S, shotAt, tickAt, easeInOut, type Shot } from './timeline';

export interface Cutscene {
  /** Advance the choreography by dt seconds. Returns false once finished. */
  update(dt: number): boolean;
  /** Current countdown number for the overlay ('LIFTOFF' at 0), null when none. */
  readonly countdown: number | null;
  /** Cinematic camera — main.ts sets this as scene.activeCamera. */
  readonly camera: FreeCamera;
  /** Elapsed seconds (for rumble ramp). */
  readonly elapsed: number;
  dispose(): void;
}

const PAD = new Vector3(0, ALT.SURFACE_Y, 0);

export function createCutscene(scene: Scene, iss: IssRig): Cutscene {
  // Cinematic camera, separate from the player's.
  const cam = new FreeCamera('cutsceneCam', Vector3.Zero(), scene);
  cam.minZ = PLAYER.minZ;
  cam.maxZ = 3000;

  // ---------- rocket ----------
  let rocket: TransformNode | null = null;
  const disposables: Array<{ dispose(): void }> = [cam];

  const buildProceduralRocket = (): TransformNode => {
    const root = new TransformNode('rocket', scene);
    const bodyMat = new StandardMaterial('rocketBody', scene);
    bodyMat.diffuseColor = new Color3(0.92, 0.93, 0.95);
    const finMat = new StandardMaterial('rocketFin', scene);
    finMat.diffuseColor = new Color3(0.85, 0.25, 0.15);

    MeshBuilder.CreateCylinder('rBody', { diameter: 0.7, height: 1.6 }, scene);
    const nose = MeshBuilder.CreateCylinder(
      'rNose', { diameterTop: 0, diameterBottom: 0.7, height: 0.6 }, scene,
    );
    nose.position.y = 1.1;
    const window = MeshBuilder.CreateSphere('rWin', { diameter: 0.22 }, scene);
    window.position.set(0.18, 0.45, 0.42);
    for (let i = 0; i < 3; i += 1) {
      const fin = MeshBuilder.CreateBox('rFin', { width: 0.06, height: 0.55, depth: 0.35 }, scene);
      fin.position.set(Math.sin((i * Math.PI) / 1.5) * 0.32, -0.5, Math.cos((i * Math.PI) / 1.5) * 0.32);
      fin.rotation.y = -(i * Math.PI) / 1.5;
    }
    return root;
  };

  // Try the GLB first; fall back to primitives if it fails to load (§E.4).
  const loadRocket = async (): Promise<TransformNode> => {
    try {
      const container = await LoadAssetContainerAsync('./assets/rocket.glb', scene);
      container.addAllToScene();
      const root = container.createRootMesh();
      rocket = root as TransformNode;
      root.name = 'rocket';
    } catch {
      console.warn('rocket.glb failed to load — using procedural fallback');
      rocket = buildProceduralRocket();
    }
    return rocket;
  };

  // Fire-and-forget: the first frames show an empty pad if the GLB is slow.
  void loadRocket();

  // ---------- per-shot choreography ----------
  let t = 0;
  let lastTick: number | null = null;
  let countdown: number | null = null;

  const applyShot = (s: Shot, local: number): void => {
    const u = local / s.dur;
    switch (s.name) {
      case 'pad': {
        const e = easeInOut(u);
        cam.position = lerpVec(
          new Vector3(PAD.x - 9, PAD.y + 1.2, PAD.z + 14),
          new Vector3(PAD.x - 5, PAD.y + 1.8, PAD.z + 8),
          e,
        );
        cam.setTarget(PAD.add(new Vector3(0, 1, 0)));
        break;
      }
      case 'ignition': {
        cam.position.copyFromFloats(PAD.x - 6.5, PAD.y + 1.5, PAD.z + 10);
        cam.setTarget(PAD.add(new Vector3(0, 1, 0)));
        break;
      }
      case 'tracker': {
        const rise = easeInOut(u) * 26;
        if (rocket) rocket.position.y = PAD.y + rise;
        cam.position.copyFromFloats(PAD.x - 12, PAD.y + rise * 0.55 + 1.5, PAD.z + 16);
        cam.setTarget(rocket ? rocket.position : PAD.add(new Vector3(0, rise * 0.5, 0)));
        break;
      }
      case 'onboard': {
        const rise = 26 + easeInOut(u) * 30;
        if (rocket) rocket.position.y = PAD.y + rise;
        cam.parent = rocket;
        cam.position.copyFromFloats(0.9, 0.6, 0);
        cam.setTarget(new Vector3(0, -2, 0));
        break;
      }
      case 'orbit': {
        cam.parent = null;
        const ang = u * Math.PI * 0.9;
        const r = ALT.ORBIT_Y - ALT.SURFACE_Y + 6;
        cam.position = new Vector3(
          Math.cos(ang) * r,
          ALT.SURFACE_Y + r * 0.35,
          Math.sin(ang) * r,
        );
        cam.setTarget(Vector3.Zero());
        break;
      }
      case 'dock': {
        const port = iss.port.getAbsolutePosition();
        const axis = iss.portAxisWorld().scale(-1); // approach from outside
        const d = lerp(60, 2.2, easeInOut(u));
        cam.position.copyFrom(port.add(axis.scale(d)));
        cam.setTarget(port);
        break;
      }
    }
  };

  return {
    get countdown() { return countdown; },
    get camera() { return cam; },
    get elapsed() { return t; },
    update(dt) {
      t += dt;
      const edge = tickAt(t);
      if (edge !== null && edge !== lastTick) {
        lastTick = edge;
        countdown = edge;
        return true;
      }
      countdown = null;
      if (t >= TOTAL_S) return false;
      applyShot(shotAt(t), t - shotAt(t).start);
      return true;
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
function lerpVec(a: Vector3, b: Vector3, t: number): Vector3 {
  return new Vector3(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
}
