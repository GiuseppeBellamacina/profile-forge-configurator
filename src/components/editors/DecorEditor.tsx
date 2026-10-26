import { useEffect, useRef, useState } from "react";
import { MOTIFS, MOTIF_NAMES, resolveTheme } from "../../core";
import { imgSrc } from "../../lib/assets";
import { addAssets, edit, setVal, themeSlots, useAssets, useRaw } from "../../store/config";
import { Icon } from "../ui/Icon";
import { ColorWidget } from "./ThemeEditor";

type Piece = { motif?: string; image?: string; x?: number; y?: number; size?: number; rotate?: number; opacity?: number; color?: string; color2?: string; layer?: string; flip?: boolean; motion?: string };

const MAX = 12;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "art";

/** A motif as a small picture, in two theme-ish colours, for the gallery and the list. */
const motifUrl = (motif: string, a = "#9aa4b5", b = "#5b8cff") =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${MOTIFS[motif](a, b)}</svg>`)}`;

function Slider({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="decor-slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
      <output>{Math.round(value * 100) / 100}</output>
    </label>
  );
}

/**
 * The art on the card (`card.decor`): pick motifs from a library or upload your own image, then place, size, turn and fade each
 * piece. Positions are percents of the card, so a piece keeps its place when the card gets taller.
 */
