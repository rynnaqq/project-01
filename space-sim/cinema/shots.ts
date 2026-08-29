// space-sim/cinema/shots.ts
import { UniversalCamera, Vector3, type Scene, type TransformNode } from "@babylonjs/core";

export type RigKind = "static" | "crane" | "orbit" | "track" | "pov" | "drift";

export interface RigContext {
  scene: Scene;
  targetProviders: Record<string, () => TransformNode | undefined>;
  /** prefers-reduced-motion: handheld wobble/bob is scaled to zero. */
  reducedMotion?: boolean;
}

export interface CameraRig {
  id: string; kind: RigKind; camera: UniversalCamera;
  activate(t: number): void; update(t: number): void;
}

type Target = () => TransformNode | undefined;

function makeCam(scene: Scene, id: string, pos: Vector3, fov = 0.9): UniversalCamera {
  const cam = new UniversalCamera(id, pos, scene);
  cam.minZ = 0.1;
  cam.maxZ = 2.5e7;
  cam.fov = fov;
  return cam;
}

function lookAt(cam: UniversalCamera, target: Vector3): void {
  cam.setTarget(target);
}

export class ShotLibrary {
  private rigs = new Map<string, CameraRig>();
  private t0 = 0;

  constructor(private ctx: RigContext) {
    this.buildEnvironment();
    this.buildLaunch();
    this.buildOrbit();
    this.buildIss();
    this.buildInterior();
  }

  get(id: string): CameraRig | null { return this.rigs.get(id) ?? null; }
  ids(): string[] { return [...this.rigs.keys()]; }
  private add(rig: CameraRig): void { this.rigs.set(rig.id, rig); }
  private target(name: string): Target { return () => this.ctx.targetProviders[name]?.(); }
  /** Follow provider target with world offset; wobble adds gentle handheld drift. */
  private followRig(id: string, kind: RigKind, targetName: string, offset: Vector3, fov = 0.8, wobble = 0): void {
    const cam = makeCam(this.ctx.scene, `cam_${id}`, offset, fov);
    const get = this.target(targetName);
    const wob = this.ctx.reducedMotion ? 0 : wobble;
    const apply = (t: number): void => {
      const node = get();
      if (!node) return;
      const p = node.getAbsolutePosition();
      cam.position.copyFrom(p.add(offset));
      if (wob > 0) {
        cam.position.y += Math.sin(t * 0.7) * wob;
        cam.position.x += Math.cos(t * 0.5) * wob * 0.6;
      }
      lookAt(cam, p);
    };
    this.add({ id, kind, camera: cam, activate: apply, update: apply });
  }

