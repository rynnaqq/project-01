# Product Requirement Document (PRD)
## Space Simulator: Earth to ISS Mission

**Status:** Ready for Implementation  
**Product Type:** Web-based 3D Mini-Game / Educational Experience  
**Engine:** Babylon.js  
**Language:** TypeScript  
**Rendering Target:** WebGL 2.0  
**Primary Platforms:** Desktop Web + Mobile Web  
**Target Experience:** 5–10 menit per session  
**Core Loop:** Launch → Ascend → Reach Orbit → Maneuver → Approach ISS → Align → Dock → Mission Complete

---

# A. Executive Summary & Tujuan Produk

## A.1 Ringkasan Produk

**Space Simulator: Earth to ISS Mission** adalah mini-game 3D interaktif yang terintegrasi ke dalam website dan memungkinkan pengguna merasakan simulasi perjalanan astronaut dari permukaan Bumi menuju International Space Station (ISS).

Pengalaman dirancang sebagai kombinasi:

1. **Cinematic experience** — pengguna melihat dan merasakan transisi dari permukaan Bumi menuju ruang angkasa.
2. **Interactive simulation** — pengguna mengendalikan thrust, orientasi, translasi, dan navigasi.
3. **Educational gameplay** — informasi mengenai ketinggian, kecepatan, microgravity, inersia, dan docking diberikan melalui HUD serta contextual feedback.
4. **Gamified mission** — keberhasilan ditentukan melalui kemampuan pengguna mencapai orbit, melakukan pendekatan, menjaga alignment, dan menyelesaikan docking.

Produk tidak ditujukan sebagai simulator aerospace dengan akurasi penuh. Model fisika menggunakan **simplified-but-plausible simulation** sehingga pengalaman tetap menyenangkan, ringan, dan mudah dipahami pengguna umum.

## A.2 Problem Statement

Website yang memiliki konten edukasi luar angkasa umumnya menggunakan artikel, video, gambar, atau animasi pasif. Fitur ini mengubah pembelajaran menjadi pengalaman:

> **Learn → Control → Experiment → Fail → Retry → Understand**

## A.3 Business Objectives

- Meningkatkan engagement dan session duration.
- Meningkatkan retention melalui replay, score, mission grade, fuel efficiency, dan docking accuracy.
- Mendukung edukasi fisika dan antariksa.
- Menjadi interactive showcase kemampuan WebGL/3D website.

## A.4 Target Audience

| Segment | Karakteristik | Kebutuhan |
|---|---|---|
| Student | 13–24 tahun | Edukasi + gameplay |
| Casual User | Pengunjung website umum | Fun + simple controls |
| Space Enthusiast | Penggemar astronomi | Immersion + visual |
| Educator | Guru/pengajar | Demonstrasi konsep |
| Tech Audience | Pengguna WebGL | Visual quality + interaction |

### Primary Persona

**Student Explorer**, usia 15–21, menggunakan smartphone/laptop, mengharapkan kontrol yang dapat dipahami dalam <60 detik.

## A.5 Product Goals

| Goal | Target |
|---|---:|
| First meaningful interaction | < 15 detik setelah scene siap |
| User memahami kontrol dasar | < 60 detik |
| Mission completion | ≥ 35% first-time users |
| Retry rate | ≥ 25% |
| Average session duration | 5–10 menit |
| Desktop FPS | ≥ 60 FPS target |
| Mobile FPS | ≥ 30 FPS |
| Fatal WebGL errors | < 1% sessions |
| Asset load failure | < 2% sessions |

## A.6 KPI & Success Metrics

| Metric | Target | Critical Threshold |
|---|---:|---:|
| Desktop FPS | 60 FPS | ≥ 45 FPS |
| Mobile FPS | 30–45 FPS | ≥ 24 FPS |
| Frame time desktop | ~16.7 ms | < 22 ms |
| Frame time mobile | ~33 ms | < 42 ms |
| First playable | < 5–8 s | < 12 s |
| Memory usage mobile | < 500 MB | < 700 MB |
| Asset loading errors | < 2% | < 5% |
| Play initiation rate | ≥ 50% | — |
| Mission completion | ≥ 35% | — |
| Replay rate | ≥ 25% | — |
| Average session | ≥ 5 menit | — |

