/**
 * Particle Effects Manager (PRD §5, §6, §16).
 * Handles cryogenic cooling steam, ignition smoke, exhaust flame plume with Mach diamonds,
 * launch deluge water clouds, and orbital RCS bursts.
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

  constructor(private scene: Scene, private tier: QualityTier = 'HIGH') {
    // Generate soft circular particle texture dynamically
    this.particleTex = new DynamicTexture('particle-dot-tex', { width: 128, height: 128 }, scene, false);
    const ctx = this.particleTex.getContext();
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.7)');
    grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.2)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    this.particleTex.update();
  }

  setTier(tier: QualityTier): void {
    this.tier = tier;
  }

  /** Cooling cryogenic steam at launch pad (PRD §5) */
  createCoolingSteam(emitter: TransformNode): ParticleSystem {
    const profile = getProfile(this.tier);
    const count = Math.min(profile.particleCount / 5, 300);

    const ps = new ParticleSystem('cooling-steam', count, this.scene);
    ps.particleTexture = this.particleTex;
    ps.emitter = emitter as any; // Bind to TransformNode to track rocket motion dynamically
    ps.minEmitBox = new Vector3(-1.2, -0.5, -1.2);
    ps.maxEmitBox = new Vector3(1.2, 0.5, 1.2);

    ps.color1 = new Color4(0.88, 0.94, 1.0, 0.45);
    ps.color2 = new Color4(0.75, 0.85, 0.95, 0.25);
    ps.colorDead = new Color4(0.7, 0.75, 0.8, 0.0);

    ps.minSize = 1.2;
    ps.maxSize = 3.8;
    ps.minLifeTime = 1.5;
    ps.maxLifeTime = 3.2;

    ps.emitRate = 45;
    ps.gravity = new Vector3(0, 0.6, 0);
    ps.direction1 = new Vector3(-0.6, 0.8, -0.6);
    ps.direction2 = new Vector3(0.6, 1.8, 0.6);
    ps.minEmitPower = 0.6;
    ps.maxEmitPower = 2.0;

    this.activeSystems.push(ps);
    return ps;
  }

  /** Engine Flame Plume with High-Velocity Jet & Mach Diamonds (PRD §5, §6) */
  createEngineFlame(emitter: TransformNode): ParticleSystem {
    const profile = getProfile(this.tier);
    const count = Math.min(profile.particleCount, 1200);

    const ps = new ParticleSystem('engine-flame', count, this.scene);
    ps.particleTexture = this.particleTex;
    ps.emitter = emitter as any; // Attached to rocket exhaust node

    ps.minEmitBox = new Vector3(-0.8, -0.2, -0.8);
    ps.maxEmitBox = new Vector3(0.8, 0.2, 0.8);

    // Hypergolic/RP-1 Brilliant White/Cyan Core -> Fiery Orange/Gold -> Smoky Red
    ps.color1 = new Color4(1.0, 0.98, 0.85, 1.0);
    ps.color2 = new Color4(1.0, 0.55, 0.08, 0.8);
    ps.colorDead = new Color4(0.35, 0.08, 0.02, 0.0);

    ps.minSize = 1.8;
    ps.maxSize = 6.2;
    ps.minLifeTime = 0.4;
    ps.maxLifeTime = 1.1;

    ps.emitRate = 220;
    ps.gravity = new Vector3(0, -3.0, 0);
    ps.direction1 = new Vector3(-0.4, -18.0, -0.4);
    ps.direction2 = new Vector3(0.4, -28.0, 0.4);
    ps.minEmitPower = 16;
    ps.maxEmitPower = 32;

    this.activeSystems.push(ps);
    return ps;
  }

  /** Supersonic Mach Diamonds Shock Cones */
  createMachDiamonds(emitter: TransformNode): ParticleSystem {
    const ps = new ParticleSystem('mach-diamonds', 180, this.scene);
    ps.particleTexture = this.particleTex;
    ps.emitter = emitter as any;

    ps.minEmitBox = new Vector3(-0.3, -0.1, -0.3);
    ps.maxEmitBox = new Vector3(0.3, 0.1, 0.3);

    ps.color1 = new Color4(0.4, 0.8, 1.0, 0.95); // Electric cyan shock diamond
    ps.color2 = new Color4(1.0, 0.9, 0.5, 0.7);
    ps.colorDead = new Color4(0.2, 0.4, 0.8, 0.0);

    ps.minSize = 0.8;
    ps.maxSize = 2.2;
    ps.minLifeTime = 0.12;
    ps.maxLifeTime = 0.28;

    ps.emitRate = 80;
    ps.direction1 = new Vector3(-0.1, -12.0, -0.1);
    ps.direction2 = new Vector3(0.1, -16.0, 0.1);
    ps.minEmitPower = 12;
    ps.maxEmitPower = 20;

    this.activeSystems.push(ps);
    return ps;
  }

  /** Massive Launch Smoke & Water Deluge Cloud */
  createLaunchSmoke(emitter: TransformNode | Vector3): ParticleSystem {
    const profile = getProfile(this.tier);
    const count = Math.min(profile.particleCount / 2, 600);

    const ps = new ParticleSystem('launch-smoke', count, this.scene);
    ps.particleTexture = this.particleTex;
    ps.emitter = emitter as any;

    ps.color1 = new Color4(0.72, 0.74, 0.78, 0.65);
    ps.color2 = new Color4(0.45, 0.48, 0.52, 0.35);
    ps.colorDead = new Color4(0.25, 0.28, 0.32, 0.0);

    ps.minSize = 4.5;
    ps.maxSize = 14.0;
    ps.minLifeTime = 2.2;
    ps.maxLifeTime = 5.0;

    ps.emitRate = 90;
    ps.gravity = new Vector3(0, 0.8, 0);
    ps.direction1 = new Vector3(-9.0, 1.0, -9.0);
    ps.direction2 = new Vector3(9.0, 4.5, 9.0);
    ps.minEmitPower = 3;
    ps.maxEmitPower = 12;

    this.activeSystems.push(ps);
    return ps;
  }

  /** RCS Thruster puff in space */
  createRCSBurst(emitter: Vector3 | TransformNode, dir: Vector3): void {
    const ps = new ParticleSystem('rcs-puff', 35, this.scene);
    ps.particleTexture = this.particleTex;
    ps.emitter = emitter as any;

    ps.color1 = new Color4(0.75, 0.92, 1.0, 0.7);
    ps.color2 = new Color4(0.4, 0.75, 1.0, 0.3);
    ps.colorDead = new Color4(0.15, 0.45, 0.9, 0.0);

    ps.minSize = 0.3;
    ps.maxSize = 1.1;
    ps.minLifeTime = 0.18;
    ps.maxLifeTime = 0.42;

    ps.targetStopDuration = 0.25;
    ps.disposeOnStop = true;

    ps.direction1 = dir.scale(3.5);
    ps.direction2 = dir.scale(6.0);

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
