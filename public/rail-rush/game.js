/* =============================================================================
   RAIL RUSH — a 3-lane endless runner (Three.js, no build step).
   Everything is procedural: geometry, motion, and sound. No external assets.

   Setting: warm desert dusk. Real-time sun shadows, two parallax mountain
   layers, catenary gantries, oncoming trains that genuinely close faster
   than the world scroll.

   Tunables live in CONFIG below; see README.md for the parameter table.
   ========================================================================== */
/* Three.js from CDN with one fallback host; surfaces failures on the boot
   screen instead of hanging there forever. */
async function loadThree() {
  const hosts = [
    'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js',
    'https://unpkg.com/three@0.164.1/build/three.module.js',
  ];
  let lastError = new Error('no source attempted');
  for (const url of hosts) {
    try {
      return await import(/* @vite-ignore */ url);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
const THREE = await loadThree();

/* ------------------------------------------------------------------ config */
const CONFIG = {
  lanes: [-2.2, 0, 2.2],
  laneStepTime: 0.17,        // fixed-duration lane change (cubic ease-out)
  startBoostTime: 0.8,       // s of 72%->100% speed acceleration at run start
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
  spawnAheadZ: -95,          // fixed z where most content appears
  trainSpawnZ: -120,         // trains spawn deeper (they close faster)
  despawnZ: 9,               // recycled once behind the camera
  chunkGapMin: 9,            // distance gap between obstacle events
  chunkGapMax: 17,
  coinLineLength: 6,
  scorePerUnit: 0.6,
  coinScore: 10,
  powerupChance: 0.16,
  trainSpeedMult: 1.35,      // trains approach this much faster than the world
  jumpBufferTime: 0.09,      // s — press jump slightly before landing still works
  autoSlideAfterFastFall: 0.32, // s — roll after landing from a fast-fall
};

/* ------------------------------------------------------------------ helpers */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const randInt = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[randInt(arr.length)];
const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));

function weightedPick(entries) {
  let roll = Math.random() * entries.reduce((s, e) => s + e.weight, 0);
  return entries.find((e) => (roll -= e.weight) <= 0) ?? entries[0];
}

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
  newBest: $('over-newbest'), flash: $('flash'),
};

/* Any boot-time crash must show up on the boot screen — never hang silently
   on "Loading track…". Runtime errors after start stay console-only. */
let bootDone = false; // flipped once the run handoff below completes
function surfaceBootError(message) {
  if (bootDone) return;
  ui.boot.hidden = false;
  ui.start.hidden = true;
  ui.controls.hidden = true;
  ui.bootMsg.textContent = `Failed to start: ${message}`;
}
window.addEventListener('error', (e) => surfaceBootError(e.message || 'unknown error'));
window.addEventListener('unhandledrejection', (e) => surfaceBootError(String(e.reason ?? 'unknown failure')));

/* --------------------------------------------------------------------- sfx */
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let musicWanted = false;
let muteLastTap = 0;

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
  land() { this.blip(140, 0.08, 'triangle', 0.12, -60); }
  slide() { this.blip(220, 0.14, 'sawtooth', 0.10, -120); }
  lane() { this.blip(420, 0.06, 'triangle', 0.08); }
  power() { [520, 780, 1040].forEach((f, i) => setTimeout(() => this.blip(f, 0.1, 'triangle', 0.13), i * 70)); }
  horn() { // two detuned low voices, fading — "something big is coming"
    this.blip(233, 0.5, 'sawtooth', 0.10, -14);
    this.blip(185, 0.55, 'sawtooth', 0.09, -12);
  }
  tunnel() { // rushing-air whoosh when entering a tunnel
    this.blip(620, 0.4, 'sawtooth', 0.11, -400);
    this.blip(180, 0.5, 'triangle', 0.09, -90);
  }
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

/* Releasing jump early cuts the arc (keyboard short-hop). Touch taps are
   inherently full-length so they always jump high. */
window.addEventListener('keyup', (e) => {
  if ((e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW')
    && !player.grounded && !player.jumpCutUsed && player.vy > 4) {
    player.vy *= 0.55;
    player.jumpCutUsed = true;
  }
});

/* Swipes/taps on HUD buttons and overlay screens belong to those widgets —
   never leak into the game as a jump/start. */
const touchesUI = (el) => !!(el && el.closest && el.closest('#hud, .screen'));
let touchStart = null;
window.addEventListener('touchstart', (e) => {
  if (touchesUI(e.target)) { touchStart = null; return; }
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
window.addEventListener('touchend', (e) => {
  if (!touchStart || touchesUI(e.target)) { touchStart = null; return; }
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
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe9895b, 28, 105);

let baseFov = 66;
const camera = new THREE.PerspectiveCamera(baseFov, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 4.9, 8.0); // high chase overview — updateCamera steers x/y

scene.add(new THREE.HemisphereLight(0xffb08a, 0x4a3550, 1.35));
const sunLight = new THREE.DirectionalLight(0xffb36b, 2.5);
sunLight.position.set(-18, 14, -16);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.left = -24;
sunLight.shadow.camera.right = 24;
sunLight.shadow.camera.top = 24;
sunLight.shadow.camera.bottom = -24;
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 90;
sunLight.shadow.bias = -0.0006;
sunLight.shadow.normalBias = 0.02;
sunLight.target.position.set(0, 0, -14);
scene.add(sunLight, sunLight.target);

/* ------------------------------------------------- procedural textures */
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 4;
  return tx;
}
function speckleTexture(base, spots, density) {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < density; i += 1) {
      g.fillStyle = spots[randInt(spots.length)];
      g.globalAlpha = 0.25 + Math.random() * 0.4;
      g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
  });
}
const hazardTexture = canvasTexture(128, 128, (g, w, h) => {
  g.fillStyle = '#fff3dc';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#ff8a3d';
  for (let x = -h; x < w + h; x += 32) {
    g.beginPath();
    g.moveTo(x, 0); g.lineTo(x + 16, 0); g.lineTo(x + 16 - h, h); g.lineTo(x - h, h);
    g.closePath(); g.fill();
  }
});
const glowTexture = canvasTexture(64, 64, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,226,170,1)');
  gr.addColorStop(0.4, 'rgba(255,190,110,0.45)');
  gr.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
});

/* ------------------------------------------------------- sky dome & sun disc */
const tmpStarDir = new THREE.Vector3();
{
  const skyTex = canvasTexture(64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#241b4d');
    gr.addColorStop(0.42, '#6a3d6e');
    gr.addColorStop(0.68, '#c96a4e');
    gr.addColorStop(0.84, '#f2a45c');
    gr.addColorStop(1, '#ffd08a');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(480, 24, 14),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  sky.renderOrder = -3;
  scene.add(sky);

  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(26, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe6ae, fog: false, depthWrite: false }),
  );
  sun.position.set(70, 52, -430);
  sun.lookAt(0, 0, 0);
  sun.renderOrder = -2;
  scene.add(sun);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color: 0xffcf8a, transparent: true, opacity: 0.85, fog: false, depthWrite: false,
  }));
  halo.position.copy(sun.position);
  halo.scale.setScalar(150);
  halo.renderOrder = -2;
  scene.add(halo);

  // Faint stars in the upper dome — dusk deepening overhead.
  const STAR_COUNT = 130;
  const starPos = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i += 1) {
    tmpStarDir.set(Math.random() - 0.5, 0.35 + Math.random() * 0.6, Math.random() - 0.5)
      .normalize()
      .multiplyScalar(440);
    starPos[i * 3] = tmpStarDir.x;
    starPos[i * 3 + 1] = tmpStarDir.y;
    starPos[i * 3 + 2] = tmpStarDir.z;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xffe9cf, size: 2, sizeAttenuation: false,
    transparent: true, opacity: 0.65, fog: false, depthWrite: false,
  }));
  stars.renderOrder = -2;
  scene.add(stars);
}

