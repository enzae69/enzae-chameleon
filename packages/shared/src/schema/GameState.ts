import { Schema, MapSchema, type } from "@colyseus/schema";
import { Player } from "./Player";

/** Root networked state of a GameRoom. */
export class GameState extends Schema {
  @type("string") roomName = "";
  @type("string") kind = "public"; // RoomKind
  @type("string") phase = "waiting"; // GamePhase
  @type("number") phaseEndsAt = 0; // server epoch ms; 0 = no timer
  @type("string") hostId = "";
  @type("number") mapSeed = 1;
  @type("number") maxPlayers = 12;
  @type("number") countdownEndsAt = 0; // pre-start countdown
  @type({ map: Player }) players = new MapSchema<Player>();
}
