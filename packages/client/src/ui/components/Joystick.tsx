import { useRef } from "react";
import { inputState } from "../../game/input";

const R = 56; // max knob travel (px)

export default function Joystick() {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const active = useRef(false);
  const center = useRef({ x: 0, y: 0 });

  const apply = (clientX: number, clientY: number) => {
    let dx = clientX - center.current.x;
    let dy = clientY - center.current.y;
    const dist = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(dist, R);
    const nx = (dx / dist) * clamped;
    const ny = (dy / dist) * clamped;
    if (knobRef.current) knobRef.current.style.transform = `translate(${nx}px, ${ny}px)`;
    inputState.joyX = nx / R;
    inputState.joyZ = ny / R;
  };

  const start = (e: React.PointerEvent) => {
    active.current = true;
    const rect = baseRef.current!.getBoundingClientRect();
    center.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    apply(e.clientX, e.clientY);
  };
  const move = (e: React.PointerEvent) => {
    if (active.current) apply(e.clientX, e.clientY);
  };
  const end = () => {
    active.current = false;
    inputState.joyX = 0;
    inputState.joyZ = 0;
    if (knobRef.current) knobRef.current.style.transform = "translate(0px, 0px)";
  };

  return (
    <div
      ref={baseRef}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className="relative h-32 w-32 select-none rounded-full border border-white/20 bg-white/5"
      style={{ touchAction: "none" }}
    >
      <div
        ref={knobRef}
        className="absolute h-14 w-14 rounded-full bg-white/30"
        style={{ left: "calc(50% - 28px)", top: "calc(50% - 28px)" }}
      />
    </div>
  );
}
