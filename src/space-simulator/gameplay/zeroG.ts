import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { InputState } from './docking';
import { resolveSphereBoxes, type BoxCollider } from './collision';

interface ZeroGOptions {
  accel?: number;
  maxSpeed?: number;
  dragRate?: number;
  turnRate?: number;
  radius?: number;
}

export class ZeroGController {
  position = new Vector3(0, 0, 14);
  velocity = Vector3.Zero();
  rotation = Quaternion.Identity();

  readonly radius: number;
  private readonly accel: number;
  private readonly maxSpeed: number;
  private readonly dragRate: number;
  private readonly turnRate: number;

  constructor(options: ZeroGOptions = {}) {
    this.accel = options.accel ?? 2.2;
    this.maxSpeed = options.maxSpeed ?? 3;
    this.dragRate = options.dragRate ?? 0.8;
    this.turnRate = options.turnRate ?? 1.1;
    this.radius = options.radius ?? 0.45;
  }

  update(dt: number, input: InputState, colliders?: BoxCollider[]): void {
    const frame = Matrix.Identity();
    Matrix.FromQuaternionToRef(this.rotation, frame);

    const thrust = new Vector3(input.moveX, input.moveY, input.moveZ)
      .scaleInPlace(this.accel * (input.boost ? 3 : 1) * dt);
    this.velocity.addInPlace(Vector3.TransformNormal(thrust, frame));

    const damp = Math.exp(-(input.brake ? 6 : this.dragRate) * dt);
    this.velocity.scaleInPlace(damp);

    const speed = this.velocity.length();
    if (speed > this.maxSpeed) {
      this.velocity.scaleInPlace(this.maxSpeed / speed);
    }

    this.position.addInPlace(this.velocity.scale(dt));

    if (colliders && colliders.length > 0) {
      resolveSphereBoxes(this.position, this.radius, colliders);
    }

    const turn = this.turnRate * dt;
    this.rotation = this.rotation.multiply(
      Quaternion.RotationYawPitchRoll(
        input.lookX * turn,
        input.lookY * turn,
        0,
      ),
    );
  }
}
