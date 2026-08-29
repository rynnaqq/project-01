// space-sim/effects/smoke.ts
import {
  Color4, DynamicTexture, GPUParticleSystem, ParticleSystem, Texture,
  Vector3, type Scene,
} from "@babylonjs/core";

function smokeTex(scene: Scene): Texture {
  const dt = new DynamicTexture("smokeTex", { width: 128, height: 128 }, scene, true);
  const c = dt.getContext() as unknown as CanvasRenderingContext2D;
  const g = c.createRadialGradient(64, 64, 8, 64, 64, 62);
  g.addColorStop(0, "rgba(255,255,255,0.85)");
  g.addColorStop(0.6, "rgba(230,228,224,0.45)");
  g.addColorStop(1, "rgba(220,218,214,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  dt.hasAlpha = true;
  dt.update();
  return dt;
}

export class GroundSmoke {
  private sys: ParticleSystem | GPUParticleSystem;
  private targetRamp = 0;
  private rampValue = 0;

  constructor(scene: Scene, origin: Vector3, maxParticles: number, gpu: boolean) {
    const capacity = Math.max(600, Math.floor(maxParticles * 0.5));
    this.sys = gpu
      ? new GPUParticleSystem("padSmoke", { capacity }, scene)
      : new ParticleSystem("padSmoke", capacity, scene);
    const ps = this.sys as ParticleSystem;
    ps.particleTexture = smokeTex(scene);
    ps.emitter = origin;
    ps.minEmitBox = new Vector3(-14, 0, -14);
    ps.maxEmitBox = new Vector3(14, 4, 14);
    ps.color1 = new Color4(0.95, 0.94, 0.92, 0.55);
    ps.color2 = new Color4(0.8, 0.79, 0.78, 0.5);
    ps.colorDead = new Color4(0.7, 0.7, 0.7, 0);
    ps.minSize = 14;
    ps.maxSize = 60;
    ps.minLifeTime = 4;
    ps.maxLifeTime = 11;
    ps.emitRate = 0;
    ps.direction1 = new Vector3(-24, 6, -24);
    ps.direction2 = new Vector3(24, 14, 24);
    ps.gravity = new Vector3(0, 0.35, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.start();
  }

  ramp(v: number): void {
    this.targetRamp = v;
  }

  update(dt: number): void {
    this.rampValue += (this.targetRamp - this.rampValue) * Math.min(1, dt * 0.8);
    (this.sys as ParticleSystem).emitRate = 500 * this.rampValue;
  }
}
