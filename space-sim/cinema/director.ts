// space-sim/cinema/director.ts
import type { Scene } from "@babylonjs/core";

export type Pacing = "dynamic" | "contemplative";

/** Deterministic hash-based rng in [0,1). */
export function hashRng(seed: number): number {
  let x = (seed | 0) + 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 0xffffffff;
}

/** Pure pick: never repeats last when pool >1; falls back to fallback pool. */
export function pickNextShot(pool: string[], last: string | null, seed: number, fallback?: string[]): string {
  const candidates = pool.length > 0 ? pool : fallback ?? [];
  if (candidates.length === 0) return last ?? "";
  const filtered = candidates.length > 1 ? candidates.filter((s) => s !== last) : candidates;
  return filtered[Math.floor(hashRng(seed) * filtered.length) % filtered.length];
}

/** Pure cut-hold: dynamic 4–10s, contemplative 20–60s. */
export function cutHoldSeconds(pacing: Pacing, seed: number): number {
  const r = hashRng(seed * 7919 + 13);
  return pacing === "dynamic" ? 4 + r * 6 : 20 + r * 40;
}

export interface StateCinema {
  pools: Partial<Record<string, string[]>>;
  pacing: Partial<Record<string, Pacing>>;
  fallbackFor: Partial<Record<string, string[]>>;
}

export const STATE_CINEMA: StateCinema = {
  pools: {
    KSC_ESTABLISHING: ["est_wide", "est_vab_crane", "vab_medium", "pad_wide"],
    LAUNCH_PREPARATION: ["tower_low", "svc_vehicles", "rocket_closeup", "tower_closeup", "rocket_ecl", "pad_ground_level"],
    CREW_PREPARATION: ["pov_crew_prep", "cockpit_orion"],
    COUNTDOWN: ["pad_wide", "tower_closeup", "rocket_side_track", "vab_medium", "rocket_ecl", "pad_ground_level", "plume_ground"],
    ENGINE_IGNITION: ["ignition_closeup", "plume_ground", "tower_closeup"],
    LIFTOFF: ["pad_ground_level", "rocket_side_track", "rocket_distant_track", "rocket_upward"],
    ATMOSPHERIC_ASCENT: ["booster_cam", "horizon_ascent", "cockpit_orion", "rocket_distant_track", "stage_sep_side", "earth_wide", "rocket_upward"],
    BOOSTER_PHASE: ["booster_cam", "icps_perspective", "starfield_hold"],
    STAGE_TRANSITION: ["icps_perspective", "earth_wide", "horizon_ascent"],
    ORBITAL_INSERTION: ["orion_exterior_orbit", "orion_rear_orbit", "earth_limb_drift"],
    ORBIT: ["earth_wide", "sunrise_orbit", "orion_exterior_orbit", "starfield_hold", "earth_limb_drift", "orion_rear_orbit"],
    ISS_REVEAL: ["starfield_hold", "iss_reveal_far", "iss_reveal_close", "solar_array_perspective"],
    ISS_APPROACH: ["iss_approach_track", "docking_target_cam", "iss_earth_facing", "orion_exterior_orbit", "docking_side_cam"],
    DOCKING_SEQUENCE: ["docking_target_cam", "docking_side_cam", "docking_contact_ecl", "iss_earth_facing", "iss_reveal_close", "orion_exterior_orbit"],
    DOCKING_COMPLETE: ["docking_contact_ecl", "iss_reveal_close"],
    CREW_TRANSFER: ["pov_hatch_open", "pov_transfer"],
    ISS_INTERIOR_INTRO: ["iss_interior_establish"],
    PLAYER_CONTROL_ENABLED: ["cupola_earth_gaze"],
  },
  pacing: {
    KSC_ESTABLISHING: "contemplative", LAUNCH_PREPARATION: "dynamic", CREW_PREPARATION: "dynamic",
    COUNTDOWN: "dynamic", ENGINE_IGNITION: "dynamic", LIFTOFF: "dynamic",
    ATMOSPHERIC_ASCENT: "dynamic", BOOSTER_PHASE: "contemplative", STAGE_TRANSITION: "dynamic",
    ORBITAL_INSERTION: "contemplative", ORBIT: "contemplative", ISS_REVEAL: "contemplative",
    ISS_APPROACH: "contemplative", DOCKING_SEQUENCE: "contemplative", DOCKING_COMPLETE: "contemplative",
    CREW_TRANSFER: "contemplative", ISS_INTERIOR_INTRO: "contemplative", PLAYER_CONTROL_ENABLED: "contemplative",
  },
  fallbackFor: {
    pov_crew_prep: ["cockpit_orion"],
    cockpit_orion: ["rocket_closeup"],
    docking_contact_ecl: ["docking_target_cam"],
    iss_interior_establish: ["pov_transfer"],
    cupola_earth_gaze: ["iss_interior_establish"],
    pov_hatch_open: ["pov_transfer"],
    pov_transfer: ["iss_interior_establish"],
    ignition_closeup: ["plume_ground"],
    stage_sep_side: ["rocket_distant_track"],
    stage_sep_wide: ["rocket_distant_track"],
  },
};

interface RigLike { activate(t: number): void; update(t: number): void; camera: unknown }

export class CinematicDirector {
  private seed = 1;
  private last: string | null = null;
  private holdUntil = 0;
  constructor(
    private lib: { get(id: string): RigLike | null },
    private scene: Scene,
    private transitions: { cut(kind: "cut" | "dip" | "crossfade"): void },
  ) {}

  playShot(id: string, _duration: number, t: number): void {
    const rig = this.lib.get(id);
    if (!rig) return;
    this.scene.activeCamera = rig.camera as Scene["activeCamera"];
    rig.activate(t);
    this.last = id;
    this.seed = (this.seed * 31 + id.length * 101) | 0;
  }

  cut(kind: "cut" | "dip" | "crossfade"): void {
    this.transitions.cut(kind);
  }

  /** Per-frame; auto-advances cuts within a state when no scripted shot is active. */
  update(now: number, state: string, t: number): void {
    const pool = STATE_CINEMA.pools[state] ?? [];
    const fb = STATE_CINEMA.fallbackFor[this.last ?? ""] ?? [];
    const pacing = STATE_CINEMA.pacing[state] ?? "dynamic";
    const currentDead = this.last !== null && this.lib.get(this.last) === null;
    if (now >= this.holdUntil || this.last === null || currentDead) {
      const id = pickNextShot(pool, this.last, this.seed, fb);
      if (id) {
        if (id !== this.last) this.playShot(id, 0, t);
        this.holdUntil = now + cutHoldSeconds(pacing, this.seed);
      }
    }
    const rig = this.last ? this.lib.get(this.last) : null;
    rig?.update(t);
  }
}