/* Shared geometry & materials (draw-call budget stays low). */
const MAT = {
  rail: new THREE.MeshPhongMaterial({ color: 0xb8a68e, shininess: 90, specular: 0xffd9a0 }),
  sleeper: new THREE.MeshLambertMaterial({ color: 0x4a3626 }),
  ground: new THREE.MeshLambertMaterial({
    map: speckleTexture('#54406b', ['#473659', '#61496f', '#3f3050'], 1500),
  }),
  ballast: new THREE.MeshLambertMaterial({
    map: speckleTexture('#4a4048', ['#3a333c', '#5a5058', '#332c38'], 2200),
  }),
  hazard: new THREE.MeshLambertMaterial({ map: hazardTexture }),
  steel: new THREE.MeshLambertMaterial({ color: 0x39415a }),
  pole: new THREE.MeshLambertMaterial({ color: 0x3a2c33 }),
  darkMetal: new THREE.MeshLambertMaterial({ color: 0x23252d }),
  glass: new THREE.MeshLambertMaterial({ color: 0x1b2130 }),
  crateWood: new THREE.MeshLambertMaterial({ color: 0x8a5f33 }),
  crateFrame: new THREE.MeshLambertMaterial({ color: 0x6b4726 }),
  barrierLowLeg: new THREE.MeshLambertMaterial({ color: 0x2c2f3a }),
  cactus: new THREE.MeshLambertMaterial({ color: 0x4a7a5a }),
  shrub: [new THREE.MeshLambertMaterial({ color: 0x8a744a }), new THREE.MeshLambertMaterial({ color: 0x77643f })],
  rust: new THREE.MeshLambertMaterial({
    map: speckleTexture('#7a4a3a', ['#5e362c', '#8f5a46', '#4a2b24'], 1600),
  }),
  tunnelLiner: new THREE.MeshLambertMaterial({ color: 0x574e63 }),
  tunnelRib: new THREE.MeshLambertMaterial({ color: 0x3e3749 }),
  tunnelSkirt: new THREE.MeshLambertMaterial({ color: 0x463f52 }),
  cloud: new THREE.MeshLambertMaterial({ color: 0xffc9d6, emissive: 0x55283c }),
  mountainFar: new THREE.MeshLambertMaterial({ color: 0x472d63, fog: false }),
  mountainNear: [new THREE.MeshLambertMaterial({ color: 0x5d3a5f }), new THREE.MeshLambertMaterial({ color: 0x6e4356 })],
  coin: new THREE.MeshPhongMaterial({ color: 0xffce5c, emissive: 0x8a5a00, shininess: 80, specular: 0xfff2c0 }),
  magnet: new THREE.MeshPhongMaterial({ color: 0xff71ce, emissive: 0x5e1747, shininess: 60 }),
  shoes: new THREE.MeshPhongMaterial({ color: 0x43d9ff, emissive: 0x0b4c66, shininess: 70 }),
  halo: new THREE.MeshBasicMaterial({ color: 0xfff1c9, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }), // shared: all power-up rings pulse together
  body: new THREE.MeshLambertMaterial({ color: 0xe8927c }),   // runner shirt
  head: new THREE.MeshLambertMaterial({ color: 0xf3b58f }),   // skin, dusk-lit
  legs: new THREE.MeshLambertMaterial({ color: 0x33303e }),
  arms: new THREE.MeshLambertMaterial({ color: 0xd97f66 }),
  cap: new THREE.MeshLambertMaterial({ color: 0x86ccca }),
  pack: new THREE.MeshLambertMaterial({ color: 0xc9566b }),
  scarf: new THREE.MeshBasicMaterial({ color: 0xff71ce, side: THREE.DoubleSide }),
  ring: new THREE.MeshBasicMaterial({
    color: 0xffdf9e, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }),
  lightCone: new THREE.MeshBasicMaterial({
    map: glowTexture, color: 0xffbf80, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }),
  tumbleweed: new THREE.MeshLambertMaterial({ color: 0x9a7f52, wireframe: true }),
  particle: new THREE.MeshBasicMaterial({ color: 0xffce5c }),
  streak: new THREE.MeshBasicMaterial({
    color: 0xffd9a0, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }),
};
MAT.ground.map.repeat.set(10, 50);
MAT.ballast.map.repeat.set(4, 70);
MAT.rust.map.repeat.set(3, 1.5);
[MAT.ground.map, MAT.ballast.map, MAT.rust.map].forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });

/* Train liveries — body/accent materials are cloned per train so each spawn
   can be repainted. */
const TRAIN_PALETTES = [
  { body: 0xb5484d, accent: 0xf6e7cf }, // oxide red
  { body: 0x3f6bb5, accent: 0xf2d8a7 }, // dusk blue
  { body: 0xc98a3d, accent: 0x4a2c33 }, // sand
  { body: 0x5aa17a, accent: 0xf6e7cf }, // faded green
  { body: 0x8a5aa0, accent: 0xffd9a0 }, // violet freight
];

const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  coin: new THREE.CylinderGeometry(0.36, 0.36, 0.09, 18),
  torus: new THREE.TorusGeometry(0.42, 0.15, 10, 20),
  octa: new THREE.OctahedronGeometry(0.46),
  cone: new THREE.ConeGeometry(1, 1, 5),
  wheel: new THREE.CylinderGeometry(1, 1, 1, 12),
  puff: new THREE.SphereGeometry(1, 7, 5),
  circle: new THREE.CircleGeometry(0.5, 16),
  ring: new THREE.TorusGeometry(0.34, 0.05, 8, 26),
};

function mesh(geo, mat, sx, sy, sz) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(sx, sy, sz);
  return m;
}
function shadows(root, on = true) {
  root.traverse((o) => { if (o.isMesh) o.castShadow = on; });
}

/* ------------------------------------------------------- static environment */
{
  const ground = mesh(GEO.box, MAT.ground, 90, 1, 320);
  ground.position.set(0, -0.51, -135);
  ground.receiveShadow = true;
  scene.add(ground);

  const bed = mesh(GEO.box, MAT.ballast, 8.6, 0.24, 320);
  bed.position.set(0, 0.02, -135);
  bed.receiveShadow = true;
  scene.add(bed);

  for (const lx of CONFIG.lanes) {
    for (const rx of [-0.72, 0.72]) {
      const rail = mesh(GEO.box, MAT.rail, 0.14, 0.14, 320);
      rail.position.set(lx + rx, 0.2, -135);
      scene.add(rail);
    }
  }
}

/* Scrolling scenery treadmill: fixed spacing, wraps behind the camera.
   Every layer scrolls at its own fraction of world speed for parallax. */
function makeTreadmill(count, spacing, speedFactor, factory, jitterZ = 0) {
  const items = [];
  for (let i = 0; i < count; i += 1) {
    const obj = factory(i);
    obj.position.z = CONFIG.despawnZ - i * spacing - Math.random() * jitterZ;
    scene.add(obj);
    items.push(obj);
  }
  return {
    items,
    advance(dz) {
      const span = count * spacing;
      for (const o of items) {
        o.position.z += dz * speedFactor;
        if (o.position.z > CONFIG.despawnZ + 6) {
          o.position.z -= span;
          if (o.userData.respin) o.userData.respin(o);
        }
      }
    },
  };
}

