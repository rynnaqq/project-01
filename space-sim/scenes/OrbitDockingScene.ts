/**
 * Scene 3 — Orbital Space & ISS Automated Docking Animation (PRD §7, §8, §9).
 * Renders low-Earth orbit, modular ISS station, automated cinematic approach trajectory,
 * periodic RCS alignment bursts, and capture ring latch animation.
 */

import {
  Scene,
  DirectionalLight,
  HemisphericLight,
  Vector3,
  Color3,
  TransformNode,
  UniversalCamera,
  MeshBuilder,
  PBRMaterial,
} from '@babylonjs/core';
import { buildEarthEnvironment, buildISS, type ISSModel } from '../rendering/proceduralModels';
import { createRocketLiveryTexture } from '../rendering/textureGenerator';
import { ParticleManager } from '../rendering/particles';
import { CameraDirector } from '../cameras/CameraDirector';
import { type DockingState } from '../gameplay/docking';
import { AudioManager } from '../core/audio';

export const DOCKING_ANIM_DURATION = 10.0; // seconds

export class OrbitDockingScene {
  iss: ISSModel;
  earthEnv: ReturnType<typeof buildEarthEnvironment>;
  particles: ParticleManager;
  playerShip: TransformNode;
  camera: UniversalCamera;

  private elapsedTime = 0;
  private isDockingLocked = false;
  private hasAnnouncedMid = false;
  private hasAnnouncedSoft = false;
  private hasTriggeredSuccess = false;
  private lockTimer = 0;

  constructor(
    public scene: Scene,
    public cameraDirector: CameraDirector,
    public audio: AudioManager,
    public onDockingState: (state: DockingState) => void,
    public onDockingSuccess: () => void
  ) {
    // Space Lighting
    const hemiLight = new HemisphericLight('orbit-hemi', new Vector3(0, 1, 0), scene);
    hemiLight.intensity = 0.35;
    hemiLight.groundColor = new Color3(0.04, 0.08, 0.15); // Earth blue rim fill

    const sunLight = new DirectionalLight('orbit-sun', new Vector3(-0.8, -0.4, 0.6), scene);
    sunLight.intensity = 2.4;

    // 3D Environment & Models
    this.earthEnv = buildEarthEnvironment(scene);
    this.iss = buildISS(scene);

    // Player Capsule Ship Model
    this.playerShip = new TransformNode('player-ship-capsule', scene);
    this.createPlayerCapsule();

    // Camera parented to player ship
    this.camera = this.cameraDirector.createDockingCamera();
    this.camera.parent = this.playerShip;
    this.camera.position.set(0, 1.2, -4.5); // Cockpit Chase Cam
    this.cameraDirector.setActiveCamera(this.camera);

    // Particles & Audio
    this.particles = new ParticleManager(scene);
    this.audio.startSpaceAmbient();
    this.audio.playRadioTransmission('Houston: Automated docking approach engaged. Guidance computer is on track.');
  }

  private createPlayerCapsule(): void {
    const liveryTex = createRocketLiveryTexture(this.scene);

    const capsuleMat = new PBRMaterial('capsule-mat', this.scene);
    capsuleMat.albedoTexture = liveryTex;
    capsuleMat.metallic = 0.5;
    capsuleMat.roughness = 0.25;

    const carbonMat = new PBRMaterial('capsule-carbon-mat', this.scene);
    carbonMat.albedoColor = new Color3(0.08, 0.09, 0.12);
    carbonMat.metallic = 0.85;
    carbonMat.roughness = 0.3;

    const heatMat = new PBRMaterial('capsule-heat-mat', this.scene);
    heatMat.albedoColor = new Color3(0.05, 0.05, 0.06);
    heatMat.metallic = 0.2;
    heatMat.roughness = 0.7;

    // Command module crew cone
    const cone = MeshBuilder.CreateCylinder('ship-cone', { height: 2.8, diameterTop: 0.7, diameterBottom: 3.2, tessellation: 36 }, this.scene);
    cone.rotation.x = Math.PI / 2;
    cone.position.z = 0.8;
    cone.material = capsuleMat;
    cone.parent = this.playerShip;

    // Nosecone docking cap
    const noseCap = MeshBuilder.CreateSphere('ship-nose-cap', { diameter: 0.75, segments: 20 }, this.scene);
    noseCap.position.z = 2.25;
    noseCap.material = carbonMat;
    noseCap.parent = this.playerShip;

    // SuperDraco thruster nacelles (4x around capsule)
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const thruster = MeshBuilder.CreateBox(`ship-thruster-${i}`, { width: 0.35, height: 0.35, depth: 0.6 }, this.scene);
      thruster.position.set(Math.cos(angle) * 1.35, Math.sin(angle) * 1.35, 0.4);
      thruster.rotation.z = angle;
      thruster.material = carbonMat;
      thruster.parent = this.playerShip;
    }

