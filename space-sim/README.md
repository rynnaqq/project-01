# Space Simulator — Artemis Transit

Standalone cinematic spaceflight experience (Babylon.js, zero binary assets).
Built per `docs/superpowers/specs/2026-08-29-space-simulator-rebuild-design.md`.

- Mission: KSC → SLS launch → ascent → orbit → ISS docking → zero-G interior exploration
- Architecture: deterministic mission clock + data-driven script (`mission/script.ts`),
  cinematic director with 42 camera rigs, procedural materials/audio
- Runs at `/space-sim/` (Vite MPA entry). Debug: `?skip=COUNTDOWN` (dev only), `?view=iss|interior`.
- Controls (after docking): WASD thrust, Space ascend / C descend, Shift boost,
  mouse look, E interact, Esc pause; F fullscreen, M mute; hold Space 0.7 s to
  skip cinematics (or use the pause menu).
- Robustness: `prefers-reduced-motion` disables camera wobble and launch shake;
  touch (`pointer: coarse`) devices are capped to the low quality tier with an
  on-screen note; world-build and WebGL context faults surface on the menu error
  card instead of a black screen.
