/**
 * Docking Controller & State (PRD §8). Pure physics & logic.
 * Coordinate system:
 * Z- is initial approach offset (towards Z=0 target port).
 * X is right/left.
 * Y is up/down.
 */

export interface DockingState {
  distance: number;
  relativeVelocity: number;
  transverseError: number;
  yawError: number;
  pitchError: number;
  rollError: number;
  alignmentScore: number;
}

export type DockingStatus = 'LOCKED' | 'READY' | 'CORRECTING' | 'UNSAFE';
export type DockingDifficulty = 'EASY' | 'NORMAL' | 'HARD';

export interface DockingInput {
  moveX: number; // Strafe L/R (-1..1)
  moveY: number; // Strafe U/D (-1..1)
  moveZ: number; // Fwd/Bck (-1..1)
  pitch: number; // Pitch up/down (-1..1)
  yaw: number;   // Yaw left/right (-1..1)
  roll: number;  // Roll CCW/CW (-1..1)
  brake?: boolean;
}

export class DockingController {
  // Config
  private readonly mass = 12000; // kg (capsule mass)
  private readonly thrusterForce = 2400; // N
  private readonly rcsTorque = 1800; // Nm
  private readonly inertia = 8000;

  // State (relative to ISS docking port target at origin 0,0,0)
  position = { x: 2.0, y: 1.5, z: -45.0 }; // start 45m out slightly offset
  velocity = { x: 0, y: 0, z: 0.8 };       // initial gentle forward drift
  rotation = { pitch: 4.5, yaw: -6.0, roll: 2.0 }; // start slightly misaligned
  angularVelocity = { pitch: 0, yaw: 0, roll: 0 };

  difficulty: DockingDifficulty = 'NORMAL';
  private _docked = false;

  constructor(difficulty: DockingDifficulty = 'NORMAL') {
    this.difficulty = difficulty;
  }

  get isDocked(): boolean {
    return this._docked;
  }

  reset(startDist = 45): void {
    this.position = { x: 2.0, y: 1.5, z: -startDist };
    this.velocity = { x: 0, y: 0, z: 0.6 };
    this.rotation = { pitch: 4.5, yaw: -6.0, roll: 2.0 };
    this.angularVelocity = { pitch: 0, yaw: 0, roll: 0 };
    this._docked = false;
  }

  /** Advances physics by dt (seconds) */
  step(input: DockingInput, dt: number): DockingState {
    if (this._docked) return this.getState();

    // Brake input directly decelerates linear & angular velocity
    if (input.brake) {
      const brakeFactor = Math.exp(-2.0 * dt);
      this.velocity.x *= brakeFactor;
      this.velocity.y *= brakeFactor;
      this.velocity.z *= brakeFactor;
      this.angularVelocity.pitch *= brakeFactor;
      this.angularVelocity.yaw *= brakeFactor;
      this.angularVelocity.roll *= brakeFactor;
    }

    // Auto-assist for Easy / Normal
    let assistPitch = 0;
    let assistYaw = 0;
    let assistRoll = 0;
    if (this.difficulty === 'EASY') {
      assistPitch = -this.rotation.pitch * 0.5;
      assistYaw = -this.rotation.yaw * 0.5;
      assistRoll = -this.rotation.roll * 0.5;
    }

    // Linear Acceleration
    const accelX = (input.moveX * this.thrusterForce) / this.mass;
    const accelY = (input.moveY * this.thrusterForce) / this.mass;
    const accelZ = (input.moveZ * this.thrusterForce) / this.mass;

    this.velocity.x += accelX * dt;
    this.velocity.y += accelY * dt;
    this.velocity.z += accelZ * dt;

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    // Angular Acceleration
    const alphaPitch = ((input.pitch + assistPitch) * this.rcsTorque) / this.inertia;
    const alphaYaw = ((input.yaw + assistYaw) * this.rcsTorque) / this.inertia;
    const alphaRoll = ((input.roll + assistRoll) * this.rcsTorque) / this.inertia;

    this.angularVelocity.pitch += alphaPitch * dt;
    this.angularVelocity.yaw += alphaYaw * dt;
    this.angularVelocity.roll += alphaRoll * dt;

    this.rotation.pitch += this.angularVelocity.pitch * dt;
    this.rotation.yaw += this.angularVelocity.yaw * dt;
    this.rotation.roll += this.angularVelocity.roll * dt;

    // Flight computer dampening
    const linearDamping = this.difficulty === 'HARD' ? Math.exp(-0.02 * dt) : Math.exp(-0.15 * dt);
    const angularDamping = this.difficulty === 'HARD' ? Math.exp(-0.05 * dt) : Math.exp(-0.6 * dt);
    this.velocity.x *= linearDamping;
    this.velocity.y *= linearDamping;
    this.velocity.z *= linearDamping;
    this.angularVelocity.pitch *= angularDamping;
    this.angularVelocity.yaw *= angularDamping;
    this.angularVelocity.roll *= angularDamping;

    // Check success criteria
    const state = this.getState();
    const status = getDockingStatus(state);

    if (state.distance <= 1.5 && status === 'READY') {
      this._docked = true;
      // Snap into locked position
      this.position = { x: 0, y: 0, z: 0 };
      this.velocity = { x: 0, y: 0, z: 0 };
      this.rotation = { pitch: 0, yaw: 0, roll: 0 };
      this.angularVelocity = { pitch: 0, yaw: 0, roll: 0 };
    }

    return this.getState();
  }

  getState(): DockingState {
    const dist = Math.sqrt(
      this.position.x ** 2 + this.position.y ** 2 + this.position.z ** 2
    );
    const vel = Math.sqrt(
      this.velocity.x ** 2 + this.velocity.y ** 2 + this.velocity.z ** 2
    );
    const transverseError = Math.sqrt(this.position.x ** 2 + this.position.y ** 2);

    const norm = (a: number) => {
      let v = a % 360;
      if (v > 180) v -= 360;
      if (v < -180) v += 360;
      return v;
    };

    const pErr = norm(this.rotation.pitch);
    const yErr = norm(this.rotation.yaw);
    const rErr = norm(this.rotation.roll);

    // Alignment calculation: combines transverse distance and angular accuracy
    const posScore = Math.max(0, 1 - transverseError / 4.0);
    const rotErrTotal = Math.abs(pErr) + Math.abs(yErr) + Math.abs(rErr);
    const rotScore = Math.max(0, 1 - rotErrTotal / 25.0);
    const alignmentScore = Math.round(posScore * rotScore * 100);

    return {
      distance: dist,
      relativeVelocity: vel,
      transverseError,
      pitchError: pErr,
      yawError: yErr,
      rollError: rErr,
      alignmentScore,
    };
  }
}

export function getDockingStatus(state: DockingState): DockingStatus {
  if (state.distance <= 0.05 && state.alignmentScore >= 90) return 'LOCKED';
  if (state.alignmentScore < 40 || state.relativeVelocity > 1.2) return 'UNSAFE';

  const distOk = state.distance <= 2.5;
  const velOk = state.relativeVelocity <= 0.25;
  const alignOk =
    Math.abs(state.yawError) <= 3.5 &&
    Math.abs(state.pitchError) <= 3.5 &&
    Math.abs(state.rollError) <= 3.5 &&
    state.transverseError <= 0.6;

  if (distOk && velOk && alignOk) return 'READY';
  return 'CORRECTING';
}
