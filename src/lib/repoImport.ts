// Importing someone's existing profile setup from their <login>/<login> repository: pure helpers (no network).
import type { Raw } from "../core";

/** Safety limits for the images pulled into the preview (only the ones the config really uses). */
export const LIMITS = { files: 100, fileBytes: 1_000_000, totalBytes: 8_000_000 };

export type Skipped = { path: string; reason: string };
export type AssetMap = Record<string, { url: string }>;

const isRemote = (p: string) => /^(https?:|data:)/i.test(p);
const normalize = (p: string) => p.replace(/^\.?\//, "");
const kb = (n: number) => `${Math.round(n / 1000)} KB`;

/** Image paths the config really uses (tech stack icons that live in the repo), in order, without duplicates. */
export function usedAssets(raw: Raw): string[] {
  const all = [...(raw.techStack ?? []).flatMap((c: Raw) => (c.items ?? []).map((i: Raw) => i.image)), raw.header?.flag];
  return [...new Set<string>(all.filter((p: unknown): p is string => typeof p === "string" && !!p && !isRemote(p)))];
}

/**
 * Chooses which of the used files to load. `sizes` maps repo paths to byte sizes (from the git tree), `rawUrl` builds the
 * address the browser will fetch lazily when the preview needs it, so nothing is downloaded here.
 */
export function pickAssets(used: string[], sizes: Map<string, number>, rawUrl: (path: string) => string, limits = LIMITS) {
  const assets: AssetMap = {};
  const loaded: string[] = [];
  const skipped: Skipped[] = [];
  let total = 0;
  for (const path of used) {
    const size = sizes.get(normalize(path));
    if (size === undefined) skipped.push({ path, reason: "not found in your repository" });
    else if (size > limits.fileBytes) skipped.push({ path, reason: `too large (${kb(size)}, limit ${kb(limits.fileBytes)})` });
    else if (loaded.length >= limits.files) skipped.push({ path, reason: `more than ${limits.files} files` });
    else if (total + size > limits.totalBytes) skipped.push({ path, reason: `total size limit (${kb(limits.totalBytes)}) reached` });
    else {
      total += size;
      loaded.push(path);
      assets[path] = { url: rawUrl(normalize(path)) };
    }
  }
  return { assets, loaded, skipped, totalBytes: total };
}

/** Largest markdown we send to GitHub's renderer (its own limit is 400,000 characters). */
export const README_MAX = 300_000;

/**
 * Turns GitHub-rendered README html into a standalone document for a sandboxed frame: relative images load from the repo,
 * <picture> sources are dropped, and the profile-forge card images are replaced by the card being edited.
 * `cards` maps a theme slot to a data: url of that card.
 */
export function readmeDocument(html: string, opts: { cards: Record<string, string>; tone: "dark" | "light"; base: string }): string {
  const slots = Object.keys(opts.cards);
  const pick = slots.includes(opts.tone) ? opts.tone : slots[0];
  const body = html
    .replace(/<source\b[^>]*>/gi, "")
    .replace(/(<img\b[^>]*?\bsrc=")([^"]*assets\/profile-forge-[\w-]+\.svg)(")/gi, (m, a, _src, c) => (pick ? `${a}${opts.cards[pick]}${c}` : m));
  const dark = opts.tone === "dark";
  return `<!doctype html><meta charset="utf-8"><base href="${opts.base}"><style>
body{margin:0;padding:24px;font:14px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:${dark ? "#0d1117" : "#fff"};color:${dark ? "#e6edf3" : "#1f2328"};word-wrap:break-word}
a{color:${dark ? "#4493f8" : "#0969da"}}img{max-width:100%}h1,h2{border-bottom:1px solid ${dark ? "#3d444d" : "#d1d9e0"};padding-bottom:.3em}
code,pre{background:${dark ? "#151b23" : "#f6f8fa"};border-radius:6px}code{padding:.2em .4em}pre{padding:12px;overflow:auto}pre code{padding:0}
table{border-collapse:collapse}td,th{border:1px solid ${dark ? "#3d444d" : "#d1d9e0"};padding:6px 12px}blockquote{margin:0;padding:0 1em;color:${dark ? "#9198a1" : "#59636e"};border-left:.25em solid ${dark ? "#3d444d" : "#d1d9e0"}}
</style><article>${body}</article>`;
}
