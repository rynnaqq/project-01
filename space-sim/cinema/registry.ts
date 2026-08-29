// space-sim/cinema/registry.ts
/** Every shot id the mission script may reference. Rigs implemented in shots.ts (Task 3). */
export const SHOT_IDS = [
  "est_wide", "est_vab_crane", "vab_medium", "vab_closeup",
  "pad_wide", "tower_low", "tower_closeup", "rocket_closeup", "rocket_ecl",
  "crawler_ground", "svc_vehicles", "pad_ground_level",
  "plume_ground", "ignition_closeup", "rocket_side_track", "rocket_distant_track",
  "rocket_upward", "booster_cam", "horizon_ascent", "cockpit_orion",
  "stage_sep_side", "stage_sep_wide", "icps_perspective",
  "earth_wide", "earth_limb_drift", "sunrise_orbit", "orion_exterior_orbit",
  "orion_rear_orbit", "starfield_hold",
  "iss_reveal_far", "iss_reveal_close", "iss_approach_track", "docking_target_cam",
  "docking_side_cam", "docking_contact_ecl", "solar_array_perspective", "iss_earth_facing",
  "pov_crew_prep", "pov_hatch_open", "pov_transfer", "iss_interior_establish", "cupola_earth_gaze",
] as const;