/* Distant mountain silhouettes — two parallax depths. */
const mountainsFar = makeTreadmill(9, 46, 0.15, () => {
  const h = 10 + Math.random() * 16;
  const m = mesh(GEO.cone, MAT.mountainFar, 10 + Math.random() * 12, h, 10);
  m.geometry = GEO.cone;
  m.position.x = (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 44);
  m.position.y = h / 2 - 2;
  return m;
});
const mountainsNear = makeTreadmill(10, 34, 0.35, () => {
  const h = 5 + Math.random() * 9;
  const m = mesh(GEO.cone, pick(MAT.mountainNear), 6 + Math.random() * 8, h, 6);
  m.position.x = (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 20);
  m.position.y = h / 2 - 1;
  return m;
});

/* Drifting dusk clouds. */
const clouds = makeTreadmill(7, 34, 0.06, () => {
  const g = new THREE.Group();
  const puffs = [[0, 0, 0, 2.6, 1.1, 1.5], [1.8, -0.2, 0.4, 1.7, 0.85, 1.1], [-1.9, -0.25, -0.3, 1.5, 0.8, 1]];
  for (const [x, y, z, sx, sy, sz] of puffs) {
    const p = mesh(GEO.puff, MAT.cloud, sx, sy, sz);
    p.position.set(x, y, z);
    g.add(p);
  }
  g.position.set((Math.random() - 0.5) * 90, 22 + Math.random() * 14, 0);
  g.userData.drift = (Math.random() - 0.5) * 0.6;
  g.userData.respin = (o) => { o.position.x = (Math.random() - 0.5) * 90; };
  return g;
}, 12);

/* Trackside dressing: cacti, rocks, telegraph poles, catenary gantries. */
const cacti = makeTreadmill(10, 19, 1, () => {
  const g = new THREE.Group();
  const h = 1.6 + Math.random() * 1.1;
  const trunk = mesh(GEO.box, MAT.cactus, 0.28, h, 0.28);
  trunk.position.y = h / 2;
  g.add(trunk);
  if (Math.random() < 0.75) {
    const armY = h * (0.45 + Math.random() * 0.25);
    const side = Math.random() < 0.5 ? -1 : 1;
    const elbow = mesh(GEO.box, MAT.cactus, 0.5, 0.22, 0.22);
    elbow.position.set(side * 0.36, armY, 0);
    const up = mesh(GEO.box, MAT.cactus, 0.22, 0.6, 0.22);
    up.position.set(side * 0.55, armY + 0.3, 0);
    g.add(elbow, up);
  }
  g.userData.respin = (o) => {
    o.position.x = (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 7);
    o.rotation.y = Math.random() * Math.PI * 2;
  };
  g.userData.respin(g);
  shadows(g);
  return g;
}, 8);

const shrubs = makeTreadmill(14, 13, 1, () => {
  const s = 0.7 + Math.random() * 0.6;
  const bush = mesh(GEO.cone, pick(MAT.shrub), s * 0.8, s * 0.5, s * 0.8);
  bush.position.y = s * 0.25;
  const g = new THREE.Group();
  g.add(bush);
  g.userData.respin = (o) => { o.position.x = (Math.random() < 0.5 ? -1 : 1) * (5.1 + Math.random() * 1.5); };
  g.userData.respin(g);
  return g;
}, 9);

const poles = makeTreadmill(12, 17, 1, (i) => {
  const g = new THREE.Group();
  const post = mesh(GEO.box, MAT.pole, 0.16, 4.4, 0.16);
  post.position.y = 2.2;
  const cross = mesh(GEO.box, MAT.pole, 1.15, 0.1, 0.1);
  cross.position.y = 4.15;
  g.add(post, cross);
  g.position.x = (i % 2 === 0 ? -1 : 1) * 6.9;
  return g;
});

const gantries = makeTreadmill(5, 46, 1, () => {
  const g = new THREE.Group();
  for (const px of [-5.5, 5.5]) {
    const post = mesh(GEO.box, MAT.steel, 0.26, 5.1, 0.26);
    post.position.set(px, 2.55, 0);
    g.add(post);
    const foot = mesh(GEO.box, MAT.darkMetal, 0.6, 0.2, 0.6);
    foot.position.set(px, 0.1, 0);
    g.add(foot);
  }
  const beam = mesh(GEO.box, MAT.steel, 11.4, 0.3, 0.3);
  beam.position.y = 5.1;
  g.add(beam);
  for (const lx of CONFIG.lanes) {
    const drop = mesh(GEO.box, MAT.darkMetal, 0.07, 0.65, 0.07);
    drop.position.set(lx, 4.62, 0);
    g.add(drop);
  }
  shadows(g);
  return g;
});

/* Wind streaks near the camera — fade in with speed. */
const STREAK_COUNT = 22;
const streaks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.04, 2.6), MAT.streak, STREAK_COUNT);
streaks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
streaks.frustumCulled = false;
streaks.renderOrder = 5;
scene.add(streaks);
const streakSeeds = Array.from({ length: STREAK_COUNT }, () => ({
  x: (Math.random() < 0.5 ? -1 : 1) * (4.5 + Math.random() * 4),
  y: 0.8 + Math.random() * 4.5,
  z: Math.random() * 80 - 70,
}));
const streakMatrix = new THREE.Matrix4();

