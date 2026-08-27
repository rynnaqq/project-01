import { describe, expect, it } from 'vitest';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { resolveSphereBoxes, type BoxCollider } from './collision';

const unitBox: BoxCollider = {
  center: new Vector3(0, 0, 0),
  halfExtents: new Vector3(1, 1, 1),
};

describe('resolveSphereBoxes', () => {
  it('leaves clear spheres untouched', () => {
    const p = new Vector3(3, 0, 0);
    resolveSphereBoxes(p, 0.5, [unitBox]);
    expect(p.equals(new Vector3(3, 0, 0))).toBe(true);
  });

  it('pushes out along the approach axis', () => {
    const p = new Vector3(1.2, 0, 0);
    resolveSphereBoxes(p, 0.5, [unitBox]);
    expect(p.x).toBeCloseTo(1.5, 5);
  });

  it('resolves corner overlaps diagonally', () => {
    const p = new Vector3(1.15, 1.15, 0);
    resolveSphereBoxes(p, 0.5, [unitBox]);
    expect(p.x).toBeCloseTo(1.3535, 3);
    expect(p.y).toBeCloseTo(1.3535, 3);
  });

  it('ejects a centered sphere along the least-penetration axis', () => {
    const p = new Vector3(0, 0, 0);
    resolveSphereBoxes(p, 0.5, [unitBox]);
    expect(p.x).toBeCloseTo(1.5, 5);
  });

  it('resolves against the first box and stays clear of the next', () => {
    const second: BoxCollider = {
      center: new Vector3(3, 0, 0),
      halfExtents: new Vector3(1, 1, 1),
    };
    const p = new Vector3(1.2, 0, 0);
    resolveSphereBoxes(p, 0.5, [unitBox, second]);
    expect(p.x).toBeCloseTo(1.5, 5);
  });
});
