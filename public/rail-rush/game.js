/* =============================================================================
   RAIL RUSH — a 3-lane endless runner (Three.js, no build step).
   Everything is procedural: geometry, motion, and sound. No external assets.

   Tunables live in CONFIG below; see README.md for the parameter table.
   ========================================================================== */
const THREE = await import('three');

/* ------------------------------------------------------------------ config */
const CONFIG = {
  lanes: [-2.2, 0, 2.2],
  laneShiftSpeed: 12,        // lane-change lerp rate
  baseSpeed: 11,             // world units/s at start
  speedRamp: 0.22,           // extra units/s per second survived
  maxSpeed: 30,
  gravity: 34,
  jumpVelocity: 12.2,
  highJumpMultiplier: 1.32,
  slideDuration: 0.62,
  playerHeight: 1.75,
  playerSlideHeight: 0.85,
  playerHalfWidth: 0.42,
  magnetDuration: 8,
  highJumpDuration: 8,
  coinMagnetRadius: 4.5,
  spawnAheadZ: -95,          // fixed z where new content appears
  despawnZ: 9,               // recycled once behind the camera
  chunkGapMin: 9,            // distance gap between obstacle events
  chunkGapMax: 17,
  coinLineLength: 6,
  scorePerUnit: 0.6,
  coinScore: 10,
  powerupChance: 0.16,
};

/* ------------------------------------------------------------------ helpers */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const randInt = (n) => Math.floor(Math.random() * n);
const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));

const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode */ } },
};

const $ = (id) => document.getElementById(id);
const ui = {
  hud: $('hud'), score: $('hud-score'), coins: $('hud-coins'),
  power: $('hud-power'), powerBar: document.querySelector('#hud-power i'),
  boot: $('screen-boot'), bootMsg: $('boot-msg'), bootTitle: $('boot-title'),
  start: $('btn-start'), controls: $('boot-controls'),
  paused: $('screen-paused'), over: $('screen-over'),
  overScore: $('over-score'), overCoins: $('over-coins'), overBest: $('over-best'),
  newBest: $('over-newbest'),
};

/* --------------------------------------------------------------------- sfx */
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let musicWanted = false;

class Sfx {
  constructor() { this.ctx = null; this.muted = false; this.musicTimer = null; }
  ensure() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!this.ctx) this.ctx = new Ctx();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }
  blip(freq, dur = 0.09, type = 'square', gain = 0.16, slide = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
  coin() { this.blip(1180, 0.07, 'square', 0.10); setTimeout(() => this.blip(1760, 0.09, 'square', 0.10), 45); }
  jump() { this.blip(300, 0.16, 'triangle', 0.18, 260); }
  slide() { this.blip(220, 0.14, 'sawtooth', 0.10, -120); }
  lane() { this.blip(420, 0.06, 'triangle', 0.08); }
  power() { [520, 780, 1040].forEach((f, i) => setTimeout(() => this.blip(f, 0.1, 'triangle', 0.13), i * 70)); }
  crash() {
    this.blip(160, 0.35, 'sawtooth', 0.24, -110);
    setTimeout(() => this.blip(90, 0.4, 'square', 0.2, -50), 60);
  }
  /* Simple looping bass arpeggio; lookahead-free (280ms grid is fine for ambience). */
  syncMusic(on) {
    const want = on && !this.muted;
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
    if (!want || !this.ctx) return;
    const bass = [55, 55, 65.4, 49];
    let step = 0;
    const playStep = () => {
      if (!want || this.muted || !this.ctx) return;
      this.blip(bass[step % bass.length], 0.22, 'triangle', 0.07);
      if (step % 2 === 1) this.blip(bass[step % bass.length] * 4, 0.08, 'square', 0.02);
      step += 1;
    };
    playStep();
    this.musicTimer = setInterval(playStep, 280);
  }
}
const sfx = new Sfx();

