import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';

export interface DockingState {
  distance: number;
  relativeVelocity: number;
  yawError: number;
  pitchError: number;
  rollError: number;
  alignmentScore: number;
}

export interface InputState {
  moveX: number;
  moveY: number;
  moveZ: number;
  lookX: number;
  lookY: number;
  boost: boolean;
  brake: boolean;
  interact: boolean;
}

export const DOCK_TOLERANCES = {
  distance: 2.0,
  speed: 0.15,
  yaw: 3,
  pitch: 3,
  roll: 3,
} as const;

const DOCK_ACCEL = 2;
const DOCK_BOOST_FACTOR = 3;
const DOCK_BRAKE_DAMP = 5;
const DOCK_DRAG = 0.05;
const DOCK_TURN_RATE = 0.6;

const RAD_TO_DEG = 180 / Math.PI;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class DockingController {
  position: Vector3;
  velocity: Vector3;
  rotation: Quaternion;

  constructor() {
    this.position = new Vector3(12, 4, 10);
    this.velocity = Vector3.Zero();
    this.rotation = Quaternion.RotationYawPitchRoll(0.05, -0.03, 0.02);
  }

  update(dt: number, input: InputState): void {
    const frame = Matrix.Identity();
    Matrix.FromQuaternionToRef(this.rotation, frame);

    const thrustLocal = new Vector3(
      input.moveX,
      input.moveY,
      input.moveZ,
    ).scaleInPlace(DOCK_ACCEL * (input.boost ? DOCK_BOOST_FACTOR : 1) * dt);
    const thrustWorld = Vector3.TransformNormal(thrustLocal, frame);
    this.velocity.addInPlace(thrustWorld);

    const damp = Math.exp(
      -(input.brake ? DOCK_BRAKE_DAMP : DOCK_DRAG) * dt,
    );
    this.velocity.scaleInPlace(damp);

    this.position.addInPlace(this.velocity.scale(dt));

    const turn = DOCK_TURN_RATE * dt;
    const delta = Quaternion.RotationYawPitchRoll(
      input.lookX * turn,
      input.lookY * turn,
      0,
    );
    this.rotation = this.rotation.multiply(delta);
  }

  getState(): DockingState {
    const euler = this.rotation.toEulerAngles();
    const yawError = Math.abs(euler.y * RAD_TO_DEG);
    const pitchError = Math.abs(euler.x * RAD_TO_DEG);
    const rollError = Math.abs(euler.z * RAD_TO_DEG);
    const distance = this.position.length();
    const relativeVelocity = this.velocity.length();

    const distancePenalty = (distance / DOCK_TOLERANCES.distance) * 40;
    const speedPenalty = (relativeVelocity / DOCK_TOLERANCES.speed) * 30;
    const anglePenalty =
      ((yawError + pitchError + rollError) /
        (DOCK_TOLERANCES.yaw + DOCK_TOLERANCES.pitch + DOCK_TOLERANCES.roll)) *
      30;

    return {
      distance,
      relativeVelocity,
      yawError,
      pitchError,
      rollError,
      alignmentScore: clamp(
        100 - distancePenalty - speedPenalty - anglePenalty,
        0,
        100,
      ),
    };
  }

  isDockable(): boolean {
    const s = this.getState();
    return (
      s.distance < DOCK_TOLERANCES.distance &&
      s.relativeVelocity < DOCK_TOLERANCES.speed &&
      s.yawError < DOCK_TOLERANCES.yaw &&
      s.pitchError < DOCK_TOLERANCES.pitch &&
      s.rollError < DOCK_TOLERANCES.roll
    );
  }
}
