import { Room, Client, ServerError } from "colyseus";
import {
  GameState,
  Player,
  ClientMessage,
  ServerMessage,
  type InputPayload,
  type ChangeColorPayload,
  type TagPayload,
  type EmotePayload,
  type ChatPayload,
  type GamePhase,
  type Team,
  ROOM_MAX_PLAYERS,
  ROOM_MIN_PLAYERS_TO_START,
  COUNTDOWN_TO_START,
  PHASE_DURATION,
  TICK_RATE,
  SEEKER_TAG_RANGE,
  COLOR_COPY_RANGE,
  DEFAULT_HIDER_COLOR,
  SEEKER_COLOR,
  ARENA_HALF,
  XP,
  generateMap,
  nearestObjectColor,
  levelFromTotalXp,
} from "@enzae/shared";
import { verifyIdToken } from "../auth";
import { getOrCreateProfile, awardMatchResults } from "../services/profile";
import { InputState, integrate, dist2D, pickSeekers } from "../game/logic";

const HEX = /^#[0-9a-fA-F]{6}$/;

interface AuthContext {
  uid: string;
  name: string;
  isGuest: boolean;
  level: number;
  color: string;
  skinId: string;
}

function sanitizeName(name?: string): string {
  if (!name) return "";
  return name
    .replace(/[^\p{L}\p{N}_ \-]/gu, "")
    .trim()
    .slice(0, 16);
}

function randomGuestName(): string {
  return "Chameleon" + Math.floor(1000 + Math.random() * 9000);
}

function clampUnit(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n < -1 ? -1 : n > 1 ? 1 : n;
}

export class GameRoom extends Room<GameState> {
  maxClients = ROOM_MAX_PLAYERS;

  private password = "";
  private lockedFlag = false;
  private inputs = new Map<string, InputState>();
  private tags = new Map<string, number>(); // sessionId -> eliminations this match
  private matchStart = 0;

  // ---------------------------------------------------------------- lifecycle
  onCreate(options: Record<string, unknown>) {
    const kind = options?.kind === "private" ? "private" : "public";
    const name =
      sanitizeName(options?.name as string) ||
      (kind === "private" ? "Privater Raum" : "Offener Raum");
    this.password = typeof options?.password === "string" ? options.password : "";

    const state = new GameState();
    state.roomName = name;
    state.kind = kind;
    state.maxPlayers = ROOM_MAX_PLAYERS;
    state.mapSeed = this.newSeed();
    this.setState(state);

    if (kind === "private") this.setPrivate(true);
    this.updateMetadata();

    this.setSimulationInterval((dt) => this.update(dt), 1000 / TICK_RATE);
    this.registerHandlers();
  }

  async onAuth(client: Client, options: Record<string, unknown>): Promise<AuthContext> {
    if (this.password && options?.password !== this.password) {
      throw new ServerError(401, "wrong_password");
    }

    const decoded = await verifyIdToken(options?.token as string | undefined);
    if (decoded) {
      const profile = await getOrCreateProfile(
        decoded.uid,
        decoded.name || sanitizeName(options?.guestName as string) || "Spieler",
        false
      );
      if (profile.banned) throw new ServerError(403, "banned");
      return {
        uid: decoded.uid,
        name: profile.displayName,
        isGuest: false,
        level: levelFromTotalXp(profile.xp).level,
        color: profile.cosmetics?.equippedColor || DEFAULT_HIDER_COLOR,
        skinId: profile.cosmetics?.equippedSkin || "default",
      };
    }

    return {
      uid: `guest_${client.sessionId}`,
      name: sanitizeName(options?.guestName as string) || randomGuestName(),
      isGuest: true,
      level: 1,
      color: DEFAULT_HIDER_COLOR,
      skinId: "default",
    };
  }

