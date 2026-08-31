# Rail Rush Modularization Design

**Date:** 2026-08-31
**Status:** Approved in conversation
**Scope:** Structural refactor of the existing Three.js TypeScript game

## Context

Rail Rush currently ships as a working Vite multi-page entry. Most of the implementation lives in
`game.ts`, which combines configuration, browser adapters, Three.js setup, procedural textures,
world construction, player behavior, course generation, collisions, effects, lifecycle, and the
frame loop in one 2,205-line module. `scenery.ts` is the only substantial behavior already split
out.

`railrush.md` describes a broader React Three Fiber and Zustand product architecture. This refactor
uses its responsibility map as design input, but the user explicitly chose not to migrate stacks.
The existing direct Three.js implementation, static HTML, CSS, gameplay, visuals, controls, storage
key, and Vite integration remain in place.

## Goals

1. Replace the single large entry implementation with focused, deep modules.
2. Keep `game.ts` as the only composition root, lifecycle owner, and frame-loop owner.
3. Centralize advanced gameplay, rendering, world, effects, audio, and persistence tuning in one
   typed `config.ts` object.
4. Keep dependencies one-directional so no module imports `game.ts` and circular imports do not
   emerge.
5. Preserve observable behavior while making pure or locally substitutable behavior testable.
6. Add tests around the new interfaces and keep the existing production build path working.

## Non-goals

- Migrating to React, React Three Fiber, Drei, Zustand, or Tailwind.
- Adding a GLB player, hoverboard, multiplier system, track chunks, ramps, or other features from
  `railrush.md` that do not exist in the current game.
- Changing gameplay balance, visual identity, DOM IDs, controls, URL paths, copy, or audio design.
- Fixing the previously identified texture-wrap, scheduler, context-loss, documentation, or
  accessibility findings as part of this structural change.
- Adding runtime dependencies or external assets.
- Modifying `railrush.md`.

## Architecture

```text
rail-rush/
├── config.ts
├── types.ts
├── core/
│   ├── helpers.ts
│   └── pool.ts
├── adapters/
│   ├── audio.ts
│   ├── input.ts
│   └── ui.ts
├── render/
│   ├── context.ts
│   ├── textures.ts
│   └── resources.ts
├── world/
│   ├── environment.ts
│   └── scenery.ts
├── gameplay/
│   ├── player.ts
│   └── course.ts
├── effects.ts
├── game.ts
├── index.html
└── style.css
```

The dependency direction is:

```text
config/types
    ↓
core + adapters + render foundations
    ↓
effects + player + environment + course
    ↓
game.ts composition root
```

`game.ts` may import any lower module. Lower modules must not import `game.ts`, its runtime state,
or one another through the composition root. Cross-module work is expressed through typed inputs,
returned events, or deliberately injected callbacks.

## Module Responsibilities and Interfaces

### `config.ts`

Exports `CONFIG`, typed with `RailRushConfig`. It contains values intended for balancing, device
tuning, visual tuning, pool capacity, spawn behavior, collision dimensions, camera behavior,
effects, audio, and persistence.

The top-level groups are:

```ts
export interface RailRushConfig {
  gameplay: GameplayConfig;
  player: PlayerConfig;
  obstacles: ObstacleConfig;
  collectibles: CollectibleConfig;
  renderer: RendererConfig;
  camera: CameraConfig;
  world: WorldConfig;
  effects: EffectsConfig;
  audio: AudioConfig;
  visual: VisualConfig;
  persistence: PersistenceConfig;
}
```

The initial values are copied exactly from the current implementation. Model-local construction
instructions that are not meaningful tuning controls may remain beside their factory, but all
values affecting behavior, counts, timing, hitboxes, spacing, colors, texture sizes, quality, or
device cost belong in `CONFIG`.

### `types.ts`

Contains shared contracts only: `RunState`, semantic `InputAction`, collision bounds and events,
power-up and obstacle kinds, RNG function type, and the narrow interfaces returned by factories.
It contains no runtime initialization.

### `core/helpers.ts`

Owns pure math and selection helpers such as `clamp`, `damp`, `pick`, `randInt`, and
`weightedPick`, plus safe local-storage parsing helpers. Random helpers accept an injected
`RandomSource` where deterministic behavior is useful; production passes `Math.random`.

### `core/pool.ts`

Owns the bounded Three.js object pool. Its external interface is:

```ts
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
): ObjectPool<T>;
```

The implementation continues to use bounded preallocation and the existing active/visible
semantics. Callers do not create pooled objects during a run.

### `adapters/audio.ts`

Owns `AudioContext`, oscillator effects, mute state, and the optional music interval. It exports
`createAudio(config)` and returns the existing sound methods plus `ensure`, `setMuted`,
`syncMusic`, and `dispose`. Game rules do not import Web Audio directly.

