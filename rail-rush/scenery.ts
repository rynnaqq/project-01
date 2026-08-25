/* =============================================================================
   RAIL RUSH — trackside scenery (procedural buildings).

   Two treadmill rows flanking the rails, mirroring game.ts's makeTreadmill
   idiom (fixed object set, recycled past the camera — zero per-frame
   allocation, no collision: checkCollisions only reads obstaclePools):

     Row A  foreground houses / ruko / platform huts      speedFactor 1.0
     Row B  background mid-rise & skyscraper silhouettes  speedFactor 0.55

   Windows are painted into small canvas textures (never geometry); Row B
   glows via emissiveMap — dusk window lights with no post-processing.
   ========================================================================== */
import * as THREE from 'three';

const DESPAWN_Z = 9;   // matches CONFIG.despawnZ in game.ts
const WRAP_MARGIN = 6; // recycle once fully behind the camera

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d') as CanvasRenderingContext2D, w, h);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}

/* --------------------------------------------------------------- textures */
/** Sparse lit-window grid over a dark wall — doubles as map + emissiveMap. */
function towerTexture(wall: string) {
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = wall;
    g.fillRect(0, 0, w, h);
    const cols = 7;
    const rows = 16;
    const cw = (w - 20) / cols;
    const ch = (h - 28) / rows;
    for (let cx = 0; cx < cols; cx += 1) {
      for (let cy = 0; cy < rows; cy += 1) {
        if (Math.random() >= 0.35) continue; // ~35% of rooms lit at dusk
        g.fillStyle = pick(['#ffd08a', '#ffb36b', '#e8c07a']);
        g.globalAlpha = 0.65 + Math.random() * 0.35;
        g.fillRect(10 + cx * cw + 6, 14 + cy * ch + 6, cw - 12, ch - 12);
      }
    }
    // Faint luminance noise so flat Lambert walls don't band.
    for (let i = 0; i < 500; i += 1) {
      g.globalAlpha = 0.04;
      g.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#000000';
      g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    }
    g.globalAlpha = 1;
  });
}

/** Warm plaster shopfront: storefront glass band + upper windows baked in. */
function shopfrontTexture(wall: string) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = wall;
    g.fillRect(0, 0, w, h);
    // Ground-floor storefront glass with warm interior light.
    g.fillStyle = '#ffd9a0';
    g.fillRect(w * 0.08, h * 0.62, w * 0.84, h * 0.26);
    g.fillStyle = wall;
    g.fillRect(w * 0.46, h * 0.6, w * 0.09, h * 0.4); // door slit
    // Upper windows, some lit.
    for (let i = 0; i < 4; i += 1) {
      g.fillStyle = Math.random() < 0.5 ? '#3a2f45' : '#ffca7a';
      g.globalAlpha = 0.85;
      g.fillRect(w * (0.1 + i * 0.22), h * 0.16, w * 0.13, h * 0.22);
    }
    for (let i = 0; i < 300; i += 1) {
      g.globalAlpha = 0.05;
      g.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#000000';
      g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    }
    g.globalAlpha = 1;
  });
}

/* --------------------------------------------------------------- materials
   All shared & pre-built — respawn picks among them, never tints them. */
const HOUSE_MATS = ['#8a5a52', '#9a6b4f', '#7d5a63', '#a0765a'].map(
  (wall) => new THREE.MeshLambertMaterial({ map: shopfrontTexture(wall) }),
);
const ROOF_MAT = new THREE.MeshLambertMaterial({ color: 0x4a3626 });
const AWNING_MAT = new THREE.MeshLambertMaterial({ color: 0xc9566b });
const TOWER_MATS = ['#2a2138', '#332842', '#241d30'].map((wall) => {
  const tex = towerTexture(wall);
  return new THREE.MeshLambertMaterial({
    map: tex,
    emissive: new THREE.Color('#8a5a33'),
    emissiveMap: tex,
  });
});

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