  onJoin(client: Client, _options: unknown, auth: AuthContext) {
    const p = new Player();
    p.sessionId = client.sessionId;
    p.uid = auth.uid;
    p.name = auth.name;
    p.team = "hider";
    p.color = HEX.test(auth.color) ? auth.color : DEFAULT_HIDER_COLOR;
    p.level = auth.level;
    p.skinId = auth.skinId;
    p.connected = true;
    const spawn = this.randomSpawn();
    p.x = spawn.x;
    p.z = spawn.z;
    p.y = 0;

    this.state.players.set(client.sessionId, p);
    this.inputs.set(client.sessionId, { seq: 0, moveX: 0, moveZ: 0, rotationY: 0 });

    if (!this.state.hostId) this.state.hostId = client.sessionId;
    this.updateMetadata();
    this.broadcast(ServerMessage.Notice, { text: `${p.name} ist beigetreten.` }, { except: client });
  }

  async onLeave(client: Client, consented: boolean) {
    const p = this.state.players.get(client.sessionId);
    if (p) p.connected = false;

    if (consented) {
      this.removePlayer(client.sessionId);
      return;
    }
    try {
      await this.allowReconnection(client, 20);
      const rp = this.state.players.get(client.sessionId);
      if (rp) rp.connected = true;
    } catch {
      this.removePlayer(client.sessionId);
    }
  }

