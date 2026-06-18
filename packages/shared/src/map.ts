import { ARENA_HALF, COLOR_PALETTE } from "./constants";

/** Shape families a prop (and a disguised player) can take. */
export type PropKind = "crate" | "barrel" | "bush" | "rock" | "pillar";
export const PROP_KINDS: PropKind[] = ["crate", "barrel", "bush", "rock", "pillar"];

export interface MapObject {
  id: string;
  kind: PropKind;
  x: number;
  z: number;
  sx: number; // width  (also diameter for round kinds)
  sy: number; // height
  sz: number; // depth
  color: string;
}

/** A walk-in structure with an interior, used as cover/hiding. */
export interface Building {
  id: string;
  x: number;
  z: number;
  w: number; // width  (x)
  d: number; // depth  (z)
  h: number; // wall height
  rotY: number; // facing rotation (radians, multiples of PI/2)
  color: string;
  roof: string;
}

const BUILDING_COLORS = ["#6b5b4f", "#7a6a5d", "#8a7a5a", "#5c6b6b", "#704a3a", "#5a6650"];
const ROOF_COLORS = ["#3a2e26", "#46342a", "#2e3a3a", "#402a22"];

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

/** Size a prop sensibly for its shape family. */
function sizeForKind(kind: PropKind, rand: () => number): { sx: number; sy: number; sz: number } {
  switch (kind) {
    case "crate": {
      const s = 0.9 + rand() * 1.1;
      return { sx: s, sy: s * (0.8 + rand() * 0.5), sz: s };
    }
    case "barrel": {
      const d = 0.9 + rand() * 0.7;
      return { sx: d, sy: 1.1 + rand() * 0.8, sz: d };
    }
    case "bush": {
      const d = 1.3 + rand() * 1.4;
      return { sx: d, sy: d * (0.7 + rand() * 0.3), sz: d };
    }
    case "rock": {
      const d = 1.0 + rand() * 1.6;
      return { sx: d, sy: d * (0.6 + rand() * 0.4), sz: d };
    }
    case "pillar": {
      const d = 0.6 + rand() * 0.5;
      return { sx: d, sy: 2.2 + rand() * 1.4, sz: d };
    }
  }
}

/** Build the arena prop layout deterministically from a seed. */
export function generateMap(seed: number): MapObject[] {
  const rand = mulberry32(seed || 1);
  const objects: MapObject[] = [];
  const count = 12; // fewer scattered props — buildings carry the scene now
  const half = ARENA_HALF - 3;
  for (let i = 0; i < count; i++) {
    const x = (rand() * 2 - 1) * half;
    const z = (rand() * 2 - 1) * half;
    const kind = PROP_KINDS[Math.floor(rand() * PROP_KINDS.length)];
    const { sx, sy, sz } = sizeForKind(kind, rand);
    const color = COLOR_PALETTE[Math.floor(rand() * COLOR_PALETTE.length)];
    objects.push({ id: `obj_${i}`, kind, x, z, sx, sy, sz, color });
  }
  return objects;
}

/** Build the arena buildings deterministically (separate stream from props). */
export function generateBuildings(seed: number): Building[] {
  const rand = mulberry32(((seed || 1) ^ 0x9e3779b9) >>> 0);
  const out: Building[] = [];
  const target = 7; // a small village
  const half = ARENA_HALF - 7;
  let attempts = 0;
  while (out.length < target && attempts < 240) {
    attempts++;
    const w = 4 + rand() * 3.5;
    const d = 4 + rand() * 3.5;
    const x = (rand() * 2 - 1) * half;
    const z = (rand() * 2 - 1) * half;
    const radius = Math.max(w, d) / 2;
    // Keep the central plaza (seeker spawn) clear.
    if (Math.hypot(x, z) < 9) continue;
    // Reject overlaps so buildings never intersect.
    let ok = true;
    for (const b of out) {
      const minDist = radius + Math.max(b.w, b.d) / 2 + 2.0;
      if (Math.hypot(x - b.x, z - b.z) < minDist) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    out.push({
      id: `bld_${out.length}`,
      x,
      z,
      w,
      d,
      h: 3.0 + rand() * 1.8,
      rotY: Math.floor(rand() * 4) * (Math.PI / 2),
      color: BUILDING_COLORS[Math.floor(rand() * BUILDING_COLORS.length)],
      roof: ROOF_COLORS[Math.floor(rand() * ROOF_COLORS.length)],
    });
  }
  return out;
}

/** Nearest prop within `range` of (x,z), or null if none. */
export function nearestObject(
  objects: MapObject[],
  x: number,
  z: number,
  range: number
): MapObject | null {
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
  return best;
}

/** Color of the nearest prop within `range` of (x,z), or null if none. */
export function nearestObjectColor(
  objects: MapObject[],
  x: number,
  z: number,
  range: number
): string | null {
  return nearestObject(objects, x, z, range)?.color ?? null;
}
