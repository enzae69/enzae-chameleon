import {
  HIDER_SPEED,
  SEEKER_SPEED,
  SEEKER_RATIO,
  BOUND_MIN,
  BOUND_MAX_X,
  BOUND_MAX_Z,
  Player,
  collideBuildings,
  collideWalls,
  type Building,
  type WallSeg,
  type GamePhase,
} from "@enzae/shared";

export interface InputState {
  seq: number;
  moveX: number;
  moveZ: number;
  rotationY: number;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function dist2D(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

export function canMove(player: Player, phase: GamePhase): boolean {
  if (player.isEliminated || !player.connected) return false;
  if (phase === "hiding" && player.team === "seeker") return false; // seekers are "counting"
  return true;
}

export function speedFor(team: string): number {
  return team === "seeker" ? SEEKER_SPEED : HIDER_SPEED;
}

/** Integrate one player's movement for a tick (authoritative). */
export function integrate(
  player: Player,
  input: InputState,
  dt: number,
  phase: GamePhase,
  buildings: Building[] = [],
  walls: WallSeg[] = []
): void {
  player.rotationY = input.rotationY;
  if (!canMove(player, phase)) return;

  let mx = input.moveX;
  let mz = input.moveZ;
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  const speed = speedFor(player.team);
  let nx = clamp(player.x + mx * speed * dt, BOUND_MIN, BOUND_MAX_X);
  let nz = clamp(player.z + mz * speed * dt, BOUND_MIN, BOUND_MAX_Z);
  if (buildings.length) {
    const r = collideBuildings(nx, nz, buildings);
    nx = r.x;
    nz = r.z;
  }
  if (walls.length) {
    const r = collideWalls(nx, nz, walls);
    nx = r.x;
    nz = r.z;
  }
  player.x = nx;
  player.z = nz;
}

/** Randomly choose which sessions become seekers (at least one). */
export function pickSeekers(sessionIds: string[]): Set<string> {
  const count = Math.max(1, Math.round(sessionIds.length * SEEKER_RATIO));
  const shuffled = [...sessionIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return new Set(shuffled.slice(0, count));
}
