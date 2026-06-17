import { useAuth, buildJoinAuth } from "../store/authStore";
import { useGame } from "../store/gameStore";
import { useUI } from "../store/uiStore";
import { Background, Logo } from "./components/Layout";

export default function MainMenu() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const connecting = useGame((s) => s.connecting);
  const quickPlay = useGame((s) => s.quickPlay);
  const setScreen = useUI((s) => s.setScreen);

  const quick = async () => {
    quickPlay(await buildJoinAuth());
  };

  return (
    <Background>
      <div className="flex items-center justify-between">
        <Logo size="text-2xl" />
        <div className="flex items-center gap-2">
          <div className="glass rounded-full px-3 py-1.5 text-sm">
            <span className="font-semibold">{user?.displayName}</span>
            <span className="ml-2 text-xs text-white/50">{user?.isGuest ? "Gast" : "Konto"}</span>
          </div>
          <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => logout()}>
            Abmelden
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3 py-8">
        <button className="btn-primary py-5 text-lg" disabled={connecting} onClick={quick}>
          {connecting ? "Verbinde…" : "▶  Schnelles Spiel"}
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button className="btn-ghost py-5" onClick={() => setScreen("browser")}>
            🔎 Räume
          </button>
          <button className="btn-ghost py-5" onClick={() => setScreen("create")}>
            ➕ Raum erstellen
          </button>
          <button className="btn-ghost py-5" onClick={() => setScreen("profile")}>
            👤 Profil
          </button>
          <button className="btn-ghost py-5" onClick={() => setScreen("leaderboard")}>
            🏆 Rangliste
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-white/40">
        Tipp: Hider tarnen sich per Farbe – Seeker jagen &amp; markieren. Viel Glück! 🦎
      </p>
    </Background>
  );
}
