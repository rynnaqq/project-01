// space-sim/__tests__/director.test.ts
import { describe, expect, it } from "vitest";
import { cutHoldSeconds, pickNextShot } from "../cinema/director";

describe("pickNextShot", () => {
  const pool = ["a", "b", "c"];
  it("never repeats the previous shot when alternatives exist", () => {
    for (let i = 0; i < 50; i++) {
      const pick = pickNextShot(pool, "a", i);
      expect(pick).not.toBe("a");
      expect(pool).toContain(pick);
    }
  });
  it("returns the only shot when pool has one entry", () => {
    expect(pickNextShot(["only"], "only", 0)).toBe("only");
  });
  it("falls back to fallback pool when primary is empty", () => {
    expect(pickNextShot([], "x", 0)).toBe("x");
    expect(pickNextShot([], null, 0, ["f1", "f2"])).toBe("f2");
  });
  it("is deterministic for a given seed", () => {
    expect(pickNextShot(pool, "a", 7)).toBe(pickNextShot(pool, "a", 7));
  });
});

describe("cutHoldSeconds", () => {
  it("returns 4–10s for dynamic pacing", () => {
    for (let i = 0; i < 30; i++) {
      const h = cutHoldSeconds("dynamic", i);
      expect(h).toBeGreaterThanOrEqual(4);
      expect(h).toBeLessThanOrEqual(10);
    }
  });
  it("returns 20–60s for contemplative pacing", () => {
    for (let i = 0; i < 30; i++) {
      const h = cutHoldSeconds("contemplative", i);
      expect(h).toBeGreaterThanOrEqual(20);
      expect(h).toBeLessThanOrEqual(60);
    }
  });
});
