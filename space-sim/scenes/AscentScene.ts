/**
 * Scene 2 — Rocket Ascent & Cinematic Camera Director (PRD §6).
 * Manages deterministic trajectory, staging separation, multiple cinematic camera shots,
 * live telemetry updates, and atmospheric effects.
 */

import {
  Scene,
  DirectionalLight,
  HemisphericLight,
  Vector3,
  Color3,
  UniversalCamera,
  ParticleSystem,
} from '@babylonjs/core';
import { buildRocket, buildEarthEnvironment, type RocketModel } from '../rendering/proceduralModels';
import { ParticleManager } from '../rendering/particles';
import { CameraDirector } from '../cameras/CameraDirector';
import { sampleAscent, ASCENT_DURATION_S, type AscentSample } from '../gameplay/trajectory';
import { AudioManager } from '../core/audio';

export class AscentScene {
  rocket: RocketModel;
  particles: ParticleManager;
  earthEnv: ReturnType<typeof buildEarthEnvironment>;

  private groundCam: UniversalCamera;
  private gantryCam: UniversalCamera;
  private chaseCam: UniversalCamera;
  private boosterCam: UniversalCamera;
  private cockpitCam: UniversalCamera;
  private separationCam: UniversalCamera;
  private orbitalCam: UniversalCamera;

  private cameras: UniversalCamera[] = [];
  private currentCamIndex = 0;
  private manualCameraOverride = false;

  private elapsedTime = 0;
  private isSeparated = false;
  private flamePS: ParticleSystem | null = null;

  currentTelemetry: AscentSample = sampleAscent(0);

  constructor(
    public scene: Scene,
    public cameraDirector: CameraDirector,
    public audio: AudioManager,
    public onTelemetry: (sample: AscentSample) => void,
    public onAscentComplete: () => void
  ) {
    // Lighting
    const hemiLight = new HemisphericLight('ascent-hemi-light', new Vector3(0, 1, 0), scene);
    hemiLight.intensity = 0.45;
    hemiLight.groundColor = new Color3(0.05, 0.05, 0.1);

    const sunLight = new DirectionalLight('ascent-sun-light', new Vector3(-0.7, -0.6, -0.4), scene);
    sunLight.intensity = 2.2;

    // 3D Models
    this.earthEnv = buildEarthEnvironment(scene);
    this.rocket = buildRocket(scene);

    // Particle exhaust & supersonic shock diamonds
    this.particles = new ParticleManager(scene);
    this.flamePS = this.particles.createEngineFlame(this.rocket.exhaustPoint);
    this.flamePS.start();
    const machPS = this.particles.createMachDiamonds(this.rocket.exhaustPoint);
    machPS.start();

    // Setup 7 Multi-Angle Cinematic Camera Rigs
    this.groundCam = this.cameraDirector.createAscentGroundCamera();
    this.gantryCam = this.cameraDirector.createGantryTowerCamera();
    this.chaseCam = this.cameraDirector.createCinematicChaseCamera(this.rocket.root);
    this.boosterCam = this.cameraDirector.createBoosterCamera(this.rocket.stage1);
    this.cockpitCam = this.cameraDirector.createCockpitCamera(this.rocket.capsule);
    this.separationCam = this.cameraDirector.createStageSeparationCamera(this.rocket.root);
    this.orbitalCam = this.cameraDirector.createOrbitalHorizonCamera(this.rocket.root);

    this.cameras = [
      this.groundCam,
      this.chaseCam,
      this.boosterCam,
      this.cockpitCam,
      this.separationCam,
      this.orbitalCam,
      this.gantryCam,
    ];

    // Start with Ground Tracking Shot
    this.cameraDirector.setActiveCamera(this.groundCam);

    // Sound & Radio
    this.audio.startRocketRumble(1.0);
    this.audio.playRadioTransmission('Flight: Vehicle is supersonic. Trajectory nominal.');
  }

