import { PLAYER_RADIUS } from "./constants";
import { MAP_GEO } from "./maps.generated";

/** The playable maps. "lab" is the procedural arena; the others are GLB models. */
export type MapId = "lab" | "backrooms" | "sewer";

/** A baked 2D occupancy grid: blocked cells form the map's solid walls. */
export interface MapGrid {
  originX: number; // world X of cell (0,0)'s lower corner
  originZ: number;
  cols: number;
  rows: number;
  cell: number; // cell size in world units
  bits: string; // base64-packed bitset, row-major (1 = solid)
}

/** Placement + collision data baked from a map GLB (see maps.generated.ts). */
export interface MapGeo {
  id: string;
  scale: number; // uniform scale applied to the GLB
  offsetX: number; // horizontal shift so the footprint is centred on the origin
  offsetY: number; // vertical shift so the floor sits at y=0
  offsetZ: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  spawn: { x: number; z: number; radius: number };
  grid: MapGrid;
}

export interface MapDef {
  id: MapId;
  name: string;
  glb?: string; // client asset path; undefined = procedural lab
  geo?: MapGeo; // placement + collision; undefined = procedural lab
}

export const MAPS: Record<MapId, MapDef> = {
  lab: { id: "lab", name: "Labor" },
  backrooms: {
    id: "backrooms",
    name: "Backrooms",
    glb: "models/maps/backrooms.glb",
    geo: MAP_GEO.backrooms,
  },
  sewer: {
    id: "sewer",
    name: "Kanalisation",
    glb: "models/maps/sewer.glb",
    geo: MAP_GEO.sewer,
  },
};

/** Maps the host can choose, in display order. */
export const SELECTABLE_MAP_IDS: MapId[] = ["backrooms", "sewer", "lab"];

export function isMapId(v: unknown): v is MapId {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(MAPS, v);
}

export function mapDef(id: string): MapDef {
  return (MAPS as Record<string, MapDef>)[id] ?? MAPS.lab;
}

// ---- collision grid ----------------------------------------------------------

interface DecodedGrid extends MapGrid {
  cellsBits: Uint8Array;
}
const decodeCache = new Map<string, DecodedGrid>();

function b64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Uint8Array((globalThis as { Buffer?: { from(s: string, e: string): Uint8Array } }).Buffer!.from(b64, "base64"));
}

function decode(grid: MapGrid): DecodedGrid {
  const hit = decodeCache.get(grid.bits);
  if (hit) return hit;
  const d: DecodedGrid = { ...grid, cellsBits: b64ToBytes(grid.bits) };
  decodeCache.set(grid.bits, d);
  return d;
}

function isBlocked(d: DecodedGrid, col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= d.cols || row >= d.rows) return false; // outside handled by bounds
  const i = row * d.cols + col;
  return (d.cellsBits[i >> 3] & (1 << (i & 7))) !== 0;
}

/** Push a circle (px,pz,pr) out of an axis-aligned box (mirrors map.ts/resolveBox). */
function ejectBox(
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
  const qx = dx < -hx ? -hx : dx > hx ? hx : dx;
  const qz = dz < -hz ? -hz : dz > hz ? hz : dz;
  const nx = dx - qx;
  const nz = dz - qz;
  const d2 = nx * nx + nz * nz;
  if (d2 > pr * pr) return [px, pz];
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    const push = pr - d;
    return [px + (nx / d) * push, pz + (nz / d) * push];
  }
  const ox = hx - Math.abs(dx);
  const oz = hz - Math.abs(dz);
  if (ox < oz) return [cx + Math.sign(dx || 1) * (hx + pr), pz];
  return [px, cz + Math.sign(dz || 1) * (hz + pr)];
}

/** Resolve a player position out of the map's solid grid cells. */
export function collideGrid(
  x: number,
  z: number,
  grid: MapGrid,
  pr: number = PLAYER_RADIUS
): { x: number; z: number } {
  const d = decode(grid);
  const h = d.cell / 2;
  const c0 = Math.floor((x - pr - d.originX) / d.cell) - 1;
  const c1 = Math.floor((x + pr - d.originX) / d.cell) + 1;
  const r0 = Math.floor((z - pr - d.originZ) / d.cell) - 1;
  const r1 = Math.floor((z + pr - d.originZ) / d.cell) + 1;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (!isBlocked(d, c, r)) continue;
      const cxw = d.originX + (c + 0.5) * d.cell;
      const czw = d.originZ + (r + 0.5) * d.cell;
      [x, z] = ejectBox(x, z, cxw, czw, h, h, pr);
    }
  }
  return { x, z };
}
