// space-sim/__tests__/mission-engine.test.ts
import { describe, expect, it } from "vitest";
import { MISSION_STATES, MissionClock, MissionEngine, type MissionEvent, type MissionState } from "../mission/engine";

function tinyScript(): MissionEvent[] {
  return [
    { id: "e1", state: "MISSION_INIT", at: 0.5, hud: { phase: "INIT" } },
    { id: "e2", state: "MISSION_INIT", at: 1.5, action: { kind: "ignite" } },
    { id: "e3", state: "KSC_ESTABLISHING", at: 0, comms: { speaker: "PAO", text: "Standby.", style: "pa" } },
    { id: "e4", state: "KSC_ESTABLISHING", at: 2, shot: "est_wide" },
  ];
}
const D = { MISSION_INIT: 2, KSC_ESTABLISHING: 5 };

describe("MissionClock", () => {
  it("accumulates time only while unpaused", () => {
    const c = new MissionClock();
    c.tick(1); c.tick(2);
    expect(c.t).toBeCloseTo(3);
    c.paused = true; c.tick(10);
    expect(c.t).toBeCloseTo(3);
  });
  it("reset returns to zero", () => {
    const c = new MissionClock(); c.tick(5); c.reset();
    expect(c.t).toBe(0);
  });
});

describe("MissionEngine", () => {
  it("fires events in order and transitions states", () => {
    const seen: string[] = [];
    const eng = new MissionEngine(tinyScript(), {
      onHud: (h) => seen.push(`hud:${h.phase}`),
      onCommand: (c) => seen.push(`cmd:${c.kind}`),
      onState: (_p, n) => seen.push(`state:${n}`),
    });
    eng.stateDurations = D;
    eng.update(0.6);
    expect(seen).toEqual(["hud:INIT"]);
    eng.update(2.0);
    expect(seen).toEqual(["hud:INIT", "cmd:ignite", "state:KSC_ESTABLISHING"]);
    eng.update(4.0);
    expect(eng.current).toBe("KSC_ESTABLISHING");
  });

  it("is deterministic under different frame splits", () => {
    const run = (splits: number[]): MissionState => {
      const e = new MissionEngine(tinyScript(), {});
      e.stateDurations = D;
      for (const dt of splits) e.update(dt);
      return e.current;
    };
    expect(run([1, 1, 1])).toBe(run([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]));
    expect(run([1, 1, 1])).toBe("KSC_ESTABLISHING");
  });

  it("restart resets clock, state and replays from zero", () => {
    const eng = new MissionEngine(tinyScript(), {});
    eng.stateDurations = D;
    eng.update(6); eng.restart();
    expect(eng.t).toBe(0);
    expect(eng.current).toBe("MISSION_INIT");
    eng.update(0.6);
    expect(eng.current).toBe("MISSION_INIT");
  });

  it("seekToState fires only actions/hud/fx, skips shots/comms", () => {
    const seen: string[] = [];
    const eng = new MissionEngine(tinyScript(), {
      onShot: () => seen.push("shot"),
      onComms: () => seen.push("comms"),
      onHud: () => seen.push("hud"),
      onCommand: () => seen.push("cmd"),
    });
    eng.stateDurations = D;
    eng.seekToState("DOCKING_SEQUENCE");
    expect(eng.current).toBe("DOCKING_SEQUENCE");
    expect(seen).not.toContain("shot");
    expect(seen).not.toContain("comms");
    expect(seen).toContain("hud");
    expect(seen).toContain("cmd");
  });

  it("exposes the 20 ordered mission states", () => {
    expect(MISSION_STATES.length).toBe(20);
    expect(MISSION_STATES[0]).toBe("MISSION_INIT");
    expect(MISSION_STATES[19]).toBe("ISS_EXPLORATION");
  });
});