  private buildEnvironment(): void {
    const s = this.ctx.scene;
    const est = makeCam(s, "cam_est_wide", new Vector3(1800, 90, 500), 0.85);
    this.add({ id: "est_wide", kind: "crane", camera: est,
      activate: (t) => { this.t0 = t; est.position.set(1800, 90, 500); lookAt(est, new Vector3(0, 40, 0)); },
      update: (t) => {
        const k = Math.min(1, Math.max(0, (t - this.t0) / 14));
        est.position.set(1800 - 600 * k, 90 - 55 * k, 500 + 150 * k);
        lookAt(est, new Vector3(0, 40 + 10 * k, 0));
      } });
    const crane = makeCam(s, "cam_est_vab_crane", new Vector3(-3200, 8, -2350), 0.8);
    this.add({ id: "est_vab_crane", kind: "crane", camera: crane,
      activate: (t) => { this.t0 = t; crane.position.set(-3200, 8, -2350); },
      update: (t) => {
        const k = Math.min(1, Math.max(0, (t - this.t0) / 10));
        crane.position.y = 8 + 150 * k;
        lookAt(crane, new Vector3(-3200, 70 + 30 * k, -2800));
      } });
    const vabMed = makeCam(s, "cam_vab_medium", new Vector3(-2850, 60, -2100));
    this.add({ id: "vab_medium", kind: "static", camera: vabMed, activate: () => lookAt(vabMed, new Vector3(-3200, 70, -2800)), update: () => {} });
    const vabClose = makeCam(s, "cam_vab_closeup", new Vector3(-3080, 25, -2500), 0.6);
    this.add({ id: "vab_closeup", kind: "static", camera: vabClose, activate: () => lookAt(vabClose, new Vector3(-3200, 45, -2800)), update: () => {} });
    const padWide = makeCam(s, "cam_pad_wide", new Vector3(-260, 35, -260));
    this.add({ id: "pad_wide", kind: "orbit", camera: padWide,
      activate: (t) => { this.t0 = t; },
      update: (t) => {
        const a = (t - this.t0) * 0.02;
        padWide.position.set(-260 * Math.cos(a), 35, -260 * Math.sin(a));
        lookAt(padWide, new Vector3(0, 45, 0));
      } });
    const towerLow = makeCam(s, "cam_tower_low", new Vector3(30, 3, -55), 1.0);
    this.add({ id: "tower_low", kind: "static", camera: towerLow, activate: () => lookAt(towerLow, new Vector3(0, 70, 0)), update: () => {} });
    const towerClose = makeCam(s, "cam_tower_closeup", new Vector3(-18, 60, -30), 0.55);
    this.add({ id: "tower_closeup", kind: "static", camera: towerClose, activate: () => lookAt(towerClose, new Vector3(6, 55, 8)), update: () => {} });
    const ground = makeCam(s, "cam_pad_ground_level", new Vector3(-140, 2.5, 40), 0.95);
    this.add({ id: "pad_ground_level", kind: "static", camera: ground, activate: () => lookAt(ground, new Vector3(0, 50, 0)), update: () => {} });
    const crawler = makeCam(s, "cam_crawler_ground", new Vector3(-1500, 2.2, -1700), 1.05);
    this.add({ id: "crawler_ground", kind: "crane", camera: crawler,
      activate: (t) => { this.t0 = t; },
      update: (t) => {
        const k = Math.min(1, Math.max(0, (t - this.t0) / 9));
        crawler.position.set(-1500 + 400 * k, 2.2, -1700 + 300 * k);
        lookAt(crawler, new Vector3(0, 30, 0));
      } });
    const svc = makeCam(s, "cam_svc_vehicles", new Vector3(60, 4, -80), 0.85);
    this.add({ id: "svc_vehicles", kind: "static", camera: svc, activate: () => lookAt(svc, new Vector3(20, 2, -30)), update: () => {} });
    this.followRig("rocket_closeup", "track", "stack", new Vector3(25, 25, 25), 0.5);
    this.followRig("rocket_ecl", "track", "stack", new Vector3(12, -30, 12), 0.35);
  }

  private buildLaunch(): void {
    this.followRig("plume_ground", "track", "stack", new Vector3(-90, -2, 60), 0.8);
    this.followRig("ignition_closeup", "track", "engines", new Vector3(-28, -2, 18), 0.6);
    this.followRig("rocket_side_track", "track", "stack", new Vector3(120, 20, 0), 0.7);
    this.followRig("rocket_distant_track", "track", "stack", new Vector3(600, 100, -200), 0.6);
    this.followRig("rocket_upward", "track", "stack", new Vector3(6, -120, 6), 1.1);
    this.followRig("booster_cam", "track", "stack", new Vector3(9, -40, 0), 0.9, 0.4);
    this.followRig("horizon_ascent", "track", "stack", new Vector3(25, 60, 150), 1.0);
    this.followRig("cockpit_orion", "pov", "stack", new Vector3(0, -2.2, -1.2), 0.85, 0.15);
    this.followRig("stage_sep_side", "track", "stack", new Vector3(18, -5, 0), 0.75);
    this.followRig("stage_sep_wide", "track", "stack", new Vector3(45, -25, 30), 0.9);
    this.followRig("icps_perspective", "track", "stack", new Vector3(8, 6, -14), 0.8);
  }

