const raw = (import.meta.env.VITE_SERVER_URL as string) || "ws://localhost:2567";

/** Colyseus endpoint (ws:// or wss://). */
export const SERVER_URL = raw.replace(/\/$/, "");

/** Matching http(s):// endpoint for the REST helpers (e.g. room browser). */
export const HTTP_URL = SERVER_URL.replace(/^ws/, "http");