---

# B. User Journey & Core Gameplay Mechanics

## B.1 High-Level User Journey

```text
Website
  ↓
[Launch Mini-Game]
  ↓
[Asset Preloader]
  ↓
[Mission Briefing]
  ↓
Phase 1 — Earth Ascent
  ↓
Phase 2 — Orbit / Zero-G
  ↓
Phase 3 — ISS Approach
  ↓
[Docking Challenge]
  ├── Success → Mission Complete
  └── Failure → Retry / Assist
```

# B.2 Fase 1 — Peluncuran & Transisi Atmosfer

### Objective

Pemain mengendalikan kendaraan/astronaut module dari permukaan Bumi menuju orbital altitude.

Fase ini harus terasa cinematic tetapi tetap interaktif.

### Gameplay Flow

```text
Launch
 ↓
Ignition
 ↓
Lift-off
 ↓
Troposphere
 ↓
Stratosphere
 ↓
Mesosphere
 ↓
Thermosphere
 ↓
Exosphere
 ↓
Orbital Environment
```

### Visual Transition

**0–10 km — Surface/Troposphere**
- landscape
- cloud layers
- atmospheric haze
- launch plume
- strong blue sky

**10–50 km — Upper Atmosphere**
- sky semakin gelap
- curvature Bumi mulai terlihat
- cloud layer mengecil

**50–100 km — Near-Space**
- sky menjadi dark blue/black
- atmospheric glow
- starfield mulai muncul

**100 km+ — Orbital Environment**
- black space
- Earth limb
- atmospheric scattering
- starfield
- ISS target

Milestone visual:
> Kármán Line — 100 km

Setelah masuk orbital environment, controller berpindah dari **Ascent Controller** ke **Orbital Controller**.

## B.3 Fase 1 Control Model

```text
Player Input
   ↓
Input Manager
   ↓
Thrust Controller
   ↓
Acceleration
   ↓
Velocity
   ↓
Position
```

Model gameplay:

```ts
velocity += acceleration * deltaTime;
position += velocity * deltaTime;
```

Dengan:

```text
Acceleration = thrustForce / mass
```

Gravity dapat disederhanakan dan di-tuning untuk gameplay.

# B.4 Fase 2 — Eksplorasi Luar Angkasa & Zero Gravity

Setelah mencapai orbit, kontrol berpindah menjadi **6-DOF astronaut movement**.

### Six Degrees of Freedom

```text
Translation:
X = Left / Right
Y = Up / Down
Z = Forward / Backward

Rotation:
Pitch
Yaw
Roll
```

## B.5 Zero-G Gameplay Model

```text
Press Forward
       ↓
Velocity increases
       ↓
Release key
       ↓
Velocity remains
       ↓
Counter-thrust
       ↓
Velocity decreases
```

Konsep inersia menjadi bagian dari pembelajaran.

## B.6 Thruster Model

```ts
interface ThrusterConfig {
  maxForce: number;
  fuelCapacity: number;
  fuelConsumptionRate: number;
  rotationalForce: number;
  linearDamping: number;
  angularDamping: number;
}
```

Initial tuning:

| Parameter | Default |
|---|---:|
| Max thrust | 1.0 gameplay unit |
| Fuel capacity | 100 |
| Linear damping | 0.01–0.05 |
| Angular damping | 0.02–0.08 |
| Rotation thrust | 0.4 |
| Fuel consumption | 0.5–2.0/s |

Nilai harus divalidasi melalui playtesting.

## B.7 Physics Engine

Gunakan **Havok Physics** melalui Babylon.js Physics API untuk collision dan rigid-body behavior.

Arsitektur:

```text
Player Astronaut
        ↓
Physics Body
        ├── Linear Velocity
        ├── Angular Velocity
        ├── Impulse / Force
        └── Collision
```

