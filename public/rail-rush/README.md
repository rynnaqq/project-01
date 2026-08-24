# Rail Rush

A 3-lane, 3D endless runner for the browser — low-poly railway world built
with Three.js (loaded from a CDN import map), zero external assets, zero build
step. Part of the Arcade Hub family.

## Run it

Everything lives in this folder and is served as plain static files:

- Dev: `npm run dev` (repo root) then open `http://localhost:5173/rail-rush/`
- Prod: `npm run build` — Vite copies this folder to `dist/rail-rush/`;
  the Cloudflare Workers asset handler serves it at `/rail-rush/`
- Or open `index.html` directly from any static file server

> Three.js loads from `cdn.jsdelivr.net`, so the first load needs internet.
> After that the module is HTTP-cached.

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

- You auto-run down three lanes; speed ramps from 11 to 30 units/s
- Obstacles: oncoming **trains** (change lane), **crates** (jump or dodge),
  **low barriers** (jump), **overhead barriers** (slide only)
- Every event guarantees at least one free lane; coins trail down it
- Coins = +10 score each; score also ticks up with distance travelled
- Power-ups: **magnet** (pink ring) pulls nearby coins for 8s;
  **high-jump shoes** (cyan crystal) raise your jump for 8s — enough to clear
  overhead barriers with a well-timed jump
- Crash = run over. Best score persists in `localStorage` (`railrush.best`)

## Tuning

Every gameplay number sits in the `CONFIG` object at the top of `game.js`:

| Key | Default | Effect |
|---|---|---|
| `baseSpeed` / `maxSpeed` | 11 / 30 | start/top world speed |
| `speedRamp` | 0.22 | units/s added per second survived |
| `gravity` / `jumpVelocity` | 34 / 12.2 | jump arc height & feel |
| `highJumpMultiplier` | 1.32 | power-up jump boost |
| `slideDuration` | 0.62 s | how long a slide hitbox stays low |
| `laneShiftSpeed` | 12 | lane-change snappiness |
| `chunkGapMin` / `chunkGapMax` | 9 / 17 | distance between obstacle events |
| `coinLineLength` | 6 | coins per free lane |
| `powerupChance` | 0.16 | chance an event drops a power-up |
| `coinMagnetRadius` | 4.5 | magnet pull range (world units) |
| `scorePerUnit` / `coinScore` | 0.6 / 10 | scoring rates |

Edit, save, refresh — no bundler involved.

## Architecture notes

- Single ES module (`game.js`); Three.js resolved via the import map in
  `index.html`
- Fixed object pools for trains/barriers/crates/power-ups/particles;
  coins and sleepers are `InstancedMesh` (one draw call each)
- Collision is per-type AABB vs the player's pose (sliding shrinks the box,
  jumping raises it)
- `requestAnimationFrame` loop with dt-clamped physics; auto-pauses when the
  tab hides; handles WebGL context loss with an in-page notice
- Honors `prefers-reduced-motion`: crash shake off, particle counts halved
- Responsive: portrait phones widen the camera FOV; tested at 360×640 and
  1920×1080

## Integration

The hub links here from a banner on its home page (`src/pages/HomePage.tsx`),
opening `/rail-rush/` in a new tab. The game is fully standalone — it shares
nothing with the React bundle, so it can never break the hub (and vice versa).
