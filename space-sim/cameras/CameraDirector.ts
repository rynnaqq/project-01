/**
 * Cinematic Camera Director & Multi-Angle Rigs (PRD §4.3, §4.4, §6).
 * Handles shot orchestration, smooth tracking transitions, and deterministic camera shakes.
 */

import {
  Scene,
  Camera,
  ArcRotateCamera,
  UniversalCamera,
  Vector3,
  TransformNode,
} from '@babylonjs/core';

export type CameraViewMode =
  | 'GROUND_TRACKING'
  | 'GANTRY_TOWER'
  | 'CINEMATIC_CHASE'
  | 'BOOSTER_ACTION'
  | 'COCKPIT_HELMET'
  | 'STAGE_SEPARATION'
  | 'ORBITAL_HORIZON';

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

  /** 1. Launch Pad Interactive Orbital Camera */
  createLaunchCamera(): ArcRotateCamera {
    const cam = new ArcRotateCamera(
      'launch-arc-cam',
      Math.PI / 3.8,
      Math.PI / 2.6,
      74,
      new Vector3(0, 26, 0),
      this.scene
    );
    cam.lowerRadiusLimit = 15;
    cam.upperRadiusLimit = 220;
    cam.wheelDeltaPercentage = 0.01;
    cam.fov = 0.85;
    return cam;
  }

  /** 2. Umbilical Tower High-Angle Gantry Camera */
  createGantryTowerCamera(): UniversalCamera {
    const cam = new UniversalCamera(
      'gantry-tower-cam',
      new Vector3(-12, 54, 3.5),
      this.scene
    );
    cam.fov = 1.05;
    cam.setTarget(new Vector3(0, 48, 0)); // Look right at Dragon capsule hatch
    return cam;
  }

  /** 3. Telephoto Ground Tracking Camera */
  createAscentGroundCamera(): UniversalCamera {
    const cam = new UniversalCamera(
      'ascent-ground-cam',
      new Vector3(-68, 6, -115),
      this.scene
    );
    cam.fov = 0.82;
    cam.setTarget(new Vector3(0, 25, 0));
    return cam;
  }

  /** 4. Dramatic 45-Degree Low-Angle Cinematic Chase Cam */
  createCinematicChaseCamera(rocketRoot: TransformNode): UniversalCamera {
    const cam = new UniversalCamera('cinematic-chase-cam', new Vector3(-24, -12, -32), this.scene);
    cam.parent = rocketRoot;
    cam.fov = 1.0;
    cam.setTarget(new Vector3(0, 28, 0)); // Low angle looking up at rising rocket
    return cam;
  }

  /** 5. Booster Grid Fin / Octaweb Downward Action Cam */
  createBoosterCamera(boosterNode: TransformNode): UniversalCamera {
    const cam = new UniversalCamera('booster-pov-cam', new Vector3(2.15, 10.5, 0), this.scene);
    cam.parent = boosterNode;
    cam.fov = 1.15; // Extreme wide action lens
    cam.setTarget(new Vector3(1.1, -18.0, 0)); // Downward along booster hull toward flaming Octaweb
    return cam;
  }

  /** 6. Pressurized Dragon Capsule Cockpit Helmet POV */
  createCockpitCamera(capsuleNode: TransformNode): UniversalCamera {
    const cam = new UniversalCamera('cockpit-pov-cam', new Vector3(0, 0.45, 0.7), this.scene);
    cam.parent = capsuleNode;
    cam.fov = 0.98;
    cam.setTarget(new Vector3(0, 1.4, 6.5)); // Forward & upward through windshield toward space
    return cam;
  }

  /** 7. Interstage Separation & Vacuum Ignition Cam */
  createStageSeparationCamera(rocketRoot: TransformNode): UniversalCamera {
    const cam = new UniversalCamera('separation-cam', new Vector3(-18, 38, -26), this.scene);
    cam.parent = rocketRoot;
    cam.fov = 0.95;
    cam.setTarget(new Vector3(0, 36, 0)); // Focus on interstage pusher mechanism
    return cam;
  }

  /** 8. Wide Orbit Silhouette & Earth Horizon Cam */
  createOrbitalHorizonCamera(rocketRoot: TransformNode): UniversalCamera {
    const cam = new UniversalCamera('orbital-horizon-cam', new Vector3(45, 15, -60), this.scene);
    cam.parent = rocketRoot;
    cam.fov = 0.88;
    cam.setTarget(new Vector3(0, 30, 0)); // Wide scenic shot with glowing Earth in backdrop
    return cam;
  }

  /** 9. First-Person Zero-G Camera for ISS Interior */
  createISSInteriorCamera(): UniversalCamera {
    const cam = new UniversalCamera('iss-zero-g-cam', new Vector3(0, 0, -10), this.scene);
    cam.minZ = 0.1;
    cam.maxZ = 3000;
    cam.fov = 0.95;
    cam.setTarget(new Vector3(0, 0, 10));
    return cam;
  }

  /** 10. Orbital & Docking View Camera */
  createDockingCamera(): UniversalCamera {
    const cam = new UniversalCamera('docking-cam', new Vector3(0, 1.2, -4.5), this.scene);
    cam.minZ = 0.1;
    cam.maxZ = 5000;
    cam.fov = 0.9;
    cam.setTarget(new Vector3(0, -1.8, 10.5)); // Look at ISS docking port
    return cam;
  }
}
