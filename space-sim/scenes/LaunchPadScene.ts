/**
 * Scene 1 — Launch Pad & Countdown (PRD §5).
 * Renders the launch pad platform, umbilical tower, rocket, steam particles,
 * and manages the synchronized T-10 countdown liftoff sequence.
 */

import {
  Scene,
  DirectionalLight,
  HemisphericLight,
  Vector3,
  Color3,
  ShadowGenerator,
  ParticleSystem,
} from '@babylonjs/core';
import { buildRocket, buildLaunchPad, type RocketModel, type LaunchPadModel } from '../rendering/proceduralModels';
import { ParticleManager } from '../rendering/particles';
import { CameraDirector } from '../cameras/CameraDirector';
import { Countdown } from '../core/countdown';
import { AudioManager } from '../core/audio';

export class LaunchPadScene {
  rocket: RocketModel;
  pad: LaunchPadModel;
  particles: ParticleManager;
  countdown: Countdown;
  shadows: ShadowGenerator | null = null;

  private coolingSteamPS: ParticleSystem | null = null;
  private flamePS: ParticleSystem | null = null;
  private isIgnited = false;
  private isLiftingOff = false;
  private liftoffSpeed = 0;

  constructor(
    public scene: Scene,
    public cameraDirector: CameraDirector,
    public audio: AudioManager,
    public onLaunchComplete: () => void
  ) {
    // Lighting
    const hemiLight = new HemisphericLight('pad-hemi-light', new Vector3(0, 1, 0), scene);
    hemiLight.intensity = 0.5;
    hemiLight.groundColor = new Color3(0.15, 0.15, 0.2);

    const sunLight = new DirectionalLight('pad-sun-light', new Vector3(-0.6, -1.0, -0.4), scene);
    sunLight.position = new Vector3(40, 90, 40);
    sunLight.intensity = 1.6;

    this.shadows = new ShadowGenerator(1024, sunLight);
    this.shadows.usePoissonSampling = true;

    // 3D Models
    this.pad = buildLaunchPad(scene);
    this.rocket = buildRocket(scene);

    if (this.shadows) {
      this.shadows.addShadowCaster(this.rocket.stage1);
      this.shadows.addShadowCaster(this.rocket.stage2);
      this.shadows.addShadowCaster(this.pad.tower);
    }

    // Camera
    const launchCam = this.cameraDirector.createLaunchCamera();
    launchCam.attachControl(scene.getEngine().getRenderingCanvas(), true);
    this.cameraDirector.setActiveCamera(launchCam);

    // Particle FX
    this.particles = new ParticleManager(scene);
    this.coolingSteamPS = this.particles.createCoolingSteam(this.rocket.exhaustPoint);
    this.coolingSteamPS.start();

    // Countdown logic
    this.countdown = new Countdown(1000, 10);
    this.setupCountdownEvents();
  }

  private setupCountdownEvents(): void {
    this.countdown.onTick.add((val) => {
      this.audio.playCountdownBeep(val);

      if (val === 10) {
        this.audio.playRadioTransmission('Mission Control: Terminal count started. All systems nominal.');
      } else if (val === 3) {
        // T-3: Engine Ignition
        this.igniteEngines();
        this.audio.playRadioTransmission('Ignition sequence start.');
      } else if (val === 0) {
        // T-0: Liftoff
        this.liftoff();
      }
    });

    this.countdown.onLiftoff.add(() => {
      this.liftoff();
    });
  }

  private igniteEngines(): void {
    if (this.isIgnited) return;
    this.isIgnited = true;

    // Start engine fire particles
    this.flamePS = this.particles.createEngineFlame(this.rocket.exhaustPoint);
    this.flamePS.start();

    // Start launch smoke
    const smokePS = this.particles.createLaunchSmoke(this.rocket.exhaustPoint.position);
    smokePS.start();

    // Audio & Camera Shake
    this.audio.startRocketRumble(0.6);
    this.cameraDirector.shake(0.3, 3.0);
  }

  private liftoff(): void {
    if (this.isLiftingOff) return;
    this.isLiftingOff = true;
    if (!this.isIgnited) this.igniteEngines();

    this.audio.playRadioTransmission('Tower clear! Liftoff, we have liftoff!');
    this.audio.setRocketThrottle(1.0);
    this.cameraDirector.shake(0.6, 4.0);

    // Retract service arm
    if (this.pad.serviceArm) {
      this.pad.serviceArm.rotation.y = -Math.PI / 3;
    }
  }

  startCountdown(): void {
    this.countdown.start();
  }

  skipToAscent(): void {
    this.countdown.stop();
    this.audio.stopRocketRumble();
    this.onLaunchComplete();
  }

  update(dt: number): void {
    this.cameraDirector.update();

    if (this.isLiftingOff) {
      this.liftoffSpeed += 12 * dt; // accelerating upwards
      this.rocket.root.position.y += this.liftoffSpeed * dt;

      // When rocket clears the launch tower (~120m height), transition to Scene 2 (Ascent)
      if (this.rocket.root.position.y > 90) {
        this.onLaunchComplete();
      }
    }
  }

  dispose(): void {
    this.countdown.stop();
    this.particles.dispose();
    this.rocket.root.dispose();
    this.pad.root.dispose();
  }
}
