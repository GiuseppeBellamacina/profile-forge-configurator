import type { Raw } from "../core";

export const getPath = (o: Raw | undefined, p: string): any => p.split(".").reduce((a: any, k) => a?.[k], o);
export const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export const clone = <T,>(v: T): T => structuredClone(v);

/** Delete a.b.c and prune the objects that become empty. */
export function deletePath(o: Raw, path: string) {
  const keys = path.split(".");
  const chain: any[] = [o];
  for (const k of keys.slice(0, -1)) {
    const next = chain.at(-1)?.[k];
    if (!next || typeof next !== "object") return;
    chain.push(next);
  }
  delete chain.at(-1)[keys.at(-1)!];
  for (let i = chain.length - 1; i > 0; i--) if (!Object.keys(chain[i]).length) delete chain[i - 1][keys[i - 1]];
}
