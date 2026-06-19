import type { Team, GamePhase } from "./types";

/** Messages sent FROM client TO server. */
export const ClientMessage = {
  Input: "input",
  ChangeColor: "change_color",
  CopyColor: "copy_color",
  Disguise: "disguise",
  Undisguise: "undisguise",
  Shoot: "shoot",
  Emote: "emote",
  Chat: "chat",
  ToggleReady: "toggle_ready",
  RequestStart: "request_start",
  Kick: "kick",
} as const;
export type ClientMessageType = (typeof ClientMessage)[keyof typeof ClientMessage];

/** Messages sent FROM server TO client. */
export const ServerMessage = {
  Tagged: "tagged",
  Eliminated: "eliminated",
  PhaseChange: "phase_change",
  MatchEnd: "match_end",
  Chat: "chat",
  Emote: "emote",
  Notice: "notice",
  Kicked: "kicked",
  Shot: "shot",
  Error: "error",
} as const;
export type ServerMessageType = (typeof ServerMessage)[keyof typeof ServerMessage];

// ---- Client -> Server payloads ----
export interface InputPayload {
  seq: number;
  moveX: number; // movement intent on world X, range -1..1
  moveZ: number; // movement intent on world Z, range -1..1
  rotationY: number; // facing angle in radians
}
export interface ChangeColorPayload {
  color: string;
}
// CopyColorPayload: empty; server resolves the nearest prop colour authoritatively.
export interface CopyColorPayload {}
export type WeaponType = "laser" | "taser";
export interface ShootPayload {
  weapon: WeaponType;
  targetSessionId?: string; // for aimed laser shots (tap a target)
}
export interface EmotePayload {
  emote: string;
}
export interface ChatPayload {
  text: string;
}
export interface KickPayload {
  targetSessionId: string;
}

// ---- Server -> Client events ----
export interface TaggedEvent {
  by: string;
  target: string;
}
export interface ShotEvent {
  by: string; // shooter sessionId
  weapon: WeaponType;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  hit: boolean;
}
export interface EliminatedEvent {
  sessionId: string;
}
export interface PhaseChangeEvent {
  phase: GamePhase;
  phaseEndsAt: number; // server epoch ms
}
export interface MatchEndReward {
  sessionId: string;
  uid: string;
  xpGained: number;
}
export interface MatchEndEvent {
  winningTeam: Team;
  rewards: MatchEndReward[];
}
export interface ChatEvent {
  from: string; // sessionId
  name: string;
  text: string;
  ts: number;
}
export interface EmoteEvent {
  sessionId: string;
  emote: string;
}
export interface NoticeEvent {
  text: string;
}
export interface ErrorEvent {
  code: string;
  message: string;
}
