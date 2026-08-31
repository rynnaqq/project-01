# Rail Rush

A 3-lane, 3D endless runner for the browser — low-poly railway world built
with Three.js (bundled locally via Vite), zero external assets. Part of the
Arcade Hub family.

## Run it

Everything lives in this folder and is compiled by the repo's Vite build
(multi-page entry):

- Dev: `npm run dev` (repo root) then open `http://localhost:5173/rail-rush/`
- Prod: `npm run build` — Vite bundles this folder to `dist/rail-rush/`;
  the Cloudflare Workers asset handler serves it at `/rail-rush/`

> Fully offline: Three.js is installed from npm and bundled — no CDN at
> runtime.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Switch lane | `←` / `→` or `A` / `D` | swipe left / right |
| Jump | `↑`, `Space`, or `W` | tap or swipe up |
| Slide | `↓` or `S` | swipe down |
| Start / restart | `Enter` (or the buttons) | tap the button |
| Pause | `P` / `Esc` / HUD button | HUD button |

Audio: SFX are on after your first interaction (browser autoplay policy).
The HUD speaker button mutes; **double-tap it** to toggle the background bass
loop. Music starts off.

## Gameplay rules

- You auto-run down three lanes at desert dusk; speed ramps from 11 to 30 units/s
- Obstacles: oncoming **trains** (change lane — they close ~35% faster than the
  world scroll, horn warns you), **crates** (jump or dodge),
  **low barriers** (jump), **overhead barriers** (slide only)
- Every event guarantees at least one untouched lane; coins trail down it
- Coins = +10 score each; score also ticks up with distance travelled
- Power-ups: **magnet** (pink ring) pulls nearby coins for 8s;
  **high-jump shoes** (cyan crystal) raise your jump for 8s — enough to clear
  overhead barriers and even train roofs with a well-timed jump
- Jump inputs pressed up to 90ms before landing are buffered; a fast-fall
  lands into a short roll; jumping cancels a slide
- Keyboard jump is height-variable: hold for a full arc, release early for a
  short hop (touch taps always jump full)
- Runs start with a brief acceleration burst; lane changes are crisp
  fixed-duration steps
- Scenery set-pieces pass by on a distance scheduler: arched **tunnels**
  (decorative, no collision) and rusty **water towers** beside the track;
  watch for gantries dipping out of view inside tunnels
- Crash = run over. Best score persists in `localStorage` (`railrush.best`)

## Tuning

Every gameplay number sits in the `CONFIG` object in `config.ts` (camera,
scenery scheduling, streaks, and pool sizes are there too):

| Key | Default | Effect |
|---|---|---|
| `baseSpeed` / `maxSpeed` | 11 / 30 | start/top world speed |
| `speedRamp` | 0.22 | units/s added per second survived |
| `gravity` / `jumpVelocity` | 34 / 12.2 | jump arc height & feel |
| `highJumpMultiplier` | 1.32 | power-up jump boost |
| `slideDuration` | 0.62 s | how long the slide roll lasts |
| `laneStepTime` | 0.17 s | fixed-duration lane change (cubic ease-out) |
| `startBoostTime` | 0.8 s | acceleration burst length at run start |
| `trainSpeedMult` | 1.35 | how much faster trains close than the world scroll |
| `trainSpawnZ` | -120 | trains spawn deeper to compensate for their speed |
| `jumpBufferTime` | 0.09 s | early jump press still fires on landing |
| `autoSlideAfterFastFall` | 0.32 s | roll after landing from an airborne fast-fall |
| `chunkGapMin` / `chunkGapMax` | 9 / 17 | distance between obstacle events |
| `coinLineLength` | 6 | coins per free lane |
| `powerupChance` | 0.16 | chance an event drops a power-up |
| `coinMagnetRadius` | 4.5 | magnet pull range (world units) |
| `scorePerUnit` / `coinScore` | 0.6 / 10 | scoring rates |

Edit, save — Vite HMR reloads instantly in dev.

## Architecture notes

- Five TypeScript modules, strict-checked by `tsc -b`: `config.ts` (every
  tunable — gameplay, visuals, camera, audio, persistence), `textures.ts`
  (procedural canvas painters), `assets.ts` (shared geometry/materials),
  `world.ts` (sky, static track, treadmill scenery, sleepers, streaks), and
  `game.ts` (player, pools, spawning, collisions, audio, loop — the
  composition root). `scenery.ts` (buildings) unchanged
- Three.js imported statically from npm and bundled with the game
- Fixed object pools for trains/barriers/crates/power-ups/particles;
  coins and sleepers are `InstancedMesh` (one draw call each); wind streaks
  too. Scenery (mountains ×2 parallax layers, clouds, cacti, poles, catenary
  gantries) runs on spacing-based treadmills that wrap behind the camera
- All textures are procedural canvases: sky gradient, art-directed ground
  (angular tone zones, wind ripples, gravel highlights, cracks), ballast with
  lit/shaded pebbles, hazard stripes, headlight glow, tower rust — zero asset
  files
- ACES filmic tone mapping (exposure 1.2) with retuned light intensities;
  stars, drifting clouds and two parallax mountain layers dress the dusk sky
- Character juice: vertex-waved scarf, run dust, landing squash, forward-roll
  slide, body yaw on lane steps; coins pop an expanding pickup ring
- Trains carry an additive headlight pool on the ballast; tunnels are
  half-torus vaults from a 2-item pool, water towers from a 3-item pool,
  spawned by a distance scheduler — gantries hide while inside a tunnel
- Real-time shadows: one 1024px PCFSoft directional "sun" with a tight
  frustum around the playfield; ground/ballast/sleepers receive
- Camera is fully locked laterally — the world streams past a fixed frame
  while only the runner crosses lanes; scrolling dirt patches and drifting
  cloud shadows reinforce the motion
- Collision is swept AABB vs the player's pose (the player box widens along z
  by the frame's travel, so thin obstacles can't tunnel at low fps; trains
  widen it further by their speed multiplier)
- The spawner tracks per-lane busy-until distance so a lane still occupied by
  a long train is never re-blocked, and every event leaves at least one lane
  untouched
- `requestAnimationFrame` loop with dt-clamped physics; auto-pauses when the
  tab hides; handles WebGL context loss with an in-page notice
- Honors `prefers-reduced-motion`: crash shake/flash off, particle counts
  halved
- Responsive: portrait phones widen the camera FOV; tested at 360×640 and
  1920×1080

## Integration

The hub links here from a banner on its home page (`src/pages/HomePage.tsx`),
opening `/rail-rush/` in a new tab. The game is fully standalone — it shares
nothing with the React bundle, so it can never break the hub (and vice versa).
