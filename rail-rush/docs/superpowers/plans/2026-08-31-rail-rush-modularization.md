# Rail Rush Modularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the existing 2,205-line Rail Rush entry into focused TypeScript modules, with one typed advanced-configuration object, while preserving the current game.

**Architecture:** `game.ts` remains the only composition root, lifecycle owner, and animation-loop owner. Factory-created adapters and systems own browser I/O, rendering foundations, environment, effects, player behavior, and course behavior; dependencies point inward from shared configuration and contracts, and lower modules report events without importing `game.ts`.

**Tech Stack:** TypeScript 5.6, Three.js 0.185, Vite 6, Vitest 2

**Spec:** `rail-rush/docs/superpowers/specs/2026-08-31-rail-rush-modularization-design.md`

## Global Constraints

- Keep direct Three.js and the existing static HTML/CSS entry; do not migrate to React, React Three Fiber, Drei, Zustand, or Tailwind.
- Preserve the existing DOM IDs, text, keyboard controls, touch gestures, URL, storage key `railrush.best`, build tag `scenery-6`, gameplay values, frame order, visual identity, and audio cues.
- Add no runtime dependency, external asset, or new gameplay feature.
- Keep `game.ts` as the sole owner of `requestAnimationFrame` and `RunState` transitions.
- No module may import `game.ts`; cross-system behavior uses typed inputs and event callbacks.
- Pools remain fixed-capacity and reuse scene objects; do not allocate geometry or materials inside a frame update.
- Inject `RandomSource` into random-dependent helpers and systems; production passes `Math.random`.
- Preserve current known behavior, including the texture-wrap and scheduler edge cases documented as out of scope in the spec.
- Do not modify, format, stage, or commit the user-owned `rail-rush/railrush.md` file.
- Run commands below from the repository root—the directory containing `package.json`—unless a step says otherwise.
- Stage only the explicit paths listed in each commit step; never use `git add .` or `git add -A`.

---

## Final File Structure

| Path                                  | Responsibility                                                       |
| ------------------------------------- | -------------------------------------------------------------------- |
| `rail-rush/config.ts`                 | The only exported advanced-tuning object, grouped by gameplay domain |
| `rail-rush/config.test.ts`            | Configuration invariants and preserved-value checks                  |
| `rail-rush/types.ts`                  | Shared data-only contracts and event types                           |
| `rail-rush/core/helpers.ts`           | Pure math, RNG selection, and guarded storage helpers                |
| `rail-rush/core/helpers.test.ts`      | Deterministic helper and storage-fallback tests                      |
| `rail-rush/core/pool.ts`              | Fixed-capacity Three.js object pool                                  |
| `rail-rush/core/pool.test.ts`         | Pool capacity, reuse, visibility, reset, and iteration tests         |
| `rail-rush/adapters/audio.ts`         | Web Audio lifecycle, cues, mute state, and music timer               |
| `rail-rush/adapters/input.ts`         | Keyboard/touch listeners and semantic input snapshots                |
| `rail-rush/adapters/input.test.ts`    | Pure gesture classification tests                                    |
| `rail-rush/adapters/ui.ts`            | Required DOM lookup, button binding, screens, HUD, and error display |
| `rail-rush/render/context.ts`         | Renderer, scene, camera, lights, resize, context loss, and rendering |
| `rail-rush/render/textures.ts`        | Procedural canvas textures                                           |
| `rail-rush/render/resources.ts`       | Shared geometries, materials, palettes, and mesh helpers             |
| `rail-rush/render/resources.test.ts`  | Resource reuse and disposal-safe construction tests                  |
| `rail-rush/world/environment.ts`      | Track, sky, treadmills, set pieces, tunnels, sleepers, and streaks   |
| `rail-rush/world/environment.test.ts` | Reset and bounded-environment behavior tests                         |
| `rail-rush/world/scenery.ts`          | Houses, shops, towers, and skyline treadmill                         |
| `rail-rush/effects.ts`                | Particle and pickup-ring pools                                       |
| `rail-rush/effects.test.ts`           | Bounded effect allocation and reset tests                            |
| `rail-rush/gameplay/player.ts`        | Pure motion controller plus runner rig/animation                     |
| `rail-rush/gameplay/player.test.ts`   | Lane, jump, short-hop, slide, fast-fall, landing, and reset tests    |
| `rail-rush/gameplay/course.ts`        | Obstacles, coins, power-ups, spawning, advancement, and collision    |
| `rail-rush/gameplay/course.test.ts`   | Seeded layout, pool bounds, collection, collision, and reset tests   |
| `rail-rush/game.ts`                   | Composition, run state, event routing, frame order, and final render |
| `rail-rush/README.md`                 | Updated module map and advanced-configuration instructions           |

The test files stay beside the modules they specify, matching the repository's current Vitest discovery without introducing a new test directory or test configuration.

## Shared Contract Map

Create these exact data contracts in `types.ts`. Module-specific factory interfaces remain in their owning modules and import only these shared value types.

```ts
export type RunState = 'loading' | 'ready' | 'running' | 'paused' | 'over';
export type InputAction = 'left' | 'right' | 'jump' | 'slide';
export type PowerupKind = 'magnet' | 'shoes';
export type ObstacleKind = 'train' | 'crate' | 'lowBarrier' | 'highBarrier';
export type RandomSource = () => number;

export interface InputSnapshot {
  readonly left: boolean;
  readonly right: boolean;
  readonly jump: boolean;
  readonly slide: boolean;
}

export interface CollisionBounds {
  readonly x: number;
  readonly halfWidth: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly halfDepth: number;
}

export interface ObjectHitBounds {
  readonly halfWidth: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly halfDepth: number;
}

export interface WorldPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface PlayerCameraFacts {
  readonly x: number;
  readonly y: number;
}

export interface EnvironmentFrame {
  readonly enteredTunnel: boolean;
  readonly firstPersonZone: boolean;
}

export interface GameRuntimeState {
  state: RunState;
  speed: number;
  distance: number;
  score: number;
  coins: number;
  runTime: number;
  magnetTime: number;
  jumpBoostTime: number;
  shakeTime: number;
  lastDeltaZ: number;
  best: number;
  lastFrameTime: number;
}

export interface PlayerEventSink {
  onJump(): void;
  onLand(position: WorldPosition): void;
  onRunDust(position: WorldPosition): void;
  onSlide(): void;
  onLaneChange(): void;
}

export interface CourseEventSink {
  onCrash(): void;
  onCoin(position: WorldPosition): void;
  onPowerup(kind: PowerupKind, position: WorldPosition): void;
  onTrainHorn(): void;
  onTrainSmoke(position: WorldPosition): void;
}
```

The event interfaces are stable callback sinks created once during boot. This preserves the spec's event boundary without creating a new event array on every animation frame.

---

### Task 1: Central Configuration, Shared Types, and Pure Helpers

**Files:**

- Create: `rail-rush/types.ts`
- Create: `rail-rush/config.ts`
- Create: `rail-rush/config.test.ts`
- Create: `rail-rush/core/helpers.ts`
- Create: `rail-rush/core/helpers.test.ts`
- Modify: `rail-rush/game.ts:1-80`
- Modify: `rail-rush/scenery.ts:1-35`

**Interfaces:**

- Consumes: browser storage through an injected `Storage | undefined`.
- Produces: `CONFIG`, `RailRushConfig`, the shared contracts above, `clamp(value, min, max)`, `damp(current, target, lambda, dt)`, `randInt(max, rng)`, `pick(items, rng)`, `weightedPick(entries, rng)`, `readStoredNumber(storage, key, fallback)`, and `writeStoredNumber(storage, key, value)`.

- [ ] **Step 1: Write configuration and helper tests before creating the modules**

Create `config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CONFIG } from './config';

describe('CONFIG', () => {
  it('preserves runner balance and persistence identity', () => {
    expect(CONFIG.gameplay.lanes).toEqual([-2.2, 0, 2.2]);
    expect(CONFIG.gameplay.baseSpeed).toBe(11);
    expect(CONFIG.gameplay.maxSpeed).toBe(30);
    expect(CONFIG.player.jumpVelocity).toBe(12.2);
    expect(CONFIG.player.slideDuration).toBe(0.62);
    expect(CONFIG.persistence.bestScoreKey).toBe('railrush.best');
    expect(CONFIG.persistence.buildTag).toBe('scenery-6');
  });

  it('keeps pools bounded and obstacle weights normalized', () => {
    const total = Object.values(CONFIG.obstacles.kinds).reduce((sum, item) => sum + item.weight, 0);
    expect(total).toBeCloseTo(1);
    expect(CONFIG.obstacles.kinds.train.capacity).toBe(6);
    expect(CONFIG.obstacles.kinds.crate.capacity).toBe(8);
    expect(CONFIG.collectibles.coinCapacity).toBe(64);
    expect(CONFIG.effects.particleCapacity).toBe(110);
  });

  it('keeps spawn and speed ranges ordered', () => {
    expect(CONFIG.gameplay.maxSpeed).toBeGreaterThanOrEqual(CONFIG.gameplay.baseSpeed);
    expect(CONFIG.obstacles.spawnAheadZ).toBeLessThan(CONFIG.world.despawnZ);
    expect(CONFIG.obstacles.trainSpawnZ).toBeLessThan(CONFIG.obstacles.spawnAheadZ);
    expect(CONFIG.obstacles.chunkGap.max).toBeGreaterThanOrEqual(CONFIG.obstacles.chunkGap.min);
  });
});
```

