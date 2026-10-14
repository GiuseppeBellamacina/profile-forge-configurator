// Fonts and icon bytes used by the preview and by publish. Everything is fetched once and cached.
import { b64 } from "./publish";

export const BASE = import.meta.env.BASE_URL; // "./" (relative: works under any subpath)
export const CORE = `${BASE}core/`;
export const FLAGS = "https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3";
export const DEVICON = "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0";

const MIME: Record<string, string> = { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
const extOf = (p: string) => p.split(".").pop()!.toLowerCase();

let fontCss = "";
export async function fonts(): Promise<string> {
  if (fontCss) return fontCss;
  const face = async (family: string, file: string) => {
    const bytes = new Uint8Array(await (await fetch(`${CORE}fonts/${file}`)).arrayBuffer());
    return `@font-face{font-family:'${family}';font-weight:300 800;src:url(data:font/woff2;base64,${b64(bytes)}) format("woff2")}`;
  };
  return (fontCss = (await face("Inter", "inter.woff2")) + (await face("Space Grotesk", "space-grotesk.woff2")));
}

/** Where an icon comes from: one the user picked (url in `assets`) or one bundled with the presets. */
export const imgSrc = (assets: Record<string, { url: string }>, path: string) => assets[path]?.url ?? `${CORE}presets/${path}`;

const bytes = new Map<string, Uint8Array>();
export async function assetBytes(assets: Record<string, { url: string }>, path: string): Promise<Uint8Array> {
  const key = imgSrc(assets, path);
  const hit = bytes.get(key);
  if (hit) return hit;
  const res = await fetch(key);
  if (!res.ok) throw new Error(`Could not fetch ${path} (${res.status})`);
  const b = new Uint8Array(await res.arrayBuffer());
  bytes.set(key, b);
  return b;
}
export async function dataUri(assets: Record<string, { url: string }>, path: string) {
  return `data:${MIME[extOf(path)] ?? "image/png"};base64,${b64(await assetBytes(assets, path))}`;
}
