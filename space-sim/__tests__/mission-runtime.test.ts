// space-sim/__tests__/mission-runtime.test.ts
import { describe, expect, it } from "vitest";
import { createMissionRuntime, type RuntimeDeps } from "../mission/runtime";
import type { MissionState } from "../mission/types";

interface Rec {
  ignite: boolean[];
  smokeRamp: number[];
  armK: number[];
  liftoff: number;
  liftoffAt: number[];
  flightT: number[];
  sepSrb: number;
  sepCore: number;
  orbit: number;
  shots: string[];
  cuts: string[];
  fx: Array<{ smoke?: number; exposure?: number; shake?: number; glare?: number }>;
  altitudes: number[];
  comms: number;
  hud: number;
  states: MissionState[];
  parentedTo: unknown;
  progress: number[];
  dock: string[];
  telemetry: Array<{ range: number; phase: string }>;
}

function makeDeps() {
  const rec: Rec = {
    ignite: [], smokeRamp: [], armK: [], liftoff: 0, liftoffAt: [], flightT: [], sepSrb: 0,
    sepCore: 0, orbit: 0, shots: [], cuts: [], fx: [], altitudes: [],
    comms: 0, hud: 0, states: [],
    parentedTo: null, progress: [], dock: [], telemetry: [],
  };
  const marks = { liftoffFrame: -1 }; // index into flightT recorded on the liftoff frame
  let t0: number | null = null;
  let altitude = 0;
  const deps: RuntimeDeps = {
    scene: {} as RuntimeDeps["scene"],
    director: {
      playShot: (id: string) => { rec.shots.push(id); },
      cut: (kind: "cut" | "dip" | "crossfade") => { rec.cuts.push(kind); },
      update: () => {},
    } as unknown as RuntimeDeps["director"],
    sky: {
      applyFx: (f: { smoke?: number; exposure?: number; shake?: number; glare?: number }) => {
        rec.fx.push(f);
        if (f.smoke !== undefined) rec.smokeRamp.push(f.smoke);
      },
      setAltitude: (m: number) => { altitude = m; rec.altitudes.push(m); },
    } as unknown as RuntimeDeps["sky"],
    flight: {
      get liftoffTime() { return t0 ?? -1; },
      get currentAltitude() { return altitude; },
      liftoff(at: number) { t0 = at; rec.liftoff++; rec.liftoffAt.push(at); marks.liftoffFrame = rec.flightT.length; },
      update(t: number) { rec.flightT.push(t); altitude = Math.max(0, t) * 10; },
      separateSrb() { rec.sepSrb++; },
      separateCore() { rec.sepCore++; },
      orbitInsertion() { rec.orbit++; },
    } as unknown as RuntimeDeps["flight"],
    exhaust: {
      ignite: (on: boolean) => { rec.ignite.push(on); },
      update: () => {},
    } as unknown as RuntimeDeps["exhaust"],
    smoke: {
      ramp: (v: number) => { rec.smokeRamp.push(v); },
      update: () => {},
    } as unknown as RuntimeDeps["smoke"],
    ml: {
      retractArms: (k: number) => { rec.armK.push(k); },
    } as unknown as RuntimeDeps["ml"],
    issRoot: { name: "issRoot" } as unknown as RuntimeDeps["issRoot"],
    docking: {
      node: {
        setParent(p: unknown) { rec.parentedTo = p; },
      },
      setProgress: (k: number) => { rec.progress.push(k); },
      contact: () => { rec.dock.push("contact"); },
      capture: () => { rec.dock.push("capture"); },
      hardDock: () => { rec.dock.push("hard"); },
      telemetry: () => {
        const t = { range: 42, phase: "approach" };
        rec.telemetry.push(t);
        return t;
      },
    } as unknown as RuntimeDeps["docking"],
    // AudioBus is browser-only (Web Audio); the runtime wiring under test is a no-op here.
    audio: {
      unlock: () => Promise.resolve(),
      engine: () => {}, engineLevel: () => {}, rumble: () => {}, vent: () => {},
      beep: () => {}, clunk: () => {}, speak: () => {}, duck: () => {}, setMuted: () => {},
    } as unknown as RuntimeDeps["audio"],
    ui: {
      onComms: () => { rec.comms++; },
      onHud: () => { rec.hud++; },
      onState: (s: MissionState) => { rec.states.push(s); },
    },
  };
  return { rec, runtime: createMissionRuntime(deps), marks, issRoot: deps.issRoot };
}