    // Heatshield base
    const heatshield = MeshBuilder.CreateCylinder('ship-heatshield', { height: 0.25, diameter: 3.22, tessellation: 36 }, this.scene);
    heatshield.rotation.x = Math.PI / 2;
    heatshield.position.z = -0.55;
    heatshield.material = heatMat;
    heatshield.parent = this.playerShip;

    // Service Trunk with solar wrap
    const trunk = MeshBuilder.CreateCylinder('ship-trunk', { height: 2.6, diameter: 3.2, tessellation: 36 }, this.scene);
    trunk.rotation.x = Math.PI / 2;
    trunk.position.z = -1.9;
    trunk.material = carbonMat;
    trunk.parent = this.playerShip;

    // Trunk stabilizer finlets (2x)
    for (const fSign of [-1, 1]) {
      const fin = MeshBuilder.CreateBox(`ship-trunk-fin-${fSign}`, { width: 0.08, height: 0.8, depth: 2.2 }, this.scene);
      fin.position.set(0, fSign * 1.8, -1.9);
      fin.material = carbonMat;
      fin.parent = this.playerShip;
    }
  }

  skip(): void {
    if (this.hasTriggeredSuccess) return;
    this.isDockingLocked = true;
    this.hasTriggeredSuccess = true;
    this.audio.playDockingLatch();
    this.onDockingSuccess();
  }

  update(dt: number): void {
    if (this.isDockingLocked) {
      this.lockTimer += dt;
      this.cameraDirector.update();
      if (this.lockTimer > 1.2 && !this.hasTriggeredSuccess) {
        this.hasTriggeredSuccess = true;
        this.onDockingSuccess();
      }
      return;
    }

    this.elapsedTime += dt;
    const progress = Math.min(1.0, this.elapsedTime / DOCKING_ANIM_DURATION);

    // Smoothstep easing
    const ease = progress * progress * (3 - 2 * progress);

    // Automated trajectory interpolation from offset to docking port
    const startX = 2.5;
    const startY = 1.6;
    const startZ = -45.0;
    const startPitch = 5.0;
    const startYaw = -7.5;
    const startRoll = 2.5;

    const currentX = startX * (1 - ease);
    const currentY = startY * (1 - ease);
    const currentZ = startZ * (1 - ease);
    const currentPitch = startPitch * (1 - ease);
    const currentYaw = startYaw * (1 - ease);
    const currentRoll = startRoll * (1 - ease);

    // Update 3D player ship transform
    this.playerShip.position.set(currentX, currentY - 1.8, currentZ + 10.5);
    this.playerShip.rotation.x = (currentPitch * Math.PI) / 180;
    this.playerShip.rotation.y = (currentYaw * Math.PI) / 180;
    this.playerShip.rotation.z = (currentRoll * Math.PI) / 180;

    // Calculate simulated telemetry
    const distance = Math.abs(currentZ);
    const relativeVelocity = Math.max(0.04, (1.0 - ease) * 0.9);
    const transverseError = Math.sqrt(currentX ** 2 + currentY ** 2);
    const alignmentScore = Math.min(100, Math.round(60 + ease * 40));

    const state: DockingState = {
      distance,
      relativeVelocity,
      transverseError,
      pitchError: currentPitch,
      yawError: currentYaw,
      rollError: currentRoll,
      alignmentScore,
    };
    this.onDockingState(state);

    // Periodic automatic RCS thruster puffs & audio cues
    if (
      (this.elapsedTime >= 1.5 && this.elapsedTime < 1.5 + dt) ||
      (this.elapsedTime >= 3.8 && this.elapsedTime < 3.8 + dt) ||
      (this.elapsedTime >= 6.5 && this.elapsedTime < 6.5 + dt)
    ) {
      this.audio.playThrusterBurst();
      this.particles.createRCSBurst(this.playerShip.position, new Vector3(0.5, 0.2, 1.0));
    }

    // Mid-approach radio updates
    if (this.elapsedTime >= 4.5 && !this.hasAnnouncedMid) {
      this.hasAnnouncedMid = true;
      this.audio.playRadioTransmission('Station: Approaching 20 meters. Centerline alignment is green.');
    }

    if (this.elapsedTime >= 8.5 && !this.hasAnnouncedSoft) {
      this.hasAnnouncedSoft = true;
      this.audio.playRadioTransmission('Capture ring contact in 5, 4, 3, 2, 1...');
    }

    // Complete Automated Docking Lock at progress = 1.0
    if (progress >= 1.0 && !this.isDockingLocked) {
      this.isDockingLocked = true;
      this.audio.playDockingLatch();
      this.audio.playRadioTransmission('Capture confirmed! Hard dock complete. Welcome to the International Space Station.');
      this.cameraDirector.shake(0.35, 1.2);
    }

    this.cameraDirector.update();
  }

  dispose(): void {
    this.particles.dispose();
    this.playerShip.dispose();
    this.iss.root.dispose();
    this.earthEnv.root.dispose();
  }
}
