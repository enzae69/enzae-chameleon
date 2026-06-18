import { create } from "zustand";
import { Client, Room } from "colyseus.js";
import {
  ClientMessage,
  ServerMessage,
  type GamePhase,
  type Team,
  type RoomListing,
  type PlayerSnapshot,
  type InputPayload,
  type PhaseChangeEvent,
  type MatchEndEvent,
  type ChatEvent,
  type NoticeEvent,
  type EmoteEvent,
  type ErrorEvent,
} from "@enzae/shared";
import { SERVER_URL, HTTP_URL } from "../config";
import { live, resetLive } from "../net/live";
import { useUI } from "./uiStore";

export interface ChatLine {
  id: number;
  name: string;
  text: string;
  system?: boolean;
}

export interface RosterEntry {
  sessionId: string;
  uid: string;
  name: string;
  team: Team;
  color: string;
  isReady: boolean;
  isEliminated: boolean;
  connected: boolean;
  level: number;
  disguised: boolean;
}

export interface JoinAuth {
  token?: string;
  guestName: string;
}

interface GameStore {
  client: Client | null;
  room: Room | null;
  connected: boolean;
  connecting: boolean;

  selfId: string;
  isHost: boolean;
  roomId: string;
  roomName: string;
  roomKind: string;
  phase: GamePhase;
  phaseEndsAt: number;
  countdownEndsAt: number;
  mapSeed: number;

  roster: RosterEntry[];
  chat: ChatLine[];
  matchResult: MatchEndEvent | null;
  lastEmote: (EmoteEvent & { ts: number }) | null;

  listRooms: () => Promise<RoomListing[]>;
  quickPlay: (auth: JoinAuth) => Promise<void>;
  createRoom: (
    opts: { name: string; kind: "public" | "private"; password?: string },
    auth: JoinAuth
  ) => Promise<void>;
  joinById: (id: string, password: string | undefined, auth: JoinAuth) => Promise<void>;
  leave: () => void;

  sendInput: (p: InputPayload) => void;
  changeColor: (color: string) => void;
  copyColor: () => void;
  disguise: () => void;
  undisguise: () => void;
  tag: (targetSessionId: string) => void;
  toggleReady: () => void;
  requestStart: () => void;
  sendChat: (text: string) => void;
  sendEmote: (emote: string) => void;
}

