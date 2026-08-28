/**
 * Simplified AABB collision system for ISS interior (PRD §10).
 * Pure math with optional Babylon.js adapter helpers.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBox {
  min: Vec3;
  max: Vec3;
}

export interface CollisionResult {
  collided: boolean;
  penetration: number;
  normal: Vec3;
}

/**
 * Check if two AABBs intersect and return minimum translation vector (MTV).
 */
export function checkAABB(a: BoundingBox, b: BoundingBox): CollisionResult {
  const dx1 = a.max.x - b.min.x;
  const dx2 = b.max.x - a.min.x;
  const dy1 = a.max.y - b.min.y;
  const dy2 = b.max.y - a.min.y;
  const dz1 = a.max.z - b.min.z;
  const dz2 = b.max.z - a.min.z;

  if (dx1 <= 0 || dx2 <= 0 || dy1 <= 0 || dy2 <= 0 || dz1 <= 0 || dz2 <= 0) {
    return { collided: false, penetration: 0, normal: { x: 0, y: 0, z: 0 } };
  }

  // Find minimum penetration axis
  const overlaps = [
    { axis: 'x', depth: Math.min(dx1, dx2), sign: dx1 < dx2 ? -1 : 1 },
    { axis: 'y', depth: Math.min(dy1, dy2), sign: dy1 < dy2 ? -1 : 1 },
    { axis: 'z', depth: Math.min(dz1, dz2), sign: dz1 < dz2 ? -1 : 1 },
  ];

  overlaps.sort((i, j) => i.depth - j.depth);
  const min = overlaps[0];

  let normal: Vec3 = { x: 0, y: 0, z: 0 };
  if (min.axis === 'x') normal = { x: min.sign, y: 0, z: 0 };
  else if (min.axis === 'y') normal = { x: 0, y: min.sign, z: 0 };
  else normal = { x: 0, y: 0, z: min.sign };

  return { collided: true, penetration: min.depth, normal };
}

/**
 * Resolve player position against static collider boxes.
 * Returns new adjusted position.
 */
export function resolveCollisions(
  currentPos: Vec3,
  colliders: BoundingBox[],
  radius: number = 0.35
): Vec3 {
  const pos = { ...currentPos };

  // Multiple iterations to resolve corner/stacked collisions
  for (let iter = 0; iter < 4; iter++) {
    let moved = false;
    const playerBox: BoundingBox = {
      min: { x: pos.x - radius, y: pos.y - radius, z: pos.z - radius },
      max: { x: pos.x + radius, y: pos.y + radius, z: pos.z + radius },
    };

    for (const col of colliders) {
      const result = checkAABB(playerBox, col);
      if (result.collided && result.penetration > 0.0001) {
        pos.x += result.normal.x * (result.penetration + 0.002);
        pos.y += result.normal.y * (result.penetration + 0.002);
        pos.z += result.normal.z * (result.penetration + 0.002);
        moved = true;
      }
    }
    if (!moved) break;
  }

  return pos;
}
