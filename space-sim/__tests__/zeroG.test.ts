// space-sim/__tests__/zeroG.test.ts
import { describe, expect, it } from "vitest";
import { ZeroGState, type ZeroGInput } from "../player/controller";

const idle: ZeroGInput = { thrust: { x: 0, y: 0, z: 0 }, yawDelta: 0, pitchDelta: 0, boost: false };

describe("ZeroGState", () => {
  it("accelerates while thrusting and coasts when idle", () => {
    const s = new ZeroGState();
    s.step(0.5, { ...idle, thrust: { x: 0, y: 0, z: 1 } });
    expect(s.vel.z).toBeGreaterThan(0.5);
    const vCoast = s.vel.z;
    s.step(0.0001, idle);
    expect(s.vel.z).toBeCloseTo(vCoast, 2);
  });
  it("damps velocity over time", () => {
    const s = new ZeroGState();
    s.step(0.5, { ...idle, thrust: { x: 0, y: 0, z: 1 } });
    const v0 = s.vel.z;
    s.step(1, idle);
    expect(s.vel.z).toBeLessThan(v0 * 0.5);
  });
  it("integrates position from velocity", () => {
    const s = new ZeroGState();
    s.step(1, { ...idle, thrust: { x: 1, y: 0, z: 0 } });
    expect(s.pos.x).toBeGreaterThan(0.3);
  });
  it("boost increases acceleration", () => {
    const a = new ZeroGState();
    a.step(0.5, { ...idle, thrust: { x: 0, y: 0, z: 1 }, boost: true });
    const b = new ZeroGState();
    b.step(0.5, { ...idle, thrust: { x: 0, y: 0, z: 1 }, boost: false });
    expect(a.vel.z).toBeGreaterThan(b.vel.z * 1.5);
  });
  it("resolves capsule against a wall collider (no tunneling)", () => {
    const s = new ZeroGState();
    s.pos = { x: 0, y: 0, z: 0 };
    const wall = { min: { x: 1.0, y: -2, z: -2 }, max: { x: 1.2, y: 2, z: 2 } };
    for (let i = 0; i < 60; i++) s.step(0.1, { ...idle, thrust: { x: 1, y: 0, z: 0 } }, [wall]);
    expect(s.pos.x).toBeLessThan(0.66); // radius 0.35 margin
  });
  it("smooths rotation toward mouse deltas", () => {
    const s = new ZeroGState();
    s.step(0.1, { ...idle, yawDelta: 1 });
    expect(s.yaw).toBeGreaterThan(0);
    expect(s.yaw).toBeLessThan(0.6);
  });
});