### `adapters/input.ts`

Registers keyboard and touch listeners once. It normalizes browser events into edge-triggered
semantic actions and exposes:

```ts
export interface InputAdapter {
  consume(): InputSnapshot;
  dispose(): void;
}
```

Lifecycle-specific decisions such as starting or pausing remain in `game.ts`; the adapter receives
callbacks for start, pause, and jump-release behavior where immediate browser-event timing is
required. Existing keys, swipe thresholds, dominant-axis behavior, and UI-touch exclusion remain
unchanged.

### `adapters/ui.ts`

Performs required DOM lookup once and owns all screen and HUD mutations. Its interface presents
intent-level operations such as `showReady`, `showRunning`, `showPaused`, `showGameOver`,
`showBootError`, `showRuntimeError`, `updateHud`, and `updatePower`. Static HTML IDs and copy remain
unchanged. Button wiring is exposed to the composition root rather than importing game state.

### `render/context.ts`

Creates and owns the renderer, scene, camera, fog, global lights, resize handling, and WebGL
context-loss listener registration. It returns a `RenderContext` and `dispose`. The existing WebGL
settings, tone mapping, shadows, pixel-ratio cap, FOV behavior, and context-loss presentation are
preserved.

### `render/textures.ts`

Contains the procedural canvas texture implementation: terrain, ground, ballast, hazard, glow,
cloud shadow, sky gradients, and pebble drawing. It receives renderer capabilities and visual
configuration. The present texture-wrap behavior is moved without correction so this refactor
does not mix a visual change into structural verification.

### `render/resources.ts`

Creates shared geometries, materials, palettes, and reusable texture-backed resources. It exposes
one `RenderResources` object consumed by player, course, effects, and world factories. Resources
are constructed once during boot and are never recreated per frame.

### `world/environment.ts`

Owns static ground and rails, sky, sun, stars, sleepers, cloud layers, trackside treadmills,
gantries, tumbleweeds, towers, tunnels, set-piece scheduling, tunnel first-person-zone state, and
wind streaks. It composes `createScenery` from `world/scenery.ts` and returns:

```ts
export interface EnvironmentSystem {
  resetRun(): void;
  advance(dt: number, dz: number, travel: number): EnvironmentFrame;
  updateStreaks(dt: number, speed: number): void;
}
```

`EnvironmentFrame` reports tunnel-entry and first-person-camera facts instead of directly changing
audio or camera state.

### `world/scenery.ts`

Moves the existing `scenery.ts` implementation under `world/` while retaining its deep interface:
`createScenery(scene, config, resources): { advance(dz): void }`. House, ruko, and skyline details
remain internal.

### `effects.ts`

Owns the bounded particle and pickup-ring pools. It provides intent-level methods for coin pickup,
landing dust, train smoke, power-up pickup, crash bursts, and per-frame update. Reduced-motion
counts and all pool/lifetime values come from `CONFIG`.

### `gameplay/player.ts`

Owns player rig construction, player motion state, lane interpolation, jump/slide/fast-fall rules,
landing detection, collision bounds, body animation, scarf deformation, crash pose, and reset.
It accepts semantic input and returns player events such as `jumped`, `landed`, `slid`, and
`laneChanged`; `game.ts` maps those events to audio and effects.

Its interface does not expose individual limb meshes or mutable internal timing fields. It exposes
the current collision bounds and camera facts required by other systems.

### `gameplay/course.ts`

Owns trains, crates, low/high barriers, coins, power-ups, obstacle pools, spawn scheduling,
per-lane busy tracking, coin rendering, obstacle advancement, and collision checks. It receives an
injectable RNG and returns collision/collection events instead of mutating score, HUD, audio, or
player state directly.

The course module preserves the current generation algorithm and numeric behavior. Its interface
is the test surface for reset, bounded pools, deterministic spawning, obstacle collision, coin
collection, and power-up collection.

### `game.ts`

Remains the Vite entry and composition root. It:

1. creates UI, audio, render context, resources, effects, environment, player, course, and input;
2. owns the canonical `GameRuntimeState` and allowed lifecycle transitions;
3. owns the sole requestAnimationFrame loop;
4. advances systems in the existing order;
5. translates returned events into score, timers, audio, effects, camera, and UI updates;
6. owns pause, visibility, start, restart, game-over, and fatal-error orchestration; and
7. performs the final render.

The target size is approximately 250–350 lines. This is a guidance limit rather than an excuse to
create shallow pass-through modules.

## Frame Data Flow

For every running frame, `game.ts` preserves the current sequence:

