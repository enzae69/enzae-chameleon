import { useEffect, useRef, useState } from "react";
import { SELECTABLE_MAP_IDS, mapDef } from "@enzae/shared";
import GameCanvas from "../game/GameCanvas";
import HUD from "./HUD";
import { useGame } from "../store/gameStore";
import { useUI } from "../store/uiStore";

// How long the "YOU ARE …" role reveal stays on screen at the start of a round.
const REVEAL_MS = 3000;

/**
 * Start-of-round overlay. Two stages, driven purely off the live phase so it
 * can never get "stuck":
 *   1. Role reveal ("YOU ARE THE SEEKER/HIDER") for everyone, the first 3s.
 *   2. Seekers then "count" with eyes closed (black screen) until hiding ends.
 * It vanishes instantly when the player is eliminated or the phase leaves
 * "hiding" — no timers to clear, so there is nothing left hanging around.
 */
function RoundIntro() {
  const phase = useGame((s) => s.phase);
  const phaseEndsAt = useGame((s) => s.phaseEndsAt);
  const roster = useGame((s) => s.roster);
  const selfId = useGame((s) => s.selfId);
  const self = roster.find((r) => r.sessionId === selfId);
  const team = self?.team ?? "hider";
  const eliminated = self?.isEliminated ?? false;

  // Remember when the current hiding phase started so the reveal is time-boxed.
  const startedAt = useRef(0);
  const wasHiding = useRef(false);
  const [, force] = useState(0);

  useEffect(() => {
    if (phase === "hiding" && !wasHiding.current) startedAt.current = Date.now();
    wasHiding.current = phase === "hiding";
  }, [phase]);

  // Re-render on a tick while hiding so the reveal expires and the countdown moves.
  useEffect(() => {
    if (phase !== "hiding") return;
    const t = window.setInterval(() => force((n) => n + 1), 150);
    return () => window.clearInterval(t);
  }, [phase]);

  if (phase !== "hiding" || eliminated) return null;
  const seeker = team === "seeker";
  const sinceStart = startedAt.current ? Date.now() - startedAt.current : Infinity;

  // Stage 1 — role reveal (both teams), on top of everything.
  if (sinceStart < REVEAL_MS) {
    return (
      <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={`animate-pop rounded-3xl border-4 px-10 py-8 text-center backdrop-blur-md ${
            seeker ? "border-red-500 bg-red-950/60" : "border-cham-400 bg-cham-950/50"
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

  // Stage 2 — seekers wait with eyes closed until the hunt begins.
  if (seeker) {
    const left = phaseEndsAt ? Math.max(0, Math.ceil((phaseEndsAt - Date.now()) / 1000)) : 0;
    return (
      <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black text-center">
        <div className="text-8xl">🙈</div>
        <h2 className="font-display mt-3 text-4xl font-black text-white">Augen zu!</h2>
        <p className="mt-1 text-lg text-white/60">Die Hider verstecken sich…</p>
        <div className="mt-6 font-display text-7xl font-black text-cham-300">{left}</div>
      </div>
    );
  }

  return null;
}

function WaitingOverlay() {
  const roster = useGame((s) => s.roster);
  const selfId = useGame((s) => s.selfId);
  const isHost = useGame((s) => s.isHost);
  const roomId = useGame((s) => s.roomId);
  const roomName = useGame((s) => s.roomName);
  const roomKind = useGame((s) => s.roomKind);
  const countdownEndsAt = useGame((s) => s.countdownEndsAt);
  const mapId = useGame((s) => s.mapId);
  const setMap = useGame((s) => s.setMap);
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

        {/* Map selection (host chooses; everyone sees the choice). */}
        <div className="mb-4">
          <div className="mb-1.5 text-xs uppercase tracking-wide text-white/50">
            Karte {isHost ? "" : "(Host wählt)"}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {SELECTABLE_MAP_IDS.map((id) => {
              const active = id === mapId;
              return (
                <button
                  key={id}
                  disabled={!isHost || Boolean(countdownEndsAt)}
                  onClick={() => setMap(id)}
                  className={`rounded-xl px-2 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-cham-600 text-white ring-2 ring-cham-300"
                      : "bg-white/5 text-white/70 hover:bg-white/10"
                  } ${!isHost ? "cursor-default opacity-90" : ""}`}
                >
                  {mapDef(id).name}
                </button>
              );
            })}
          </div>
        </div>

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
      <RoundIntro />
      {phase === "waiting" && <WaitingOverlay />}
      {phase === "ended" && <EndOverlay />}
    </div>
  );
}
