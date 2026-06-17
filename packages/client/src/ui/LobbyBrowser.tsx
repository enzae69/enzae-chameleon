import { useEffect, useState, useCallback } from "react";
import type { RoomListing } from "@enzae/shared";
import { buildJoinAuth } from "../store/authStore";
import { useGame } from "../store/gameStore";
import { useUI } from "../store/uiStore";
import { Background } from "./components/Layout";

const phaseLabel: Record<string, string> = {
  waiting: "Wartet",
  hiding: "Versteckt sich",
  hunting: "Jagd läuft",
  ended: "Endet",
};

export default function LobbyBrowser() {
  const setScreen = useUI((s) => s.setScreen);
  const listRooms = useGame((s) => s.listRooms);
  const joinById = useGame((s) => s.joinById);
  const connecting = useGame((s) => s.connecting);

  const [rooms, setRooms] = useState<RoomListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setRooms(await listRooms());
    setLoading(false);
  }, [listRooms]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const join = async (id: string, password?: string) => {
    joinById(id, password, await buildJoinAuth());
  };

  return (
    <Background>
      <div className="mb-4 flex items-center justify-between">
        <button className="btn-ghost px-3 py-2" onClick={() => setScreen("menu")}>
          ← Zurück
        </button>
        <h1 className="font-display text-2xl font-bold">Offene Räume</h1>
        <button className="btn-ghost px-3 py-2" onClick={refresh}>
          ⟳
        </button>
      </div>

      <div className="card mb-4">
        <div className="mb-2 text-sm font-semibold text-white/70">Mit Code beitreten (privat)</div>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Raum-Code"
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
          />
          <input
            className="input max-w-[40%]"
            placeholder="Passwort"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <button
            className="btn-primary shrink-0"
            disabled={!code || connecting}
            onClick={() => join(code, pw)}
          >
            Beitreten
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {loading && <div className="py-10 text-center text-white/50">Lädt…</div>}
        {!loading && rooms.length === 0 && (
          <div className="py-10 text-center text-white/50">
            Keine offenen Räume. Erstelle einen oder nutze „Schnelles Spiel".
          </div>
        )}
        {rooms.map((r) => {
          const full = r.clients >= r.maxClients;
          const busy = r.locked || r.phase !== "waiting";
          return (
            <div key={r.roomId} className="glass flex items-center justify-between rounded-2xl px-4 py-3">
              <div>
                <div className="font-semibold">{r.name}</div>
                <div className="text-xs text-white/50">
                  {phaseLabel[r.phase] || r.phase} · {r.clients}/{r.maxClients} Spieler
                </div>
              </div>
              <button
                className="btn-primary px-4 py-2 text-sm"
                disabled={full || busy || connecting}
                onClick={() => join(r.roomId)}
              >
                {full ? "Voll" : busy ? "Läuft" : "Beitreten"}
              </button>
            </div>
          );
        })}
      </div>
    </Background>
  );
}
