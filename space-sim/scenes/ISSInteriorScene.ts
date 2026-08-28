/**
 * Scene 4 — ISS Interior Zero-G Exploration & Cupola (PRD §10).
 * Implements first-person zero-G kinematics, collision hulls, helmet flashlight,
 * interactable consoles, and the Cupola Earth Observation sequence.
 */

import {
  Scene,
  PointLight,
  HemisphericLight,
  SpotLight,
  Vector3,
  Color3,
  UniversalCamera,
} from '@babylonjs/core';
import {
  buildISSInterior,
  buildEarthEnvironment,
  type ISSInteriorModel,
} from '../rendering/proceduralModels';
import { ZeroGController } from '../gameplay/zeroG';
import { resolveCollisions, type BoundingBox } from '../gameplay/collision';
import { CameraDirector } from '../cameras/CameraDirector';
import { AudioManager } from '../core/audio';
import { type InputState } from '../core/input';

export interface InteractionPromptInfo {
  visible: boolean;
  prompt: string;
  id: string;
}

export class ISSInteriorScene {
  interior: ISSInteriorModel;
  earthEnv: ReturnType<typeof buildEarthEnvironment>;
  zeroG: ZeroGController;
  camera: UniversalCamera;
  flashlight: SpotLight;

  private colliderBoxes: BoundingBox[] = [];
  private isCupolaMode = false;
  private completedObjectives = new Set<string>();

  currentPrompt: InteractionPromptInfo = { visible: false, prompt: '', id: '' };

  constructor(
    public scene: Scene,
    public cameraDirector: CameraDirector,
    public audio: AudioManager,
    public onPromptChange: (info: InteractionPromptInfo) => void,
    public onMissionComplete: () => void
  ) {
    // Interior Ambient & LED Light Strips
    const hemiLight = new HemisphericLight('iss-interior-hemi', new Vector3(0, 1, 0), scene);
    hemiLight.intensity = 0.5;
    hemiLight.groundColor = new Color3(0.1, 0.12, 0.15);

    // Corridor point lights
    for (let z = -10; z <= 10; z += 6) {
      const pLight = new PointLight(`corridor-light-${z}`, new Vector3(0, 1.4, z), scene);
      pLight.intensity = 0.7;
      pLight.range = 8.0;
    }

    // 3D Interior & Earth background visible through Cupola windows
    this.earthEnv = buildEarthEnvironment(scene);
    this.earthEnv.root.position.set(0, -600, 300);

    this.interior = buildISSInterior(scene);

    // Zero-G Controller & Camera
    this.zeroG = new ZeroGController();
    this.camera = this.cameraDirector.createISSInteriorCamera();
    this.camera.position.set(0, 0, -10); // Start near airlock entrance
    this.cameraDirector.setActiveCamera(this.camera);

    // Helmet Flashlight
    this.flashlight = new SpotLight(
      'helmet-flashlight',
      new Vector3(0, 0, 0),
      new Vector3(0, 0, 1),
      Math.PI / 3.5,
      12,
      scene
    );
    this.flashlight.intensity = 1.4;
    this.flashlight.parent = this.camera;

    // Build Static Bounding Boxes for Corridor Walls and Equipment Racks
    this.setupCollisionBoxes();

    // Audio
    this.audio.startCabinHum();
    this.audio.playRadioTransmission('Station Comms: Welcome aboard Destiny Lab. Use thrusters or handrails to navigate in Zero-G.');
  }

  private setupCollisionBoxes(): void {
    // North & South end cap walls (z = -13 and z = +16.5)
    this.colliderBoxes.push({
      min: { x: -2.0, y: -2.0, z: -14.0 },
      max: { x: 2.0, y: 2.0, z: -12.5 },
    });

    // Left and Right corridor walls (x = -1.6 and x = +1.6)
    this.colliderBoxes.push({
      min: { x: -2.5, y: -2.0, z: -13.0 },
      max: { x: -1.6, y: 2.0, z: 16.0 },
    });
    this.colliderBoxes.push({
      min: { x: 1.6, y: -2.0, z: -13.0 },
      max: { x: 2.5, y: 2.0, z: 16.0 },
    });

    // Floor and Ceiling (y = -1.6 and y = +1.6)
    this.colliderBoxes.push({
      min: { x: -2.0, y: -2.5, z: -13.0 },
      max: { x: 2.0, y: -1.6, z: 16.0 },
    });
    this.colliderBoxes.push({
      min: { x: -2.0, y: 1.6, z: -13.0 },
      max: { x: 2.0, y: 2.5, z: 16.0 },
    });
  }

