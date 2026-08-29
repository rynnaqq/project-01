// space-sim/iss/interior.ts
import {
  Color3, Mesh, MeshBuilder, PBRMaterial, PointLight, TransformNode, Vector3, type Scene,
} from "@babylonjs/core";
import type { Assets } from "../core/assets";
import type { IssExterior } from "./exterior";

export interface BoxCollider { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }

export interface IssInterior {
  root: TransformNode;
  spawn: TransformNode;
  colliders: BoxCollider[];
  cupolaLook: Vector3;
}

const R = 2.0; // usable interior radius (module Ø4.6)
const MODULE_Y = -2.5; // module axis height on the ISS root (matches iss/exterior.ts)
const PANELS = 12;
const CHORD = (2 * Math.PI * R) / PANELS + 0.06;

// Pressurized layout mirrored from iss/exterior.ts (authoritative geometry).
const HARMONY_Z = 6.4; const HARMONY_LEN = 7.2; // spans z 2.8..10.0
const UNITY_LEN = 5.5; // spans z -2.75..2.75
const DESTINY_Z = -7; const DESTINY_LEN = 8.5; // spans z -11.25..-2.75, Ø4.3
const TRANQ = { x: 0, z: -1.5, y0: -4.55, y1: -11.35 }; // vertical berth tube below Unity
const CUPOLA = { x: 0, y: -12.3, z: -1.5, size: 1.5 }; // inside the exterior cupola polyhedron

/** Tight AABB around a flat rectangular wall patch spanned by ±halfW·u and ±halfH·w. */
function patchAABB(c: Vector3, u: Vector3, w: Vector3, halfW: number, halfH: number, pad: number): BoxCollider {
  const xs: number[] = []; const ys: number[] = []; const zs: number[] = [];
  for (const su of [-1, 1]) {
    for (const sw of [-1, 1]) {
      xs.push(c.x + su * halfW * u.x + sw * halfH * w.x);
      ys.push(c.y + su * halfW * u.y + sw * halfH * w.y);
      zs.push(c.z + su * halfW * u.z + sw * halfH * w.z);
    }
  }
  return {
    min: { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, z: Math.min(...zs) - pad },
    max: { x: Math.max(...xs) + pad, y: Math.max(...ys) + pad, z: Math.max(...zs) + pad },
  };
}

