// space-sim/world/ksc/vab.ts
import {
  Color3, DynamicTexture, MeshBuilder, StandardMaterial, TransformNode, Vector3,
  type Scene,
} from "@babylonjs/core";
import type { Assets } from "../../core/assets";

const VAB_POS = new Vector3(-3200, 0, -2800);

function ribbedWallMat(scene: Scene): StandardMaterial {
  const m = new StandardMaterial("vabWall", scene);
  m.diffuseTexture = new DynamicTexture("vabWallTex", { width: 512, height: 512 }, scene, true);
  const c = m.diffuseTexture as DynamicTexture;
  const ctx = c.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = "#b9bcb9"; ctx.fillRect(0, 0, 512, 512);
  for (let x = 0; x <= 512; x += 24) {
    ctx.fillStyle = "rgba(140,145,142,0.85)"; ctx.fillRect(x, 0, 6, 512);
    ctx.fillStyle = "rgba(220,224,220,0.5)"; ctx.fillRect(x + 6, 0, 3, 512);
  }
  // weather streaks
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = `rgba(90,92,88,${Math.random() * 0.2})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 200, 1 + Math.random() * 2, 60 + Math.random() * 250);
  }
  c.update();
  return m;
}

function flagDoorMat(scene: Scene): StandardMaterial {
  const m = new StandardMaterial("vabFlag", scene);
  m.diffuseTexture = new DynamicTexture("vabFlagTex", { width: 1024, height: 512 }, scene, true);
  const c = m.diffuseTexture as DynamicTexture;
  const ctx = c.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = "#c3c6c3"; ctx.fillRect(0, 0, 1024, 512);
  // US flag 64.4m x 33.5m proportional
  const fw = 560, fh = 300, fx = 120, fy = 90;
  for (let i = 0; i < 13; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#b22234" : "#ffffff";
    ctx.fillRect(fx, fy + (i * fh) / 13, fw, fh / 13);
  }
  ctx.fillStyle = "#3c3b6e"; ctx.fillRect(fx, fy, fw * 0.4, fh * (7 / 13));
  ctx.fillStyle = "#fff";
  for (let r = 0; r < 9; r++) for (let s = 0; s < 11; s++) {
    if ((r + s) % 2 === 0) ctx.fillRect(fx + 8 + s * 18, fy + 8 + r * 20, 5, 5);
  }
  // NASA meatball right of flag
  const mx = 800, my = 200, mr = 130;
  ctx.fillStyle = "#0b3d91"; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(mx, my - 20, mr, mr * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#0b3d91"; ctx.font = "bold 44px monospace"; ctx.fillText("NASA", mx - 55, my + 16);
  ctx.strokeStyle = "#fc3d21"; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(mx - mr * 0.9, my + 60); ctx.quadraticCurveTo(mx, my - 90, mx + mr * 0.9, my + 40); ctx.stroke();
  c.update();
  return m;
}

export function createVab(scene: Scene, assets: Assets): TransformNode {
  const root = new TransformNode("vab", scene);
  root.position = VAB_POS;
  const wall = ribbedWallMat(scene);
  const roofMat = new StandardMaterial("vabRoof", scene);
  roofMat.diffuseColor = new Color3(0.35, 0.36, 0.37);

  // Main volume 218 x 160 x 158 (x=long axis, y=height, z=width)
  const body = MeshBuilder.CreateBox("vabBody", { width: 218, height: 160, depth: 158 }, scene);
  body.position.y = 80;
  body.material = wall;
  body.parent = root;

  // Ribbed vertical strip detail (east high-bay face): 4 bays separated by recessed columns
  for (let i = 0; i < 5; i++) {
    const col = MeshBuilder.CreateBox(`vabCol${i}`, { width: 14, height: 160, depth: 6 }, scene);
    col.position.set(-109 + i * 54.5, 80, 76);
    col.material = assets.steelStructure();
    col.parent = root;
  }

  // Transfer aisle / low bay (south annex, shorter)
  const lowBay = MeshBuilder.CreateBox("vabLowBay", { width: 96, height: 60, depth: 70 }, scene);
  lowBay.position.set(0, 30, -114);
  lowBay.material = wall;
  lowBay.parent = root;

  // Roof AC units
  for (let i = 0; i < 8; i++) {
    const ac = MeshBuilder.CreateBox(`vabAc${i}`, { width: 10, height: 4, depth: 8 }, scene);
    ac.position.set(-90 + i * 26, 162, -40 + (i % 2) * 60);
    ac.material = roofMat;
    ac.parent = root;
  }

  // Flag/meatball on the south face (facing launch complex + tourists)
  const face = MeshBuilder.CreatePlane("vabFace", { width: 102, height: 51 }, scene);
  face.position.set(0, 95, -158.6);
  face.rotation.y = Math.PI;
  face.material = flagDoorMat(scene);
  face.parent = root;

  // Four high-bay doors on east face (dark recessed rectangles)
  const doorMat = new StandardMaterial("vabDoor", scene);
  doorMat.diffuseColor = new Color3(0.12, 0.13, 0.14);
  for (let i = 0; i < 4; i++) {
    const door = MeshBuilder.CreatePlane(`vabDoor${i}`, { width: 45, height: 139 }, scene);
    door.position.set(-82 + i * 54.5, 69.5, 79.15);
    door.material = doorMat;
    door.parent = root;
  }

  // Ground apron
  const apron = MeshBuilder.CreateGround("vabApron", { width: 340, height: 300 }, scene);
  apron.position.y = 0.05;
  apron.material = assets.concrete();
  apron.parent = root;

  return root;
}

export function createFacilityCluster(scene: Scene, assets: Assets): TransformNode {
  const root = new TransformNode("facilityCluster", scene);
  const buildings: Array<[number, number, number, number, number]> = [
    // x, z, w, h, d  (relative to root at -2000, -3600)
    [0, 0, 120, 24, 60], [180, -80, 80, 14, 50], [-160, 60, 60, 30, 40],
    [320, 40, 90, 18, 55], [-60, -160, 70, 12, 45], [140, 160, 55, 40, 40],
  ];
  for (let i = 0; i < buildings.length; i++) {
    const [x, z, w, h, d] = buildings[i];
    const b = MeshBuilder.CreateBox(`fac${i}`, { width: w, height: h, depth: d }, scene);
    b.position.set(x, h / 2, z);
    b.material = i % 2 === 0 ? assets.paintedWhite() : assets.concrete();
    b.parent = root;
  }
  root.position.set(-2000, 0, -3600);
  return root;
}