$('btn-mute').addEventListener('click', () => {
  const now = performance.now();
  // Double-tap toggles the music preference; every click toggles mute.
  if (now - muteLastTap < 350) {
    musicWanted = !musicWanted;
  }
  muteLastTap = now;

  sfx.muted = !sfx.muted;
  const btn = $('btn-mute');
  btn.setAttribute('aria-pressed', String(sfx.muted));
  btn.setAttribute('aria-label', sfx.muted ? 'Unmute sound' : 'Mute sound');
  if (!sfx.muted) {
    sfx.ensure();
    sfx.syncMusic(musicWanted && game.state === 'running');
  } else {
    sfx.syncMusic(false);
  }
});
let muteLastTap = 0;

/* ------------------------------------------------------------------- input */
const input = { left: false, right: false, jump: false, slide: false };

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  switch (e.code) {
    case 'ArrowLeft': case 'KeyA': input.left = true; break;
    case 'ArrowRight': case 'KeyD': input.right = true; break;
    case 'ArrowUp': case 'Space': case 'KeyW':
      e.preventDefault();
      if (game.state === 'ready') game.startRun();
      else input.jump = true;
      break;
    case 'ArrowDown': case 'KeyS': input.slide = true; break;
    case 'KeyP': case 'Escape':
      if (game.state === 'running' || game.state === 'paused') game.togglePause();
      break;
    case 'Enter':
      if (game.state === 'ready' || game.state === 'over') game.startRun();
      break;
    default: return;
  }
}, { passive: false });

let touchStart = null;
window.addEventListener('touchstart', (e) => {
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
window.addEventListener('touchend', (e) => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) < 26 && Math.abs(dy) < 26) {
    if (game.state === 'ready' || game.state === 'over') game.startRun();
    else input.jump = true;
    return;
  }
  if (Math.abs(dx) > Math.abs(dy)) input[dx > 0 ? 'right' : 'left'] = true;
  else input[dy > 0 ? 'slide' : 'jump'] = true;
}, { passive: true });

/* ------------------------------------------------------------------ three.js */
const canvas = $('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(clamp(window.devicePixelRatio, 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14203a);
scene.fog = new THREE.Fog(0x14203a, 30, 110);

const camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, 160);
camera.position.set(0, 4.6, 8.4);

scene.add(new THREE.HemisphereLight(0xdfeaff, 0x3a2f22, 1.15));
const sunLight = new THREE.DirectionalLight(0xfff2d0, 1.5);
sunLight.position.set(6, 12, 4);
scene.add(sunLight);

/* Shared geometry & materials (draw-call budget stays low). */
const MAT = {
  rail: new THREE.MeshLambertMaterial({ color: 0x9aa7bd }),
  sleeper: new THREE.MeshLambertMaterial({ color: 0x5b4632 }),
  ground: new THREE.MeshLambertMaterial({ color: 0x27352c }),
  ballast: new THREE.MeshLambertMaterial({ color: 0x39463f }),
  trainBody: [
    new THREE.MeshLambertMaterial({ color: 0xd94f4f }),
    new THREE.MeshLambertMaterial({ color: 0x4f7dd9 }),
    new THREE.MeshLambertMaterial({ color: 0xe0a13d }),
  ],
  trainRoof: new THREE.MeshLambertMaterial({ color: 0xf3ead8 }),
  crate: new THREE.MeshLambertMaterial({ color: 0xb98a4a }),
  barrierLow: new THREE.MeshLambertMaterial({ color: 0xff8a3d }),
  barrierHigh: new THREE.MeshLambertMaterial({ color: 0xffce5c }),
  coin: new THREE.MeshLambertMaterial({ color: 0xffce5c, emissive: 0x8a6400 }),
  magnet: new THREE.MeshLambertMaterial({ color: 0xff71ce, emissive: 0x5e1747 }),
  shoes: new THREE.MeshLambertMaterial({ color: 0x43d9ff, emissive: 0x0b4c66 }),
  body: new THREE.MeshLambertMaterial({ color: 0x86ccca }),
  head: new THREE.MeshLambertMaterial({ color: 0xf3ead8 }),
  legs: new THREE.MeshLambertMaterial({ color: 0x1a1611 }),
  shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 }),
  rock: [new THREE.MeshLambertMaterial({ color: 0x3f4f68 }), new THREE.MeshLambertMaterial({ color: 0x4a5d3f })],
  particle: new THREE.MeshBasicMaterial({ color: 0xffce5c }),
};