/* Per-lane sleepers sell the speed (single instanced draw call). */
const SLEEPER_ROWS = 44;
const SLEEPER_GAP = 2.2;
const sleepers = new THREE.InstancedMesh(GEO.box, MAT.sleeper, SLEEPER_ROWS * 3);
sleepers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
sleepers.receiveShadow = true;
scene.add(sleepers);
const sleeperMatrix = new THREE.Matrix4();
let sleeperOffset = 0;
{
  // Per-sleeper tint variation — breaks up the perfect repetition.
  const c = new THREE.Color();
  for (let i = 0; i < SLEEPER_ROWS * 3; i += 1) {
    sleepers.setColorAt(i, c.setHex(0x4a3626).offsetHSL(0, (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.09));
  }
  sleepers.instanceColor.needsUpdate = true;
}

/* ------------------------------------------------------------------- player */
const player = {
  group: new THREE.Group(),
  legL: null, legR: null, armL: null, armR: null,
  lane: 1, x: 0, y: 0, vy: 0,
  sliding: 0, grounded: true,
  pendingJumpT: 0, fastFall: false, squashT: 0,
  rollT: 0, slideTotal: CONFIG.slideDuration,
  laneFrom: 0, laneT: CONFIG.laneStepTime, jumpCutUsed: false,
  corpseActive: false,
};
{
  const torso = mesh(GEO.box, MAT.body, 0.62, 0.78, 0.4);
  torso.position.y = 1.05;

  const head = mesh(GEO.box, MAT.head, 0.44, 0.44, 0.44);
  head.position.y = 1.72;
  const capTop = mesh(GEO.box, MAT.cap, 0.48, 0.16, 0.48);
  capTop.position.y = 1.99;
  const brim = mesh(GEO.box, MAT.cap, 0.46, 0.06, 0.26);
  brim.position.set(0, 1.93, -0.32); // faces travel direction

  const packBody = mesh(GEO.box, MAT.pack, 0.46, 0.52, 0.2);
  packBody.position.set(0, 1.12, 0.29); // back faces the camera
  const packFlap = mesh(GEO.box, MAT.cap, 0.46, 0.14, 0.22);
  packFlap.position.set(0, 1.32, 0.29);

  // Fluttering scarf: plane strip trailing backward, vertices waved per frame.
  const scarfGeo = new THREE.PlaneGeometry(0.2, 1.0, 1, 7);
  scarfGeo.translate(0, 0.5, 0); // hang from the top edge
  player.scarf = new THREE.Mesh(scarfGeo, MAT.scarf);
  player.scarf.rotation.x = Math.PI / 2; // local +y -> world +z (trails behind)
  player.scarf.position.set(0, 1.48, 0.2);
  player.scarf.frustumCulled = false;
  player.scarf.userData.base = Float32Array.from(scarfGeo.attributes.position.array);

  const limb = (mat, w, len, hipX, hipY) => {
    const pivot = new THREE.Group();
    pivot.position.set(hipX, hipY, 0);
    const seg = mesh(GEO.box, mat, w, len, w + 0.02);
    seg.position.y = -len / 2;
    pivot.add(seg);
    return pivot;
  };
  player.armL = limb(MAT.arms, 0.17, 0.52, -0.41, 1.38);
  player.armR = limb(MAT.arms, 0.17, 0.52, 0.41, 1.38);
  player.legL = limb(MAT.legs, 0.19, 0.64, -0.16, 0.66);
  player.legR = limb(MAT.legs, 0.19, 0.64, 0.16, 0.66);

  player.group.add(torso, head, capTop, brim, packBody, packFlap, player.scarf,
    player.armL, player.armR, player.legL, player.legR);
  shadows(player.group);
  scene.add(player.group);
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
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xb5484d });
  const accentMat = new THREE.MeshLambertMaterial({ color: 0xf6e7cf });

  const chassis = mesh(GEO.box, MAT.darkMetal, 1.7, 0.44, 8.8);
  chassis.position.y = 0.32;
  const hood = mesh(GEO.box, bodyMat, 1.84, 1.15, 5.6);
  hood.position.set(0, 1.12, 1.4);
  const cab = mesh(GEO.box, bodyMat, 1.88, 2.5, 3.0);
  cab.position.set(0, 1.45, -2.6);
  const cabRoof = mesh(GEO.box, accentMat, 2.0, 0.18, 3.3);
  cabRoof.position.set(0, 2.76, -2.6);
  const stripe = mesh(GEO.box, accentMat, 1.9, 0.2, 5.6);
  stripe.position.set(0, 1.52, 1.4);
  const band = mesh(GEO.box, MAT.glass, 1.92, 0.52, 2.2);
  band.position.set(0, 2.05, -2.6);
  const facePlate = mesh(GEO.box, MAT.glass, 1.3, 0.5, 0.08);
  facePlate.position.set(0, 2.0, -1.02);

  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.55, 10), MAT.darkMetal);
  chimney.position.set(0, 1.98, 3.3);
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.3, 10), accentMat);
  dome.position.set(0, 1.85, 2.1);

  const cow = mesh(GEO.box, MAT.darkMetal, 1.5, 0.72, 0.72);
  cow.position.set(0, 0.42, 4.55);
  cow.rotation.x = 0.72;

  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe9b8 }),
  );
  light.position.set(0, 1.55, 4.32);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color: 0xffd28a, transparent: true, opacity: 0.9, depthWrite: false,
  }));
  glow.scale.setScalar(1.7);
  glow.position.set(0, 1.55, 4.5);

  // Pool of headlight on the ballast ahead — reads beautifully at dusk.
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 6.4), MAT.lightCone);
  beam.rotation.x = -Math.PI / 2;
  beam.position.set(0, 0.26, 7.6);

  const wheels = [];
  for (const wz of [2.6, 0, -2.6]) {
    for (const wx of [-1.0, 1.0]) {
      const w = new THREE.Mesh(GEO.wheel, MAT.darkMetal);
      w.scale.set(0.37, 0.1, 0.37);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.37, wz);
      g.add(w);
      wheels.push(w);
    }
  }

  g.add(chassis, hood, cab, cabRoof, stripe, band, facePlate, chimney, dome, cow, light, glow, beam);
  shadows(g);
  g.userData.hit = { hw: 0.98, y0: 0, y1: 2.85, hd: 4.7 };
  g.userData.span = 11.5;
  g.userData.paint = { bodyMat, accentMat };
  g.userData.wheels = wheels;
  g.userData.smokeT = 0;
  g.userData.swayPhase = Math.random() * Math.PI * 2;
  return g;
}

function makeCrate() {
  const g = new THREE.Group();
  const core = mesh(GEO.box, MAT.crateWood, 1.06, 1.06, 1.06);
  core.position.y = 0.56;
  g.add(core);
  for (const cx of [-0.5, 0.5]) {
    for (const cz of [-0.5, 0.5]) {
      const post = mesh(GEO.box, MAT.crateFrame, 0.15, 1.12, 0.15);
      post.position.set(cx, 0.56, cz);
      g.add(post);
    }
  }
  for (const sz of [-0.56, 0.56]) {
    for (const rot of [0.78, -0.78]) {
      const brace = mesh(GEO.box, MAT.crateFrame, 1.35, 0.11, 0.05);
      brace.position.set(0, 0.56, sz);
      brace.rotation.z = rot;
      g.add(brace);
    }
  }
  g.rotation.y = Math.random() * 0.4 - 0.2;
  shadows(g);
  g.userData.hit = { hw: 0.6, y0: 0, y1: 1.15, hd: 0.62 };
  g.userData.span = 2.2;
  return g;
}

function makeLowBarrier() {
  const g = new THREE.Group();
  const bar = mesh(GEO.box, MAT.hazard, 1.9, 0.36, 0.28);
  bar.position.y = 0.62;
  const legL = mesh(GEO.box, MAT.barrierLowLeg, 0.12, 0.62, 0.22);
  legL.position.set(-0.82, 0.31, 0);
  const legR = mesh(GEO.box, MAT.barrierLowLeg, 0.12, 0.62, 0.22);
  legR.position.x = 0.82;
  g.add(bar, legL, legR);
  shadows(g);
  g.userData.hit = { hw: 0.95, y0: 0.45, y1: 0.8, hd: 0.3 }; // jump over
  g.userData.span = 2.2;
  return g;
}

function makeHighBarrier() {
  const g = new THREE.Group();
  const top = mesh(GEO.box, MAT.hazard, 2.0, 0.6, 0.18);
  top.position.y = 2.32;
  const lip = mesh(GEO.box, MAT.darkMetal, 2.04, 0.1, 0.24);
  lip.position.y = 2.0;
  const postL = mesh(GEO.box, MAT.barrierLowLeg, 0.12, 2.05, 0.22);
  postL.position.set(-0.92, 1.02, 0);
  const postR = mesh(GEO.box, MAT.barrierLowLeg, 0.12, 2.05, 0.22);
  postR.position.x = 0.92;
  g.add(top, lip, postL, postR);
  shadows(g);
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
const SPAWN_Z = new Map([
  [trains, CONFIG.trainSpawnZ],
  [crates, CONFIG.spawnAheadZ],
  [lowBarriers, CONFIG.spawnAheadZ],
  [highBarriers, CONFIG.spawnAheadZ],
]);

/* Coins: instanced — one draw call for all gold. Coins face the camera; no spin. */
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
const coinScale = new THREE.Vector3();
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
  const halo = mesh(GEO.circle, MAT.halo, 1.5, 1.5, 1);
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.06;
  holder.add(magnet, shoes, halo);
  holder.userData.kind = 'magnet';
  holder.userData.phase = Math.random() * Math.PI * 2;
  holder.userData.hit = { hw: 0.6, y0: 0.3, y1: 1.8, hd: 0.6 };
  holder.userData.span = 2.2;
  holder.userData.setKind = (kind) => {
    holder.children[0].visible = kind === 'magnet';
    holder.children[1].visible = kind !== 'magnet';
    holder.userData.kind = kind;
  };
  shadows(holder);
  return holder;
});

