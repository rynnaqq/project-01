// space-sim/player.ts
/**
 * SIMULATION layer: the player rig. Two controllers share one rig:
 *  - updateAscent: vertical climb vs. gravity (PRD §B.3)
 *  - updateOrbit: 6-DOF zero-G with inertia (PRD §B.4/B.5)
 * The rig owns its transform + velocity; Havok collision (if enabled) is
 * applied by main.ts, never the other way around (PRD §B.7).
 */
import {
  FreeCamera, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3,
  Color3,
} from '@babylonjs/core';
import { ALT, ASCENT, PLAYER, THRUST, gravityAt } from './config';
import { applyDamping, ascentStep, brakeVelocity, burnFuel } from './flight';
import type { InputState } from './input';

export interface LookDelta { yaw: number; pitch: number }

export interface PlayerRig {
  root: TransformNode;
  camera: FreeCamera;
  velocity: Vector3;
  fuel: number;
  assist: boolean;
  /** Phase 1: climb. Returns true once the orbit threshold is crossed. */
  updateAscent(input: InputState, dt: number): boolean;
  /** Phases 2–3: 6-DOF. */
  updateOrbit(input: InputState, look: LookDelta, dt: number): void;
  /** Face the camera at a world target (PRD §E.10 recenter). */
  recenterTo(target: Vector3): void;
  dispose(): void;
}

const LOOK_SENS = PLAYER.lookSensitivity;
const ROT_SPEED = PLAYER.rollSpeed;

export function createPlayer(scene: Scene, startPos: Vector3): PlayerRig {
  const root = new TransformNode('player', scene);
  root.position = startPos.clone();

  // Simple visible capsule so the player has a body in frame.
  const body = MeshBuilder.CreateCapsule(
    'playerBody', { radius: PLAYER.bodyRadius, height: PLAYER.bodyHeight }, scene,
  );
  const bodyMat = new StandardMaterial('playerMat', scene);
  bodyMat.diffuseColor = new Color3(0.9, 0.9, 0.92);
  body.material = bodyMat;
  body.parent = root;
  body.position.y = PLAYER.bodyOffsetY;

  const camera = new FreeCamera('playerCam', startPos.clone(), scene);
  camera.minZ = PLAYER.minZ;
  camera.maxZ = PLAYER.maxZ;
  camera.attachControl(scene.getEngine().getRenderingCanvas(), true);
  // We drive rotation ourselves from input; disable the camera's own keys.
  camera.inputs.clear();

  const rig: PlayerRig = {
    root,
    camera,
    velocity: Vector3.Zero(),
    fuel: THRUST.fuelCapacity,
    assist: false,

    updateAscent(input, dt) {
      const thrust01 = input.forward > 0 ? 1 : 0;
      const step = ascentStep(
        root.position.y, rig.velocity.y, thrust01,
        gravityAt(root.position.y), ASCENT.thrustAccel, ASCENT.maxVy, dt,
      );
      rig.velocity.y = step.vy;
      rig.velocity.x = 0;
      rig.velocity.z = 0;
      root.position.y = step.y;
      rig.fuel = burnFuel(rig.fuel, thrust01, THRUST.fuelConsumptionRate, dt);
      camera.position.copyFrom(root.position);
      return root.position.y >= ALT.ORBIT_Y;
    },

    updateOrbit(input, look, dt) {
      // Look: yaw/pitch from mouse or touch drag, roll from Q/E.
      camera.rotation.y += look.yaw * LOOK_SENS;
      camera.rotation.x += look.pitch * LOOK_SENS;
      camera.rotation.x = Math.max(-PLAYER.maxPitch, Math.min(PLAYER.maxPitch, camera.rotation.x));
      camera.rotation.z += -input.roll * ROT_SPEED * dt;

      // Translation along camera axes (inertia: velocity persists, PRD §B.5).
      const hasFuel = rig.fuel > 0;
      const f = THRUST.maxForce;
      const fwd = camera.getDirection(Vector3.Forward());
      const right = camera.getDirection(Vector3.Right());
      const up = camera.getDirection(Vector3.Up());
      if (hasFuel) {
        if (input.forward) rig.velocity.addInPlace(fwd.scale(input.forward * f * dt));
        if (input.backward) rig.velocity.addInPlace(fwd.scale(-input.backward * f * dt));
        if (input.right) rig.velocity.addInPlace(right.scale(input.right * f * dt));
        if (input.left) rig.velocity.addInPlace(right.scale(-input.left * f * dt));
        if (input.up) rig.velocity.addInPlace(up.scale(input.up * f * dt));
        if (input.down) rig.velocity.addInPlace(up.scale(-input.down * f * dt));
      }

      const thrustMag = Math.min(1,
        Math.abs(input.forward) + Math.abs(input.backward)
        + Math.abs(input.left) + Math.abs(input.right)
        + Math.abs(input.up) + Math.abs(input.down));
      rig.fuel = burnFuel(rig.fuel, thrustMag, THRUST.fuelConsumptionRate, dt);

      // Brake (R): counter-thrust toward zero velocity.
      if (input.brake) {
        const braked = brakeVelocity(
          { x: rig.velocity.x, y: rig.velocity.y, z: rig.velocity.z },
          THRUST.brakeAccel, dt,
        );
        rig.velocity.set(braked.x, braked.y, braked.z);
        rig.fuel = burnFuel(rig.fuel, PLAYER.brakeBurnFactor, THRUST.fuelConsumptionRate, dt);
      }

      // Damping (assist raises it for stabilization, PRD §C.5 F).
      const lin = rig.assist ? THRUST.assistLinearDamping : THRUST.linearDamping;
      const damped = applyDamping(
        { x: rig.velocity.x, y: rig.velocity.y, z: rig.velocity.z }, lin, dt,
      );
      rig.velocity.set(damped.x, damped.y, damped.z);

      root.position.addInPlace(rig.velocity.scale(dt));
      camera.position.copyFrom(root.position);
    },

    recenterTo(target) {
      // ponytail: brief said camera.setDirection(), which FreeCamera lacks;
      // set Euler rotation directly. Pitch is negated: positive rotation.x
      // pitches Babylon's FreeCamera DOWN.
      const dir = target.subtract(root.position).normalize();
      const yaw = Math.atan2(dir.x, dir.z);
      const pitch = -Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
      camera.rotation.set(pitch, yaw, 0);
    },

    dispose() {
      camera.dispose();
      root.dispose();
    },
  };
  return rig;
}
