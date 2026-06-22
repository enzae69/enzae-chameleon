import {
  ARENA_HALF,
  WALL_THICKNESS,
  PLAYER_RADIUS,
  BUILDING_WALL_T,
  BUILDING_DOOR_W,
  INTERIOR_WALL_T,
  ROOM_DOORWAY_HALF,
  ROOM_LINES,
  ROOM_DOOR_CENTERS,
  EXIT_HALF,
  DECK_DEPTH,
  DECK_HALF_W,
} from "./constants";

/** Axis-aligned wall box (centre + half extents) for rooms, perimeter and deck. */
export interface WallSeg {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  kind: "interior" | "perimeter" | "rail";
}

/** Shape families a prop (and a disguised player) can take. */
export type PropKind = "crate" | "barrel" | "tank" | "rock" | "pillar";
export const PROP_KINDS: PropKind[] = ["crate", "barrel", "tank", "rock", "pillar"];

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

// Lab-facility module colours: clean panels + metal trims.
const BUILDING_COLORS = ["#c9d2d8", "#aeb8bf", "#d7dde0", "#9fb0b8", "#bcc6cc", "#8f9aa6"];
const ROOF_COLORS = ["#5b656b", "#49525a", "#646e74", "#3f474d"];

/** Lab prop palette: metals, hazard + chemical tones (varied so hiders can still blend). */
export const LAB_PALETTE = [
  "#b8c0c6", "#9aa3aa", "#7f8a92", "#c7ccd0", // metals / greys
  "#e0b020", "#d98f1a", // hazard yellow / orange
  "#37a85f", "#2bb39a", // chemical green / teal
  "#3a78c2", "#4aa0d6", // coolant blue
  "#c23a3a", "#a33", // warning red
  "#6a4ea3", "#d05fb0", // reagent purple / magenta
  "#e8edf0", "#54606a", // white / dark steel
];

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
    case "tank": {
      const d = 1.4 + rand() * 0.9;
      return { sx: d, sy: 2.2 + rand() * 1.4, sz: d };
    }
    case "rock": {
      // crate-stack / equipment block
      const d = 1.0 + rand() * 1.6;
      return { sx: d, sy: d * (0.6 + rand() * 0.4), sz: d };
    }
    case "pillar": {
      const d = 0.6 + rand() * 0.5;
      return { sx: d, sy: 2.2 + rand() * 1.4, sz: d };
    }
  }
}

/** Build the arena prop layout: lots of lab equipment in the rooms + on the deck. */
export function generateMap(seed: number): MapObject[] {
  const rand = mulberry32(seed || 1);
  const buildings = generateBuildings(seed);
  const objects: MapObject[] = [];

  const push = (x: number, z: number) => {
    const kind = PROP_KINDS[Math.floor(rand() * PROP_KINDS.length)];
    const { sx, sy, sz } = sizeForKind(kind, rand);
    const color = LAB_PALETTE[Math.floor(rand() * LAB_PALETTE.length)];
    objects.push({ id: `obj_${objects.length}`, kind, x, z, sx, sy, sz, color });
  };

  const half = ARENA_HALF - 2.5;
  const target = 48;
  let attempts = 0;
  while (objects.length < target && attempts < target * 8) {
    attempts++;
    const x = (rand() * 2 - 1) * half;
    const z = (rand() * 2 - 1) * half;
    if (Math.hypot(x, z) < 6) continue; // keep the spawn pad clear
    if (ROOM_LINES.some((L) => Math.abs(x - L) < 1.7 || Math.abs(z - L) < 1.7)) continue; // off walls/doorways
    let inBuilding = false;
    for (const b of buildings) {
      if (Math.abs(x - b.x) < b.w / 2 + 0.9 && Math.abs(z - b.z) < b.d / 2 + 0.9) {
        inBuilding = true;
        break;
      }
    }
    if (inBuilding) continue;
    push(x, z);
  }

  // A few crates/tanks out on the deck so "going outside" has something to find.
  for (let i = 0; i < 4; i++) {
    const x = ARENA_HALF + 3 + rand() * (DECK_DEPTH - 5);
    const z = (rand() * 2 - 1) * (DECK_HALF_W - 1.6);
    push(x, z);
  }
  return objects;
}

