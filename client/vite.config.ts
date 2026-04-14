import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev the Vite server runs on :5173 and proxies /socket.io to the
// Express+Socket.IO server on :3001. In production the same Express
// server serves both the static Vite build and the websocket.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
