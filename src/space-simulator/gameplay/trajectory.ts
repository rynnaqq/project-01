export const ASCENT_DURATION_S = 40;
export const SEPARATION_TIME_S = 26;

export interface AscentSample {
  altitudeM: number;
  speedMs: number;
  pitchDeg: number;
  stage: 1 | 2;
}

export function sampleAscent(tSec: number): AscentSample {
  const t = Math.min(Math.max(tSec, 0), ASCENT_DURATION_S);
  const tau = t - 10;
  const speedMs = t <= 10 ? 60 * t : 600 + tau * 240;
  const altitudeM = t <= 10 ? 30 * t * t : 3000 + 600 * tau + 120 * tau * tau;
  const pitchDeg = Math.max(0, 90 - Math.max(0, t - 8) * 2.5);
  return { altitudeM, speedMs, pitchDeg, stage: t < SEPARATION_TIME_S ? 1 : 2 };
}
