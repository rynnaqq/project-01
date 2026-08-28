/**
 * First-person Zero-G interior controller (PRD §10).
 * Pure kinematic momentum and drag calculations.
 */

export interface ZeroGInput {
  moveX: number; // Strafe Left/Right (-1..1)
  moveY: number; // Float Up/Down (-1..1)
  moveZ: number; // Thruster Forward/Backward (-1..1)
  brake?: boolean;
}

export interface ZeroGConfig {
  acceleration: number;
  drag: number;
  maxSpeed: number;
}

export class ZeroGController {
  velocity = { x: 0, y: 0, z: 0 };

  constructor(
    private readonly config: ZeroGConfig = {
      acceleration: 3.5,
      drag: 0.85, // damping per second
      maxSpeed: 2.5,
    }
  ) {}

  reset(): void {
    this.velocity = { x: 0, y: 0, z: 0 };
  }

  step(
    input: ZeroGInput,
    currentViewDirection: { x: number; y: number; z: number },
    dt: number
  ): { x: number; y: number; z: number } {
    // Normalize forward vector
    const len =
      Math.sqrt(
        currentViewDirection.x ** 2 +
          currentViewDirection.y ** 2 +
          currentViewDirection.z ** 2
      ) || 1;
    const fwd = {
      x: currentViewDirection.x / len,
      y: currentViewDirection.y / len,
      z: currentViewDirection.z / len,
    };

    // Right = cross(Up, Forward) where Up = (0, 1, 0)
    const right = {
      x: fwd.z,
      y: 0,
      z: -fwd.x,
    };
    const rLen = Math.sqrt(right.x ** 2 + right.z ** 2) || 1;
    right.x /= rLen;
    right.z /= rLen;

    // Up vector for camera orientation
    const up = { x: 0, y: 1, z: 0 };

    if (input.brake) {
      const brakeFactor = Math.pow(0.1, dt);
      this.velocity.x *= brakeFactor;
      this.velocity.y *= brakeFactor;
      this.velocity.z *= brakeFactor;
    } else {
      // Apply linear acceleration in camera relative space
      const ax =
        (fwd.x * input.moveZ + right.x * input.moveX) * this.config.acceleration;
      const ay =
        (fwd.y * input.moveZ + up.y * input.moveY) * this.config.acceleration;
      const az =
        (fwd.z * input.moveZ + right.z * input.moveX) * this.config.acceleration;

      this.velocity.x += ax * dt;
      this.velocity.y += ay * dt;
      this.velocity.z += az * dt;
    }

    // Apply drag
    const dragMult = Math.pow(this.config.drag, dt);
    this.velocity.x *= dragMult;
    this.velocity.y *= dragMult;
    this.velocity.z *= dragMult;

    // Cap speed
    const currentSpeed = Math.sqrt(
      this.velocity.x ** 2 + this.velocity.y ** 2 + this.velocity.z ** 2
    );
    if (currentSpeed > this.config.maxSpeed) {
      const scale = this.config.maxSpeed / currentSpeed;
      this.velocity.x *= scale;
      this.velocity.y *= scale;
      this.velocity.z *= scale;
    }

    return {
      x: this.velocity.x * dt,
      y: this.velocity.y * dt,
      z: this.velocity.z * dt,
    };
  }
}