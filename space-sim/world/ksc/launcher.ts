// space-sim/world/ksc/launcher.ts
import { MeshBuilder, TransformNode, type Scene } from "@babylonjs/core";
import type { Assets } from "../../core/assets";

export interface MobileLauncher {
  root: TransformNode;
  arms: TransformNode[];
  /** k: 0 = mated, 1 = fully retracted. Called at ignition. */
  retractArms(k: number): void;
}

export function createMobileLauncher(scene: Scene, assets: Assets): MobileLauncher {
  const root = new TransformNode("mobileLauncher", scene);
  root.position.set(0, 14, 0); // sits on pad deck

  // Base
  const base = MeshBuilder.CreateBox("mlBase", { width: 40, depth: 34, height: 7.6 }, scene);
  base.position.y = 3.8;
  base.material = assets.steelStructure();
  base.parent = root;

  // Deck plate with launch mount hole illusion (darker center box)
  const mount = MeshBuilder.CreateBox("mlMount", { width: 18, depth: 18, height: 2.4 }, scene);
  mount.position.y = 8.8;
  mount.material = assets.steelStructure();
  mount.parent = root;

  // Tower (west of stack, like LC-39A ML)
  const tower = MeshBuilder.CreateBox("mlTower", { width: 12, depth: 12, height: 120 }, scene);
  tower.position.set(-26, 60 + 7.6, 0);
  tower.material = assets.steelStructure();
  tower.parent = root;
  // Tower lattice lines
  for (let y = 10; y < 120; y += 10) {
    const ring = MeshBuilder.CreateBox(`mlRing${y}`, { width: 13, depth: 13, height: 0.8 }, scene);
    ring.position.set(-26, y + 7.6, 0);
    ring.material = assets.steelStructure();
    ring.parent = root;
  }

  // Swing arms: 9, at increasing heights, extending east toward the stack
  const arms: TransformNode[] = [];
  const armHeights = [18, 30, 42, 54, 66, 78, 90, 102, 114];
  armHeights.forEach((h, i) => {
    const pivot = new TransformNode(`armPivot${i}`, scene);
    pivot.position.set(-20, h + 7.6, (i % 3 - 1) * 6);
    pivot.parent = root;
    const arm = MeshBuilder.CreateBox(`arm${i}`, { width: 16, depth: 1.6, height: 1.2 }, scene);
    arm.position.set(8, 0, 0);
    arm.material = assets.steelStructure();
    arm.parent = pivot;
    const boom = MeshBuilder.CreateCylinder(`armBoom${i}`, { diameter: 0.5, height: 12 }, scene);
    boom.rotation.z = Math.PI / 2;
    boom.position.set(8, -0.8, 0);
    boom.material = assets.steelStructure();
    boom.parent = pivot;
    arms.push(pivot);
  });

  const retractArms = (k: number): void => {
    arms.forEach((pivot, i) => {
      pivot.rotation.y = -k * (1.1 + i * 0.06);
    });
  };

  return { root, arms, retractArms };
}

export function createCrawler(scene: Scene, assets: Assets): TransformNode {
  const root = new TransformNode("crawler", scene);
  root.position.set(-1600, 0, -1400); // parked on crawlerway
  root.rotation.y = Math.atan2(3200, 2800); // aligned toward pad
  const body = MeshBuilder.CreateBox("crawlerBody", { width: 40, depth: 35, height: 6 }, scene);
  body.position.y = 3;
  body.material = assets.steelStructure();
  body.parent = root;
  for (const [x, z] of [[-14, -13], [14, -13], [-14, 13], [14, 13]]) {
    const treads = MeshBuilder.CreateBox("crawlerTread", { width: 10, depth: 8, height: 2.4 }, scene);
    treads.position.set(x, 1.2, z);
    treads.material = assets.blackTile();
    treads.parent = root;
  }
  const cab = MeshBuilder.CreateBox("crawlerCab", { width: 6, depth: 5, height: 3 }, scene);
  cab.position.set(-16, 7.5, 0);
  cab.material = assets.paintedWhite();
  cab.parent = root;
  return root;
}
