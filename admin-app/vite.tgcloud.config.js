import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Telegram Serverless hosts this build at the Mini App root.
// Keep the existing Vercel /admin build config unchanged.
export default defineConfig({
  root: resolve(process.cwd(), "admin-app"),
  plugins: [react()],
  base: "/",
  build: {
    outDir: resolve(process.cwd(), "dist"),
    emptyOutDir: true,
    assetsDir: "assets",
    target: "es2019",
  },
});
