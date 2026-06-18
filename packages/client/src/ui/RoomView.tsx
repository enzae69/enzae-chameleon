import { useEffect, useRef, useState } from "react";
import GameCanvas from "../game/GameCanvas";
import HUD from "./HUD";
import { useGame } from "../store/gameStore";
import { useUI } from "../store/uiStore";

/** Full-screen role reveal shown when a round begins. */
function RoleAnnounce() {
  const phase = useGame((s) => s.phase);
  const roster = useGame((s) => s.roster);
  const selfId = useGame((s) => s.selfId);
  const team = roster.find((r) => r.sessionId === selfId)?.team ?? "hider";
  const [show, setShow] = useState(false);
  const prev = useRef(phase);

  useEffect(() => {
    if (phase === "hiding" && prev.current !== "hiding") {
      setShow(true);
      const t = window.setTimeout(() => setShow(false), 4200);
      prev.current = phase;
      return () => window.clearTimeout(t);
    }
    prev.current = phase;
  }, [phase]);

  if (!show) return null;
  const seeker = team === "seeker";

  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center p-4">
      <div
        className={`animate-pop rounded-3xl border-4 px-10 py-8 text-center backdrop-blur-md ${
          seeker ? "border-red-500 bg-red-950/50" : "border-cham-400 bg-cham-950/40"
        }`}
      >
        <div className="text-7xl drop-shadow-lg">{seeker ? "🔴" : "🟢"}</div>
        <h2 className="font-display mt-2 text-4xl font-black tracking-wide sm:text-5xl">
          {seeker ? "YOU ARE THE SEEKER" : "YOU ARE A HIDER"}
        </h2>
        <p className="mt-2 text-xl font-semibold text-white/80 sm:text-2xl">
          {seeker ? "Catch the hiders! 🎯" : "Versteck & tarne dich! 🦎"}
        </p>
      </div>
    </div>
  );
}

function WaitingOverlay() {
  const roster = useGame((s) => s.roster);
  const selfId = useGame((s) => s.selfId);
  const isHost = useGame((s) => s.isHost);
  const roomId = useGame((s) => s.roomId);
  const roomName = useGame((s) => s.roomName);
  const roomKind = useGame((s) => s.roomKind);
  const countdownEndsAt = useGame((s) => s.countdownEndsAt);
  const toggleReady = useGame((s) => s.toggleReady);
  const requestStart = useGame((s) => s.requestStart);
  const kick = useGame((s) => s.kick);
  const leave = useGame((s) => s.leave);
  const showToast = useUI((s) => s.showToast);

  const [, force] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => force((n) => n + 1), 250);
    return () => window.clearInterval(t);
  }, []);

  const self = roster.find((r) => r.sessionId === selfId);
  const countdown = countdownEndsAt ? Math.max(0, Math.ceil((countdownEndsAt - Date.now()) / 1000)) : 0;

  const copyCode = () => navigator.clipboard?.writeText(roomId).then(() => showToast("Code kopiert"));

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-md">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">{roomName}</h2>
          <button className="btn-ghost px-3 py-1.5 text-sm" onClick={leave}>
            Verlassen
          </button>
        </div>

        <button
          onClick={copyCode}
          className="mb-4 inline-flex items-center gap-2 rounded-lg bg-black/30 px-3 py-1.5 text-sm"
        >
          <span className="text-white/50">{roomKind === "private" ? "🔒 Code:" : "Code:"}</span>
          <span className="font-mono font-semibold">{roomId}</span>
          <span className="text-white/40">⧉</span>
        </button>

        <div className="mb-4 max-h-56 space-y-1.5 overflow-y-auto">
          {roster.map((r) => (
            <div key={r.sessionId} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
              <span className="h-4 w-4 rounded-full" style={{ backgroundColor: r.color }} />
              <span className="flex-1 font-semibold">
                {r.name} <span className="text-xs text-white/40">· Lvl {r.level}</span>
              </span>
              {!r.connected && <span className="text-xs text-white/30">offline</span>}
              <span>{r.isReady ? "✅" : "⌛"}</span>
              {isHost && r.sessionId !== selfId && (
                <button
                  className="rounded-md px-1.5 text-sm text-red-300/70 hover:bg-red-500/20 hover:text-red-300"
                  title={`${r.name} kicken`}
                  onClick={() => kick(r.sessionId)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {countdown > 0 ? (
          <div className="mb-2 text-center font-display text-3xl font-bold text-cham-300">
            Start in {countdown}…
          </div>
        ) : (
          <p className="mb-3 text-center text-sm text-white/50">
            {roster.length < 2 ? "Mindestens 2 Spieler nötig." : "Bereit machen zum Start!"}
          </p>
        )}

        <div className="flex gap-2">
          <button
            className={self?.isReady ? "btn-ghost flex-1" : "btn-primary flex-1"}
            onClick={toggleReady}
          >
            {self?.isReady ? "Nicht bereit" : "Bereit ✓"}
          </button>
          {isHost && (
            <button
              className="btn-primary flex-1"
              disabled={roster.length < 2}
              onClick={requestStart}
            >
              Jetzt starten
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EndOverlay() {
  const matchResult = useGame((s) => s.matchResult);
  const selfId = useGame((s) => s.selfId);
  if (!matchResult) return null;

  const mine = matchResult.rewards.find((r) => r.sessionId === selfId);
  const hidersWon = matchResult.winningTeam === "hider";

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="card animate-pop w-full max-w-sm text-center">
        <div className="mb-2 text-5xl">{hidersWon ? "🟢" : "🔴"}</div>
        <h2 className="font-display text-3xl font-bold">
          {hidersWon ? "Hider gewinnen!" : "Seeker gewinnen!"}
        </h2>
        {mine && <div className="mt-3 text-xl font-semibold text-cham-300">+{mine.xpGained} XP</div>}
        <p className="mt-4 text-sm text-white/50">Nächste Runde startet gleich…</p>
      </div>
    </div>
  );
}

export default function RoomView() {
  const phase = useGame((s) => s.phase);
  return (
    <div className="fixed inset-0 bg-black">
      <GameCanvas />
      <HUD />
      <RoleAnnounce />
      {phase === "waiting" && <WaitingOverlay />}
      {phase === "ended" && <EndOverlay />}
    </div>
  );
}
