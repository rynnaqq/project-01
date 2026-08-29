// space-sim/iss/exterior.ts
import { Mesh, MeshBuilder, TransformNode, Vector3, type Scene } from "@babylonjs/core";
import type { Assets } from "../core/assets";

export interface IssExterior {
  root: TransformNode;
  dockingPort: TransformNode;
  solarWings: TransformNode[];
  setSunAngle(a: number): void;
}

/** Kit-bashed pressurized module: hull cylinder + end cones + foil detail boxes. */
function module(scene: Scene, assets: Assets, name: string, len: number, dia: number, parent: TransformNode): TransformNode {
  const node = new TransformNode(name, scene);
  node.parent = parent;
  const body = MeshBuilder.CreateCylinder(`${name}Body`, { diameter: dia, height: len, tessellation: 20 }, scene);
  body.rotation.x = Math.PI / 2; // align along Z
  body.material = assets.interiorWall(); // white panel exterior look
  body.parent = node;
  for (const z of [len / 2, -len / 2]) {
    const cone = MeshBuilder.CreateCylinder(`${name}Cone${z}`, {
      diameterTop: z > 0 ? dia * 0.8 : dia, diameterBottom: z > 0 ? dia : dia * 0.8,
      height: 0.6, tessellation: 20,
    }, scene);
    cone.rotation.x = Math.PI / 2;
    cone.position.z = z + (z > 0 ? 0.3 : -0.3);
    cone.material = assets.steelStructure();
    cone.parent = node;
  }
  // Equipment detail band (kit-bash: foil boxes on the hull)
  for (let i = 0; i < 5; i++) {
    const box = MeshBuilder.CreateBox(`${name}Box${i}`, { width: 0.8 + Math.random() * 0.6, height: 0.4, depth: 0.25 }, scene);
    const a = Math.random() * Math.PI * 2;
    box.position.set(Math.cos(a) * (dia / 2 + 0.12), Math.sin(a) * (dia / 2 + 0.12), (Math.random() - 0.5) * len * 0.8);
    box.material = assets.foilGold();
    box.parent = node;
  }
  return node;
}

function place(node: TransformNode, pos: Vector3, rotX = 0): void {
  node.position = pos;
  node.rotation.x = rotX;
}