/* Particles: tiny pooled boxes with velocity + life. */
const particles = new Pool(110, () => {
  const p = mesh(GEO.box, MAT.particle.clone(), 0.14, 0.14, 0.14);
  p.userData.vel = new THREE.Vector3();
  p.userData.life = 0;
  p.userData.grav = 22;
  return p;
});

function burst(x, y, z, colorHex, count = 10, spread = 4, opts = {}) {
  const n = REDUCED_MOTION ? Math.ceil(count / 2) : count;
  for (let i = 0; i < n; i += 1) {
    const p = particles.get();
    if (!p) return;
    p.material.color.set(colorHex);
    p.position.set(x, y, z);
    p.scale.setScalar(opts.size ?? 1);
    p.visible = true;
    p.userData.active = true;
    p.userData.life = 0.5 + Math.random() * 0.3;
    p.userData.grav = opts.grav ?? 22;
    p.userData.vel.set(
      (Math.random() - 0.5) * spread,
      opts.riseUp ? 1.6 + Math.random() * spread * 0.5 : Math.random() * spread * 0.9 + 1.5,
      (Math.random() - 0.5) * spread,
    );
  }
}
function smokePuff(x, y, z) {
  const p = particles.get();
  if (!p) return;
  p.material.color.set(pick([0x9c8ba8, 0x8a7a96, 0xac9cb4]));
  p.position.set(x, y, z);
  p.scale.setScalar(0.7 + Math.random() * 0.5);
  p.visible = true;
  p.userData.active = true;
  p.userData.life = 0.7 + Math.random() * 0.3;
  p.userData.grav = -2.5; // buoyant
  p.userData.vel.set((Math.random() - 0.5) * 0.8, 1.8 + Math.random(), (Math.random() - 0.5) * 0.8 - 1.2);
}

/* Expanding pickup rings for coins (per-instance material for the fade). */
const rings = new Pool(8, () => {
  const r = new THREE.Mesh(GEO.ring, MAT.ring.clone());
  r.userData.life = 0;
  return r;
});
function spawnRing(x, y, z) {
  const r = rings.get();
  if (!r) return;
  r.position.set(x, y, z);
  r.scale.setScalar(0.5);
  r.material.opacity = 0.95;
  r.visible = true;
  r.userData.active = true;
  r.userData.life = 0.32;
}
function updateRings(dt) {
  rings.forEachActive((r) => {
    r.userData.life -= dt;
    if (r.userData.life <= 0) { rings.release(r); return; }
    const t = 1 - r.userData.life / 0.32;
    r.scale.setScalar(0.5 + t * 1.5);
    r.material.opacity = 0.95 * (1 - t);
  });
}

/* Tumbleweeds cross far off-lane now and then; purely decorative. */
const tumbleweeds = new Pool(2, () => {
  const t = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), MAT.tumbleweed);
  t.userData.vx = 0;
  return t;
});
let tumbleweedTimer = 9;

/* ------------------------------------------------------- set-pieces */
const TUNNEL_LEN = 50;

function makeTower() {
  const g = new THREE.Group();
  for (const [lx, lz] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) {
    const leg = mesh(GEO.box, MAT.pole, 0.22, 3.4, 0.22);
    leg.position.set(lx, 1.7, lz);
    leg.rotation.z = lx > 0 ? -0.06 : 0.06;
    leg.rotation.x = lz > 0 ? 0.06 : -0.06;
    g.add(leg);
  }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 2.6, 14), MAT.rust);
  tank.position.y = 4.4;
  g.add(tank);
  for (const hy of [3.45, 5.35]) {
    const hoop = new THREE.Mesh(new THREE.CylinderGeometry(1.94, 1.94, 0.12, 14), MAT.darkMetal);
    hoop.position.y = hy;
    g.add(hoop);
  }
  const roof = new THREE.Mesh(GEO.cone, MAT.pole);
  roof.scale.set(2.05, 1.1, 2.05);
  roof.position.y = 6.25;
  g.add(roof);
  const ladder = mesh(GEO.box, MAT.darkMetal, 0.1, 3.4, 0.1);
  ladder.position.set(1.98, 2.2, 0);
  g.add(ladder);
  shadows(g);
  return g;
}
const towers = new Pool(3, makeTower);

/* Arched stone tunnel: half-torus vault ribs + skirts + portals. Decorative,
   no collision; ceiling radius keeps full jumps safe inside. */
function makeTunnel() {
  const g = new THREE.Group();
  const linerGeo = new THREE.TorusGeometry(4.2, 0.6, 9, 14, Math.PI);
  const ribGeo = new THREE.TorusGeometry(4.32, 0.72, 9, 14, Math.PI);
  for (let i = 0; i < 11; i += 1) {
    const ribbed = i % 3 === 0;
    const seg = new THREE.Mesh(ribbed ? ribGeo : linerGeo, ribbed ? MAT.tunnelRib : MAT.tunnelLiner);
    seg.position.z = -i * 5;
    g.add(seg);
  }
  for (const sx of [-4.85, 4.85]) {
    const skirt = mesh(GEO.box, MAT.tunnelSkirt, 0.7, 2.4, TUNNEL_LEN);
    skirt.position.set(sx, 1.2, -TUNNEL_LEN / 2);
    g.add(skirt);
  }
  const portalGeo = new THREE.TorusGeometry(4.55, 0.85, 10, 16, Math.PI);
  for (const pz of [0, -TUNNEL_LEN]) {
    const portal = new THREE.Mesh(portalGeo, MAT.tunnelRib);
    portal.position.z = pz;
    g.add(portal);
  }
  for (const lx of [-3.4, 3.4]) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe9b8 }),
    );
    lamp.position.set(lx, 3.4, 0.4);
    g.add(lamp);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color: 0xffb070, transparent: true, opacity: 0.8, depthWrite: false,
  }));
  glow.scale.setScalar(2.4);
  glow.position.set(0, 3.55, 0.55);
  g.add(glow);
  shadows(g);
  g.userData.len = TUNNEL_LEN;
  return g;
}
const tunnels = new Pool(2, makeTunnel);

/* Distance-based scheduler, same pattern as spawner but for scenery pieces. */
const setPieces = {
  nextTunnelAt: 320,
  nextTowerAt: 170,
  towerSide: 1,
  wasInsideTunnel: false,

  reset() {
    this.nextTunnelAt = 320;
    this.nextTowerAt = 170;
    this.towerSide = 1;
    this.wasInsideTunnel = false;
  },

  update(travel) {
    if (travel >= this.nextTunnelAt) {
      const t = tunnels.get();
      if (t) {
        t.position.set(0, 0, -150);
        t.visible = true;
        t.userData.active = true;
        this.nextTunnelAt = travel + 420 + Math.random() * 260;
      } else {
        this.nextTunnelAt = travel + 60; // both busy — retry soon
      }
    }
    if (travel >= this.nextTowerAt) {
      const w = towers.get();
      if (w) {
        this.towerSide *= -1;
        w.position.set(this.towerSide * (9.5 + Math.random() * 3), 0, -140);
        w.rotation.y = Math.random() * Math.PI * 2;
        w.visible = true;
        w.userData.active = true;
        this.nextTowerAt = travel + 240 + Math.random() * 260;
      } else {
        this.nextTowerAt = travel + 60;
      }
    }
  },
};

