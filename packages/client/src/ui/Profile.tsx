import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, arrayUnion } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import {
  type UserProfile,
  EMPTY_STATS,
  DEFAULT_HIDER_COLOR,
  COLOR_PALETTE,
  levelFromTotalXp,
} from "@enzae/shared";
import { auth, db } from "../firebase";
import { useAuth } from "../store/authStore";
import { useUI } from "../store/uiStore";
import { Background } from "./components/Layout";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass rounded-2xl px-3 py-3 text-center">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-white/50">{label}</div>
    </div>
  );
}

export default function Profile() {
  const setScreen = useUI((s) => s.setScreen);
  const showToast = useUI((s) => s.showToast);
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  const canPersist = Boolean(db && user && !user.uid.startsWith("guest_"));
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(user?.displayName || "");

  useEffect(() => {
    if (!canPersist || !db || !user) {
      setLoading(false);
      return;
    }
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        if (snap.exists()) setProfile(snap.data() as UserProfile);
      })
      .finally(() => setLoading(false));
  }, [canPersist, user]);

  const xp = profile?.xp ?? 0;
  const stats = profile?.stats ?? EMPTY_STATS;
  const equipped = profile?.cosmetics?.equippedColor ?? DEFAULT_HIDER_COLOR;
  const { level, xpIntoLevel, xpForNext } = levelFromTotalXp(xp);
  const winrate = stats.matchesPlayed ? Math.round((stats.wins / stats.matchesPlayed) * 100) : 0;

  const equipColor = async (color: string) => {
    setProfile((p) =>
      p
        ? {
            ...p,
            cosmetics: {
              ...p.cosmetics,
              equippedColor: color,
              ownedColors: Array.from(new Set([...(p.cosmetics?.ownedColors || []), color])),
            },
          }
        : p
    );
    if (canPersist && db && user) {
      await setDoc(
        doc(db, "users", user.uid),
        { cosmetics: { equippedColor: color, ownedColors: arrayUnion(color) }, updatedAt: Date.now() },
        { merge: true }
      ).catch(() => showToast("Speichern fehlgeschlagen"));
    }
  };

  const saveName = async () => {
    const clean = name.trim().slice(0, 16);
    if (!clean) return;
    if (auth?.currentUser) await updateProfile(auth.currentUser, { displayName: clean }).catch(() => {});
    if (canPersist && db && user) {
      await setDoc(doc(db, "users", user.uid), { displayName: clean, updatedAt: Date.now() }, { merge: true }).catch(
        () => {}
      );
    }
    useAuth.setState((s) => (s.user ? { user: { ...s.user, displayName: clean } } : {}));
    showToast("Name gespeichert");
  };

  return (
    <Background>
      <div className="mb-4 flex items-center justify-between">
        <button className="btn-ghost px-3 py-2" onClick={() => setScreen("menu")}>
          ← Zurück
        </button>
        <h1 className="font-display text-2xl font-bold">Profil</h1>
        <button className="btn-ghost px-3 py-2 text-sm" onClick={() => logout()}>
          Abmelden
        </button>
      </div>

      <div className="card mb-4 flex items-center gap-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold shadow-inner"
          style={{ backgroundColor: equipped }}
        >
          {(user?.displayName || "?").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex gap-2">
            <input className="input" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
            <button className="btn-primary px-4" onClick={saveName}>
              ✓
            </button>
          </div>
          <div className="mt-1 text-xs text-white/50">
            {user?.isGuest ? "Gastkonto" : "Konto"} · Level {level}
          </div>
        </div>
      </div>

      {!canPersist && (
        <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          Als Gast wird dein Fortschritt nicht gespeichert. Registriere dich, um XP, Level &amp;
          Statistiken zu behalten.
        </div>
      )}

      <div className="card mb-4">
        <div className="mb-1 flex justify-between text-sm">
          <span className="font-semibold">Level {level}</span>
          <span className="text-white/50">
            {xpIntoLevel} / {xpForNext} XP
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-black/40">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cham-400 to-emerald-300 transition-all"
            style={{ width: `${Math.min(100, (xpIntoLevel / xpForNext) * 100)}%` }}
          />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="Spiele" value={loading ? "…" : stats.matchesPlayed} />
        <Stat label="Siege" value={loading ? "…" : stats.wins} />
        <Stat label="Winrate" value={loading ? "…" : `${winrate}%`} />
        <Stat label="Markierungen" value={loading ? "…" : stats.eliminations} />
        <Stat label="Überlebt" value={loading ? "…" : stats.timesSurvived} />
        <Stat label="Gefunden" value={loading ? "…" : stats.timesFound} />
      </div>

      <div className="card">
        <div className="mb-3 text-sm font-semibold text-white/70">Hider-Farbe (ausgerüstet)</div>
        <div className="grid grid-cols-8 gap-2">
          {COLOR_PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => equipColor(c)}
              className={`aspect-square rounded-lg transition ${
                equipped.toLowerCase() === c.toLowerCase()
                  ? "ring-2 ring-white ring-offset-2 ring-offset-cham-900"
                  : ""
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
    </Background>
  );
}