/** Place one sealed lab module inside some room cells (never the central spawn). */
export function generateBuildings(seed: number): Building[] {
  const rand = mulberry32(((seed || 1) ^ 0x9e3779b9) >>> 0);
  const cells: [number, number][] = [];
  for (const cx of ROOM_DOOR_CENTERS) {
    for (const cz of ROOM_DOOR_CENTERS) {
      if (cx === 0 && cz === 0) continue; // keep the spawn room open
      cells.push([cx, cz]);
    }
  }
  // Deterministic shuffle.
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const out: Building[] = [];
  const n = Math.min(6, cells.length); // modules in 6 of the 8 outer rooms
  for (let i = 0; i < n; i++) {
    const [cx, cz] = cells[i];
    const w = 6.5 + rand() * 2.5; // fits inside the room cell
    const d = 6.5 + rand() * 2.5;
    out.push({
      id: `bld_${i}`,
      x: cx,
      z: cz,
      w,
      d,
      h: 4.0 + rand() * 1.6,
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

function clampN(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Push a circle (center px,pz, radius pr) out of an axis-aligned box. */
function resolveBox(
  px: number,
  pz: number,
  cx: number,
  cz: number,
  hx: number,
  hz: number,
  pr: number
): [number, number] {
  const dx = px - cx;
  const dz = pz - cz;
  const qx = clampN(dx, -hx, hx);
  const qz = clampN(dz, -hz, hz);
  let nx = dx - qx;
  let nz = dz - qz;
  const d2 = nx * nx + nz * nz;
  if (d2 > pr * pr) return [px, pz];
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    const push = pr - d;
    return [px + (nx / d) * push, pz + (nz / d) * push];
  }
  // Center is inside the box: eject along the shallowest axis.
  const ox = hx - Math.abs(dx);
  const oz = hz - Math.abs(dz);
  if (ox < oz) return [cx + Math.sign(dx || 1) * (hx + pr), pz];
  return [px, cz + Math.sign(dz || 1) * (hz + pr)];
}

/** Solid wall segments along a line, leaving doorway gaps. */
function wallRun(
  start: number,
  end: number,
  gapCenters: number[],
  gapHalf: number,
  fixed: number,
  halfT: number,
  axis: "x" | "z",
  kind: WallSeg["kind"]
): WallSeg[] {
  const gaps = gapCenters
    .map((g) => [g - gapHalf, g + gapHalf] as [number, number])
    .filter(([a, b]) => b > start && a < end)
    .sort((p, q) => p[0] - q[0]);
  const segs: [number, number][] = [];
  let cur = start;
  for (const [a, b] of gaps) {
    const s = Math.max(start, a);
    if (s > cur) segs.push([cur, s]);
    cur = Math.max(cur, Math.min(end, b));
  }
  if (end > cur) segs.push([cur, end]);
  return segs.map(([a, b]) => {
    const mid = (a + b) / 2;
    const half = (b - a) / 2;
    return axis === "z"
      ? { cx: fixed, cz: mid, hx: halfT, hz: half, kind }
      : { cx: mid, cz: fixed, hx: half, hz: halfT, kind };
  });
}

/** Build all collidable walls: room-grid partitions, perimeter (with exit) + deck rails. */
export function generateWalls(_seed: number): WallSeg[] {
  const H = ARENA_HALF;
  const it = INTERIOR_WALL_T / 2;
  const pt = WALL_THICKNESS / 2;
  const out: WallSeg[] = [];

  // Interior partition grid → connected rooms with doorways.
  for (const X of ROOM_LINES)
    out.push(...wallRun(-H, H, ROOM_DOOR_CENTERS, ROOM_DOORWAY_HALF, X, it, "z", "interior"));
  for (const Z of ROOM_LINES)
    out.push(...wallRun(-H, H, ROOM_DOOR_CENTERS, ROOM_DOORWAY_HALF, Z, it, "x", "interior"));

  // Perimeter (east side has the exit gap).
  out.push({ cx: 0, cz: -H, hx: H, hz: pt, kind: "perimeter" });
  out.push({ cx: 0, cz: H, hx: H, hz: pt, kind: "perimeter" });
  out.push({ cx: -H, cz: 0, hx: pt, hz: H, kind: "perimeter" });
  out.push(...wallRun(-H, H, [0], EXIT_HALF, H, pt, "z", "perimeter"));

  // Outside deck rails (east of the arena).
  const dMidX = H + DECK_DEPTH / 2;
  out.push({ cx: dMidX, cz: -DECK_HALF_W, hx: DECK_DEPTH / 2, hz: pt, kind: "rail" });
  out.push({ cx: dMidX, cz: DECK_HALF_W, hx: DECK_DEPTH / 2, hz: pt, kind: "rail" });
  out.push({ cx: H + DECK_DEPTH, cz: 0, hx: pt, hz: DECK_HALF_W, kind: "rail" });

  return out;
}

/** Resolve a player position out of all wall segments. */
export function collideWalls(
  x: number,
  z: number,
  walls: WallSeg[],
  pr: number = PLAYER_RADIUS
): { x: number; z: number } {
  for (const w of walls) {
    [x, z] = resolveBox(x, z, w.cx, w.cz, w.hx, w.hz, pr);
  }
  return { x, z };
}

/** Resolve a player position out of all building walls (door openings stay passable). */
export function collideBuildings(
  x: number,
  z: number,
  buildings: Building[],
  pr: number = PLAYER_RADIUS
): { x: number; z: number } {
  const T = BUILDING_WALL_T;
  const DW = BUILDING_DOOR_W;
  for (const b of buildings) {
    const hw = b.w / 2;
    const hd = b.d / 2;
    const ca = Math.cos(b.rotY);
    const sa = Math.sin(b.rotY);
    // world → building-local
    const dx = x - b.x;
    const dz = z - b.z;
    let lx = ca * dx - sa * dz;
    let lz = sa * dx + ca * dz;

    const segW = (b.w - DW) / 2;
    const segX = (b.w + DW) / 4;
    const walls: [number, number, number, number][] = [
      [0, -hd, hw, T / 2], // back
      [-hw, 0, T / 2, hd], // left
      [hw, 0, T / 2, hd], // right
      [-segX, hd, segW / 2, T / 2], // front-left of door
      [segX, hd, segW / 2, T / 2], // front-right of door
    ];
    for (const [cx, cz, hx, hz] of walls) {
      [lx, lz] = resolveBox(lx, lz, cx, cz, hx, hz, pr);
    }

    // building-local → world
    x = b.x + ca * lx + sa * lz;
    z = b.z - sa * lx + ca * lz;
  }
  return { x, z };
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