export function createIssExterior(scene: Scene, assets: Assets): IssExterior {
  const root = new TransformNode("issRoot", scene);
  const ORBIT_Y = 6371000 + 400000;
  root.position.set(0, ORBIT_Y, 0);

  // --- ITS truss (109 m along X) ---
  const truss = MeshBuilder.CreateBox("itsTruss", { width: 109, height: 1.6, depth: 2.4 }, scene);
  truss.material = assets.steelStructure();
  truss.parent = root;
  // Truss lattice detail
  for (let x = -52; x <= 52; x += 6) {
    const diag = MeshBuilder.CreateBox(`trussDiag${x}`, { width: 0.2, height: 3.2, depth: 0.2 }, scene);
    diag.position.set(x, -0.8, 0);
    diag.rotation.z = 0.6;
    diag.material = assets.steelStructure();
    diag.parent = root;
  }

  // --- Solar arrays: 8 wings (2 per SAW group, one +Y one -Y) ---
  const solarWings: TransformNode[] = [];
  const makeWingGroup = (x: number): void => {
    for (const [dy, flip] of [[7, 1], [-7, -1]] as const) {
      const wingY = dy + flip * 6;
      const mast = MeshBuilder.CreateCylinder("sawMast", { diameter: 0.25, height: Math.abs(wingY) }, scene);
      mast.position.set(x, wingY / 2, 0);
      mast.material = assets.steelStructure();
      mast.parent = root;
      const wing = new TransformNode("sawWing", scene);
      wing.position.set(x, wingY, 0);
      wing.parent = root;
      const blanket = MeshBuilder.CreatePlane("sawBlanket", { width: 34, height: 12, sideOrientation: Mesh.DOUBLESIDE }, scene);
      blanket.rotation.x = Math.PI / 2;
      blanket.material = assets.solarCell();
      blanket.parent = wing;
      solarWings.push(wing);
    }
  };
  for (const x of [-45, -22, 22, 45]) makeWingGroup(x);

  // --- Radiators (4 sets, below truss) ---
  for (const x of [-36, -12, 12, 36]) {
    const rad = MeshBuilder.CreatePlane("radiator", { width: 12, height: 3.4, sideOrientation: Mesh.DOUBLESIDE }, scene);
    rad.position.set(x, -4.5, 0);
    rad.rotation.y = Math.PI / 2;
    rad.rotation.z = Math.PI / 2;
    rad.material = assets.radiator();
    rad.parent = root;
  }

  // --- Pressurized modules along Z (docking axis −Z toward Destiny forward) ---
  const unity = module(scene, assets, "unity", 5.5, 4.6, root);
  place(unity, new Vector3(0, -2.5, 0));
  const destiny = module(scene, assets, "destiny", 8.5, 4.3, root);
  place(destiny, new Vector3(0, -2.5, -7));
  const harmony = module(scene, assets, "harmony", 7.2, 4.6, root);
  place(harmony, new Vector3(0, -2.5, 6.4));
  const zarya = module(scene, assets, "zarya", 12.6, 4.1, root);
  place(zarya, new Vector3(0, -2.5, 16.4));
  const zvezda = module(scene, assets, "zvezda", 13.1, 4.15, root);
  place(zvezda, new Vector3(0, -2.5, 29));
  const columbus = module(scene, assets, "columbus", 6.9, 4.5, root);
  place(columbus, new Vector3(5.8, -2.5, 6.4));
  columbus.rotation.y = Math.PI / 2;
  const kibo = module(scene, assets, "kibo", 9.2, 4.4, root);
  place(kibo, new Vector3(-6, -2.5, 6.4));
  kibo.rotation.y = Math.PI / 2;
  // Kibo exposed facility + boom
  const jef = MeshBuilder.CreateBox("kiboJEF", { width: 5, height: 2, depth: 4.2 }, scene);
  jef.position.set(-11.5, -2.5, 6.4);
  jef.material = assets.steelStructure();
  jef.parent = root;
  // Tranquility + Cupola (nadir from Unity)
  const tranquility = module(scene, assets, "tranquility", 6.7, 4.6, root);
  place(tranquility, new Vector3(0, -2.5 - 5.6, -1.5), Math.PI / 2);
  const cupola = MeshBuilder.CreatePolyhedron("cupola", { type: 3, size: 1.6 }, scene);
  cupola.position.set(0, -2.5 - 5.6 - 4.2, -1.5);
  cupola.material = assets.steelStructure();
  cupola.parent = root;
  // Quest airlock (starboard of Unity)
  const quest = module(scene, assets, "quest", 5.5, 4, root);
  place(quest, new Vector3(5.4, -2.5, -1.5));
  quest.rotation.y = Math.PI / 2;
  // PMA-2/IDA at Destiny forward = docking port (Orion docks here along −Z)
  const dockingPort = new TransformNode("dockingPort", scene);
  dockingPort.parent = root;
  dockingPort.position.set(0, -2.5, -11.4);
  const pma = MeshBuilder.CreateCylinder("pma2", { diameterTop: 1.6, diameterBottom: 2.4, height: 1.6, tessellation: 16 }, scene);
  pma.rotation.x = Math.PI / 2;
  pma.position.set(0, -2.5, -11.4);
  pma.material = assets.steelStructure();
  pma.parent = root;
  const ida = MeshBuilder.CreateCylinder("idaRing", { diameter: 1.6, height: 0.4, tessellation: 16 }, scene);
  ida.rotation.x = Math.PI / 2;
  ida.position.set(0, -2.5, -12.3);
  ida.material = assets.paintedWhite();
  ida.parent = root;

  // External handrails along Destiny/Unity
  for (let z = -10; z <= 9; z += 1.5) {
    const rail = MeshBuilder.CreateTorus("extRail", { diameter: 0.5, thickness: 0.04, tessellation: 12 }, scene);
    rail.position.set(2.2, -1.2, z);
    rail.rotation.x = Math.PI / 2;
    rail.material = assets.handrail();
    rail.parent = root;
  }

  const setSunAngle = (a: number): void => {
    for (const wing of solarWings) wing.rotation.x = a;
  };

  return { root, dockingPort, solarWings, setSunAngle };
}
