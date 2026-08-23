# Handoff Prompt — Lanjutan Interactive Arcade Hub

> File ini berisi prompt siap-pakai untuk AI/engineer berikutnya yang akan
> menyelesaikan sisa pembangunan aplikasi. Salin-tempel bagian di bawah utuh.

---

Kamu adalah senior software engineer yang melanjutkan proyek **Interactive Arcade Hub**
(platform mini-game multiplayer real-time). Proyek sudah dibangun sampai Fase 4 secara
**autonomous, sequential build mode**. Tugasmu: **selesaikan sisa task di `tasks.md` satu
per satu secara berurutan, verifikasi setiap task, lalu tandai `- [x]`** — tanpa menunggu izin.

## Lokasi & konteks
- Working dir: `/data/data/com.termux/files/home/project`
- Roadmap: `tasks.md` (sumber kebenaran). PRD: `prd.md`.
- Stack: React + TypeScript + Vite, Tailwind, React Router, Supabase (Postgres + Auth +
  Realtime). Scoring **client-trusted**. Auth **username+password** (via synthetic email
  `<username>@arcade.local`).

## ATURAN LINGKUNGAN (SANGAT PENTING — jangan dilanggar)
1. **Termux tidak punya `/usr/bin/env`.** Semua binary dipanggil via node di `package.json`
   scripts (`node node_modules/vite/bin/vite.js`, dll). **JANGAN** ubah script jadi
   `vite`/`tsc`/`eslint` telanjang — akan gagal "bad interpreter".
2. **`/tmp` tidak ada.** Gunakan `/data/data/com.termux/files/usr/tmp/opencode` untuk file
   sementara.
3. **Tidak ada Supabase live / Postgres / Docker.** Maka:
   - SQL divalidasi sintaksis dengan `npm run validate:sql` (pakai pg-query-emscripten —
     grammar Postgres asli).
   - Logika murni diuji dengan `npm test` (vitest).
   - Type-check + bundling dengan `npm run build`; lint dengan `npm run lint`.
   - Verifikasi runtime yang butuh browser/DB dua-klien **tidak bisa** dijalankan di sini →
     tulis catatan `NOTE (env):` di task itu (lihat pola di task yang sudah selesai).
4. **Perintah wajib sebelum menandai task selesai:** `npm run lint` → `npm test` →
   `npm run build` (+ `npm run validate:sql` bila ada migration baru). Semua harus hijau.
5. Setiap migration baru: tambahkan file di `supabase/migrations/000X_*.sql` **dan**
   sinkronkan tipe di `src/lib/database.types.ts`.
6. Update `tasks.md` (`- [x]`) + gunakan tool todo untuk tracking. Jangan pakai
   placeholder/`// rest of code`.

## Arsitektur yang sudah ada (pahami sebelum menulis)
- `src/lib/gameLifecycle.ts` — state machine murni: fase `lobby→countdown→active→results`,
  `GamePlan { gameKey, matchId, countdownStartAt, countdownMs, durationMs }`, fungsi
  `phaseAt/buildPlan/parseGamePlan`.
- `src/hooks/useGameLifecycle.ts` — baca plan dari `rooms.rules.game_plan`, koreksi clock
  via RPC `server_now()`, expose `startMatch(gameKey, durationMs)` & `endMatch()`.
- `src/hooks/useRoom.ts` — roster + presence + status realtime.
- `src/hooks/useScoreboard.ts` + `src/components/Scoreboard.tsx` — skor live.
- `src/lib/matches.ts` — `createMatch/reportScore/finalizeMatch/getMatchScores/getMatchHistory`.
- `src/components/GameStage.tsx` — wrapper UI fase (countdown/active/results).
- `src/pages/RoomPage.tsx` — saat ini menjalankan **no-op "tap to score"** sebagai demo
  lifecycle+scoreboard.
- `src/lib/games.ts` — katalog game (`math-duel`, `terminal-cipher`, `typing-race`).

