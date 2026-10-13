import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// The renderer, themes and config schema live in profile-forge; they are bundled as-is through the @core alias.
const core = resolve(__dirname, process.env.CORE_DIR ?? "../profile-forge");

export default defineConfig({
  base: "./", // works under any subpath (GitHub Pages project sites)
  plugins: [react()],
  resolve: { alias: { "@core": resolve(core, "src") } },
  // 8080 is in the OAuth worker's ALLOWED_ORIGINS, so sign-in works locally too.
  server: { port: 8080, strictPort: true, fs: { allow: [__dirname, core] } },
  preview: { port: 8080, strictPort: true },
  build: { target: "es2022", chunkSizeWarningLimit: 800 },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
