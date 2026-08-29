// space-sim/world/space.ts
import {
  CloudPoint, Color4, Mesh, PointsCloudSystem, Vector3, type Scene,
} from "@babylonjs/core";

/** Realistic starfield: small varied points + Milky Way density band. */
export function createStarfield(scene: Scene): void {
  // Radius 2e7 must stay under every camera's maxZ (2.5e7) or the stars are clipped away.
  const RADIUS = 2e7;
  const COUNT = 6500;
  const pcs = new PointsCloudSystem("stars", 1.2, scene);
  pcs.addPoints(COUNT, (p: CloudPoint) => {
    // Uniform sphere direction
    let u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    let dir = new Vector3(r * Math.cos(theta), u, r * Math.sin(theta));
    // Milky Way: bias density toward a band (plane normal tilted)
    const band = Math.abs(dir.y * 0.5 + dir.x * 0.85);
    if (Math.random() < 0.55 && band < 0.18) {
      u = (Math.random() * 2 - 1) * 0.18;
      const th2 = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(1 - u * u);
      dir = new Vector3(rr * Math.cos(th2), u, rr * Math.sin(th2));
    }
    p.position = dir.scale(RADIUS);
    // Magnitude distribution: many dim, few bright; temperature tint
    const mag = Math.pow(Math.random(), 2.2);
    const warm = Math.random();
    const base = 0.35 + mag * 0.65;
    p.color = new Color4(
      base * (warm > 0.7 ? 1.0 : 0.85 + warm * 0.2),
      base * 0.92,
      base * (warm < 0.3 ? 1.0 : 0.85 + (1 - warm) * 0.15),
      0.5 + mag * 0.5,
    );
  });
  pcs.buildMeshAsync().then((mesh: Mesh) => {
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
  });
}
