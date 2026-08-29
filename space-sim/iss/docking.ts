// space-sim/iss/docking.ts
import { Axis, Quaternion, type TransformNode } from "@babylonjs/core";

export type DockingPhase = "range" | "approach" | "contact" | "captured" | "hardDocked";

export interface DockingTelemetry {
  range: number;
  closure: number;
  lateralOffset: number;
  alignErrorDeg: number;
  phase: DockingPhase;
}

export interface RelVec {
  x: number;
  y: number;
  z: number;
}

/**
 * Relative-motion telemetry in the docking frame: origin at the contact plane,
 * +Z pointing back out along the approach corridor (toward the incoming vehicle).
 * Phase thresholds: approach < 30 m, contact < 0.6 m, captured < 0.45 m (only
 * once past the contact plane, z < 0), hardDocked when z < -0.35 m — just past
 * the terminal hard-dock pose (z = -0.4) so the scripted flow's end state
 * reports hardDocked (range itself is never negative, so penetration is
 * measured on the signed axis).
 */
export function dockingTelemetry(relPos: RelVec, relVel: RelVec): DockingTelemetry {
  const range = Math.hypot(relPos.x, relPos.y, relPos.z);
  const closure = range > 1e-6 ? -(relPos.x * relVel.x + relPos.y * relVel.y + relPos.z * relVel.z) / range : 0;
  const lateralOffset = Math.hypot(relPos.x, relPos.y);
  const alignErrorDeg = range > 1e-6 ? Math.atan2(lateralOffset, Math.abs(relPos.z)) * (180 / Math.PI) : 0;
  const phase: DockingPhase =
    relPos.z < -0.35 ? "hardDocked"
    : range < 0.45 && relPos.z < 0 ? "captured"
    : range < 0.6 ? "contact"
    : range < 30 ? "approach"
    : "range";
  return { range, closure, lateralOffset, alignErrorDeg, phase };
}

// Geometry of the scripted approach (see iss/exterior.ts: the PMA-2/IDA stack
// sits at local (0,-2.5,-11.4) with the docking axis along -Z; the IDA ring's
// outboard face is ~1.1 m beyond the port node). All positions below are
// offsets from that contact plane, positive = back out along the corridor.
const START_OFFSET = 200;
const CONTACT_OFFSET = 0.5;
const CAPTURE_OFFSET = -0.2;
const HARD_DOCK_OFFSET = -0.4;
const CONTACT_PLANE = 1.1;
const SCRIPTED_CLOSURE = -0.05; // m/s shown while the approach plays (matches comms script)

type DockingStage = "approach" | "contact" | "captured" | "hardDocked";

const STAGE_RANK: Record<DockingStage, number> = { approach: 0, contact: 1, captured: 2, hardDocked: 3 };

/**
 * Flies Orion down the docking axis from 200 m to contact. The runtime drives
 * the approach with setProgress(k) across ISS_APPROACH + DOCKING_SEQUENCE and
 * pins the final poses with contact()/capture()/hardDock(). Orion is oriented
 * nose-first (+Y, the CM docking axis) toward the port; the ISS root carries no
 * rotation in this scene, so that orientation is the same in local and world
 * space.
 */
export class DockingSequence {
  private stage: DockingStage = "approach";
  private offset = START_OFFSET;

  constructor(
    private orion: TransformNode,
    private port: TransformNode,
  ) {}

  get node(): TransformNode {
    return this.orion;
  }

  get state(): { contact: boolean; captured: boolean; hardDocked: boolean } {
    return {
      contact: STAGE_RANK[this.stage] >= STAGE_RANK.contact,
      captured: STAGE_RANK[this.stage] >= STAGE_RANK.captured,
      hardDocked: this.stage === "hardDocked",
    };
  }

  /** Progress input: 0..1 across the scripted approach window. Ignored once contact is made. */
  setProgress(k: number): void {
    if (this.stage !== "approach") return;
    const clamped = Math.min(1, Math.max(0, k));
    const eased = 1 - Math.pow(1 - clamped, 1.8); // decelerating approach
    this.offset = START_OFFSET * (1 - eased);
    this.place(this.offset);
  }

  contact(): void {
    this.advance("contact", CONTACT_OFFSET);
  }

  capture(): void {
    this.advance("captured", CAPTURE_OFFSET);
  }

  hardDock(): void {
    this.advance("hardDocked", HARD_DOCK_OFFSET);
  }

  /** Relative state in the docking frame (contact plane origin, +Z outboard). */
  telemetry(): DockingTelemetry {
    const closing = this.stage === "approach";
    return dockingTelemetry(
      { x: 0, y: 0, z: this.offset },
      { x: 0, y: 0, z: closing ? SCRIPTED_CLOSURE : 0 },
    );
  }

  private advance(stage: DockingStage, offset: number): void {
    if (STAGE_RANK[stage] <= STAGE_RANK[this.stage]) return; // never regress
    this.stage = stage;
    this.offset = offset;
    this.place(offset);
  }

  private place(offset: number): void {
    // Both nodes are children of issRoot in this scene; bail if that invariant
    // does not hold rather than writing a position into the wrong frame.
    if (this.orion.parent !== this.port.parent) return;
    const outboardZ = -1; // docking axis is -Z (see iss/exterior.ts)
    const px = this.port.position.x;
    const py = this.port.position.y;
    const pz = this.port.position.z;
    this.orion.position.set(px, py, pz + outboardZ * (CONTACT_PLANE + offset));
    // Nose (+Y) onto the approach direction (+Z toward the port).
    this.orion.rotationQuaternion = Quaternion.RotationAxis(Axis.X, Math.PI / 2);
  }
}
