/**
 * Roblox-style mobile camera input. Lives outside React so it never triggers
 * re-renders; the render loop reads `camState` every frame.
 *
 *  - one finger drag  → orbit (yaw / pitch)
 *  - two finger pinch → stepless zoom (distance)
 *  - mouse drag       → orbit (desktop)
 *  - mouse wheel      → zoom (desktop)
 *
 * Zooming all the way in crosses into first-person (handled by the controller).
 */
export const CAM = {
  MIN_DIST: 0.4, // fully zoomed in → first person
  MAX_DIST: 18,
  FP_DIST: 0.8, // <= this = first person view
  MIN_PITCH: -0.35, // radians (look slightly up from behind)
  MAX_PITCH: 1.45, // look down from above
  ROT_SPEED: 0.006, // radians per pixel
  WHEEL_SPEED: 0.0015,
};

export const camState = {
  yaw: 0, // azimuth around the character
  pitch: 0.55, // elevation
  distance: 9, // current zoom distance
  invertY: typeof localStorage !== "undefined" && localStorage.getItem("invertY") === "1",
};

/** Flip vertical look direction; persisted. Returns the new value. */
export function toggleInvertY(): boolean {
  camState.invertY = !camState.invertY;
  try {
    localStorage.setItem("invertY", camState.invertY ? "1" : "0");
  } catch {
    /* ignore */
  }
  return camState.invertY;
}

export function resetCamera(): void {
  camState.yaw = 0;
  camState.pitch = 0.55;
  camState.distance = 9;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Attach camera-control listeners to a DOM element. Returns a cleanup fn. */
export function attachCameraInput(el: HTMLElement): () => void {
  const pointers = new Map<number, { x: number; y: number }>();
  let lastPinch = 0;

  const pinchDistance = (): number => {
    const pts = Array.from(pointers.values());
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };

  const onDown = (e: PointerEvent) => {
    // Mouse: only drag with the primary (left) button.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) lastPinch = pinchDistance();
  };

  const onMove = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;

    if (pointers.size >= 2) {
      // Pinch: spreading fingers (distance grows) zooms in.
      const d = pinchDistance();
      if (lastPinch > 0 && d > 0) {
        camState.distance = clamp(camState.distance * (lastPinch / d), CAM.MIN_DIST, CAM.MAX_DIST);
      }
      lastPinch = d;
    } else {
      // Orbit. Horizontal: drag right → look right. Vertical defaults to
      // drag up → tilt up over the character; flip with the invert-Y toggle.
      camState.yaw -= dx * CAM.ROT_SPEED;
      const vy = camState.invertY ? -dy : dy;
      camState.pitch = clamp(camState.pitch - vy * CAM.ROT_SPEED, CAM.MIN_PITCH, CAM.MAX_PITCH);
    }
  };

  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) lastPinch = 0;
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    camState.distance = clamp(
      camState.distance * (1 + e.deltaY * CAM.WHEEL_SPEED),
      CAM.MIN_DIST,
      CAM.MAX_DIST
    );
  };

  const prevTouchAction = el.style.touchAction;
  el.style.touchAction = "none";
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  el.addEventListener("pointerleave", onUp);
  el.addEventListener("wheel", onWheel, { passive: false });

  return () => {
    el.style.touchAction = prevTouchAction;
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onUp);
    el.removeEventListener("pointerleave", onUp);
    el.removeEventListener("wheel", onWheel);
  };
}