  private buildOrbit(): void {
    const ORBIT_Y = 6371000 + 400000;
    const orbitRig = (id: string, kind: RigKind, dir: Vector3, dist: number, fov = 0.85, wobble = 0): void => {
      const cam = makeCam(this.ctx.scene, `cam_${id}`, dir.scale(dist).add(new Vector3(0, ORBIT_Y, 0)), fov);
      const get = this.target("orion");
      const wob = this.ctx.reducedMotion ? 0 : wobble;
      const apply = (t: number): void => {
        const node = get();
        if (!node) return;
        const p = node.getAbsolutePosition();
        cam.position.copyFrom(p.add(dir.scale(dist)));
        if (wob > 0) {
          cam.position.y += Math.sin(t * 0.6) * wob;
          cam.position.x += Math.cos(t * 0.4) * wob * 0.7;
        }
        lookAt(cam, p);
      };
      this.add({ id, kind, camera: cam, activate: apply, update: apply });
    };
    orbitRig("earth_wide", "orbit", new Vector3(0.5, 0.15, 0.85).normalize(), 220, 1.0);
    orbitRig("earth_limb_drift", "drift", new Vector3(-0.7, 0.05, 0.7).normalize(), 90, 0.9, 0.8);
    orbitRig("sunrise_orbit", "orbit", new Vector3(0.9, 0.02, -0.4).normalize(), 140, 0.95);
    orbitRig("orion_exterior_orbit", "orbit", new Vector3(0.2, 0.25, 0.95).normalize(), 35, 0.7);
    orbitRig("orion_rear_orbit", "track", new Vector3(0, -0.1, -1).normalize(), 25, 0.75);
    orbitRig("solar_array_perspective", "track", new Vector3(0.6, 0.1, 0.8).normalize(), 14, 0.85);
    const stars = makeCam(this.ctx.scene, "cam_starfield_hold", new Vector3(0, ORBIT_Y, 0), 1.2);
    this.add({ id: "starfield_hold", kind: "drift", camera: stars,
      activate: () => stars.position.set(0, ORBIT_Y, 0),
      update: (t) => { stars.rotation.y = t * 0.004; } });
  }

  private buildIss(): void {
    const ORBIT_Y = 6371000 + 400000;
    const issRig = (id: string, kind: RigKind, offset: Vector3, fov = 0.75): void => {
      const cam = makeCam(this.ctx.scene, `cam_${id}`, offset.add(new Vector3(0, ORBIT_Y, 0)), fov);
      const get = this.target("iss");
      const apply = (t: number): void => {
        const node = get();
        if (!node) return;
        const p = node.getAbsolutePosition();
        cam.position.copyFrom(p.add(offset));
        if (kind !== "static" && !this.ctx.reducedMotion) {
          cam.position.y += Math.sin(t * 0.5) * 0.3;
        }
        lookAt(cam, p);
      };
      this.add({ id, kind, camera: cam, activate: apply, update: apply });
    };
    issRig("iss_reveal_far", "orbit", new Vector3(350, 60, 350));
    issRig("iss_reveal_close", "orbit", new Vector3(120, 20, 90));
    issRig("iss_approach_track", "track", new Vector3(30, 6, 55));
    issRig("docking_target_cam", "track", new Vector3(0, 0.4, 12), 0.5);
    issRig("docking_side_cam", "track", new Vector3(9, 2, 8), 0.7);
    issRig("docking_contact_ecl", "track", new Vector3(3.5, 0.8, 3), 0.45);
    issRig("iss_earth_facing", "static", new Vector3(-60, -15, 0), 0.95);
  }

  private buildInterior(): void {
    const ORBIT_Y = 6371000 + 400000;
    const intRig = (id: string, offset: Vector3, look: Vector3, fov = 0.9): void => {
      const cam = makeCam(this.ctx.scene, `cam_${id}`, offset.add(new Vector3(0, ORBIT_Y, 0)), fov);
      const get = this.target("issInterior");
      const apply = (): void => {
        const node = get();
        if (!node) return;
        const p = node.getAbsolutePosition();
        cam.position.copyFrom(p.add(offset));
        lookAt(cam, p.add(look));
      };
      this.add({ id, kind: "static", camera: cam, activate: apply, update: apply });
    };
    intRig("iss_interior_establish", new Vector3(0, 0, -6), new Vector3(0, 0, 6));
    intRig("cupola_earth_gaze", new Vector3(0, -0.3, -1.2), new Vector3(0, -1.5, 0.5), 0.8);
    intRig("pov_hatch_open", new Vector3(0, 0, -2.2), new Vector3(0, 0, 2), 0.85);
    intRig("pov_transfer", new Vector3(0, 0, -1), new Vector3(0, 0, 3), 0.9);
    // Crew prep POV anchors to the O&C crew-quarters node on the GROUND (provider "crewQuarters"),
    // NOT the ISS interior — crew prep happens before launch.
    const prepCam = makeCam(this.ctx.scene, "cam_pov_crew_prep", new Vector3(-3050, 1.6, -2850), 0.9);
    const prepGet = this.target("crewQuarters");
    const prepApply = (): void => {
      const node = prepGet();
      if (!node) return;
      const p = node.getAbsolutePosition();
      prepCam.position.copyFrom(p.add(new Vector3(0, 0.9, 0)));
      prepCam.setTarget(p.add(new Vector3(0, 0.8, -1)));
    };
    this.add({ id: "pov_crew_prep", kind: "pov", camera: prepCam, activate: prepApply, update: prepApply });
  }
}
