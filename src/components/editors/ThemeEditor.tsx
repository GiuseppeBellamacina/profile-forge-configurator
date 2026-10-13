import { useEffect, useMemo, useRef, useState } from "react";
import { BUILTIN_THEMES, COLOR_KEYS, COLOR_NAMES, registerThemes, resolveTheme, themeNames } from "../../core";
import { CORE } from "../../lib/assets";
import { getPath } from "../../lib/path";
import { renderCard } from "../../lib/renderCard";
import { edit, setVal, themeSlots, useAssets, useRaw } from "../../store/config";
import { useSession } from "../../store/session";
import { uiStore, useUi } from "../../store/ui";
import { Icon } from "../ui/Icon";

const HEX = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const hex6 = (v: string) => {
  const x = v.replace("#", "");
  return /^[0-9a-f]{6}/i.test(x) ? "#" + x.slice(0, 6) : /^[0-9a-f]{3}$/i.test(x) ? "#" + [...x].map((c) => c + c).join("") : "#888888";
};

/** Which slot a click on a theme assigns to. */
function useTargetSlot(slots: string[]) {
  const wanted = useUi((s) => s.slot);
  return slots.includes(wanted ?? "") ? (wanted as string) : slots[0];
}

function Swatch({ name, customs }: { name: string; customs: Record<string, unknown> }) {
  let c: Record<string, string>;
  try {
    registerThemes(customs);
    c = resolveTheme(name) as Record<string, string>;
  } catch {
    return null;
  }
  return (
    <div className="swatch" style={{ background: c.bg1 }}>
      <i style={{ background: c.panel, border: `1px solid ${c.border}` }} />
      <i style={{ background: c.panel, border: `1px solid ${c.border}` }} />
      <div className="bars">
        {[c.accent, c.accent2, c.fire, c.text].map((x, i) => <i key={i} style={{ background: x }} />)}
      </div>
    </div>
  );
}


// Thumbnails render serially (one card per frame) so a 47-tile gallery never blocks typing or scrolling.
let queue: Promise<unknown> = Promise.resolve();
const later = <T,>(job: () => Promise<T>) => (queue = queue.then(() => new Promise((r) => setTimeout(r, 0))).then(job, job)) as Promise<T>;

/** The user's own card (their config, colors and profile) rendered with one theme, drawn when the tile scrolls into view. */
function Thumb({ name, target, cache }: { name: string; target: string; cache: Map<string, string> }) {
  const raw = useRaw();
  const assets = useAssets();
  const profile = useSession((s) => s.profile);
  const box = useRef<HTMLSpanElement>(null);
  const [url, setUrl] = useState(cache.get(name) ?? "");
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setSeen(true), io.disconnect()), { rootMargin: "200px" });
    box.current && io.observe(box.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => setUrl(cache.get(name) ?? ""), [cache, name]); // cache replaced: drop the revoked url

  useEffect(() => {
    if (!seen || cache.has(name)) return;
    let live = true;
    later(() => renderCard({ ...raw, themes: { [target]: name }, card: { ...raw.card, animations: false } }, assets, profile, target))
      .then((r) => {
        const u = URL.createObjectURL(new Blob([r.svg], { type: "image/svg+xml" }));
        cache.set(name, u);
        live ? setUrl(u) : undefined;
      })
      .catch(() => {});
    return () => { live = false; };
  }, [seen, cache, name]);

  return (
    <span className="thumb" ref={box}>
      <img alt="" src={url || `${CORE}theme-previews/${name}.png`} />
    </span>
  );
}

/** Gallery of all themes (each tile is your own card drawn with that theme), assigned to the selected slot. */
export function ThemeGallery() {
  const raw = useRaw();
  const slots = themeSlots(raw);
  const slotNames = Object.keys(slots);
  const target = useTargetSlot(slotNames);
  const [q, setQ] = useState("");
  const [tone, setTone] = useState<"all" | "dark" | "light">("all");
  const customs = Object.keys(raw.customThemes ?? {});
  const names = BUILTIN_THEMES;
  // Thumbnails depend on everything in the config except the theme list, and on the loaded profile and slot.
  const assets = useAssets();
  const profile = useSession((s) => s.profile);
  const key = JSON.stringify([{ ...raw, themes: 0 }, target]);
  const cache = useMemo(() => new Map<string, string>(), [key, assets, profile]);
  useEffect(() => () => cache.forEach((u) => URL.revokeObjectURL(u)), [cache]);

  const list = useMemo(
    () =>
      names.filter((n) => {
        if (q && !n.includes(q.toLowerCase())) return false;
        if (tone === "all") return true;
        try { return (resolveTheme(n) as { base: string }).base === tone; } catch { return true; }
      }),
    [names, q, tone],
  );

  const pick = (theme: string) => edit((r) => (r.themes = { ...themeSlots(r), [target]: theme }));
  const using = (n: string) => slotNames.filter((s) => slots[s] === n);

  return (
    <div className="stack">
      <div className="row">
        <span className="hint">Assign to</span>
        <div className="seg" role="group" aria-label="Slot to assign">
          {slotNames.map((s) => (
            <button key={s} aria-pressed={s === target} onClick={() => uiStore.set({ slot: s })}>{s}</button>
          ))}
        </div>
        <span className="grow" />
        <div className="seg" role="group" aria-label="Filter">
          {(["all", "dark", "light"] as const).map((t) => (
            <button key={t} aria-pressed={t === tone} onClick={() => setTone(t)}>{t}</button>
          ))}
        </div>
      </div>
      <input type="search" placeholder={`Search ${names.length} themes…`} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="gallery">
        {customs.map((n) => (
          <button key={n} className="tile" aria-pressed={slots[target] === n} onClick={() => pick(n)}>
            <span className="thumb"><Swatch name={n} customs={raw.customThemes ?? {}} /></span>
            <span className="meta"><b>{n}</b><span className="tag">custom</span></span>
          </button>
        ))}
        {list.filter((n) => !customs.includes(n)).map((n) => (
          <button key={n} className="tile" aria-pressed={slots[target] === n} onClick={() => pick(n)} title={`Use ${n} for “${target}”`}>
            <Thumb name={n} target={target} cache={cache} />
            <span className="meta">
              <b>{n}</b>
              {using(n).map((s) => <span key={s} className="tag on">{s}</span>)}
            </span>
          </button>
        ))}
      </div>
      {!list.length && <div className="empty">No theme matches “{q}”.</div>}
    </div>
  );
}

