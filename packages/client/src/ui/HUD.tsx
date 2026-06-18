import { useEffect, useRef, useState } from "react";
import { COLOR_PALETTE, SEEKER_TAG_RANGE, type GamePhase } from "@enzae/shared";
import { live } from "../net/live";
import { useGame } from "../store/gameStore";
import { useUI } from "../store/uiStore";
import { toggleInvertY } from "../game/cameraInput";
import Joystick from "./components/Joystick";

const isTouch =
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

const phaseText: Record<GamePhase, string> = {
  waiting: "Wartet",
  hiding: "Versteckt euch!",
  hunting: "Jagd!",
  ended: "Runde vorbei",
};

function TimerBadge() {
  const phase = useGame((s) => s.phase);
  const phaseEndsAt = useGame((s) => s.phaseEndsAt);
  const [, force] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => force((n) => n + 1), 250);
    return () => window.clearInterval(t);
  }, []);
  const left = phaseEndsAt ? Math.max(0, Math.ceil((phaseEndsAt - Date.now()) / 1000)) : 0;
  return (
    <div className="text-center">
      <div className="text-xs uppercase tracking-wide text-white/60">{phaseText[phase]}</div>
      {phaseEndsAt > 0 && <div className="font-display text-2xl font-bold leading-none">{left}s</div>}
    </div>
  );
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  const chat = useGame((s) => s.chat);
  const sendChat = useGame((s) => s.sendChat);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const send = () => {
    const t = text.trim();
    if (t) sendChat(t);
    setText("");
  };

  return (
    <div className="glass absolute right-3 top-16 bottom-28 z-20 flex w-72 max-w-[80vw] flex-col rounded-2xl p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">Chat</span>
        <button className="text-white/60" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto pr-1 text-sm">
        {chat.map((c) => (
          <div key={c.id} className={c.system ? "text-white/40 italic" : ""}>
            {!c.system && <span className="font-semibold text-cham-300">{c.name}: </span>}
            {c.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className="input py-2"
          value={text}
          maxLength={200}
          placeholder="Nachricht…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button className="btn-primary px-3 py-2" onClick={send}>
          ➤
        </button>
      </div>
    </div>
  );
}

export default function HUD() {
  const leave = useGame((s) => s.leave);
  const phase = useGame((s) => s.phase);
  const roster = useGame((s) => s.roster);
  const selfId = useGame((s) => s.selfId);
  const copyColor = useGame((s) => s.copyColor);
  const changeColor = useGame((s) => s.changeColor);
  const disguise = useGame((s) => s.disguise);
  const undisguise = useGame((s) => s.undisguise);
  const tag = useGame((s) => s.tag);
  const tagCooldownUntil = useGame((s) => s.tagCooldownUntil);
  const sendEmote = useGame((s) => s.sendEmote);
  const showToast = useUI((s) => s.showToast);

  const [chatOpen, setChatOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [, force] = useState(0);

  // Tick while the tag cooldown is counting down so the button updates.
  const cdLeft = Math.max(0, tagCooldownUntil - Date.now());
  useEffect(() => {
    if (cdLeft <= 0) return;
    const t = window.setInterval(() => force((n) => n + 1), 120);
    return () => window.clearInterval(t);
  }, [cdLeft > 0]);
  const cdSec = Math.ceil(cdLeft / 1000);

  const self = roster.find((r) => r.sessionId === selfId);
  const team = self?.team ?? "hider";
  const eliminated = self?.isEliminated ?? false;
  const disguised = self?.disguised ?? false;
  const aliveHiders = roster.filter((r) => r.team === "hider" && !r.isEliminated).length;

  const tagNearest = () => {
    if (cdLeft > 0) return; // cooldown active
    let best: string | null = null;
    let bestD = SEEKER_TAG_RANGE;
    live.players.forEach((p) => {
      if (p.team !== "hider" || p.isEliminated) return;
      const d = Math.hypot(p.x - live.selfX, p.z - live.selfZ);
      if (d <= bestD) {
        bestD = d;
        best = p.sessionId;
      }
    });
    if (best) tag(best);
    else showToast("Kein Hider in Reichweite");
  };

  const showHiderTools = team === "hider" && !eliminated && phase !== "ended";
  const showSeekerTools = team === "seeker" && !eliminated && phase === "hunting";

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
        <button className="btn-danger pointer-events-auto px-3 py-2 text-sm" onClick={leave}>
          ← Verlassen
        </button>

        <div className="glass pointer-events-auto rounded-2xl px-4 py-2">
          <TimerBadge />
        </div>

        <div className="flex gap-2">
          <button
            className="btn-ghost pointer-events-auto px-3 py-2 text-sm"
            title="Kamera Y-Achse invertieren"
            onClick={() =>
              showToast(toggleInvertY() ? "Kamera-Y: invertiert" : "Kamera-Y: normal")
            }
          >
            ⇅
          </button>
          <button
            className="btn-ghost pointer-events-auto px-3 py-2 text-sm"
            onClick={() => setChatOpen((o) => !o)}
          >
            💬
          </button>
        </div>
      </div>

      {/* Role / alive strip */}
      <div className="absolute inset-x-0 top-20 flex justify-center">
        <div className="glass rounded-full px-4 py-1.5 text-sm">
          <span className={team === "seeker" ? "text-red-300" : "text-cham-300"}>
            {team === "seeker" ? "🔴 Seeker" : "🟢 Hider"}
          </span>
          {eliminated && <span className="ml-2 text-white/50">· raus (Zuschauer)</span>}
          {disguised && <span className="ml-2 text-amber-300">· 🪄 verwandelt – nicht bewegen!</span>}
          <span className="ml-3 text-white/60">🫥 {aliveHiders} übrig</span>
        </div>
      </div>

      {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}

      {/* Bottom controls */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
        <div className="pointer-events-auto">
          {isTouch ? (
            <Joystick />
          ) : (
            <div className="glass rounded-xl px-3 py-2 text-xs leading-tight text-white/60">
              WASD bewegen
              <br />
              Maus ziehen: Kamera · Rad: Zoom
            </div>
          )}
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-2">
          {/* Emotes */}
          <div className="flex gap-1">
            {["👋", "😄", "😱", "🎉"].map((em) => (
              <button
                key={em}
                className="glass h-10 w-10 rounded-xl text-lg active:scale-90"
                onClick={() => sendEmote(em)}
              >
                {em}
              </button>
            ))}
          </div>

          {showSeekerTools && (
            <button
              className={`px-5 py-4 text-base ${cdLeft > 0 ? "btn-ghost opacity-60" : "btn-danger"}`}
              onClick={tagNearest}
              disabled={cdLeft > 0}
            >
              {cdLeft > 0 ? `⏳ ${cdSec}s` : "🎯 Markieren"}
            </button>
          )}

          {showHiderTools && (
            <div className="flex items-center gap-2">
              {paletteOpen && (
                <div className="glass grid grid-cols-5 gap-1 rounded-2xl p-2">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      className="h-7 w-7 rounded-md active:scale-90"
                      style={{ backgroundColor: c }}
                      onClick={() => {
                        changeColor(c);
                        setPaletteOpen(false);
                      }}
                    />
                  ))}
                </div>
              )}
              <button
                className="btn-ghost px-4 py-4"
                onClick={() => setPaletteOpen((o) => !o)}
                title="Farbe wählen"
              >
                🎨
              </button>
              <button className="btn-ghost px-4 py-4" onClick={copyColor} title="Farbe vom nächsten Objekt kopieren">
                🦎 Tarnen
              </button>
              {disguised ? (
                <button className="btn-primary px-5 py-4 text-base" onClick={undisguise}>
                  🙅 Enttarnen
                </button>
              ) : (
                <button
                  className="btn-primary px-5 py-4 text-base"
                  onClick={disguise}
                  title="In das nächste Objekt verwandeln (still halten!)"
                >
                  🪄 Verwandeln
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
