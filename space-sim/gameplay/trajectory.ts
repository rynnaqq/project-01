/**
 * Deterministic ascent trajectory (PRD §6): position/rotation as pure
 * functions of time. No aerospace dynamics — cinematic profile.
 */

export interface AscentSample {
  /** Metres above launch site. */
  altitude: number;
  /** Metres per second along the gravity-turn path. */
  velocity: number;
  /** Degrees from vertical (0 = straight up, 90 = horizontal at orbit). */
  pitch: number;
  /** Heading in degrees. */
  yaw: number;
  /** True during MECO/stage-separation window. */
  stage: 1 | 2;
  /** Dynamic pressure factor (0..1) for camera shake and aero effects. */
  dynamicPressure: number;
}

export const ASCENT_DURATION_S = 42;

/**
 * Sample the ascent at time t (seconds). Deterministic so the cinematic
 * can be replayed and skipped-to reliably.
 */
export function sampleAscent(t: number): AscentSample {
  const clamped = Math.max(0, Math.min(ASCENT_DURATION_S, t));
  const u = clamped / ASCENT_DURATION_S; // 0..1 progress

  // Altitude: smooth accelerating curve reaching ~400 km (ISS orbit altitude).
  const altitude = 400_000 * (u * u * (3 - 2 * u)); // smoothstep to 400 km

  // Velocity: eases up to orbital ~7660 m/s.
  const velocity = 7660 * Math.pow(u, 1.35);

  // Pitch program: hold vertical ~8s, gravity turn through ascent.
  const turnStart = 8 / ASCENT_DURATION_S;
  const pitch =
    u < turnStart ? 0 : 90 * Math.pow(Math.min(1, (u - turnStart) / (1 - turnStart)), 0.8);

  // Stage separation at ~70% of ascent (~29.4s).
  const stage: 1 | 2 = u < 0.7 ? 1 : 2;

  const dynP = maxQ(clamped);

  return { altitude, velocity, pitch, yaw: 90 * u, stage, dynamicPressure: dynP };
}

export function maxQ(t: number): number {
  // Dynamic-pressure bell peaking around t≈20s (scaled to our 42s).
  const u = Math.max(0, t) / 20;
  return Math.exp(-((u - 1) ** 2) / 0.4);
}