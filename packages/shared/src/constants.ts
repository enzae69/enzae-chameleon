/**
 * Global game balance & networking constants.
 * Shared by both the authoritative server and the client (prediction/rendering).
 */

// --- Networking ---
export const TICK_RATE = 20; // server simulation ticks per second
export const FIXED_DT = 1 / TICK_RATE; // seconds per simulation tick

// --- Arena ---
export const ARENA_SIZE = 40; // square arena side length (world units), centered at origin
export const ARENA_HALF = ARENA_SIZE / 2;
export const WALL_THICKNESS = 1;

// --- Player ---
export const PLAYER_RADIUS = 0.5;
export const PLAYER_HEIGHT = 1.6;
export const PLAYER_EYE = 1.4;
export const HIDER_SPEED = 6.0; // units per second
export const SEEKER_SPEED = 6.6; // seekers are slightly faster

// --- Interaction ranges ---
export const SEEKER_TAG_RANGE = 2.4;
export const COLOR_COPY_RANGE = 3.0;
export const DISGUISE_RANGE = 3.0; // must be near a prop to morph into it
export const TAG_COOLDOWN_MS = 3000; // seeker cooldown after a successful tag

// Building structure (shared so client rendering & collision match the server).
export const BUILDING_WALL_T = 0.26; // wall thickness
export const BUILDING_DOOR_W = 2.0; // door opening width

// --- Rooms / matchmaking ---
export const ROOM_MAX_PLAYERS = 12;
export const ROOM_MIN_PLAYERS_TO_START = 2;
export const SEEKER_RATIO = 0.25; // ~1 seeker per 4 players (minimum 1)
export const COUNTDOWN_TO_START = 5; // seconds once enough players are ready

// --- Phase durations (seconds) ---
export const PHASE_DURATION = {
  hiding: 20,
  hunting: 150,
  ended: 12,
} as const;

// --- Colors ---
export const COLOR_PALETTE = [
  "#e6194B", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
  "#911eb4", "#42d4f4", "#f032e6", "#bfef45", "#fabed4",
  "#469990", "#dcbeff", "#9A6324", "#fffac8", "#800000",
  "#aaffc3", "#808000", "#ffd8b1", "#000075", "#a9a9a9",
];

export const DEFAULT_HIDER_COLOR = "#7ec850";
export const SEEKER_COLOR = "#ff3b3b";

// --- XP rewards ---
export const XP = {
  participate: 20,
  perSecondSurvived: 1,
  hiderWin: 100,
  seekerWin: 100,
  perTag: 40,
  survivedRound: 60,
} as const;
