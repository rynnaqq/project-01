/**
 * Scene 2 — Rocket Ascent & Cinematic Camera Director (PRD §6).
 * Manages deterministic trajectory, staging separation, 4 cinematic camera shots,
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
  private boosterCam: UniversalCamera;
  private cockpitCam: UniversalCamera;
  private separationCam: UniversalCamera;

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
    hemiLight.intensity = 0.4;
    hemiLight.groundColor = new Color3(0.05, 0.05, 0.1);

    const sunLight = new DirectionalLight('ascent-sun-light', new Vector3(-0.7, -0.6, -0.4), scene);
    sunLight.intensity = 2.0;

    // 3D Models
    this.earthEnv = buildEarthEnvironment(scene);
    this.rocket = buildRocket(scene);

    // Particle exhaust & supersonic shock diamonds
    this.particles = new ParticleManager(scene);
    this.flamePS = this.particles.createEngineFlame(this.rocket.exhaustPoint);
    this.flamePS.start();
    const machPS = this.particles.createMachDiamonds(this.rocket.exhaustPoint);
    machPS.start();

    // Camera Rigs
    this.groundCam = this.cameraDirector.createAscentGroundCamera();
    this.boosterCam = this.cameraDirector.createBoosterCamera(this.rocket.stage1);
    this.cockpitCam = this.cameraDirector.createCockpitCamera(this.rocket.capsule);
    this.separationCam = new UniversalCamera('separation-cam', new Vector3(-25, 40, -35), scene);
    this.separationCam.setTarget(new Vector3(0, 36, 0));

    // Start with Ground Tracking Shot
    this.cameraDirector.setActiveCamera(this.groundCam);

    // Sound
    this.audio.startRocketRumble(1.0);
    this.audio.playRadioTransmission('Flight: Vehicle is supersonic. Trajectory nominal.');
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

    // Camera shot switcher timeline (PRD §4.4)
    if (this.elapsedTime < 10) {
      // Shot 1: Ground Tracking Shot
      this.groundCam.setTarget(this.rocket.root.position);
      if (this.cameraDirector.getActiveCamera() !== this.groundCam) {
        this.cameraDirector.setActiveCamera(this.groundCam);
      }
    } else if (this.elapsedTime < 22) {
      // Shot 2: Booster POV (Looking down at receding Earth)
      if (this.cameraDirector.getActiveCamera() !== this.boosterCam) {
        this.cameraDirector.setActiveCamera(this.boosterCam);
        this.audio.playRadioTransmission('Passing Max-Q: Maximum aerodynamic pressure.');
      }
    } else if (this.elapsedTime < 30) {
      // Shot 3: Cockpit Helmet POV
      if (this.cameraDirector.getActiveCamera() !== this.cockpitCam) {
        this.cameraDirector.setActiveCamera(this.cockpitCam);
        this.audio.playRadioTransmission('Stage 1 Main Engine Cutoff (MECO) in 5 seconds.');
      }
    } else {
      // Shot 4: Stage Separation & Orbital Insertion
      if (this.cameraDirector.getActiveCamera() !== this.separationCam) {
        this.cameraDirector.setActiveCamera(this.separationCam);
        this.separationCam.parent = this.rocket.root;
      }

      // Execute Staging Jettison at ~30s
      if (!this.isSeparated) {
        this.isSeparated = true;
        this.audio.playRadioTransmission('Stage separation confirmed. Second stage engine ignition.');
        this.cameraDirector.shake(0.5, 1.5);
      }

      // Booster drifts backwards away from stage 2
      this.rocket.stage1.position.y -= 8 * dt;
      this.rocket.stage1.rotation.x += 0.2 * dt;
    }

    this.cameraDirector.update();

    // Check Ascent Completion
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