Jangan menyerahkan seluruh kontrol astronaut kepada physics engine. Game controller tetap mengatur gameplay feel.

# B.8 Fase 3 — Pendekatan & Docking ISS

Pemain harus:
1. menemukan ISS,
2. mencapai approach corridor,
3. memperlambat relative velocity,
4. menyelaraskan orientation,
5. mempertahankan posisi,
6. melakukan docking.

## B.9 ISS Target System

```text
ISS
│
├── Main Body
├── Target Module
│    ├── Docking Port
│    └── Approach Corridor
├── Solar Arrays
└── Collision Shell
```

Pisahkan visual mesh dan collision mesh.

## B.10 Docking Mechanic

Parameter utama:

- Distance
- Relative Velocity
- Alignment

Success:

```text
Distance < threshold
AND
RelativeVelocity < threshold
AND
AlignmentAngle < threshold
```

Initial gameplay tuning:

| Condition | Target |
|---|---:|
| Distance | < 5 m |
| Docking velocity | < 0.5 m/s |
| Alignment | < 5° |
| Approach cone | Valid |
| Player state | Stable |

Nilai ini adalah gameplay tuning parameters, bukan klaim prosedur docking ISS nyata.

## B.11 Navigation Assistance

HUD:

```text
                 ↑
             TARGET
                ●
              /   \
             /     \
         YOU ●
```

Information:

```text
ISS DISTANCE
124 m

RELATIVE SPEED
2.4 m/s

ALIGNMENT
78%

APPROACH
TOO FAST
```

State:

```text
Safe → Caution → Critical → Docking Ready
```

---

# C. UI/UX & Heads-Up Display

# C.1 UI Architecture

Pisahkan 3D rendering dan UI.

```text
Browser
│
├── Game Canvas
│     └── Babylon.js
│
└── HTML/UI Layer
      ├── HUD
      ├── Menu
      ├── Tutorial
      └── Mission Result
```

Rekomendasi:
- HTML/CSS: menu, settings, accessibility, modal
- Babylon GUI: in-game HUD, reticle, labels
- Canvas/WebGL: 3D world

# C.2 Loading / Asset Preloader

```text
┌─────────────────────────────────────┐
│         SPACE SIMULATOR             │
│                                     │
│        EARTH → ISS MISSION          │
│                                     │
│          [3D Loading Icon]          │
│                                     │
│     Loading Mission Assets...       │
│                                     │
│     █████████████░░░░░  74%         │
│                                     │
│     Earth Model                     │
│     ISS Model                       │
│     Astronaut                       │
│     Environment                     │
└─────────────────────────────────────┘
```

Progress:
- 0–20% engine initialization
- 20–50% environment
- 50–75% ISS/astronaut
- 75–90% audio/textures
- 90–100% gameplay initialization

Progress harus berasal dari actual asset loading state.

Gunakan `LoadAssetContainerAsync()` atau `ImportMeshAsync()` untuk loading modular.

# C.3 In-Game HUD

```text
┌────────────────────────────────────────────┐
│ ALTITUDE  412 KM          SPEED  7.6 KM/S │
│                                            │
│                 +                         │
│              ISS ●                        │
│                                            │
│                  △                         │
│                                            │
│ O₂ ██████████    FUEL ███████░            │
│                                            │
│ DISTANCE TO ISS: 1.24 KM                  │
│ RELATIVE SPEED: 3.2 M/S                   │
│ ALIGNMENT: 72%                             │
│                                            │
│ [W][A][S][D] MOVE   MOUSE LOOK             │
└────────────────────────────────────────────┘
```

## C.4 HUD Telemetry

| Telemetry | Description | Update |
|---|---|---|
| Altitude | Ketinggian relatif | 5–10 Hz |
| Velocity | Magnitude velocity | 10 Hz |
| Relative velocity | Kecepatan relatif ISS | 10 Hz |
| Fuel | Jetpack/RCS | 10 Hz |
| Oxygen | Remaining oxygen | 1 Hz |
| Distance | Jarak docking target | 10 Hz |
| Alignment | Orientasi docking axis | 10 Hz |
| Mission timer | Durasi misi | 1 Hz |