  toggleFlashlight(): void {
    this.flashlight.setEnabled(!this.flashlight.isEnabled());
  }

  update(dt: number, input: InputState): void {
    if (this.isCupolaMode) {
      // Rotate Earth slowly under Cupola view
      this.earthEnv.earth.rotation.y += 0.05 * dt;
      return;
    }

    // Apply look rotation from mouse/touch to camera
    if (input.lookX !== 0 || input.lookY !== 0) {
      this.camera.rotation.y -= input.lookX * 1.5;
      this.camera.rotation.x -= input.lookY * 1.5;
      // Clamp pitch
      this.camera.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.camera.rotation.x));
    }

    // Zero-G Physics Kinematics Step
    const forward = this.camera.getForwardRay().direction;
    const viewDir = { x: forward.x, y: forward.y, z: forward.z };

    const zeroGInput = {
      moveX: input.moveX,
      moveY: input.moveY,
      moveZ: input.moveZ,
      brake: input.brake,
    };

    const delta = this.zeroG.step(zeroGInput, viewDir, dt);

    // Apply translation to camera
    const rawPos = {
      x: this.camera.position.x + delta.x,
      y: this.camera.position.y + delta.y,
      z: this.camera.position.z + delta.z,
    };

    // AABB Collision Resolution against station walls & racks
    const resolved = resolveCollisions(rawPos, this.colliderBoxes, 0.35);
    this.camera.position.set(resolved.x, resolved.y, resolved.z);

    // Check Interactable Proximity
    this.checkInteractions(input.interact);
  }

  private checkInteractions(isInteractPressed: boolean): void {
    let closest: typeof this.interior.interactables[0] | null = null;
    let minDistance = 2.4;

    for (const item of this.interior.interactables) {
      const dist = Vector3.Distance(this.camera.position, item.node.position);
      if (dist < minDistance) {
        minDistance = dist;
        closest = item;
      }
    }

    if (closest) {
      this.currentPrompt = {
        visible: true,
        prompt: closest.prompt,
        id: closest.id,
      };
      this.onPromptChange(this.currentPrompt);

      if (isInteractPressed) {
        this.triggerInteraction(closest);
      }
    } else if (this.currentPrompt.visible) {
      this.currentPrompt = { visible: false, prompt: '', id: '' };
      this.onPromptChange(this.currentPrompt);
    }
  }

  private triggerInteraction(item: typeof this.interior.interactables[0]): void {
    this.completedObjectives.add(item.id);

    if (item.type === 'cupola') {
      // Cupola Earth Observation Mode
      this.isCupolaMode = true;
      this.camera.position.set(0, -1.8, 14.5);
      this.camera.setTarget(new Vector3(0, -300, 300)); // Gaze through observation window at Earth

      this.audio.playRadioTransmission('Cupola observation activated. Look at Earth below in quiet tranquility.');
      this.audio.startSpaceAmbient();

      setTimeout(() => {
        this.onMissionComplete();
      }, 5000);
    } else if (item.type === 'panel') {
      this.audio.playRadioTransmission('ECLSS Life Support Telemetry: O2 partial pressure 21.2 kPa, CO2 nominal, Cabin Pressure 101.3 kPa.');
    } else if (item.type === 'experiment') {
      this.audio.playRadioTransmission('Crystal growth experiment initialized. Microgravity crystallization verified.');
    }
  }

  dispose(): void {
    this.audio.stopCabinHum();
    this.interior.root.dispose();
    this.earthEnv.root.dispose();
  }
}