Create `core/helpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { clamp, damp, pick, readStoredNumber, weightedPick, writeStoredNumber } from './helpers';

describe('helpers', () => {
  it('clamps, damps, and selects through an injected RNG', () => {
    expect(clamp(12, 0, 10)).toBe(10);
    expect(damp(4, 4, 12, 0.016)).toBe(4);
    expect(pick(['left', 'middle', 'right'], () => 0.99)).toBe('right');
    expect(
      weightedPick(
        [
          { id: 'train', weight: 0.34 },
          { id: 'crate', weight: 0.26 },
          { id: 'barrier', weight: 0.4 },
        ],
        () => 0.35,
      ).id,
    ).toBe('crate');
  });

  it('falls back when storage is absent, invalid, or throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    expect(readStoredNumber(undefined, 'best', 7)).toBe(7);
    expect(readStoredNumber(throwing, 'best', 7)).toBe(7);
    expect(() => writeStoredNumber(throwing, 'best', 9)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the new tests and confirm the imports fail**

Run:

```bash
node node_modules/vitest/vitest.mjs run rail-rush/config.test.ts rail-rush/core/helpers.test.ts
```

Expected: FAIL because `./config` and `./helpers` do not exist.

- [ ] **Step 3: Add the shared contracts and pure helper implementations**

Add the contracts from “Shared Contract Map” to `types.ts`. Implement helpers without reading browser globals:

```ts
import type { RandomSource } from '../types';

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));

export const randInt = (max: number, rng: RandomSource = Math.random): number =>
  Math.floor(rng() * max);

export const pick = <T>(items: readonly T[], rng: RandomSource = Math.random): T =>
  items[randInt(items.length, rng)];

export function weightedPick<T extends { readonly weight: number }>(
  entries: readonly T[],
  rng: RandomSource = Math.random,
): T {
  let roll = rng() * entries.reduce((sum, entry) => sum + entry.weight, 0);
  return entries.find((entry) => (roll -= entry.weight) <= 0) ?? entries[0];
}

