/**
 * Scene 3 — Orbital Space & ISS Docking Minigame (PRD §7, §8, §9).
 * Renders low-Earth orbit, modular ISS station, 6-DOF docking flight mechanics,
 * RCS thrusters, and alignment guidance.
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
import { ParticleManager } from '../rendering/particles';
import { CameraDirector } from '../cameras/CameraDirector';
import {
  DockingController,
  type DockingState,
  type DockingInput,
} from '../gameplay/docking';
import { AudioManager } from '../core/audio';
import { type InputState } from '../core/input';

export class OrbitDockingScene {
  iss: ISSModel;
  earthEnv: ReturnType<typeof buildEarthEnvironment>;
  dockingController: DockingController;
  particles: ParticleManager;
  playerShip: TransformNode;
  camera: UniversalCamera;

  private isDockingLocked = false;
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

    // Docking Controller
    this.dockingController = new DockingController('NORMAL');

    // Camera parented to player ship
    this.camera = this.cameraDirector.createDockingCamera();
    this.camera.parent = this.playerShip;
    this.camera.position.set(0, 1.2, -4.5); // Cockpit Chase Cam
    this.cameraDirector.setActiveCamera(this.camera);

    // Particles & Audio
    this.particles = new ParticleManager(scene);
    this.audio.startSpaceAmbient();
    this.audio.playRadioTransmission('Houston: ISS in visual range. Manual docking corridor active.');
  }

  private createPlayerCapsule(): void {
    const pbr = new PBRMaterial('capsule-mat', this.scene);
    pbr.albedoColor = new Color3(0.92, 0.94, 0.96);
    pbr.metallic = 0.7;
    pbr.roughness = 0.3;

    const cone = MeshBuilder.CreateCylinder('ship-cone', { height: 2.2, diameterTop: 0.6, diameterBottom: 2.8, tessellation: 20 }, this.scene);
    cone.rotation.x = Math.PI / 2;
    cone.position.z = 0;
    cone.material = pbr;
    cone.parent = this.playerShip;

    const trunk = MeshBuilder.CreateCylinder('ship-trunk', { height: 1.8, diameter: 2.8, tessellation: 20 }, this.scene);
    trunk.rotation.x = Math.PI / 2;
    trunk.position.z = -2.0;
    trunk.material = pbr;
    trunk.parent = this.playerShip;
  }

  reset(): void {
    this.dockingController.reset(45);
    this.isDockingLocked = false;
    this.lockTimer = 0;
  }

  update(dt: number, input: InputState): void {
    if (this.isDockingLocked) {
      this.lockTimer += dt;
      if (this.lockTimer > 2.5) {
        this.onDockingSuccess();
      }
      return;
    }

    // Convert unified InputState to DockingInput
    const dockingInput: DockingInput = {
      moveX: input.moveX,
      moveY: input.moveY,
      moveZ: input.moveZ,
      pitch: -input.lookY * 20.0,
      yaw: input.lookX * 20.0,
      roll: input.boost ? 1.0 : 0,
      brake: input.brake,
    };

    // Play RCS thruster burst sound & puffs on active input
    if (
      Math.abs(input.moveX) > 0.1 ||
      Math.abs(input.moveY) > 0.1 ||
      Math.abs(input.moveZ) > 0.1 ||
      Math.abs(input.lookX) > 0.1 ||
      Math.abs(input.lookY) > 0.1
    ) {
      if (Math.random() < 0.18) {
        this.audio.playThrusterBurst();
        this.particles.createRCSBurst(this.playerShip.position, new Vector3(-input.moveX, -input.moveY, -input.moveZ));
      }
    }

    // Advance 6-DOF physics
    const state = this.dockingController.step(dockingInput, dt);
    this.onDockingState(state);

    // Sync 3D player ship transform with DockingController physics state
    this.playerShip.position.set(
      this.dockingController.position.x,
      this.dockingController.position.y - 1.8, // align with docking port height
      this.dockingController.position.z + 10.5
    );

    this.playerShip.rotation.x = (this.dockingController.rotation.pitch * Math.PI) / 180;
    this.playerShip.rotation.y = (this.dockingController.rotation.yaw * Math.PI) / 180;
    this.playerShip.rotation.z = (this.dockingController.rotation.roll * Math.PI) / 180;

    // Check Docking Lock Success
    if (this.dockingController.isDocked && !this.isDockingLocked) {
      this.isDockingLocked = true;
      this.audio.playDockingLatch();
      this.audio.playRadioTransmission('Capture ring confirmed! Hard dock complete. Welcome to the ISS!');
      this.cameraDirector.shake(0.4, 1.2);
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