## Langkah pertama yang direkomendasikan (refactor kecil sebelum P5.1)
Buat arsitektur game yang pluggable agar 3 game masuk lifecycle yang sama:
1. `src/games/types.ts` — interface
   `GameComponentProps { userId; elapsedMs; remainingMs; durationMs; reportScore(score:number):void }`.
2. `src/games/registry.tsx` — map `gameKey → React.ComponentType<GameComponentProps>`.
3. Di `RoomPage`, pada fase `active`, render komponen game dari registry berdasarkan
   `lifecycle.plan.gameKey` (fallback ke no-op tap game yang sudah ada). `reportScore`
   mem-wrap `reportScore(matchId, userId, score)`.

## Task tersisa (kerjakan berurutan)
- **P5.1 Quick Math Duel** — pisahkan logika murni ke `src/games/mathDuel/logic.ts`
  (`makeProblem(rand=Math.random)`, `isCorrect(problem, guess)`; jawaban salah → penalti
  waktu kecil) + unit test; komponen `MathDuel.tsx`. Mode Solo (vs benchmark AI) & 1v1
  (skor tertinggi). Report skor absolut tiap jawaban benar.
- **P5.2 Terminal Cipher** — logika murni sequence memory (`generateSequence`,
  `validateInput`) + test; komponen; mode timed & turn-based versus. Isolasi state antar game.
- **P5.3 Typing Race** — logika murni progress/akurasi (`computeProgress(target, typed)`) +
  test; progress bar per pemain (via presence broadcast atau reportScore = %); passage bersama.
- **P6.1 Error handling & feedback** — komponen error/toast konsisten; tangani offline, room
  penuh/expired, validasi input. Pertimbangkan React ErrorBoundary + util pesan terpusat.
- **P6.2 Reconnection & resync** — refresh/putus jaringan → rejoin room & resync state (plan
  sudah persist di `rooms.rules`; pastikan `useRoom`/`useGameLifecycle` re-subscribe & pulih;
  tangani Supabase auth refresh).
- **P6.3 Responsive/mobile perf + a11y** — audit breakpoint, fallback animasi (sudah ada
  `useReducedMotion`), keyboard/focus/ARIA, kontras. Target Lighthouse a11y ≥ 90 (catat
  sebagai NOTE env bila tak bisa diukur di sini).

## Pola verifikasi & dokumentasi
Tiru task yang sudah selesai: setelah lint+test+build hijau, tandai `- [x]` dan tambahkan
`NOTE (env):` yang menjelaskan apa yang diverifikasi (unit test/SQL/build) dan apa yang butuh
kredensial/browser asli.

## Terakhir
Setelah semua task `- [x]`: jalankan `npm run lint && npm test && npm run build &&
npm run validate:sql` sebagai gate akhir, lalu tulis ringkasan singkat + daftar langkah
operator untuk go-live:
- isi `.env` dari `.env.example`;
- jalankan migrations `0001`–`000X` berurutan;
- aktifkan Realtime;
- matikan "Confirm email" di Supabase Auth;
- jadwalkan `cleanup_stale_rooms()` via pg_cron.

---

## Status saat handoff (referensi cepat)
- **Selesai & terverifikasi (lint+test+build hijau, 43 unit test):** P0.1–P4.2 —
  scaffold, auth, profil, room create/join, realtime roster+presence, host controls
  (kick/rules/start) + host-migration/cleanup, hero animasi, audio controller, game hub
  berfilter, lifecycle tersinkron (anti clock-skew), scoreboard + match history.
- **Sisa:** P5.1, P5.2, P5.3 (3 mini-game) + P6.1, P6.2, P6.3 (polish).
- **Migrations tersedia:** `0001_init_schema`, `0002_auth_profile_trigger`,
  `0003_enable_realtime`, `0004_host_migration_cleanup`, `0005_server_clock`.
- **Scripts:** `npm run dev|build|preview|lint|format|validate:sql|test`.
