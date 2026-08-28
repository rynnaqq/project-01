/**
 * Particle Effects Manager (PRD §5, §6, §16).
 * Handles cryogenic cooling steam, ignition smoke, exhaust flame, and RCS bursts.
 */

import {
  Scene,
  ParticleSystem,
  Color4,
  Vector3,
  TransformNode,
  DynamicTexture,
} from '@babylonjs/core';
import { getProfile, type QualityTier } from '../core/quality';

export class ParticleManager {
  private particleTex: DynamicTexture;
  private activeSystems: ParticleSystem[] = [];

  constructor(private scene: Scene, private tier: QualityTier = 'MEDIUM') {
    // Generate simple circular soft particle texture dynamically
    this.particleTex = new DynamicTexture('particle-dot-tex', { width: 64, height: 64 }, scene, false);
    const ctx = this.particleTex.getContext();
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    this.particleTex.update();
  }

  setTier(tier: QualityTier): void {
    this.tier = tier;
  }

  /** Cooling cryogenic steam at launch pad (PRD §5) */
  createCoolingSteam(emitter: TransformNode): ParticleSystem {
    const profile = getProfile(this.tier);
    const count = Math.min(profile.particleCount / 5, 200);

    const ps = new ParticleSystem('cooling-steam', count, this.scene);
    ps.particleTexture = this.particleTex;
    ps.emitter = emitter.position;
    ps.minEmitBox = new Vector3(-0.8, 0, -0.8);
    ps.maxEmitBox = new Vector3(0.8, 0, 0.8);

    ps.color1 = new Color4(0.85, 0.9, 1.0, 0.35);
    ps.color2 = new Color4(0.75, 0.8, 0.9, 0.15);
    ps.colorDead = new Color4(0.7, 0.75, 0.8, 0.0);

    ps.minSize = 0.8;
    ps.maxSize = 2.4;
    ps.minLifeTime = 1.2;
    ps.maxLifeTime = 2.8;

    ps.emitRate = 35;
    ps.gravity = new Vector3(0, 0.4, 0);
    ps.direction1 = new Vector3(-0.4, 0.5, -0.4);
    ps.direction2 = new Vector3(0.4, 1.2, 0.4);
    ps.minEmitPower = 0.5;
    ps.maxEmitPower = 1.5;

    this.activeSystems.push(ps);
    return ps;
  }

  /** Engine Flame Plume during Liftoff and Ascent (PRD §5, §6) */
  createEngineFlame(emitter: TransformNode): ParticleSystem {
    const profile = getProfile(this.tier);
    const count = Math.min(profile.particleCount / 2, 800);

    const ps = new ParticleSystem('engine-flame', count, this.scene);
    ps.particleTexture = this.particleTex;
    ps.emitter = emitter.position;

    ps.minEmitBox = new Vector3(-0.5, 0, -0.5);
    ps.maxEmitBox = new Vector3(0.5, 0, 0.5);

    // Fiery colors: bright yellow/orange -> red -> dark smoke
    ps.color1 = new Color4(1.0, 0.95, 0.4, 0.9);
    ps.color2 = new Color4(1.0, 0.45, 0.05, 0.6);
    ps.colorDead = new Color4(0.3, 0.1, 0.05, 0.0);

    ps.minSize = 1.5;
    ps.maxSize = 4.5;
    ps.minLifeTime = 0.3;
    ps.maxLifeTime = 0.8;

    ps.emitRate = 120;
    ps.gravity = new Vector3(0, -2.0, 0);
    ps.direction1 = new Vector3(-0.3, -12.0, -0.3);
    ps.direction2 = new Vector3(0.3, -18.0, 0.3);
    ps.minEmitPower = 10;
    ps.maxEmitPower = 20;

    this.activeSystems.push(ps);
    return ps;
  }

  /** Launch Smoke Cloud */
  createLaunchSmoke(position: Vector3): ParticleSystem {
    const profile = getProfile(this.tier);
    const count = Math.min(profile.particleCount / 3, 400);

    const ps = new ParticleSystem('launch-smoke', count, this.scene);
    ps.particleTexture = this.particleTex;
    ps.emitter = position;

    ps.color1 = new Color4(0.65, 0.65, 0.65, 0.4);
    ps.color2 = new Color4(0.45, 0.45, 0.45, 0.2);
    ps.colorDead = new Color4(0.3, 0.3, 0.3, 0.0);

    ps.minSize = 3.0;
    ps.maxSize = 8.0;
    ps.minLifeTime = 1.5;
    ps.maxLifeTime = 3.5;

    ps.emitRate = 60;
    ps.direction1 = new Vector3(-6.0, 0.5, -6.0);
    ps.direction2 = new Vector3(6.0, 3.0, 6.0);
    ps.minEmitPower = 2;
    ps.maxEmitPower = 8;

    this.activeSystems.push(ps);
    return ps;
  }

  /** RCS Thruster puff in space */
  createRCSBurst(emitter: Vector3, dir: Vector3): void {
    const ps = new ParticleSystem('rcs-puff', 25, this.scene);
    ps.particleTexture = this.particleTex;
    ps.emitter = emitter;

    ps.color1 = new Color4(0.7, 0.9, 1.0, 0.6);
    ps.color2 = new Color4(0.4, 0.7, 1.0, 0.2);
    ps.colorDead = new Color4(0.2, 0.5, 1.0, 0.0);

    ps.minSize = 0.2;
    ps.maxSize = 0.8;
    ps.minLifeTime = 0.15;
    ps.maxLifeTime = 0.35;

    ps.targetStopDuration = 0.2;
    ps.disposeOnStop = true;

    ps.direction1 = dir.scale(3.0);
    ps.direction2 = dir.scale(5.0);

    ps.start();
  }

  dispose(): void {
    for (const ps of this.activeSystems) {
      ps.stop();
      ps.dispose();
    }
    this.activeSystems = [];
    this.particleTex.dispose();
  }
}
