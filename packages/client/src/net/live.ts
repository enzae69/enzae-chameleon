import type { PlayerSnapshot } from "@enzae/shared";

/**
 * High-frequency, render-loop-owned mirror of player state. Updated on every
 * Colyseus patch (~20Hz) and read by the Three.js render loop directly, so
 * player movement never triggers React re-renders.
 */
export const live = {
  selfId: "",
  /** Locally predicted position of our own player (read by HUD for "tag nearest"). */
  selfX: 0,
  selfZ: 0,
  players: new Map<string, PlayerSnapshot>(),
};

export function resetLive(): void {
  live.selfId = "";
  live.selfX = 0;
  live.selfZ = 0;
  live.players.clear();
}