/* ------------------------------------------------------------------ spawner */
const spawner = {
  nextEventDist: 40,
  laneBusyUntilDist: [0, 0, 0], // travel distance at which each lane frees up

  reset() {
    this.nextEventDist = 40;
    this.laneBusyUntilDist = [0, 0, 0];
  },

  place(pool, lane, z) {
    const obj = pool.get();
    if (!obj) return null;
    obj.position.set(CONFIG.lanes[lane], 0, z ?? SPAWN_Z.get(pool) ?? CONFIG.spawnAheadZ);
    obj.visible = true;
    obj.userData.active = true;
    if (obj.userData.paint) {
      const pal = pick(TRAIN_PALETTES); // fresh livery every spawn
      obj.userData.paint.bodyMat.color.setHex(pal.body);
      obj.userData.paint.accentMat.color.setHex(pal.accent);
    }
    obj.userData.horned = false;
    return obj;
  },

  update(travel) {
    while (travel >= this.nextEventDist) {
      const order = [0, 1, 2].sort(() => Math.random() - 0.5);
      // Lanes whose previous obstacle (esp. a long, fast train) hasn't fully
      // cleared the spawn window are off limits this event.
      const avail = order.filter((l) => this.laneBusyUntilDist[l] <= travel);

      if (avail.length > 0) {
        const freeLane = avail[randInt(avail.length)];
        const candidates = avail.filter((l) => l !== freeLane);
        const blockedCount = Math.min(candidates.length, Math.random() < 0.42 ? 2 : 1);
        const blocked = candidates.sort(() => Math.random() - 0.5).slice(0, blockedCount);

        for (const lane of blocked) {
          const chosen = weightedPick(obstaclePools);
          const obj = this.place(chosen.pool, lane);
          if (obj) this.laneBusyUntilDist[lane] = travel + obj.userData.span;
        }

        // Guaranteed-free lane carries the coin line.
        for (let i = 0; i < CONFIG.coinLineLength; i += 1) {
          const slot = coinState.findIndex((c) => !c.active);
          if (slot === -1) break;
          coinState[slot].active = true;
          coinState[slot].x = CONFIG.lanes[freeLane];
          coinState[slot].y = 1.05;
          coinState[slot].z = CONFIG.spawnAheadZ + 2 + i * 1.4;
        }

        // Occasional power-up right after (closer than) the obstacle wall.
        if (Math.random() < CONFIG.powerupChance) {
          const pu = this.place(powerups, freeLane, CONFIG.spawnAheadZ + 6);
          if (pu) pu.userData.setKind(Math.random() < 0.5 ? 'magnet' : 'shoes');
        }
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
  lastDz: 0,
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
    Object.assign(player, {
      lane: 1, x: 0, y: 0, vy: 0, sliding: 0, grounded: true,
      pendingJumpT: 0, fastFall: false, squashT: 0,
      rollT: 0, slideTotal: CONFIG.slideDuration,
      laneFrom: 0, laneT: CONFIG.laneStepTime, jumpCutUsed: false,
      corpseActive: false,
    });
    player.group.position.set(0, 0, 0);
    player.group.rotation.set(0, 0, 0);
    player.group.scale.set(1, 1, 1);
    trains.reset(); crates.reset(); lowBarriers.reset(); highBarriers.reset();
    powerups.reset(); particles.reset();
    rings.reset(); tumbleweeds.reset(); tunnels.reset(); towers.reset();
    coinState.forEach((c) => { c.active = false; });
    spawner.reset();
    setPieces.reset();
    legSwingPhase = 0;
    runDustT = 0;

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
      // Inputs held during the pause must not fire on resume.
      input.left = input.right = input.jump = input.slide = false;
      player.pendingJumpT = 0;
      this.lastT = performance.now();
      if (musicWanted) sfx.syncMusic(true);
      requestAnimationFrame(loop);
    }
  },

  switchLane(dir) {
    const next = clamp(player.lane + dir, 0, 2);
    if (next !== player.lane) {
      // Fixed-duration step; re-targeting mid-move restarts from current x.
      player.laneFrom = player.x;
      player.laneT = 0;
      player.lane = next;
      sfx.lane();
    }
  },

  doJump() {
    if (player.grounded) {
      player.sliding = 0; // jump cancels a slide
      player.vy = CONFIG.jumpVelocity * (this.jumpBoostT > 0 ? CONFIG.highJumpMultiplier : 1);
      player.grounded = false;
      player.jumpCutUsed = false;
      sfx.jump();
    } else {
      player.pendingJumpT = CONFIG.jumpBufferTime; // buffered until touchdown
    }
  },

  doSlide() {
    if (player.grounded) {
      if (player.sliding <= 0) sfx.slide();
      player.sliding = CONFIG.slideDuration;
      player.slideTotal = CONFIG.slideDuration;
      player.rollT = 0;
    } else {
      player.vy = Math.min(player.vy, -16); // fast-fall into a landing roll
      player.fastFall = true;
    }
  },

  gameOver() {
    this.state = 'over';
    sfx.crash();
    sfx.syncMusic(false);
    this.shakeT = REDUCED_MOTION ? 0 : 0.5;
    player.corpseActive = true;
    burst(player.x, 1, 0, 0xff8a3d, 14, 7, { size: 1.4 });
    burst(player.x, 1.2, 0, 0xc9566b, 8, 6, { size: 1.1 });
    burst(player.x, 1.4, 0, 0xf6e7cf, 10, 5);

    if (!REDUCED_MOTION && ui.flash) {
      ui.flash.style.transition = 'none';
      ui.flash.style.opacity = '0.75';
      setTimeout(() => {
        ui.flash.style.transition = 'opacity .4s ease-out';
        ui.flash.style.opacity = '0';
      }, 30);
    }

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

  try {
    // Wrecked runner tumbles to the ground instead of freezing mid-air.
    if (player.corpseActive) {
      player.vy -= CONFIG.gravity * 0.6 * dt;
      player.y = Math.max(0, player.y + player.vy * dt);
      player.group.rotation.x = Math.min(player.group.rotation.x + dt * 5, 1.45);
      player.group.position.set(player.x, player.y, 0);
      if (player.y <= 0 && player.vy < 0) player.corpseActive = false;
    }
    updateParticles(dt);
    updateCamera(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(loopOver);
  } catch (err) {
    haltWithError(err);
  }
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
const tmpV3 = new THREE.Vector3();

function advanceTrains(dt, dz) {
  trains.forEachActive((o) => {
    o.position.z += dz * CONFIG.trainSpeedMult;

    if (!o.userData.horned && o.position.z > -78) {
      o.userData.horned = true;
      sfx.horn();
    }
    o.rotation.z = Math.sin(game.distance * 0.35 + o.userData.swayPhase) * 0.012;
    // Wheels are tipped by rotation.z=PI/2, so world-X is their axle.
    for (const w of o.userData.wheels) w.rotation.x -= (dz * CONFIG.trainSpeedMult) / 0.37;

    o.userData.smokeT -= dt;
    if (o.userData.smokeT <= 0) {
      o.userData.smokeT = 0.16 + Math.random() * 0.1;
      tmpV3.set(0, 2.35, 3.3).applyMatrix4(o.matrixWorld);
      smokePuff(tmpV3.x, tmpV3.y, tmpV3.z);
    }

    if (o.position.z > CONFIG.despawnZ) trains.release(o);
  });
}

function scrollWorld(dt) {
  const dz = game.speed * dt;
  game.distance += dz;
  game.score += dz * CONFIG.scorePerUnit;
  game.lastDz = dz;

  // Sleepers wrap within their gap for a seamless treadmill.
  sleeperOffset = (sleeperOffset + dz) % SLEEPER_GAP;
  let idx = 0;
  for (let row = 0; row < SLEEPER_ROWS; row += 1) {
    for (const lx of CONFIG.lanes) {
      sleeperMatrix.makeScale(1.7, 0.1, 0.55);
      sleeperMatrix.setPosition(lx, 0.14, CONFIG.despawnZ - row * SLEEPER_GAP + sleeperOffset);
      sleepers.setMatrixAt(idx, sleeperMatrix);
      idx += 1;
    }
  }
  sleepers.instanceMatrix.needsUpdate = true;

  mountainsFar.advance(dz);
  mountainsNear.advance(dz);
  clouds.advance(dz);
  clouds.items.forEach((c) => { c.position.x += c.userData.drift * dt; });
  cacti.advance(dz);
  shrubs.advance(dz);
  poles.advance(dz);
  gantries.advance(dz);

  const advance = (pool) => pool.forEachActive((o) => {
    o.position.z += dz;
    if (o.position.z > CONFIG.despawnZ) pool.release(o);
  });
  advance(crates); advance(lowBarriers); advance(highBarriers);
  advance(towers);
  advanceTrains(dt, dz);

  // Tunnels: origin sits at the entrance (+z end), vault trails to -LEN.
  tunnels.forEachActive((o) => {
    o.position.z += dz;
    if (o.position.z - TUNNEL_LEN > CONFIG.despawnZ) tunnels.release(o);
  });

  // Gantry beams would clip through the vault — hide them inside tunnels.
  for (const gt of gantries.items) {
    let hide = false;
    tunnels.forEachActive((tn) => {
      if (gt.position.z < tn.position.z + 2 && gt.position.z > tn.position.z - TUNNEL_LEN - 2) hide = true;
    });
    gt.visible = !hide;
  }

  // Tunnel-entry whoosh.
  let insideTunnel = false;
  tunnels.forEachActive((tn) => {
    if (tn.position.z >= 0 && tn.position.z <= TUNNEL_LEN) insideTunnel = true;
  });
  if (insideTunnel && !setPieces.wasInsideTunnel) sfx.tunnel();
  setPieces.wasInsideTunnel = insideTunnel;

  // Tumbleweeds: world-scrolled drift with a lateral push and a roll.
  tumbleweedTimer -= dt;
  if (tumbleweedTimer <= 0) {
    tumbleweedTimer = 12 + Math.random() * 10;
    const tw = tumbleweeds.get();
    if (tw) {
      const side = Math.random() < 0.5 ? -1 : 1;
      tw.visible = true;
      tw.userData.active = true;
      tw.position.set(side * (8 + Math.random() * 6), 0.55, -100 - Math.random() * 20);
      tw.userData.vx = -side * (1.2 + Math.random());
    }
  }
  tumbleweeds.forEachActive((tw) => {
    tw.position.z += dz;
    tw.position.x += tw.userData.vx * dt;
    tw.rotation.x += dz / 0.55;
    tw.rotation.y += tw.userData.vx * dt / 0.55;
    if (tw.position.z > CONFIG.despawnZ || Math.abs(tw.position.x) > 22) tumbleweeds.release(tw);
  });

  powerups.forEachActive((o) => {
    o.position.z += dz;
    o.position.y = 0;
    o.children[0].rotation.z += dt * 2.4;
    o.children[1].rotation.y += dt * 2.8;
    const pulse = 1 + Math.sin(game.distance * 3 + o.userData.phase) * 0.12;
    const halo = o.children[2];
    halo.material.opacity = 0.22 + Math.sin(game.distance * 3 + o.userData.phase) * 0.1;
    halo.scale.set(1.5 * pulse, 1.5 * pulse, 1);
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

function updateStreaks(dt) {
  const ratio = clamp((game.speed - 18) / (CONFIG.maxSpeed - 18), 0, 1);
  const targetOpacity = ratio * 0.5;
  MAT.streak.opacity = damp(MAT.streak.opacity, targetOpacity, 6, dt);
  if (MAT.streak.opacity < 0.01) return;
  const boost = 1 + ratio * 0.8;
  for (let i = 0; i < STREAK_COUNT; i += 1) {
    const s = streakSeeds[i];
    s.z += game.speed * boost * dt;
    if (s.z > 14) s.z -= 84;
    streakMatrix.makeScale(1, 1, 1 + ratio * 1.6);
    streakMatrix.setPosition(s.x, s.y, s.z);
    streaks.setMatrixAt(i, streakMatrix);
  }
  streaks.instanceMatrix.needsUpdate = true;
}

function drawCoins(spinAngle, timeSec) {
  for (let i = 0; i < COIN_COUNT; i += 1) {
    const c = coinState[i];
    if (!c.active) {
      coinScale.set(1, 1, 1);
      coinMatrix.compose(HIDDEN_POS, coinQuat.identity(), coinScale);
    } else {
      const pulse = 1 + Math.sin(timeSec * 6 + i * 1.7) * 0.12;
      coinEuler.set(Math.PI / 2, 0, spinAngle);
      coinQuat.setFromEuler(coinEuler);
      coinPos.set(c.x, c.y + pulse * 0.06, c.z);
      coinScale.set(pulse, pulse, pulse);
      coinMatrix.compose(coinPos, coinQuat, coinScale);
    }
    coinMesh.setMatrixAt(i, coinMatrix);
  }
  coinMesh.instanceMatrix.needsUpdate = true;
}

function playerAABB(sweep) {
  const h = player.sliding > 0 ? CONFIG.playerSlideHeight : CONFIG.playerHeight;
  return {
    x: player.x, hw: CONFIG.playerHalfWidth,
    y0: player.y, y1: player.y + h,
    hd: 0.38 + sweep, // swept along z so thin obstacles can't tunnel at low fps
  };
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
  const p = playerAABB(game.lastDz * CONFIG.trainSpeedMult);

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
      spawnRing(c.x, c.y, c.z);
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
let runDustT = 0;

function animateScarf(timeSec) {
  const posAttr = player.scarf.geometry.attributes.position;
  const base = player.scarf.userData.base;
  for (let i = 0; i < posAttr.count; i += 1) {
    const row = i >> 1;
    const f = row / 7; // 0 at the neck, 1 at the tail
    posAttr.array[i * 3] = base[i * 3]
      + Math.sin(timeSec * 9 + f * 4) * 0.09 * f; // lateral flutter
    posAttr.array[i * 3 + 1] = base[i * 3 + 1] * (1 - f * 0.2)
      + Math.sin(timeSec * 7 + f * 3) * 0.05 * f; // lift wave along the trail
  }
  posAttr.needsUpdate = true;
}

function updatePlayer(dt) {
  if (input.left) { input.left = false; game.switchLane(-1); }
  if (input.right) { input.right = false; game.switchLane(1); }
  if (input.jump) { input.jump = false; game.doJump(); }
  if (input.slide) { input.slide = false; game.doSlide(); }

  const wasGrounded = player.grounded;
  const targetX = CONFIG.lanes[player.lane];
  // Fixed-duration cubic ease-out lane step: crisp arcade step, no drift tail.
  if (player.laneT < CONFIG.laneStepTime) {
    player.laneT = Math.min(CONFIG.laneStepTime, player.laneT + dt);
    const t = player.laneT / CONFIG.laneStepTime;
    const e = 1 - (1 - t) ** 3;
    player.x = player.laneFrom + (targetX - player.laneFrom) * e;
  }

  if (!player.grounded) {
    player.vy -= CONFIG.gravity * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0; player.vy = 0; player.grounded = true;
    }
  }
  if (player.pendingJumpT > 0) player.pendingJumpT -= dt;

  // Touchdown: squash + dust + consume buffered jump / fast-fall roll.
  if (!wasGrounded && player.grounded) {
    player.squashT = 0.18;
    sfx.land();
    burst(player.x, 0.15, 0.3, 0x8a7590, 6, 2.2, { size: 0.7, grav: 10 });
    if (player.pendingJumpT > 0) {
      player.pendingJumpT = 0;
      game.doJump();
    } else if (player.fastFall) {
      player.sliding = CONFIG.autoSlideAfterFastFall;
      player.slideTotal = CONFIG.autoSlideAfterFastFall;
      player.rollT = 0;
    }
    player.fastFall = false;
  }
  if (player.squashT > 0) player.squashT = Math.max(0, player.squashT - dt);
  if (player.sliding > 0) player.sliding = Math.max(0, player.sliding - dt);

  const g = player.group;
  const sliding = player.sliding > 0;
  const bob = player.grounded && !sliding ? Math.abs(Math.sin(legSwingPhase)) * 0.07 : 0;
  g.position.set(player.x, player.y + bob, 0);
  g.rotation.z = damp(g.rotation.z, (targetX - player.x) * -0.14, 12, dt);
  // Body yaw toward the lane being taken — makes the step readable.
  g.rotation.y = damp(g.rotation.y, clamp((targetX - player.x) * 0.3, -0.42, 0.42), 10, dt);

  animateScarf(game.runTime);

  // Small dust kicks under the feet while running.
  runDustT -= dt;
  if (player.grounded && !sliding && runDustT <= 0) {
    runDustT = 0.24;
    burst(player.x + (Math.random() - 0.5) * 0.3, 0.12, 0.45, 0x7d6a86, 1, 1.2, { size: 0.55, grav: 6 });
  }

  if (sliding) {
    // Forward roll: one clean revolution across the slide's own duration.
    player.rollT += dt;
    const t = clamp(player.rollT / player.slideTotal, 0, 1);
    g.rotation.x = -Math.PI * 2 * t;
    g.scale.set(1, 0.78, 1);
    player.legL.rotation.x = 1.1;
    player.legR.rotation.x = 1.1;
    player.armL.rotation.x = -0.9;
    player.armR.rotation.x = -0.9;
  } else {
    const airTuck = player.grounded ? 0 : 1;
    g.rotation.x = player.grounded
      ? damp(g.rotation.x % (Math.PI * 2), 0, 14, dt)
      : clamp(-player.vy * 0.02, -0.35, 0.3);
    const squash = 1 - Math.sin((player.squashT / 0.18) * Math.PI) * 0.2;
    g.scale.set(1, squash, 1);

    legSwingPhase += dt * (player.grounded ? game.speed * 1.6 : 2);
    const swing = player.grounded ? Math.sin(legSwingPhase) * 0.75 : 0.55;
    player.legL.rotation.x = swing * (airTuck ? 0.4 : 1) + airTuck * 0.55;
    player.legR.rotation.x = -swing * (airTuck ? 0.4 : 1) + airTuck * 0.55;
    player.armL.rotation.x = -swing * 0.8 - airTuck * 0.4;
    player.armR.rotation.x = swing * 0.8 - airTuck * 0.4;
  }

  const speedRatio = (game.speed - CONFIG.baseSpeed) / (CONFIG.maxSpeed - CONFIG.baseSpeed);

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

  return speedRatio;
}

function updateCamera(dt, speedRatio = 0) {
  // Higher overview POV; follow-x loose enough (0.6 vs lookAt 0.35) that the
  // runner visibly travels each lane while the camera keeps the track ahead.
  camera.position.x = damp(camera.position.x, player.x * 0.6, 6.5, dt);
  const shake = game.shakeT > 0 && !REDUCED_MOTION ? (Math.random() - 0.5) * game.shakeT * 2.2 : 0;
  camera.position.y = 4.9 + Math.sin(game.distance * 1.4) * 0.04 + shake;
  camera.lookAt(player.x * 0.35, 1.3, -10);
  // FOV kick sells acceleration.
  const targetFov = baseFov + speedRatio * 7;
  if (Math.abs(camera.fov - targetFov) > 0.01) {
    camera.fov = damp(camera.fov, targetFov, 4, dt);
    camera.updateProjectionMatrix();
  }
  if (game.shakeT > 0) game.shakeT = Math.max(0, game.shakeT - dt * 2.4);
}

function updateParticles(dt) {
  particles.forEachActive((p) => {
    p.userData.life -= dt;
    if (p.userData.life <= 0) { particles.release(p); return; }
    p.userData.vel.y -= p.userData.grav * dt;
    p.position.addScaledVector(p.userData.vel, dt);
    p.scale.multiplyScalar(clamp(1 - dt * 1.4, 0.4, 1));
    p.rotation.x += dt * 9;
    p.rotation.y += dt * 7;
  });
}

/* A mid-run crash must never freeze the canvas silently again. */
function haltWithError(err) {
  console.error('[Rail Rush]', err);
  sfx.syncMusic(false);
  game.state = 'paused';
  ui.hud.hidden = true;
  ui.power.hidden = true;
  ui.bootTitle.textContent = 'RUNTIME ERROR';
  ui.bootMsg.textContent = String(err?.message ?? err);
  ui.controls.hidden = true;
  ui.start.hidden = true;
  ui.boot.hidden = false;
}

function loop(now) {
  if (game.state !== 'running') return;
  const dt = Math.min(0.05, (now - game.lastT) / 1000 || 0.016);
  game.lastT = now;

  try {
    game.runTime += dt;
    // Brief acceleration burst at the start of each run.
    game.speed = Math.min(CONFIG.maxSpeed, (CONFIG.baseSpeed + game.runTime * CONFIG.speedRamp)
      * clamp(game.runTime / CONFIG.startBoostTime, 0.72, 1));

    scrollWorld(dt);
    spawner.update(game.distance);
    setPieces.update(game.distance);
    const speedRatio = updatePlayer(dt);
    checkCollisions();
    updateParticles(dt);
    updateRings(dt);
    updateStreaks(dt);
    updateCamera(dt, speedRatio);
    drawCoins(0, now / 1000); // fixed angle: coins stay camera-facing

    renderer.render(scene, camera);

    ui.score.textContent = String(Math.floor(game.score));
    ui.coins.textContent = String(game.coins);
    requestAnimationFrame(loop);
  } catch (err) {
    haltWithError(err);
  }
}

/* -------------------------------------------------------------------- view */
function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  const portrait = window.innerHeight > window.innerWidth;
  baseFov = portrait ? 76 : 64;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = baseFov;
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
bootDone = true;
ui.bootMsg.textContent = `${game.best > 0 ? `Best: ${game.best} · ` : ''}Ready on platform 3.`;
ui.controls.hidden = false;
ui.start.hidden = false;

// Render one ambient frame so the track is visible behind the boot screen.
scrollWorld(0);
drawCoins(0, 0);
updateStreaks(0);
renderer.render(scene, camera);
