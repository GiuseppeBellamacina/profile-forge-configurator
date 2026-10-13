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

/** With an empty query the popular icons come first; otherwise match name, alternative names and tags. */
export const searchDevicons = (list: Devicon[], q: string, max = 150) => {
  const s = q.trim().toLowerCase();
  if (!s) {
    const rank = (d: Devicon) => { const i = POPULAR.indexOf(d.name); return i < 0 ? POPULAR.length : i; };
    return [...list].sort((a, b) => rank(a) - rank(b)).slice(0, max);
  }
  return list.filter((d) => d.name.includes(s) || d.altnames?.some((a) => a.includes(s)) || d.tags?.some((t) => t.includes(s))).slice(0, max);
};