# C.5 Desktop Controls

| Input | Function |
|---|---|
| W | Forward thrust |
| S | Backward thrust |
| A | Left translation |
| D | Right translation |
| Space | Up thrust |
| Shift | Down thrust |
| Mouse | Look |
| Q | Roll left |
| E | Roll right |
| R | Counter-thrust / brake |
| F | Toggle assistance |
| Esc | Pause |

## C.6 Mobile Controls

| Touch Element | Function |
|---|---|
| Left joystick | Translation |
| Right drag zone | Camera look |
| Up button | Vertical thrust |
| Down button | Reverse vertical thrust |
| Brake | Counter-thrust |
| Assist | Stabilization |
| Dock | Confirm docking when valid |

Landscape direkomendasikan untuk gameplay utama.

# C.7 Mission Complete Screen

```text
┌──────────────────────────────┐
│       MISSION COMPLETE       │
│                              │
│        ISS DOCKED ✓          │
│                              │
│ Mission Time     06:42       │
│ Fuel Remaining   64%         │
│ Docking Accuracy 92%         │
│                              │
│       RATING: A              │
│                              │
│ [REPLAY MISSION]             │
│ [BACK TO WEBSITE]            │
└──────────────────────────────┘
```

---

# D. Spesifikasi Teknis & Arsitektur Babylon.js

## D.1 Technology Stack

| Layer | Recommendation |
|---|---|
| Language | TypeScript |
| Build | Vite |
| Package manager | npm/pnpm |
| 3D Engine | Babylon.js |
| Physics | Havok |
| Asset | GLB/glTF |
| Texture | KTX2/Basis |
| UI | HTML/CSS + Babylon GUI |
| Testing | Playwright + unit tests |
| Code quality | ESLint + Prettier |

## D.2 Project Structure

```text
src/
├── game/
│   ├── Game.ts
│   ├── GameConfig.ts
│   ├── GameState.ts
│   └── GameEvents.ts
├── scenes/
│   ├── BootScene.ts
│   ├── EarthAscentScene.ts
│   ├── OrbitScene.ts
│   └── DockingScene.ts
├── player/
│   ├── AstronautController.ts
│   ├── ThrusterController.ts
│   ├── CameraRig.ts
│   └── InputController.ts
├── physics/
│   ├── PhysicsManager.ts
│   ├── GravityController.ts
│   └── CollisionLayers.ts
├── iss/
│   ├── ISS.ts
│   ├── DockingPort.ts
│   └── ApproachController.ts
├── ui/
│   ├── HUD.ts
│   ├── LoadingScreen.ts
│   ├── MissionComplete.ts
│   └── Tutorial.ts
├── assets/
│   ├── AssetManager.ts
│   └── AssetManifest.ts
├── audio/
│   └── AudioManager.ts
└── telemetry/
    └── Telemetry.ts
```

## D.3 Scene Management

Rekomendasi: **single Babylon Scene + Mission State Machine + Dynamic Asset Loading**.

```ts
enum MissionPhase {
  Loading,
  Briefing,
  Ascent,
  Orbit,
  Approach,
  Docking,
  Complete,
  Failed,
  Paused
}
```

Keuntungan:
- transisi seamless,
- physics tidak perlu direinitialize,
- state mudah dilacak,
- lifecycle asset lebih mudah dikontrol.

## D.4 Asset Streaming

```text
BOOT
 ↓
Common Assets
 ↓
Earth Assets
 ↓
Start Gameplay
 ↓
Orbit Assets
 ↓
ISS Assets
```

Gunakan `AssetContainer` untuk lifecycle asset.

```ts
const earthContainer =
  await BABYLON.LoadAssetContainerAsync(
    "/assets/earth/earth.glb",
    scene
  );

earthContainer.addAllToScene();
```

Saat tidak diperlukan:

