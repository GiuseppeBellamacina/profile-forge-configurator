import { DEVICON } from "./assets";

export type Devicon = { name: string; altnames?: string[]; tags?: string[]; versions: { svg: string[] } };
let cache: Devicon[] | null = null;

export async function loadDevicons(): Promise<Devicon[]> {
  if (cache) return cache;
  cache = (await (await fetch(`${DEVICON}/devicon.json`)).json()) as Devicon[];
  return cache;
}
export const deviconUrl = (d: Devicon) => `${DEVICON}/icons/${d.name}/${d.name}-${d.versions.svg.includes("original") ? "original" : d.versions.svg[0]}.svg`;
const POPULAR = ["python", "javascript", "typescript", "react", "nodejs", "docker", "git", "linux", "cplusplus", "c", "rust", "go", "java", "pytorch", "tensorflow", "numpy", "pandas", "jupyter", "fastapi", "postgresql", "vscode", "html5", "css3", "bash", "github", "kubernetes", "amazonwebservices", "mongodb", "redis", "opencv"];

const norm = (s: string) => s.toLowerCase().replace(/\+/g, "plus").replace(/#/g, "sharp").replace(/[^a-z0-9]/g, ""); // C++ / C# are not "c"
const stem = (s: string) => norm(s).replace(/\d+$/, ""); // python3 -> python
const keys = (d: Devicon) => [d.name, ...(d.altnames ?? [])].map(norm);
const bigrams = (s: string) => { const m = new Map<string, number>(); for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) ?? 0) + 1); return m; };
/** Sørensen–Dice on letter pairs, 0..1. */
export const similarity = (a: string, b: string) => {
  if (a === b) return 1;
  const x = bigrams(a), y = bigrams(b);
  let hit = 0;
  for (const [g, n] of x) hit += Math.min(n, y.get(g) ?? 0);
  return a.length < 2 || b.length < 2 ? 0 : (2 * hit) / (a.length + b.length - 2);
};
const base = (path: string) => (path.split("/").pop() ?? "").replace(/\.[^.]+$/, "").replace(/^white_bg_/, "").replace(/-(original|plain|line|wordmark).*$/, ""); // cplusplus-original.svg -> cplusplus

/** The devicon an item of the stack stands for, by its name or file name: exact, without trailing version digits, or very similar (postgres ~ postgresql). */
export function findDevicon(list: Devicon[], item: { name: string; image: string }): Devicon | undefined {
  const names = [item.name, base(item.image)];
  for (const f of [norm, stem]) {
    const w = names.map(f).filter(Boolean);
    const d = list.find((d) => keys(d).some((k) => w.includes(f(k))));
    if (d) return d;
  }
  let best: [number, Devicon | undefined] = [0.85, undefined];
  for (const d of list) for (const n of names.map(stem)) for (const k of keys(d)) {
    const v = n.length >= 4 && k.length >= 4 ? similarity(n, stem(k)) : 0;
    if (v > best[0]) best = [v, d];
  }
  return best[1];
}

/** With an empty query the popular icons come first; otherwise rank by how well name, alternative names and tags match (exact, prefix, contained, similar). */
export const searchDevicons = (list: Devicon[], q: string, max = 150) => {
  const s = norm(q);
  if (!s) {
    const rank = (d: Devicon) => { const i = POPULAR.indexOf(d.name); return i < 0 ? POPULAR.length : i; };
    return [...list].sort((a, b) => rank(a) - rank(b)).slice(0, max);
  }
  const score = (d: Devicon) => {
    const k = keys(d);
    if (k.includes(s) || k.includes(stem(q))) return 0;
    if (k.some((x) => x.startsWith(s))) return 1;
    if (k.some((x) => x.includes(s))) return 2;
    if (d.tags?.some((t) => norm(t).includes(s))) return 3;
    return s.length >= 3 && k.some((x) => similarity(s, x) >= 0.6) ? 4 : -1;
  };
  return list.map((d) => [score(d), d] as const).filter(([v]) => v >= 0).sort((a, b) => a[0] - b[0]).slice(0, max).map(([, d]) => d);
};
