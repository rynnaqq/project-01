import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { TargetCamera } from '@babylonjs/core/Cameras/targetCamera';

export type ShotName =
  | 'SHOT_01_GROUND'
  | 'SHOT_02_BOOSTER'
  | 'SHOT_03_COCKPIT'
  | 'SHOT_04_SEPARATION'
  | 'SHOT_05_ORBIT';

export interface ShakeSource {
  type: 'ENGINE_IGNITION' | 'MAX_Q' | 'TURBULENCE' | 'STAGE_SEPARATION' | 'DOCKING_CONTACT';
  amplitude: number;
  duration: number;
}

export class CameraDirector {
  private currentShot: ShotName = 'SHOT_01_GROUND';
  private shakeAmplitude = 0;
  private shakeDuration = 0;
  private shakeElapsed = 0;
  private reducedMotion = false;
  private shakeOffset = Vector3.Zero();

  constructor(reducedMotion = false) {
    this.reducedMotion = reducedMotion;
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    if (reduced) {
      this.shakeAmplitude = 0;
      this.shakeDuration = 0;
      this.shakeOffset.setAll(0);
    }
  }

  getShot(): ShotName {
    return this.currentShot;
  }

  playShot(name: ShotName): void {
    this.currentShot = name;
  }

  shake(amplitude: number, duration: number): void {
    if (this.reducedMotion) return;
    this.shakeAmplitude = Math.max(this.shakeAmplitude, amplitude);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
    this.shakeElapsed = 0;
  }

  triggerPresetShake(source: ShakeSource['type']): void {
    const presets: Record<ShakeSource['type'], { amp: number; dur: number }> = {
      ENGINE_IGNITION: { amp: 0.35, dur: 2.0 },
      MAX_Q: { amp: 0.5, dur: 3.0 },
      TURBULENCE: { amp: 0.2, dur: 1.5 },
      STAGE_SEPARATION: { amp: 0.45, dur: 1.2 },
      DOCKING_CONTACT: { amp: 0.15, dur: 0.8 },
    };
    const p = presets[source];
    this.shake(p.amp, p.dur);
  }

  update(dt: number, camera?: TargetCamera | Camera): Vector3 {
    if (this.shakeDuration > 0 && !this.reducedMotion) {
      this.shakeElapsed += dt;
      const progress = this.shakeElapsed / this.shakeDuration;
      if (progress >= 1.0) {
        this.shakeAmplitude = 0;
        this.shakeDuration = 0;
        this.shakeElapsed = 0;
        this.shakeOffset.setAll(0);
      } else {
        // Damped harmonic shake
        const damping = 1.0 - progress;
        const freq = 35; // 35 Hz vibration
        const waveX = Math.sin(this.shakeElapsed * freq) * this.shakeAmplitude * damping;
        const waveY = Math.cos(this.shakeElapsed * freq * 1.3) * this.shakeAmplitude * damping * 0.8;
        const waveZ = Math.sin(this.shakeElapsed * freq * 0.7) * this.shakeAmplitude * damping * 0.5;
        this.shakeOffset.set(waveX, waveY, waveZ);
      }
    } else {
      this.shakeOffset.setAll(0);
    }

    if (camera && 'position' in camera) {
      const cam = camera as TargetCamera;
      cam.position.addInPlace(this.shakeOffset);
    }

    return this.shakeOffset;
  }

  computeShotCamera(
    shot: ShotName,
    rocketPos: Vector3,
  ): { position: Vector3; target: Vector3 } {
    switch (shot) {
      case 'SHOT_01_GROUND':
        // Ground tracking camera looking up from distance
        return {
          position: new Vector3(30, 8, -60),
          target: rocketPos,
        };
      case 'SHOT_02_BOOSTER':
        // Camera parented to booster looking down towards launch pad / Earth
        return {
          position: new Vector3(
            rocketPos.x + 2.5,
            rocketPos.y - 1.2,
            rocketPos.z - 2.5,
          ),
          target: new Vector3(rocketPos.x, rocketPos.y - 20, rocketPos.z),
        };
      case 'SHOT_03_COCKPIT':
        // Interior helmet camera
        return {
          position: new Vector3(
            rocketPos.x,
            rocketPos.y + 4.8,
            rocketPos.z + 0.3,
          ),
          target: new Vector3(
            rocketPos.x,
            rocketPos.y + 10,
            rocketPos.z + 1.0,
          ),
        };
      case 'SHOT_04_SEPARATION':
        // Dramatic external separation shot
        return {
          position: new Vector3(
            rocketPos.x + 12,
            rocketPos.y + 2,
            rocketPos.z - 18,
          ),
          target: rocketPos,
        };
      case 'SHOT_05_ORBIT':
      default:
        return {
          position: new Vector3(
            rocketPos.x + 22,
            rocketPos.y + 12,
            rocketPos.z - 45,
          ),
          target: rocketPos,
        };
    }
  }
}