/** The "Advanced slots" switch (off unless the config already has custom slots) and, when on, the slot editor. */
export function AdvancedSlots() {
  const slots = themeSlots(useRaw());
  const custom = Object.keys(slots).some((s) => s !== "dark" && s !== "light") || Object.keys(slots).length > 2;
  const [on, setOn] = useState(custom);
  useEffect(() => { if (custom) setOn(true); }, [custom]); // a config with extra slots (import, preset, undo) opens the editor
  return (
    <div className="stack">
      <label className="field inline" onClick={(e) => { e.preventDefault(); setOn(!on); }}>
        <span className="field-label">Advanced slots <small>extra card files, e.g. for a portfolio site; GitHub only needs dark and light</small></span>
        <button type="button" role="switch" aria-checked={on} aria-label="Advanced slots" className="toggle" />
      </label>
      {on && <ThemeSlots />}
    </div>
  );
}

/** Slots: the name decides the file (profile-forge-<slot>.svg), so the README never changes when a theme does. */
export function ThemeSlots() {
  const raw = useRaw();
  const slots = themeSlots(raw);
  const rename = (slot: string, value: string) => {
    const n = value.trim().replace(/[^\w-]/g, "") || slot;
    if (n === slot || n in slots) return;
    edit((r) => (r.themes = Object.fromEntries(Object.entries(themeSlots(r)).map(([s, t]) => [s === slot ? n : s, t]))));
  };
  return (
    <div className="list">
      {Object.entries(slots).map(([slot, theme]) => (
        <div className="item" key={slot}>
          <input type="text" defaultValue={slot} key={slot} style={{ width: 110, flex: "none" }} title="Slot name = file name suffix" onBlur={(e) => rename(slot, e.target.value)} />
          <select value={theme} style={{ flex: 1 }} onChange={(e) => edit((r) => (r.themes = { ...themeSlots(r), [slot]: e.target.value }))}>
            {themeNames(raw).map((n) => <option key={n}>{n}</option>)}
          </select>
          {Object.keys(slots).length > 1 && (
            <button className="btn sm danger" title="Remove slot" onClick={() => edit((r) => { const { [slot]: _, ...rest } = themeSlots(r); r.themes = rest; })}><Icon n="x" /></button>
          )}
        </div>
      ))}
      <div className="row">
        <button className="btn sm" onClick={() => edit((r) => { const s = themeSlots(r); r.themes = { ...s, [`slot${Object.keys(s).length + 1}`]: "dracula" }; })}><Icon n="plus" /> Add slot</button>
        <span className="hint">dark / light are the names GitHub’s README picture switch expects.</span>
      </div>
    </div>
  );
}

export function ColorWidget({ k, value, theme, onSet }: { k: string; value: string; theme: string; onSet: (v: string | undefined) => void }) {
  // The text is kept locally while typing ("f", "ff", "fff"); only a valid or empty value reaches the store.
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft((d) => (d.replace("#", "") === value ? d : value)), [value]);
  let fallback = "#888888";
  try {
    const c = resolveTheme(theme) as Record<string, string>;
    fallback = c[COLOR_KEYS[k][0]] ?? c.muted ?? fallback;
  } catch { /* unknown theme while editing */ }
  return (
    <div className="cf">
      <span title={k}>{k}</span>
      <input type="color" aria-label={k} value={hex6(value || fallback)} onChange={(e) => onSet(e.target.value.slice(1))} />
      <input type="text" maxLength={9} value={draft} aria-label={`${k} hex`} placeholder={String(fallback).replace("#", "").slice(0, 8)} onChange={(e) => {
        setDraft(e.target.value);
        const v = e.target.value.replace("#", "");
        if (!v) onSet(undefined);
        else if (HEX.test(v)) onSet(v);
      }} />
      <button title="Reset" aria-label={`Reset ${k}`} onClick={() => onSet(undefined)}><Icon n="reset" /></button>
    </div>
  );
}