```ts
earthContainer.removeAllFromScene();
```

## D.5 Camera Architecture

Prototype:
- `UniversalCamera`
- `FreeCamera`

Final:
- custom `CameraRig`

```text
CameraRig
├── Position Controller
├── Rotation Controller
├── Smoothing
├── Camera Shake
└── Input Adapter
```

Camera modes:
1. Cinematic
2. Gameplay
3. Docking assistance

## D.6 Physics Architecture

```text
Game Physics
│
├── Gravity
├── Player
└── Collision
      ↓
    Havok
```

Gunakan `HavokPlugin`, `PhysicsAggregate`, dan physics bodies seperlunya.

## D.7 Gravity Model

Secara konseptual:

```text
g(r) = GM / r²
```

Untuk gameplay, gunakan simplified gravity scaling yang dapat dikonfigurasi.

## D.8 Large World / Floating Origin

Untuk skala Bumi-ke-orbit, jangan langsung mengandalkan koordinat dunia meter secara penuh untuk MVP.

Rekomendasi:

```text
1 gameplay unit = configurable virtual distance
```

Contoh:

```text
1 unit = 100 m
```

Telemetry dikonversi kembali ke unit yang dipahami pengguna.

Jika dibutuhkan world yang lebih besar, gunakan floating-origin/multi-region strategy.

## D.9 Earth Rendering

Layer:

```text
Earth Surface
 ↓
Cloud Layer
 ↓
Atmosphere Shell
 ↓
Starfield
```

MVP atmosphere:
- outer sphere,
- Fresnel,
- gradient/procedural shader,
- alpha/depth blending.

## D.10 Starfield

Gunakan cube texture/skybox untuk background space. Hindari particle starfield dengan jumlah sangat besar.

## D.11 ISS Materials

Gunakan PBR untuk:
- solar panels,
- metallic structures,
- thermal blankets,
- docking mechanism,
- astronaut suit.

Mobile:
- simplified PBR,
- lower texture resolution,
- reduced material features.

## D.12 3D Assets

Primary format:

```text
.glb
```

Secondary:

```text
.gltf + binary/textures
```

## D.13 LOD

```text
LOD0: 0–100 m
LOD1: 100–500 m
LOD2: 500 m+
```

ISS:
- LOD0 saat docking,
- LOD1 saat approach,
- LOD2 saat distant orbit.

## D.14 Texture Compression

Gunakan KTX2/Basis.

| Asset | Desktop | Mobile |
|---|---:|---:|
| Earth hero | 2K–4K | 1K–2K |
| ISS | 2K | 1K |
| Astronaut | 2K | 1K |
| UI | SVG/WebP/KTX2 | SVG/WebP/KTX2 |

## D.15 Input Abstraction

```ts
interface InputState {
  forward: number;
  backward: number;
  left: number;
  right: number;
  up: number;
  down: number;
  pitch: number;
  yaw: number;
  roll: number;
  brake: boolean;
}
```

Gameplay logic tidak boleh bergantung langsung pada keyboard/DOM.

## D.16 Mission State

```ts
interface MissionState {
  phase: MissionPhase;
  altitude: number;
  velocity: Vector3;
  relativeVelocity: number;
  fuel: number;
  oxygen: number;
  distanceToISS: number;
  alignment: number;
  missionTime: number;
}
```

HUD membaca state ini, bukan menghitung physics sendiri.

## D.17 Audio

Layer:
- ambient space,
- thruster,
- mechanical SFX,
- warning alarm,
- docking confirmation.

Settings:
- master volume,
- SFX,
- music/ambient,
- mute.

Audio harus dimulai setelah user gesture jika browser memblokir autoplay.

## D.18 Performance

### Desktop

```text
Target: 60 FPS
Frame budget: ~16.7 ms
```

### Mobile

```text
Target: 30 FPS
Frame budget: ~33.3 ms
```

Approximate budget:

