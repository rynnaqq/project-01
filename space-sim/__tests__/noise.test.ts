// space-sim/__tests__/noise.test.ts
import { describe, expect, it } from "vitest";
import { fbm2, fbm3, valueNoise2, valueNoise3 } from "../core/noise";

describe("valueNoise", () => {
  it("is deterministic", () => {
    expect(valueNoise3(1.2, 3.4, 5.6)).toBe(valueNoise3(1.2, 3.4, 5.6));
    expect(valueNoise2(7.7, 2.2)).toBe(valueNoise2(7.7, 2.2));
  });
  it("stays in [-1, 1]", () => {
    for (let i = 0; i < 500; i++) {
      const v = valueNoise3(i * 0.137, i * 0.291, i * 0.431);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
  it("is continuous across integer lattice", () => {
    expect(Math.abs(valueNoise2(2.0, 3.0) - valueNoise2(2.0001, 3.0001))).toBeLessThan(0.05);
  });
});

describe("fbm", () => {
  it("adds octaves deterministically and stays in [-1, 1]", () => {
    for (let i = 0; i < 300; i++) {
      const v = fbm3(i * 0.05, i * 0.037, i * 0.021, 5);
      expect(v).toBeGreaterThanOrEqual(-1.001);
      expect(v).toBeLessThanOrEqual(1.001);
    }
    expect(fbm2(1, 1, 4)).toBe(fbm2(1, 1, 4));
  });
});
