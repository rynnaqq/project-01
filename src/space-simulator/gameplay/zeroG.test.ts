import { describe, expect, it } from 'vitest';
import { Quaternion } from '@babylonjs/core/Maths/math.vector';
import { ZeroGController } from './zeroG';
import type { InputState } from './docking';

const idle: InputState = {
  moveX: 0,
  moveY: 0,
  moveZ: 0,
  lookX: 0,
  lookY: 0,
  boost: false,
  brake: false,
  interact: false,
};
const dt = 0.05;

describe('ZeroGController', () => {
  it('integrates thrust into velocity and drifts position', () => {
    const z = new ZeroGController({ dragRate: 0 });
    z.update(dt, { ...idle, moveZ: 1 });
    expect(z.velocity.length()).toBeGreaterThan(0);
    const before = z.position.clone();
    z.update(dt, idle);
    expect(z.position.z).toBeGreaterThan(before.z);
  });

  it('decays drift to rest through drag', () => {
    const z = new ZeroGController();
    z.velocity.set(2, 0, 0);
    for (let i = 0; i < 200; i += 1) z.update(dt, idle);
    expect(z.velocity.length()).toBeLessThan(0.01);
  });

  it('clamps speed to maxSpeed even while boosting', () => {
    const z = new ZeroGController({ dragRate: 0, maxSpeed: 1 });
    for (let i = 0; i < 100; i += 1) {
      z.update(dt, { ...idle, moveZ: 1, boost: true });
    }
    expect(z.velocity.length()).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('thrusts along the facing frame after a 180° yaw', () => {
    const z = new ZeroGController({ dragRate: 0 });
    z.rotation = Quaternion.RotationYawPitchRoll(Math.PI, 0, 0);
    z.update(dt, { ...idle, moveZ: 1 });
    expect(z.velocity.z).toBeLessThan(0);
  });

  it('rotates the frame from look input', () => {
    const z = new ZeroGController({ dragRate: 0 });
    const q0 = z.rotation.clone();
    z.update(dt, { ...idle, lookX: 1 });
    expect(Quaternion.Dot(q0, z.rotation)).toBeLessThan(1);
  });

  it('is deterministic for identical input sequences', () => {
    const a = new ZeroGController({ dragRate: 0 });
    const b = new ZeroGController({ dragRate: 0 });
    for (let i = 0; i < 10; i += 1) {
      const moveZ = i % 2;
      a.update(dt, { ...idle, moveZ });
      b.update(dt, { ...idle, moveZ });
    }
    expect(a.position.equals(b.position)).toBe(true);
  });
});