| Task | Desktop | Mobile |
|---|---:|---:|
| Rendering | 8–10 ms | 15–22 ms |
| Physics | 1–3 ms | 2–5 ms |
| Game logic | <2 ms | <3 ms |
| UI | <1 ms | <2 ms |
| Headroom | 3–5 ms | 3–6 ms |

## D.19 Dynamic Quality Scaling

Quality tiers:

```text
HIGH
MEDIUM
LOW
```

Downgrade sequence:

```text
FPS degradation
 ↓
Shadow quality
 ↓
Rendering scale
 ↓
Particle count
 ↓
LOD distance
```

Jangan downgrade berdasarkan satu frame spike; gunakan beberapa sampel berturut-turut.

---

# E. Edge Cases, Fallback & Accessibility

## E.1 WebGL Disabled

```text
Canvas creation fails
 ↓
Compatibility Screen
 ↓
Static educational fallback
```

Tidak boleh ada blank page atau uncaught fatal error.

## E.2 Hardware Acceleration Disabled

Tampilkan:

> 3D acceleration tidak tersedia. Space Simulator membutuhkan GPU acceleration untuk berjalan optimal.

CTA:

```text
[Try Again]
[View Educational Version]
```

## E.3 Low FPS

Gunakan FPS/frame-time sampling dan adaptive quality.

## E.4 Memory Pressure

Jika high-resolution asset gagal:
- fallback ke asset low-res,
- prioritaskan gameplay-critical assets.

## E.5 Network Failure

```text
Retry
 ↓
Retry 1
 ↓
Retry 2
 ↓
Fallback
```

Gunakan browser/CDN caching.

## E.6 Resize / Orientation

Landscape preferred, tetapi portrait tidak boleh menyebabkan aplikasi rusak.

## E.7 Accessibility

Minimum:
- keyboard-accessible menus,
- visible focus,
- sufficient contrast,
- reduced motion,
- subtitles/text untuk audio warnings,
- pause anytime,
- configurable sensitivity,
- haptic feedback optional,
- informasi tidak hanya disampaikan melalui warna.

Reduced Motion:
- disable aggressive camera shake,
- disable heavy screen effects,
- reduce rapid cinematic motion.

## E.8 Tab Switching

```text
document.hidden
 ↓
Pause simulation
```

Delta time harus di-clamp saat kembali aktif.

## E.9 Collision Safety

Gunakan low-poly collision geometry terpisah dari visual mesh.

## E.10 Player Gets Lost

Tambahkan:

```text
[RECENTER]
```

Fungsi:
- menampilkan ISS,
- reset camera orientation,
- mengaktifkan guidance arrow.

## E.11 Out-of-Bounds

Jika player keluar dari mission volume:

> You are leaving the mission area.

Lalu:

```text
[Return to Mission]
```

---

# F. Roadmap & Milestones

## Milestone 1 — Engine Setup & Core Prototype

Scope:
- TypeScript + Babylon.js
- canvas integration
- engine initialization
- camera rig
- input abstraction
- Earth placeholder
- orbit placeholder
- astronaut/controller
- initial physics

Deliverable:

```text
Playable Earth → Space prototype
```

Acceptance:
- player bergerak,
- ascent → orbit,
- FPS baseline,
- resize,
- pause/resume.

## Milestone 2 — 3D Assets + HUD

Scope:
- Earth
- atmosphere
- ISS
- astronaut
- starfield
- PBR
- HUD
- loading screen
- mobile input

Deliverable:

```text
Earth → Orbit → ISS visible
```

## Milestone 3 — Gameplay Polish

Scope:
- launch cinematic
- atmospheric transition
- zero-G tuning
- fuel
- navigation assistance
- docking corridor
- alignment
- docking sequence
- failure conditions
- educational hints

Deliverable:

```text
Complete Mission Loop
```

## Milestone 4 — Optimization, Audio, QA & Deployment

Scope:
- profiling,
- adaptive quality,
- KTX2,
- LOD,
- memory optimization,
- audio,
- accessibility,
- browser/mobile QA,
- analytics,
- deployment.

---

# G. Functional Requirements

## FR-01 — Game Initialization

