/**
 * Pure docking-criteria logic (PRD §B.10). No Babylon imports — fully testable.
 */
import { DOCK } from './config';

export interface DockInput {
  distanceM: number;
  relSpeedMps: number;
  alignmentDeg: number;
  inCorridor: boolean;
}

export type ApproachState = 'SAFE' | 'CAUTION' | 'CRITICAL' | 'DOCKING_READY';

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** All criteria strictly inside thresholds (PRD §B.10). */
export function canDock(i: DockInput): boolean {
  return (
    i.inCorridor &&
    i.distanceM < DOCK.distanceM &&
    i.relSpeedMps < DOCK.relSpeedMps &&
    i.alignmentDeg < DOCK.alignmentDeg
  );
}

/** Coarse HUD state: Safe → Caution → Critical → Docking Ready (PRD §B.11). */
export function approachState(i: DockInput): ApproachState {
  if (canDock(i)) return 'DOCKING_READY';
  const tooFast = i.relSpeedMps > DOCK.relSpeedMps;
  const nearAndFast = i.distanceM < DOCK.distanceM * 3 && i.relSpeedMps > DOCK.relSpeedMps * 2;
  if (nearAndFast) return 'CRITICAL';
  // Misalignment only matters once you're close; far away you're just cruising.
  if (tooFast || (i.distanceM < 50 && i.alignmentDeg > DOCK.alignmentDeg * 3)) return 'CAUTION';
  return 'SAFE';
}

/** 0°→100%, 90°→0%. */
export function alignmentPct(alignmentDeg: number): number {
  return Math.round(100 * clamp01(1 - alignmentDeg / 90));
}

/** 0–100 composite score from distance, speed and alignment at dock time. */
export function dockingAccuracy(i: DockInput): number {
  const d = clamp01(1 - i.distanceM / DOCK.distanceM);
  const s = clamp01(1 - i.relSpeedMps / DOCK.relSpeedMps);
  const a = clamp01(1 - i.alignmentDeg / DOCK.alignmentDeg);
  return Math.round(((d + s + a) / 3) * 100);
}

export type Grade = 'A' | 'B' | 'C' | 'D';
export function rating(accuracy: number, fuelPct: number): Grade {
  const score = accuracy * 0.7 + fuelPct * 0.3;
  if (score >= 85) return 'A';
  if (score >= 50) return 'B';
  if (score >= 30) return 'C';
  return 'D';
}
