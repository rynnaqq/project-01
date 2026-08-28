/**
 * Cinematic Camera Director & Shake System (PRD §4.3, §4.4, §6).
 * Handles shot orchestration, smooth transitions, and deterministic camera shakes.
 */

import {
  Scene,
  Camera,
  ArcRotateCamera,
  UniversalCamera,
  Vector3,
  TransformNode,
} from '@babylonjs/core';

export class CameraDirector {
  private shakeAmplitude = 0;
  private shakeDecay = 0.92;
  private shakeOffset = new Vector3();
  reducedMotion = false;

  private activeCamera: Camera | null = null;
  private basePosition = new Vector3();

  constructor(private scene: Scene) {
    this.checkReducedMotion();
  }

  private checkReducedMotion(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }

  setActiveCamera(cam: Camera): void {
    this.activeCamera = cam;
    this.scene.activeCamera = cam;
    this.basePosition.copyFrom(cam.position);
  }

  getActiveCamera(): Camera | null {
    return this.activeCamera;
  }

  /** Trigger camera shake (PRD §6): ignition, Max-Q, turbulence, docking contact */
  shake(amplitude: number, durationSeconds = 0.5): void {
    if (this.reducedMotion) return;
    this.shakeAmplitude = Math.max(this.shakeAmplitude, amplitude);
    this.shakeDecay = Math.pow(0.01, 1 / (durationSeconds * 60)); // exponential decay per frame
  }

  /** Frame update for shake calculation */
  update(): void {
    if (!this.activeCamera || this.shakeAmplitude < 0.001) return;

    if (this.reducedMotion) {
      this.shakeAmplitude = 0;
      return;
    }

    const rx = (Math.random() * 2 - 1) * this.shakeAmplitude;
    const ry = (Math.random() * 2 - 1) * this.shakeAmplitude;
    const rz = (Math.random() * 2 - 1) * this.shakeAmplitude;

    this.shakeOffset.set(rx, ry, rz);
    this.activeCamera.position.addInPlace(this.shakeOffset);

    this.shakeAmplitude *= this.shakeDecay;
  }

  /** Create Launch Pad Arc Rotate Camera */
  createLaunchCamera(): ArcRotateCamera {
    const cam = new ArcRotateCamera(
      'launch-arc-cam',
      Math.PI / 4,
      Math.PI / 2.5,
      65,
      new Vector3(0, 24, 0),
      this.scene
    );
    cam.lowerRadiusLimit = 15;
    cam.upperRadiusLimit = 120;
    cam.wheelDeltaPercentage = 0.01;
    return cam;
  }

  /** Create Ascent Tracking Camera */
  createAscentGroundCamera(): UniversalCamera {
    const cam = new UniversalCamera(
      'ascent-ground-cam',
      new Vector3(-40, 5, -80),
      this.scene
    );
    cam.setTarget(new Vector3(0, 25, 0));
    return cam;
  }

  /** Create Booster Onboard Camera */
  createBoosterCamera(boosterNode: TransformNode): UniversalCamera {
    const cam = new UniversalCamera('booster-pov-cam', new Vector3(2.2, 22, 2.2), this.scene);
    cam.parent = boosterNode;
    cam.setTarget(new Vector3(0, -10, 0)); // Look down toward Earth
    return cam;
  }

  /** Create Cockpit Helmet POV Camera */
  createCockpitCamera(capsuleNode: TransformNode): UniversalCamera {
    const cam = new UniversalCamera('cockpit-pov-cam', new Vector3(0, 47, 0.5), this.scene);
    cam.parent = capsuleNode;
    cam.setTarget(new Vector3(0, 48, 8)); // Forward through windshield
    return cam;
  }

  /** Create First-Person Zero-G Camera for ISS Interior */
  createISSInteriorCamera(): UniversalCamera {
    const cam = new UniversalCamera('iss-zero-g-cam', new Vector3(0, 0, -10), this.scene);
    cam.minZ = 0.1;
    cam.maxZ = 3000;
    cam.setTarget(new Vector3(0, 0, 10));
    return cam;
  }

  /** Create Orbital & Docking View Camera */
  createDockingCamera(): UniversalCamera {
    const cam = new UniversalCamera('docking-cam', new Vector3(0, 0, -45), this.scene);
    cam.minZ = 0.1;
    cam.maxZ = 5000;
    cam.setTarget(new Vector3(0, -1.8, 10.5)); // Look at ISS docking port
    return cam;
  }
}
