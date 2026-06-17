import { ARENA_HALF, COLOR_PALETTE } from "./constants";

export interface MapObject {
  id: string;
  x: number;
  z: number;
  sx: number; // width
  sy: number; // height
  sz: number; // depth
  color: string;
}

/** Deterministic PRNG (mulberry32) so client & server build the identical map from a seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build the arena prop layout deterministically from a seed. */
export function generateMap(seed: number): MapObject[] {
  const rand = mulberry32(seed || 1);
  const objects: MapObject[] = [];
  const count = 26;
  const half = ARENA_HALF - 3;
  for (let i = 0; i < count; i++) {
    const x = (rand() * 2 - 1) * half;
    const z = (rand() * 2 - 1) * half;
    const sx = 0.8 + rand() * 2.2;
    const sz = 0.8 + rand() * 2.2;
    const sy = 0.8 + rand() * 2.0;
    const color = COLOR_PALETTE[Math.floor(rand() * COLOR_PALETTE.length)];
    objects.push({ id: `obj_${i}`, x, z, sx, sy, sz, color });
  }
  return objects;
}

/** Color of the nearest prop within `range` of (x,z), or null if none. */
export function nearestObjectColor(
  objects: MapObject[],
  x: number,
  z: number,
  range: number
): string | null {
  let best: MapObject | null = null;
  let bestD = range * range;
  for (const o of objects) {
    const dx = o.x - x;
    const dz = o.z - z;
    const d = dx * dx + dz * dz;
    if (d <= bestD) {
      bestD = d;
      best = o;
    }
  }
  return best ? best.color : null;
}
