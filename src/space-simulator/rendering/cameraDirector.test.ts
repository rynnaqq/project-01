import { describe, expect, it } from 'vitest';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CameraDirector } from './cameraDirector';

describe('CameraDirector', () => {
  it('initializes in ground shot mode', () => {
    const cd = new CameraDirector();
    expect(cd.getShot()).toBe('SHOT_01_GROUND');
  });

  it('updates shots and computes camera poses', () => {
    const cd = new CameraDirector();
    cd.playShot('SHOT_02_BOOSTER');
    expect(cd.getShot()).toBe('SHOT_02_BOOSTER');

    const rocketPos = new Vector3(0, 100, 0);
    const pose = cd.computeShotCamera('SHOT_02_BOOSTER', rocketPos);
    expect(pose.position.y).toBeCloseTo(98.8);
    expect(pose.target.y).toBeCloseTo(80);
  });

  it('applies damped shake and respects reducedMotion setting', () => {
    const cd = new CameraDirector(false);
    cd.triggerPresetShake('ENGINE_IGNITION');
    const offset1 = cd.update(0.1);
    expect(offset1.length()).toBeGreaterThan(0);

    // After setting reduced motion, shake should be zero
    cd.setReducedMotion(true);
    cd.triggerPresetShake('MAX_Q');
    const offset2 = cd.update(0.1);
    expect(offset2.length()).toBe(0);
  });
});