describe("mission runtime wiring", () => {
  it("routes comms, hud, shots, cuts and state from the opening script", () => {
    const { rec, runtime } = makeDeps();
    for (let i = 0; i < 300; i++) runtime.update(0.05); // 15 s: through MISSION_INIT into KSC
    expect(rec.comms).toBeGreaterThan(0);
    expect(rec.hud).toBeGreaterThan(0);
    expect(rec.shots).toContain("est_wide");
    expect(rec.cuts.length).toBeGreaterThan(0);
    expect(rec.states).toContain("KSC_ESTABLISHING");
  });

  it("skipTo surfaces engine.seekToState and ignition fires plume/smoke/arms", () => {
    const { rec, runtime } = makeDeps();
    runtime.skipTo("ENGINE_IGNITION");
    expect(runtime.engine.current).toBe("ENGINE_IGNITION");
    runtime.update(0.05);
    expect(rec.ignite).toEqual([true]);
    expect(rec.smokeRamp).toContain(1);
    expect(rec.fx.some((f) => f.exposure !== undefined)).toBe(true);
  });

  it("animates ML arm retraction over ~3 s after ignition", () => {
    const { rec, runtime } = makeDeps();
    runtime.skipTo("ENGINE_IGNITION");
    runtime.update(0.05);
    for (let i = 0; i < 80; i++) runtime.update(0.05); // 4 s of frames
    expect(rec.armK.length).toBeGreaterThan(0);
    expect(rec.armK[0]).toBeLessThan(1);
    expect(rec.armK[rec.armK.length - 1]).toBe(1);
  });

  it("liftoff starts the flight clock; tFlight flows into flight.update", () => {
    const { rec, runtime } = makeDeps();
    runtime.skipTo("LIFTOFF");
    runtime.update(0.05);
    expect(rec.liftoff).toBe(1);
    expect(rec.liftoffAt[0]).toBeLessThan(1); // skip leaves the mission clock near 0
    for (let i = 0; i < 40; i++) runtime.update(0.05);
    expect(rec.flightT.length).toBeGreaterThan(1);
    expect(rec.flightT.every((t) => t >= 0)).toBe(true);
    expect(rec.altitudes[rec.altitudes.length - 1]).toBeGreaterThan(0);
  });

  it("real playthrough: liftoff fires at engine.t ≈ 263 s with tFlight starting at 0", () => {
    const { rec, runtime, marks } = makeDeps();
    for (let i = 0; i < 5400; i++) runtime.update(0.05); // 270 s: full countdown + early ascent
    expect(marks.liftoffFrame).toBeGreaterThanOrEqual(0);
    expect(rec.liftoff).toBe(1);
    // (a) the flight model received the liftoff engine-time, not a hardcoded 0
    expect(rec.liftoffAt[0]).toBeCloseTo(263, 1);
    // (b) on the liftoff frame the seconds-since-liftoff is ≈ 0 (stack must not jump to ~394 km)
    expect(rec.flightT[marks.liftoffFrame]).toBeCloseTo(0, 1);
    // ascent progresses from zero and grows monotonically afterwards
    expect(rec.flightT[marks.liftoffFrame + 10]).toBeGreaterThan(0);
    expect(rec.flightT[marks.liftoffFrame + 100]).toBeGreaterThan(rec.flightT[marks.liftoffFrame + 10]);
    // pre-liftoff frames stayed negative (pad phase)
    expect(rec.flightT[marks.liftoffFrame - 1]).toBe(-1);
  });

  it("staging commands reach the flight model during ascent", () => {
    const { rec, runtime } = makeDeps();
    runtime.skipTo("ATMOSPHERIC_ASCENT");
    runtime.update(0.05);
    for (let i = 0; i < 1400; i++) runtime.update(0.05); // 70 s: SRB sep @32, core sep @65
    expect(rec.sepSrb).toBe(1);
    expect(rec.sepCore).toBe(1);
    // core separation also kills the plume (the detached core must not keep burning)
    expect(rec.ignite).toEqual([true, false]);
  });

  it("pad smoke ramps down exactly once, 30 s after liftoff", () => {
    const { rec, runtime } = makeDeps();
    runtime.skipTo("LIFTOFF");
    runtime.update(0.05); // liftoff fires; smoke-down scheduled at t+30
    for (let i = 0; i < 610; i++) runtime.update(0.05); // +30.5 s of mission time
    expect(rec.smokeRamp[rec.smokeRamp.length - 1]).toBe(0);
    expect(rec.smokeRamp.filter((v) => v === 0).length).toBe(1);
  });

  it("lastTelemetry is null before the ISS approach begins", () => {
    const { runtime } = makeDeps();
    expect(runtime.lastTelemetry).toBeNull();
  });

  it("ISS_REVEAL entry re-parents Orion onto the ISS root and starts the approach", () => {
    const { rec, runtime, issRoot } = makeDeps();
    runtime.skipTo("ORBIT");
    for (let i = 0; i < 1600; i++) runtime.update(0.05); // 80 s: ORBIT (75 s) rolls into ISS_REVEAL
    expect(rec.parentedTo).toBe(issRoot);
    expect(rec.progress[0]).toBe(0); // setProgress(0) places Orion at the corridor start;
    // the effective start pose (0,-2.5,-212.5) is asserted at sequence level in docking-sequence.test.ts
  });

  it("approach progress spans ISS_APPROACH + DOCKING_SEQUENCE from 0 to 1", () => {
    const { rec, runtime } = makeDeps();
    runtime.skipTo("ISS_APPROACH");
    for (let i = 0; i < 3800; i++) runtime.update(0.05); // 190 s: approach window is 180 s
    expect(rec.progress.length).toBeGreaterThan(0);
    expect(rec.progress[0]).toBe(0);
    expect(rec.progress[rec.progress.length - 1]).toBe(1);
    for (let i = 1; i < rec.progress.length; i++) {
      expect(rec.progress[i]).toBeGreaterThanOrEqual(rec.progress[i - 1]);
    }
  });

  it("dock contact/capture/hard commands map to the docking sequence in order", () => {
    const { rec, runtime } = makeDeps();
    runtime.skipTo("DOCKING_SEQUENCE");
    runtime.update(0.05);
    for (let i = 0; i < 1200; i++) runtime.update(0.05); // 60 s: contact @28, capture @42, hard @54
    expect(rec.dock).toEqual(["contact", "capture", "hard"]);
  });

  it("deep skip past the whole approach still attaches Orion and pins the docked pose", () => {
    const { rec, runtime, issRoot } = makeDeps();
    runtime.skipTo("DOCKING_COMPLETE"); // actions fire before the target-state entry
    runtime.update(0.05);
    expect(rec.parentedTo).toBe(issRoot);
    expect(rec.dock).toEqual(["contact", "capture", "hard"]);
    expect(rec.progress[0]).toBe(0);
  });

  it("lastTelemetry exposes fresh docking telemetry for the HUD once docking starts", () => {
    const { rec, runtime } = makeDeps();
    runtime.skipTo("ISS_APPROACH");
    runtime.update(0.05);
    runtime.update(0.05);
    expect(runtime.lastTelemetry).toEqual({ range: 42, phase: "approach" });
    expect(rec.telemetry.length).toBe(2);
  });
});
