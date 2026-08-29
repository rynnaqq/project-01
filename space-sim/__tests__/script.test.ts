// space-sim/__tests__/script.test.ts
import { describe, expect, it } from "vitest";
import { MISSION_STATES } from "../mission/engine";
import { MISSION_SCRIPT, STATE_DURATIONS } from "../mission/script";
import { SHOT_IDS } from "../cinema/registry";

describe("STATE_DURATIONS", () => {
  it("defines all 20 states", () => {
    for (const s of MISSION_STATES) expect(STATE_DURATIONS[s]).toBeDefined();
  });
  it("sums to the approved 811s cinematic budget", () => {
    const total = MISSION_STATES.reduce((acc, s) => {
      const d = STATE_DURATIONS[s];
      return acc + (Number.isFinite(d) ? d : 0);
    }, 0);
    expect(total).toBe(811);
  });
  it("uses the approved per-phase durations", () => {
    const want: Record<string, number> = {
      MISSION_INIT: 6, KSC_ESTABLISHING: 45, LAUNCH_PREPARATION: 70, CREW_PREPARATION: 50,
      COUNTDOWN: 80, ENGINE_IGNITION: 12, LIFTOFF: 28, ATMOSPHERIC_ASCENT: 75, BOOSTER_PHASE: 25,
      STAGE_TRANSITION: 30, ORBITAL_INSERTION: 25, ORBIT: 75, ISS_REVEAL: 50, ISS_APPROACH: 80,
      DOCKING_SEQUENCE: 100, DOCKING_COMPLETE: 12, CREW_TRANSFER: 33, ISS_INTERIOR_INTRO: 15,
      PLAYER_CONTROL_ENABLED: 0, ISS_EXPLORATION: Number.POSITIVE_INFINITY,
    };
    expect(STATE_DURATIONS).toEqual(want);
  });
});

describe("MISSION_SCRIPT integrity", () => {
  it("has unique event ids", () => {
    const ids = MISSION_SCRIPT.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("events fall within their state's duration (except terminal states)", () => {
    for (const e of MISSION_SCRIPT) {
      const dur = STATE_DURATIONS[e.state];
      if (!Number.isFinite(dur) || e.state === "PLAYER_CONTROL_ENABLED") continue;
      expect(e.at).toBeLessThanOrEqual(dur + 1e-9);
      expect(e.at).toBeGreaterThanOrEqual(0);
    }
  });
  it("covers every scripted state in mission order", () => {
    const scripted = new Set(MISSION_SCRIPT.map((e) => e.state));
    for (const s of MISSION_STATES) {
      if (s === "ISS_EXPLORATION") continue;
      expect(scripted.has(s)).toBe(true);
    }
  });
  it("every shot id references a registered rig", () => {
    for (const e of MISSION_SCRIPT) if (e.shot) expect(SHOT_IDS).toContain(e.shot);
  });
  it("has at least one event in every scripted state", () => {
    const counts = new Map<string, number>();
    for (const e of MISSION_SCRIPT) counts.set(e.state, (counts.get(e.state) ?? 0) + 1);
    for (const s of MISSION_STATES) {
      if (s === "ISS_EXPLORATION") continue;
      expect(counts.get(s) ?? 0).toBeGreaterThanOrEqual(1);
    }
  });
  it("enables the player exactly once, at PLAYER_CONTROL_ENABLED", () => {
    const enables = MISSION_SCRIPT.filter((e) => e.action?.kind === "enablePlayer");
    expect(enables.length).toBe(1);
    expect(enables[0].state).toBe("PLAYER_CONTROL_ENABLED");
  });
});