1. Clamp delta time and update run time and speed.
2. Advance world distance, environment, course objects, and set pieces.
3. Spawn course events due at the new travel distance.
4. Consume semantic input and update the player.
5. Check obstacle, coin, and power-up collision against current player bounds.
6. Apply returned events to runtime state, audio, UI, and effects.
7. Update particles, pickup rings, streaks, camera, and instanced coin matrices.
8. Render the scene and update displayed HUD values.

This order is a compatibility invariant because input timing, swept collision, score, and visual
effects depend on it.

## State Ownership

`game.ts` owns run-level state: lifecycle, speed, distance, score, coins, run time, active power-up
timers, camera shake, best score, and frame timestamps. Player motion belongs to `player.ts`.
Active course objects and spawn state belong to `course.ts`. Environment scheduling belongs to
`environment.ts`. Effect lifetimes belong to `effects.ts`.

No state field has two authoritative owners. UI displays snapshots and never becomes an authority.

## Error Handling and Cleanup

- Factory failures during boot are surfaced through the existing boot error UI.
- Runtime update or render failures are caught by the composition root and surfaced through the
  existing runtime error UI.
- Storage access remains guarded and invalid values fall back safely.
- Input, resize, visibility, context-loss, and audio interval registrations receive explicit
  cleanup methods even though the page normally lives until navigation.
- Repeated starts and restarts reuse the same systems, listeners, scene objects, and pools.
- Pool exhaustion continues to drop optional content or effects rather than allocate during play.

## Testing Strategy

Tests use Vitest's Node environment and cross module interfaces rather than renderer internals.

1. `config.test.ts` verifies lane values, positive timing/capacity values, obstacle weight total,
   spawn/despawn ordering, and unchanged persistence key.
2. `core/pool.test.ts` verifies fixed capacity, acquire/release reuse, reset, visibility, and active
   iteration.
3. `gameplay/player.test.ts` verifies lane clamping, fixed-duration lane movement, jump/landing,
   short-hop input effects, slide duration, airborne fast-fall, and reset through the player
   interface with in-memory audio/effect observers where required.
4. `gameplay/course.test.ts` uses a seeded RNG to verify repeatable layouts, one free lane per
   generated event, bounded object counts, single coin collection, power-up events, collision
   events, and reset.
5. Existing strict TypeScript validation checks every new interface and import direction.
6. A Rail-Rush-only Vite production build verifies HTML, CSS, TypeScript, Three.js imports, and the
   final browser bundle.
7. The root multi-page production build verifies integration with the Arcade Hub deployment.

Rendering appearance, browser gesture feel, Web Audio, and WebGL context behavior remain manual
smoke-test concerns because the repository has no browser automation dependency. The refactor
must not claim those behaviors are verified solely from Node tests.

## Migration Strategy

The migration is incremental and keeps `game.ts` buildable after each coherent extraction:

1. Introduce types, centralized configuration, pure helpers, and pool tests.
2. Extract browser adapters.
3. Extract textures, resources, and render context.
4. Move scenery and extract the environment system.
5. Extract effects.
6. Extract player behavior behind its interface.
7. Extract course generation and collision behind its interface.
8. Reduce `game.ts` to composition and orchestration.
9. Update README architecture notes and verify all quality gates.

No compatibility shim is retained after a module has moved; callers switch to the new interface in
the same coherent change so duplicate authoritative implementations do not remain.

## Acceptance Criteria

- `game.ts` is the only frame-loop and run-lifecycle owner and is approximately 250–350 lines.
- No lower module imports `game.ts`.
- Advanced tuning is exported from one typed `CONFIG` object.
- Existing controls, game states, score rules, power-ups, audio, visuals, camera, storage key, DOM
  IDs, and build URL remain unchanged.
- Object pools remain bounded and no new per-frame geometry/material allocation is introduced.
- New tests for configuration, pooling, player behavior, and course behavior pass.
- Strict TypeScript passes.
- Rail-Rush-only Vite production build passes.
- Root multi-page production build passes.
- `railrush.md` remains unmodified.
- The worktree contains no unrelated modifications.

## Risks and Mitigations

- **Initialization-order regression:** factories are created explicitly in dependency order from
  `game.ts`; no module relies on another module's top-level side effects.
- **Circular imports:** dependency direction is enforced by design and reviewed with import search.
- **Frame-order behavior drift:** the current update order is documented above and retained as a
  compatibility invariant.
- **Excessive interface surface:** systems return intent-level operations and events rather than
  exposing mutable meshes and timers.
- **Configuration becoming another large miscellaneous file:** fields are grouped by domain and
  typed; only tunable values belong there, not procedural implementation.
- **Refactor hiding bug fixes:** known behavior changes remain explicitly out of scope and can be
  handled as separate, test-first changes after modularization.
