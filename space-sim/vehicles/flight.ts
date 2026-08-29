// space-sim/vehicles/flight.ts
import { Axis, Quaternion, Vector3, type TransformNode } from "@babylonjs/core";

export type FlightPhase = "pad" | "liftoff" | "ascent" | "orbit";

/** Cinematic (compressed) ascent: 280 s from liftoff to insertion. */
const T_INSERT = 280;
const T_SRB_SEP = 110;
const T_CORE_SEP = 210;
const TARGET_ALT = 400000; // m
const TARGET_DOWNRANGE = 120000; // m

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function altitudeAt(t: number): number {
  if (t <= 0) return 0;
  // Ease-in start (slow initial climb), long exponential-ish climb, flatten at insertion
  const k = smoothstep(0, T_INSERT, t);
  const eased = Math.pow(k, 2.1) * (3 - 2 * Math.pow(k, 0.35));
  return Math.max(0, eased * TARGET_ALT);
}

export function downrangeAt(t: number): number {
  if (t <= 0) return 0;
  const k = smoothstep(20, T_INSERT, t);
  return k * TARGET_DOWNRANGE;
}

export function pitchAt(t: number): number {
  if (t <= 0) return 0;
  return smoothstep(8, T_INSERT, t) * (Math.PI / 2 - 0.12);
}

export function maxQWindow(): [number, number] {
  return [38, 62];
}

export function phaseOf(t: number): FlightPhase {
  if (t <= 0) return "pad";
  if (t > T_INSERT) return "orbit";
  return t < 12 ? "liftoff" : "ascent";
}

export { T_INSERT, T_SRB_SEP, T_CORE_SEP };

export interface StackNodes {
  root: TransformNode;
  coreNode: TransformNode;
  srbL: TransformNode;
  srbR: TransformNode;
  icpsNode: TransformNode;
  orionNode: TransformNode;
  lasNode: TransformNode;
  detach(node: TransformNode): void;
}

export class FlightModel {
  currentAltitude = 0;
  jettisoned = new Set<string>();
  private t0: number | null = null; // mission time of liftoff
  private srbDrift = new Map<TransformNode, { v: Vector3; spin: number }>();
  private coreDrift: { v: Vector3 } | null = null;

  constructor(private stack: StackNodes) {}

  get liftoffTime(): number {
    return this.t0 ?? -1;
  }

  ignite(): void {
    /* visual handled by ExhaustSystem; ML arms retract handled by UI sink */
  }

  liftoff(): void {
    this.t0 = 0;
  }

  separateSrb(): void {
    if (this.jettisoned.has("srb")) return;
    this.jettisoned.add("srb");
    for (const srb of [this.stack.srbL, this.stack.srbR]) {
      this.stack.detach(srb);
      const outward = srb.name === "srbL" ? -1 : 1;
      this.srbDrift.set(srb, {
        v: new Vector3(outward * 6, -4, 0),
        spin: outward * 0.6,
      });
    }
  }

  separateCore(): void {
    if (this.jettisoned.has("core")) return;
    this.jettisoned.add("core");
    this.stack.detach(this.stack.coreNode);
    this.coreDrift = { v: new Vector3(0, -8, 0) };
  }

  orbitInsertion(): void {
    if (this.jettisoned.has("icps")) return;
    this.jettisoned.add("icps");
    this.stack.detach(this.stack.icpsNode);
    this.stack.detach(this.stack.lasNode);
  }

  /** t = seconds since liftoff (negative = pre-liftoff). dt in seconds. */
  update(t: number, dt: number): void {
    this.currentAltitude = altitudeAt(t);
    const alt = this.currentAltitude;
    const pitch = pitchAt(t);
    const dr = downrangeAt(t);
    if (t >= 0) {
      this.stack.root.position.y = 24 + alt;
      // Downrange east (+X), pitch over: rotate stack about Z toward +X
      this.stack.root.rotation.z = -pitch;
      this.stack.root.position.x = dr * Math.cos(pitch);
    }
    // Jettisoned pieces keep their own motion
    for (const [node, drift] of this.srbDrift) {
      node.position.addInPlace(drift.v.scale(dt));
      drift.v.y -= 9.8 * dt * 0.4;
      // detach() bakes rotationQuaternion; Babylon ignores Euler writes while a
      // quaternion is set, so tumble via incremental quaternion multiplies
      node.rotationQuaternion = node.rotationQuaternion ?? Quaternion.Identity();
      node.rotationQuaternion = Quaternion.RotationAxis(Axis.Z, drift.spin * dt)
        .multiply(node.rotationQuaternion);
    }
    if (this.coreDrift) {
      const core = this.stack.coreNode;
      core.position.addInPlace(this.coreDrift.v.scale(dt));
      this.coreDrift.v.y -= 9.8 * dt * 0.3;
      core.rotationQuaternion = core.rotationQuaternion ?? Quaternion.Identity();
      core.rotationQuaternion = Quaternion.RotationAxis(Axis.X, 0.05 * dt)
        .multiply(core.rotationQuaternion);
    }
  }
}
