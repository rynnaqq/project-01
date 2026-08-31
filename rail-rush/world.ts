/* =============================================================================
   RAIL RUSH — static environment, sky, and scrolling treadmills.
   Construction-time module: builds everything that never collides and recycles
   behind the camera. Runtime advance() calls come from game.ts per frame.
   ========================================================================== */
import * as THREE from 'three';
import { CONFIG } from './config';
import { GEO, type Assets, mesh, shadows } from './assets';
import { createScenery } from './scenery';

export type Treadmill = ReturnType<typeof makeTreadmill>;

/* Scrolling scenery treadmill: fixed spacing, wraps behind the camera.
   Every layer scrolls at its own fraction of world speed for parallax. */
export function makeTreadmill(
  scene: THREE.Scene,
  count: number,
  spacing: number,
  speedFactor: number,
  factory: (i: number) => THREE.Object3D,
  jitterZ = 0,
) {
  const items: THREE.Object3D[] = [];
  for (let i = 0; i < count; i += 1) {
    const obj = factory(i);
    obj.position.z = CONFIG.despawnZ - i * spacing - Math.random() * jitterZ;
    scene.add(obj);
    items.push(obj);
  }
  return {
    items,
    advance(dz: number) {
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

const randInt = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(arr: T[]): T => arr[randInt(arr.length)];

export function createWorld(
  scene: THREE.Scene,
  assets: Assets,
) {
  const MAT_ = assets.MAT;
  const textures = assets.textures;

  /* ------------------------------------------------- sky dome & sun disc */
  const tmpStarDir = new THREE.Vector3();
  {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(480, 24, 14),
      new THREE.MeshBasicMaterial({ map: textures.sky, side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    sky.renderOrder = -3;
    scene.add(sky);

    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(CONFIG.sunRadius, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe6ae, fog: false, depthWrite: false }),
    );
    sun.position.set(...CONFIG.sunPosition);
    sun.lookAt(0, 0, 0);
    sun.renderOrder = -2;
    scene.add(sun);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: textures.glow, color: 0xffcf8a, transparent: true, opacity: 0.85, fog: false, depthWrite: false,
    }));
    halo.position.copy(sun.position);
    halo.scale.setScalar(CONFIG.sunHaloScale);
    halo.renderOrder = -2;
    scene.add(halo);

    // Faint stars in the upper dome — dusk deepening overhead.
    const starPos = new Float32Array(CONFIG.starCount * 3);
    for (let i = 0; i < CONFIG.starCount; i += 1) {
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

  /* ------------------------------------------------------- static ground */
  {
    // Huge so no edge ever enters even ultrawide FOVs (fog ends at ~105 but
    // sky-colored void beyond a ground edge would read as "the world pans").
    const ground = mesh(GEO.box, MAT_.ground, CONFIG.groundSpan[0], 1, CONFIG.groundSpan[1]);
    ground.position.set(0, -0.51, -230);
    ground.receiveShadow = true;
    scene.add(ground);

    const bed = mesh(GEO.box, MAT_.ballast, CONFIG.ballastSpan[0], 0.24, CONFIG.ballastSpan[1]);
    bed.position.set(0, 0.02, -135);
    bed.receiveShadow = true;
    scene.add(bed);

    for (const lx of CONFIG.lanes) {
      for (const rx of [-CONFIG.railGaugeOffset, CONFIG.railGaugeOffset]) {
        const rail = mesh(GEO.box, MAT_.rail, 0.14, 0.14, CONFIG.railSpan);
        rail.position.set(lx + rx, 0.2, -135);
        scene.add(rail);
      }
    }
  }

  /* Drifting dusk clouds. */
  const clouds = makeTreadmill(scene, 7, 34, 0.06, () => {
    const g = new THREE.Group();
    const puffs = [[0, 0, 0, 2.6, 1.1, 1.5], [1.8, -0.2, 0.4, 1.7, 0.85, 1.1], [-1.9, -0.25, -0.3, 1.5, 0.8, 1]];
    for (const [x, y, z, sx, sy, sz] of puffs) {
      const p = mesh(GEO.puff, MAT_.cloud, sx, sy, sz);
      p.position.set(x, y, z);
      g.add(p);
    }
    g.position.set((Math.random() - 0.5) * 90, 22 + Math.random() * 14, 0);
    g.userData.drift = (Math.random() - 0.5) * 0.6;
    g.userData.respin = (o: THREE.Object3D) => { o.position.x = (Math.random() - 0.5) * 90; };
    return g;
  }, 12);

  /* Trackside dressing: cacti, rocks, telegraph poles, catenary gantries. */
  const cacti = makeTreadmill(scene, 10, 19, 1, () => {
    const g = new THREE.Group();
    const h = 1.6 + Math.random() * 1.1;
    const trunk = mesh(GEO.box, MAT_.cactus, 0.28, h, 0.28);
    trunk.position.y = h / 2;
    g.add(trunk);
    if (Math.random() < 0.75) {
      const armY = h * (0.45 + Math.random() * 0.25);
      const side = Math.random() < 0.5 ? -1 : 1;
      const elbow = mesh(GEO.box, MAT_.cactus, 0.5, 0.22, 0.22);
      elbow.position.set(side * 0.36, armY, 0);
      const up = mesh(GEO.box, MAT_.cactus, 0.22, 0.6, 0.22);
      up.position.set(side * 0.55, armY + 0.3, 0);
      g.add(elbow, up);
    }
    g.userData.respin = (o: THREE.Object3D) => {
      o.position.x = (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 7);
      o.rotation.y = Math.random() * Math.PI * 2;
    };
    g.userData.respin(g);
    shadows(g);
    return g;
  }, 8);

  const shrubs = makeTreadmill(scene, 14, 13, 1, () => {
    const s = 0.7 + Math.random() * 0.6;
    const bush = mesh(GEO.cone, pick(MAT_.shrub), s * 0.8, s * 0.5, s * 0.8);
    bush.position.y = s * 0.25;
    const g = new THREE.Group();
    g.add(bush);
    g.userData.respin = (o: THREE.Object3D) => { o.position.x = (Math.random() < 0.5 ? -1 : 1) * (5.1 + Math.random() * 1.5); };
    g.userData.respin(g);
    return g;
  }, 9);

  /* Dark dirt patches on the open ground flanks — scrolling reference points
     that sell world motion against the locked camera. */
  const dirtPatches = makeTreadmill(scene, 18, 24, 1, () => {
    const r = 2 + Math.random() * 6;
    const p = mesh(GEO.circle, pick(MAT_.patch), r, r * (0.6 + Math.random() * 0.5), 1);
    p.rotation.x = -Math.PI / 2;
    p.rotation.z = Math.random() * Math.PI * 2;
    p.position.y = 0.012; // just above the ground top to avoid z-fighting
    const g = new THREE.Group();
    g.add(p);
    g.userData.respin = (o: THREE.Object3D) => { o.position.x = (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 16); };
    g.userData.respin(g);
    return g;
  }, 14);

  /* Soft cloud shadows drifting over the terrain — slow parallax layer. */
  const cloudShadows = makeTreadmill(scene, 3, 90, 0.25, () => {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(46, 30), MAT_.cloudShadow);
    q.rotation.x = -Math.PI / 2;
    q.rotation.z = Math.random() * Math.PI;
    q.position.y = 0.04;
    const g = new THREE.Group();
    g.add(q);
    g.userData.respin = (o: THREE.Object3D) => { o.position.x = (Math.random() - 0.5) * 40; };
    g.userData.respin(g);
    return g;
  });

  const poles = makeTreadmill(scene, 12, 17, 1, (i) => {
    const g = new THREE.Group();
    const post = mesh(GEO.box, MAT_.pole, 0.16, 4.4, 0.16);
    post.position.y = 2.2;
    const cross = mesh(GEO.box, MAT_.pole, 1.15, 0.1, 0.1);
    cross.position.y = 4.15;
    g.add(post, cross);
    g.position.x = (i % 2 === 0 ? -1 : 1) * 6.9;
    return g;
  });

  const gantries = makeTreadmill(scene, 5, 46, 1, () => {
    const g = new THREE.Group();
    for (const px of [-5.5, 5.5]) {
      const post = mesh(GEO.box, MAT_.steel, 0.26, 5.1, 0.26);
      post.position.set(px, 2.55, 0);
      g.add(post);
      const foot = mesh(GEO.box, MAT_.darkMetal, 0.6, 0.2, 0.6);
      foot.position.set(px, 0.1, 0);
      g.add(foot);
    }
    const beam = mesh(GEO.box, MAT_.steel, 11.4, 0.3, 0.3);
    beam.position.y = 5.1;
    g.add(beam);
    for (const lx of CONFIG.lanes) {
      const drop = mesh(GEO.box, MAT_.darkMetal, 0.07, 0.65, 0.07);
      drop.position.set(lx, 4.62, 0);
      g.add(drop);
    }
    shadows(g);
    return g;
  });

  /* Procedural trackside buildings — houses/ruko near, tower silhouettes far.
     Own module; recycled treadmill rows like every other scenery here. */
  const scenery = createScenery(scene);

  /* Wind streaks near the camera — fade in with speed. */
  const streaks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.04, 2.6), MAT_.streak, CONFIG.streakCount);
  streaks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  streaks.frustumCulled = false;
  streaks.renderOrder = 5;
  scene.add(streaks);
  const streakSeeds = Array.from({ length: CONFIG.streakCount }, () => ({
    x: (Math.random() < 0.5 ? -1 : 1) * (4.5 + Math.random() * 4),
    y: 0.8 + Math.random() * 4.5,
    z: Math.random() * 80 - 70,
  }));
  const streakMatrix = new THREE.Matrix4();

  /* Per-lane sleepers sell the speed (single instanced draw call). */
  const sleepers = new THREE.InstancedMesh(GEO.box, MAT_.sleeper, CONFIG.sleeperRows * 3);
  sleepers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  sleepers.receiveShadow = true;
  scene.add(sleepers);
  const sleeperMatrix = new THREE.Matrix4();
  let sleeperOffset = 0;
  {
    // Per-sleeper tint variation — breaks up the perfect repetition.
    const c = new THREE.Color();
    for (let i = 0; i < CONFIG.sleeperRows * 3; i += 1) {
      sleepers.setColorAt(i, c.setHex(0x4a3626).offsetHSL(0, (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.09));
    }
    if (sleepers.instanceColor) sleepers.instanceColor.needsUpdate = true;
  }

  return {
    clouds, cacti, shrubs, dirtPatches, cloudShadows, poles, gantries, scenery,
    streaks, streakSeeds, streakMatrix,
    sleepers, sleeperMatrix,
    get sleeperOffset() { return sleeperOffset; },
    set sleeperOffset(v: number) { sleeperOffset = v; },

    updateStreaks(dt: number, speed: number) {
      const ratio = clampRatio((speed - CONFIG.streakStartSpeed) / (CONFIG.maxSpeed - CONFIG.streakStartSpeed));
      MAT_.streak.opacity = damp(MAT_.streak.opacity, ratio * 0.5, 6, dt);
      if (MAT_.streak.opacity < 0.01) return;
      const boost = 1 + ratio * 0.8;
      for (let i = 0; i < CONFIG.streakCount; i += 1) {
        const s = streakSeeds[i];
        s.z += speed * boost * dt;
        if (s.z > 14) s.z -= 84;
        streakMatrix.makeScale(1, 1, 1 + ratio * 1.6);
        streakMatrix.setPosition(s.x, s.y, s.z);
        streaks.setMatrixAt(i, streakMatrix);
      }
      streaks.instanceMatrix.needsUpdate = true;
    },

    updateSleepers(dz: number) {
      // Sleepers wrap within their gap for a seamless treadmill.
      sleeperOffset = (sleeperOffset + dz) % CONFIG.sleeperGap;
      let idx = 0;
      for (let row = 0; row < CONFIG.sleeperRows; row += 1) {
        for (const lx of CONFIG.lanes) {
          sleeperMatrix.makeScale(...CONFIG.sleeperSize);
          sleeperMatrix.setPosition(lx, 0.14, CONFIG.despawnZ - row * CONFIG.sleeperGap + sleeperOffset);
          sleepers.setMatrixAt(idx, sleeperMatrix);
          idx += 1;
        }
      }
      sleepers.instanceMatrix.needsUpdate = true;
    },

    advanceScenery(dz: number, dt: number) {
      clouds.advance(dz);
      clouds.items.forEach((c) => { c.position.x += c.userData.drift * dt; });
      cacti.advance(dz);
      shrubs.advance(dz);
      dirtPatches.advance(dz);
      cloudShadows.advance(dz);
      poles.advance(dz);
      gantries.advance(dz);
      scenery.advance(dz);
    },

    /** Gantry beams would clip through the vault — hide them inside tunnels. */
    setGantryVisibility(isInsideTunnel: (z: number) => boolean) {
      for (const gt of gantries.items) {
        gt.visible = !isInsideTunnel(gt.position.z);
      }
    },
  };
}

function clampRatio(r: number) {
  return Math.min(1, Math.max(0, r));
}

function damp(cur: number, target: number, lambda: number, dt: number) {
  return cur + (target - cur) * (1 - Math.exp(-lambda * dt));
}
