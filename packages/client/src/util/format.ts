/** Format the milliseconds remaining until `endsAt` as M:SS. */
export function formatCountdown(endsAt: number): string {
  const ms = Math.max(0, endsAt - Date.now());
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function secondsLeft(endsAt: number): number {
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}
