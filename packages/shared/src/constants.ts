/**
 * Global game balance & networking constants.
 * Shared by both the authoritative server and the client (prediction/rendering).
 */

// --- Networking ---
export const TICK_RATE = 20; // server simulation ticks per second
export const FIXED_DT = 1 / TICK_RATE; // seconds per simulation tick

// --- Arena ---
export const ARENA_SIZE = 78; // square arena side length (world units), centered at origin
export const ARENA_HALF = ARENA_SIZE / 2;
export const WALL_THICKNESS = 1;

// --- Lab layout (connected rooms + an exit to an outside deck) ---
export const INTERIOR_WALL_T = 0.5; // interior partition wall thickness
export const ROOM_DOORWAY_HALF = 2.3; // half-width of doorways between rooms
export const ROOM_LINES = [-ARENA_HALF / 3, ARENA_HALF / 3]; // partition grid lines (±13)
export const ROOM_DOOR_CENTERS = [-2 * ARENA_HALF / 3, 0, (2 * ARENA_HALF) / 3]; // -26,0,26
export const EXIT_HALF = 2.8; // half-width of the perimeter exit
export const DECK_DEPTH = 16; // outside deck length (east of the arena)
export const DECK_HALF_W = 6.5; // outside deck half width
// Movement bounds: the arena plus the eastern outside deck.
export const BOUND_MIN = -(ARENA_HALF + 2);
export const BOUND_MAX_X = ARENA_HALF + DECK_DEPTH + 2;
export const BOUND_MAX_Z = ARENA_HALF + 2;

// --- Player ---
export const PLAYER_RADIUS = 0.5;
export const PLAYER_HEIGHT = 1.6;
export const PLAYER_EYE = 1.4;
export const HIDER_SPEED = 7.2; // units per second (bumped for the bigger map)
export const SEEKER_SPEED = 7.9; // seekers are slightly faster

// --- Interaction ranges ---
export const SEEKER_TAG_RANGE = 2.4;
export const COLOR_COPY_RANGE = 3.0;
export const DISGUISE_RANGE = 3.0; // must be near a prop to morph into it
export const TAG_COOLDOWN_MS = 3000; // (legacy)

// --- Seeker weapon (tap to aim & fire) ---
export const LASER_RANGE = 13;
export const LASER_COOLDOWN_MS = 2000; // 2s cooldown
export const LASER_HIT_RADIUS = 1.7; // how close to the tapped point counts as a hit
export const TASER_RANGE = 3.4;
export const TASER_COOLDOWN_MS = 1300;

// --- Seeker radar ability ---
export const SCAN_COOLDOWN_MS = 12000; // ~12s between scans
export const SCAN_RADIUS = 16; // a hider within this counts as "nearby"
export const SCAN_SHOW_MS = 2000; // how long the result is shown

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
