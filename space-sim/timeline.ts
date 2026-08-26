// space-sim/timeline.ts
/**
 * Pure timeline math for the intro cutscene (no Babylon imports).
 * Six shots, back-to-back; countdown ticks during the pad shot;
 * a single liftoff event at ignition start.
 */

export interface Shot {
  /** Shot identifier used by the choreography switch. */
  name: 'pad' | 'ignition' | 'tracker' | 'onboard' | 'orbit' | 'dock';
  /** Seconds from cutscene start. */
  start: number;
  /** Seconds. */
  dur: number;
}

/** Shot table (PRD §B.2 ascent beats, compressed to ~40 s). */
export const SHOTS: Shot[] = [
  { name: 'pad', start: 0, dur: 12 },
  { name: 'ignition', start: 12, dur: 3 },
  { name: 'tracker', start: 15, dur: 6 },
  { name: 'onboard', start: 21, dur: 5 },
  { name: 'orbit', start: 26, dur: 7 },
  { name: 'dock', start: 33, dur: 7 },
];

/** Total cutscene length in seconds. */
export const TOTAL_S = SHOTS[SHOTS.length - 1].start + SHOTS[SHOTS.length - 1].dur;

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** Active shot at global time t (clamped to the first/last shot). */
export function shotAt(t: number): Shot {
  const time = clamp01(t / TOTAL_S) * TOTAL_S;
  for (const s of SHOTS) {
    if (time < s.start + s.dur) return s;
  }
  return SHOTS[SHOTS.length - 1];
}

/**
 * Countdown tick at global time t:
 *   10..1 during the pad shot (one per second), 0 = LIFTOFF flash
 *   during the first 0.25 s of the ignition shot, null otherwise.
 */
export function tickAt(t: number): number | null {
  const s = shotAt(t);
  if (s.name === 'pad') {
    const elapsed = t - s.start;
    return Math.max(1, 10 - Math.floor(elapsed));
  }
  if (s.name === 'ignition' && t < s.start + 0.5) return 0; // LIFTOFF flash window
  return null;
}

/** Smooth ease-in-out (cubic). */
export function easeInOut(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export { clamp01 };