const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  coin: new THREE.CylinderGeometry(0.36, 0.36, 0.09, 18),
  torus: new THREE.TorusGeometry(0.42, 0.15, 10, 20),
  octa: new THREE.OctahedronGeometry(0.46),
  circle: new THREE.CircleGeometry(0.5, 16),
};

function mesh(geo, mat, sx, sy, sz) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(sx, sy, sz);
  return m;
}

/* ------------------------------------------------------- static environment */
{
  const ground = mesh(GEO.box, MAT.ground, 60, 1, 300);
  ground.position.set(0, -0.5, -130);
  scene.add(ground);

  const bed = mesh(GEO.box, MAT.ballast, 8.6, 0.24, 300);
  bed.position.set(0, 0.02, -130);
  scene.add(bed);

  for (const lx of CONFIG.lanes) {
    for (const rx of [-0.72, 0.72]) {
      const rail = mesh(GEO.box, MAT.rail, 0.14, 0.14, 300);
      rail.position.set(lx + rx, 0.2, -130);
      scene.add(rail);
    }
  }

  // Distant low-poly hills/silhouettes — decoration only, never collide.
  for (let i = 0; i < 14; i += 1) {
    const h = 3 + Math.random() * 9;
    const b = mesh(GEO.box, MAT.rock[i % 2], 2.4 + Math.random() * 4, h, 2.4);
    const side = Math.random() < 0.5 ? -1 : 1;
    b.position.set(side * (11 + Math.random() * 16), h / 2 - 0.4, -i * 10 - Math.random() * 5);
    scene.add(b);
  }
}

/* Scrolling sleepers sell the speed (single instanced draw call). */
const SLEEPER_COUNT = 96;
const SLEEPER_GAP = 2.2;
const sleepers = new THREE.InstancedMesh(GEO.box, MAT.sleeper, SLEEPER_COUNT);
sleepers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(sleepers);
const sleeperMatrix = new THREE.Matrix4();
let sleeperOffset = 0;

/* ------------------------------------------------------------------- player */
const player = {
  group: new THREE.Group(),
  legL: null, legR: null, shadow: null,
  lane: 1, x: 0, y: 0, vy: 0,
  sliding: 0, grounded: true,
};
{
  const torso = mesh(GEO.box, MAT.body, 0.62, 0.78, 0.4);
  torso.position.y = 1.05;
  const head = mesh(GEO.box, MAT.head, 0.44, 0.44, 0.44);
  head.position.y = 1.68;
  player.legL = mesh(GEO.box, MAT.legs, 0.2, 0.62, 0.24);
  player.legL.position.set(-0.16, 0.31, 0);
  player.legR = mesh(GEO.box, MAT.legs, 0.2, 0.62, 0.24);
  player.legR.position.x = 0.16;
  player.group.add(torso, head, player.legL, player.legR);

  player.shadow = mesh(GEO.circle, MAT.shadow, 1, 1, 1);
  player.shadow.rotation.x = -Math.PI / 2;
  scene.add(player.group, player.shadow);
}

/* ------------------------------------------------------------ object pools */
class Pool {
  constructor(n, factory) {
    this.items = [];
    for (let i = 0; i < n; i += 1) {
      const obj = factory();
      obj.visible = false;
      obj.userData.active = false;
      scene.add(obj);
      this.items.push(obj);
    }
  }
  get() { return this.items.find((o) => !o.userData.active) ?? null; }
  release(item) { item.visible = false; item.userData.active = false; }
  reset() { this.items.forEach((o) => this.release(o)); }
  forEachActive(fn) { for (const o of this.items) if (o.userData.active) fn(o); }
}