export function createIssInterior(scene: Scene, assets: Assets, exterior: IssExterior): IssInterior {
  const root = new TransformNode("issInterior", scene);
  root.parent = exterior.root;
  const colliders: BoxCollider[] = [];

  const wall = assets.interiorWall();
  const rail = assets.handrail();
  const bag = assets.fabricBag();
  const lap = assets.laptop();

  const labelMats = new Map<string, PBRMaterial>();
  const labelMat = (text: string): PBRMaterial => {
    let m = labelMats.get(text);
    if (!m) {
      m = new PBRMaterial(`lblmat_${text}`, scene);
      const tex = assets.labelCanvas(text, 256, 64);
      m.albedoTexture = tex;
      m.emissiveTexture = tex;
      m.emissiveIntensity = 0.35;
      labelMats.set(text, m);
    }
    return m;
  };

  /** One wall panel patch + its collider. Local frame: radial +x, tangent/width, axis/height. */
  const panel = (
    name: string, pivot: TransformNode, childRot: [number, number, number],
    center: Vector3, u: Vector3, w: Vector3, width: number, height: number,
  ): void => {
    const p = MeshBuilder.CreatePlane(name, { width, height, sideOrientation: Mesh.DOUBLESIDE }, scene);
    p.rotation.set(...childRot);
    p.position.set(R + 0.01, 0, 0);
    p.material = wall;
    p.parent = pivot;
    colliders.push(patchAABB(center, u, w, width / 2, height / 2, 0.02));
  };

  /** Z-axis tube: 12 wall panels ringed in XY over [z0,z1] at x=0. Panels within ±45° of
   *  straight-down are split around the Tranquility floor hatch at (hz ± half). */
  const tubeZ = (name: string, z0: number, z1: number, hatch?: { z: number; half: number }, skipFarRing = false): void => {
    for (let i = 0; i < PANELS; i++) {
      const am = (i / PANELS) * Math.PI * 2;
      const down = Math.abs(Math.atan2(Math.sin(am - 1.5 * Math.PI), Math.cos(am - 1.5 * Math.PI))) < Math.PI / 4;
      const spans: Array<[number, number]> = down && hatch
        ? [[z0, hatch.z - hatch.half], [hatch.z + hatch.half, z1]]
        : [[z0, z1]];
      for (const [s0, s1] of spans) {
        const zMid = (s0 + s1) / 2;
        const pivot = new TransformNode(`${name}_pv${i}_${s0.toFixed(2)}`, scene);
        pivot.position.set(0, MODULE_Y, zMid);
        pivot.rotation.z = am;
        pivot.parent = root;
        const center = new Vector3(Math.cos(am) * (R + 0.01), MODULE_Y + Math.sin(am) * (R + 0.01), zMid);
        panel(`${name}_p${i}_${s0.toFixed(2)}`, pivot, [0, Math.PI / 2, Math.PI / 2],
          center, new Vector3(-Math.sin(am), Math.cos(am), 0), new Vector3(0, 0, 1), CHORD, s1 - s0);
      }
    }
    for (const zz of skipFarRing ? [z0] : [z0, z1]) {
      const ring = MeshBuilder.CreateTorus(`${name}_ring${zz}`, { diameter: R * 2, thickness: 0.12, tessellation: 24 }, scene);
      ring.position.set(0, MODULE_Y, zz);
      ring.material = rail;
      ring.parent = root;
    }
  };
  /** Vertical (Y-axis) tube: 12 wall panels ringed in XZ between y0..y1 at (x, z). */
  const tubeY = (name: string, x: number, z: number, y0: number, y1: number): void => {
    const len = y0 - y1;
    for (let i = 0; i < PANELS; i++) {
      const am = (i / PANELS) * Math.PI * 2;
      const pivot = new TransformNode(`${name}_pv${i}`, scene);
      pivot.position.set(x, (y0 + y1) / 2, z);
      pivot.rotation.y = am;
      pivot.parent = root;
      const center = new Vector3(x + Math.cos(am) * (R + 0.01), (y0 + y1) / 2, z - Math.sin(am) * (R + 0.01));
      panel(`${name}_p${i}`, pivot, [0, Math.PI / 2, 0],
        center, new Vector3(Math.sin(am), 0, Math.cos(am)), Vector3.Up(), CHORD, len);
    }
    for (const yy of [y0, y1]) {
      const ring = MeshBuilder.CreateTorus(`${name}_ring${yy}`, { diameter: R * 2, thickness: 0.12, tessellation: 24 }, scene);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, yy, z);
      ring.material = rail;
      ring.parent = root;
    }
  };

  /** Handrail pairs running continuously along Z just above rack-top height (radial ~1.9). */
  const handrailsZ = (z0: number, z1: number): void => {
    const len = z1 - z0;
    for (const side of [-1, 1]) {
      const bar = MeshBuilder.CreateCylinder(`handrail_z${side}_${z0.toFixed(1)}`, { diameter: 0.045, height: len, tessellation: 8 }, scene);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(side * R * 0.67, MODULE_Y + 1.35, (z0 + z1) / 2);
      bar.material = rail;
      bar.parent = root;
    }
  };

  /** Equipment rack wall segment with laptops + labeled stowage. */
  const rackWall = (name: string, z: number, side: number, count: number): void => {
    for (let i = 0; i < count; i++) {
      const zz = z + i * 1.1;
      const rack = MeshBuilder.CreateBox(`${name}_rack${i}`, { width: 0.9, height: 1.9, depth: 0.6 }, scene);
      rack.position.set(side * (R - 0.35), MODULE_Y + 0.2, zz);
      rack.material = wall;
      rack.parent = root;
      colliders.push({
        min: { x: side > 0 ? R - 0.7 : -R, y: MODULE_Y - 0.8, z: zz - 0.5 },
        max: { x: side > 0 ? R : -R + 0.7, y: MODULE_Y + 1.2, z: zz + 0.5 },
      });
      if (i % 2 === 0) {
        const laptop = MeshBuilder.CreateBox(`${name}_lap${i}`, { width: 0.55, height: 0.02, depth: 0.38 }, scene);
        laptop.position.set(side * (R - 0.95), MODULE_Y + 0.75, zz + 0.1);
        laptop.rotation.x = -0.35;
        laptop.material = lap;
        laptop.parent = root;
      } else {
        const stow = MeshBuilder.CreateBox(`${name}_bag${i}`, { width: 0.5, height: 0.5, depth: 0.45 }, scene);
        stow.position.set(side * (R - 0.7), MODULE_Y - 0.35, zz);
        stow.material = bag;
        stow.parent = root;
      }
      const label = MeshBuilder.CreatePlane(`${name}_lbl${i}`, { width: 0.5, height: 0.14 }, scene);
      label.position.set(side * (R - 0.85), MODULE_Y + 1.1, zz);
      label.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      label.material = labelMat(i % 2 === 0 ? "EXP RACK" : "STOWAGE");
      label.parent = root;
    }
  };

  // Cables strung low along the floor wall (catenary-ish cylinders)
  const cable = (z0: number, z1: number, height: number, side: number): void => {
    const len = Math.hypot(z1 - z0, 0.2);
    const c = MeshBuilder.CreateCylinder("cable", { diameter: 0.03, height: len, tessellation: 6 }, scene);
    c.rotation.x = Math.PI / 2;
    c.rotation.y = Math.atan2(0.2, z1 - z0);
    c.position.set(side * (R - 0.9), MODULE_Y + height, (z0 + z1) / 2);
    c.material = assets.blackTile();
    c.parent = root;
  };

  // Practical lights (PBR-scene intensities, cf. plumeLight/sun calibration)
  const light = (pos: Vector3, color: Color3, intensity: number, range: number): void => {
    const pl = new PointLight(`intLight_${pos.y.toFixed(1)}_${pos.z.toFixed(1)}`, pos, scene);
    pl.diffuse = color;
    pl.intensity = intensity;
    pl.range = range;
  };

  // --- Route: Harmony (z 6.4) -> Unity (0) -> Destiny (-7); Tranquility drops nadir to Cupola ---
  tubeZ("intHarmony", HARMONY_Z - HARMONY_LEN / 2, HARMONY_Z + HARMONY_LEN / 2);
  tubeZ("intUnity", -UNITY_LEN / 2, UNITY_LEN / 2, { z: TRANQ.z, half: 0.65 });
  tubeZ("intDestiny", DESTINY_Z - DESTINY_LEN / 2, DESTINY_Z + DESTINY_LEN / 2, undefined, true);
  tubeY("intTranq", TRANQ.x, TRANQ.z, TRANQ.y0, TRANQ.y1);

  // Forward/aft bulkhead caps seal the walkthrough (Zarya and the docking vestibule are outside the route)
  for (const cap of [
    { name: "harmonyFwdCap", z: HARMONY_Z + HARMONY_LEN / 2 - 0.03, r: 2.28 },
    { name: "destinyAftCap", z: DESTINY_Z - DESTINY_LEN / 2 + 0.05, r: 2.12 },
  ]) {
    const disc = MeshBuilder.CreateDisc(cap.name, { radius: cap.r, tessellation: 24, sideOrientation: Mesh.DOUBLESIDE }, scene);
    disc.position.set(0, MODULE_Y, cap.z);
    disc.material = wall;
    disc.parent = root;
    colliders.push({
      min: { x: -cap.r, y: MODULE_Y - cap.r, z: cap.z - 0.06 },
      max: { x: cap.r, y: MODULE_Y + cap.r, z: cap.z + 0.06 },
    });
  }

  rackWall("destR", DESTINY_Z - DESTINY_LEN / 2 + 0.8, 1, 6);
  rackWall("destL", DESTINY_Z - DESTINY_LEN / 2 + 0.8, -1, 6);
  rackWall("harmR", 4.2, 1, 5);
  rackWall("harmL", 4.2, -1, 5);

  handrailsZ(HARMONY_Z - HARMONY_LEN / 2 + 0.2, HARMONY_Z + HARMONY_LEN / 2 - 0.1);
  handrailsZ(-UNITY_LEN / 2 + 0.15, UNITY_LEN / 2 - 0.15);
  handrailsZ(DESTINY_Z - DESTINY_LEN / 2 + 0.25, DESTINY_Z + DESTINY_LEN / 2 - 0.35);

  // Tranquility berth rails (vertical, both sides)
  for (const side of [-1, 1]) {
    const bar = MeshBuilder.CreateCylinder(`handrail_y${side}`, { diameter: 0.045, height: TRANQ.y0 - TRANQ.y1 - 0.6, tessellation: 8 }, scene);
    bar.position.set(side * R * 0.78, (TRANQ.y0 + TRANQ.y1) / 2, TRANQ.z + R * 0.45);
    bar.material = rail;
    bar.parent = root;
  }

  cable(HARMONY_Z - HARMONY_LEN / 2 + 0.2, HARMONY_Z + HARMONY_LEN / 2 - 0.1, -1.6, 1);
  cable(DESTINY_Z - DESTINY_LEN / 2 + 0.25, UNITY_LEN / 2 - 0.15, -1.65, -1);
  light(new Vector3(0, MODULE_Y + 1.2, HARMONY_Z), new Color3(0.95, 0.97, 1.0), 7, 9);
  light(new Vector3(0, MODULE_Y + 1.2, 0), new Color3(0.95, 0.97, 1.0), 7, 9);
  light(new Vector3(0, MODULE_Y + 1.2, DESTINY_Z), new Color3(1.0, 0.98, 0.92), 7, 9);
  light(new Vector3(0, -7.9, TRANQ.z), new Color3(0.95, 0.97, 1.0), 6, 8);

  // Bulkhead hatches between sections (open rings, doors slid aside)
  for (const hz of [-UNITY_LEN / 2, UNITY_LEN / 2]) {
    const hatch = MeshBuilder.CreateTorus(`hatch${hz}`, { diameter: R * 1.7, thickness: 0.22, tessellation: 24 }, scene);
    hatch.position.set(0, MODULE_Y, hz);
    hatch.material = assets.steelStructure();
    hatch.parent = root;
    for (const side of [-1, 1]) {
      const door = MeshBuilder.CreateBox(`hatchDoor${hz}_${side}`, { width: 0.95, height: 2.0, depth: 0.07 }, scene);
      door.rotation.y = Math.PI / 2;
      door.position.set(side * 1.55, MODULE_Y, hz - side * 0.9);
      door.material = assets.paintedWhite();
      door.parent = root;
    }
  }

  // --- Cupola: nadir viewing sphere below Tranquility (exterior polyhedron at (0,-12.3,-1.5)) ---
  const CP = new Vector3(CUPOLA.x, CUPOLA.y, CUPOLA.z);
  // Transition skirt from the berth tube (r 2.0) into the cupola shell top
  const cone = MeshBuilder.CreateCylinder("cupolaSkirt", {
    diameterTop: R * 2, diameterBottom: 2.2, height: 0.9, tessellation: 20, sideOrientation: Mesh.DOUBLESIDE,
  }, scene);
  cone.position.set(CUPOLA.x, TRANQ.y1 - 0.45, CUPOLA.z);
  cone.material = wall;
  cone.parent = root;
  for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    colliders.push({
      min: { x: CP.x + (sx ? sx * 1.25 - 0.25 : -1.75), y: TRANQ.y1 - 0.85, z: CP.z + (sz ? sz * 1.25 - 0.25 : -1.75) },
      max: { x: CP.x + (sx ? sx * 1.25 + 0.25 : 1.75), y: TRANQ.y1 - 0.05, z: CP.z + (sz ? sz * 1.25 + 0.25 : 1.75) },
    });
  }

  const shellMat = new PBRMaterial("cupolaShellMat", scene);
  shellMat.alpha = 0.15;
  shellMat.albedoColor = new Color3(0.6, 0.75, 0.9);
  shellMat.emissiveColor = new Color3(0.05, 0.08, 0.12);
  shellMat.metallic = 0.2;
  shellMat.roughness = 0.4;
  const shell = MeshBuilder.CreatePolyhedron("cupolaShell", {
    type: 3, size: CUPOLA.size, sideOrientation: Mesh.DOUBLESIDE,
  }, scene);
  shell.position.copyFrom(CP);
  shell.material = shellMat;
  shell.parent = root;

  // Window frames: 6 ringed around the upper hemisphere + 1 nadir (7 total)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const frame = MeshBuilder.CreateTorus(`cupFrame${i}`, { diameter: 0.7, thickness: 0.08, tessellation: 16 }, scene);
    frame.position.set(CP.x + Math.cos(a) * 0.85, CP.y - 0.25, CP.z + Math.sin(a) * 0.85);
    frame.rotation.y = Math.PI / 2 - a;
    frame.material = rail;
    frame.parent = root;
  }
  const nadir = MeshBuilder.CreateTorus("cupNadir", { diameter: 0.9, thickness: 0.1, tessellation: 20 }, scene);
  nadir.rotation.x = Math.PI / 2;
  nadir.position.set(CP.x, CP.y - 1.0, CP.z);
  nadir.material = rail;
  nadir.parent = root;
  const pad = MeshBuilder.CreateTorus("cupPad", { diameter: 1.1, thickness: 0.24, tessellation: 20 }, scene);
  pad.rotation.x = Math.PI / 2;
  pad.position.set(CP.x, CP.y - 0.8, CP.z);
  pad.material = bag;
  pad.parent = root;
  light(new Vector3(CP.x, CP.y + 0.3, CP.z), new Color3(0.82, 0.9, 1.0), 4.5, 6);

  // Cupola containment: 4 side walls (top stays open for the berth drop) + floor below the nadir window
  for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    colliders.push({
      min: { x: CP.x + (sx ? sx * 1.35 - 0.2 : -1.55), y: CP.y - 1.2, z: CP.z + (sz ? sz * 1.35 - 0.2 : -1.55) },
      max: { x: CP.x + (sx ? sx * 1.35 + 0.2 : 1.55), y: CP.y + 0.3, z: CP.z + (sz ? sz * 1.35 + 0.2 : 1.55) },
    });
  }
  colliders.push({
    min: { x: CP.x - 0.95, y: CP.y - 1.7, z: CP.z - 0.95 },
    max: { x: CP.x + 0.95, y: CP.y - 1.15, z: CP.z + 0.95 },
  });

  // Spawn point (Harmony vestibule)
  const spawn = new TransformNode("playerSpawn", scene);
  spawn.parent = root;
  spawn.position.set(0, MODULE_Y, 8.5);

  return { root, spawn, colliders, cupolaLook: new Vector3(CP.x, CP.y - 2, CP.z) };
}
