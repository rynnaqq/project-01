/* =============================================================================
   RAIL RUSH — configuration. Every gameplay/visual tunable lives here.
   Edit a number, save — Vite HMR reloads instantly.
   ========================================================================== */

/* ------------------------------------------------------------------ gameplay */
export const CONFIG = {
  lanes: [-2.2, 0, 2.2],
  laneStepTime: 0.17,        // fixed-duration lane change (cubic ease-out)
  startBoostTime: 0.8,       // s of 72%->100% speed acceleration at run start
  startBoostFloor: 0.72,
  baseSpeed: 11,             // world units/s at start
  speedRamp: 0.22,           // extra units/s per second survived
  maxSpeed: 30,
  maxFrameDelta: 0.05,       // s — dt clamp per frame
  gravity: 34,
  jumpVelocity: 12.2,
  highJumpMultiplier: 1.32,
  slideDuration: 0.62,
  fastFallVelocity: -16,     // airborne slide input -> fast-fall speed cap
  shortHopThreshold: 4,      // vy above this when jump released -> cut arc
  shortHopMultiplier: 0.55,
  playerHeight: 1.75,
  playerSlideHeight: 0.85,
  playerHalfWidth: 0.42,
  playerBaseHalfDepth: 0.38, // swept along z by frame travel so thin obstacles can't tunnel
  magnetDuration: 8,
  highJumpDuration: 8,
  coinMagnetRadius: 4.5,
  spawnAheadZ: -95,          // fixed z where most content appears
  trainSpawnZ: -120,         // trains spawn deeper (they close faster)
  despawnZ: 9,               // recycled once behind the camera
  chunkGapMin: 9,            // distance gap between obstacle events
  chunkGapMax: 17,
  doubleBlockChance: 0.42,   // chance an event blocks two lanes instead of one
  coinLineLength: 6,
  coinLineSpacing: 1.4,
  coinLineStartOffset: 2,
  coinHeight: 1.05,
  coinCapacity: 64,
  scorePerUnit: 0.6,
  coinScore: 10,
  powerupChance: 0.16,
  powerupSpawnOffset: 6,     // z offset ahead of the obstacle wall
  powerupCapacity: 3,
  trainSpeedMult: 1.35,      // trains approach this much faster than the world
  trainHornZ: -78,           // train z where the warning horn fires
  jumpBufferTime: 0.09,      // s — press jump slightly before landing still works
  autoSlideAfterFastFall: 0.32, // s — roll after landing from a fast-fall

  /* ----------------------------------------------------------------- visuals */
  particleCapacity: 110,
  ringCapacity: 8,
  tumbleweedCapacity: 2,
  crashShakeTime: 0.5,       // s of camera shake on crash
  flashOpacity: 0.75,
  flashDelayMs: 30,
  cameraFovLandscape: 64,
  cameraFovPortrait: 76,
  cameraFovStart: 66,        // initial camera.fov before first resize
  cameraKickFov: 7,          // FOV kick with speed (acceleration feel)
  cameraKickFovFP: 4,        // extra FOV in first-person tunnels
  fpBlendRate: 3.4,          // damped blend into first-person tunnel cam
  fpHideBodyAt: 0.85,        // hide runner body once FP blend passes this
  fpCamZ: 1.45,              // first-person camera z
  fpCamY: 2.02,              // first-person eye height above player.y
  camY: 4.9,                 // third-person chase camera height
  camZ: 8.0,                 // third-person chase camera z
  camShakeDamp: 2.4,         // shake decay rate per second
  sky: {
    zenith: '#241b4d',
    band1: '#6a3d6e',
    band2: '#c96a4e',
    horizon: '#f2a45c',
    groundGlow: '#ffd08a',
  },
  fogColor: 0xf2a45c,
  fogNear: 28,
  fogFar: 105,
  starCount: 130,
  sunPosition: [70, 52, -430] as const,
  sunRadius: 26,
  sunHaloScale: 150,
  groundSpan: [520, 800] as const,  // width, depth — sized for ultrawide FOVs
  ballastSpan: [8.6, 320],
  railSpan: 320,
  railGaugeOffset: 0.72,
  sleeperRows: 44,
  sleeperGap: 2.2,
  sleeperSize: [1.7, 0.1, 0.55] as const,
  streakCount: 22,
  streakStartSpeed: 18,      // world speed where wind streaks begin to show
  tunnelLength: 50,
  tunnelPool: 2,
  towerPool: 3,
  setPieceStart: { tunnel: 320, tower: 170 },
  setPieceGap: {
    tunnel: [420, 260],      // [base, random extra]
    tower: [240, 260],
  },
  towerSideRange: [9.5, 3] as const, // [base x, random extra]
  tumbleweedStart: { timer: 9, respawn: [12, 10] },
  houseRows: [
    { count: 14, spacing: 26 },
    { count: 12, spacing: 40 },
  ],

  /* ------------------------------------------------------------------- audio */
  musicStepMs: 280,
  musicBass: [55, 55, 65.4, 49],

  /* ------------------------------------------------------------ persistence */
  textureRepeats: {
    ground: [29, 62] as const,
    ballast: [2, 36] as const,
    rust: [3, 1.5] as const,
  },
  bestScoreKey: 'railrush.best',
  buildTag: 'scenery-6',
};

export type Config = typeof CONFIG;
