// space-sim/iss.ts
/**
 * CONTENT layer: procedural low-poly ISS (PRD §B.9) with a docking port
 * transform. The port's local +Z is the approach axis; portAxisWorld()
 * returns it in world space for alignment checks.
 */
import {
  Color3, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3,
} from '@babylonjs/core';

export interface IssRig {
  root: TransformNode;
  /** Docking port transform; local +Z points along the approach corridor. */
  port: TransformNode;
  portAxisWorld(): Vector3;
  dispose(): void;
}

export function createIss(scene: Scene, position: Vector3): IssRig {
  const root = new TransformNode('iss', scene);
  root.position = position;

  const hullMat = new StandardMaterial('issHull', scene);
  hullMat.diffuseColor = new Color3(0.75, 0.75, 0.78);
  hullMat.specularColor = new Color3(0.2, 0.2, 0.2);

  const panelMat = new StandardMaterial('issPanel', scene);
  panelMat.diffuseColor = new Color3(0.1, 0.15, 0.45);
  panelMat.specularColor = new Color3(0.5, 0.5, 0.6);

  const goldMat = new StandardMaterial('issGold', scene);
  goldMat.diffuseColor = new Color3(0.8, 0.6, 0.2);

  // Main truss along X.
  const truss = MeshBuilder.CreateBox('issTruss', { width: 22, height: 0.8, depth: 0.8 }, scene);
  truss.material = hullMat;
  truss.parent = root;

  // Habitat modules along the truss center.
  const hab = MeshBuilder.CreateCylinder('issHab', { diameter: 2.4, height: 8, tessellation: 12 }, scene);
  hab.rotation.z = Math.PI / 2;
  hab.material = hullMat;
  hab.parent = root;

  const node = MeshBuilder.CreateSphere('issNode', { diameter: 3, segments: 10 }, scene);
  node.material = goldMat;
  node.parent = root;

  // Solar arrays paired on both sides of the truss.
  for (const side of [-1, 1]) {
    for (const wing of [-1, 1]) {
      const panel = MeshBuilder.CreateBox('issPanel', { width: 5, height: 0.1, depth: 9 }, scene);
      panel.position = new Vector3(side * 8.5, 0, wing * 5.5);
      panel.material = panelMat;
      panel.parent = root;
    }
  }

  // Docking port on the +Z face of the node module.
  const port = new TransformNode('issPort', scene);
  port.parent = root;
  port.position = new Vector3(0, 0, 2.2);
  const ring = MeshBuilder.CreateTorus('issPortRing', { diameter: 1.6, thickness: 0.25, tessellation: 20 }, scene);
  ring.rotation.x = Math.PI / 2;
  ring.material = goldMat;
  ring.parent = port;

  return {
    root,
    port,
    portAxisWorld(): Vector3 {
      return Vector3.TransformNormal(new Vector3(0, 0, 1), port.getWorldMatrix()).normalize();
    },
    dispose(): void {
      root.dispose();
    },
  };
}
