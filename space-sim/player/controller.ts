// space-sim/player/controller.ts
import type { BoxCollider } from "../iss/interior";

export interface ZeroGInput {
  thrust: { x: number; y: number; z: number };
  yawDelta: number; pitchDelta: number; boost: boolean;
}

const ACCEL = 2.5;
const DAMPING = 2.2;
const ROT_SPEED = 1.6;
const MAX_PITCH = Math.PI / 2 - 0.05;
const CAPSULE_R = 0.35;

export class ZeroGState {
  pos = { x: 0, y: 0, z: 0 };
  vel = { x: 0, y: 0, z: 0 };
  yaw = 0; pitch = 0;
  private yawVel = 0; private pitchVel = 0;

  speed(): number { return Math.hypot(this.vel.x, this.vel.y, this.vel.z); }

  step(dt: number, input: ZeroGInput, colliders: BoxCollider[] = []): void {
    // Semi-implicit: damp carried inertia first, then apply this frame's thrust
    // (vel = vel*exp(-k·dt) + a·thrust·dt)
    const damp = Math.exp(-DAMPING * dt);
    this.vel.x *= damp; this.vel.y *= damp; this.vel.z *= damp;
    const a = ACCEL * (input.boost ? 2 : 1);
    this.vel.x += input.thrust.x * a * dt;
    this.vel.y += input.thrust.y * a * dt;
    this.vel.z += input.thrust.z * a * dt;
    // Integrate + collide (axis resolve, capsule radius)
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;
    for (const c of colliders) {
      if (
        this.pos.x > c.min.x - CAPSULE_R && this.pos.x < c.max.x + CAPSULE_R &&
        this.pos.y > c.min.y - CAPSULE_R && this.pos.y < c.max.y + CAPSULE_R &&
        this.pos.z > c.min.z - CAPSULE_R && this.pos.z < c.max.z + CAPSULE_R
      ) {
        // push out along smallest penetration axis, zero that velocity
        const pens = [
          { axis: "x", pen: c.max.x + CAPSULE_R - this.pos.x, dir: 1 },
          { axis: "x", pen: this.pos.x - (c.min.x - CAPSULE_R), dir: -1 },
          { axis: "y", pen: c.max.y + CAPSULE_R - this.pos.y, dir: 1 },
          { axis: "y", pen: this.pos.y - (c.min.y - CAPSULE_R), dir: -1 },
          { axis: "z", pen: c.max.z + CAPSULE_R - this.pos.z, dir: 1 },
          { axis: "z", pen: this.pos.z - (c.min.z - CAPSULE_R), dir: -1 },
        ].filter((p) => p.pen > 0).sort((p, q) => p.pen - q.pen);
        const fix = pens[0];
        if (fix) {
          if (fix.axis === "x") { this.pos.x += fix.pen * fix.dir; this.vel.x = 0; }
          else if (fix.axis === "y") { this.pos.y += fix.pen * fix.dir; this.vel.y = 0; }
          else { this.pos.z += fix.pen * fix.dir; this.vel.z = 0; }
        }
      }
    }
    // Rotational momentum toward target
    this.yawVel += (input.yawDelta * ROT_SPEED - this.yawVel) * Math.min(1, dt * 6);
    this.pitchVel += (input.pitchDelta * ROT_SPEED - this.pitchVel) * Math.min(1, dt * 6);
    this.yaw += this.yawVel * dt;
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch + this.pitchVel * dt));
  }
}