  // ---------------------------------------------------------------- messages
  private registerHandlers() {
    this.onMessage(ClientMessage.Input, (client, msg: InputPayload) => {
      if (!msg) return;
      this.inputs.set(client.sessionId, {
        seq: msg.seq | 0,
        moveX: clampUnit(msg.moveX),
        moveZ: clampUnit(msg.moveZ),
        rotationY: Number.isFinite(msg.rotationY) ? msg.rotationY : 0,
      });
    });

    this.onMessage(ClientMessage.ChangeColor, (client, msg: ChangeColorPayload) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.team !== "hider" || p.isEliminated) return;
      if (msg && HEX.test(msg.color)) p.color = msg.color;
    });

    this.onMessage(ClientMessage.CopyColor, (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.team !== "hider" || p.isEliminated) return;
      const objects = generateMap(this.state.mapSeed);
      const color = nearestObjectColor(objects, p.x, p.z, COLOR_COPY_RANGE);
      if (color) p.color = color;
      else client.send(ServerMessage.Notice, { text: "Kein Objekt in der Nähe." });
    });

    this.onMessage(ClientMessage.Tag, (client, msg: TagPayload) => this.handleTag(client, msg));

    this.onMessage(ClientMessage.ToggleReady, (client) => {
      if (this.state.phase !== "waiting") return;
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      p.isReady = !p.isReady;
      this.maybeStartCountdown();
    });

    this.onMessage(ClientMessage.RequestStart, (client) => {
      if (this.state.phase !== "waiting" || client.sessionId !== this.state.hostId) return;
      if (this.connectedCount() < ROOM_MIN_PLAYERS_TO_START) {
        client.send(ServerMessage.Notice, { text: "Mindestens 2 Spieler nötig." });
        return;
      }
      this.startCountdown(3);
    });

    this.onMessage(ClientMessage.Emote, (client, msg: EmotePayload) => {
      if (!this.state.players.has(client.sessionId) || !msg?.emote) return;
      this.broadcast(ServerMessage.Emote, {
        sessionId: client.sessionId,
        emote: String(msg.emote).slice(0, 16),
      });
    });

    this.onMessage(ClientMessage.Chat, (client, msg: ChatPayload) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !msg?.text) return;
      const text = String(msg.text).slice(0, 200).trim();
      if (text) this.broadcast(ServerMessage.Chat, { from: client.sessionId, name: p.name, text, ts: Date.now() });
    });
  }

  private handleTag(client: Client, msg: TagPayload) {
    if (this.state.phase !== "hunting") return;
    const seeker = this.state.players.get(client.sessionId);
    if (!seeker || seeker.team !== "seeker" || seeker.isEliminated) return;
    if (!msg?.targetSessionId) return;
    const target = this.state.players.get(msg.targetSessionId);
    if (!target || target.team !== "hider" || target.isEliminated || !target.connected) return;
    if (dist2D(seeker.x, seeker.z, target.x, target.z) > SEEKER_TAG_RANGE) return;

    target.isEliminated = true;
    target.isTagged = true;
    this.tags.set(client.sessionId, (this.tags.get(client.sessionId) || 0) + 1);
    this.broadcast(ServerMessage.Tagged, { by: client.sessionId, target: target.sessionId });
    this.broadcast(ServerMessage.Eliminated, { sessionId: target.sessionId });
    this.checkWinConditions();
  }

  // ---------------------------------------------------------------- simulation
  private update(dtMs: number) {
    const dt = Math.min(dtMs / 1000, 0.1);
    const phase = this.state.phase as GamePhase;

    this.state.players.forEach((p) => {
      const input = this.inputs.get(p.sessionId);
      if (input) integrate(p, input, dt, phase);
    });

    const now = Date.now();

    if (phase === "waiting" && this.state.countdownEndsAt && now >= this.state.countdownEndsAt) {
      this.state.countdownEndsAt = 0;
      this.beginHiding();
      return;
    }

    if (this.state.phaseEndsAt && now >= this.state.phaseEndsAt) {
      if (phase === "hiding") this.beginHunting();
      else if (phase === "hunting") this.endMatch("hider"); // survivors win when time runs out
      else if (phase === "ended") this.resetToWaiting();
    }
  }

  // ---------------------------------------------------------------- phase flow
  private maybeStartCountdown() {
    if (this.state.phase !== "waiting" || this.state.countdownEndsAt) return;
    const connected = this.connectedPlayers();
    if (connected.length < ROOM_MIN_PLAYERS_TO_START) return;
    if (connected.every((p) => p.isReady)) this.startCountdown(COUNTDOWN_TO_START);
  }

  private startCountdown(seconds: number) {
    if (this.connectedCount() < ROOM_MIN_PLAYERS_TO_START) return;
    this.state.countdownEndsAt = Date.now() + seconds * 1000;
    this.broadcast(ServerMessage.Notice, { text: `Spiel startet in ${seconds}s…` });
  }

  private beginHiding() {
    const connected = this.connectedPlayers();
    if (connected.length < ROOM_MIN_PLAYERS_TO_START) {
      this.resetToWaiting();
      return;
    }
    this.lockRoom();
    this.state.mapSeed = this.newSeed();
    this.tags.clear();

    const seekers = pickSeekers(connected.map((p) => p.sessionId));
    connected.forEach((p) => {
      p.isEliminated = false;
      p.isTagged = false;
      p.isReady = false;
      p.team = seekers.has(p.sessionId) ? "seeker" : "hider";
      const spawn = p.team === "seeker" ? { x: 0, z: 0 } : this.randomSpawn();
      p.x = spawn.x;
      p.z = spawn.z;
      p.y = 0;
      p.color = p.team === "seeker" ? SEEKER_COLOR : HEX.test(p.color) ? p.color : DEFAULT_HIDER_COLOR;
    });

    this.matchStart = Date.now();
    this.setPhase("hiding", PHASE_DURATION.hiding);
  }

  private beginHunting() {
    this.setPhase("hunting", PHASE_DURATION.hunting);
    this.broadcast(ServerMessage.Notice, { text: "Die Jäger sind los! 🦎" });
    this.checkWinConditions();
  }

  private checkWinConditions() {
    if (this.state.phase !== "hunting" && this.state.phase !== "hiding") return;
    const connected = this.connectedPlayers();
    const seekers = connected.filter((p) => p.team === "seeker");
    if (seekers.length === 0) {
      this.endMatch("hider");
      return;
    }
    if (this.state.phase === "hunting") {
      const aliveHiders = connected.filter((p) => p.team === "hider" && !p.isEliminated);
      if (aliveHiders.length === 0) this.endMatch("seeker");
    }
  }

  private endMatch(winningTeam: Team) {
    if (this.state.phase === "ended") return;
    const durationSec = Math.max(0, Math.round((Date.now() - this.matchStart) / 1000));
    const rewards: { sessionId: string; uid: string; xpGained: number }[] = [];

    this.state.players.forEach((p) => {
      const isGuest = p.uid.startsWith("guest_");
      const tags = this.tags.get(p.sessionId) || 0;
      const won = p.team === winningTeam;

      let xpGained = XP.participate;
      if (won) xpGained += p.team === "seeker" ? XP.seekerWin : XP.hiderWin;
      if (p.team === "seeker") xpGained += tags * XP.perTag;
      if (p.team === "hider" && !p.isEliminated) xpGained += XP.survivedRound;
      rewards.push({ sessionId: p.sessionId, uid: p.uid, xpGained });

      const stats: Record<string, number> = { matchesPlayed: 1, playtimeSec: durationSec };
      if (won) stats.wins = 1;
      else stats.losses = 1;
      if (p.team === "seeker") stats.eliminations = tags;
      if (p.team === "hider" && p.isEliminated) stats.timesFound = 1;
      if (p.team === "hider" && !p.isEliminated) stats.timesSurvived = 1;
      void awardMatchResults(p.uid, isGuest, { xpGained, stats });
    });

    this.broadcast(ServerMessage.MatchEnd, { winningTeam, rewards });
    this.setPhase("ended", PHASE_DURATION.ended);
  }

  private resetToWaiting() {
    this.state.phase = "waiting";
    this.state.phaseEndsAt = 0;
    this.state.countdownEndsAt = 0;
    this.tags.clear();
    this.state.players.forEach((p) => {
      p.team = "hider";
      p.isEliminated = false;
      p.isTagged = false;
      p.isReady = false;
    });
    this.unlockRoom();
    this.updateMetadata();
    this.broadcast(ServerMessage.PhaseChange, { phase: "waiting", phaseEndsAt: 0 });
  }

  private setPhase(phase: GamePhase, durationSec: number) {
    this.state.phase = phase;
    this.state.phaseEndsAt = durationSec > 0 ? Date.now() + durationSec * 1000 : 0;
    this.updateMetadata();
    this.broadcast(ServerMessage.PhaseChange, { phase, phaseEndsAt: this.state.phaseEndsAt });
  }

  // ---------------------------------------------------------------- helpers
  private removePlayer(sessionId: string) {
    this.state.players.delete(sessionId);
    this.inputs.delete(sessionId);
    this.tags.delete(sessionId);

    if (this.state.hostId === sessionId) {
      this.state.hostId = this.firstConnected() ?? "";
    }
    this.updateMetadata();

    if (this.state.phase === "hiding" || this.state.phase === "hunting") {
      this.checkWinConditions();
    }
    if (this.connectedCount() === 0 && this.state.phase !== "waiting") {
      this.resetToWaiting();
    }
  }

  private connectedPlayers(): Player[] {
    return Array.from(this.state.players.values()).filter((p) => p.connected);
  }

  private connectedCount(): number {
    return this.connectedPlayers().length;
  }

  private firstConnected(): string | undefined {
    return this.connectedPlayers()[0]?.sessionId;
  }

  private randomSpawn() {
    const limit = ARENA_HALF - 2;
    return { x: (Math.random() * 2 - 1) * limit, z: (Math.random() * 2 - 1) * limit };
  }

  private newSeed(): number {
    return (Math.floor(Math.random() * 1_000_000) + 1) >>> 0;
  }

  private lockRoom() {
    this.lock();
    this.lockedFlag = true;
    this.updateMetadata();
  }

  private unlockRoom() {
    this.unlock();
    this.lockedFlag = false;
  }

  private updateMetadata() {
    this.setMetadata({
      name: this.state.roomName,
      kind: this.state.kind,
      phase: this.state.phase,
      locked: this.lockedFlag,
    });
  }
}
