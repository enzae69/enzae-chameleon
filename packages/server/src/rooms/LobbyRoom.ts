import { Room, Client } from "colyseus";
import { Schema, MapSchema, type } from "@colyseus/schema";

class LobbyUser extends Schema {
  @type("string") name = "Guest";
}

class LobbyState extends Schema {
  @type({ map: LobbyUser }) users = new MapSchema<LobbyUser>();
}

/**
 * A single persistent presence + global-chat hub. The actual room browser is
 * powered by Colyseus matchmaking (`getAvailableRooms`), so this stays light.
 */
export class LobbyRoom extends Room<LobbyState> {
  onCreate() {
    this.setState(new LobbyState());
    this.autoDispose = false; // keep the global lobby alive even when empty

    this.onMessage("chat", (client, msg: { text?: string }) => {
      const u = this.state.users.get(client.sessionId);
      if (!u || !msg?.text) return;
      const text = String(msg.text).slice(0, 200).trim();
      if (text) this.broadcast("chat", { name: u.name, text, ts: Date.now() });
    });
  }

  onJoin(client: Client, options: { name?: string }) {
    const u = new LobbyUser();
    u.name = options?.name ? String(options.name).slice(0, 16) : "Guest";
    this.state.users.set(client.sessionId, u);
  }

  onLeave(client: Client) {
    this.state.users.delete(client.sessionId);
  }
}
