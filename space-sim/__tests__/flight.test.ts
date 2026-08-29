// space-sim/__tests__/flight.test.ts
import { describe, expect, it } from "vitest";
import { altitudeAt, downrangeAt, maxQWindow, pitchAt } from "../vehicles/flight";

describe("flight profile", () => {
  it("starts on the pad", () => {
    expect(altitudeAt(-5)).toBe(0);
    expect(altitudeAt(0)).toBe(0);
    expect(downrangeAt(0)).toBe(0);
  });
  it("is monotonically climbing after liftoff", () => {
    let prev = 0;
    for (let t = 1; t <= 280; t += 5) {
      const a = altitudeAt(t);
      expect(a).toBeGreaterThan(prev);
      prev = a;
    }
  });
  it("reaches ~400km orbital altitude by insertion", () => {
    expect(altitudeAt(280)).toBeGreaterThan(380000);
    expect(altitudeAt(280)).toBeLessThan(420000);
  });
  it("pitches from vertical toward horizontal", () => {
    expect(pitchAt(1)).toBeLessThan(0.1);
    expect(pitchAt(280)).toBeGreaterThan(1.2);
  });
  it("has a max-Q window in the first 90 seconds", () => {
    const [q0, q1] = maxQWindow();
    expect(q0).toBeGreaterThan(20);
    expect(q1).toBeLessThan(90);
    expect(q1).toBeGreaterThan(q0);
  });
  it("downrange grows to hundreds of km by insertion", () => {
    expect(downrangeAt(280)).toBeGreaterThan(50000);
  });
});
