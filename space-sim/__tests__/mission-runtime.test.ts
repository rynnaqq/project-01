// space-sim/__tests__/mission-runtime.test.ts
import { describe, expect, it } from "vitest";
import { createMissionRuntime, type RuntimeDeps } from "../mission/runtime";
import type { MissionState } from "../mission/types";

interface Rec {
  ignite: boolean[];
  smokeRamp: number[];
  armK: number[];
  liftoff: number;
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
}

function makeDeps() {
  const rec: Rec = {
    ignite: [], smokeRamp: [], armK: [], liftoff: 0, flightT: [], sepSrb: 0,
    sepCore: 0, orbit: 0, shots: [], cuts: [], fx: [], altitudes: [],
    comms: 0, hud: 0, states: [],
  };
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
      liftoff() { t0 = 0; rec.liftoff++; },
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
    ui: {
      onComms: () => { rec.comms++; },
      onHud: () => { rec.hud++; },
      onState: (s: MissionState) => { rec.states.push(s); },
    },
  };
  return { rec, runtime: createMissionRuntime(deps) };
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
    for (let i = 0; i < 40; i++) runtime.update(0.05);
    expect(rec.flightT.length).toBeGreaterThan(1);
    expect(rec.flightT.every((t) => t >= 0)).toBe(true);
    expect(rec.altitudes[rec.altitudes.length - 1]).toBeGreaterThan(0);
  });

  it("staging commands reach the flight model during ascent", () => {
    const { rec, runtime } = makeDeps();
    runtime.skipTo("ATMOSPHERIC_ASCENT");
    runtime.update(0.05);
    for (let i = 0; i < 1400; i++) runtime.update(0.05); // 70 s: SRB sep @32, core sep @65
    expect(rec.sepSrb).toBe(1);
    expect(rec.sepCore).toBe(1);
  });
});
