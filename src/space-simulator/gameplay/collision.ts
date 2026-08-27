import { Vector3 } from '@babylonjs/core/Maths/math.vector';

export interface BoxCollider {
  center: Vector3;
  halfExtents: Vector3;
}

export function resolveSphereBoxes(
  position: Vector3,
  radius: number,
  boxes: BoxCollider[],
): void {
  for (const box of boxes) {
    const dx = position.x - box.center.x;
    const dy = position.y - box.center.y;
    const dz = position.z - box.center.z;

    const px = Math.min(Math.max(dx, -box.halfExtents.x), box.halfExtents.x);
    const py = Math.min(Math.max(dy, -box.halfExtents.y), box.halfExtents.y);
    const pz = Math.min(Math.max(dz, -box.halfExtents.z), box.halfExtents.z);

    const ox = dx - px;
    const oy = dy - py;
    const oz = dz - pz;
    const distSq = ox * ox + oy * oy + oz * oz;

    if (distSq >= radius * radius) continue;

    if (distSq === 0) {
      const penX = box.halfExtents.x - Math.abs(dx);
      const penY = box.halfExtents.y - Math.abs(dy);
      const penZ = box.halfExtents.z - Math.abs(dz);
      if (penX <= penY && penX <= penZ) {
        position.x =
          box.center.x + (dx >= 0 ? 1 : -1) * (box.halfExtents.x + radius);
      } else if (penY <= penZ) {
        position.y =
          box.center.y + (dy >= 0 ? 1 : -1) * (box.halfExtents.y + radius);
      } else {
        position.z =
          box.center.z + (dz >= 0 ? 1 : -1) * (box.halfExtents.z + radius);
      }
      continue;
    }

    const dist = Math.sqrt(distSq);
    const push = (radius - dist) / dist;
    position.x += ox * push;
    position.y += oy * push;
    position.z += oz * push;
  }
}
