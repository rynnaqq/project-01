# Space Simulator: Earth to ISS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, single-player Babylon.js mini-game where the player launches from Earth, reaches orbit, maneuvers in zero-G, and docks with the ISS — served at `/space-sim/`.

**Architecture:** A separate Vite MPA entry (`space-sim/index.html`) in vanilla TypeScript following the existing Rail Rush precedent. One Babylon `Scene` driven by a mission-phase state machine; simulation (physics/docking), presentation (camera/HUD), and content (Earth/ISS) are split into focused modules. All geometry is procedural (no asset downloads). Havok is used minimally for collision, with a kinematic fallback.

**Tech Stack:** TypeScript, Babylon.js (`@babylonjs/core`, `@babylonjs/gui`), Havok (`@babylonjs/havok`), Vite (MPA entry), Vitest (unit tests), standalone CSS (no Tailwind).

**Spec:** `docs/superpowers/specs/2026-08-25-space-simulator-earth-to-iss-design.md`

## Global Constraints

- Babylon.js v9 packages already installed: `@babylonjs/core`, `@babylonjs/gui`, `@babylonjs/havok`, `@babylonjs/loaders` (do not re-add).
- Vanilla TypeScript only inside `space-sim/` — **no React, no Tailwind** (the hub's React/Tailwind stays in `src/`).
- All geometry procedural; **zero external asset/network fetches** for gameplay.
- Every tuning constant lives in `space-sim/config.ts`; no magic numbers in logic.
- 1 gameplay unit = 100 m for orbital/docking ranges; displayed telemetry converts back to m/km.
- Strict TS (`strict`, `noUnusedLocals`, `noUnusedParameters` are on) — code must compile under `npm run build`.
- ESLint must pass with `--max-warnings 0` (`npm run lint`).
- Tests use vitest, colocated as `space-sim/*.test.ts`, importing from `vitest` (`describe/it/expect`).
- Commit messages end with `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Priority (PRD §O): Playability > Clarity > Performance > Visual Fidelity > Simulation Complexity.

## File Structure

| File | Responsibility |
|---|---|
| `space-sim/config.ts` | All tuning constants + unit/altitude conversions + gravity falloff (pure) |
| `space-sim/state.ts` | `MissionPhase`, `MissionState`, state machine, event emitter, analytics `track()` |
| `space-sim/docking.ts` | Pure docking criteria: `canDock`, `approachState`, `alignmentPct`, `dockingAccuracy`, `rating` |
| `space-sim/flight.ts` | Pure flight math: damping, brake, fuel burn, ascent integration |
| `space-sim/input.ts` | `InputState` abstraction + keyboard/touch providers |
| `space-sim/world.ts` | Content: Earth, clouds, atmosphere shell, starfield skybox, launch pad |
| `space-sim/iss.ts` | Content: procedural ISS, docking-port transform, collision shell |
| `space-sim/hud.ts` | Presentation: Babylon GUI telemetry, bars, target marker, approach state |
| `space-sim/main.ts` | Bootstrap: feature detect, engine + Havok init, phase dispatch, render loop, pause, adaptive quality |
| `space-sim/index.html` | Canvas + HTML shell screens (loading/briefing/pause/result/fallback) |
| `space-sim/style.css` | Shell-screen styling |
| `vite.config.ts` | Add `space-sim` MPA input |
| `tsconfig.json` | Add `"space-sim"` to `include` |
| `src/pages/HomePage.tsx` | Add standalone promo card linking to `/space-sim/` |

Pure modules (`config`, `state`, `docking`, `flight`, and the pure parts of `input`) get TDD unit tests. Babylon-visual modules (`world`, `iss`, `hud`, `main`) are verified by typecheck + build + manual smoke, since they need a WebGL context.

---

## Task 1: `config.ts` — tuning constants & conversions

**Files:**
- Create: `space-sim/config.ts`
- Test: `space-sim/config.test.ts`

**Interfaces:**
- Produces: `METERS_PER_UNIT`, `unitsToMeters(u)`, `metersToUnits(m)`, `displayAltitudeKm(sceneY)`, `gravityAt(sceneY)`, and constant objects `ALT`, `THRUST`, `ASCENT`, `GRAVITY`, `DOCK`, `MISSION`.

- [ ] **Step 1: Write the failing test**

```ts
// space-sim/config.test.ts
import { describe, expect, it } from 'vitest';
import {
  ALT, DOCK, METERS_PER_UNIT, displayAltitudeKm, gravityAt,
  metersToUnits, unitsToMeters,
} from './config';

describe('unit conversion', () => {
  it('converts units to meters and back', () => {
    expect(METERS_PER_UNIT).toBe(100);
    expect(unitsToMeters(1)).toBe(100);
    expect(metersToUnits(100)).toBe(1);
    expect(unitsToMeters(metersToUnits(250))).toBeCloseTo(250);
  });
});

describe('displayAltitudeKm', () => {
  it('is 0 at or below the surface', () => {
    expect(displayAltitudeKm(ALT.SURFACE_Y)).toBe(0);
    expect(displayAltitudeKm(ALT.SURFACE_Y - 5)).toBe(0);
  });
  it('reaches orbit display altitude at the orbit threshold', () => {
    expect(displayAltitudeKm(ALT.ORBIT_Y)).toBe(ALT.ORBIT_DISPLAY_KM);
  });
  it('is monotonic and clamped above orbit', () => {
    const mid = displayAltitudeKm((ALT.SURFACE_Y + ALT.ORBIT_Y) / 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(ALT.ORBIT_DISPLAY_KM);
    expect(displayAltitudeKm(ALT.ORBIT_Y + 50)).toBe(ALT.ORBIT_DISPLAY_KM);
  });
  it('crosses the Kármán line partway up', () => {
    // 100 km is a quarter of the 400 km displayed span
    const karmanY = ALT.SURFACE_Y + (ALT.ORBIT_Y - ALT.SURFACE_Y) * (100 / ALT.ORBIT_DISPLAY_KM);
    expect(displayAltitudeKm(karmanY)).toBeCloseTo(100);
  });
});

describe('gravityAt', () => {
  it('is surface gravity at the surface', () => {
    expect(gravityAt(ALT.SURFACE_Y)).toBeCloseTo(9.8);
  });
  it('falls off to near-microgravity by orbit', () => {
    expect(gravityAt(ALT.ORBIT_Y)).toBeLessThan(1);
  });
  it('is monotonic non-increasing with altitude', () => {
    const a = gravityAt(ALT.SURFACE_Y + 5);
    const b = gravityAt(ALT.SURFACE_Y + 15);
    expect(a).toBeGreaterThanOrEqual(b);
  });
});

describe('docking thresholds are sane', () => {
  it('matches PRD §B.10 tuning', () => {
    expect(DOCK.distanceM).toBe(5);
    expect(DOCK.relSpeedMps).toBe(0.5);
    expect(DOCK.alignmentDeg).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run space-sim/config.test.ts`
Expected: FAIL — `Cannot find module './config'`

- [ ] **Step 3: Write minimal implementation**

```ts
// space-sim/config.ts
/**
 * Central tuning for the Space Simulator (PRD §N: tuning via configuration).
 * Scene scale: 1 gameplay unit = 100 m for orbital/docking ranges.
 */

export const METERS_PER_UNIT = 100;
export const unitsToMeters = (u: number): number => u * METERS_PER_UNIT;
export const metersToUnits = (m: number): number => m / METERS_PER_UNIT;

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** World layout + altitude display mapping (compressed so it fits float precision). */
export const ALT = {
  /** Visual Earth radius in scene units. */
  EARTH_RADIUS_UNITS: 30,
  /** Scene Y of the planet surface (== Earth radius, launch pad sits here). */
  SURFACE_Y: 30,
  /** Scene Y where the Orbit phase begins. */
  ORBIT_Y: 60,
  /** Displayed altitude (km) once in orbit. */
  ORBIT_DISPLAY_KM: 400,
  KARMAN_LINE_KM: 100,
} as const;

/** Map a scene Y to a displayed altitude in km (0 at surface, clamped at orbit). */
export function displayAltitudeKm(sceneY: number): number {
  const above = Math.max(0, sceneY - ALT.SURFACE_Y);
  const span = ALT.ORBIT_Y - ALT.SURFACE_Y;
  return clamp01(above / span) * ALT.ORBIT_DISPLAY_KM;
}

/** Simplified gravity (PRD §D.7): linear falloff from surface to orbit. */
export const GRAVITY = { surface: 9.8, orbit: 0.4 } as const;
export function gravityAt(sceneY: number): number {
  const t = clamp01((sceneY - ALT.SURFACE_Y) / (ALT.ORBIT_Y - ALT.SURFACE_Y));
  return GRAVITY.surface * (1 - t) + GRAVITY.orbit * t;
}

/** Thruster model (PRD §B.6 initial tuning). */
export const THRUST = {
  maxForce: 1.0,
  fuelCapacity: 100,
  fuelConsumptionRate: 1.0, // fuel units per second at full thrust
  rotationalForce: 0.4,
  linearDamping: 0.03,
  angularDamping: 0.05,
  assistLinearDamping: 0.6,
  assistAngularDamping: 0.9,
  brakeAccel: 2.0, // units/s² applied per axis while braking
} as const;

/** Ascent-phase feel (scene units/s²). */
export const ASCENT = {
  thrustAccel: 26, // must exceed surface gravity (9.8) to climb
  maxVy: 14, // clamp vertical speed for a readable ascent
} as const;

/** Docking gameplay thresholds (PRD §B.10). */
export const DOCK = {
  distanceM: 5,
  relSpeedMps: 0.5,
  alignmentDeg: 5,
  corridorHalfAngleDeg: 25,
} as const;

/** Mission-level limits. */
export const MISSION = {
  oxygenSeconds: 600,
  boundsRadiusUnits: 220, // out-of-bounds sphere around the ISS (PRD §E.11)
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run space-sim/config.test.ts`
Expected: PASS (all suites green)

- [ ] **Step 5: Commit**

```bash
git add space-sim/config.ts space-sim/config.test.ts
git commit -m "Space Simulator: config constants and unit/altitude conversions

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: `state.ts` — mission state machine + analytics

**Files:**
- Create: `space-sim/state.ts`
- Test: `space-sim/state.test.ts`

**Interfaces:**
- Consumes: `THRUST` from `./config`.
- Produces: `enum MissionPhase`, `interface MissionState`, `class Mission` (`setPhase`, `setPaused`, `update`, `on`, `reset`), `track(event, props)`, `phaseEventName(phase)`.

- [ ] **Step 1: Write the failing test**

```ts
// space-sim/state.test.ts
import { describe, expect, it, vi } from 'vitest';
import { Mission, MissionPhase, phaseEventName } from './state';

describe('phaseEventName', () => {
  it('maps phases to PRD §I analytics names', () => {
    expect(phaseEventName(MissionPhase.Ascent)).toBe('phase_ascent_start');
    expect(phaseEventName(MissionPhase.Orbit)).toBe('phase_orbit_start');
    expect(phaseEventName(MissionPhase.Approach)).toBe('phase_approach_start');
    expect(phaseEventName(MissionPhase.Docking)).toBe('phase_docking_start');
    expect(phaseEventName(MissionPhase.Complete)).toBe('mission_completed');
    expect(phaseEventName(MissionPhase.Failed)).toBe('mission_failed');
  });
});

describe('Mission state machine', () => {
  it('starts in Loading with full fuel and oxygen', () => {
    const m = new Mission();
    expect(m.state.phase).toBe(MissionPhase.Loading);
    expect(m.state.fuel).toBe(100);
    expect(m.state.oxygen).toBe(100);
    expect(m.state.paused).toBe(false);
  });

  it('emits and tracks a phase change exactly once', () => {
    const m = new Mission();
    const onPhase = vi.fn();
    m.on('phase', onPhase);
    m.setPhase(MissionPhase.Ascent);
    expect(m.state.phase).toBe(MissionPhase.Ascent);
    expect(onPhase).toHaveBeenCalledTimes(1);
    expect(onPhase).toHaveBeenCalledWith(MissionPhase.Ascent);
    // no-op when unchanged
    m.setPhase(MissionPhase.Ascent);
    expect(onPhase).toHaveBeenCalledTimes(1);
  });

  it('toggles pause without changing phase', () => {
    const m = new Mission();
    m.setPhase(MissionPhase.Orbit);
    m.setPaused(true);
    expect(m.state.paused).toBe(true);
    expect(m.state.phase).toBe(MissionPhase.Orbit);
    m.setPaused(false);
    expect(m.state.paused).toBe(false);
  });

  it('update() merges telemetry fields', () => {
    const m = new Mission();
    m.update({ altitudeKm: 123.4, fuel: 42 });
    expect(m.state.altitudeKm).toBe(123.4);
    expect(m.state.fuel).toBe(42);
  });

  it('reset() returns to a fresh state', () => {
    const m = new Mission();
    m.setPhase(MissionPhase.Failed);
    m.update({ fuel: 3 });
    m.reset();
    expect(m.state.phase).toBe(MissionPhase.Loading);
    expect(m.state.fuel).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run space-sim/state.test.ts`
Expected: FAIL — `Cannot find module './state'`

- [ ] **Step 3: Write minimal implementation**

```ts
// space-sim/state.ts
/**
 * Mission state machine + telemetry store + analytics stub.
 * The HUD reads `state`; it never computes physics itself (PRD §D.16).
 */
import { THRUST } from './config';

export enum MissionPhase {
  Loading, Briefing, Ascent, Orbit, Approach, Docking, Complete, Failed,
}

export interface MissionState {
  phase: MissionPhase;
  paused: boolean;
  altitudeKm: number;
  speedMps: number;
  relativeVelocityMps: number;
  fuel: number;
  oxygen: number; // 0..100
  distanceToISSm: number;
  alignmentDeg: number;
  missionTimeS: number;
}

/** PRD §I analytics event names for phase transitions. */
export function phaseEventName(p: MissionPhase): string | null {
  switch (p) {
    case MissionPhase.Ascent: return 'phase_ascent_start';
    case MissionPhase.Orbit: return 'phase_orbit_start';
    case MissionPhase.Approach: return 'phase_approach_start';
    case MissionPhase.Docking: return 'phase_docking_start';
    case MissionPhase.Complete: return 'mission_completed';
    case MissionPhase.Failed: return 'mission_failed';
    default: return null;
  }
}

/** Console analytics stub (PRD §I); swap for a real backend later. */
export function track(event: string, props: Record<string, unknown> = {}): void {
  // eslint-disable-next-line no-console
  console.info(`[analytics] ${event}`, props);
}

type Listener<T> = (payload: T) => void;

const freshState = (): MissionState => ({
  phase: MissionPhase.Loading,
  paused: false,
  altitudeKm: 0,
  speedMps: 0,
  relativeVelocityMps: 0,
  fuel: THRUST.fuelCapacity,
  oxygen: 100,
  distanceToISSm: 0,
  alignmentDeg: 0,
  missionTimeS: 0,
});

export class Mission {
  state: MissionState = freshState();
  private listeners = new Map<string, Set<Listener<never>>>();

  on<T>(event: string, fn: Listener<T>): () => void {
    let set = this.listeners.get(event);
    if (!set) { set = new Set(); this.listeners.set(event, set); }
    set.add(fn as Listener<never>);
    return () => { set!.delete(fn as Listener<never>); };
  }

  private emit<T>(event: string, payload: T): void {
    this.listeners.get(event)?.forEach((fn) => (fn as Listener<T>)(payload));
  }

  setPhase(p: MissionPhase): void {
    if (p === this.state.phase) return;
    this.state.phase = p;
    this.emit('phase', p);
    const name = phaseEventName(p);
    if (name) track(name, { missionTime: Math.round(this.state.missionTimeS) });
  }

  setPaused(paused: boolean): void {
    if (paused === this.state.paused) return;
    this.state.paused = paused;
    this.emit(paused ? 'pause' : 'resume', undefined);
    track(paused ? 'mission_paused' : 'mission_resumed');
  }

  update(partial: Partial<MissionState>): void {
    Object.assign(this.state, partial);
  }

  reset(): void {
    this.state = freshState();
    this.emit('reset', undefined);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run space-sim/state.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add space-sim/state.ts space-sim/state.test.ts
git commit -m "Space Simulator: mission state machine and analytics stub

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: `docking.ts` — pure docking criteria

**Files:**
- Create: `space-sim/docking.ts`
- Test: `space-sim/docking.test.ts`

**Interfaces:**
- Consumes: `DOCK` from `./config`.
- Produces: `interface DockInput`, `type ApproachState`, `canDock(i)`, `approachState(i)`, `alignmentPct(deg)`, `dockingAccuracy(i)`, `rating(accuracy, fuelPct)`.

- [ ] **Step 1: Write the failing test**

```ts
// space-sim/docking.test.ts
import { describe, expect, it } from 'vitest';
import {
  alignmentPct, approachState, canDock, dockingAccuracy, rating, type DockInput,
} from './docking';

const perfect: DockInput = { distanceM: 1, relSpeedMps: 0.1, alignmentDeg: 1, inCorridor: true };

describe('canDock', () => {
  it('passes when all criteria are inside thresholds', () => {
    expect(canDock(perfect)).toBe(true);
  });
  it('fails when any single criterion is out of bounds', () => {
    expect(canDock({ ...perfect, distanceM: 6 })).toBe(false);
    expect(canDock({ ...perfect, relSpeedMps: 0.6 })).toBe(false);
    expect(canDock({ ...perfect, alignmentDeg: 6 })).toBe(false);
    expect(canDock({ ...perfect, inCorridor: false })).toBe(false);
  });
  it('treats the threshold values themselves as failing (strict <)', () => {
    expect(canDock({ ...perfect, distanceM: 5 })).toBe(false);
    expect(canDock({ ...perfect, relSpeedMps: 0.5 })).toBe(false);
    expect(canDock({ ...perfect, alignmentDeg: 5 })).toBe(false);
  });
});

describe('approachState', () => {
  it('is DOCKING_READY when canDock', () => {
    expect(approachState(perfect)).toBe('DOCKING_READY');
  });
  it('is CRITICAL when approaching far too fast', () => {
    expect(approachState({ ...perfect, distanceM: 4, relSpeedMps: 3 })).toBe('CRITICAL');
  });
  it('is CAUTION when mildly too fast or misaligned', () => {
    expect(approachState({ ...perfect, relSpeedMps: 0.8, distanceM: 20 })).toBe('CAUTION');
  });
  it('is SAFE when far and slow', () => {
    expect(approachState({ distanceM: 200, relSpeedMps: 0.2, alignmentDeg: 40, inCorridor: false }))
      .toBe('SAFE');
  });
});

describe('alignmentPct', () => {
  it('is 100 when perfectly aligned and 0 at 90°', () => {
    expect(alignmentPct(0)).toBe(100);
    expect(alignmentPct(90)).toBe(0);
    expect(alignmentPct(45)).toBe(50);
  });
});

describe('dockingAccuracy + rating', () => {
  it('scores a perfect dock at 100', () => {
    expect(dockingAccuracy({ distanceM: 0, relSpeedMps: 0, alignmentDeg: 0, inCorridor: true }))
      .toBe(100);
  });
  it('assigns higher ratings to better accuracy/fuel', () => {
    expect(rating(95, 80)).toBe('A');
    expect(rating(60, 40)).toBe('B');
    expect(rating(35, 20)).toBe('C');
    expect(rating(10, 5)).toBe('D');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run space-sim/docking.test.ts`
Expected: FAIL — `Cannot find module './docking'`

- [ ] **Step 3: Write minimal implementation**

```ts
// space-sim/docking.ts
/**
 * Pure docking-criteria logic (PRD §B.10). No Babylon imports — fully testable.
 */
import { DOCK } from './config';

export interface DockInput {
  distanceM: number;
  relSpeedMps: number;
  alignmentDeg: number;
  inCorridor: boolean;
}

export type ApproachState = 'SAFE' | 'CAUTION' | 'CRITICAL' | 'DOCKING_READY';

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** All criteria strictly inside thresholds (PRD §B.10). */
export function canDock(i: DockInput): boolean {
  return (
    i.inCorridor &&
    i.distanceM < DOCK.distanceM &&
    i.relSpeedMps < DOCK.relSpeedMps &&
    i.alignmentDeg < DOCK.alignmentDeg
  );
}

/** Coarse HUD state: Safe → Caution → Critical → Docking Ready (PRD §B.11). */
export function approachState(i: DockInput): ApproachState {
  if (canDock(i)) return 'DOCKING_READY';
  const tooFast = i.relSpeedMps > DOCK.relSpeedMps;
  const nearAndFast = i.distanceM < DOCK.distanceM * 3 && i.relSpeedMps > DOCK.relSpeedMps * 2;
  if (nearAndFast) return 'CRITICAL';
  if (tooFast || i.alignmentDeg > DOCK.alignmentDeg * 3) return 'CAUTION';
  return 'SAFE';
}

/** 0°→100%, 90°→0%. */
export function alignmentPct(alignmentDeg: number): number {
  return Math.round(100 * clamp01(1 - alignmentDeg / 90));
}

/** 0–100 composite score from distance, speed and alignment at dock time. */
export function dockingAccuracy(i: DockInput): number {
  const d = clamp01(1 - i.distanceM / DOCK.distanceM);
  const s = clamp01(1 - i.relSpeedMps / DOCK.relSpeedMps);
  const a = clamp01(1 - i.alignmentDeg / DOCK.alignmentDeg);
  return Math.round(((d + s + a) / 3) * 100);
}

export type Grade = 'A' | 'B' | 'C' | 'D';
export function rating(accuracy: number, fuelPct: number): Grade {
  const score = accuracy * 0.7 + fuelPct * 0.3;
  if (score >= 85) return 'A';
  if (score >= 60) return 'B';
  if (score >= 35) return 'C';
  return 'D';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run space-sim/docking.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add space-sim/docking.ts space-sim/docking.test.ts
git commit -m "Space Simulator: pure docking criteria and scoring

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: `flight.ts` — pure flight math

**Files:**
- Create: `space-sim/flight.ts`
- Test: `space-sim/flight.test.ts`

**Interfaces:**
- Consumes: nothing (callers pass constants from `config.ts`).
- Produces: `interface Vec3Like`, `applyDamping(v, damping, dt)`, `brakeVelocity(v, brakeAccel, dt)`, `burnFuel(fuel, thrust01, rate, dt)`, `ascentStep(y, vy, thrust01, gravity, thrustAccel, maxVy, dt)`.

- [ ] **Step 1: Write the failing test**

```ts
// space-sim/flight.test.ts
import { describe, expect, it } from 'vitest';
import { applyDamping, ascentStep, brakeVelocity, burnFuel } from './flight';

describe('applyDamping', () => {
  it('scales velocity toward zero', () => {
    const v = applyDamping({ x: 10, y: 0, z: -4 }, 0.5, 1);
    expect(v.x).toBeCloseTo(5);
    expect(v.z).toBeCloseTo(-2);
  });
  it('never flips sign on huge dt', () => {
    const v = applyDamping({ x: 1, y: 2, z: 3 }, 10, 5);
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
    expect(v.z).toBe(0);
  });
});

describe('brakeVelocity', () => {
  it('reduces each axis by brakeAccel*dt toward zero', () => {
    const v = brakeVelocity({ x: 3, y: -1, z: 0 }, 2, 1);
    expect(v.x).toBeCloseTo(1);
    expect(v.y).toBe(0); // |-1| <= 2*1, so the axis clamps to zero
    expect(v.z).toBe(0);
  });
  it('clamps at zero instead of overshooting', () => {
    const v = brakeVelocity({ x: 1, y: -0.5, z: 0.2 }, 2, 1);
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
    expect(v.z).toBe(0);
  });
});

describe('burnFuel', () => {
  it('consumes proportionally to thrust magnitude', () => {
    expect(burnFuel(100, 1, 1, 1)).toBeCloseTo(99);
    expect(burnFuel(100, 0.5, 2, 1)).toBeCloseTo(99);
  });
  it('does not consume at zero thrust and never goes negative', () => {
    expect(burnFuel(100, 0, 1, 10)).toBe(100);
    expect(burnFuel(0.4, 1, 1, 1)).toBe(0);
  });
});

describe('ascentStep', () => {
  it('climbs when thrust exceeds gravity', () => {
    const s = ascentStep(30, 0, 1, 9.8, 26, 14, 1);
    expect(s.vy).toBeCloseTo(16.2);
    expect(s.y).toBeCloseTo(46.2);
  });
  it('falls back with no thrust', () => {
    const s = ascentStep(40, 5, 0, 9.8, 26, 14, 1);
    expect(s.vy).toBeCloseTo(-4.8);
  });
  it('clamps vertical speed at maxVy', () => {
    const s = ascentStep(30, 13.9, 1, 9.8, 26, 14, 1);
    expect(s.vy).toBe(14);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run space-sim/flight.test.ts`
Expected: FAIL — `Cannot find module './flight'`

- [ ] **Step 3: Write minimal implementation**

```ts
// space-sim/flight.ts
/**
 * Pure flight math shared by the ascent and orbit controllers.
 * No Babylon imports — the controllers in player.ts apply these to the rig.
 */

export interface Vec3Like { x: number; y: number; z: number }

/** Linear damping, clamped so a large dt zeroes the vector instead of flipping it. */
export function applyDamping<T extends Vec3Like>(v: T, damping: number, dt: number): T {
  const f = Math.max(0, 1 - damping * dt);
  return { ...v, x: v.x * f, y: v.y * f, z: v.z * f };
}

/** Bleed velocity toward zero at `brakeAccel` per axis (counter-thrust, PRD §C.5 R). */
export function brakeVelocity<T extends Vec3Like>(v: T, brakeAccel: number, dt: number): T {
  const step = brakeAccel * dt;
  const brake = (c: number): number => (Math.abs(c) <= step ? 0 : c - Math.sign(c) * step);
  return { ...v, x: brake(v.x), y: brake(v.y), z: brake(v.z) };
}

/** Fuel burn proportional to thrust magnitude (0..1); floors at 0. */
export function burnFuel(fuel: number, thrust01: number, rate: number, dt: number): number {
  return Math.max(0, fuel - rate * Math.abs(thrust01) * dt);
}

export interface AscentStep { y: number; vy: number }

/** One ascent integration step: thrust up vs. gravity down, clamped at maxVy. */
export function ascentStep(
  y: number, vy: number, thrust01: number,
  gravity: number, thrustAccel: number, maxVy: number, dt: number,
): AscentStep {
  const nextVy = Math.min(maxVy, vy + (thrust01 * thrustAccel - gravity) * dt);
  return { y: y + nextVy * dt, vy: nextVy };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run space-sim/flight.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add space-sim/flight.ts space-sim/flight.test.ts
git commit -m "Space Simulator: pure flight math (damping, brake, fuel, ascent)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: `input.ts` — input abstraction (keyboard + touch)

**Files:**
- Create: `space-sim/input.ts`
- Test: `space-sim/input.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `interface InputState`, `emptyInput()`, `type InputAction`, `keyAction(code)`, `applyKey(code, down, state)`, `createKeyboardInput(state, onAction, onLook)`, `createTouchInput(container, state, onAction, onLook)`. Both `create*` return a `dispose()` function.

- [ ] **Step 1: Write the failing test**

```ts
// space-sim/input.test.ts
import { describe, expect, it } from 'vitest';
import { applyKey, emptyInput, keyAction } from './input';

describe('keyAction', () => {
  it('maps discrete keys to actions', () => {
    expect(keyAction('Escape')).toBe('pause');
    expect(keyAction('KeyF')).toBe('assist');
    expect(keyAction('KeyC')).toBe('recenter');
    expect(keyAction('Enter')).toBe('dock');
    expect(keyAction('KeyW')).toBeNull();
  });
});

describe('applyKey', () => {
  it('sets and clears continuous axes (PRD §C.5)', () => {
    const s = emptyInput();
    expect(applyKey('KeyW', true, s)).toBe(true);
    expect(s.forward).toBe(1);
    applyKey('KeyW', false, s);
    expect(s.forward).toBe(0);

    applyKey('Space', true, s); expect(s.up).toBe(1);
    applyKey('ShiftLeft', true, s); expect(s.down).toBe(1);
    applyKey('KeyA', true, s); expect(s.left).toBe(1);
    applyKey('KeyD', true, s); expect(s.right).toBe(1);
    applyKey('KeyS', true, s); expect(s.backward).toBe(1);
    applyKey('KeyQ', true, s); expect(s.roll).toBe(-1);
    applyKey('KeyE', true, s); expect(s.roll).toBe(1);
    applyKey('KeyR', true, s); expect(s.brake).toBe(true);
    applyKey('KeyR', false, s); expect(s.brake).toBe(false);
  });
  it('accepts arrow keys as movement aliases', () => {
    const s = emptyInput();
    applyKey('ArrowUp', true, s); expect(s.forward).toBe(1);
    applyKey('ArrowLeft', true, s); expect(s.left).toBe(1);
  });
  it('returns false for unhandled keys', () => {
    const s = emptyInput();
    expect(applyKey('KeyZ', true, s)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run space-sim/input.test.ts`
Expected: FAIL — `Cannot find module './input'`

- [ ] **Step 3: Write minimal implementation**

```ts
// space-sim/input.ts
/**
 * Input abstraction (PRD §D.15): gameplay reads InputState, never the DOM.
 * Keyboard and touch providers both write into the same state object.
 */

export interface InputState {
  forward: number; backward: number; left: number; right: number;
  up: number; down: number;
  pitch: number; yaw: number; roll: number;
  brake: boolean;
}

export const emptyInput = (): InputState => ({
  forward: 0, backward: 0, left: 0, right: 0, up: 0, down: 0,
  pitch: 0, yaw: 0, roll: 0, brake: false,
});

export type InputAction = 'pause' | 'assist' | 'recenter' | 'dock';

/** Discrete (keydown-once) actions. */
export function keyAction(code: string): InputAction | null {
  switch (code) {
    case 'Escape': return 'pause';
    case 'KeyF': return 'assist';
    case 'KeyC': return 'recenter';
    case 'Enter': return 'dock';
    default: return null;
  }
}

/** Continuous axes. Returns false for keys this layer doesn't own. */
export function applyKey(code: string, down: boolean, s: InputState): boolean {
  switch (code) {
    case 'KeyW': case 'ArrowUp': s.forward = down ? 1 : 0; return true;
    case 'KeyS': case 'ArrowDown': s.backward = down ? 1 : 0; return true;
    case 'KeyA': case 'ArrowLeft': s.left = down ? 1 : 0; return true;
    case 'KeyD': case 'ArrowRight': s.right = down ? 1 : 0; return true;
    case 'Space': s.up = down ? 1 : 0; return true;
    case 'ShiftLeft': case 'ShiftRight': s.down = down ? 1 : 0; return true;
    case 'KeyQ': s.roll = down ? -1 : 0; return true;
    case 'KeyE': s.roll = down ? 1 : 0; return true;
    case 'KeyR': s.brake = down; return true;
    default: return false;
  }
}

export type LookHandler = (dx: number, dy: number) => void;

const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** Keyboard + mouse-drag look on the canvas. Returns dispose(). */
export function createKeyboardInput(
  canvas: HTMLCanvasElement, state: InputState,
  onAction: (a: InputAction) => void, onLook: LookHandler,
): () => void {
  const down = (e: KeyboardEvent): void => {
    const action = keyAction(e.code);
    if (action) { if (!e.repeat) onAction(action); e.preventDefault(); return; }
    if (applyKey(e.code, true, state) && PREVENT.has(e.code)) e.preventDefault();
  };
  const up = (e: KeyboardEvent): void => { applyKey(e.code, false, state); };

  let dragging = false;
  let lastX = 0; let lastY = 0;
  const pdown = (e: PointerEvent): void => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };
  const pmove = (e: PointerEvent): void => {
    if (!dragging) return;
    onLook(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX; lastY = e.clientY;
  };
  const pup = (): void => { dragging = false; };

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  canvas.addEventListener('pointerdown', pdown);
  canvas.addEventListener('pointermove', pmove);
  canvas.addEventListener('pointerup', pup);
  canvas.addEventListener('pointercancel', pup);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    canvas.removeEventListener('pointerdown', pdown);
    canvas.removeEventListener('pointermove', pmove);
    canvas.removeEventListener('pointerup', pup);
    canvas.removeEventListener('pointercancel', pup);
  };
}

/**
 * Touch controls (PRD §C.6): left half = translation joystick,
 * right half = look drag; buttons wired by element id from index.html.
 * Returns dispose().
 */
export function createTouchInput(
  canvas: HTMLCanvasElement, state: InputState,
  onAction: (a: InputAction) => void, onLook: LookHandler,
): () => void {
  const cleanups: Array<() => void> = [];
  const joy = { id: -1, ox: 0, oy: 0 };
  const look = { id: -1, lx: 0, ly: 0 };
  const RANGE = 60; // px for full joystick deflection

  const down = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') return;
    if (e.clientX < window.innerWidth / 2 && joy.id < 0) {
      joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY;
    } else if (look.id < 0) {
      look.id = e.pointerId; look.lx = e.clientX; look.ly = e.clientY;
    }
  };
  const move = (e: PointerEvent): void => {
    if (e.pointerId === joy.id) {
      const clamp = (v: number): number => Math.max(-1, Math.min(1, v));
      state.right = clamp((e.clientX - joy.ox) / RANGE);
      state.forward = clamp((joy.oy - e.clientY) / RANGE);
    } else if (e.pointerId === look.id) {
      onLook(e.clientX - look.lx, e.clientY - look.ly);
      look.lx = e.clientX; look.ly = e.clientY;
    }
  };
  const up = (e: PointerEvent): void => {
    if (e.pointerId === joy.id) {
      joy.id = -1; state.right = 0; state.forward = 0;
    } else if (e.pointerId === look.id) {
      look.id = -1;
    }
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  cleanups.push(() => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
  });

  // Buttons: id → action / axis. Missing elements are skipped silently.
  const bindBtn = (id: string, fn: () => void): void => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', fn);
    cleanups.push(() => el.removeEventListener('click', fn));
  };
  bindBtn('btn-pause', () => onAction('pause'));
  bindBtn('btn-assist', () => onAction('assist'));
  bindBtn('btn-recenter', () => onAction('recenter'));
  bindBtn('btn-dock', () => onAction('dock'));
  const hold = (id: string, set: (v: boolean) => void): void => {
    const el = document.getElementById(id);
    if (!el) return;
    const on = (): void => set(true);
    const off = (): void => set(false);
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointerleave', off);
    cleanups.push(() => {
      el.removeEventListener('pointerdown', on);
      el.removeEventListener('pointerup', off);
      el.removeEventListener('pointerleave', off);
    });
  };
  hold('btn-up', (v) => { state.up = v ? 1 : 0; });
  hold('btn-down', (v) => { state.down = v ? 1 : 0; });
  hold('btn-brake', (v) => { state.brake = v; });

  return () => { cleanups.forEach((fn) => fn()); };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run space-sim/input.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add space-sim/input.ts space-sim/input.test.ts
git commit -m "Space Simulator: input abstraction with keyboard and touch providers

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Build wiring + `world.ts` — Earth, atmosphere, starfield, pad

**Files:**
- Modify: `vite.config.ts` (add MPA input)
- Modify: `tsconfig.json` (add `"space-sim"` to `include`)
- Create: `space-sim/world.ts`

**Interfaces:**
- Consumes: `ALT` from `./config`.
- Produces: `interface World { setAscentProgress(t: number): void; rotate(dt: number): void; dispose(): void }`, `createWorld(scene: Scene): World`.

No unit tests (needs WebGL); verified by `tsc` typecheck and later smoke test.

- [ ] **Step 1: Wire the build**

`vite.config.ts` — add the second entry inside `build.rollupOptions.input`:

```ts
      input: {
        main: 'index.html',
        // key keeps the nested path so output lands at dist/rail-rush/index.html
        'rail-rush/index': 'rail-rush/index.html',
        'space-sim/index': 'space-sim/index.html',
      },
```

`tsconfig.json` — extend `include`:

```json
  "include": ["src", "rail-rush", "space-sim"],
```

- [ ] **Step 2: Write `world.ts`**

```ts
// space-sim/world.ts
/**
 * CONTENT layer: procedural Earth, clouds, atmosphere shell, starfield, pad.
 * No external assets (spec §3.3). setAscentProgress drives the atmospheric
 * transition (PRD §B.2): sky darkens, stars fade in, clouds/atmosphere fade.
 */
import {
  Color3, DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial,
  TransformNode, Vector3,
} from '@babylonjs/core';
import { ALT } from './config';

export interface World {
  /** t: 0 at surface → 1 in orbit. */
  setAscentProgress(t: number): void;
  /** Slow cloud rotation. */
  rotate(dt: number): void;
  dispose(): void;
}

const SKY_BLUE = new Color3(0.45, 0.7, 1.0);
const SPACE_BLACK = new Color3(0.01, 0.01, 0.03);

/** Draw a starfield onto a DynamicTexture (deterministic LCG, no Math.random drift concerns). */
function starTexture(scene: Scene): DynamicTexture {
  const size = 1024;
  const tex = new DynamicTexture('stars', size, scene, false);
  const ctx = tex.getContext();
  ctx.fillStyle = '#010108';
  ctx.fillRect(0, 0, size, size);
  let s = 1234567;
  const rand = (): number => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  for (let i = 0; i < 900; i += 1) {
    const r = rand() < 0.92 ? 1 : 2;
    const b = 0.4 + rand() * 0.6;
    ctx.fillStyle = `rgba(255,255,255,${b.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  tex.update();
  return tex;
}

export function createWorld(scene: Scene): World {
  const nodes: TransformNode[] = [];

  // Starfield: giant inverted sphere. Starts invisible (we're in atmosphere).
  const stars = MeshBuilder.CreateSphere('stars', { diameter: 900, sideOrientation: Mesh.BACKSIDE }, scene);
  const starMat = new StandardMaterial('starMat', scene);
  starMat.emissiveTexture = starTexture(scene);
  starMat.disableLighting = true;
  starMat.alpha = 0;
  stars.material = starMat;
  stars.isPickable = false;
  nodes.push(stars);

  // Earth surface.
  const earth = MeshBuilder.CreateSphere('earth', {
    diameter: ALT.EARTH_RADIUS_UNITS * 2, segments: 24,
  }, scene);
  const earthMat = new StandardMaterial('earthMat', scene);
  earthMat.diffuseColor = new Color3(0.15, 0.4, 0.25);
  earthMat.specularColor = Color3.Black();
  earth.material = earthMat;
  earth.isPickable = false;
  nodes.push(earth);

  // Cloud layer.
  const clouds = MeshBuilder.CreateSphere('clouds', {
    diameter: ALT.EARTH_RADIUS_UNITS * 2.03, segments: 20,
  }, scene);
  const cloudMat = new StandardMaterial('cloudMat', scene);
  cloudMat.diffuseColor = Color3.White();
  cloudMat.emissiveColor = new Color3(0.35, 0.35, 0.38);
  cloudMat.alpha = 0.3;
  clouds.material = cloudMat;
  clouds.isPickable = false;
  nodes.push(clouds);

  // Atmosphere shell (cheap rim: backside emissive blue).
  const atmo = MeshBuilder.CreateSphere('atmo', {
    diameter: ALT.EARTH_RADIUS_UNITS * 2.16, segments: 20, sideOrientation: Mesh.BACKSIDE,
  }, scene);
  const atmoMat = new StandardMaterial('atmoMat', scene);
  atmoMat.emissiveColor = new Color3(0.3, 0.55, 1.0);
  atmoMat.disableLighting = true;
  atmoMat.alpha = 0.35;
  atmo.material = atmoMat;
  atmo.isPickable = false;
  nodes.push(atmo);

  // Launch pad at the surface "north pole" (0, SURFACE_Y, 0).
  const pad = MeshBuilder.CreateCylinder('pad', { diameter: 3, height: 0.6, tessellation: 12 }, scene);
  pad.position = new Vector3(0, ALT.SURFACE_Y + 0.3, 0);
  const padMat = new StandardMaterial('padMat', scene);
  padMat.diffuseColor = new Color3(0.35, 0.35, 0.4);
  pad.material = padMat;
  pad.isPickable = false;
  nodes.push(pad);

  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

  return {
    setAscentProgress(t: number): void {
      const k = Math.min(1, Math.max(0, t));
      scene.clearColor = new Color3(
        lerp(SKY_BLUE.r, SPACE_BLACK.r, k),
        lerp(SKY_BLUE.g, SPACE_BLACK.g, k),
        lerp(SKY_BLUE.b, SPACE_BLACK.b, k),
      );
      starMat.alpha = k;
      cloudMat.alpha = 0.3 * (1 - k);
      atmoMat.alpha = 0.35 * (1 - 0.5 * k);
    },
    rotate(dt: number): void {
      clouds.rotation.y += dt * 0.01;
    },
    dispose(): void {
      nodes.forEach((n) => n.dispose());
    },
  };
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: no errors in `space-sim/world.ts` (ignore unrelated pre-existing output if any; there should be none).

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts tsconfig.json space-sim/world.ts
git commit -m "Space Simulator: Vite/tsconfig wiring and procedural world content

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: `iss.ts` — procedural ISS + docking port

**Files:**
- Create: `space-sim/iss.ts`

**Interfaces:**
- Consumes: nothing from other space-sim modules.
- Produces: `interface IssRig { root: TransformNode; port: TransformNode; portAxisWorld(): Vector3; dispose(): void }`, `createIss(scene: Scene, position: Vector3): IssRig`.

No unit tests (needs WebGL); verified by typecheck + smoke.

- [ ] **Step 1: Write `iss.ts`**

```ts
// space-sim/iss.ts
/**
 * CONTENT layer: procedural low-poly ISS (PRD §B.9) with a docking port
 * transform. The port's local +Z is the approach axis; portAxisWorld()
 * returns it in world space for alignment checks.
 */
import {
  Color3, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3,
} from '@babylonjs/core';

export interface IssRig {
  root: TransformNode;
  /** Docking port transform; local +Z points along the approach corridor. */
  port: TransformNode;
  portAxisWorld(): Vector3;
  dispose(): void;
}

export function createIss(scene: Scene, position: Vector3): IssRig {
  const root = new TransformNode('iss', scene);
  root.position = position;

  const hullMat = new StandardMaterial('issHull', scene);
  hullMat.diffuseColor = new Color3(0.75, 0.75, 0.78);
  hullMat.specularColor = new Color3(0.2, 0.2, 0.2);

  const panelMat = new StandardMaterial('issPanel', scene);
  panelMat.diffuseColor = new Color3(0.1, 0.15, 0.45);
  panelMat.specularColor = new Color3(0.5, 0.5, 0.6);

  const goldMat = new StandardMaterial('issGold', scene);
  goldMat.diffuseColor = new Color3(0.8, 0.6, 0.2);

  // Main truss along X.
  const truss = MeshBuilder.CreateBox('issTruss', { width: 22, height: 0.8, depth: 0.8 }, scene);
  truss.material = hullMat;
  truss.parent = root;

  // Habitat modules along the truss center.
  const hab = MeshBuilder.CreateCylinder('issHab', { diameter: 2.4, height: 8, tessellation: 12 }, scene);
  hab.rotation.z = Math.PI / 2;
  hab.material = hullMat;
  hab.parent = root;

  const node = MeshBuilder.CreateSphere('issNode', { diameter: 3, segments: 10 }, scene);
  node.material = goldMat;
  node.parent = root;

  // Solar array pairs at both truss ends.
  for (const side of [-1, 1]) {
    for (const wing of [-1, 1]) {
      const panel = MeshBuilder.CreateBox('issPanel', { width: 5, height: 0.1, depth: 9 }, scene);
      panel.position = new Vector3(side * 8.5, 0, wing * 5.5);
      panel.material = panelMat;
      panel.parent = root;
    }
  }

  // Docking port on the +Z face of the node module.
  const port = new TransformNode('issPort', scene);
  port.parent = root;
  port.position = new Vector3(0, 0, 2.2);
  const ring = MeshBuilder.CreateTorus('issPortRing', { diameter: 1.6, thickness: 0.25, tessellation: 20 }, scene);
  ring.rotation.x = Math.PI / 2;
  ring.material = goldMat;
  ring.parent = port;

  return {
    root,
    port,
    portAxisWorld(): Vector3 {
      return Vector3.TransformNormal(new Vector3(0, 0, 1), port.getWorldMatrix()).normalize();
    },
    dispose(): void {
      root.dispose();
    },
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add space-sim/iss.ts
git commit -m "Space Simulator: procedural ISS with docking port transform

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: `player.ts` — ascent + 6-DOF controllers

**Files:**
- Create: `space-sim/player.ts`

**Interfaces:**
- Consumes: `ALT`, `ASCENT`, `THRUST`, `gravityAt` from `./config`; `applyDamping`, `brakeVelocity`, `burnFuel`, `ascentStep` from `./flight`; `InputState` from `./input`.
- Produces: `interface PlayerRig { root: TransformNode; velocity: Vector3; fuel: number; assist: boolean; updateAscent(input, dt): void; updateOrbit(input, look, dt): void; recenterTo(target): void; dispose(): void }`, `createPlayer(scene: Scene, startPos: Vector3): PlayerRig`.

No unit tests (Babylon transforms); the pure math it calls is tested in Task 4. Verified by typecheck + smoke.

- [ ] **Step 1: Write `player.ts`**

```ts
// space-sim/player.ts
/**
 * SIMULATION layer: the player rig. Two controllers share one rig:
 *  - updateAscent: vertical climb vs. gravity (PRD §B.3)
 *  - updateOrbit: 6-DOF zero-G with inertia (PRD §B.4/B.5)
 * The rig owns its transform + velocity; Havok collision (if enabled) is
 * applied by main.ts, never the other way around (PRD §B.7).
 */
import {
  FreeCamera, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3,
  Color3,
} from '@babylonjs/core';
import { ALT, ASCENT, THRUST, gravityAt } from './config';
import { applyDamping, ascentStep, brakeVelocity, burnFuel } from './flight';
import type { InputState } from './input';

export interface LookDelta { yaw: number; pitch: number }

export interface PlayerRig {
  root: TransformNode;
  camera: FreeCamera;
  velocity: Vector3;
  fuel: number;
  assist: boolean;
  /** Phase 1: climb. Returns true once the orbit threshold is crossed. */
  updateAscent(input: InputState, dt: number): boolean;
  /** Phases 2–3: 6-DOF. */
  updateOrbit(input: InputState, look: LookDelta, dt: number): void;
  /** Face the camera at a world target (PRD §E.10 recenter). */
  recenterTo(target: Vector3): void;
  dispose(): void;
}

const LOOK_SENS = 0.0025;
const ROT_SPEED = 1.6; // rad/s for Q/E roll

export function createPlayer(scene: Scene, startPos: Vector3): PlayerRig {
  const root = new TransformNode('player', scene);
  root.position = startPos.clone();

  // Simple visible capsule so the player has a body in frame.
  const body = MeshBuilder.CreateCapsule('playerBody', { radius: 0.35, height: 1.4 }, scene);
  const bodyMat = new StandardMaterial('playerMat', scene);
  bodyMat.diffuseColor = new Color3(0.9, 0.9, 0.92);
  body.material = bodyMat;
  body.parent = root;
  body.position.y = -1.2; // below the camera so it doesn't block the view

  const camera = new FreeCamera('playerCam', startPos.clone(), scene);
  camera.minZ = 0.1;
  camera.maxZ = 2000;
  camera.attachControl(scene.getEngine().getRenderingCanvas(), true);
  // We drive rotation ourselves from input; disable the camera's own keys.
  camera.inputs.clear();

  const rig: PlayerRig = {
    root,
    camera,
    velocity: Vector3.Zero(),
    fuel: THRUST.fuelCapacity,
    assist: false,

    updateAscent(input, dt) {
      const thrust01 = input.forward > 0 ? 1 : 0;
      const step = ascentStep(
        root.position.y, rig.velocity.y, thrust01,
        gravityAt(root.position.y), ASCENT.thrustAccel, ASCENT.maxVy, dt,
      );
      rig.velocity.y = step.vy;
      rig.velocity.x = 0;
      rig.velocity.z = 0;
      root.position.y = step.y;
      rig.fuel = burnFuel(rig.fuel, thrust01, THRUST.fuelConsumptionRate, dt);
      camera.position.copyFrom(root.position);
      return root.position.y >= ALT.ORBIT_Y;
    },

    updateOrbit(input, look, dt) {
      // Look: yaw/pitch from mouse or touch drag, roll from Q/E.
      camera.rotation.y += look.yaw * LOOK_SENS;
      camera.rotation.x += look.pitch * LOOK_SENS;
      camera.rotation.x = Math.max(-1.5, Math.min(1.5, camera.rotation.x));
      camera.rotation.z += -input.roll * ROT_SPEED * dt;

      // Translation along camera axes (inertia: velocity persists, PRD §B.5).
      const hasFuel = rig.fuel > 0;
      const f = THRUST.maxForce;
      const fwd = camera.getDirection(Vector3.Forward());
      const right = camera.getDirection(Vector3.Right());
      const up = camera.getDirection(Vector3.Up());
      if (hasFuel) {
        if (input.forward) rig.velocity.addInPlace(fwd.scale(input.forward * f * dt));
        if (input.backward) rig.velocity.addInPlace(fwd.scale(-input.backward * f * dt));
        if (input.right) rig.velocity.addInPlace(right.scale(input.right * f * dt));
        if (input.left) rig.velocity.addInPlace(right.scale(-input.left * f * dt));
        if (input.up) rig.velocity.addInPlace(up.scale(input.up * f * dt));
        if (input.down) rig.velocity.addInPlace(up.scale(-input.down * f * dt));
      }

      const thrustMag = Math.min(1,
        Math.abs(input.forward) + Math.abs(input.backward)
        + Math.abs(input.left) + Math.abs(input.right)
        + Math.abs(input.up) + Math.abs(input.down));
      rig.fuel = burnFuel(rig.fuel, thrustMag, THRUST.fuelConsumptionRate, dt);

      // Brake (R): counter-thrust toward zero velocity.
      if (input.brake) {
        const braked = brakeVelocity(
          { x: rig.velocity.x, y: rig.velocity.y, z: rig.velocity.z },
          THRUST.brakeAccel, dt,
        );
        rig.velocity.set(braked.x, braked.y, braked.z);
        rig.fuel = burnFuel(rig.fuel, 0.5, THRUST.fuelConsumptionRate, dt);
      }

      // Damping (assist raises it for stabilization, PRD §C.5 F).
      const lin = rig.assist ? THRUST.assistLinearDamping : THRUST.linearDamping;
      const damped = applyDamping(
        { x: rig.velocity.x, y: rig.velocity.y, z: rig.velocity.z }, lin, dt,
      );
      rig.velocity.set(damped.x, damped.y, damped.z);

      root.position.addInPlace(rig.velocity.scale(dt));
      camera.position.copyFrom(root.position);
    },

    recenterTo(target) {
      const dir = target.subtract(root.position).normalize();
      camera.setDirection(dir);
      camera.rotation.z = 0;
    },

    dispose() {
      camera.dispose();
      root.dispose();
    },
  };
  return rig;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add space-sim/player.ts
git commit -m "Space Simulator: ascent and 6-DOF orbit player controllers

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: `hud.ts` — Babylon GUI HUD

**Files:**
- Create: `space-sim/hud.ts`

**Interfaces:**
- Consumes: `MissionState` from `./state`; `ApproachState`, `alignmentPct` from `./docking`.
- Produces: `interface Hud { update(state: MissionState, approach: ApproachState, canDock: boolean): void; setMarker(screenX: number|null, screenY: number|null): void; setHint(text: string): void; dispose(): void }`, `createHud(scene: Scene): Hud`.

No unit tests (Babylon GUI needs a render context); verified by typecheck + smoke.

- [ ] **Step 1: Write `hud.ts`**

```ts
// space-sim/hud.ts
/**
 * PRESENTATION layer: Babylon GUI HUD (PRD §C.3/C.4). Reads MissionState;
 * never computes physics. Telemetry updates are throttled by the caller
 * (main.ts calls update ~10 Hz).
 */
import { Scene } from '@babylonjs/core';
import {
  AdvancedDynamicTexture, Control, Rectangle, StackPanel, TextBlock,
} from '@babylonjs/gui';
import type { MissionState } from './state';
import { alignmentPct, type ApproachState } from './docking';

export interface Hud {
  update(state: MissionState, approach: ApproachState, canDock: boolean): void;
  /** Projected ISS marker position in pixels; null hides it. */
  setMarker(screenX: number | null, screenY: number | null): void;
  setHint(text: string): void;
  dispose(): void;
}

const APPROACH_COLOR: Record<ApproachState, string> = {
  SAFE: '#7dd87d',
  CAUTION: '#ffd24d',
  CRITICAL: '#ff6b5e',
  DOCKING_READY: '#6be1ff',
};

function label(panel: StackPanel, name: string): TextBlock {
  const t = new TextBlock(name, '—');
  t.color = 'white';
  t.fontSize = 16;
  t.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  t.height = '22px';
  panel.addControl(t);
  return t;
}

export function createHud(scene: Scene): Hud {
  const ui = AdvancedDynamicTexture.CreateFullscreenUI('hud', true, scene);

  // Top telemetry row.
  const top = new StackPanel('top');
  top.isVertical = false;
  top.top = '12px';
  ui.addControl(top);
  const alt = new TextBlock('alt', 'ALT 0 KM');
  const spd = new TextBlock('spd', 'SPD 0 M/S');
  const timer = new TextBlock('timer', 'T+ 00:00');
  for (const t of [alt, spd, timer]) {
    t.color = 'white';
    t.fontSize = 18;
    t.width = '220px';
    top.addControl(t);
  }

  // Bottom-left docking panel.
  const dockPanel = new Rectangle('dockPanel');
  dockPanel.width = '260px';
  dockPanel.height = '150px';
  dockPanel.background = 'rgba(0,0,0,0.45)';
  dockPanel.cornerRadius = 8;
  dockPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  dockPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  dockPanel.left = '12px';
  dockPanel.top = '-12px';
  ui.addControl(dockPanel);
  const dockStack = new StackPanel('dockStack');
  dockPanel.addControl(dockStack);
  const dist = label(dockStack, 'dist');
  const rel = label(dockStack, 'rel');
  const align = label(dockStack, 'align');
  const approach = label(dockStack, 'approach');
  const fuelBar = label(dockStack, 'fuel');
  const o2 = label(dockStack, 'o2');

  // Center hint line.
  const hint = new TextBlock('hint', '');
  hint.color = '#ffd24d';
  hint.fontSize = 18;
  hint.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  hint.top = '-170px';
  ui.addControl(hint);

  // ISS target marker.
  const marker = new TextBlock('marker', '◈ ISS');
  marker.color = '#6be1ff';
  marker.fontSize = 16;
  marker.isVisible = false;
  ui.addControl(marker);

  const fmtTime = (s: number): string => {
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };
  const bar = (v: number): string => {
    const filled = Math.round((Math.max(0, Math.min(100, v)) / 100) * 10);
    return '█'.repeat(filled) + '░'.repeat(10 - filled);
  };

  return {
    update(state, approachState, canDockNow) {
      alt.text = `ALT ${state.altitudeKm.toFixed(0)} KM`;
      spd.text = `SPD ${state.speedMps.toFixed(1)} M/S`;
      timer.text = `T+ ${fmtTime(state.missionTimeS)}`;
      dist.text = `ISS DIST ${state.distanceToISSm.toFixed(0)} m`;
      rel.text = `REL SPEED ${state.relativeVelocityMps.toFixed(2)} m/s`;
      align.text = `ALIGNMENT ${alignmentPct(state.alignmentDeg)}%`;
      approach.text = canDockNow ? 'DOCK NOW [Enter]' : `APPROACH ${approachState.replace('_', ' ')}`;
      approach.color = APPROACH_COLOR[approachState];
      fuelBar.text = `FUEL ${bar(state.fuel)} ${state.fuel.toFixed(0)}`;
      o2.text = `O₂ ${bar(state.oxygen)}`;
    },
    setMarker(x, y) {
      if (x === null || y === null) { marker.isVisible = false; return; }
      marker.isVisible = true;
      marker.left = `${x}px`;
      marker.top = `${y}px`;
    },
    setHint(text) {
      hint.text = text;
    },
    dispose() {
      ui.dispose();
    },
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add space-sim/hud.ts
git commit -m "Space Simulator: Babylon GUI HUD with telemetry and approach states

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: `main.ts` — bootstrap, phase dispatch, render loop

**Files:**
- Create: `space-sim/main.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–9 (`config`, `state`, `docking`, `input`, `world`, `iss`, `player`, `hud`).
- Produces: the running game (side effects only; nothing imports this module).

No unit tests (orchestration over a live WebGL scene); verified by typecheck + build + manual smoke (Task 12).

- [ ] **Step 1: Write `main.ts`**

```ts
// space-sim/main.ts
/**
 * Bootstrap + game loop. Owns the Babylon engine/scene, Havok (with a
 * kinematic fallback), phase dispatch, pause, adaptive quality, and the
 * HTML shell screens. All gameplay math lives in the other modules.
 */
import { Engine, Scene, Vector3 } from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';
import { ALT, DOCK, MISSION, displayAltitudeKm, metersToUnits, unitsToMeters } from './config';
import { Mission, MissionPhase, track } from './state';
import {
  approachState, canDock, dockingAccuracy, rating, type DockInput,
} from './docking';
import {
  createKeyboardInput, createTouchInput, emptyInput, type InputAction,
  type LookHandler,
} from './input';
import { createWorld } from './world';
import { createIss } from './iss';
import { createPlayer } from './player';
import { createHud } from './hud';

// ---------- DOM helpers ----------
const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
};
const show = (id: string, visible: boolean): void => {
  $(id).hidden = !visible;
};
const isTouch = window.matchMedia('(pointer: coarse)').matches;

function setProgress(pct: number, label: string): void {
  ($('load-bar') as HTMLDivElement).style.width = `${pct}%`;
  $('load-msg').textContent = label;
}

// ---------- boot ----------
async function boot(): Promise<void> {
  track('space_simulator_open', { deviceType: isTouch ? 'mobile' : 'desktop' });
  track('space_simulator_load_start');

  const canvas = $('game-canvas') as HTMLCanvasElement;
  let engine: Engine;
  try {
    engine = new Engine(canvas, true, { adaptToDeviceRatio: true });
  } catch {
    show('screen-loading', false);
    show('screen-fallback', true);
    return;
  }
  window.addEventListener('resize', () => engine.resize());
  setProgress(20, 'Engine ready');

  const scene = new Scene(engine);

  // Havok is optional: collision is nice-to-have, the loop must run without it.
  let physicsOn = false;
  try {
    const hk = await HavokPhysics();
    scene.enablePhysics(new Vector3(0, 0, 0), new (await import('@babylonjs/core')).HavokPlugin(hk));
    physicsOn = true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Havok unavailable — running kinematic (no collision).', err);
  }
  setProgress(40, physicsOn ? 'Physics ready' : 'Physics skipped');

  const mission = new Mission();
  const world = createWorld(scene);
  setProgress(60, 'World built');

  const issPos = new Vector3(40, ALT.ORBIT_Y + 8, 40);
  const iss = createIss(scene, issPos);
  setProgress(75, 'ISS on station');

  const startPos = new Vector3(0, ALT.SURFACE_Y + 1, 0);
  const player = createPlayer(scene, startPos);
  const hud = createHud(scene);
  setProgress(90, 'Systems check');

  const input = emptyInput();
  const look = { yaw: 0, pitch: 0 };
  const onLook: LookHandler = (dx, dy) => { look.yaw += dx; look.pitch += dy; };
  const disposers = [
    createKeyboardInput(canvas, input, onAction, onLook),
  ];
  if (isTouch) disposers.push(createTouchInput(canvas, input, onAction, onLook));

  // ---------- shell screen wiring ----------
  function onAction(a: InputAction): void {
    if (a === 'pause') togglePause();
    if (a === 'assist') {
      player.assist = !player.assist;
      hud.setHint(player.assist ? 'ASSIST ON — stabilizing' : 'ASSIST OFF');
    }
    if (a === 'recenter') recenter();
    if (a === 'dock') tryDock();
  }

  function togglePause(): void {
    const p = mission.state.phase;
    if (p === MissionPhase.Complete || p === MissionPhase.Failed || p === MissionPhase.Briefing) return;
    const next = !mission.state.paused;
    mission.setPaused(next);
    show('screen-paused', next);
  }

  function recenter(): void {
    if (outOfBounds()) {
      // Return to mission (PRD §E.11): pull back to 100 m from the ISS.
      const toPlayer = player.root.position.subtract(issPos).normalize();
      player.root.position.copyFrom(issPos.add(toPlayer.scale(metersToUnits(100))));
      player.velocity.set(0, 0, 0);
    }
    player.recenterTo(iss.port.getAbsolutePosition());
    hud.setHint('Recentered on ISS');
  }

  function outOfBounds(): boolean {
    return Vector3.Distance(player.root.position, issPos) > MISSION.boundsRadiusUnits;
  }

  function dockInput(): DockInput {
    const portPos = iss.port.getAbsolutePosition();
    const distM = unitsToMeters(Vector3.Distance(player.root.position, portPos));
    const relMps = unitsToMeters(player.velocity.length()); // ISS is static
    const fwd = player.camera.getDirection(Vector3.Forward());
    const axis = iss.portAxisWorld();
    const alignmentDeg = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(fwd, axis)))) * (180 / Math.PI);
    const toPort = portPos.subtract(player.root.position).normalize();
    const coneDeg = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(toPort, axis.scale(-1))))) * (180 / Math.PI);
    return {
      distanceM: distM,
      relSpeedMps: relMps,
      alignmentDeg,
      inCorridor: coneDeg < DOCK.corridorHalfAngleDeg,
    };
  }

  function tryDock(): void {
    if (mission.state.phase !== MissionPhase.Approach && mission.state.phase !== MissionPhase.Docking) return;
    const di = dockInput();
    if (canDock(di)) completeMission(di);
    else hud.setHint('Docking not possible — check speed, distance, alignment');
  }

  function completeMission(di: DockInput): void {
    const accuracy = dockingAccuracy(di);
    const fuelPct = player.fuel;
    const grade = rating(accuracy, fuelPct);
    mission.setPhase(MissionPhase.Complete);
    track('docking_success', { dockingAccuracy: accuracy, fuelRemaining: Math.round(fuelPct) });
    $('result-title').textContent = 'MISSION COMPLETE';
    $('result-sub').textContent = 'ISS DOCKED ✓';
    $('result-time').textContent = fmtClock(mission.state.missionTimeS);
    $('result-fuel').textContent = `${fuelPct.toFixed(0)}%`;
    $('result-accuracy').textContent = `${accuracy}%`;
    $('result-grade').textContent = grade;
    show('screen-result', true);
  }

  function failMission(reason: string): void {
    mission.setPhase(MissionPhase.Failed);
    track('docking_failed', { reason });
    $('result-title').textContent = 'MISSION FAILED';
    $('result-sub').textContent = reason;
    $('result-time').textContent = fmtClock(mission.state.missionTimeS);
    $('result-fuel').textContent = `${player.fuel.toFixed(0)}%`;
    $('result-accuracy').textContent = '—';
    $('result-grade').textContent = '—';
    show('screen-result', true);
  }

  function fmtClock(s: number): string {
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  function restart(): void {
    track('mission_restart');
    mission.reset();
    player.root.position.copyFrom(startPos);
    player.velocity.set(0, 0, 0);
    player.fuel = 100;
    player.camera.rotation.set(0, 0, 0);
    world.setAscentProgress(0);
    show('screen-result', false);
    show('screen-briefing', true);
  }

  $('btn-start').addEventListener('click', () => {
    show('screen-briefing', false);
    mission.setPhase(MissionPhase.Ascent);
    track('mission_start');
    hud.setHint('Hold W to thrust — reach orbit!');
  });
  $('btn-resume').addEventListener('click', togglePause);
  $('btn-replay').addEventListener('click', restart);
  $('btn-exit').addEventListener('click', () => {
    track('mission_exit');
    window.location.href = '/';
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !mission.state.paused
      && mission.state.phase >= MissionPhase.Ascent
      && mission.state.phase <= MissionPhase.Docking) {
      togglePause();
    }
  });
  window.addEventListener('pagehide', () => {
    track('mission_exit');
    disposers.forEach((d) => d());
  });

  // ---------- render loop ----------
  let last = performance.now();
  let hudAccum = 0;
  let fpsAccum = 0;
  let fpsSamples = 0;
  let lowStreak = 0;
  const renderScales = [1, 0.8, 0.66, 0.5];
  let scaleIdx = 0;
  let karmanAnnounced = false;
  let fuelWarned = false;

  engine.runRenderLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000); // clamp (PRD §E.8)
    last = now;

    const st = mission.state;
    const playing = !st.paused && st.phase >= MissionPhase.Ascent && st.phase <= MissionPhase.Docking;

    if (playing) {
      mission.update({ missionTimeS: st.missionTimeS + dt });
      mission.update({ oxygen: Math.max(0, st.oxygen - (100 / MISSION.oxygenSeconds) * dt) });

      if (st.phase === MissionPhase.Ascent) {
        const reachedOrbit = player.updateAscent(input, dt);
        const t = Math.min(1, Math.max(0,
          (player.root.position.y - ALT.SURFACE_Y) / (ALT.ORBIT_Y - ALT.SURFACE_Y)));
        world.setAscentProgress(t);
        if (!karmanAnnounced && displayAltitudeKm(player.root.position.y) >= ALT.KARMAN_LINE_KM) {
          karmanAnnounced = true;
          hud.setHint('Kármán line crossed — welcome to space');
        }
        if (reachedOrbit) {
          mission.setPhase(MissionPhase.Orbit);
          hud.setHint('Orbit reached. Zero-G: thrust persists — tap R to brake.');
        }
      } else {
        player.updateOrbit(input, look, dt);
        world.rotate(dt);

        const di = dockInput();
        // Phase promotion by proximity.
        if (st.phase === MissionPhase.Orbit && di.distanceM < 150) {
          mission.setPhase(MissionPhase.Approach);
          hud.setHint('Approach corridor: slow down and align with the port');
        } else if (st.phase === MissionPhase.Approach && di.distanceM < 25) {
          mission.setPhase(MissionPhase.Docking);
        }

        // Failure checks.
        if (di.distanceM < 3 && di.relSpeedMps > 1.5) {
          failMission('Collision with the ISS — approach too fast');
        } else if (player.fuel <= 0 && di.distanceM > 20) {
          if (!fuelWarned) { fuelWarned = true; track('thruster_depleted'); }
          failMission('Out of fuel, adrift far from the ISS');
        } else if (st.oxygen <= 0) {
          failMission('Oxygen depleted');
        }

        if (outOfBounds()) hud.setHint('You are leaving the mission area — press C to return');

        // HUD ~10 Hz (PRD §C.4).
        hudAccum += dt;
        if (hudAccum >= 0.1) {
          hudAccum = 0;
          const portPos = iss.port.getAbsolutePosition();
          mission.update({
            altitudeKm: displayAltitudeKm(player.root.position.y),
            speedMps: unitsToMeters(player.velocity.length()),
            relativeVelocityMps: di.relSpeedMps,
            fuel: player.fuel,
            distanceToISSm: di.distanceM,
            alignmentDeg: di.alignmentDeg,
          });
          hud.update(mission.state, approachState(di), canDock(di));

          // Project the ISS marker to screen space.
          const w = engine.getRenderWidth();
          const h = engine.getRenderHeight();
          const proj = Vector3.Project(portPos, Vector3.Identity(),
            scene.getTransformMatrix(), player.camera.viewport.toGlobal(w, h));
          const behind = Vector3.Dot(portPos.subtract(player.root.position),
            player.camera.getDirection(Vector3.Forward())) < 0;
          hud.setMarker(behind ? null : proj.x - w / 2, behind ? null : h / 2 - proj.y);
        }
      }

      if (player.fuel <= 0 && !fuelWarned && st.phase === MissionPhase.Ascent) {
        fuelWarned = true;
        track('thruster_depleted');
      }
    }

    // Adaptive quality (PRD §D.19): sustained low FPS → step render scale down.
    fpsAccum += dt; fpsSamples += 1;
    if (fpsAccum >= 1) {
      const fps = fpsSamples / fpsAccum;
      fpsAccum = 0; fpsSamples = 0;
      lowStreak = fps < (isTouch ? 24 : 45) ? lowStreak + 1 : 0;
      if (lowStreak >= 3 && scaleIdx < renderScales.length - 1) {
        scaleIdx += 1;
        engine.setHardwareScalingLevel(1 / renderScales[scaleIdx]);
        lowStreak = 0;
        track('quality_downgrade', { qualityTier: renderScales[scaleIdx] });
      }
    }

    // Consume accumulated look deltas once per frame.
    look.yaw = 0; look.pitch = 0;
    scene.render();
  });

  setProgress(100, 'Ready');
  track('space_simulator_load_complete');
  show('screen-loading', false);
  show('screen-briefing', true);
}

boot().catch((err) => {
  // Never a blank page (PRD §E.1).
  // eslint-disable-next-line no-console
  console.error(err);
  show('screen-loading', false);
  show('screen-fallback', true);
});
```

Notes for the implementer:
- `look` deltas accumulate between frames from pointer events and are zeroed after each `updateOrbit` call; during Ascent they are simply cleared each frame.
- The Havok import pattern (`new (await import('@babylonjs/core')).HavokPlugin(hk)`) keeps the plugin tree-shakeable; if the type-checker complains, import `HavokPlugin` statically from `@babylonjs/core` instead — both are acceptable.
- `player.camera.viewport.toGlobal` may need `scene.activeCamera` set; assign `scene.activeCamera = player.camera` right after `createPlayer` if the marker projection misbehaves.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add space-sim/main.ts
git commit -m "Space Simulator: bootstrap, phase dispatch, and adaptive render loop

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 11: `index.html` + `style.css` — shell screens

**Files:**
- Create: `space-sim/index.html`
- Create: `space-sim/style.css`

**Interfaces:**
- Consumes: element ids referenced by `main.ts` and `input.ts`: `game-canvas`, `screen-loading`, `load-bar`, `load-msg`, `screen-briefing`, `btn-start`, `screen-paused`, `btn-resume`, `screen-result`, `result-title`, `result-sub`, `result-time`, `result-fuel`, `result-accuracy`, `result-grade`, `btn-replay`, `btn-exit`, `screen-fallback`, and touch buttons `btn-pause`, `btn-assist`, `btn-recenter`, `btn-dock`, `btn-up`, `btn-down`, `btn-brake`.

- [ ] **Step 1: Write `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="theme-color" content="#010108" />
  <title>Space Simulator — Earth to ISS Mission</title>
  <link rel="stylesheet" href="./style.css" />
</head>
<body>
  <canvas id="game-canvas"></canvas>

  <!-- Touch controls (shown on coarse pointers via CSS) -->
  <div id="touch-controls" aria-hidden="true">
    <button id="btn-up" type="button" class="tbtn">▲</button>
    <button id="btn-down" type="button" class="tbtn">▼</button>
    <button id="btn-brake" type="button" class="tbtn">BRAKE</button>
    <button id="btn-assist" type="button" class="tbtn">ASSIST</button>
    <button id="btn-recenter" type="button" class="tbtn">RECENTER</button>
    <button id="btn-dock" type="button" class="tbtn tbtn-accent">DOCK</button>
    <button id="btn-pause" type="button" class="tbtn">❚❚</button>
  </div>

  <!-- Loading -->
  <div id="screen-loading" class="screen">
    <h1 class="title">SPACE SIMULATOR</h1>
    <p class="subtitle">EARTH → ISS MISSION</p>
    <div class="load-track"><div id="load-bar" class="load-bar"></div></div>
    <p id="load-msg" class="dim">Initializing…</p>
  </div>

  <!-- Briefing -->
  <div id="screen-briefing" class="screen" hidden>
    <h1 class="title">MISSION BRIEFING</h1>
    <ul class="brief">
      <li>Hold <b>W</b> to thrust through the atmosphere into orbit.</li>
      <li>In zero-G, momentum persists — tap <b>R</b> to brake.</li>
      <li>Find the ISS, slow to &lt; 0.5 m/s, align with the port.</li>
      <li>Press <b>Enter</b> (or DOCK) when the HUD says DOCK NOW.</li>
    </ul>
    <p class="dim">WASD move · Space/Shift up/down · Q/E roll · mouse drag to look · F assist · C recenter · Esc pause</p>
    <button id="btn-start" type="button" class="btn-primary">START MISSION</button>
  </div>

  <!-- Paused -->
  <div id="screen-paused" class="screen" hidden>
    <h2 class="title">PAUSED</h2>
    <button id="btn-resume" type="button" class="btn-primary">RESUME</button>
  </div>

  <!-- Result -->
  <div id="screen-result" class="screen" hidden>
    <h2 id="result-title" class="title">MISSION COMPLETE</h2>
    <p id="result-sub" class="subtitle">ISS DOCKED ✓</p>
    <dl class="stats">
      <div><dt>Mission time</dt><dd id="result-time">00:00</dd></div>
      <div><dt>Fuel remaining</dt><dd id="result-fuel">—</dd></div>
      <div><dt>Docking accuracy</dt><dd id="result-accuracy">—</dd></div>
    </dl>
    <p class="grade">RATING: <span id="result-grade">—</span></p>
    <div class="row">
      <button id="btn-replay" type="button" class="btn-primary">REPLAY MISSION</button>
      <button id="btn-exit" type="button" class="btn-ghost">BACK TO WEBSITE</button>
    </div>
  </div>

  <!-- WebGL fallback (PRD §E.1) -->
  <div id="screen-fallback" class="screen" hidden>
    <h2 class="title">3D NOT AVAILABLE</h2>
    <p class="dim">
      This mission needs WebGL with GPU acceleration. Try a modern browser
      (Chrome, Edge, Firefox, Safari) with hardware acceleration enabled.
    </p>
    <p class="dim">
      Fun fact while you're here: the ISS orbits ~400 km up, travelling
      7.66 km/s — one lap every ~90 minutes.
    </p>
    <a class="btn-primary" href="/">Back to the arcade</a>
  </div>

  <script type="module" src="./main.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Write `style.css`**

```css
/* Space Simulator shell screens. Standalone CSS — no Tailwind here. */
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; overflow: hidden; background: #010108; }
#game-canvas { position: fixed; inset: 0; width: 100%; height: 100%; display: block; outline: none; touch-action: none; }

.screen {
  position: fixed; inset: 0; z-index: 10;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; padding: 24px; text-align: center;
  color: #e8ecff; font-family: system-ui, sans-serif;
  background: rgba(1, 1, 8, 0.82);
}
.title { margin: 0; font-size: clamp(24px, 5vw, 42px); letter-spacing: 0.12em; }
.subtitle { margin: 0; color: #6be1ff; letter-spacing: 0.2em; font-size: 14px; }
.dim { color: #9aa3c7; font-size: 13px; max-width: 46ch; }

.load-track { width: min(320px, 70vw); height: 10px; border: 1px solid #3a4066; border-radius: 6px; overflow: hidden; }
.load-bar { height: 100%; width: 0%; background: #6be1ff; transition: width 0.2s; }

.brief { margin: 0; padding-left: 1.2em; text-align: left; color: #cdd4f2; font-size: 15px; line-height: 1.7; }

.btn-primary, .btn-ghost {
  border-radius: 999px; padding: 12px 28px; font-weight: 700; font-size: 15px;
  cursor: pointer; text-decoration: none; border: 2px solid #6be1ff;
}
.btn-primary { background: #6be1ff; color: #010108; }
.btn-primary:hover { background: #9deaff; }
.btn-ghost { background: transparent; color: #6be1ff; }
.btn-ghost:hover { background: rgba(107, 225, 255, 0.12); }
.btn-primary:focus-visible, .btn-ghost:focus-visible, .tbtn:focus-visible {
  outline: 3px solid #ffd24d; outline-offset: 2px;
}

.stats { display: flex; gap: 28px; margin: 8px 0; }
.stats div { display: flex; flex-direction: column; gap: 2px; }
.stats dt { color: #9aa3c7; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; }
.stats dd { margin: 0; font-size: 22px; font-variant-numeric: tabular-nums; }
.grade { font-size: 20px; letter-spacing: 0.15em; color: #ffd24d; }
.row { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }

/* Touch controls: hidden unless a coarse pointer is present. */
#touch-controls { display: none; }
@media (pointer: coarse) {
  #touch-controls {
    display: flex; position: fixed; right: 12px; bottom: 12px; z-index: 5;
    gap: 8px; flex-wrap: wrap; justify-content: flex-end; max-width: 60vw;
  }
}
.tbtn {
  min-width: 56px; min-height: 44px; border-radius: 12px;
  border: 2px solid rgba(107, 225, 255, 0.7); background: rgba(1, 1, 8, 0.55);
  color: #e8ecff; font-size: 13px; font-weight: 700; touch-action: none;
}
.tbtn-accent { border-color: #ffd24d; color: #ffd24d; }

@media (orientation: portrait) and (pointer: coarse) {
  .screen::after {
    content: 'Landscape recommended for the best experience';
    position: absolute; bottom: 10px; color: #9aa3c7; font-size: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .load-bar { transition: none; }
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc -b && npx vite build`
Expected: build succeeds; `dist/space-sim/index.html` exists.

- [ ] **Step 4: Commit**

```bash
git add space-sim/index.html space-sim/style.css
git commit -m "Space Simulator: shell screens and standalone styling

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 12: HomePage card + full verification

**Files:**
- Modify: `src/pages/HomePage.tsx` (add a promo card after the Rail Rush section)

- [ ] **Step 1: Add the card**

In `src/pages/HomePage.tsx`, immediately after the Rail Rush `<section>` (the one ending with `</section>` before `{/* How it works */}`), add:

```tsx
      {/* Space Simulator — standalone 3D mission */}
      <section className="flex flex-col gap-6">
        <Reveal>
          <a
            href="/space-sim/"
            target="_blank"
            rel="noopener noreferrer"
            className="slab lift group relative flex flex-col items-start gap-5 overflow-hidden bg-arcade-ink p-8 shadow-pop sm:flex-row sm:items-center sm:justify-between sm:p-10"
          >
            <Sparkle className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rotate-12 text-white/15" />
            <HalfRing className="pointer-events-none absolute bottom-3 right-8 hidden h-6 w-24 text-white/25 sm:block" />
            <div className="relative">
              <p className="sticker bg-arcade-sea px-3 py-0.5 text-[10px] text-arcade-ink">
                3D · Babylon.js · single player
              </p>
              <h2 className="mt-3 font-display text-xl uppercase tracking-wide text-white sm:text-2xl">
                Space Simulator: Earth → ISS
              </h2>
              <p className="mt-1 max-w-md text-sm font-medium text-[#e6ecff]">
                Launch through the atmosphere, float in zero-G, and dock with
                the International Space Station.
              </p>
            </div>
            <span className="lift relative inline-flex items-center gap-2 rounded-full border-[3px] border-arcade-ink bg-arcade-sea px-6 py-3 font-bold text-arcade-ink shadow-pop transition-colors group-hover:bg-[#8ff0e0]">
              Start mission
              <ArrowRightIcon size={16} className="transition-transform group-hover:translate-x-1" aria-hidden />
            </span>
          </a>
        </Reveal>
      </section>
```

- [ ] **Step 2: Run the full verification suite**

Run: `npm run lint && npm run build && npx vitest run`
Expected: lint clean (`--max-warnings 0`), build succeeds, all tests pass (existing hub tests + the 4 new space-sim suites).

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`, open `http://localhost:5173/space-sim/`.
Verify by hand:
1. Loading bar fills → briefing screen appears.
2. START MISSION → hold W → altitude climbs, sky darkens, stars fade in, Kármán hint at ~100 km.
3. Orbit reached → zero-G: tap W then release → drift continues; R brakes.
4. Fly toward the ISS marker → HUD shows distance/rel speed/alignment; approach state changes SAFE → CAUTION → DOCKING READY.
5. Enter at DOCK NOW → MISSION COMPLETE with time/fuel/accuracy/rating; REPLAY resets to briefing.
6. Esc pauses; switching tabs auto-pauses; RESUME works.
7. Mobile viewport (DevTools device mode): touch joystick moves, drag looks, buttons respond.

- [ ] **Step 4: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "Space Simulator: HomePage promo card and final wiring

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** every spec §9 definition-of-done item maps to a task — fallback (T10/T11), full loop (T10), 6-DOF/fuel/brake/assist (T8), HUD (T9), controls (T5), pause + dt clamp (T10), adaptive quality (T10), tests/build/lint (T1–4, T12), HomePage card (T12).
- **Type consistency:** `DockInput`/`canDock`/`approachState`/`dockingAccuracy`/`rating` (T3) are consumed verbatim in T10; `InputState`/`applyKey`/`keyAction` (T5) consumed in T8/T10; `World.setAscentProgress` (T6), `IssRig.portAxisWorld` (T7), `PlayerRig.updateAscent/updateOrbit/recenterTo` (T8), `Hud.update/setMarker/setHint` (T9) all match their call sites in T10.
- **Known risks flagged inline:** Havok dynamic-import typing (T10 note), `scene.activeCamera` for marker projection (T10 note).
