// space-sim/__tests__/docking.test.ts
import { describe, expect, it } from "vitest";
import { dockingTelemetry } from "../iss/docking";

describe("dockingTelemetry", () => {
  it("computes range as distance along approach", () => {
    const t = dockingTelemetry({ x: 0, y: 0, z: 200 }, { x: 0, y: 0, z: -0.05 });
    expect(t.range).toBeCloseTo(200);
  });
  it("closure is positive when closing", () => {
    const t = dockingTelemetry({ x: 0, y: 0, z: 200 }, { x: 0, y: 0, z: -0.05 });
    expect(t.closure).toBeCloseTo(0.05);
  });
  it("closure negative when receding", () => {
    const t = dockingTelemetry({ x: 0, y: 0, z: 200 }, { x: 0, y: 0, z: 0.1 });
    expect(t.closure).toBeCloseTo(-0.1);
  });
  it("lateral offset from xy", () => {
    const t = dockingTelemetry({ x: 0.4, y: 0.3, z: 50 }, { x: 0, y: 0, z: 0 });
    expect(t.lateralOffset).toBeCloseTo(0.5);
  });
  it("align error grows with lateral offset", () => {
    const onAxis = dockingTelemetry({ x: 0, y: 0, z: 50 }, { x: 0, y: 0, z: 0 });
    const off = dockingTelemetry({ x: 2, y: 0, z: 50 }, { x: 0, y: 0, z: 0 });
    expect(off.alignErrorDeg).toBeGreaterThan(onAxis.alignErrorDeg);
  });
  it("phase maps by range", () => {
    expect(dockingTelemetry({ x: 0, y: 0, z: 120 }, { x: 0, y: 0, z: 0 }).phase).toBe("range");
    expect(dockingTelemetry({ x: 0, y: 0, z: 20 }, { x: 0, y: 0, z: 0 }).phase).toBe("approach");
    expect(dockingTelemetry({ x: 0, y: 0, z: 0.2 }, { x: 0, y: 0, z: 0 }).phase).toBe("contact");
    expect(dockingTelemetry({ x: 0, y: 0, z: -0.3 }, { x: 0, y: 0, z: 0 }).phase).toBe("captured");
  });
  it("phase reports captured inside and hardDocked past the capture envelope", () => {
    expect(dockingTelemetry({ x: 0, y: 0, z: -0.2 }, { x: 0, y: 0, z: 0 }).phase).toBe("captured");
    expect(dockingTelemetry({ x: 0, y: 0, z: -0.4 }, { x: 0, y: 0, z: 0 }).phase).toBe("hardDocked");
    expect(dockingTelemetry({ x: 0, y: 0, z: -0.6 }, { x: 0, y: 0, z: 0 }).phase).toBe("hardDocked");
  });
});
