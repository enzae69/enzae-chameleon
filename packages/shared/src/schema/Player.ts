import { Schema, type } from "@colyseus/schema";

/**
 * Authoritative networked player state.
 * The server mutates these fields; the Colyseus.js client decodes them via reflection.
 */
export class Player extends Schema {
  @type("string") sessionId = "";
  @type("string") uid = "";
  @type("string") name = "Guest";
  @type("string") team = "hider"; // Team
  @type("string") color = "#7ec850";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") z = 0;
  @type("number") rotationY = 0;
  @type("boolean") isReady = false;
  @type("boolean") isEliminated = false;
  @type("boolean") isTagged = false;
  @type("boolean") connected = true;
  @type("number") level = 1;
  @type("string") skinId = "default";
}
