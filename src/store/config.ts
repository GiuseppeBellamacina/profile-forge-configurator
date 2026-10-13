// The configuration being edited (`raw` = exactly what ends up in config.json) + undo/redo + persistence.
import { DEFAULTS, normalize, setPath, type Raw } from "../core";
import { clone, deletePath, eq, getPath } from "../lib/path";
import { local } from "../lib/storage";
import { createStore, useStore } from "./store";

export type Assets = Record<string, { url: string }>;
export const START: Raw = { themes: { dark: "catppuccin-mocha", light: "catppuccin-latte" } };
const MAX_HISTORY = 100;
const COALESCE_MS = 800; // typing in one field is one undo step

type State = { raw: Raw; assets: Assets; past: string[]; future: string[] };
export const configStore = createStore<State>({
  raw: local.get<Raw>("pf:raw") ?? clone(START),
  assets: local.get<Assets>("pf:assets") ?? {},
  past: [],
  future: [],
});

let lastKey = "";
let lastAt = 0;

function persist() {
  const { raw, assets } = configStore.get();
  local.set("pf:raw", raw);
  local.set("pf:assets", assets);
}

/** Apply an edit to a copy of the config. `key` groups rapid edits of the same field into one undo step. */
export function edit(fn: (raw: Raw) => void, key = "") {
  const { raw, past } = configStore.get();
  const next = clone(raw);
  fn(next);
  if (eq(next, raw)) return;
  const now = Date.now();
  const coalesce = key && key === lastKey && now - lastAt < COALESCE_MS;
  lastKey = key;
  lastAt = now;
  configStore.set({ raw: next, past: coalesce ? past : [...past, JSON.stringify(raw)].slice(-MAX_HISTORY), future: [] });
  persist();
}

/** Store a value, dropping it when it equals the default so config.json stays minimal. */
export function setVal(path: string, val: unknown) {
  edit((raw) => {
    const def = getPath(DEFAULTS, path);
    const empty = val === undefined || val === "" || (Array.isArray(val) && !val.length && (!def || !def.length));
    if (empty || eq(val, def) || (val === null && def == null)) deletePath(raw, path);
    else setPath(raw, path, val);
  }, path);
}
export const resetPath = (path: string) => edit((raw) => deletePath(raw, path));

/** Replace the whole configuration (preset, import, shared link, reset). */
export function replaceConfig(raw: Raw, assets?: Assets) {
  edit((r) => {
    for (const k of Object.keys(r)) delete r[k];
    Object.assign(r, clone(raw));
  });
  if (assets) addAssets(assets);
}

export function addAssets(more: Assets) {
  configStore.set((s) => ({ assets: { ...s.assets, ...more } }));
  persist();
}

export function undo() {
  const { raw, past, future } = configStore.get();
  if (!past.length) return;
  configStore.set({ raw: JSON.parse(past.at(-1)!), past: past.slice(0, -1), future: [JSON.stringify(raw), ...future] });
  lastKey = "";
  persist();
}
export function redo() {
  const { raw, past, future } = configStore.get();
  if (!future.length) return;
  configStore.set({ raw: JSON.parse(future[0]), past: [...past, JSON.stringify(raw)], future: future.slice(1) });
  lastKey = "";
  persist();
}

// ── reading ──
export const useRaw = () => useStore(configStore, (s) => s.raw);
export const useAssets = () => useStore(configStore, (s) => s.assets);
export const useCanUndo = () => useStore(configStore, (s) => s.past.length > 0);
export const useCanRedo = () => useStore(configStore, (s) => s.future.length > 0);
/** Current value of a field, falling back to the default. */
export const valueOf = (raw: Raw, path: string) => getPath(raw, path) ?? getPath(DEFAULTS, path);
export const isSet = (raw: Raw, path: string) => getPath(raw, path) !== undefined;

/** Theme slots as { slot: theme }, whether config uses the list or the map form. */
export const themeSlots = (raw: Raw): Record<string, string> =>
  Array.isArray(raw.themes) ? Object.fromEntries(raw.themes.map((t: string) => [t, t])) : raw.themes ?? START.themes;

/** Throws with a readable message if the config is not valid for profile-forge. */
export const validate = (raw: Raw) => normalize(clone(raw));