export const useGame = create<GameStore>((set, get) => {
  let chatSeq = 1;
  let rosterTimer = 0;

  const ensureClient = (): Client => {
    let c = get().client;
    if (!c) {
      c = new Client(SERVER_URL);
      set({ client: c });
    }
    return c;
  };

  const syncRoster = (room: Room) => {
    const state = room.state as any;
    if (!state?.players) return;
    const roster: RosterEntry[] = [];
    state.players.forEach((p: any, id: string) => {
      roster.push({
        sessionId: id,
        uid: p.uid,
        name: p.name,
        team: p.team,
        color: p.color,
        isReady: p.isReady,
        isEliminated: p.isEliminated,
        connected: p.connected,
        level: p.level,
        disguised: Boolean(p.disguiseKind),
      });
    });
    set({
      roster,
      phase: state.phase,
      phaseEndsAt: state.phaseEndsAt,
      countdownEndsAt: state.countdownEndsAt,
      mapSeed: state.mapSeed,
      roomName: state.roomName,
      roomKind: state.kind,
      isHost: state.hostId === room.sessionId,
    });
  };

  const wire = (room: Room) => {
    resetLive();
    live.selfId = room.sessionId;

    room.onStateChange((state: any) => {
      if (!state?.players) return;
      const seen = new Set<string>();
      state.players.forEach((p: any, id: string) => {
        seen.add(id);
        const snap: PlayerSnapshot = {
          sessionId: id,
          uid: p.uid,
          name: p.name,
          team: p.team,
          color: p.color,
          x: p.x,
          y: p.y,
          z: p.z,
          rotationY: p.rotationY,
          isReady: p.isReady,
          isEliminated: p.isEliminated,
          isTagged: p.isTagged,
          level: p.level,
          skinId: p.skinId,
          disguiseKind: p.disguiseKind || "",
          disguiseSx: p.disguiseSx ?? 1,
          disguiseSy: p.disguiseSy ?? 1,
          disguiseSz: p.disguiseSz ?? 1,
        };
        live.players.set(id, snap);
      });
      for (const id of Array.from(live.players.keys())) {
        if (!seen.has(id)) live.players.delete(id);
      }
    });

    room.onMessage(ServerMessage.Chat, (m: ChatEvent) =>
      set((s) => ({ chat: [...s.chat.slice(-49), { id: chatSeq++, name: m.name, text: m.text }] }))
    );
    room.onMessage(ServerMessage.Notice, (m: NoticeEvent) =>
      set((s) => ({ chat: [...s.chat.slice(-49), { id: chatSeq++, name: "", text: m.text, system: true }] }))
    );
    room.onMessage(ServerMessage.PhaseChange, (m: PhaseChangeEvent) => {
      set({ phase: m.phase, phaseEndsAt: m.phaseEndsAt });
      if (m.phase === "hiding") set({ matchResult: null });
    });
    room.onMessage(ServerMessage.MatchEnd, (m: MatchEndEvent) => set({ matchResult: m }));
    room.onMessage(ServerMessage.Emote, (m: EmoteEvent) => set({ lastEmote: { ...m, ts: Date.now() } }));
    room.onMessage(ServerMessage.Error, (m: ErrorEvent) => useUI.getState().showToast(m.message));
    room.onMessage(ServerMessage.Tagged, () => {});
    room.onMessage(ServerMessage.Eliminated, () => {});

    room.onLeave(() => {
      window.clearInterval(rosterTimer);
      resetLive();
      set({ connected: false, room: null, roster: [], roomId: "", matchResult: null });
    });
    room.onError((_code, message) => useUI.getState().showToast(message || "Verbindungsfehler"));

    window.clearInterval(rosterTimer);
    rosterTimer = window.setInterval(() => syncRoster(room), 250);

    set({
      room,
      connected: true,
      connecting: false,
      selfId: room.sessionId,
      roomId: room.roomId,
      chat: [],
      matchResult: null,
    });
    syncRoster(room);
  };

  const fail = (msg: string) => {
    set({ connecting: false });
    useUI.getState().showToast(msg);
  };

  return {
    client: null,
    room: null,
    connected: false,
    connecting: false,

    selfId: "",
    isHost: false,
    roomId: "",
    roomName: "",
    roomKind: "public",
    phase: "waiting",
    phaseEndsAt: 0,
    countdownEndsAt: 0,
    mapSeed: 1,

    roster: [],
    chat: [],
    matchResult: null,
    lastEmote: null,

    listRooms: async () => {
      try {
        const res = await fetch(`${HTTP_URL}/rooms`);
        const rooms = (await res.json()) as any[];
        return rooms.map((r) => ({
          roomId: r.roomId,
          name: (r.metadata?.name as string) || "Raum",
          kind: ((r.metadata?.kind as string) || "public") as RoomListing["kind"],
          phase: ((r.metadata?.phase as string) || "waiting") as RoomListing["phase"],
          clients: r.clients,
          maxClients: r.maxClients,
          locked: Boolean(r.locked),
        }));
      } catch {
        useUI.getState().showToast("Server nicht erreichbar");
        return [];
      }
    },

    quickPlay: async (auth) => {
      set({ connecting: true });
      try {
        const room = await ensureClient().joinOrCreate("game", {
          kind: "public",
          name: "Schnelles Spiel",
          ...auth,
        });
        wire(room);
      } catch {
        fail("Beitritt fehlgeschlagen");
      }
    },

    createRoom: async (opts, auth) => {
      set({ connecting: true });
      try {
        const room = await ensureClient().create("game", {
          kind: opts.kind,
          name: opts.name,
          password: opts.password || "",
          ...auth,
        });
        wire(room);
      } catch {
        fail("Erstellen fehlgeschlagen");
      }
    },

    joinById: async (id, password, auth) => {
      set({ connecting: true });
      try {
        const room = await ensureClient().joinById(id, { password: password || "", ...auth });
        wire(room);
      } catch {
        fail("Raum nicht gefunden oder falsches Passwort");
      }
    },

    leave: () => {
      get().room?.leave();
      window.clearInterval(rosterTimer);
      resetLive();
      set({ connected: false, room: null, roster: [], roomId: "", matchResult: null });
    },

    sendInput: (p) => get().room?.send(ClientMessage.Input, p),
    changeColor: (color) => get().room?.send(ClientMessage.ChangeColor, { color }),
    copyColor: () => get().room?.send(ClientMessage.CopyColor, {}),
    disguise: () => get().room?.send(ClientMessage.Disguise, {}),
    undisguise: () => get().room?.send(ClientMessage.Undisguise, {}),
    tag: (targetSessionId) => get().room?.send(ClientMessage.Tag, { targetSessionId }),
    toggleReady: () => get().room?.send(ClientMessage.ToggleReady, {}),
    requestStart: () => get().room?.send(ClientMessage.RequestStart, {}),
    sendChat: (text) => get().room?.send(ClientMessage.Chat, { text }),
    sendEmote: (emote) => get().room?.send(ClientMessage.Emote, { emote }),
  };
});
