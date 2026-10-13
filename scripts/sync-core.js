#!/usr/bin/env node
// Copies the runtime files the page fetches (fonts, presets, preview images) from a profile-forge checkout into
// public/core/. The renderer itself (src/*.js) is bundled by Vite through the @core alias (see vite.config.ts).
//   CORE_DIR=path/to/profile-forge npm run build      (default: ../profile-forge)
import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const coreDir = resolve(root, process.env.CORE_DIR ?? "../profile-forge");
const out = join(root, "public", "core");

await readdir(join(coreDir, "src")).catch(() => {
  throw new Error(`profile-forge not found at ${coreDir}. Clone it next to this repo, or set CORE_DIR.`);
});
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const copy = (from, to, filter) => cp(join(coreDir, from), join(out, to), { recursive: true, filter });
await copy("fonts", "fonts", (p) => p.endsWith(".woff2") || !basename(p).includes("."));
await copy("presets", "presets", (p) => !p.endsWith("README.md"));
await copy("docs/themes", "theme-previews");
await copy("docs/presets", "preset-previews");

const presets = (await readdir(join(coreDir, "presets"))).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
await writeFile(join(out, "manifest.json"), JSON.stringify({ presets }, null, 2));
console.log(`synced ${presets.length} presets from ${coreDir}`);
