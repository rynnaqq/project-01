// space-sim/effects/exhaust.ts
import {
  Color3, Color4, DynamicTexture, GPUParticleSystem, MeshBuilder, ParticleSystem, PointLight,
  Texture, Vector3, type Scene, type TransformNode,
} from "@babylonjs/core";

function glowTex(scene: Scene): Texture {
  const dt = new DynamicTexture("plumeGlow", { width: 128, height: 128 }, scene, true);
  const c = dt.getContext() as unknown as CanvasRenderingContext2D;
  const g = c.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,230,180,0.9)");
  g.addColorStop(0.6, "rgba(255,140,60,0.5)");
  g.addColorStop(1, "rgba(255,80,20,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  dt.hasAlpha = true;
  dt.update();
  return dt;
}

export class ExhaustSystem {
  plumeLight: PointLight;
  private systems: Array<ParticleSystem | GPUParticleSystem> = [];
  private baseRates: number[] = [];
  private throttleValue = 0;
  private targetThrottle = 0;

  constructor(scene: Scene, enginesNode: TransformNode, maxParticles: number, gpu: boolean) {
    this.plumeLight = new PointLight("plumeLight", Vector3.Zero(), scene);
    this.plumeLight.diffuse = new Color3(1, 0.72, 0.4);
    this.plumeLight.intensity = 0;
    this.plumeLight.range = 400;
    const tex = glowTex(scene);
    const makeOne = (localY: number, offsetX: number, capacity: number, size: number, emitRate: number): void => {
      // Invisible mesh emitter (ParticleSystem.emitter only accepts AbstractMesh |
      // Vector3) so the plume follows the engines node through pitch-over and staging.
      const emitter = MeshBuilder.CreateBox(`exhEmitter${localY}_${offsetX}`, { size: 0.01 }, scene);
      emitter.isVisible = false;
      emitter.parent = enginesNode;
      emitter.position.set(offsetX, localY, 0);
      const sys = gpu
        ? new GPUParticleSystem(`exhaust${localY}_${offsetX}`, { capacity }, scene)
        : new ParticleSystem(`exhaust${localY}_${offsetX}`, capacity, scene);
      (sys as ParticleSystem).particleTexture = tex;
      (sys as ParticleSystem).emitter = emitter;
      (sys as ParticleSystem).minEmitBox = new Vector3(-0.6, 0, -0.6);
      (sys as ParticleSystem).maxEmitBox = new Vector3(0.6, 0, 0.6);
      (sys as ParticleSystem).color1 = new Color4(1.0, 0.85, 0.5, 0.9);
      (sys as ParticleSystem).color2 = new Color4(1.0, 0.5, 0.15, 0.8);
      (sys as ParticleSystem).colorDead = new Color4(0.3, 0.1, 0.05, 0);
      (sys as ParticleSystem).minSize = size * 0.6;
      (sys as ParticleSystem).maxSize = size;
      (sys as ParticleSystem).minLifeTime = 0.25;
      (sys as ParticleSystem).maxLifeTime = 0.7;
      (sys as ParticleSystem).emitRate = 0; // ignition-gated: update() scales by throttle
      (sys as ParticleSystem).direction1 = new Vector3(-1.5, -60, -1.5);
      (sys as ParticleSystem).direction2 = new Vector3(1.5, -90, 1.5);
      (sys as ParticleSystem).gravity = new Vector3(0, -9.8, 0);
      (sys as ParticleSystem).blendMode = ParticleSystem.BLENDMODE_ADD;
      (sys as ParticleSystem).start();
      this.systems.push(sys);
      this.baseRates.push(emitRate);
    };
    // Core 4-engine cluster (positions mirror SLS engine layout)
    makeOne(-4.5, -2.6, Math.floor(maxParticles * 0.4), 9, Math.floor(maxParticles * 0.35));
    makeOne(-4.5, 2.6, Math.floor(maxParticles * 0.2), 9, Math.floor(maxParticles * 0.2));
    makeOne(-4.5, 0, Math.floor(maxParticles * 0.2), 9, Math.floor(maxParticles * 0.2));
  }

  ignite(on: boolean): void {
    this.targetThrottle = on ? 1 : 0;
  }

  throttle(v: number): void {
    this.targetThrottle = v;
  }

  update(dt: number, altitude: number): void {
    this.throttleValue += (this.targetThrottle - this.throttleValue) * Math.min(1, dt * 3);
    const flicker = 0.85 + Math.sin(performance.now() * 0.045) * 0.15;
    this.plumeLight.intensity = 900 * this.throttleValue * flicker;
    // In vacuum: plumes widen (size growth stands in for lower ambient pressure)
    const widen = Math.min(1, altitude / 60000);
    for (let i = 0; i < this.systems.length; i++) {
      const sys = this.systems[i] as ParticleSystem;
      sys.maxSize = 9 + widen * 26;
      sys.emitRate = this.baseRates[i] * this.throttleValue;
    }
  }
}