export function DecorEditor() {
  const raw = useRaw();
  const assets = useAssets();
  const list: Piece[] = raw.card?.decor ?? [];
  const first = Object.values(themeSlots(raw))[0] ?? "dark";
  const dlg = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) dlg.current?.showModal(); }, [open]);

  let accent = "#5b8cff", accent2 = "#9aa4b5";
  try { const c = resolveTheme(first) as Record<string, string>; accent = c.accent; accent2 = c.accent2; } catch { /* unknown theme while editing */ }

  const save = (next: Piece[]) => setVal("card.decor", next.length ? next : undefined);
  const update = (i: number, patch: Partial<Piece>, key = "") => edit((r) => {
    const cur: Piece[] = [...(r.card?.decor ?? [])];
    cur[i] = { ...cur[i], ...patch };
    for (const [k, v] of Object.entries(patch)) if (v === undefined) delete (cur[i] as Record<string, unknown>)[k];
    (r.card ??= {}).decor = cur;
  }, key ? `decor-${i}-${key}` : "");
  const add = (p: Piece) => {
    if (list.length >= MAX) return alert(`At most ${MAX} pieces of art.`);
    save([...list, p]);
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };
  const upload = async (f: File) => {
    if (!/^image\/(svg\+xml|png|jpeg|webp|gif)$/.test(f.type)) return alert("Use an svg, png, jpg, webp or gif image.");
    if (f.size > 300_000) return alert("The image is larger than 300 KB.");
    const ext = f.type === "image/svg+xml" ? "svg" : f.type === "image/jpeg" ? "jpg" : f.type.slice(6);
    const data = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
    const path = `assets/img/card-${slug(f.name.replace(/\.[^.]+$/, ""))}.${ext}`;
    addAssets({ [path]: { url: data } });
    add({ image: path, size: 24, opacity: 0.8 });
  };

  return (
    <div className="stack" style={{ marginTop: 12 }}>
      <div className="row">
        <button type="button" className="btn primary" onClick={() => setOpen(true)} disabled={list.length >= MAX}>Add art</button>
        <button type="button" className="btn" onClick={() => file.current?.click()} disabled={list.length >= MAX}>Upload an image</button>
        <input ref={file} type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
        <span className="log">{list.length ? `${list.length} of ${MAX} pieces` : "No art yet: pick a motif or upload your own image."}</span>
      </div>

      {list.map((p, i) => (
        <div key={i} className="card-box decor-item">
          <div className="row">
            <img className="decor-thumb" alt="" src={p.motif ? motifUrl(p.motif, p.color ? `#${p.color}` : accent2, p.color2 ? `#${p.color2}` : accent) : imgSrc(assets, p.image ?? "")} />
            <b style={{ flex: 1 }}>{p.motif ?? p.image?.split("/").pop()}</b>
            <button type="button" className="btn sm" title="Move back" aria-label="Move back" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button type="button" className="btn sm" title="Move forward" aria-label="Move forward" disabled={i === list.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button type="button" className="btn sm danger" title="Remove" aria-label="Remove" onClick={() => save(list.filter((_, j) => j !== i))}><Icon n="reset" /></button>
          </div>
          <div className="decor-grid">
            <Slider label="Left" value={p.x ?? 50} min={-20} max={120} onChange={(v) => update(i, { x: v }, "x")} />
            <Slider label="Top" value={p.y ?? 50} min={-20} max={120} onChange={(v) => update(i, { y: v }, "y")} />
            <Slider label="Size" value={p.size ?? 20} min={4} max={100} onChange={(v) => update(i, { size: v }, "size")} />
            <Slider label="Turn" value={p.rotate ?? 0} min={-180} max={180} onChange={(v) => update(i, { rotate: v || undefined }, "rotate")} />
            <Slider label="Opacity" value={p.opacity ?? 0.5} min={0} max={1} step={0.05} onChange={(v) => update(i, { opacity: v }, "opacity")} />
          </div>
          <div className="row">
            <label className="decor-pick">Layer
              <select value={p.layer ?? "back"} onChange={(e) => update(i, { layer: e.target.value === "back" ? undefined : e.target.value })}>
                <option value="back">behind the sections</option>
                <option value="front">in front of them</option>
              </select>
            </label>
            <label className="decor-pick">Motion
              <select value={p.motion ?? "none"} onChange={(e) => update(i, { motion: e.target.value === "none" ? undefined : e.target.value })}>
                <option value="none">still</option>
                <option value="float">float</option>
                <option value="pulse">pulse</option>
              </select>
            </label>
            <label className="decor-pick"><input type="checkbox" checked={!!p.flip} onChange={(e) => update(i, { flip: e.target.checked || undefined })} /> Mirror</label>
          </div>
          {p.motif && (
            <div className="row">
              <ColorWidget k="ring_color" label="Main" value={p.color ?? ""} theme={first} onSet={(v) => update(i, { color: v }, "color")} />
              <ColorWidget k="icon_color" label="Accent" value={p.color2 ?? ""} theme={first} onSet={(v) => update(i, { color2: v }, "color2")} />
            </div>
          )}
        </div>
      ))}

      {open && (
        <dialog ref={dlg} onClose={() => setOpen(false)} onClick={(e) => e.target === dlg.current && dlg.current?.close()}>
          <div className="dlg-head"><b>Add art</b><button className="btn sm" onClick={() => dlg.current?.close()}>Close</button></div>
          <div className="dlg-body">
            <div className="pk-grid">
              {MOTIF_NAMES.map((m) => (
                <button key={m} type="button" title={m} onClick={() => { add({ motif: m }); dlg.current?.close(); }}>
                  <img src={motifUrl(m, accent2, accent)} alt="" />
                  {m}
                </button>
              ))}
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}

/** The background image of the card (`card.background.image`), uploaded like the art. */
export function BackgroundImage() {
  const raw = useRaw();
  const assets = useAssets();
  const file = useRef<HTMLInputElement>(null);
  const img: string | undefined = raw.card?.background?.image ?? undefined;
  const upload = async (f: File) => {
    if (!/^image\/(svg\+xml|png|jpeg|webp|gif)$/.test(f.type)) return alert("Use an svg, png, jpg, webp or gif image.");
    if (f.size > 300_000) return alert("The image is larger than 300 KB.");
    const ext = f.type === "image/svg+xml" ? "svg" : f.type === "image/jpeg" ? "jpg" : f.type.slice(6);
    const data = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
    const path = `assets/img/card-background.${ext}`; // always the same name: a new image replaces the old one in the repo
    addAssets({ [path]: { url: data } });
    setVal("card.background.image", path);
  };
  return (
    <div className="row" style={{ marginTop: 8 }}>
      <button type="button" className="btn" onClick={() => file.current?.click()}>{img ? "Change the background image" : "Background image"}</button>
      <input ref={file} type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
      {img && (
        <>
          <img src={imgSrc(assets, img)} alt="" height={28} style={{ borderRadius: 4 }} />
          <button type="button" className="btn sm" onClick={() => setVal("card.background.image", undefined)}>Remove</button>
        </>
      )}
    </div>
  );
}
