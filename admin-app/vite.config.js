import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(process.cwd(), "admin-app"),
  plugins: [react()],
  base: "/admin/",
  build: {
    outDir: resolve(process.cwd(), "public/admin"),
    emptyOutDir: true,
    assetsDir: "assets",
    target: "es2019",
  },
});
