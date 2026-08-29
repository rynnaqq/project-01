// space-sim/world/ksc/pad.ts
import { MeshBuilder, TransformNode, Vector3, type Scene } from "@babylonjs/core";
import type { Assets } from "../../core/assets";

export function createPad(scene: Scene, assets: Assets): TransformNode {
  const root = new TransformNode("pad39a", scene);

  const deck = MeshBuilder.CreateBox("padDeck", { width: 130, depth: 130, height: 14 }, scene);
  deck.position.y = 7;
  deck.material = assets.concretePad();
  deck.parent = root;

  // Flame trench: two openings below deck (visual recess)
  const trench = MeshBuilder.CreateBox("trench", { width: 24, height: 12, depth: 60 }, scene);
  trench.position.set(0, 6, 0);
  trench.material = assets.blackTile();
  trench.parent = root;
  const mouth = MeshBuilder.CreateBox("trenchMouth", { width: 24, height: 12, depth: 60 }, scene);
  mouth.position.set(0, 6, -60);
  mouth.material = assets.blackTile();
  mouth.parent = root;

  // Hold-down posts (4 corners of engine area)
  for (const [x, z] of [[-18, -18], [18, -18], [-18, 18], [18, 18]]) {
    const post = MeshBuilder.CreateBox("holdPost", { width: 3, height: 6, depth: 3 }, scene);
    post.position.set(x, 17, z);
    post.material = assets.steelStructure();
    post.parent = root;
  }

  // Lightning masts (3, ~180 m)
  const mastPositions: Array<[number, number]> = [[-90, -90], [90, -90], [0, 105]];
  mastPositions.forEach(([x, z], i) => {
    const mast = MeshBuilder.CreateCylinder(`mast${i}`, { diameterTop: 1.2, diameterBottom: 3.4, height: 180, tessellation: 8 }, scene);
    mast.position.set(x, 14 + 90, z);
    mast.material = assets.steelStructure();
    mast.parent = root;
    const guy = MeshBuilder.CreateCylinder(`mastCable${i}`, { diameter: 0.08, height: 185 }, scene);
    guy.rotation.x = 0.12;
    guy.position.set(x, 14 + 92, z + 1.5);
    guy.material = assets.steelStructure();
    guy.parent = root;
  });

  // Water tower (sound suppression)
  const tower = MeshBuilder.CreateCylinder("waterTower", { diameter: 12, height: 34, tessellation: 16 }, scene);
  tower.position.set(-75, 14 + 17, 30);
  tower.material = assets.paintedWhite();
  tower.parent = root;
  const tank = MeshBuilder.CreateCylinder("waterTank", { diameter: 14, height: 12, tessellation: 16 }, scene);
  tank.position.set(-75, 14 + 40, 30);
  tank.material = assets.paintedWhite();
  tank.parent = root;

  // Perimeter berm
  const berm = MeshBuilder.CreateTorus("berm", { diameter: 300, thickness: 18, tessellation: 48 }, scene);
  berm.position.y = 1.4;
  berm.scaling.y = 0.16;
  berm.material = assets.grass();
  berm.parent = root;

  root.position = new Vector3(0, 0, 0);
  return root;
}
