// space-sim/__tests__/tier.test.ts
import { describe, expect, it } from "vitest";
import { capsForTier, detectTier } from "../core/engine";

describe("detectTier", () => {
  it("returns high for desktop-class GPU at dpr 1", () => {
    expect(detectTier({ gpu: "NVIDIA GeForce RTX 3070", dpr: 1, cores: 16 })).toBe("high");
  });
  it("returns medium for integrated GPUs", () => {
    expect(detectTier({ gpu: "Apple M1", dpr: 2, cores: 8 })).toBe("medium");
  });
  it("returns low for mobile GPUs", () => {
    expect(detectTier({ gpu: "Apple A15 GPU", dpr: 3, cores: 6 })).toBe("low");
  });
  it("returns low when GPU string is unknown", () => {
    expect(detectTier({ gpu: null, dpr: 1, cores: 4 })).toBe("low");
  });
});

describe("capsForTier", () => {
  it("enables ssao/dof/motionBlur only on high", () => {
    expect(capsForTier("high").ssao).toBe(true);
    expect(capsForTier("medium").ssao).toBe(false);
    expect(capsForTier("medium").dof).toBe(true);
    expect(capsForTier("low").dof).toBe(false);
  });
  it("scales particles and hardware scaling by tier", () => {
    expect(capsForTier("high").maxParticles).toBeGreaterThan(capsForTier("medium").maxParticles);
    expect(capsForTier("low").hardwareScaling).toBeGreaterThan(1);
  });
});