System harus:
- membuat Babylon engine,
- membuat scene,
- feature detection,
- load required assets,
- menampilkan progress.

## FR-02 — Launch

User dapat:
- thrust,
- ascent control,
- melihat altitude/velocity,
- memasuki orbital state.

## FR-03 — Zero-G

User dapat:
- translasi enam arah,
- rotasi,
- mempertahankan momentum,
- counter-thrust.

## FR-04 — ISS Navigation

System menyediakan:
- ISS visual,
- target marker,
- distance,
- relative speed,
- alignment.

## FR-05 — Docking

System menentukan success/failure berdasarkan:
- distance,
- relative velocity,
- angle,
- approach state.

## FR-06 — Mission Completion

Jika berhasil:
- physics dapat di-freeze,
- docking animation,
- score,
- result screen.

---

# H. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | 60 FPS desktop target |
| Mobile | 30+ FPS target |
| Loading | Progressive loading |
| Reliability | Graceful asset failure |
| Browser | Modern Chromium/Firefox/Safari/Edge |
| Accessibility | Keyboard + reduced motion |
| Maintainability | Modular TypeScript |
| Scalability | Asset streaming |
| Analytics | Event-based telemetry |
| Localization | UI strings externalized |

---

# I. Analytics Event Specification

Events:

```text
space_simulator_open
space_simulator_load_start
space_simulator_load_complete
mission_start
phase_ascent_start
phase_orbit_start
phase_approach_start
phase_docking_start
thruster_depleted
mission_failed
mission_completed
docking_success
docking_failed
mission_restart
mission_exit
```

Properties:

```json
{
  "deviceType": "mobile",
  "qualityTier": "medium",
  "missionTime": 382,
  "fuelRemaining": 64,
  "dockingAccuracy": 92
}
```

Jangan mengumpulkan personal data yang tidak diperlukan untuk gameplay analytics.

---

# J. QA & Testing Strategy

## J.1 Browser Matrix

| Browser | Desktop | Mobile |
|---|---:|---:|
| Chrome | ✓ | ✓ |
| Edge | ✓ | ✓ |
| Firefox | ✓ | ✓ |
| Safari | ✓ | ✓ |

## J.2 Device Tiers

**Tier A:** modern desktop/laptop GPU  
**Tier B:** mainstream laptop/recent mobile  
**Tier C:** entry-level mobile/integrated GPU

## J.3 Gameplay Test Cases

| ID | Test | Expected |
|---|---|---|
| TC-01 | Launch | Loading → mission |
| TC-02 | Asset failure | Retry/fallback |
| TC-03 | Release thrust | Momentum remains |
| TC-04 | Counter-thrust | Velocity decreases |
| TC-05 | Approach too fast | Warning |
| TC-06 | Valid corridor | Docking indicator |
| TC-07 | All criteria met | Mission Complete |
| TC-08 | Browser loses focus | Simulation pauses |
| TC-09 | FPS drops | Adaptive quality |
| TC-10 | WebGL unavailable | Compatibility screen |

---

# K. Definition of Done

```text
[✓] Launch playable
[✓] Atmospheric transition
[✓] Zero-G
[✓] 6-DOF
[✓] ISS navigation
[✓] Docking
[✓] HUD
[✓] Mobile controls
[✓] Loading/fallback
[✓] Audio
[✓] Accessibility baseline
[✓] Performance targets
[✓] QA browser matrix
[✓] Analytics
[✓] Error monitoring
[✓] Production deployment tested
```

---

# L. Recommended Babylon.js API/Feature Map