const colorNames = COLOR_NAMES.filter((k) => k !== "bg_gradient");
// the snake colour is only offered while the heatmap is a snake
const shownColors = (raw: Record<string, any>) => colorNames.filter((k) => k !== "snakeColor" || raw.heatmap?.mode === "snake");

/** Color overrides for all slots, or for one slot only. */
export function ColorsEditor() {
  const raw = useRaw();
  const slots = themeSlots(raw);
  const [target, setTarget] = useState("all");
  const slotNames = Object.keys(slots);
  const t = target === "all" || slotNames.includes(target) ? target : "all";
  const base = t === "all" ? "colors" : `colorsByTheme.${t}`;
  const theme = slots[t === "all" ? slotNames[0] : t];
  return (
    <div className="stack">
      <label className="field">
        <span className="field-label">Apply to</span>
        <select value={t} onChange={(e) => setTarget(e.target.value)}>
          <option value="all">all slots</option>
          {slotNames.map((s) => <option key={s} value={s}>only “{s}”</option>)}
        </select>
      </label>
      <div className="colors">
        {shownColors(raw).map((k) => (
          <ColorWidget key={k} k={k} theme={theme} value={getPath(raw, `${base}.${k}`) ?? ""} onSet={(v) => setVal(`${base}.${k}`, v)} />
        ))}
      </div>
      <label className="field">
        <span className="field-label">bg_gradient <small>angle,color1,color2,…</small></span>
        <input type="text" placeholder="120,0f2027,203a43,2c5364" defaultValue={getPath(raw, `${base}.bg_gradient`) ?? ""} key={base} onChange={(e) => setVal(`${base}.bg_gradient`, e.target.value.trim() || undefined)} />
      </label>
    </div>
  );
}

/** Your own palettes, usable by name in the slots above. */
export function CustomThemes() {
  const raw = useRaw();
  const customs: Record<string, Record<string, string>> = raw.customThemes ?? {};
  const names = themeNames(raw);
  const setKey = (name: string, k: string, v: string | undefined) =>
    edit((r) => {
      const c = (r.customThemes ??= {});
      c[name] = { ...c[name] };
      v === undefined ? delete c[name][k] : (c[name][k] = v);
    }, `custom.${name}.${k}`);
  const rename = (name: string, value: string) => {
    const n = value.trim().replace(/\s+/g, "-");
    if (!n || n === name || n in customs || names.includes(n)) return;
    edit((r) => {
      r.customThemes = Object.fromEntries(Object.entries(r.customThemes).map(([k, v]) => [k === name ? n : k, v]));
      const s = themeSlots(r);
      if (Object.values(s).includes(name)) r.themes = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v === name ? n : v]));
    });
  };
  return (
    <div className="stack">
      {Object.entries(customs).map(([name, spec]) => (
        <div className="card-box stack" key={name}>
          <div className="row">
            <input type="text" defaultValue={name} key={name} style={{ maxWidth: 190 }} onBlur={(e) => rename(name, e.target.value)} />
            <span className="hint">based on</span>
            <select style={{ width: "auto" }} value={spec.base ?? "dark"} onChange={(e) => setKey(name, "base", e.target.value)}>
              {names.filter((n) => n !== name).map((n) => <option key={n}>{n}</option>)}
            </select>
            <span className="grow" />
            <button className="btn sm danger" onClick={() => edit((r) => {
              delete r.customThemes[name];
              if (!Object.keys(r.customThemes).length) delete r.customThemes;
              // a slot must never point at a theme that no longer exists
              const s = themeSlots(r);
              if (Object.values(s).includes(name)) r.themes = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v === name ? "dark" : v]));
            })}>Delete</button>
          </div>
          <div className="colors">
            {shownColors(raw).map((k) => (
              <ColorWidget key={k} k={k} theme={spec.base ?? "dark"} value={spec[k] ?? ""} onSet={(v) => setKey(name, k, v)} />
            ))}
          </div>
          <label className="field">
            <span className="field-label">bg_gradient <small>angle,color1,color2,…</small></span>
            <input type="text" defaultValue={spec.bg_gradient ?? ""} onChange={(e) => setKey(name, "bg_gradient", e.target.value.trim() || undefined)} />
          </label>
        </div>
      ))}
      <div className="row">
        <button className="btn sm" onClick={() => edit((r) => {
          let n = "my-theme", i = 1;
          while (names.includes(n) || n in (r.customThemes ?? {})) n = `my-theme-${++i}`;
          (r.customThemes ??= {})[n] = { base: "dark" };
        })}>+ New custom theme</button>
        <span className="hint">Then pick it in the gallery above.</span>
      </div>
    </div>
  );
}