function makeTrain() {
  const g = new THREE.Group();
  const body = mesh(GEO.box, pick(MAT.trainBody), 1.9, 2.5, 9);
  body.position.y = 1.45;
  const roof = mesh(GEO.box, MAT.trainRoof, 1.95, 0.18, 9);
  roof.position.y = 2.76;
  const nose = mesh(GEO.box, MAT.trainRoof, 1.7, 1.1, 0.5);
  nose.position.set(0, 0.75, 4.55);
  g.add(body, roof, nose);
  g.userData.hit = { hw: 0.98, y0: 0, y1: 2.85, hd: 4.6 };
  g.userData.span = 10;
  return g;
}
function makeCrate() {
  const c = mesh(GEO.box, MAT.crate, 1.15, 1.15, 1.15);
  c.position.y = 0.575;
  c.rotation.y = Math.random() * 0.4 - 0.2;
  c.userData.hit = { hw: 0.6, y0: 0, y1: 1.15, hd: 0.62 };
  c.userData.span = 2.2;
  return c;
}
function makeLowBarrier() {
  const g = new THREE.Group();
  const bar = mesh(GEO.box, MAT.barrierLow, 1.9, 0.34, 0.3);
  bar.position.y = 0.62;
  const legL = mesh(GEO.box, MAT.legs, 0.12, 0.62, 0.24);
  legL.position.set(-0.82, 0.31, 0);
  const legR = mesh(GEO.box, MAT.legs, 0.12, 0.62, 0.24);
  legR.position.x = 0.82;
  g.add(bar, legL, legR);
  g.userData.hit = { hw: 0.95, y0: 0.45, y1: 0.8, hd: 0.3 }; // jump over
  g.userData.span = 2.2;
  return g;
}
function makeHighBarrier() {
  const g = new THREE.Group();
  const top = mesh(GEO.box, MAT.barrierHigh, 2.0, 0.55, 0.3);
  top.position.y = 2.32;
  const postL = mesh(GEO.box, MAT.legs, 0.12, 2.05, 0.24);
  postL.position.set(-0.92, 1.02, 0);
  const postR = mesh(GEO.box, MAT.legs, 0.12, 2.05, 0.24);
  postR.position.x = 0.92;
  const warn = mesh(GEO.box, MAT.legs, 2.0, 0.09, 0.34);
  warn.position.y = 2.02;
  g.add(top, postL, postR, warn);
  g.userData.hit = { hw: 0.98, y0: 1.5, y1: 2.6, hd: 0.3 }; // slide under only
  g.userData.span = 2.2;
  return g;
}

const trains = new Pool(6, makeTrain);
const crates = new Pool(8, makeCrate);
const lowBarriers = new Pool(8, makeLowBarrier);
const highBarriers = new Pool(8, makeHighBarrier);

const obstaclePools = [
  { pool: trains, weight: 0.34 },
  { pool: crates, weight: 0.26 },
  { pool: lowBarriers, weight: 0.22 },
  { pool: highBarriers, weight: 0.18 },
];

/* Coins: instanced — one draw call for all spinning gold. */
const COIN_COUNT = 64;
const coinMesh = new THREE.InstancedMesh(GEO.coin, MAT.coin, COIN_COUNT);
coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
coinMesh.frustumCulled = false;
scene.add(coinMesh);
const coinState = Array.from({ length: COIN_COUNT }, () => ({ active: false, x: 0, y: 1, z: 0 }));
const coinMatrix = new THREE.Matrix4();
const coinQuat = new THREE.Quaternion();
const coinEuler = new THREE.Euler();
const coinPos = new THREE.Vector3();
const COIN_SCALE = new THREE.Vector3(1, 1, 1);
const HIDDEN_POS = new THREE.Vector3(0, -50, 0);

/* Power-ups. */
const powerups = new Pool(3, () => {
  const holder = new THREE.Group();
  const magnet = mesh(GEO.torus, MAT.magnet, 1, 1, 1);
  magnet.rotation.x = Math.PI / 2;
  magnet.position.y = 1.1;
  const shoes = mesh(GEO.octa, MAT.shoes, 1, 1.3, 1);
  shoes.position.y = 1.1;
  shoes.visible = false;
  holder.add(magnet, shoes);
  holder.userData.kind = 'magnet';
  holder.userData.hit = { hw: 0.6, y0: 0.3, y1: 1.8, hd: 0.6 };
  holder.userData.span = 2.2;
  holder.userData.setKind = (kind) => {
    holder.children[0].visible = kind === 'magnet';
    holder.children[1].visible = kind !== 'magnet';
    holder.userData.kind = kind;
  };
  return holder;
});

/* Particles: tiny pooled boxes with velocity + life. */
const particles = new Pool(90, () => {
  const p = mesh(GEO.box, MAT.particle.clone(), 0.14, 0.14, 0.14);
  p.userData.vel = new THREE.Vector3();
  p.userData.life = 0;
  return p;
});

