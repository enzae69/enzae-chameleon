import { useState } from "react";
import { buildJoinAuth } from "../store/authStore";
import { useGame } from "../store/gameStore";
import { useUI } from "../store/uiStore";
import { Background } from "./components/Layout";

export default function CreateRoom() {
  const setScreen = useUI((s) => s.setScreen);
  const createRoom = useGame((s) => s.createRoom);
  const connecting = useGame((s) => s.connecting);

  const [name, setName] = useState("Mein Raum");
  const [kind, setKind] = useState<"public" | "private">("public");
  const [password, setPassword] = useState("");

  const create = async () => {
    createRoom({ name: name.trim() || "Mein Raum", kind, password: kind === "private" ? password : "" }, await buildJoinAuth());
  };

  return (
    <Background>
      <div className="mb-4 flex items-center justify-between">
        <button className="btn-ghost px-3 py-2" onClick={() => setScreen("menu")}>
          ← Zurück
        </button>
        <h1 className="font-display text-2xl font-bold">Raum erstellen</h1>
        <div className="w-16" />
      </div>

      <div className="card flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm text-white/60">Raumname</label>
          <input className="input" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label className="mb-1 block text-sm text-white/60">Sichtbarkeit</label>
          <div className="flex rounded-xl bg-black/30 p-1">
            {(["public", "private"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                  kind === k ? "bg-cham-500 text-white" : "text-white/60"
                }`}
              >
                {k === "public" ? "🌍 Öffentlich" : "🔒 Privat"}
              </button>
            ))}
          </div>
        </div>

        {kind === "private" && (
          <div>
            <label className="mb-1 block text-sm text-white/60">Passwort (optional)</label>
            <input
              className="input"
              placeholder="leer = nur per Code"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="mt-2 text-xs text-white/40">
              Private Räume erscheinen nicht in der Liste. Teile den Raum-Code (wird nach dem
              Erstellen angezeigt).
            </p>
          </div>
        )}

        <button className="btn-primary mt-2" disabled={connecting} onClick={create}>
          {connecting ? "Erstelle…" : "Raum erstellen & beitreten"}
        </button>
      </div>
    </Background>
  );
}
