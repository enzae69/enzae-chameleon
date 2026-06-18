import "dotenv/config";
import http from "http";
import path from "path";
import fs from "fs";
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

  // Single-service deploy: serve the built client from this server so the game
  // runs on one URL (UI + WebSocket on the same origin). Falls back to a plain
  // status page when no client build is present (e.g. server-only dev).
  const clientDist =
    process.env.CLIENT_DIST || path.resolve(__dirname, "../../client/dist");
  if (fs.existsSync(path.join(clientDist, "index.html"))) {
    app.use(express.static(clientDist));
    // SPA fallback: serve index.html for any non-API GET route.
    app.get(/^\/(?!health|rooms|matchmake|colyseus).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
    console.log(`[static] serving client from ${clientDist}`);
  } else {
    app.get("/", (_req, res) => res.send("🦎 enzae Chameleon game server"));
  }

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

  // Keep the free-tier instance awake to avoid ~30–60s cold starts. Render
  // injects RENDER_EXTERNAL_URL automatically; opt out with KEEP_ALIVE=false.
  const keepAliveBase = process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL;
  if (keepAliveBase && process.env.KEEP_ALIVE !== "false") {
    const pingUrl = `${keepAliveBase.replace(/\/$/, "")}/health`;
    setInterval(() => {
      fetch(pingUrl).catch(() => {});
    }, 14 * 60 * 1000).unref();
    console.log(`[keep-alive] self-ping every 14m → ${pingUrl}`);
  }
}

main().catch((err) => {
  console.error("Fatal server error:", err);
  process.exit(1);
});
