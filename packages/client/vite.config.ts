import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // On GitHub Pages the app is served from /<repo>/ — set BASE_PATH at build time.
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
  server: { port: 5173, host: true },
  preview: { port: 4173 },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 1500,
  },
});
