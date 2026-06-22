import { Room, Client, ServerError } from "colyseus";
import {
  GameState,
  Player,
  ClientMessage,
  ServerMessage,
  type InputPayload,
  type ChangeColorPayload,
  type ShootPayload,
  type WeaponType,
  type EmotePayload,
  type ChatPayload,
  type GamePhase,
  type Team,
  ROOM_MAX_PLAYERS,
  ROOM_MIN_PLAYERS_TO_START,
  COUNTDOWN_TO_START,
  PHASE_DURATION,
  TICK_RATE,
  COLOR_COPY_RANGE,
  DISGUISE_RANGE,
  LASER_RANGE,
  LASER_COOLDOWN_MS,
  LASER_HIT_RADIUS,
  TASER_RANGE,
  TASER_COOLDOWN_MS,
  DEFAULT_HIDER_COLOR,
  SEEKER_COLOR,
  ARENA_HALF,
  XP,
  generateMap,
  generateBuildings,
  generateWalls,
  nearestObject,
  nearestObjectColor,
  levelFromTotalXp,
  type Building,
  type WallSeg,
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
  private kickedIds = new Set<string>(); // sessions removed by the host (skip reconnection)
  private lastShot = new Map<string, { laser: number; taser: number }>(); // per-weapon cooldown
  private buildings: Building[] = []; // collision geometry for the current map
  private walls: WallSeg[] = []; // room/perimeter/deck wall collision
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
    this.buildings = generateBuildings(state.mapSeed);
    this.walls = generateWalls(state.mapSeed);
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
    // Host-kicked players are removed immediately, never held for reconnection.
    if (this.kickedIds.has(client.sessionId)) {
      this.kickedIds.delete(client.sessionId);
      this.removePlayer(client.sessionId);
      return;
    }

    const p = this.state.players.get(client.sessionId);
    if (p) p.connected = false;

    if (consented) {
      this.removePlayer(client.sessionId);
      return;
    }
    try {
      await this.allowReconnection(client, 60);
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

    this.onMessage(ClientMessage.Disguise, (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.team !== "hider" || p.isEliminated) return;
      const objects = generateMap(this.state.mapSeed);
      const o = nearestObject(objects, p.x, p.z, DISGUISE_RANGE);
      if (!o) {
        client.send(ServerMessage.Notice, { text: "Kein Objekt in der Nähe zum Verwandeln." });
        return;
      }
      p.disguiseKind = o.kind;
      p.disguiseSx = o.sx;
      p.disguiseSy = o.sy;
      p.disguiseSz = o.sz;
      p.color = o.color;
    });

    this.onMessage(ClientMessage.Undisguise, (client) => {
      const p = this.state.players.get(client.sessionId);
      if (p) this.clearDisguise(p);
    });

    this.onMessage(ClientMessage.Shoot, (client, msg: ShootPayload) => this.handleShoot(client, msg));

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

    this.onMessage(ClientMessage.Kick, (client, msg: { targetSessionId?: string }) => {
      if (client.sessionId !== this.state.hostId) return; // host only
      const targetId = msg?.targetSessionId;
      if (!targetId || targetId === client.sessionId) return;
      const tp = this.state.players.get(targetId);
      if (!tp) return;
      this.broadcast(ServerMessage.Notice, { text: `${tp.name} wurde vom Host entfernt.` });
      const target = this.clients.find((c) => c.sessionId === targetId);
      if (target) {
        this.kickedIds.add(targetId);
        target.send(ServerMessage.Kicked, {});
        // Give the Kicked message a moment to flush before closing the socket.
        this.clock.setTimeout(() => target.leave(1000), 150);
      } else {
        this.removePlayer(targetId);
      }
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

  private handleShoot(client: Client, msg: ShootPayload) {
    if (this.state.phase !== "hunting") return;
    const seeker = this.state.players.get(client.sessionId);
    if (!seeker || seeker.team !== "seeker" || seeker.isEliminated) return;

    const weapon: WeaponType = msg?.weapon === "taser" ? "taser" : "laser";
    const now = Date.now();
    const cd = this.lastShot.get(client.sessionId) || { laser: 0, taser: 0 };
    const cooldown = weapon === "laser" ? LASER_COOLDOWN_MS : TASER_COOLDOWN_MS;
    if (now - cd[weapon] < cooldown) return; // weapon on cooldown
    cd[weapon] = now; // cooldown starts on every shot (hit or miss)
    this.lastShot.set(client.sessionId, cd);

    const range = weapon === "laser" ? LASER_RANGE : TASER_RANGE;
    const validHider = (p?: Player): p is Player =>
      !!p && p.team === "hider" && !p.isEliminated && p.connected;

    // Where the player tapped (beam goes here). Falls back to straight ahead.
    const hasAim = Number.isFinite(msg?.aimX) && Number.isFinite(msg?.aimZ);
    const aimX = hasAim ? (msg.aimX as number) : seeker.x + Math.sin(seeker.rotationY) * range;
    const aimZ = hasAim ? (msg.aimZ as number) : seeker.z + Math.cos(seeker.rotationY) * range;

    const requested = msg?.targetSessionId
      ? this.state.players.get(msg.targetSessionId)
      : undefined;
    let target: Player | null = null;
    if (validHider(requested) && dist2D(seeker.x, seeker.z, requested.x, requested.z) <= range) {
      // Tapped directly on a hider in range.
      target = requested;
    } else {
      // Otherwise hit the hider closest to the tapped point (within range + aim radius).
      let bestD = LASER_HIT_RADIUS;
      this.state.players.forEach((p) => {
        if (!validHider(p)) return;
        if (dist2D(seeker.x, seeker.z, p.x, p.z) > range) return;
        const d = dist2D(aimX, aimZ, p.x, p.z);
        if (d <= bestD) {
          bestD = d;
          target = p;
        }
      });
    }

    let toX: number;
    let toZ: number;
    const hit = target !== null;
    if (target) {
      const t = target as Player;
      toX = t.x;
      toZ = t.z;
      this.clearDisguise(t);
      this.tags.set(client.sessionId, (this.tags.get(client.sessionId) || 0) + 1);
      this.broadcast(ServerMessage.Tagged, { by: client.sessionId, target: t.sessionId });
      // Infection mode (3+ players): the caught hider joins the seekers.
      if (this.connectedCount() > 2) {
        t.team = "seeker";
        t.isTagged = true;
        t.color = SEEKER_COLOR;
        this.broadcast(ServerMessage.Notice, { text: `${t.name} wurde gefangen – jetzt ein Seeker! 🔴` });
      } else {
        t.isEliminated = true;
        t.isTagged = true;
        this.broadcast(ServerMessage.Eliminated, { sessionId: t.sessionId });
      }
    } else {
      // Miss: beam goes to the tapped point, capped to the weapon's range.
      const dx = aimX - seeker.x;
      const dz = aimZ - seeker.z;
      const dd = Math.hypot(dx, dz) || 1;
      const reach = Math.min(dd, range);
      toX = seeker.x + (dx / dd) * reach;
      toZ = seeker.z + (dz / dd) * reach;
    }

    this.broadcast(ServerMessage.Shot, {
      by: client.sessionId,
      weapon,
      fromX: seeker.x,
      fromZ: seeker.z,
      toX,
      toZ,
      hit,
    });
    if (hit) this.checkWinConditions();
  }

  private clearDisguise(p: Player) {
    if (!p.disguiseKind) return;
    p.disguiseKind = "";
    p.disguiseSx = 1;
    p.disguiseSy = 1;
    p.disguiseSz = 1;
  }

  // ---------------------------------------------------------------- simulation
  private update(dtMs: number) {
    const dt = Math.min(dtMs / 1000, 0.1);
    const phase = this.state.phase as GamePhase;

    this.state.players.forEach((p) => {
      const input = this.inputs.get(p.sessionId);
      if (!input) return;
      integrate(p, input, dt, phase, this.buildings, this.walls);
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
    this.buildings = generateBuildings(this.state.mapSeed);
    this.walls = generateWalls(this.state.mapSeed);
    this.tags.clear();
    this.lastShot.clear();

    const seekers = pickSeekers(connected.map((p) => p.sessionId));
    connected.forEach((p) => {
      p.isEliminated = false;
      p.isTagged = false;
      p.isReady = false;
      this.clearDisguise(p);
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
      this.clearDisguise(p);
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