export function readStoredNumber(
  storage: Storage | undefined,
  key: string,
  fallback: number,
): number {
  try {
    const stored = storage?.getItem(key);
    if (stored === null || stored === undefined) return fallback;
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredNumber(storage: Storage | undefined, key: string, value: number): void {
  try {
    storage?.setItem(key, String(value));
  } catch {
    // Storage is optional in private or restricted browsing modes.
  }
}
```

- [ ] **Step 4: Create the one grouped configuration object**

Define `RailRushConfig` and export `CONFIG` with `as const satisfies RailRushConfig`. Start with every existing top-level `CONFIG` value, then move hard-coded tuning values into these exact groups as the owning modules are extracted:

| Group          | Required fields and preserved initial values                                                                                                                                                                                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gameplay`     | `lanes [-2.2, 0, 2.2]`, `laneStepTime 0.17`, `startBoostTime 0.8`, `startBoostFloor 0.72`, `baseSpeed 11`, `speedRamp 0.22`, `maxSpeed 30`, `scorePerUnit 0.6`, `coinScore 10`, `maxFrameDelta 0.05`, `fallbackFrameDelta 0.016`, `swipeThreshold 26`                                                            |
| `player`       | `gravity 34`, `jumpVelocity 12.2`, `highJumpMultiplier 1.32`, `slideDuration 0.62`, `height 1.75`, `slideHeight 0.85`, `halfWidth 0.42`, `baseHalfDepth 0.38`, `jumpBufferTime 0.09`, `autoSlideAfterFastFall 0.32`, `fastFallVelocity -16`, `shortHopThreshold 4`, `shortHopMultiplier 0.55`, `rollPivotY 1.05` |
| `obstacles`    | `spawnAheadZ -95`, `trainSpawnZ -120`, `chunkGap { min: 9, max: 17 }`, `doubleBlockChance 0.42`, `trainSpeedMultiplier 1.35`; kinds: train `{ capacity: 6, weight: 0.34 }`, crate `{ 8, 0.26 }`, lowBarrier `{ 8, 0.22 }`, highBarrier `{ 8, 0.18 }`                                                             |
| `collectibles` | `coinCapacity 64`, `coinLineLength 6`, `coinLineSpacing 1.4`, `coinLineStartOffset 2`, `coinHeight 1.05`, `coinMagnetRadius 4.5`, `magnetDuration 8`, `highJumpDuration 8`, `powerupChance 0.16`, `powerupCapacity 3`, `powerupSpawnOffset 6`                                                                    |
| `renderer`     | `antialias true`, `powerPreference 'high-performance'`, pixel ratio `{ min: 1, max: 2 }`, `toneMappingExposure 1.2`, `shadowMapSize 1024`                                                                                                                                                                        |
| `camera`       | `initialFov 66`, `landscapeFov 64`, `portraitFov 76`, `near 0.1`, `far 900`, chase `{ x: 0, y: 4.9, z: 8 }`, first-person `{ z: 1.45, yOffset: 2.02 }`, `tunnelBlendRate 3.4`, `speedFovKick 7`, `tunnelFovKick 4`, `bodyHideBlend 0.85`                                                                         |
| `world`        | `despawnZ 9`, `wrapMargin 6`, sleepers `{ rows: 44, gap: 2.2 }`, streaks `{ count: 22, startSpeed: 18 }`, `tunnelLength 50`, `setPiecePools { tunnels: 2, towers: 3, tumbleweeds: 2 }`, initial schedule `{ tunnel: 320, tower: 170 }`                                                                           |
| `effects`      | `particleCapacity 110`, `ringCapacity 8`, `reducedMotionDivisor 2`, `crashShakeDuration 0.5`, `flashOpacity 0.75`, `flashDelayMs 30`                                                                                                                                                                             |
| `audio`        | `muteDoubleTapMs 350`, `musicStepMs 280`, bass notes `[55, 55, 65.4, 49]`, plus named `coin`, `jump`, `land`, `slide`, `lane`, `power`, `horn`, `tunnel`, and `crash` cue parameters copied from `Sfx`                                                                                                           |
| `visual`       | the current color palette, train palettes, texture sizes/densities/repeats, star count `130`, fog `{ color: 0xf2a45c, near: 28, far: 105 }`, and reduced-motion media query `'(prefers-reduced-motion: reduce)'`                                                                                                 |
| `persistence`  | `bestScoreKey 'railrush.best'` and `buildTag 'scenery-6'`                                                                                                                                                                                                                                                        |

Keep construction-only mesh dimensions next to their factories. Move a number into `CONFIG` when changing it would alter timing, balance, hitboxes, capacity, spacing, color, texture cost, render quality, or device cost.

- [ ] **Step 5: Switch the monolith and scenery to the new imports**

Delete the local `CONFIG`, `clamp`, `randInt`, `pick`, `damp`, `weightedPick`, and `store` definitions. Import `CONFIG` and helpers; mechanically change references to grouped paths. Use `readStoredNumber(window.localStorage, CONFIG.persistence.bestScoreKey, 0)` and `writeStoredNumber` for the best score. In `scenery.ts` import `CONFIG` and `pick` so `DESPAWN_Z`, `WRAP_MARGIN`, and its local random picker no longer duplicate configuration.

- [ ] **Step 6: Run focused tests, strict TypeScript, and production build**

```bash
node node_modules/vitest/vitest.mjs run rail-rush/config.test.ts rail-rush/core/helpers.test.ts
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
```

Expected: both test files PASS, TypeScript exits 0, and Vite emits all configured pages successfully.

- [ ] **Step 7: Commit only this task**

```bash
git add rail-rush/types.ts rail-rush/config.ts rail-rush/config.test.ts rail-rush/core/helpers.ts rail-rush/core/helpers.test.ts rail-rush/game.ts rail-rush/scenery.ts
git commit -m "refactor(rail-rush): centralize configuration"
```

---

### Task 2: Fixed-Capacity Object Pool

**Files:**

- Create: `rail-rush/core/pool.ts`
- Create: `rail-rush/core/pool.test.ts`
- Modify: `rail-rush/game.ts:1029-1400`

**Interfaces:**

- Consumes: `THREE.Object3D` and a parent `THREE.Object3D`.
- Produces: `ObjectPool<T>` and `createObjectPool(parent, capacity, factory)` with the exact signatures in the approved spec.

- [ ] **Step 1: Write the failing pool tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createObjectPool } from './pool';

describe('createObjectPool', () => {
  it('preallocates, exhausts, releases, and reuses without growing', () => {
    const parent = new THREE.Group();
    const factory = vi.fn(() => new THREE.Group());
    const pool = createObjectPool(parent, 2, factory);

    expect(factory).toHaveBeenCalledTimes(2);
    expect(parent.children).toHaveLength(2);
    const first = pool.acquire();
    const second = pool.acquire();
    expect(first?.visible).toBe(true);
    expect(second?.userData.active).toBe(true);
    expect(pool.acquire()).toBeNull();

    pool.release(first!);
    expect(first?.visible).toBe(false);
    expect(pool.acquire()).toBe(first);
    expect(pool.items).toHaveLength(2);
  });

  it('iterates only active objects and reset releases all objects', () => {
    const pool = createObjectPool(new THREE.Group(), 3, () => new THREE.Group());
    pool.acquire();
    pool.acquire();
    const visitor = vi.fn();
    pool.forEachActive(visitor);
    expect(visitor).toHaveBeenCalledTimes(2);
    pool.reset();
    pool.forEachActive(visitor);
    expect(visitor).toHaveBeenCalledTimes(2);
    expect(pool.items.every((item) => !item.visible && !item.userData.active)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and confirm the module is missing**

```bash
node node_modules/vitest/vitest.mjs run rail-rush/core/pool.test.ts
```

Expected: FAIL because `./pool` does not exist.

- [ ] **Step 3: Implement the bounded pool**

```ts
import * as THREE from 'three';

export interface ObjectPool<T extends THREE.Object3D> {
  readonly items: readonly T[];
  acquire(): T | null;
  release(item: T): void;
  reset(): void;
  forEachActive(visitor: (item: T) => void): void;
}

export function createObjectPool<T extends THREE.Object3D>(
  parent: THREE.Object3D,
  capacity: number,
  factory: () => T,
): ObjectPool<T> {
  const items = Array.from({ length: capacity }, () => {
    const item = factory();
    item.visible = false;
    item.userData.active = false;
    parent.add(item);
    return item;
  });

  const release = (item: T): void => {
    item.visible = false;
    item.userData.active = false;
  };

  return {
    items,
    acquire() {
      const item = items.find((candidate) => !candidate.userData.active) ?? null;
      if (item) {
        item.visible = true;
        item.userData.active = true;
      }
      return item;
    },
    release,
    reset() {
      items.forEach(release);
    },
    forEachActive(visitor) {
      for (const item of items) if (item.userData.active) visitor(item);
    },
  };
}
```

- [ ] **Step 4: Replace the local pool class**

Import `createObjectPool` and replace every `new Pool(capacity, factory)` with `createObjectPool(scene, capacity, factory)`. Replace `get()` with `acquire()` and remove duplicate assignments to `visible` and `userData.active` immediately after acquisition. Preserve every reset, release, capacity, and factory body.

```ts
type AnyObjectPool = ObjectPool<THREE.Object3D>;
const obstaclePools: readonly {
  readonly kind: ObstacleKind;
  readonly pool: AnyObjectPool;
  readonly weight: number;
}[] = [
  { kind: 'train', pool: trains, weight: CONFIG.obstacles.kinds.train.weight },
  { kind: 'crate', pool: crates, weight: CONFIG.obstacles.kinds.crate.weight },
  { kind: 'lowBarrier', pool: lowBarriers, weight: CONFIG.obstacles.kinds.lowBarrier.weight },
  { kind: 'highBarrier', pool: highBarriers, weight: CONFIG.obstacles.kinds.highBarrier.weight },
];
```

- [ ] **Step 5: Verify tests and compilation**

```bash
node node_modules/vitest/vitest.mjs run rail-rush/core/pool.test.ts
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
```

Expected: pool tests PASS, TypeScript exits 0, and the multi-page build succeeds.

- [ ] **Step 6: Commit only this task**

```bash
git add rail-rush/core/pool.ts rail-rush/core/pool.test.ts rail-rush/game.ts
git commit -m "refactor(rail-rush): extract bounded object pool"
```

---

### Task 3: Browser Adapters for Input, UI, and Audio

**Files:**

- Create: `rail-rush/adapters/audio.ts`
- Create: `rail-rush/adapters/input.ts`
- Create: `rail-rush/adapters/input.test.ts`
- Create: `rail-rush/adapters/ui.ts`
- Modify: `rail-rush/game.ts:69-250`

**Interfaces:**

- Consumes: `RunState`, `InputAction`, `InputSnapshot`, `CONFIG.audio`, and `CONFIG.gameplay.swipeThreshold`.
- Produces: `AudioAdapter`, `InputAdapter`, `UiAdapter`, `createAudio`, `createInputAdapter`, `classifyGesture`, and `createUi`.

- [ ] **Step 1: Write gesture-classification tests**

```ts
import { describe, expect, it } from 'vitest';
import { classifyGesture } from './input';

describe('classifyGesture', () => {
  it('treats short movement as a tap and uses the dominant swipe axis', () => {
    expect(classifyGesture(8, -9, 26)).toBe('jump');
    expect(classifyGesture(40, -30, 26)).toBe('right');
    expect(classifyGesture(-50, 10, 26)).toBe('left');
    expect(classifyGesture(5, -40, 26)).toBe('jump');
    expect(classifyGesture(5, 40, 26)).toBe('slide');
  });
});
```

- [ ] **Step 2: Run the test and confirm the adapter is missing**

```bash
node node_modules/vitest/vitest.mjs run rail-rush/adapters/input.test.ts
```

Expected: FAIL because `./input` does not exist.

- [ ] **Step 3: Implement semantic input and listener cleanup**

```ts
export interface InputHandlers {
  getState(): RunState;
  onStart(): void;
  onTogglePause(): void;
  onJumpRelease(): void;
}

export interface InputAdapter {
  consume(): InputSnapshot;
  clear(): void;
  dispose(): void;
}

export function classifyGesture(deltaX: number, deltaY: number, threshold: number): InputAction;

export function createInputAdapter(
  targetWindow: Window,
  targetDocument: Document,
  handlers: InputHandlers,
  swipeThreshold: number,
): InputAdapter;
```

Keep one mutable four-flag snapshot inside the adapter. `consume()` copies flags into a second stable snapshot, clears pending flags, and returns that same snapshot object. Preserve repeat suppression, `preventDefault` for jump keys, tap-to-start, pause keys, jump release, dominant-axis swipes, and the `#hud, .screen` touch exclusion. `dispose()` removes every listener with the same callback/options identity used at registration.

- [ ] **Step 4: Extract the UI adapter**

```ts
export interface UiBindings {
  onStart(): void;
  onPause(): void;
  onResume(): void;
  onRestart(): void;
  onMute(now: number): void;
}

export interface UiAdapter {
  readonly canvas: HTMLCanvasElement;
  bind(bindings: UiBindings): void;
  showReady(best: number, buildTag: string): void;
  showRunning(): void;
  showPaused(): void;
  showGameOver(score: number, coins: number, best: number, isBest: boolean): void;
  showBootError(message: string): void;
  showRuntimeError(message: string): void;
  showGraphicsLost(): void;
  updateHud(score: number, coins: number): void;
  updatePower(kind: PowerupKind | null, ratio: number): void;
  setMuted(muted: boolean): void;
  flashCrash(reducedMotion: boolean): void;
  dispose(): void;
}

export function createUi(
  targetDocument: Document,
  effectsConfig: RailRushConfig['effects'],
): UiAdapter;
```

Move all `hidden`, `textContent`, `style`, `aria-pressed`, and `aria-label` mutations into these methods. Preserve current strings and crash-flash timing from `CONFIG.effects`. `bind` is called once; reject a second call so buttons cannot acquire duplicate listeners.

- [ ] **Step 5: Extract audio without changing cue synthesis**

```ts
export interface AudioStatus {
  readonly muted: boolean;
  readonly musicWanted: boolean;
}

export interface AudioAdapter {
  ensure(): void;
  toggleMute(now: number): AudioStatus;
  setMuted(muted: boolean): void;
  syncMusic(running: boolean): void;
  coin(): void;
  jump(): void;
  land(): void;
  slide(): void;
  lane(): void;
  power(): void;
  horn(): void;
  tunnel(): void;
  crash(): void;
  dispose(): void;
}

export function createAudio(targetWindow: Window, config: RailRushConfig['audio']): AudioAdapter;
```

Move `AudioContext`, the prefixed iOS fallback, oscillator creation, cue methods, mute double-tap state, and music interval into the closure. `dispose()` clears the interval and closes an existing context. Delayed notes re-check mute state through the existing `blip` guard.

- [ ] **Step 6: Wire adapters into the still-monolithic game**

Create UI with `createUi(document, CONFIG.effects)` and audio before renderer boot, then create input after lifecycle functions are available. Register `error` and `unhandledrejection` handlers in `game.ts` and route them to `ui.showBootError`; they remain composition-root concerns.

```ts
const input = createInputAdapter(
  window,
  document,
  {
    getState: () => runtime.state,
    onStart: startRun,
    onTogglePause: togglePause,
    onJumpRelease: releasePlayerJump,
  },
  CONFIG.gameplay.swipeThreshold,
);
```

During this task `releasePlayerJump` may contain the existing player-field logic. Task 7 replaces its body with `player.releaseJump()`.

- [ ] **Step 7: Verify adapters and browser compilation**

```bash
node node_modules/vitest/vitest.mjs run rail-rush/adapters/input.test.ts
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
```

Expected: gesture tests PASS, TypeScript exits 0, and Vite resolves all new adapter imports.

- [ ] **Step 8: Commit only this task**

```bash
git add rail-rush/adapters/audio.ts rail-rush/adapters/input.ts rail-rush/adapters/input.test.ts rail-rush/adapters/ui.ts rail-rush/game.ts rail-rush/config.ts
git commit -m "refactor(rail-rush): isolate browser adapters"
```

---

### Task 4: Render Context, Procedural Textures, and Shared Resources

**Files:**

- Create: `rail-rush/render/context.ts`
- Create: `rail-rush/render/textures.ts`
- Create: `rail-rush/render/resources.ts`
- Create: `rail-rush/render/resources.test.ts`
- Modify: `rail-rush/game.ts:251-759`
- Modify: `rail-rush/config.ts`

**Interfaces:**

- Consumes: `CONFIG.renderer`, `CONFIG.camera`, `CONFIG.visual`, `PlayerCameraFacts`, and `RandomSource`.
- Produces: `RenderContext`, `ProceduralTextures`, `RenderResources`, `createRenderContext`, `createProceduralTextures`, `createRenderResources`, `mesh`, `enableShadows`, and `singleBasicMaterial`.

- [ ] **Step 1: Write a Node-safe shared-resource test**

```ts
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CONFIG } from '../config';
import { createRenderResources } from './resources';

describe('createRenderResources', () => {
  it('creates one shared geometry/material registry from supplied textures', () => {
    const texture = new THREE.Texture();
    const resources = createRenderResources(
      {
        ground: texture,
        ballast: texture,
        rust: texture,
        hazard: texture,
        glow: texture,
        cloudShadow: texture,
        sky: texture,
        houseWalls: [texture, texture, texture, texture],
        towerWalls: [texture, texture, texture],
      },
      CONFIG.visual,
    );
    expect(resources.geometry.box).toBe(resources.geometry.box);
    expect(resources.materials.coin).toBeInstanceOf(THREE.MeshPhongMaterial);
    expect(resources.trainPalettes).toHaveLength(5);
    expect(() => resources.dispose()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test and confirm the render module is missing**

Run `node node_modules/vitest/vitest.mjs run rail-rush/render/resources.test.ts`.

Expected: FAIL because `./resources` does not exist.

- [ ] **Step 3: Move procedural texture generation behind a factory**

Move `canvasTexture`, `wrapped`, `terrainTexture`, `artGroundTexture`, `artBallastTexture`, `drawPebble`, and the hazard/glow/cloud-shadow/sky drawing bodies to `textures.ts`. Keep the current 2-by-2 `wrapped` loops unchanged.

```ts
export interface ProceduralTextures {
  readonly ground: THREE.Texture;
  readonly ballast: THREE.Texture;
  readonly rust: THREE.Texture;
  readonly hazard: THREE.Texture;
  readonly glow: THREE.Texture;
  readonly cloudShadow: THREE.Texture;
  readonly sky: THREE.Texture;
  readonly houseWalls: readonly THREE.Texture[];
  readonly towerWalls: readonly THREE.Texture[];
}

export function createProceduralTextures(
  renderer: THREE.WebGLRenderer,
  config: RailRushConfig['visual'],
  rng: RandomSource,
): ProceduralTextures;
```

Replace `Math.random` with `rng`, and use injected `randInt`/`pick`. Preserve canvas sizes, densities, colors, repeats, color space, and anisotropy through `CONFIG.visual.textures`.

- [ ] **Step 4: Build the resource registry**

Move `MAT`, `GEO`, `TRAIN_PALETTES`, `mesh`, `shadows`, and `matOf` into `resources.ts`.

```ts
export interface GeometryRegistry {
  readonly box: THREE.BoxGeometry;
  readonly coin: THREE.CylinderGeometry;
  readonly torus: THREE.TorusGeometry;
  readonly octahedron: THREE.OctahedronGeometry;
  readonly cone: THREE.ConeGeometry;
  readonly wheel: THREE.CylinderGeometry;
  readonly puff: THREE.SphereGeometry;
  readonly circle: THREE.CircleGeometry;
  readonly ring: THREE.TorusGeometry;
}

export interface MaterialRegistry {
  readonly rail: THREE.MeshPhongMaterial;
  readonly sleeper: THREE.MeshLambertMaterial;
  readonly ground: THREE.MeshLambertMaterial;
  readonly ballast: THREE.MeshLambertMaterial;
  readonly hazard: THREE.MeshLambertMaterial;
  readonly steel: THREE.MeshLambertMaterial;
  readonly pole: THREE.MeshLambertMaterial;
  readonly darkMetal: THREE.MeshLambertMaterial;
  readonly glass: THREE.MeshLambertMaterial;
  readonly crateWood: THREE.MeshLambertMaterial;
  readonly crateFrame: THREE.MeshLambertMaterial;
  readonly barrierLowLeg: THREE.MeshLambertMaterial;
  readonly cactus: THREE.MeshLambertMaterial;
  readonly patch: readonly THREE.MeshLambertMaterial[];
  readonly cloudShadow: THREE.MeshBasicMaterial;
  readonly shrub: readonly THREE.MeshLambertMaterial[];
  readonly rust: THREE.MeshLambertMaterial;
  readonly tunnelLiner: THREE.MeshLambertMaterial;
  readonly tunnelRib: THREE.MeshLambertMaterial;
  readonly tunnelSkirt: THREE.MeshLambertMaterial;
  readonly cloud: THREE.MeshLambertMaterial;
  readonly coin: THREE.MeshPhongMaterial;
  readonly magnet: THREE.MeshPhongMaterial;
  readonly shoes: THREE.MeshPhongMaterial;
  readonly halo: THREE.MeshBasicMaterial;
  readonly body: THREE.MeshLambertMaterial;
  readonly head: THREE.MeshLambertMaterial;
  readonly legs: THREE.MeshLambertMaterial;
  readonly arms: THREE.MeshLambertMaterial;
  readonly cap: THREE.MeshLambertMaterial;
  readonly pack: THREE.MeshLambertMaterial;
  readonly scarf: THREE.MeshBasicMaterial;
  readonly ring: THREE.MeshBasicMaterial;
  readonly lightCone: THREE.MeshBasicMaterial;
  readonly tumbleweed: THREE.MeshLambertMaterial;
  readonly particle: THREE.MeshBasicMaterial;
  readonly streak: THREE.MeshBasicMaterial;
  readonly houseWalls: readonly THREE.MeshLambertMaterial[];
  readonly houseRoof: THREE.MeshLambertMaterial;
  readonly houseAwning: THREE.MeshLambertMaterial;
  readonly towerWalls: readonly THREE.MeshLambertMaterial[];
}

export interface RenderResources {
  readonly geometry: GeometryRegistry;
  readonly materials: MaterialRegistry;
  readonly trainPalettes: readonly { readonly body: number; readonly accent: number }[];
  dispose(): void;
}

export function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  scaleX: number,
  scaleY: number,
  scaleZ: number,
): THREE.Mesh;

export function enableShadows(root: THREE.Object3D, enabled?: boolean): void;

export function singleBasicMaterial(object: THREE.Object3D): THREE.MeshBasicMaterial;
```

`dispose()` visits each unique geometry, material, and supplied texture once and is used only for page teardown.

- [ ] **Step 5: Extract renderer/camera ownership**

```ts
export interface CameraFrame {
  readonly dt: number;
  readonly distance: number;
  readonly speedRatio: number;
  readonly shakeTime: number;
  readonly reducedMotion: boolean;
  readonly firstPersonZone: boolean;
  readonly player: PlayerCameraFacts;
}

export interface CameraUpdate {
  readonly firstPersonBlend: number;
  readonly shakeTime: number;
}

export interface RenderContext {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  updateCamera(frame: CameraFrame): CameraUpdate;
  render(): void;
  dispose(): void;
}

export function createRenderContext(
  canvas: HTMLCanvasElement,
  rendererConfig: RailRushConfig['renderer'],
  cameraConfig: RailRushConfig['camera'],
  visualConfig: RailRushConfig['visual'],
  rng: RandomSource,
  onContextLost: () => void,
): RenderContext;
```

Move WebGL construction, fog, lights, resize, camera blending, FOV changes, and context-loss registration into `context.ts`. Reuse one `CameraUpdate` object. `dispose()` removes listeners and disposes the renderer.

- [ ] **Step 6: Replace the monolith sections**

```ts
const renderContext = createRenderContext(
  ui.canvas,
  CONFIG.renderer,
  CONFIG.camera,
  CONFIG.visual,
  Math.random,
  () => {
    if (runtime.state === 'running') togglePause();
    ui.showGraphicsLost();
  },
);
const textures = createProceduralTextures(renderContext.renderer, CONFIG.visual, Math.random);
const resources = createRenderResources(textures, CONFIG.visual);
```

Remove original renderer, scene, camera, texture, material, geometry, and resize sections after every remaining reference uses `renderContext` or `resources`.

- [ ] **Step 7: Verify resource tests, strict types, and builds**

```bash
node node_modules/vitest/vitest.mjs run rail-rush/render/resources.test.ts
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build rail-rush --outDir /data/data/com.termux/files/usr/tmp/rail-rush-vite-build
node node_modules/vite/bin/vite.js build
```

Expected: resources tests PASS, TypeScript exits 0, and both Vite builds succeed.

- [ ] **Step 8: Commit only this task**

```bash
git add rail-rush/render/context.ts rail-rush/render/textures.ts rail-rush/render/resources.ts rail-rush/render/resources.test.ts rail-rush/game.ts rail-rush/config.ts rail-rush/adapters/ui.ts
git commit -m "refactor(rail-rush): split render foundations"
```

---

### Task 5: World Scenery and Environment System

**Files:**

- Create: `rail-rush/world/scenery.ts`
- Create: `rail-rush/world/environment.ts`
- Create: `rail-rush/world/environment.test.ts`
- Delete: `rail-rush/scenery.ts`
- Modify: `rail-rush/game.ts:760-961,1304-1444,1734-1883`
- Modify: `rail-rush/config.ts`

**Interfaces:**

- Consumes: `RenderResources`, `ProceduralTextures`, `ObjectPool`, `RandomSource`, `EnvironmentFrame`, and the world/visual config groups.
- Produces: `ScenerySystem`, `EnvironmentSystem`, `createScenery`, and `createEnvironment`.

- [ ] **Step 1: Write an environment reset/bounds test**

Build a real `THREE.Scene` with minimal Three.js textures/resources; no renderer or DOM is needed:

```ts
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CONFIG } from '../config';
import { createEnvironment } from './environment';
import { createRenderResources } from '../render/resources';

describe('createEnvironment', () => {
  it('reuses bounded set-piece pools and resets tunnel camera facts', () => {
    const texture = new THREE.Texture();
    const resources = createRenderResources(
      {
        ground: texture,
        ballast: texture,
        rust: texture,
        hazard: texture,
        glow: texture,
        cloudShadow: texture,
        sky: texture,
        houseWalls: [texture, texture, texture, texture],
        towerWalls: [texture, texture, texture],
      },
      CONFIG.visual,
    );
    const environment = createEnvironment(
      new THREE.Scene(),
      resources,
      { glow: texture, sky: texture },
      CONFIG,
      () => 0.5,
    );

    environment.resetRun();
    const frame = environment.advance(0, 0, 0);
    expect(frame.enteredTunnel).toBe(false);
    expect(frame.firstPersonZone).toBe(false);
    expect(environment.activeSetPieces().tunnels).toBeLessThanOrEqual(
      CONFIG.world.setPiecePools.tunnels,
    );
  });
});
```

The narrow texture argument is `Pick<ProceduralTextures, 'glow' | 'sky'>`.

- [ ] **Step 2: Run the test and confirm the environment module is missing**

Run `node node_modules/vitest/vitest.mjs run rail-rush/world/environment.test.ts`.

Expected: FAIL because `./environment` does not exist.

- [ ] **Step 3: Move the existing scenery factory under `world/`**

Create `world/scenery.ts` from the current `scenery.ts` implementation:

```ts
export interface ScenerySystem {
  advance(deltaZ: number): void;
}

export function createScenery(
  scene: THREE.Scene,
  config: RailRushConfig['world'],
  resources: RenderResources,
  rng: RandomSource,
): ScenerySystem;
```

Generate the four shopfront textures and three tower-window textures in `createProceduralTextures`, then consume `resources.materials.houseWalls` and `resources.materials.towerWalls` here. `world/scenery.ts` must never access `document`, including during factory construction. Preserve 14 houses at spacing 26 and 12 towers at spacing 40 with speed factor 0.55. Delete the old file only after `game.ts` no longer imports it.

- [ ] **Step 4: Extract static and scrolling environment behavior**

Move these complete behavior units into `environment.ts`: sky/sun/stars; ground/ballast/rails/sleepers; clouds/cacti/shrubs/dirt/cloud shadows/poles/gantries/scenery; wind streaks; water towers/tunnels/tumbleweeds; set-piece scheduling; tunnel entry and first-person-zone detection.

```ts
export interface ActiveSetPieceCounts {
  readonly tunnels: number;
  readonly towers: number;
  readonly tumbleweeds: number;
}

export interface EnvironmentSystem {
  resetRun(): void;
  advance(dt: number, deltaZ: number, travel: number): EnvironmentFrame;
  spawnDue(travel: number): void;
  updateStreaks(dt: number, speed: number): void;
  activeSetPieces(): ActiveSetPieceCounts;
  dispose(): void;
}

export function createEnvironment(
  scene: THREE.Scene,
  resources: RenderResources,
  textures: Pick<ProceduralTextures, 'glow' | 'sky'>,
  config: RailRushConfig,
  rng: RandomSource,
): EnvironmentSystem;
```

The two-phase `advance`/`spawnDue` interface preserves the original order: environment and active objects move first, course events spawn next, then set pieces schedule. Reuse mutable `EnvironmentFrame` and active-count objects. `enteredTunnel` is true only on the outside-to-inside edge; `game.ts` translates it to `audio.tunnel()`. `firstPersonZone` reports state and does not touch the camera.

- [ ] **Step 5: Replace environment logic in `game.ts`**

Create one environment system during boot. Reset through `environment.resetRun()`. Use:

```ts
const environmentFrame = environment.advance(dt, deltaZ, runtime.distance);
spawner.update(runtime.distance);
environment.spawnDue(runtime.distance);
if (environmentFrame.enteredTunnel) audio.tunnel();
environment.updateStreaks(dt, runtime.speed);
```

Task 8 replaces this remaining `spawner.update` call with `course.spawnDue`.

- [ ] **Step 6: Verify environment tests and builds**

```bash
node node_modules/vitest/vitest.mjs run rail-rush/world/environment.test.ts
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build rail-rush --outDir /data/data/com.termux/files/usr/tmp/rail-rush-vite-build
```

Expected: environment tests PASS, TypeScript exits 0, and Rail Rush builds.

- [ ] **Step 7: Commit only this task**

```bash
git add rail-rush/world/scenery.ts rail-rush/world/environment.ts rail-rush/world/environment.test.ts rail-rush/scenery.ts rail-rush/game.ts rail-rush/config.ts
git commit -m "refactor(rail-rush): extract world environment"
```

---

### Task 6: Pooled Effects System

**Files:**

- Create: `rail-rush/effects.ts`
- Create: `rail-rush/effects.test.ts`
- Modify: `rail-rush/game.ts:1233-1303,2118-2130`
- Modify: `rail-rush/config.ts`

**Interfaces:**

- Consumes: `ObjectPool`, `WorldPosition`, `RandomSource`, and `CONFIG.effects`.
- Produces: `EffectAssets`, `EffectsSystem`, and `createEffects`.

- [ ] **Step 1: Write bounded-effects tests**

```ts
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CONFIG } from './config';
import { createEffects } from './effects';

describe('createEffects', () => {
  it('drops overflow instead of growing pools and reset releases everything', () => {
    const effects = createEffects(
      new THREE.Scene(),
      {
        box: new THREE.BoxGeometry(1, 1, 1),
        ring: new THREE.TorusGeometry(0.34, 0.05, 8, 26),
        particleMaterial: new THREE.MeshBasicMaterial(),
        ringMaterial: new THREE.MeshBasicMaterial(),
      },
      CONFIG.effects,
      false,
      () => 0.5,
    );

    effects.burst({
      position: { x: 0, y: 0, z: 0 },
      color: 0xffffff,
      count: 999,
      speed: 2,
    });
    expect(effects.activeCounts().particles).toBe(CONFIG.effects.particleCapacity);
    effects.pickupRing({ x: 0, y: 1, z: 0 });
    expect(effects.activeCounts().rings).toBe(1);
    effects.resetRun();
    expect(effects.activeCounts()).toEqual({ particles: 0, rings: 0 });
  });
});
```

- [ ] **Step 2: Run the test and confirm the effects factory is missing**

Run `node node_modules/vitest/vitest.mjs run rail-rush/effects.test.ts`.

Expected: FAIL because `./effects` does not exist.

- [ ] **Step 3: Extract both pools and their update logic**

```ts
export interface EffectAssets {
  readonly box: THREE.BoxGeometry;
  readonly ring: THREE.TorusGeometry;
  readonly particleMaterial: THREE.MeshBasicMaterial;
  readonly ringMaterial: THREE.MeshBasicMaterial;
}

export interface BurstRequest {
  readonly position: WorldPosition;
  readonly color: number;
  readonly count: number;
  readonly speed: number;
  readonly size?: number;
  readonly gravity?: number;
}

export interface EffectsSystem {
  burst(request: BurstRequest): void;
  smoke(position: WorldPosition): void;
  pickupRing(position: WorldPosition): void;
  update(dt: number): void;
  resetRun(): void;
  activeCounts(): { readonly particles: number; readonly rings: number };
  dispose(): void;
}

export function createEffects(
  scene: THREE.Scene,
  assets: EffectAssets,
  config: RailRushConfig['effects'],
  reducedMotion: boolean,
  rng: RandomSource,
): EffectsSystem;
```

Move particle velocity/life/gravity, smoke puff, ring expansion/fade, reduced-motion count reduction, and material-color assignment without changing formulas. Clone particle and ring materials only during pool preallocation. Reuse one active-count snapshot.

- [ ] **Step 4: Replace direct effect calls in `game.ts`**

Create `effects` once. Route existing landing, running dust, coin, power-up, smoke, and crash intents through it. Until Tasks 7 and 8 extract their event sources, their existing monolithic functions may call `effects` directly. Reset and update exactly where old pool resets and `updateParticles`/`updateRings` occurred.

- [ ] **Step 5: Verify tests, strict types, and Rail Rush build**

```bash
node node_modules/vitest/vitest.mjs run rail-rush/effects.test.ts
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build rail-rush --outDir /data/data/com.termux/files/usr/tmp/rail-rush-vite-build
```

Expected: effects tests PASS and both compilation checks exit 0.

- [ ] **Step 6: Commit only this task**

```bash
git add rail-rush/effects.ts rail-rush/effects.test.ts rail-rush/game.ts rail-rush/config.ts
git commit -m "refactor(rail-rush): extract pooled effects"
```

---

### Task 7: Player Motion and Runner Rig

**Files:**

- Create: `rail-rush/gameplay/player.ts`
- Create: `rail-rush/gameplay/player.test.ts`
- Modify: `rail-rush/game.ts:962-1028,1884-1892,1946-2078`
- Modify: `rail-rush/config.ts`

**Interfaces:**

- Consumes: `InputSnapshot`, `CollisionBounds`, `PlayerCameraFacts`, `PlayerEventSink`, `RenderResources`, `RandomSource`, and the gameplay/player config groups.
- Produces: `PlayerMotion`, `PlayerSystem`, `createPlayerMotion`, and `createPlayer`.

- [ ] **Step 1: Write tests against the production-used pure motion controller**

```ts
import { describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../config';
import { createPlayerMotion } from './player';

const noInput = { left: false, right: false, jump: false, slide: false };

describe('createPlayerMotion', () => {
  it('clamps lanes and completes a lane step in the configured duration', () => {
    const onLaneChange = vi.fn();
    const motion = createPlayerMotion(CONFIG.gameplay, CONFIG.player, {
      onJump: vi.fn(),
      onLand: vi.fn(),
      onRunDust: vi.fn(),
      onSlide: vi.fn(),
      onLaneChange,
    });
    motion.update(CONFIG.gameplay.laneStepTime, { ...noInput, left: true }, false);
    expect(motion.snapshot().lane).toBe(0);
    expect(motion.snapshot().x).toBeCloseTo(-2.2);
    motion.update(1, { ...noInput, left: true }, false);
    expect(motion.snapshot().lane).toBe(0);
    expect(onLaneChange).toHaveBeenCalledTimes(1);
  });

  it('supports jump boost, short hop, landing, and airborne fast-fall', () => {
    const onJump = vi.fn();
    const onLand = vi.fn();
    const motion = createPlayerMotion(CONFIG.gameplay, CONFIG.player, {
      onJump,
      onLand,
      onRunDust: vi.fn(),
      onSlide: vi.fn(),
      onLaneChange: vi.fn(),
    });
    motion.update(0, { ...noInput, jump: true }, true);
    expect(motion.snapshot().verticalVelocity).toBeCloseTo(
      CONFIG.player.jumpVelocity * CONFIG.player.highJumpMultiplier,
    );
    motion.releaseJump();
    expect(motion.snapshot().verticalVelocity).toBeLessThan(
      CONFIG.player.jumpVelocity * CONFIG.player.highJumpMultiplier,
    );
    motion.update(0, { ...noInput, slide: true }, false);
    expect(motion.snapshot().fastFall).toBe(true);
    for (let index = 0; index < 120 && !motion.snapshot().grounded; index += 1) {
      motion.update(1 / 120, noInput, false);
    }
    expect(onLand).toHaveBeenCalledTimes(1);
    expect(motion.snapshot().slideTime).toBeGreaterThan(0);
  });

  it('restores canonical state on reset', () => {
    const motion = createPlayerMotion(CONFIG.gameplay, CONFIG.player, {
      onJump: vi.fn(),
      onLand: vi.fn(),
      onRunDust: vi.fn(),
      onSlide: vi.fn(),
      onLaneChange: vi.fn(),
    });
    motion.update(0, { ...noInput, right: true, jump: true }, false);
    motion.resetRun();
    expect(motion.snapshot()).toMatchObject({
      lane: 1,
      x: 0,
      y: 0,
      grounded: true,
      slideTime: 0,
      fastFall: false,
    });
  });
});
```

- [ ] **Step 2: Run the test and confirm the player module is missing**

Run `node node_modules/vitest/vitest.mjs run rail-rush/gameplay/player.test.ts`.

Expected: FAIL because `./player` does not exist.

- [ ] **Step 3: Implement motion as a production seam**

```ts
export interface PlayerMotionSnapshot {
  readonly lane: number;
  readonly x: number;
  readonly y: number;
  readonly verticalVelocity: number;
  readonly grounded: boolean;
  readonly slideTime: number;
  readonly fastFall: boolean;
}

export interface PlayerMotion {
  resetRun(): void;
  update(dt: number, input: InputSnapshot, jumpBoostActive: boolean): void;
  releaseJump(): void;
  beginCrash(): void;
  updateCrash(dt: number): boolean;
  bounds(sweep: number): CollisionBounds;
  snapshot(): PlayerMotionSnapshot;
}

export function createPlayerMotion(
  gameplayConfig: RailRushConfig['gameplay'],
  playerConfig: RailRushConfig['player'],
  events: PlayerEventSink,
): PlayerMotion;
```

Port lane retargeting, cubic ease-out, gravity, jump buffer, jump cut, slide, fast-fall, landing roll, collision height/depth, and crash fall exactly. Reuse one snapshot and one collision-bounds object. Fire events only on transitions.

- [ ] **Step 4: Compose the rig and animation around motion**

```ts
export interface PlayerSystem {
  resetRun(): void;
  update(
    dt: number,
    input: InputSnapshot,
    runTime: number,
    speed: number,
    jumpBoostActive: boolean,
  ): void;
  releaseJump(): void;
  beginCrash(): void;
  updateCrash(dt: number): boolean;
  bounds(sweep: number): CollisionBounds;
  cameraFacts(): PlayerCameraFacts;
  setFirstPersonBlend(blend: number): void;
  dispose(): void;
}

export function createPlayer(
  scene: THREE.Scene,
  resources: RenderResources,
  config: RailRushConfig,
  rng: RandomSource,
  events: PlayerEventSink,
): PlayerSystem;
```

Move the runner hierarchy, scarf geometry/base positions, shadow setup, leg phase, dust timer, squash, bob, roll, limb animation, body lean/yaw, and crash pose into the system. `setFirstPersonBlend` performs only the existing body-visibility threshold.

- [ ] **Step 5: Wire the player event sink**

```ts
const playerEvents: PlayerEventSink = {
  onJump: () => audio.jump(),
  onLand: (position) => {
    audio.land();
    effects.burst({
      position: { x: position.x, y: 0.15, z: 0.3 },
      color: CONFIG.effects.landDust.color,
      count: CONFIG.effects.landDust.count,
      speed: CONFIG.effects.landDust.speed,
      size: CONFIG.effects.landDust.size,
      gravity: CONFIG.effects.landDust.gravity,
    });
  },
  onRunDust: (position) => {
    effects.burst({
      position,
      color: CONFIG.effects.runDust.color,
      count: 1,
      speed: CONFIG.effects.runDust.speed,
      size: CONFIG.effects.runDust.size,
      gravity: CONFIG.effects.runDust.gravity,
    });
  },
  onSlide: () => audio.slide(),
  onLaneChange: () => audio.lane(),
};
```

Add `landDust` and `runDust` value objects to `CONFIG.effects` with the current values: landing `0x8a7590, 6, 2.2, 0.7, 10`; running `0x7d6a86, 1, 1.2, 0.55, 6`.

- [ ] **Step 6: Remove direct player state access from `game.ts`**

Replace reset, input release, update, collision bounds, camera facts, body visibility, crash initialization, and over-loop corpse updates with `PlayerSystem` calls. A search for `player.` in `game.ts` may remain only for its public methods; no mesh or mutable timer property may be accessed.

- [ ] **Step 7: Verify player tests and integration**

```bash
node node_modules/vitest/vitest.mjs run rail-rush/gameplay/player.test.ts
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build rail-rush --outDir /data/data/com.termux/files/usr/tmp/rail-rush-vite-build
```

Expected: player tests PASS, TypeScript exits 0, and Rail Rush builds.

- [ ] **Step 8: Commit only this task**

```bash
git add rail-rush/gameplay/player.ts rail-rush/gameplay/player.test.ts rail-rush/types.ts rail-rush/config.ts rail-rush/game.ts
git commit -m "refactor(rail-rush): extract player system"
```

---

### Task 8: Course Generation, Advancement, and Collision

**Files:**

- Create: `rail-rush/gameplay/course.ts`
- Create: `rail-rush/gameplay/course.test.ts`
- Modify: `rail-rush/game.ts:1046-1232,1445-1511,1709-1945`
- Modify: `rail-rush/config.ts`

**Interfaces:**

- Consumes: `CollisionBounds`, `CourseEventSink`, `ObstacleKind`, `PowerupKind`, `RandomSource`, `RenderResources`, `ProceduralTextures`, and `ObjectPool`.
- Produces: `CourseSystem`, `CourseSnapshot`, `createCourse`, and `overlapsBounds`.

- [ ] **Step 1: Write deterministic course tests with a sequence RNG**

Use this complete test prelude and harness:

```ts
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CONFIG } from '../config';
import { createRenderResources } from '../render/resources';
import type { CourseEventSink, RandomSource } from '../types';
import { createCourse } from './course';

const sequenceRng = (values: readonly number[]) => {
  let index = 0;
  return () => values[index++ % values.length];
};

const createCourseHarness = (rng: RandomSource) => {
  const texture = new THREE.Texture();
  const resources = createRenderResources(
    {
      ground: texture,
      ballast: texture,
      rust: texture,
      hazard: texture,
      glow: texture,
      cloudShadow: texture,
      sky: texture,
      houseWalls: [texture, texture, texture, texture],
      towerWalls: [texture, texture, texture],
    },
    CONFIG.visual,
  );
  const events = {
    onCrash: vi.fn(),
    onCoin: vi.fn(),
    onPowerup: vi.fn(),
    onTrainHorn: vi.fn(),
    onTrainSmoke: vi.fn(),
  } satisfies CourseEventSink;
  const course = createCourse(new THREE.Scene(), resources, { glow: texture }, CONFIG, rng, events);
  return { course, events };
};
```

Use that harness for these cases:

```ts
it('creates a repeatable event with a free lane and bounded pools', () => {
  const first = createCourseHarness(sequenceRng([0.1, 0.8, 0.2, 0.6, 0.4]));
  const second = createCourseHarness(sequenceRng([0.1, 0.8, 0.2, 0.6, 0.4]));
  first.course.spawnDue(40);
  second.course.spawnDue(40);
  expect(first.course.snapshot()).toEqual(second.course.snapshot());
  const snapshot = first.course.snapshot();
  expect(new Set(snapshot.obstacles.map((item) => item.lane)).size).toBeLessThan(3);
  expect(snapshot.activeCounts.trains).toBeLessThanOrEqual(CONFIG.obstacles.kinds.train.capacity);
  expect(snapshot.activeCounts.coins).toBeLessThanOrEqual(CONFIG.collectibles.coinCapacity);
});

it('emits each collection once', () => {
  const harness = createCourseHarness(() => 0);
  harness.course.spawnDue(40);
  const coin = harness.course.snapshot().coins[0];
  expect(coin).toBeDefined();
  if (!coin) throw new Error('expected a spawned coin');
  harness.course.advance(0, -coin.z, 40, {
    magnetActive: false,
    magnetTarget: { x: coin.x, y: 0 },
  });
  const bounds = {
    x: coin.x,
    halfWidth: 0.42,
    yMin: 0,
    yMax: 1.75,
    halfDepth: 0.5,
  };
  harness.course.checkCollisions(bounds);
  harness.course.checkCollisions(bounds);
  expect(harness.events.onCoin).toHaveBeenCalledTimes(1);
});

it('reports an obstacle collision', () => {
  const harness = createCourseHarness(() => 0);
  harness.course.spawnDue(40);
  const obstacle = harness.course.snapshot().obstacles[0];
  expect(obstacle).toBeDefined();
  if (!obstacle) throw new Error('expected a spawned obstacle');
  harness.course.advance(0, -obstacle.z, 40, {
    magnetActive: false,
    magnetTarget: { x: CONFIG.gameplay.lanes[obstacle.lane], y: 0 },
  });
  harness.course.checkCollisions({
    x: CONFIG.gameplay.lanes[obstacle.lane],
    halfWidth: 1,
    yMin: 0,
    yMax: 3,
    halfDepth: 1,
  });
  expect(harness.events.onCrash).toHaveBeenCalledTimes(1);
});

it('reports the exact spawned power-up kind once', () => {
  const harness = createCourseHarness(() => 0);
  harness.course.spawnDue(40);
  const powerup = harness.course.snapshot().powerups[0];
  expect(powerup).toBeDefined();
  if (!powerup) throw new Error('expected a spawned power-up');
  harness.course.advance(0, -powerup.z, 40, {
    magnetActive: false,
    magnetTarget: { x: CONFIG.gameplay.lanes[powerup.lane], y: 0 },
  });
  const bounds = {
    x: CONFIG.gameplay.lanes[powerup.lane],
    halfWidth: 0.42,
    yMin: 0,
    yMax: 1.75,
    halfDepth: 0.5,
  };
  harness.course.checkCollisions(bounds);
  harness.course.checkCollisions(bounds);
  expect(harness.events.onPowerup).toHaveBeenCalledTimes(1);
  expect(harness.events.onPowerup).toHaveBeenCalledWith(
    powerup.kind,
    expect.objectContaining({ x: bounds.x }),
  );
});

it('reset clears active objects and restores the first event distance', () => {
  const harness = createCourseHarness(() => 0.25);
  harness.course.spawnDue(40);
  harness.course.resetRun();
  expect(harness.course.snapshot()).toMatchObject({
    nextEventDistance: 40,
    activeCounts: {
      trains: 0,
      crates: 0,
      lowBarriers: 0,
      highBarriers: 0,
      coins: 0,
      powerups: 0,
    },
  });
});
```

- [ ] **Step 2: Run the tests and confirm the course module is missing**

Run `node node_modules/vitest/vitest.mjs run rail-rush/gameplay/course.test.ts`.

Expected: FAIL because `./course` does not exist.

- [ ] **Step 3: Extract course object construction and state**

Move train, crate, low barrier, high barrier, coin instancing/state, and power-up construction into `course.ts`. Preserve hitboxes, spans, capacities, train wheel/sway/smoke data, livery selection, coin-facing matrices, and power-up animation. Type object `userData` through local intersections rather than exposing it.

```ts
export function overlapsBounds(
  objectPosition: WorldPosition,
  hit: ObjectHitBounds,
  player: CollisionBounds,
): boolean;
```

- [ ] **Step 4: Extract scheduler, advancement, and event reporting**

```ts
export interface CourseAdvanceContext {
  readonly magnetActive: boolean;
  readonly magnetTarget: { readonly x: number; readonly y: number };
}

export interface CourseSnapshot {
  readonly nextEventDistance: number;
  readonly obstacles: readonly {
    readonly kind: ObstacleKind;
    readonly lane: number;
    readonly z: number;
  }[];
  readonly coins: readonly {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }[];
  readonly powerups: readonly {
    readonly kind: PowerupKind;
    readonly lane: number;
    readonly z: number;
  }[];
  readonly activeCounts: {
    readonly trains: number;
    readonly crates: number;
    readonly lowBarriers: number;
    readonly highBarriers: number;
    readonly coins: number;
    readonly powerups: number;
  };
}

export interface CourseSystem {
  resetRun(): void;
  advance(dt: number, deltaZ: number, travel: number, context: CourseAdvanceContext): void;
  spawnDue(travel: number): void;
  checkCollisions(player: CollisionBounds): boolean;
  drawCoins(timeSeconds: number): void;
  snapshot(): CourseSnapshot;
  dispose(): void;
}

export function createCourse(
  scene: THREE.Scene,
  resources: RenderResources,
  textures: Pick<ProceduralTextures, 'glow'>,
  config: RailRushConfig,
  rng: RandomSource,
  events: CourseEventSink,
): CourseSystem;
```

Keep `nextEventDistance` at 40, lane-busy reset at `[0, 0, 0]`, the current shuffled-lane/free-lane algorithm, weighted obstacle choice, coin-line placement, and power-up chance. `checkCollisions` releases collected objects before firing events, stops after the first obstacle crash, and never changes score, timers, audio, UI, effects, or player state. Build snapshot arrays only when `snapshot()` is called; they are diagnostic/test allocations, never frame-loop allocations.

- [ ] **Step 5: Wire a stable course event sink in `game.ts`**

```ts
const courseEvents: CourseEventSink = {
  onCrash: gameOver,
  onCoin: (position) => {
    runtime.coins += 1;
    runtime.score += CONFIG.gameplay.coinScore;
    audio.coin();
    if (firstPersonBlend < CONFIG.effects.hidePickupEffectsBlend) {
      effects.pickupRing(position);
      effects.burst({
        position,
        ...CONFIG.effects.coinBurst,
      });
    }
  },
  onPowerup: (kind, position) => {
    if (kind === 'magnet') {
      runtime.magnetTime = CONFIG.collectibles.magnetDuration;
      effects.burst({ position, ...CONFIG.effects.magnetBurst });
    } else {
      runtime.jumpBoostTime = CONFIG.collectibles.highJumpDuration;
      effects.burst({ position, ...CONFIG.effects.shoesBurst });
    }
    audio.power();
  },
  onTrainHorn: () => audio.horn(),
  onTrainSmoke: (position) => effects.smoke(position),
};
```

Add plain-value `coinBurst`, `magnetBurst`, and `shoesBurst` objects to `CONFIG.effects`; configuration contains no functions. Copy the current colors, counts, speed, size, and gravity from `checkCollisions`.

- [ ] **Step 6: Preserve the frame order at the composition boundary**

Within the running loop use:

```ts
runtime.runTime += dt;
runtime.speed = nextSpeed(runtime.runTime);
const deltaZ = runtime.speed * dt;
runtime.distance += deltaZ;
runtime.score += deltaZ * CONFIG.gameplay.scorePerUnit;
runtime.lastDeltaZ = deltaZ;

const environmentFrame = environment.advance(dt, deltaZ, runtime.distance);
course.advance(dt, deltaZ, runtime.distance, {
  magnetActive: runtime.magnetTime > 0,
  magnetTarget: player.cameraFacts(),
});
course.spawnDue(runtime.distance);
environment.spawnDue(runtime.distance);
player.update(dt, input.consume(), runtime.runTime, runtime.speed, runtime.jumpBoostTime > 0);
course.checkCollisions(player.bounds(deltaZ * CONFIG.obstacles.trainSpeedMultiplier));
updatePowerupTimers(dt);
effects.update(dt);
environment.updateStreaks(dt, runtime.speed);
const cameraUpdate = renderContext.updateCamera(createCameraFrame(environmentFrame));
firstPersonBlend = cameraUpdate.firstPersonBlend;
runtime.shakeTime = cameraUpdate.shakeTime;
player.setFirstPersonBlend(firstPersonBlend);
course.drawCoins(now / 1000);
renderContext.render();
ui.updateHud(Math.floor(runtime.score), runtime.coins);
```

`createCameraFrame` returns one reused object. Keep collision after player update and before effects/camera updates. Keep course spawning before set-piece scheduling so coincident schedules consume RNG in the same order as the current implementation.

- [ ] **Step 7: Verify course and all focused tests**

```bash
node node_modules/vitest/vitest.mjs run rail-rush/config.test.ts rail-rush/core rail-rush/adapters rail-rush/render rail-rush/world rail-rush/effects.test.ts rail-rush/gameplay
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build rail-rush --outDir /data/data/com.termux/files/usr/tmp/rail-rush-vite-build
```

Expected: all Rail Rush tests PASS, TypeScript exits 0, and the focused build succeeds.

- [ ] **Step 8: Commit only this task**

```bash
git add rail-rush/gameplay/course.ts rail-rush/gameplay/course.test.ts rail-rush/types.ts rail-rush/config.ts rail-rush/game.ts
git commit -m "refactor(rail-rush): extract course system"
```

---

### Task 9: Thin Composition Root, Documentation, and Final Verification

**Files:**

- Modify: `rail-rush/game.ts`
- Modify: `rail-rush/README.md`

**Interfaces:**

- Consumes: every factory and interface established in Tasks 1–8.
- Produces: the final browser entry with one lifecycle controller, one running loop, one game-over loop, and explicit teardown.

- [ ] **Step 1: Reduce `game.ts` to composition and run orchestration**

Keep only:

- boot error handlers and reduced-motion detection;
- construction of UI, audio, render context, textures, resources, effects, environment, player, course, and input in dependency order;
- one `GameRuntimeState` value and named `startRun`, `togglePause`, `gameOver`, `haltWithError`, and power-timer helpers;
- the running and game-over animation loops;
- visibility pause, adapter button binding, ready-screen handoff, and ambient initial render;
- one teardown function that disposes listeners, timers, systems, resources, and renderer for future navigation use.

No geometry, material, procedural drawing, DOM lookup, oscillator, player physics, spawn algorithm, collision loop, or scene-object pool may remain in `game.ts`. Aim for 250–350 lines; if it exceeds 350, remove leaked subsystem logic instead of adding pass-through files.

- [ ] **Step 2: Audit dependency direction and duplicate ownership**

```bash
rg -n "from ['\"][^'\"]*game(?:\\.ts)?['\"]" rail-rush --glob '*.ts'
rg -n "requestAnimationFrame" rail-rush --glob '*.ts'
rg -n "new (THREE\\.)?(WebGLRenderer|AudioContext)" rail-rush --glob '*.ts'
rg -n "const CONFIG|class Pool|localStorage\\." rail-rush --glob '*.ts'
wc -l rail-rush/game.ts
```

Expected:

- no lower-module import of `game.ts`;
- `requestAnimationFrame` appears only in `game.ts`;
- renderer construction appears only in `render/context.ts` and audio-context construction only in `adapters/audio.ts`;
- `const CONFIG` appears only in `config.ts`, the local `Pool` class is absent, and storage access is confined to helpers/composition;
- `game.ts` is approximately 250–350 lines.

- [ ] **Step 3: Update README configuration and architecture guidance**

Replace the old implication that tunables live in `game.ts` with:

```md
## Advanced configuration

All gameplay, pool, camera, rendering, world, effects, audio, visual, and
persistence tuning lives in `config.ts`. Values are grouped by domain and
checked by `config.test.ts`; edit that object instead of searching the
runtime modules for constants.

## Runtime modules

`game.ts` composes the application and owns lifecycle/frame order.
`gameplay/` owns runner and course rules, `world/` owns the environment,
`render/` owns Three.js foundations, `adapters/` owns browser I/O,
`effects.ts` owns pooled effects, and `core/` contains shared pure utilities.
```

Keep existing controls and gameplay descriptions intact. Do not copy the React/R3F architecture from `railrush.md` into the README.

- [ ] **Step 4: Format only refactored code and documentation**

```bash
node node_modules/prettier/bin/prettier.cjs --write rail-rush/config.ts rail-rush/config.test.ts rail-rush/types.ts rail-rush/core rail-rush/adapters rail-rush/render rail-rush/world rail-rush/gameplay rail-rush/effects.ts rail-rush/effects.test.ts rail-rush/game.ts rail-rush/README.md
```

Expected: Prettier changes only the explicitly listed files. Inspect `git status --short` immediately and confirm `rail-rush/railrush.md` remains untracked and unstaged.

- [ ] **Step 5: Run the full automated verification matrix**

```bash
node node_modules/vitest/vitest.mjs run rail-rush
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build rail-rush --outDir /data/data/com.termux/files/usr/tmp/rail-rush-vite-build
node node_modules/vite/bin/vite.js build
node node_modules/prettier/bin/prettier.cjs --check rail-rush/config.ts rail-rush/config.test.ts rail-rush/types.ts rail-rush/core rail-rush/adapters rail-rush/render rail-rush/world rail-rush/gameplay rail-rush/effects.ts rail-rush/effects.test.ts rail-rush/game.ts rail-rush/README.md
git diff --check
```

Expected: tests, strict TypeScript, focused build, root multi-page build, Prettier check, and whitespace check all exit 0.

Run repository lint as a diagnostic:

```bash
npm run lint
```

Expected on a complete dependency installation: exit 0. If it fails only because the existing `node_modules/@typescript-eslint/type-utils` package is incomplete, record that pre-existing environment blocker verbatim; do not add dependencies or modify package metadata as part of this refactor.

- [ ] **Step 6: Perform a browser smoke test**

Start the existing dev server:

```bash
npm run dev -- --host 127.0.0.1
```

Open `/rail-rush/` and verify:

1. boot screen shows “Ready on platform 3” and build `scenery-6`;
2. Start, keyboard/touch movement, jump, short-hop, slide, fast-fall, pause/resume, mute, and restart work;
3. trains, barriers, coins, both power-ups, scenery, tunnels, first-person transition, particles, music, and sound cues still appear;
4. score, coin total, best score, game-over screen, resize, visibility pause, and context-loss message retain their current presentation;
5. repeated restart does not duplicate scene objects, listeners, audio music timers, or animation loops.

This is a manual smoke test; do not describe it as automated browser coverage.

- [ ] **Step 7: Confirm the user-owned file and unrelated work remain untouched**

```bash
git diff -- rail-rush/railrush.md
git diff --cached -- rail-rush/railrush.md
git status --short
```

Expected: both diffs for `railrush.md` are empty; status still shows it only as the user's untracked file, and all other changes belong to this plan.

- [ ] **Step 8: Commit the final composition and documentation**

```bash
git add rail-rush/game.ts rail-rush/README.md rail-rush/config.ts rail-rush/types.ts rail-rush/core rail-rush/adapters rail-rush/render rail-rush/world rail-rush/gameplay rail-rush/effects.ts rail-rush/effects.test.ts
git commit -m "refactor(rail-rush): compose modular game runtime"
```

- [ ] **Step 9: Record final evidence**

```bash
git status --short
git log --oneline -10
```

Report the exact passing commands, the lint outcome, `game.ts` line count, the manual-smoke-test status, and confirmation that `railrush.md` was neither changed nor committed.
