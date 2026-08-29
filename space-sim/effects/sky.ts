// space-sim/effects/sky.ts
import {
  Color3, DirectionalLight, HemisphericLight, MeshBuilder, ShaderMaterial,
  Vector3, type Scene,
} from "@babylonjs/core";
import type { QualityTier } from "../core/engine";

const SKY_VS = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;

const SKY_FS = `
precision highp float;
varying vec3 vPos;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunDir;
uniform float uSunGlare;
void main() {
  vec3 dir = normalize(vPos);
  float h = dir.y;
  vec3 col = h >= 0.0
    ? mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.55))
    : mix(uHorizon, uGround, pow(clamp(-h, 0.0, 1.0), 0.7));
  float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
  col += vec3(1.0, 0.92, 0.78) * pow(sunDot, 220.0) * 3.0;          // sun disc
  col += vec3(1.0, 0.85, 0.6) * pow(sunDot, 8.0) * 0.35 * uSunGlare; // glare halo
  gl_FragColor = vec4(col, 1.0);
}`;

/** Altitude-driven color ramp (ground -> space). */
const RAMP = [
  { alt: 0, zenith: [0.18, 0.38, 0.66], horizon: [0.66, 0.78, 0.9], ground: [0.35, 0.4, 0.42], exposure: 1.0 },
  { alt: 8000, zenith: [0.1, 0.24, 0.55], horizon: [0.5, 0.68, 0.88], ground: [0.3, 0.36, 0.4], exposure: 1.02 },
  { alt: 25000, zenith: [0.03, 0.08, 0.25], horizon: [0.22, 0.4, 0.72], ground: [0.22, 0.28, 0.34], exposure: 1.05 },
  { alt: 60000, zenith: [0.005, 0.015, 0.06], horizon: [0.07, 0.16, 0.4], ground: [0.1, 0.14, 0.2], exposure: 1.0 },
  { alt: 120000, zenith: [0.001, 0.002, 0.01], horizon: [0.015, 0.045, 0.14], ground: [0.03, 0.05, 0.09], exposure: 0.95 },
  { alt: 400000, zenith: [0.0, 0.0, 0.004], horizon: [0.004, 0.012, 0.04], ground: [0.0, 0.002, 0.01], exposure: 0.92 },
];

export class SkyController {
  sunDir = new Vector3(0.45, 0.5, -0.35).normalize();
  shakeAmp = 0;
  sun: DirectionalLight;
  ambient: HemisphericLight;
  private exposureTarget = 1.0;
  private currentExposure = 1.0;
  private glare = 0.4;
  private altitude = 0;
  private mat: ShaderMaterial;

  constructor(private scene: Scene, tier: QualityTier, private reducedMotion = false) {
    const dome = MeshBuilder.CreateSphere("skyDome", { diameter: 6.0e7, segments: 24 }, scene);
    dome.isPickable = false;
    dome.infiniteDistance = true;
    this.mat = new ShaderMaterial("skyMat", scene, {
      vertexSource: SKY_VS, fragmentSource: SKY_FS,
    }, {
      attributes: ["position"],
      uniforms: ["worldViewProjection", "uZenith", "uHorizon", "uGround", "uSunDir", "uSunGlare"],
      needAlphaBlending: false,
    });
    this.mat.backFaceCulling = false;
    dome.material = this.mat;
    this.sun = new DirectionalLight("sun", this.sunDir.scale(-1), scene);
    this.sun.intensity = 3.4;
    this.ambient = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    this.ambient.intensity = tier === "low" ? 0.9 : 0.55;
    this.applyRamp();
  }

  private applyRamp(): void {
    let lo = RAMP[0], hi = RAMP[RAMP.length - 1];
    for (let i = 0; i < RAMP.length - 1; i++) {
      if (this.altitude >= RAMP[i].alt && this.altitude <= RAMP[i + 1].alt) {
        lo = RAMP[i]; hi = RAMP[i + 1];
        break;
      }
    }
    const span = Math.max(1e-6, hi.alt - lo.alt);
    const k = Math.min(1, Math.max(0, (this.altitude - lo.alt) / span));
    const mix = (a: number[], b: number[]): Color3 =>
      new Color3(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
    this.mat.setColor3("uZenith", mix(lo.zenith, hi.zenith));
    this.mat.setColor3("uHorizon", mix(lo.horizon, hi.horizon));
    this.mat.setColor3("uGround", mix(lo.ground, hi.ground));
    this.mat.setVector3("uSunDir", this.sunDir);
    this.mat.setFloat("uSunGlare", this.glare);
    this.exposureTarget = lo.exposure + (hi.exposure - lo.exposure) * k;
  }

  setAltitude(m: number): void { this.altitude = m; this.applyRamp(); }
  setExposure(target: number): void { this.exposureTarget = target; }
  setSunGlare(v: number): void { this.glare = v; this.applyRamp(); }
  applyFx(fx: { exposure?: number; shake?: number; glare?: number }): void {
    if (fx.exposure !== undefined) this.exposureTarget = fx.exposure;
    if (fx.shake !== undefined && !this.reducedMotion) this.shakeAmp = fx.shake;
    if (fx.glare !== undefined) this.glare = fx.glare;
    this.applyRamp();
  }
  get exposure(): number { return this.currentExposure; }

  update(dt: number): void {
    const speed = 0.8;
    this.currentExposure += (this.exposureTarget - this.currentExposure) * Math.min(1, dt * speed);
    if (this.reducedMotion) return; // no shake decay, no fov wobble
    if (this.shakeAmp > 0.001) this.shakeAmp = Math.max(0, this.shakeAmp - dt * 0.25);
    const cam = this.scene.activeCamera;
    if (cam) cam.fov = 0.9 + Math.sin(performance.now() * 0.02) * 0.004 * this.shakeAmp * 10;
  }
}
