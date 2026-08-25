// space-sim/flight.ts
/**
 * Pure flight math shared by the ascent and orbit controllers.
 * No Babylon imports — the controllers in player.ts apply these to the rig.
 */

export interface Vec3Like { x: number; y: number; z: number }

/** Linear damping, clamped so a large dt zeroes the vector instead of flipping it. */
export function applyDamping<T extends Vec3Like>(v: T, damping: number, dt: number): T {
  const f = Math.max(0, 1 - damping * dt);
  return { ...v, x: v.x * f, y: v.y * f, z: v.z * f };
}

/** Bleed velocity toward zero at `brakeAccel` per axis (counter-thrust, PRD §C.5 R). */
export function brakeVelocity<T extends Vec3Like>(v: T, brakeAccel: number, dt: number): T {
  const step = brakeAccel * dt;
  const brake = (c: number): number => (Math.abs(c) <= step ? 0 : c - Math.sign(c) * step);
  return { ...v, x: brake(v.x), y: brake(v.y), z: brake(v.z) };
}

/** Fuel burn proportional to thrust magnitude (0..1); floors at 0. */
export function burnFuel(fuel: number, thrust01: number, rate: number, dt: number): number {
  return Math.max(0, fuel - rate * Math.abs(thrust01) * dt);
}

export interface AscentStep { y: number; vy: number }

/** One ascent integration step: thrust up vs. gravity down, clamped at maxVy. */
export function ascentStep(
  y: number, vy: number, thrust01: number,
  gravity: number, thrustAccel: number, maxVy: number, dt: number,
): AscentStep {
  const nextVy = Math.min(maxVy, vy + (thrust01 * thrustAccel - gravity) * dt);
  return { y: y + nextVy * dt, vy: nextVy };
}
