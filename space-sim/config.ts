// space-sim/config.ts
/**
 * Central tuning for the Space Simulator (PRD §N: tuning via configuration).
 * Scene scale: 1 gameplay unit = 100 m for orbital/docking ranges.
 */

export const METERS_PER_UNIT = 100;
export const unitsToMeters = (u: number): number => u * METERS_PER_UNIT;
export const metersToUnits = (m: number): number => m / METERS_PER_UNIT;

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** World layout + altitude display mapping (compressed so it fits float precision). */
export const ALT = {
  /** Visual Earth radius in scene units. */
  EARTH_RADIUS_UNITS: 30,
  /** Scene Y of the planet surface (== Earth radius, launch pad sits here). */
  SURFACE_Y: 30,
  /** Scene Y where the Orbit phase begins. */
  ORBIT_Y: 60,
  /** Displayed altitude (km) once in orbit. */
  ORBIT_DISPLAY_KM: 400,
  KARMAN_LINE_KM: 100,
} as const;

/** Map a scene Y to a displayed altitude in km (0 at surface, clamped at orbit). */
export function displayAltitudeKm(sceneY: number): number {
  const above = Math.max(0, sceneY - ALT.SURFACE_Y);
  const span = ALT.ORBIT_Y - ALT.SURFACE_Y;
  return clamp01(above / span) * ALT.ORBIT_DISPLAY_KM;
}

/** Simplified gravity (PRD §D.7): linear falloff from surface to orbit. */
export const GRAVITY = { surface: 9.8, orbit: 0.4 } as const;
export function gravityAt(sceneY: number): number {
  const t = clamp01((sceneY - ALT.SURFACE_Y) / (ALT.ORBIT_Y - ALT.SURFACE_Y));
  return GRAVITY.surface * (1 - t) + GRAVITY.orbit * t;
}

/** Thruster model (PRD §B.6 initial tuning). */
export const THRUST = {
  maxForce: 1.0,
  fuelCapacity: 100,
  fuelConsumptionRate: 1.0, // fuel units per second at full thrust
  rotationalForce: 0.4,
  linearDamping: 0.03,
  angularDamping: 0.05,
  assistLinearDamping: 0.6,
  assistAngularDamping: 0.9,
  brakeAccel: 2.0, // units/s² applied per axis while braking
} as const;

/** Ascent-phase feel (scene units/s²). */
export const ASCENT = {
  thrustAccel: 26, // must exceed surface gravity (9.8) to climb
  maxVy: 14, // clamp vertical speed for a readable ascent
} as const;

/** Docking gameplay thresholds (PRD §B.10). */
export const DOCK = {
  distanceM: 5,
  relSpeedMps: 0.5,
  alignmentDeg: 5,
  corridorHalfAngleDeg: 25,
} as const;

/** Touch controls (PRD §C.6). */
export const TOUCH = {
  /** px of joystick drag for full deflection. */
  joystickRangePx: 60,
} as const;

/** Mission-level limits. */
export const MISSION = {
  oxygenSeconds: 600,
  boundsRadiusUnits: 220, // out-of-bounds sphere around the ISS (PRD §E.11)
} as const;