function burst(x, y, z, colorHex, count = 10, spread = 4) {
  const n = REDUCED_MOTION ? Math.ceil(count / 2) : count;
  for (let i = 0; i < n; i += 1) {
    const p = particles.get();
    if (!p) return;
    p.material.color.set(colorHex);
    p.position.set(x, y, z);
    p.scale.setScalar(1);
    p.visible = true;
    p.userData.active = true;
    p.userData.life = 0.5 + Math.random() * 0.3;
    p.userData.vel.set((Math.random() - 0.5) * spread, Math.random() * spread * 0.9 + 1.5, (Math.random() - 0.5) * spread);
  }
}

/* ------------------------------------------------------------------ spawner */
const spawner = {
  nextEventDist: 40,
  laneBusyUntilDist: [0, 0, 0],

  reset() {
    this.nextEventDist = 40;
    this.laneBusyUntilDist = [0, 0, 0];
  },

  place(pool, lane, z) {
    const obj = pool.get();
    if (!obj) return null;
    obj.position.set(CONFIG.lanes[lane], 0, z);
    obj.visible = true;
    obj.userData.active = true;
    return obj;
  },

  update(travel) {
    while (travel >= this.nextEventDist) {
      const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
      const blockedCount = Math.random() < 0.42 ? 2 : 1;
      const blocked = lanes.slice(0, blockedCount);
      const freeLane = lanes.find((l) => !blocked.includes(l)) ?? lanes[0];

      for (const lane of blocked) {
        let roll = Math.random() * obstaclePools.reduce((s, o) => s + o.weight, 0);
        const chosen = obstaclePools.find((o) => (roll -= o.weight) <= 0) ?? obstaclePools[0];
        if (this.place(chosen.pool, lane, CONFIG.spawnAheadZ)) {
          this.laneBusyUntilDist[lane] = travel + chosen.pool.items[0].userData.span;
        }
      }

      // Guaranteed-free lane carries the coin line, trailing toward the
      // player so it clears the next event's spawn window.
      const coinLane = freeLane;
      for (let i = 0; i < CONFIG.coinLineLength; i += 1) {
        const slot = coinState.findIndex((c) => !c.active);
        if (slot === -1) break;
        coinState[slot].active = true;
        coinState[slot].x = CONFIG.lanes[coinLane];
        coinState[slot].y = 1.05;
        coinState[slot].z = CONFIG.spawnAheadZ + 2 + i * 1.4;
      }

      // Occasional power-up right after (closer than) the obstacle wall.
      if (Math.random() < CONFIG.powerupChance) {
        const pu = this.place(powerups, coinLane, CONFIG.spawnAheadZ + 6);
        if (pu) pu.userData.setKind(Math.random() < 0.5 ? 'magnet' : 'shoes');
      }

      const gap = CONFIG.chunkGapMin + Math.random() * (CONFIG.chunkGapMax - CONFIG.chunkGapMin);
      this.nextEventDist = travel + gap;
    }
  },
};

/* --------------------------------------------------------------------- game */
const BEST_KEY = 'railrush.best';

