#!/usr/bin/env node
// Assembles the static configurator into _site/ (what GitHub Pages serves).
// The renderer, themes, fonts, presets and schema come from a checkout of profile-forge, so the page always runs
// the same code as the GitHub Action.
//   node scripts/build-site.js           build (core = $CORE_DIR, default ../profile-forge)
//   node scripts/build-site.js --serve   build and serve on http://localhost:8080
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const core = resolve(root, process.env.CORE_DIR ?? "../profile-forge");
const out = join(root, "_site");
await readFile(join(core, "src", "render.js")).catch(() => {
  throw new Error(`profile-forge not found at ${core}. Clone it next to this repo, or set CORE_DIR.`);
});
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(join(root, "site"), out, { recursive: true });
await cp(join(core, "src"), join(out, "src"), { recursive: true, filter: (p) => !/(cli|export)\.js$/.test(p) });
await cp(join(core, "fonts"), join(out, "fonts"), { recursive: true });
await cp(join(core, "presets"), join(out, "presets"), { recursive: true, filter: (p) => !p.endsWith("README.md") });
await cp(join(core, "config.schema.json"), join(out, "config.schema.json"));
await cp(join(core, "examples", "profile-workflow.yml"), join(out, "profile-workflow.yml"));
console.log("built", out, "from", core);

if (process.argv.includes("--serve")) {
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".yml": "text/plain" };
  createServer(async (req, res) => {
    try {
      let p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
      if (p.endsWith("/")) p += "index.html";
      res.setHeader("Content-Type", TYPES[extname(p)] ?? "application/octet-stream");
      res.end(await readFile(join(out, p)));
    } catch {
      res.statusCode = 404;
      res.end("not found");
    }
  }).listen(8080, () => console.log("http://localhost:8080"));
}
