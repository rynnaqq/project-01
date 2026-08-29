// space-sim/core/noise.ts
function hash2(ix: number, iy: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}
function hash3(ix: number, iy: number, iz: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(iz, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}
const smooth = (t: number): number => t * t * (3 - 2 * t);

export function valueNoise2(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smooth(x - ix), fy = smooth(y - iy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  const top = a + (b - a) * fx, bottom = c + (d - c) * fx;
  return (top + (bottom - top) * fy) * 2 - 1;
}

export function valueNoise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
  const n = (dx: number, dy: number, dz: number): number => hash3(ix + dx, iy + dy, iz + dz);
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
  const layer = (dz: number): number => lerp(lerp(n(0, 0, dz), n(1, 0, dz), fx), lerp(n(0, 1, dz), n(1, 1, dz), fx), fy);
  return lerp(layer(0), layer(1), fz) * 2 - 1;
}

export function fbm2(x: number, y: number, octaves: number): number {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2(x * freq, y * freq) * amp;
    norm += amp; amp *= 0.5; freq *= 2.03;
  }
  return sum / norm;
}

export function fbm3(x: number, y: number, z: number, octaves: number): number {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise3(x * freq, y * freq, z * freq) * amp;
    norm += amp; amp *= 0.5; freq *= 2.03;
  }
  return sum / norm;
}