const game = {
  state: 'loading', // loading | ready | running | paused | over
  speed: CONFIG.baseSpeed,
  distance: 0,
  score: 0,
  coins: 0,
  runTime: 0,
  magnetT: 0,
  jumpBoostT: 0,
  shakeT: 0,
  best: Number(store.get(BEST_KEY) ?? 0),
  lastT: 0,

  startRun() {
    if (this.state === 'running' || this.state === 'loading') return;
    sfx.ensure();

    // Full reset — never a page reload.
    this.speed = CONFIG.baseSpeed;
    this.distance = 0;
    this.score = 0;
    this.coins = 0;
    this.runTime = 0;
    this.magnetT = 0;
    this.jumpBoostT = 0;
    this.shakeT = 0;
    Object.assign(player, { lane: 1, x: 0, y: 0, vy: 0, sliding: 0, grounded: true });
    player.group.position.set(0, 0, 0);
    player.group.rotation.set(0, 0, 0);
    player.group.scale.set(1, 1, 1);
    trains.reset(); crates.reset(); lowBarriers.reset(); highBarriers.reset();
    powerups.reset(); particles.reset();
    coinState.forEach((c) => { c.active = false; });
    spawner.reset();

    ui.boot.hidden = true;
    ui.over.hidden = true;
    ui.paused.hidden = true;
    ui.hud.hidden = false;
    ui.power.hidden = true;
    input.left = input.right = input.jump = input.slide = false;

    this.state = 'running';
    this.lastT = performance.now();
    if (musicWanted) sfx.syncMusic(true);
    requestAnimationFrame(loop);
  },

  togglePause() {
    if (this.state === 'running') {
      this.state = 'paused';
      ui.paused.hidden = false;
      sfx.syncMusic(false);
    } else if (this.state === 'paused') {
      this.state = 'running';
      ui.paused.hidden = true;
      this.lastT = performance.now();
      if (musicWanted) sfx.syncMusic(true);
      requestAnimationFrame(loop);
    }
  },

  switchLane(dir) {
    const next = clamp(player.lane + dir, 0, 2);
    if (next !== player.lane) {
      player.lane = next;
      sfx.lane();
    }
  },

  doJump() {
    if (player.grounded && player.sliding <= 0) {
      player.vy = CONFIG.jumpVelocity * (this.jumpBoostT > 0 ? CONFIG.highJumpMultiplier : 1);
      player.grounded = false;
      sfx.jump();
    }
  },

  doSlide() {
    if (player.sliding <= 0 && player.grounded) {
      player.sliding = CONFIG.slideDuration;
      sfx.slide();
    } else if (!player.grounded) {
      player.vy = Math.min(player.vy, -14); // fast-fall into a slide
    }
  },

  gameOver() {
    this.state = 'over';
    sfx.crash();
    sfx.syncMusic(false);
    this.shakeT = REDUCED_MOTION ? 0 : 0.5;
    burst(player.x, 1, 0, 0xff8a3d, 16, 7);
    burst(player.x, 1.4, 0, 0xf3ead8, 10, 5);

    const finalScore = Math.floor(this.score);
    const isBest = finalScore > this.best;
    if (isBest) {
      this.best = finalScore;
      store.set(BEST_KEY, String(this.best));
    }
    ui.overScore.textContent = String(finalScore);
    ui.overCoins.textContent = String(this.coins);
    ui.overBest.textContent = String(this.best);
    ui.newBest.hidden = !isBest;
    ui.hud.hidden = true;
    ui.power.hidden = true;
    ui.over.hidden = false;

    // Let the wreck particles finish playing behind the panel.
    requestAnimationFrame(loopOver);
  },
};

function loopOver(now) {
  if (game.state !== 'over') return;
  const dt = Math.min(0.05, (now - game.lastT) / 1000 || 0.016);
  game.lastT = now;
  updateParticles(dt);
  updateCamera(dt);
  requestAnimationFrame(loopOver);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && game.state === 'running') game.togglePause();
});

canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  if (game.state === 'running') game.togglePause();
  ui.bootTitle.textContent = 'GRAPHICS LOST';
  ui.bootMsg.textContent = 'Reload the page to restart the run.';
  ui.controls.hidden = true;
  ui.start.hidden = true;
  ui.boot.hidden = false;
});

/* -------------------------------------------------------------------- loop */
function scrollWorld(dt) {
  const dz = game.speed * dt;
  game.distance += dz;
  game.score += dz * CONFIG.scorePerUnit;

  // Sleepers wrap within their gap for a seamless treadmill.
  sleeperOffset = (sleeperOffset + dz) % SLEEPER_GAP;
  for (let i = 0; i < SLEEPER_COUNT; i += 1) {
    sleeperMatrix.makeScale(8.2, 0.1, 0.55);
    sleeperMatrix.setPosition(0, 0.14, CONFIG.despawnZ - i * SLEEPER_GAP + sleeperOffset);
    sleepers.setMatrixAt(i, sleeperMatrix);
  }
  sleepers.instanceMatrix.needsUpdate = true;

  const advance = (pool) => pool.forEachActive((o) => {
    o.position.z += dz;
    if (o.position.z > CONFIG.despawnZ) pool.release(o);
  });
  advance(trains); advance(crates); advance(lowBarriers); advance(highBarriers);

  powerups.forEachActive((o) => {
    o.position.z += dz;
    o.position.y = 0;
    o.children.forEach((c) => { c.rotation.z += dt * 2.4; });
    if (o.position.z > CONFIG.despawnZ) powerups.release(o);
  });

  for (let i = 0; i < COIN_COUNT; i += 1) {
    const c = coinState[i];
    if (!c.active) continue;
    c.z += dz;
    if (game.magnetT > 0 && Math.abs(c.z) < CONFIG.coinMagnetRadius) {
      c.x = damp(c.x, player.x, 8, dt);
      c.y = damp(c.y, player.y + 1, 8, dt);
    }
    if (c.z > CONFIG.despawnZ) c.active = false;
  }
}

