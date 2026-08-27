import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { QualitySettings } from '../core/qualityManager';

export class ParticleManager {
  private coolingSteam: ParticleSystem | null = null;
  private engineFlame: ParticleSystem | null = null;
  private launchSmoke: ParticleSystem | null = null;
  private emitterMesh: Mesh | null = null;
  private smokeTexture: DynamicTexture;
  private flameTexture: DynamicTexture;

  constructor(
    private readonly scene: Scene,
    private readonly settings: QualitySettings,
  ) {
    this.smokeTexture = this.createSmokeTexture();
    this.flameTexture = this.createFlameTexture();
  }

  private createSmokeTexture(): DynamicTexture {
    const tex = new DynamicTexture('smoke-tex', 64, this.scene, false);
    const ctx = tex.getContext();
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(230, 235, 245, 0.9)');
    grad.addColorStop(0.5, 'rgba(180, 190, 205, 0.4)');
    grad.addColorStop(1, 'rgba(120, 130, 145, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    tex.update(false);
    return tex;
  }

  private createFlameTexture(): DynamicTexture {
    const tex = new DynamicTexture('flame-tex', 64, this.scene, false);
    const ctx = tex.getContext();
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.25, 'rgba(255, 200, 50, 0.95)');
    grad.addColorStop(0.6, 'rgba(255, 80, 0, 0.6)');
    grad.addColorStop(1, 'rgba(180, 20, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    tex.update(false);
    return tex;
  }

  createLaunchPadEffects(emitterNode: TransformNode): void {
    const capacity = Math.min(this.settings.maxParticles, 3000);

    this.emitterMesh = MeshBuilder.CreateBox(
      'particle-emitter-anchor',
      { size: 0.1 },
      this.scene,
    );
    this.emitterMesh.parent = emitterNode;
    this.emitterMesh.isVisible = false;

    // 1. Cooling Steam
    this.coolingSteam = new ParticleSystem(
      'cooling-steam',
      Math.floor(capacity * 0.2),
      this.scene,
    );
    this.coolingSteam.particleTexture = this.smokeTexture;
    this.coolingSteam.emitter = this.emitterMesh;
    this.coolingSteam.minEmitBox = new Vector3(-2, 0, -2);
    this.coolingSteam.maxEmitBox = new Vector3(2, 2, 2);
    this.coolingSteam.color1 = new Color4(0.9, 0.95, 1.0, 0.4);
    this.coolingSteam.color2 = new Color4(0.8, 0.85, 0.9, 0.1);
    this.coolingSteam.colorDead = new Color4(0.7, 0.7, 0.7, 0.0);
    this.coolingSteam.minSize = 1.0;
    this.coolingSteam.maxSize = 3.5;
    this.coolingSteam.minLifeTime = 1.5;
    this.coolingSteam.maxLifeTime = 3.0;
    this.coolingSteam.emitRate = Math.floor(capacity * 0.08);
    this.coolingSteam.direction1 = new Vector3(-1, 2, -1);
    this.coolingSteam.direction2 = new Vector3(1, 4, 1);
    this.coolingSteam.minEmitPower = 0.5;
    this.coolingSteam.maxEmitPower = 2.0;
    this.coolingSteam.updateSpeed = 0.015;
    this.coolingSteam.start();

    // 2. Engine Flame
    this.engineFlame = new ParticleSystem(
      'engine-flame',
      Math.floor(capacity * 0.4),
      this.scene,
    );
    this.engineFlame.particleTexture = this.flameTexture;
    this.engineFlame.emitter = this.emitterMesh;
    this.engineFlame.minEmitBox = new Vector3(-0.6, -1, -0.6);
    this.engineFlame.maxEmitBox = new Vector3(0.6, -1, 0.6);
    this.engineFlame.color1 = new Color4(1.0, 0.9, 0.5, 1.0);
    this.engineFlame.color2 = new Color4(1.0, 0.4, 0.0, 0.8);
    this.engineFlame.colorDead = new Color4(0.2, 0.0, 0.0, 0.0);
    this.engineFlame.minSize = 0.8;
    this.engineFlame.maxSize = 2.5;
    this.engineFlame.minLifeTime = 0.2;
    this.engineFlame.maxLifeTime = 0.6;
    this.engineFlame.emitRate = 0;
    this.engineFlame.direction1 = new Vector3(-0.2, -6, -0.2);
    this.engineFlame.direction2 = new Vector3(0.2, -8, 0.2);
    this.engineFlame.minEmitPower = 6.0;
    this.engineFlame.maxEmitPower = 12.0;
    this.engineFlame.start();

    // 3. Launch Smoke Billow
    this.launchSmoke = new ParticleSystem(
      'launch-smoke',
      Math.floor(capacity * 0.4),
      this.scene,
    );
    this.launchSmoke.particleTexture = this.smokeTexture;
    this.launchSmoke.emitter = this.emitterMesh;
    this.launchSmoke.minEmitBox = new Vector3(-3, -2, -3);
    this.launchSmoke.maxEmitBox = new Vector3(3, 0, 3);
    this.launchSmoke.color1 = new Color4(0.85, 0.85, 0.85, 0.8);
    this.launchSmoke.color2 = new Color4(0.6, 0.6, 0.6, 0.4);
    this.launchSmoke.colorDead = new Color4(0.3, 0.3, 0.3, 0.0);
    this.launchSmoke.minSize = 2.0;
    this.launchSmoke.maxSize = 7.0;
    this.launchSmoke.minLifeTime = 2.0;
    this.launchSmoke.maxLifeTime = 4.5;
    this.launchSmoke.emitRate = 0;
    this.launchSmoke.direction1 = new Vector3(-4, 0.5, -4);
    this.launchSmoke.direction2 = new Vector3(4, 2.0, 4);
    this.launchSmoke.minEmitPower = 2.0;
    this.launchSmoke.maxEmitPower = 6.0;
    this.launchSmoke.start();
  }

  triggerIgnition(): void {
    if (this.engineFlame) {
      this.engineFlame.emitRate = Math.floor(this.settings.maxParticles * 0.3);
    }
    if (this.launchSmoke) {
      this.launchSmoke.emitRate = Math.floor(this.settings.maxParticles * 0.25);
    }
  }

  setThrustLevel(level: number): void {
    const norm = Math.max(0, Math.min(1, level));
    if (this.engineFlame) {
      this.engineFlame.emitRate = Math.floor(this.settings.maxParticles * 0.35 * norm);
    }
    if (this.launchSmoke && norm > 0) {
      this.launchSmoke.emitRate = Math.floor(this.settings.maxParticles * 0.2 * norm);
    }
  }

  stopLaunchParticles(): void {
    this.coolingSteam?.stop();
    this.engineFlame?.stop();
    this.launchSmoke?.stop();
  }

  dispose(): void {
    this.coolingSteam?.dispose();
    this.engineFlame?.dispose();
    this.launchSmoke?.dispose();
    this.emitterMesh?.dispose();
    this.smokeTexture.dispose();
    this.flameTexture.dispose();
  }
}