  /** Manually cycle through available camera POVs */
  cycleCamera(): void {
    this.manualCameraOverride = true;
    this.currentCamIndex = (this.currentCamIndex + 1) % this.cameras.length;
    const nextCam = this.cameras[this.currentCamIndex];
    this.cameraDirector.setActiveCamera(nextCam);
  }

  skip(): void {
    this.audio.stopRocketRumble();
    this.onAscentComplete();
  }

  update(dt: number): void {
    this.elapsedTime += dt;
    this.currentTelemetry = sampleAscent(this.elapsedTime);
    this.onTelemetry(this.currentTelemetry);

    // Update rocket position & gravity-turn pitch orientation
    const visualAlt = (this.currentTelemetry.altitude / 400000) * 800; // visual height scale
    this.rocket.root.position.y = visualAlt;
    this.rocket.root.rotation.z = (this.currentTelemetry.pitch * Math.PI) / 180;

    // Max-Q and engine throttle audio/shake
    this.audio.setRocketThrottle(1.0 - (this.currentTelemetry.pitch / 90) * 0.3);
    if (this.currentTelemetry.dynamicPressure > 0.6) {
      this.cameraDirector.shake(0.25 * this.currentTelemetry.dynamicPressure, 0.2);
    }

    // Always keep Ground camera targeting the ascending rocket
    this.groundCam.setTarget(this.rocket.root.position);

    // Automatic Director's Cut Camera Switcher Timeline (if not manually overridden)
    if (!this.manualCameraOverride) {
      if (this.elapsedTime < 12) {
        // Shot 1: Ground Tracking Shot (KSC Launch Pad & Tower view)
        if (this.cameraDirector.getActiveCamera() !== this.groundCam) {
          this.cameraDirector.setActiveCamera(this.groundCam);
        }
      } else if (this.elapsedTime < 24) {
        // Shot 2: Cinematic Low-Angle 45-degree Chase Cam
        if (this.cameraDirector.getActiveCamera() !== this.chaseCam) {
          this.cameraDirector.setActiveCamera(this.chaseCam);
        }
      } else if (this.elapsedTime < 38) {
        // Shot 3: Booster Action Cam (Downward fiery view of Florida & Atlantic)
        if (this.cameraDirector.getActiveCamera() !== this.boosterCam) {
          this.cameraDirector.setActiveCamera(this.boosterCam);
          this.audio.playRadioTransmission('Flight: Passing Max-Q. Aerodynamic pressure nominal.');
        }
      } else if (this.elapsedTime < 48) {
        // Shot 4: Astronaut Cockpit Helmet POV (Atmospheric curve & starry black sky)
        if (this.cameraDirector.getActiveCamera() !== this.cockpitCam) {
          this.cameraDirector.setActiveCamera(this.cockpitCam);
          this.audio.playRadioTransmission('Capcom: Stage 1 MECO in 5 seconds. Guidance nominal.');
        }
      } else {
        // Shot 5: Staging Separation & Vacuum Engine Burn (48s - 60s)
        if (this.cameraDirector.getActiveCamera() !== this.separationCam) {
          this.cameraDirector.setActiveCamera(this.separationCam);
        }
      }
    }

    // Execute Staging Separation at ~48s
    if (this.elapsedTime >= 48) {
      if (!this.isSeparated) {
        this.isSeparated = true;
        this.audio.playRadioTransmission('Stage separation confirmed. Second stage vacuum engine ignition.');
        this.cameraDirector.shake(0.5, 1.5);
      }

      // Booster drifts backwards away from Stage 2
      this.rocket.stage1.position.y -= 8 * dt;
      this.rocket.stage1.rotation.x += 0.15 * dt;
    }

    this.cameraDirector.update();

    // Check Ascent Completion at 60s
    if (this.elapsedTime >= ASCENT_DURATION_S) {
      this.skip();
    }
  }

  dispose(): void {
    this.particles.dispose();
    this.rocket.root.dispose();
    this.earthEnv.root.dispose();
  }
}