function drawCoins(spinAngle) {
  for (let i = 0; i < COIN_COUNT; i += 1) {
    const c = coinState[i];
    if (!c.active) {
      coinMatrix.compose(HIDDEN_POS, coinQuat.identity(), COIN_SCALE);
    } else {
      coinEuler.set(Math.PI / 2, 0, spinAngle);
      coinQuat.setFromEuler(coinEuler);
      coinMatrix.compose(coinPos.set(c.x, c.y, c.z), coinQuat, COIN_SCALE);
    }
    coinMesh.setMatrixAt(i, coinMatrix);
  }
  coinMesh.instanceMatrix.needsUpdate = true;
}

function playerAABB() {
  const h = player.sliding > 0 ? CONFIG.playerSlideHeight : CONFIG.playerHeight;
  return { x: player.x, hw: CONFIG.playerHalfWidth, y0: player.y, y1: player.y + h, hd: 0.38 };
}

function overlaps(obj, p) {
  const h = obj.userData.hit;
  if (!h) return false;
  return (
    Math.abs(obj.position.x - p.x) <= h.hw + p.hw &&
    Math.abs(obj.position.z) <= h.hd + p.hd &&
    p.y0 <= h.y1 && p.y1 >= h.y0
  );
}

function checkCollisions() {
  const p = playerAABB();

  for (const { pool } of obstaclePools) {
    for (const o of pool.items) {
      if (o.userData.active && overlaps(o, p)) { game.gameOver(); return; }
    }
  }

  for (let i = 0; i < COIN_COUNT; i += 1) {
    const c = coinState[i];
    if (!c.active) continue;
    if (
      Math.abs(c.x - p.x) < 0.75 && Math.abs(c.z) < 0.75 &&
      c.y > p.y0 - 0.4 && c.y < p.y1 + 0.4
    ) {
      c.active = false;
      game.coins += 1;
      game.score += CONFIG.coinScore;
      sfx.coin();
      burst(c.x, c.y, c.z, 0xffce5c, 5, 2.4);
    }
  }

  powerups.forEachActive((pu) => {
    if (!overlaps(pu, p)) return;
    const kind = pu.userData.kind;
    powerups.release(pu);
    if (kind === 'magnet') {
      game.magnetT = CONFIG.magnetDuration;
      burst(pu.position.x, 1.2, pu.position.z, 0xff71ce, 12, 3);
    } else {
      game.jumpBoostT = CONFIG.highJumpDuration;
      burst(pu.position.x, 1.2, pu.position.z, 0x43d9ff, 12, 3);
    }
    sfx.power();
  });
}

