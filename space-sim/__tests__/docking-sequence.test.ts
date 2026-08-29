// space-sim/__tests__/docking-sequence.test.ts
import { NullEngine, Scene, TransformNode } from "@babylonjs/core";
import { describe, expect, it } from "vitest";
import { DockingSequence } from "../iss/docking";

/** issRoot + dockingPort per iss/exterior.ts (port local (0,-2.5,-11.4), axis -Z). */
function makeRig() {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const issRoot = new TransformNode("issRoot", scene);
  const port = new TransformNode("dockingPort", scene);
  port.parent = issRoot;
  port.position.set(0, -2.5, -11.4);
  const orion = new TransformNode("orion", scene);
  orion.parent = issRoot; // runtime startDocking() re-parents here
  return { issRoot, port, orion, seq: new DockingSequence(orion, port) };
}

describe("DockingSequence scripted poses", () => {
  it("starts the approach 200 m out on the -Z corridor, on the port axis", () => {
    const { orion, seq } = makeRig();
    seq.setProgress(0);
    expect(orion.position.x).toBeCloseTo(0);
    expect(orion.position.y).toBeCloseTo(-2.5);
    expect(orion.position.z).toBeCloseTo(-212.5); // -11.4 - (1.1 contact plane + 200)
  });

  it("pins contact, capture and hard-dock poses on the corridor", () => {
    const { orion, seq } = makeRig();
    seq.setProgress(0.5);
    seq.contact();
    expect(orion.position.x).toBeCloseTo(0);
    expect(orion.position.y).toBeCloseTo(-2.5);
    expect(orion.position.z).toBeCloseTo(-13.0); // -11.4 - (1.1 + 0.5)
    seq.capture();
    expect(orion.position.z).toBeCloseTo(-12.3); // -11.4 - (1.1 - 0.2)
    seq.hardDock();
    expect(orion.position.z).toBeCloseTo(-12.1); // -11.4 - (1.1 - 0.4)
  });

  it("reports contact → captured → hardDocked telemetry across the terminal states", () => {
    const { seq } = makeRig();
    seq.setProgress(0.5);
    seq.contact();
    expect(seq.telemetry().phase).toBe("contact");
    seq.capture();
    expect(seq.telemetry().phase).toBe("captured");
    seq.hardDock();
    const t = seq.telemetry();
    expect(t.phase).toBe("hardDocked");
    expect(t.range).toBeCloseTo(0.4);
  });

  it("ignores setProgress after contact (scripted poses are never overridden)", () => {
    const { orion, seq } = makeRig();
    seq.setProgress(0.5);
    seq.contact();
    seq.setProgress(0);
    expect(orion.position.z).toBeCloseTo(-13.0);
  });
});
