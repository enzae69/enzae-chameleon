import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import { Server, matchMaker } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./rooms/GameRoom";
import { LobbyRoom } from "./rooms/LobbyRoom";
import { initFirebase, isFirebaseEnabled } from "./firebase";

const PORT = Number(process.env.PORT) || 2567;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

async function main() {
  initFirebase();

  const app = express();
  app.use(
    cors({
      origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",").map((s) => s.trim()),
    })
  );
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true, firebase: isFirebaseEnabled(), ts: Date.now() });
  });
  app.get("/", (_req, res) => res.send("🦎 enzae Chameleon game server"));

  // Public room browser: list joinable, non-private game rooms.
  app.get("/rooms", async (_req, res) => {
    try {
      const rooms = await matchMaker.query({ name: "game", private: false });
      res.json(
        rooms.map((r: any) => ({
          roomId: r.roomId,
          clients: r.clients,
          maxClients: r.maxClients,
          locked: r.locked,
          metadata: r.metadata ?? {},
        }))
      );
    } catch {
      res.json([]);
    }
  });

  const server = http.createServer(app);
  const gameServer = new Server({ transport: new WebSocketTransport({ server }) });

  gameServer.define("lobby", LobbyRoom);
  gameServer.define("game", GameRoom).filterBy(["kind"]);

  if (process.env.ENABLE_MONITOR === "true") {
    const { monitor } = await import("@colyseus/monitor");
    app.use("/colyseus", monitor());
    console.log("[monitor] dashboard mounted at /colyseus");
  }

  await gameServer.listen(PORT);
  console.log(`🦎 enzae Chameleon server listening on :${PORT}`);
}

main().catch((err) => {
  console.error("Fatal server error:", err);
  process.exit(1);
});
