import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/auth": "http://127.0.0.1:8000",
      "/analyze": "http://127.0.0.1:8000",
      "/upload": "http://127.0.0.1:8000",
      "/data": "http://127.0.0.1:8000",
      "/history": "http://127.0.0.1:8000",
      "/analysis": "http://127.0.0.1:8000",
      "/health": "http://127.0.0.1:8000",
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/__tests__/setup.js",
    css: true,
  },
});