let legSwingPhase = 0;
function updatePlayer(dt) {
  if (input.left) { input.left = false; game.switchLane(-1); }
  if (input.right) { input.right = false; game.switchLane(1); }
  if (input.jump) { input.jump = false; game.doJump(); }
  if (input.slide) { input.slide = false; game.doSlide(); }

  const targetX = CONFIG.lanes[player.lane];
  player.x = damp(player.x, targetX, CONFIG.laneShiftSpeed, dt);

  if (!player.grounded) {
    player.vy -= CONFIG.gravity * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) { player.y = 0; player.vy = 0; player.grounded = true; }
  }
  if (player.sliding > 0) player.sliding -= dt;

  const g = player.group;
  g.position.set(player.x, player.y, 0);
  g.rotation.z = damp(g.rotation.z, (targetX - player.x) * -0.14, 12, dt);

  const sliding = player.sliding > 0;
  if (sliding) {
    g.scale.set(1, 0.48, 1);
    g.rotation.x = -0.85;
  } else {
    g.scale.set(1, 1, 1);
    g.rotation.x = player.grounded ? 0 : clamp(-player.vy * 0.02, -0.35, 0.3);
  }

  legSwingPhase += dt * (sliding ? 0 : game.speed * 1.6);
  const swing = player.grounded && !sliding ? Math.sin(legSwingPhase) * 0.7 : sliding ? 1.2 : 0.5;
  player.legL.rotation.x = swing;
  player.legR.rotation.x = -swing;

  player.shadow.position.set(player.x, 0.16, 0);
  const sscale = clamp(1 - player.y * 0.12, 0.45, 1);
  player.shadow.scale.set(sscale, sscale, 1);

  if (game.magnetT > 0 || game.jumpBoostT > 0) {
    const active = game.magnetT >= game.jumpBoostT ? 'magnet' : 'shoes';
    const t = Math.max(game.magnetT, game.jumpBoostT);
    const dur = active === 'magnet' ? CONFIG.magnetDuration : CONFIG.highJumpDuration;
    ui.power.hidden = false;
    ui.powerBar.style.transform = `scaleX(${clamp(t / dur, 0, 1)})`;
    if (game.magnetT > 0) game.magnetT -= dt;
    if (game.jumpBoostT > 0) game.jumpBoostT -= dt;
  } else if (!ui.power.hidden) {
    ui.power.hidden = true;
  }
}

function updateCamera(dt) {
  camera.position.x = damp(camera.position.x, player.x * 0.55, 6, dt);
  const shake = game.shakeT > 0 && !REDUCED_MOTION ? (Math.random() - 0.5) * game.shakeT * 2.2 : 0;
  camera.position.y = 4.6 + Math.sin(game.distance * 1.4) * 0.045 + shake;
  camera.lookAt(player.x * 0.3, 1.4, -8);
  if (game.shakeT > 0) game.shakeT = Math.max(0, game.shakeT - dt * 2.4);
}

function updateParticles(dt) {
  particles.forEachActive((p) => {
    p.userData.life -= dt;
    if (p.userData.life <= 0) { particles.release(p); return; }
    p.userData.vel.y -= 22 * dt;
    p.position.addScaledVector(p.userData.vel, dt);
    p.scale.setScalar(clamp(p.userData.life * 2, 0.1, 1));
    p.rotation.x += dt * 9;
    p.rotation.y += dt * 7;
  });
}

function loop(now) {
  if (game.state !== 'running') return;
  const dt = Math.min(0.05, (now - game.lastT) / 1000 || 0.016);
  game.lastT = now;

  game.runTime += dt;
  game.speed = Math.min(CONFIG.maxSpeed, CONFIG.baseSpeed + game.runTime * CONFIG.speedRamp);

  scrollWorld(dt);
  spawner.update(game.distance);
  updatePlayer(dt);
  checkCollisions();
  updateParticles(dt);
  updateCamera(dt);
  drawCoins(game.distance * 2.2);

  ui.score.textContent = String(Math.floor(game.score));
  ui.coins.textContent = String(game.coins);
  requestAnimationFrame(loop);
}

/* --------------------------------------------------------------------- view */
function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  const portrait = window.innerHeight > window.innerWidth;
  camera.fov = portrait ? 78 : 66;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

/* --------------------------------------------------------------------- boot */
// Buttons (wired once; start/restart share startRun which is re-entrant safe).
ui.start.addEventListener('click', () => game.startRun());
$('btn-pause').addEventListener('click', () => game.togglePause());
$('btn-resume').addEventListener('click', () => game.togglePause());
$('btn-restart').addEventListener('click', () => game.startRun());

game.state = 'ready';
ui.bootMsg.textContent = `${game.best > 0 ? `Best: ${game.best} · ` : ''}Ready on platform 3.`;
ui.controls.hidden = false;
ui.start.hidden = false;

// Render one ambient frame so the track is visible behind the boot screen.
scrollWorld(0);
drawCoins(0);
renderer.render(scene, camera);