function boxMesh(mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(UNIT_BOX, mat);
}

type Respin = (o: THREE.Object3D) => void;

/* --------------------------------------------------------------- treadmill
   ponytail: duplicated from game.ts's makeTreadmill on purpose — game.ts
   exports nothing and exporting would churn its API for one consumer.
   Revisit if a third module ever needs treadmills. */
function makeTreadmill(scene: THREE.Scene, count: number, spacing: number, speedFactor: number, factory: () => Object3DWithRespin) {
  const items: Object3DWithRespin[] = [];
  const span = count * spacing;
  for (let i = 0; i < count; i += 1) {
    const o = factory();
    o.position.z = DESPAWN_Z - i * spacing - Math.random() * spacing * 0.4;
    scene.add(o);
    items.push(o);
  }
  return {
    advance(dz: number) {
      for (const o of items) {
        o.position.z += dz * speedFactor;
        if (o.position.z > DESPAWN_Z + WRAP_MARGIN) {
          o.position.z -= span;
          o.userData.respin?.(o);
        }
      }
    },
  };
}

type Object3DWithRespin = THREE.Object3D & { userData: { respin?: Respin } };

function shadowsOn(root: THREE.Object3D) {
  root.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
}

/* ------------------------------------------------------------------ row A */
/** Small house / two-story ruko / platform hut — front faces the track. */
function makeHouse(): Object3DWithRespin {
  const g = new THREE.Group();
  const body = boxMesh(HOUSE_MATS[0]);
  g.add(body);
  const roof = boxMesh(ROOF_MAT);
  g.add(roof);
  const awning = boxMesh(AWNING_MAT);
  g.add(awning);

  const respin: Respin = (o) => {
    const side = Math.random() < 0.5 ? -1 : 1;
    const w = 3 + Math.random() * 2.5;
    const d = 3 + Math.random() * 1.5;
    const h = 2.2 + Math.random() * 3; // ruko reaches ~5.2
    body.scale.set(w, h, d);
    body.position.y = h / 2;
    body.material = pick(HOUSE_MATS);
    const isRuko = h > 3.6;
    // Roof always on: caps the box so the camera never sees the storefront
    // texture on the body's top face.
    roof.scale.set(w * 1.15, 0.28, d * 1.15);
    roof.position.y = h + 0.14;
    awning.visible = isRuko;
    awning.scale.set(w * 1.02, 0.1, 0.35);
    awning.position.set(0, h * 0.55, d / 2 + 0.17);
    o.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; // face the rails
    o.position.x = side * (8.5 + Math.random() * 5);
  };
  g.userData.respin = respin;
  respin(g);
  shadowsOn(g);
  return g;
}

/* ------------------------------------------------------------------ row B */
/** Mid-rise / skyscraper silhouette — single textured box, no shadows. */
function makeTower(): Object3DWithRespin {
  const m = boxMesh(TOWER_MATS[0]);

  const respin: Respin = (o) => {
    const side = Math.random() < 0.5 ? -1 : 1;
    const tall = Math.random() < 0.45;
    const w = 5 + Math.random() * 4;
    const d = 5 + Math.random() * 4;
    const h = tall ? 14 + Math.random() * 12 : 7 + Math.random() * 5;
    m.scale.set(w, h, d);
    m.position.y = h / 2;
    m.material = pick(TOWER_MATS);
    o.rotation.y = 0; // flat faces read best against the sky band
    o.position.x = side * (16 + Math.random() * 18);
  };
  m.userData.respin = respin;
  respin(m);
  return m;
}

/* ---------------------------------------------------------------- factory */
export function createScenery(scene: THREE.Scene): { advance(dz: number): void } {
  const houses = makeTreadmill(scene, 14, 26, 1, makeHouse);
  const towers = makeTreadmill(scene, 12, 40, 0.55, makeTower);
  return {
    advance(dz: number) {
      houses.advance(dz);
      towers.advance(dz);
    },
  };
}