| Requirement | Babylon.js Recommendation |
|---|---|
| Rendering | `Engine` / WebGL 2 |
| Scene | `Scene` |
| Camera prototype | `UniversalCamera` / `FreeCamera` |
| Final astronaut camera | Custom camera rig |
| Physics | `HavokPlugin` |
| Physics bodies | `PhysicsAggregate` |
| Asset loading | `LoadAssetContainerAsync()` |
| Direct mesh loading | `ImportMeshAsync()` |
| Asset lifecycle | `AssetContainer` |
| Materials | `PBRMaterial` / PBR pipeline |
| Environment | CubeTexture / Skybox |
| UI HUD | Babylon GUI |
| Input | Custom Input Manager |
| Animation | `AnimationGroup` |
| Debugging | Inspector / Physics Viewer |
| Texture compression | KTX2 |
| LOD | glTF LOD + Babylon LOD |
| Large world | Floating-origin strategy |
| Audio | Babylon Audio APIs |
| Performance | Hardware scaling + adaptive quality |

---

# M. Recommended Technical Blueprint

```text
                      WEBSITE
                         │
                         ▼
                  SpaceSimulator.ts
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
        UI / HUD Layer        Babylon Scene
              │                     │
              │             ┌───────┴─────────┐
              │             ▼                 ▼
              │          Player            ISS
              │             │                 │
              │             ▼                 ▼
              │         Controller        Docking
              │             │                 │
              │             └───────┬─────────┘
              │                     ▼
              │                  Physics
              │                     │
              │                   Havok
              │
              ▼
          Mission State
              │
              ▼
           Analytics
```

---

# N. Core Design Principle

Arsitektur harus memisahkan **simulation**, **presentation**, dan **content**.

```text
SIMULATION
├── Physics
├── Player
├── Mission State
└── Docking Logic

PRESENTATION
├── Camera
├── VFX
├── Audio
├── HUD
└── Cinematics

CONTENT
├── Earth
├── ISS
├── Astronaut
├── Text
└── Educational Data
```

Dengan pemisahan ini, tuning seperti "thruster lebih kuat" atau "ISS lebih dekat" dapat dilakukan melalui configuration tanpa mengubah arsitektur inti.

---

# O. Final Product Vision

```text
USER OPENS WEBSITE
        ↓
"START MISSION"
        ↓
EARTH LAUNCH
        ↓
ATMOSPHERIC ASCENT
        ↓
EARTH CURVATURE REVEALED
        ↓
STARFIELD
        ↓
ZERO-G
        ↓
ISS APPEARS
        ↓
PLAYER MANEUVERS
        ↓
DOCKING APPROACH
        ↓
ALIGNMENT
        ↓
DOCK
        ↓
MISSION COMPLETE
```

Keseluruhan pengalaman harus terasa seperti **short playable space mission**, bukan sekadar demo 3D.

Prioritas:

> **Playability > Clarity > Performance > Visual Fidelity > Simulation Complexity**

---

# P. MVP Prioritization

## Must Have
- Earth → Orbit → ISS journey
- 6-DOF movement
- thrust/fuel
- HUD
- ISS navigation
- docking
- desktop + mobile controls
- loading screen
- performance degradation
- mission complete/restart

## Should Have
- cinematic camera
- educational hints
- adaptive graphics
- audio
- scoring
- reduced-motion support

## Could Have
- advanced orbital assistance
- multiple docking ports
- mission grades
- challenge mode
- leaderboard
- localization
- replay camera

## Won't Have in V1
- multiplayer
- VR requirement
- realistic orbital mechanics
- real-time ISS telemetry
- full aerospace-grade flight model

---

# Q. Implementation Recommendation

Untuk implementasi awal, **jangan langsung membuat Earth full-scale dan ISS high-detail**. Mulai dengan vertical slice:

```text
Low-poly Earth
      ↓
Basic ascent controller
      ↓
Simple starfield
      ↓
Low-poly ISS
      ↓
6-DOF astronaut
      ↓
Docking port
      ↓
HUD
```

Setelah core loop terbukti menyenangkan dan stabil pada 60/30 FPS, baru masukkan:

```text
High-quality Earth
Atmosphere shader
High-detail ISS
VFX
Audio
LOD
KTX2
Cinematic sequence
```

Strategi ini mengurangi risiko terbesar proyek: menghabiskan waktu pada visual sebelum memastikan **core gameplay loop Earth → Orbit → Docking** benar-benar fun dan playable.
