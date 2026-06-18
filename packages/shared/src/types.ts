export type Team = "hider" | "seeker" | "spectator";
export type GamePhase = "waiting" | "hiding" | "hunting" | "ended";
export type RoomKind = "public" | "private";
export type UserRole = "user" | "moderator" | "admin";

export interface PlayerStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  eliminations: number; // as seeker
  timesFound: number; // as hider
  timesSurvived: number; // as hider
  playtimeSec: number;
}

export const EMPTY_STATS: PlayerStats = {
  matchesPlayed: 0,
  wins: 0,
  losses: 0,
  eliminations: 0,
  timesFound: 0,
  timesSurvived: 0,
  playtimeSec: 0,
};

export type CosmeticType = "skin" | "color" | "emote";
export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface CosmeticInventory {
  ownedSkins: string[];
  ownedColors: string[];
  ownedEmotes: string[];
  equippedSkin: string;
  equippedColor: string;
}

export const DEFAULT_INVENTORY: CosmeticInventory = {
  ownedSkins: ["default"],
  ownedColors: ["#7ec850"],
  ownedEmotes: ["wave"],
  equippedSkin: "default",
  equippedColor: "#7ec850",
};

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string | null;
  isGuest: boolean;
  role: UserRole;
  xp: number;
  coins: number;
  banned: boolean;
  banReason?: string | null;
  stats: PlayerStats;
  cosmetics: CosmeticInventory;
  createdAt: number;
  updatedAt: number;
}

/** Plain snapshot of a player for client rendering (decoupled from the Colyseus schema). */
export interface PlayerSnapshot {
  sessionId: string;
  uid: string;
  name: string;
  team: Team;
  color: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  isReady: boolean;
  isEliminated: boolean;
  isTagged: boolean;
  level: number;
  skinId: string;
  disguiseKind: string; // "" = not disguised
  disguiseSx: number;
  disguiseSy: number;
  disguiseSz: number;
}

export interface CosmeticItem {
  id: string;
  type: CosmeticType;
  name: string;
  value: string; // hex for color, key for skin/emote
  price: number; // in coins, 0 = free/default
  rarity: Rarity;
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL: string | null;
  level: number;
  xp: number;
  wins: number;
}

export interface FriendEntry {
  uid: string;
  displayName: string;
  photoURL: string | null;
  status: "pending_in" | "pending_out" | "accepted";
  since: number;
}

export interface Report {
  id?: string;
  reporterUid: string;
  reportedUid: string;
  reportedName: string;
  reason: string;
  context: string;
  status: "open" | "reviewed" | "actioned" | "dismissed";
  createdAt: number;
}

/** Public room metadata used by the lobby browser. */
export interface RoomListing {
  roomId: string;
  name: string;
  kind: RoomKind;
  phase: GamePhase;
  clients: number;
  maxClients: number;
  locked: boolean;
}
