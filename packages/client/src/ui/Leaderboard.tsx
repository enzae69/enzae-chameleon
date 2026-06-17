import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import type { LeaderboardEntry } from "@enzae/shared";
import { db } from "../firebase";
import { useUI } from "../store/uiStore";
import { Background } from "./components/Layout";

export default function Leaderboard() {
  const setScreen = useUI((s) => s.setScreen);
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    getDocs(query(collection(db, "leaderboard"), orderBy("xp", "desc"), limit(50)))
      .then((snap) => setRows(snap.docs.map((d) => d.data() as LeaderboardEntry)))
      .finally(() => setLoading(false));
  }, []);

  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`);

  return (
    <Background>
      <div className="mb-4 flex items-center justify-between">
        <button className="btn-ghost px-3 py-2" onClick={() => setScreen("menu")}>
          ← Zurück
        </button>
        <h1 className="font-display text-2xl font-bold">🏆 Rangliste</h1>
        <div className="w-16" />
      </div>

      {!db && (
        <div className="card text-center text-white/60">
          Die Rangliste ist erst mit konfiguriertem Firebase verfügbar.
        </div>
      )}

      {db && (
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {loading && <div className="py-10 text-center text-white/50">Lädt…</div>}
          {!loading && rows.length === 0 && (
            <div className="py-10 text-center text-white/50">Noch keine Einträge – spiel die erste Runde!</div>
          )}
          {rows.map((r, i) => (
            <div key={r.uid} className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
              <div className="w-8 text-center text-lg font-bold">{medal(i)}</div>
              <div className="flex-1">
                <div className="font-semibold">{r.displayName}</div>
                <div className="text-xs text-white/50">Level {r.level} · {r.wins} Siege</div>
              </div>
              <div className="font-bold text-cham-300">{r.xp.toLocaleString("de-DE")} XP</div>
            </div>
          ))}
        </div>
      )}
    </Background>
  );
}
