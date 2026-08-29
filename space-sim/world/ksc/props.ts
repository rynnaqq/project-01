// space-sim/world/ksc/props.ts
import {
  Color3, MeshBuilder, StandardMaterial, TransformNode, type Scene,
} from "@babylonjs/core";
import type { Assets } from "../../core/assets";
import { terrainHeight } from "./terrain";

function terrainHeightSafe(x: number, z: number): number {
  return Math.max(terrainHeight(x, z), 0.1) + 0.05;
}

function van(scene: Scene, x: number, z: number, ry: number, color: Color3): TransformNode {
  const v = new TransformNode(`van_${x}_${z}`, scene);
  v.position.set(x, terrainHeightSafe(x, z), z);
  v.rotation.y = ry;
  const body = MeshBuilder.CreateBox("vanBody", { width: 5.5, height: 2.2, depth: 2.2 }, scene);
  body.position.y = 1.4;
  body.parent = v;
  const cab = MeshBuilder.CreateBox("vanCab", { width: 1.6, height: 1.6, depth: 2.1 }, scene);
  cab.position.set(-3.2, 1.1, 0);
  cab.parent = v;
  const m = new StandardMaterial("vanMat", scene);
  m.diffuseColor = color;
  body.material = m; cab.material = m;
  for (const [wx, wz] of [[-1.8, 1.1], [1.8, 1.1], [-1.8, -1.1], [1.8, -1.1]]) {
    const wheel = MeshBuilder.CreateCylinder("wheel", { diameter: 0.8, height: 0.4 }, scene);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.4, wz);
    wheel.parent = v;
  }
  return v;
}

function person(scene: Scene, x: number, z: number, suit: StandardMaterial): TransformNode {
  const p = new TransformNode(`person_${x}_${z}`, scene);
  p.position.set(x, terrainHeightSafe(x, z), z);
  p.rotation.y = Math.random() * Math.PI * 2;
  const torso = MeshBuilder.CreateCapsule("torso", { height: 0.9, radius: 0.22 }, scene);
  torso.position.y = 1.15;
  torso.material = suit;
  torso.parent = p;
  const head = MeshBuilder.CreateSphere("head", { diameter: 0.26 }, scene);
  head.position.y = 1.75;
  head.material = suit;
  head.parent = p;
  const legs = MeshBuilder.CreateBox("legs", { width: 0.34, height: 0.8, depth: 0.24 }, scene);
  legs.position.y = 0.4;
  legs.material = suit;
  legs.parent = p;
  return p;
}

export function createProps(scene: Scene, assets: Assets): TransformNode {
  const root = new TransformNode("kscProps", scene);

  // Perimeter road: ring of asphalt quads around pad (r=220)
  const road = MeshBuilder.CreateGround("perimeterRoad", { width: 620, height: 620 }, scene);
  road.position.y = 0.22;
  const roadMat = assets.asphalt();
  road.material = roadMat;
  road.isPickable = false;
  // Punch visual: road is a thin ring via scaling — approximate with large flat ring
  road.scaling.y = 0.0001;
  road.parent = root;
  const ring = MeshBuilder.CreateTorus("roadRing", { diameter: 460, thickness: 12, tessellation: 64 }, scene);
  ring.position.y = 0.24;
  ring.scaling.y = 0.02;
  ring.material = roadMat;
  ring.parent = root;

  // Fence posts along access road from VAB
  for (let i = 0; i < 40; i++) {
    const t = i / 39;
    const x = -3200 * (1 - t) + 0 * t - 30;
    const z = -2800 * (1 - t) + 30;
    const post = MeshBuilder.CreateBox("fencePost", { width: 0.15, height: 2.4, depth: 0.15 }, scene);
    post.position.set(x, terrainHeightSafe(x, z) + 1.2, z + 26);
    post.material = assets.steelStructure();
    post.parent = root;
  }

  // Pad signs
  for (const [x, z, ry] of [[-120, -60, 0.6], [90, 80, -2.2], [-40, 110, 0]]) {
    const post = MeshBuilder.CreateBox("signPost", { width: 0.3, height: 3.4, depth: 0.3 }, scene);
    post.position.set(x, terrainHeightSafe(x, z) + 1.7, z);
    post.material = assets.steelStructure();
    post.parent = root;
    const board = MeshBuilder.CreatePlane("signBoard", { width: 3.4, height: 1.4 }, scene);
    board.position.set(x, terrainHeightSafe(x, z) + 2.9, z);
    board.rotation.y = ry;
    const m = new StandardMaterial(`signMat_${x}`, scene);
    m.diffuseTexture = assets.labelCanvas("LC-39A", 512, 192);
    board.material = m;
    board.parent = root;
  }

  // Light poles around pad
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = Math.cos(a) * 200, z = Math.sin(a) * 200;
    const pole = MeshBuilder.CreateCylinder("lightPole", { diameter: 0.4, height: 14 }, scene);
    pole.position.set(x, terrainHeightSafe(x, z) + 7, z);
    pole.material = assets.steelStructure();
    pole.parent = root;
    const lamp = MeshBuilder.CreateBox("lamp", { width: 2, height: 0.4, depth: 1 }, scene);
    lamp.position.set(x, terrainHeightSafe(x, z) + 14, z);
    lamp.material = assets.paintedWhite();
    lamp.parent = root;
  }

  // Service vehicles cluster (pad west apron)
  const white = new Color3(0.92, 0.92, 0.9);
  const red = new Color3(0.75, 0.12, 0.1);
  const yellow = new Color3(0.85, 0.7, 0.1);
  van(scene, -70, -40, 0.4, white); van(scene, -78, -34, -0.8, white);
  van(scene, -62, -50, 1.2, white); van(scene, -88, -28, 0.1, red);
  van(scene, -56, -28, 2.4, yellow); van(scene, -70, -60, -1.1, white);
  van(scene, -95, -44, 0.7, white); van(scene, -48, -64, 2.9, white);

  // Personnel near vehicles
  const suit = new StandardMaterial("suit", scene);
  suit.diffuseColor = new Color3(0.85, 0.86, 0.88);
  const orange = new StandardMaterial("suitOrange", scene);
  orange.diffuseColor = new Color3(0.95, 0.45, 0.08);
  for (const [x, z] of [[-66, -36], [-74, -46], [-58, -44], [-84, -38], [-68, -28], [-90, -52]]) {
    person(scene, x, z, Math.random() < 0.5 ? suit : orange);
  }

  // Distant parking lot west
  const lot = MeshBuilder.CreateGround("parkingLot", { width: 120, height: 80 }, scene);
  lot.position.set(-400, terrainHeightSafe(-400, 200) + 0.03, 200);
  lot.material = assets.asphalt();
  lot.parent = root;

  // Crew-quarters anchor node at the O&C building (used by the pov_crew_prep rig)
  const crewQuarters = new TransformNode("crewQuarters", scene);
  crewQuarters.position.set(-3050, terrainHeightSafe(-3050, -2850), -2850);
  crewQuarters.parent = root;

  return root;
}
