function resolveServerUrl(): string {
  // 1. Explicit override (e.g. separate-host deploy like GitHub Pages).
  const explicit = (import.meta.env.VITE_SERVER_URL as string | undefined)?.trim();
  if (explicit) return explicit;

  // 2. Served by the game server itself (single-service deploy on Render):
  //    talk to the same origin, upgrading to wss:// on https pages.
  if (typeof window !== "undefined") {
    const { protocol, host, hostname } = window.location;
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
    if (!isLocal) return `${protocol === "https:" ? "wss:" : "ws:"}//${host}`;
  }

  // 3. Local development default.
  return "ws://localhost:2567";
}

const raw = resolveServerUrl();

/** Colyseus endpoint (ws:// or wss://). */
export const SERVER_URL = raw.replace(/\/$/, "");

/** Matching http(s):// endpoint for the REST helpers (e.g. room browser). */
export const HTTP_URL = SERVER_URL.replace(/^ws/, "http");
