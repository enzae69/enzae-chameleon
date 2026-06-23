import { useEffect, useRef, useState } from "react";
import { COLOR_PALETTE, type GamePhase } from "@enzae/shared";
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

/** "Paint yourself" panel: full palette + free colour picker, shown zoomed in. */
function PaintPanel({
  current,
  onPick,
  onClose,
}: {
  current: string;
  onPick: (c: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex justify-center p-4">
      <div className="glass w-full max-w-md rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="h-6 w-6 rounded-full ring-2 ring-white/40"
              style={{ backgroundColor: current }}
            />
            <span className="font-display text-lg font-bold">🎨 Anmalen</span>
          </div>
          <button className="btn-primary px-4 py-2 text-sm" onClick={onClose}>
            Fertig ✓
          </button>
        </div>
        <div className="grid grid-cols-8 gap-1.5">
          {COLOR_PALETTE.map((c) => (
            <button
              key={c}
              className="aspect-square rounded-md ring-1 ring-white/10 active:scale-90"
              style={{ backgroundColor: c }}
              onClick={() => onPick(c)}
            />
          ))}
        </div>
        <label className="mt-3 flex items-center justify-center gap-2 text-sm text-white/70">
          Eigene Farbe
          <input
            type="color"
            value={current}
            onChange={(e) => onPick(e.target.value)}
            className="h-9 w-16 cursor-pointer rounded-md bg-transparent"
          />
        </label>
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
  const laserCdUntil = useGame((s) => s.laserCdUntil);
  const scan = useGame((s) => s.scan);
  const scanCdUntil = useGame((s) => s.scanCdUntil);
  const scanResult = useGame((s) => s.scanResult);
  const sendEmote = useGame((s) => s.sendEmote);
  const showToast = useUI((s) => s.showToast);
  const paintMode = useUI((s) => s.paintMode);
  const setPaintMode = useUI((s) => s.setPaintMode);

  const [chatOpen, setChatOpen] = useState(false);
  const [, force] = useState(0);

  // Tick while laser/radar are recharging or a scan result is showing.
  const laserCd = Math.max(0, laserCdUntil - Date.now());
  const scanCd = Math.max(0, scanCdUntil - Date.now());
  const scanShowing = scanResult && Date.now() < scanResult.until;
  useEffect(() => {
    const t = window.setInterval(() => force((n) => n + 1), 120);
    return () => window.clearInterval(t);
  }, []);

  const self = roster.find((r) => r.sessionId === selfId);
  const team = self?.team ?? "hider";
  const eliminated = self?.isEliminated ?? false;
  const aliveHiders = roster.filter((r) => r.team === "hider" && !r.isEliminated).length;

  const showHiderTools = team === "hider" && !eliminated && phase !== "ended";
  const showSeekerTools = team === "seeker" && !eliminated && phase === "hunting";

  // Leave paint mode if we can no longer paint (got caught, round ended, …).
  useEffect(() => {
    if (paintMode && !showHiderTools) setPaintMode(false);
  }, [paintMode, showHiderTools, setPaintMode]);

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
            <div className="flex flex-col items-end gap-2">
              {scanShowing && (
                <div
                  className={`animate-pop rounded-full px-4 py-2 text-sm font-bold ${
                    scanResult!.nearby ? "bg-red-600/80 text-white" : "bg-cham-600/80 text-white"
                  }`}
                >
                  {scanResult!.nearby ? "⚠️ Jemand in der Nähe!" : "✓ Niemand in der Nähe"}
                </div>
              )}
              <div
                className={`glass rounded-full px-4 py-2 text-sm font-semibold ${
                  laserCd > 0 ? "text-white/50" : "text-red-300"
                }`}
              >
                {laserCd > 0
                  ? `⚡ Lädt… ${(laserCd / 1000).toFixed(1)}s`
                  : "⚡ Tippe zum Schießen"}
              </div>
              <button
                className={`px-5 py-3 text-base ${scanCd > 0 ? "btn-ghost opacity-60" : "btn-primary"}`}
                onClick={scan}
                disabled={scanCd > 0}
                title="Radar – zeigt 2s, ob ein Hider in der Nähe ist"
              >
                {scanCd > 0 ? `📡 ${(scanCd / 1000).toFixed(0)}s` : "📡 Radar"}
              </button>
            </div>
          )}

          {showHiderTools && !paintMode && (
            <div className="flex items-center gap-2">
              <button className="btn-ghost px-4 py-4" onClick={copyColor} title="Farbe vom nächsten Objekt kopieren">
                🦎 Tarnen
              </button>
              <button
                className="btn-primary px-5 py-4 text-base"
                onClick={() => setPaintMode(true)}
                title="Dich anmalen"
              >
                🎨 Malen
              </button>
            </div>
          )}
        </div>
      </div>

      {paintMode && showHiderTools && (
        <PaintPanel
          current={self?.color ?? "#7ec850"}
          onPick={changeColor}
          onClose={() => setPaintMode(false)}
        />
      )}
    </div>
  );
}
