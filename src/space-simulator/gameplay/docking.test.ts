import { describe, expect, it } from 'vitest';
import {
  DockingController,
  DOCK_TOLERANCES,
  type InputState,
} from './docking';
import { Quaternion } from '@babylonjs/core/Maths/math.vector';

describe('DockingController', () => {
  const dt = 0.016; // ~60fps
  const zeroInput: InputState = {
    moveX: 0, moveY: 0, moveZ: 0,
    lookX: 0, lookY: 0,
    boost: false, brake: false, interact: false
  };

  it('initializes out of bounds for success', () => {
    const dc = new DockingController();
    const state = dc.getState();
    expect(state.alignmentScore).toBeLessThan(100);
    expect(state.distance).toBeGreaterThan(DOCK_TOLERANCES.distance);
  });

  it('brakes relative velocity to zero', () => {
    const dc = new DockingController();
    // Force a velocity
    dc.velocity.copyFromFloats(10, -5, 2);
    expect(dc.getState().relativeVelocity).toBeGreaterThan(1);
    
    // Apply brake over many frames
    for(let i=0; i<100; i++) {
      dc.update(dt, { ...zeroInput, brake: true });
    }
    
    expect(dc.getState().relativeVelocity).toBeCloseTo(0, 2);
  });

  it('translates locally based on input', () => {
    const dc = new DockingController();
    dc.rotation = Quaternion.Identity();
    dc.update(dt, { ...zeroInput, moveZ: 1 }); // Forward
    expect(dc.velocity.z).toBeGreaterThan(0);
    expect(dc.velocity.x).toBeCloseTo(0);
    expect(dc.velocity.y).toBeCloseTo(0);
  });

  it('calculates alignment score correctly', () => {
    const dc = new DockingController();
    // Perfectly aligned
    dc.position.copyFromFloats(0, 0, 0); // At port
    dc.velocity.copyFromFloats(0, 0, 0); // No speed
    dc.rotation.copyFrom(Quaternion.Identity()); // Aligned
    
    const state = dc.getState();
    expect(state.distance).toBe(0);
    expect(state.relativeVelocity).toBe(0);
    expect(state.yawError).toBe(0);
    expect(state.pitchError).toBe(0);
    expect(state.rollError).toBe(0);
    expect(state.alignmentScore).toBe(100);
    expect(dc.isDockable()).toBe(true);
  });

  it('fails dockability if any parameter is outside tolerance', () => {
    const dc = new DockingController();
    dc.position.copyFromFloats(0, 0, 0);
    dc.velocity.copyFromFloats(0, 0, 0);
    dc.rotation.copyFrom(Quaternion.Identity());
    
    // Test distance
    dc.position.z = DOCK_TOLERANCES.distance + 0.1;
    expect(dc.isDockable()).toBe(false);
    dc.position.z = 0;
    
    // Test speed
    dc.velocity.x = DOCK_TOLERANCES.speed + 0.1;
    expect(dc.isDockable()).toBe(false);
    dc.velocity.x = 0;
    
    // Test yaw (using Euler angles for setup simplicity, tested controller uses Quaternions)
    dc.rotation = Quaternion.RotationYawPitchRoll((DOCK_TOLERANCES.yaw + 1) * Math.PI / 180, 0, 0);
    expect(dc.isDockable()).toBe(false);
  });
});
