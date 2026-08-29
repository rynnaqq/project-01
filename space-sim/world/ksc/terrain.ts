// space-sim/world/ksc/terrain.ts
import {
  Color3, DynamicTexture, GroundMesh, Mesh, MeshBuilder, StandardMaterial,
  Texture, TransformNode, type Scene,
} from "@babylonjs/core";
import { fbm2, valueNoise2 } from "../../core/noise";
import type { Assets } from "../../core/assets";

const SIZE = 16000;
const SUB = 128;

export function terrainHeight(x: number, z: number): number {
  const base = fbm2(x * 0.00008, z * 0.00008, 4) * 14;
  const dunes = valueNoise2(x * 0.0012, z * 0.0012) * 2.2;
  // Flat pad zone around origin
  const padDist = Math.hypot(x, z);
  const flat = Math.min(1, Math.max(0, (padDist - 220) / 400));
  return (base + dunes) * flat;
}

export function createTerrain(scene: Scene, assets: Assets): TransformNode {
  const root = new TransformNode("kscTerrain", scene);

  const ground = MeshBuilder.CreateGround("kscGround", { width: SIZE, height: SIZE, subdivisions: SUB }, scene) as GroundMesh;
  const pos = ground.getVerticesData("position")!;
  for (let i = 0; i < pos.length; i += 3) {
    pos[i + 1] = terrainHeight(pos[i], pos[i + 2]);
  }
  ground.updateVerticesData("position", pos);
  ground.createNormals(false);
  ground.material = ((): StandardMaterial => {
    const m = new StandardMaterial("terrainMat", scene);
    const splat = new DynamicTexture("splat", { width: 1024, height: 1024 }, scene, true);
    const ctx = splat.getContext() as unknown as CanvasRenderingContext2D;
    // Base grass
    ctx.fillStyle = "#5a6b3a"; ctx.fillRect(0, 0, 1024, 1024);
    // Marsh patches (low noise areas)
    for (let y = 0; y < 1024; y += 4) {
      for (let x = 0; x < 1024; x += 4) {
        const wx = (x / 1024 - 0.5) * SIZE;
        const wz = (y / 1024 - 0.5) * SIZE;
        const n = fbm2(wx * 0.0002, wz * 0.0002, 3);
        if (n < -0.25) { ctx.fillStyle = "#46583f"; ctx.fillRect(x, y, 4, 4); }
        if (n < -0.42) { ctx.fillStyle = "#3f5a54"; ctx.fillRect(x, y, 4, 4); }
        // Crawlerway corridor: from VAB (-3200,-2800) to pad (0,0), 30m wide, asphalt
        const t = (wx * -3200 + wz * -2800) / (3200 * 3200 + 2800 * 2800);
        const cx = -3200 * t, cz = -2800 * t;
        const dist = Math.hypot(wx - cx, wz - cz);
        if (t >= 0 && t <= 1 && dist < 18) { ctx.fillStyle = "#3c3d3f"; ctx.fillRect(x, y, 4, 4); }
        // Beach + ocean floor east
        if (wx > 2400) { ctx.fillStyle = wx > 2600 ? "#1d3a4d" : "#c9bd9a"; ctx.fillRect(x, y, 4, 4); }
      }
    }
    splat.update();
    m.diffuseTexture = splat;
    m.specularColor = new Color3(0.03, 0.03, 0.03);
    return m;
  })();
  ground.isPickable = false;
  ground.parent = root;

  // Ocean plane with animated shimmer (vertex shader-free: animated bump via uOffset)
  const ocean = MeshBuilder.CreateGround("ocean", { width: SIZE, height: SIZE, subdivisions: 32 }, scene);
  ocean.position.x = SIZE / 2 + 2400;
  ocean.position.y = 0.15;
  const oceanMat = new StandardMaterial("oceanMat", scene);
  oceanMat.diffuseColor = new Color3(0.05, 0.18, 0.28);
  oceanMat.specularColor = new Color3(0.9, 0.95, 1.0);
  oceanMat.specularPower = 180;
  oceanMat.bumpTexture = ((): Texture => {
    const dt = new DynamicTexture("oceanBump", { width: 512, height: 512 }, scene, true);
    const c = dt.getContext() as unknown as CanvasRenderingContext2D;
    c.fillStyle = "#8080ff"; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2200; i++) {
      const x = Math.random() * 512, y = Math.random() * 512;
      c.strokeStyle = `rgba(${160 + Math.random() * 60},${160 + Math.random() * 60},255,0.5)`;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 6 + Math.random() * 10, y + Math.random() * 3); c.stroke();
    }
    dt.update();
    dt.uOffset = 0;
    return dt;
  })();
  (oceanMat.bumpTexture as Texture).uScale = 40;
  (oceanMat.bumpTexture as Texture).vScale = 40;
  ocean.material = oceanMat;
  ocean.isPickable = false;
  ocean.parent = root;

  // Vegetation billboards scattered on land
  const veg = new TransformNode("vegetation", scene);
  veg.parent = root;
  const bushTex = new DynamicTexture("bushTex", { width: 128, height: 128 }, scene, true);
  const bc = bushTex.getContext() as unknown as CanvasRenderingContext2D;
  bc.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 60; i++) {
    bc.fillStyle = `rgba(${30 + Math.random() * 30},${70 + Math.random() * 50},${25 + Math.random() * 20},1)`;
    bc.beginPath();
    bc.ellipse(64 + (Math.random() - 0.5) * 50, 90 + (Math.random() - 0.5) * 30, 12 + Math.random() * 22, 8 + Math.random() * 14, 0, 0, Math.PI * 2);
    bc.fill();
  }
  bushTex.hasAlpha = true;
  bushTex.update();
  const bushMat = new StandardMaterial("bushMat", scene);
  bushMat.diffuseTexture = bushTex;
  bushMat.useAlphaFromDiffuseTexture = true;
  bushMat.backFaceCulling = false;
  bushMat.specularColor = new Color3(0, 0, 0);
  let placed = 0;
  for (let i = 0; i < 900 && placed < 220; i++) {
    const x = (Math.random() - 0.5) * SIZE * 0.9;
    const z = (Math.random() - 0.5) * SIZE * 0.9;
    const padDist = Math.hypot(x, z);
    if (padDist < 300 || x > 2400) continue;
    const h = terrainHeight(x, z);
    const card = MeshBuilder.CreatePlane(`bush${i}`, { width: 7, height: 4.5 }, scene);
    card.position.set(x, h + 2.0, z);
    card.billboardMode = Mesh.BILLBOARDMODE_Y;
    card.material = bushMat;
    card.isPickable = false;
    card.parent = veg;
    placed++;
  }

  void assets; // terrain uses its own splat texture; assets kept for API stability
  return root;
}
