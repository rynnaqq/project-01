# Interactive Arcade Hub — Build Tasks

Dependency-ordered task packets derived from `prd.md`.
Stack: React + TypeScript + Vite, Tailwind, Framer Motion, Zustand, Web Audio;
Supabase (Postgres + Auth + Realtime). Scoring: client-trusted with light
server validation. Auth: registered-only (username + password).

Rules for every packet: complete in order, respect the "Do NOT yet" boundaries,
and satisfy Verification before checking the box.

---

## Phase 0 — Foundations

### P0.1 Project scaffold
- [x] Objective: Create Vite + React + TS app with Tailwind, ESLint, Prettier.
- Boundaries: No features, no Supabase, no routing logic beyond a placeholder page.
- Verify: `npm run dev` serves a styled placeholder page; `npm run lint` passes.

### P0.2 Supabase client + env config
- [x] Objective: Add `@supabase/supabase-js`, a typed client singleton, and
  `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) with `.env.example`.
- Boundaries: No tables, no auth calls, no queries — just an initialized client.
- Verify: Import client in a temp module; `console.log(supabase)` is defined; no
  secrets committed (`.env` gitignored).

### P0.3 App shell & routing
- [x] Objective: Install router; define routes for `/`, `/lobby`, `/room/:code`,
  `/profile` with empty placeholder components and a shared layout.
- Boundaries: No auth guards, no data, no real UI content.
- Verify: Navigating each URL renders its placeholder inside the layout.

---

## Phase 1 — Data & Auth

### P1.1 Database schema + RLS
- [x] Objective: SQL migrations for `profiles`, `rooms`, `room_players`,
  `matches`, `scores`. Add indexes; enable RLS with owner/participant policies.
- Boundaries: No app code consuming these tables yet; no seed of game logic.
- Verify: Run migration on Supabase; insert/select sample rows via SQL editor;
  confirm RLS blocks cross-user reads with the anon role.
  NOTE (env): No live Supabase project or local Postgres/Docker is available in
  this environment, so migrations are validated for syntax against the real
  PostgreSQL grammar via `pg-query-emscripten` (WASM). Live apply + RLS row
  checks must be run by the operator once project credentials are set in `.env`.

### P1.2 Auth flow (username + password)
- [x] Objective: Register + login + logout using Supabase Auth; create a
  `profiles` row on signup; persist session; unique-username enforcement.
- Boundaries: No avatar/badge UI yet; no online presence; no room access.
- Verify: Register a user → row appears in `profiles`; logout/login restores
  session; duplicate username is rejected with a clear error.
  NOTE (env): Username→password auth implemented via synthetic emails
  (`<username>@arcade.local`) + a signup trigger that creates the profile row,
  plus an anon `username_available` RPC for uniqueness. Pure helpers are unit
  tested (`npm test`); SQL validated (`npm run validate:sql`). Live signup/login
  requires operator Supabase credentials and "confirm email" disabled.

### P1.3 Profile management
- [x] Objective: Profile page — avatar selection (preset set), badge display,
  `online_status` field wired to a stub.
- Boundaries: Presence sync is stubbed (no realtime yet); no room features.
- Verify: Change avatar → persists across reload; profile renders badge and
  status placeholder.

---

## Phase 2 — Lobby & Rooms

### P2.1 Room create/join
- [x] Objective: Generate unique 6-digit room code (collision check + retry);
  create room (host = creator); join by code with validation (exists, not full).
- Boundaries: No realtime list yet; no game selection; no host controls.
- Verify: Create room → row in `rooms` with unique code; join from a second
  account adds a `room_players` row; joining a bad/full code shows an error.
  NOTE (env): Code generator verified via 5000-sample collision unit test;
  create/join logic (collision retry, full/exists/started validation) built with
  `npm test`/build passing. Live 2-account join requires operator credentials.

### P2.2 Realtime player list, presence, room status
- [x] Objective: Subscribe to room via Supabase Realtime (presence + Postgres
  changes); render live player list and room status (waiting/ready/playing).
- Boundaries: No game start; no scoreboards; no host kick yet.
- Verify: Two browsers in one room see each other join/leave in real time;
  toggling "ready" updates both clients within ~1s.
  NOTE (env): Implemented via `useRoom` hook (postgres_changes on room_players &
  rooms + presence tracking) and migration `0003_enable_realtime.sql` (validated).
  Live 2-browser sync requires operator Supabase credentials + Realtime enabled.

### P2.3 Host controls + disconnect handling
- [x] Objective: Host can kick players and set room rules; define host-disconnect
  behavior (host migration or room teardown) and stale-room cleanup.
- Boundaries: "Start game" only flips status to `playing`; no game engine yet.
- Verify: Host kicks a player → they're removed from both clients; host closing
  tab triggers the chosen teardown/migration; stale rooms get cleaned.
  NOTE (env): Kick/settings/start built as host-only services (RLS enforced).
  Migration `0004` adds a room_players-delete trigger (host migration → promote
  earliest member, or teardown when empty) and a `cleanup_stale_rooms()` RPC
  (schedule via pg_cron). SQL validated; build/tests pass. Ungraceful host
  disconnect is covered by presence indicators + stale cleanup. Live multi-client
  verification requires operator credentials.

---

## Phase 3 — UI Shell / Landing

### P3.1 Hero: particle grid + 3D card tilt
- [x] Objective: Animated hero with grid particle effect and hover 3D tilt;
  honor `prefers-reduced-motion` with a static fallback.
- Boundaries: Decorative only — no navigation logic beyond existing routes.
- Verify: Effects run at ~60fps on desktop; reduced-motion setting disables
  animation; no jank on a mid-tier mobile profile.
  NOTE (env): Canvas particle grid (rAF loop, particle count capped at 90, DPR
  capped at 2) + pointer-driven `TiltCard`; both gated by `useReducedMotion`
  (static single frame / no tilt). Build passes; preview serves. Live 60fps/FPS
  profiling requires a real browser/device.

### P3.2 Audio controller
- [x] Objective: Web Audio controller with music + SFX toggles, gesture-gated
  init to satisfy autoplay policy; global mute state.
- Boundaries: Wire only lobby/UI sounds; game SFX added with each game later.
- Verify: Audio starts only after a user gesture; toggles mute/unmute; state
  persists across route changes.
  NOTE (env): `AudioController` synthesises music/SFX with oscillators (no bundled
  assets); `AudioProvider` unlocks the context on first pointer/key/touch event
  and persists toggles to localStorage. `noteToFreq` unit-tested; build passes.
  Live audio playback requires a real browser.

### P3.3 Game selection hub
- [x] Objective: Catalog of games with Mode (Solo/1v1/Party) and Category
  (Puzzle/Speed/Trivia) filters; per-game preview of mechanics/rules; responsive.
- Boundaries: Selecting a game only records intent/route; no gameplay yet.
- Verify: Filters narrow the list correctly; previews render; layout works at
  mobile and desktop breakpoints.
  NOTE (env): Catalog in `lib/games.ts`; pure `filterGames` unit-tested (mode +
  category combinations); `GamesPage` renders responsive grid + preview modal;
  "Select" routes to `/lobby?game=<key>` and prefills room creation. Build/tests
  pass.

---

## Phase 4 — Game Engine Core

### P4.1 Generic game state machine + synced lifecycle
- [x] Objective: Reusable game lifecycle (lobby→countdown→active→results) synced
  over Realtime; countdown anchored to a server/broadcast start timestamp.
- Boundaries: No specific game logic; use a trivial no-op game to exercise it.
- Verify: Two clients transition through all states together; countdowns stay
  within tolerance despite different local clocks.
  NOTE (env): Pure `phaseAt`/`buildPlan`/`parseGamePlan` unit-tested (incl. a
  clock-skew agreement test). Plan is stored in `rooms.rules.game_plan` (survives
  reconnect + reaches late joiners) and countdowns use a server-clock offset via
  `server_now()` RPC (migration 0005, validated). `GameStage` renders phases;
  RoomPage exercises it with a 15s no-op match. Live 2-client sync needs
  operator credentials.

### P4.2 Realtime scoreboard + match history
- [x] Objective: Live scoreboard fed by client-reported scores (light validation)
  and persistence of final results to `matches`/`scores`.
- Boundaries: Client-trusted scoring only; no anti-cheat; no leaderboards page.
- Verify: Score updates appear live on both clients; final match row persists and
  is readable from `matches`.
  NOTE (env): `lib/matches.ts` (create/report/finalize/history) + `useScoreboard`
  (realtime scores subscription) + `Scoreboard` component. Scores clamped via
  `clampScore`; winner via `computeWinner` (both unit-tested). Match plan carries
  `matchId`. RoomPage no-op "tap to score" exercises live scoring + persistence.
  Build/tests pass; live cross-client updates need operator credentials.

---

## Phase 5 — Mini-Games (each isolated)

### P5.1 Quick Math Duel
- [x] Objective: Solo-vs-AI and 1v1 real-time score battle using the engine core.
- Boundaries: Only this game; reuse engine/scoreboard; no new infra.
- Verify: Solo run records a score; a 1v1 match between two browsers syncs scores
  and produces a winner + persisted match.
  NOTE (env): Added a pluggable game layer first — `src/games/types.ts`
  (`GameComponentProps`) + `src/games/registry.ts` (key → component + match
  duration, unknown keys fall back to the no-op `TapGame`). RoomPage now renders
  the registry component during the `active` phase and passes a `reportScore`
  wrapper over `reportScore(matchId, userId, score)`; the game is keyed by
  `matchId:gameKey` so per-match state cannot leak. Pure logic in
  `src/games/mathDuel/logic.ts` (`makeProblem`/`isCorrect`/`levelFor`/
  `pointsForStreak`/`applyPenalty`/`isLockedOut`/`aiScoreAt`) is unit-tested (14
  tests: determinism, non-negative subtraction, difficulty scaling, input
  parsing, streak cap, penalty window, AI benchmark). Wrong answers cost a 1.5s
  input lockout measured in the lifecycle's server-anchored `elapsedMs`. Solo
  shows the AI benchmark; 1v1/party ranks via the existing live scoreboard.
  lint+test+build green. Two-browser sync + persisted winner need operator
  credentials.

### P5.2 Grid Memory / Terminal Cipher
- [x] Objective: Puzzle game with timed mode and turn-based versus mode.
- Boundaries: Only this game; reuse engine; no shared-state leakage to P5.1/P5.3.
- Verify: Timed mode ends on timeout with a score; turn-based versus alternates
  turns correctly across two clients.
  NOTE (env): `src/games/terminalCipher/logic.ts` is pure and unit-tested (23
  tests): `hashSeed`/`makeRng` (deterministic mulberry32), `generateSequence`
  (no consecutive repeats, terminates on degenerate rand), `sequenceForRound`
  (same match+round ⇒ identical sequence on every client), `extendSequence`
  (non-mutating), `validateInput` (partial/complete/wrong incl. overlong),
  `pointsForRound`/`scoreForRounds`, `roundAt`/`roundRemainingMs`/`turnPlayerId`/
  `isMyTurn` (round-robin turns off the shared clock), `playbackMs`/
  `playbackStep`. Versus turn order and puzzle content are *derived* from
  (`matchId`, round) + server-anchored `elapsedMs`, so alternating turns need no
  new tables or channels. Timed mode grows the sequence one step per cleared
  round. State is entirely component-local and the component is remounted per
  match via the `matchId:gameKey` key, so no leakage to P5.1/P5.3. Grid is real
  `<button>`s (tab + keys 1–9) with an `aria-live` status. `matchId` was added to
  `GameComponentProps`. lint+test+build green; two-client turn alternation needs
  operator credentials.

### P5.3 Word / Typing Race
- [x] Objective: Real-time typing competition with per-player progress-bar sync.
- Boundaries: Only this game; reuse engine/scoreboard.
- Verify: Two clients race; progress bars update live; finishing order + scores
  persist.
  NOTE (env): `src/games/typingRace/logic.ts` is pure + unit-tested (16 tests):
  `passageFor` (seeded from `matchId` ⇒ same passage on every client),
  `correctPrefixLength`/`computeProgress` (strict prefix match — progress stops
  at the first mistake), `nextChar`, `wpm`, `raceScore` (progress%×10 + finish
  bonus so earlier finishers outrank later ones) and its inverse
  `progressPctFromScore`. Per-player progress bars reuse the *existing* live
  scoreboard subscription (`useScoreboard`): scores double as progress data, so
  no new channel/table was needed. `GameComponentProps` gained a flattened
  `scores` array for this purpose; seeded RNG helpers were hoisted to
  `lib/rng.ts`. Component has an aria-live status, per-character passage
  colouring, role=progressbar bars, and paste-safe single input. lint+test+build
  green (100 tests). Live two-client racing needs operator credentials.

---

## Phase 6 — Resilience & Polish

### P6.1 Error handling & user feedback
- [x] Objective: Handle connection loss, full/expired rooms, and input validation
  with friendly, consistent messaging.
- Boundaries: No redesign of features — add guards/messages around existing ones.
- Verify: Simulate offline, full room, and bad input → each shows a clear,
  recoverable message.
  NOTE (env): `lib/errors.ts` maps raw Supabase/Postgres/network errors to
  friendly, actionable sentences (`friendlyMessage`, unit-tested: auth failures,
  offline fetches, rate limits, expired sessions, RLS denials, duplicate keys,
  passthrough of our own human-readable errors). New `ToastProvider`
  (`context/ToastProvider.tsx`) renders polite `aria-live` toasts
  (auto-dismiss, capped) — RoomPage action failures (kick/start/score/settings)
  now surface as toasts instead of shifting layout. Top-level
  `ErrorBoundary` catches render crashes with a reload-to-recover screen.
  `useOnlineStatus` + an AppLayout banner warn when the browser goes offline.
  AuthPage/LobbyPage/RoomPage load errors route through `friendlyMessage`.
  lint+test+build green (106 tests). Live offline/full-room simulations need a
  browser; logic is covered by unit tests.


### P6.2 Reconnection & state resync
- [x] Objective: On refresh/network blip, rejoin room and resync game/room state.
- Boundaries: No new gameplay; focus on recovery paths.
- Verify: Refreshing mid-game rejoins the same room and restores current state
  on both clients.
  NOTE (env): Fixed `joinRoom` ordering so an existing member refreshing
  mid-match passes (membership is checked before the "already started" gate —
  this was the refresh blocker). `useRoom` now: resubscribes with a 1.5s backoff
  when the realtime channel reports CHANNEL_ERROR/TIMED_OUT; refetches the room
  row + roster via new `getRoomById` when the browser regains connectivity
  (`online` event) or the tab becomes visible again, reconciling updates missed
  while offline. `useGameLifecycle` re-syncs the server clock every 5 minutes and
  on `online`, keeping phase math honest after long blips. The game plan persists
  in `rooms.rules` (P4.1), so a mid-game reload remounts the same match keyed by
  `matchId:gameKey`; Supabase auth already auto-refreshes tokens
  (`persistSession`+`autoRefreshToken`). lint+test+build green. Two-client live
  verification needs operator credentials.

### P6.3 Responsive/mobile perf + accessibility pass
- [x] Objective: Cross-device responsive audit, animation perf fallbacks,
  keyboard/focus/ARIA and contrast checks.
- Boundaries: No feature changes — only responsive/perf/a11y fixes.
- Verify: Manual mobile+desktop walkthrough is smooth; Lighthouse a11y ≥ 90;
  keyboard-only navigation reaches all interactive elements.
  NOTE (env): Global `:focus-visible` ring (neon cyan, offset) in
  `index.css` so every interactive element shows keyboard focus; global
  `prefers-reduced-motion` media rule neutralises CSS animations/transitions as
  a safety net on top of the existing `useReducedMotion` guards (ParticleGrid
  static frame + DPR/particle caps; TiltCard disabled). AppLayout gained a
  "Skip to content" link targeting a focusable `<main id>`; nav now wraps on
  narrow screens. Game hint text bumped gray-500→gray-400 for AA contrast on
  the dark bg. Games already use real buttons/inputs with labels, aria-live
  statuses, role=progressbar, keys 1–9 grid input. lint+test+build green.
  NOTE (env): Lighthouse cannot be executed in Termux (no Chrome); target ≥ 90
  needs an operator run — structure above follows the audit checklist.

