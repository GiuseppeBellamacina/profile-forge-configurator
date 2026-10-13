import { useEffect, useRef, useState } from "react";
import { BRANDS, ICONS } from "../../core";
import { imgSrc } from "../../lib/assets";
import { deviconUrl, loadDevicons, searchDevicons, type Devicon } from "../../lib/devicon";
import { slug } from "../../lib/publish";
import { addAssets, edit, setVal, useAssets, useRaw } from "../../store/config";
import { Icon } from "../ui/Icon";

// ── about ────────────────────────────────────────────────────────────────────
export function AboutEditor() {
  const raw = useRaw();
  const stored: string = (raw.about ?? []).join("\n\n");
  const [draft, setDraft] = useState(stored);
  useEffect(() => setDraft((d) => (d.trim() === stored.trim() ? d : stored)), [stored]);
  return (
    <label className="field" id="field-about">
      <span className="field-label">About</span>
      <textarea rows={6} value={draft} placeholder="Tell people who you are and what you build…" onChange={(e) => {
        setDraft(e.target.value);
        setVal("about", e.target.value.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean));
      }} />
    </label>
  );
}

// ── flat lists (projects, links) ─────────────────────────────────────────────
type Col = { key: string; label: string; wide?: boolean; list?: string; color?: boolean };

function RowsEditor({ path, cols, blank, noun, max }: { path: string; cols: Col[]; blank: Record<string, string>; noun: string; max?: number }) {
  const raw = useRaw();
  const items: Record<string, string>[] = raw[path] ?? [];
  const write = (next: Record<string, string>[]) => edit((r) => (next.length ? (r[path] = next) : delete r[path]), `${path}.rows`);
  const update = (i: number, key: string, v: string) =>
    write(items.map((it, x) => {
      if (x !== i) return it;
      const n = { ...it, [key]: v };
      if (!v) delete n[key];
      return n;
    }));
  return (
    <div className="list">
      {items.map((it, i) => (
        <div className="item" key={i}>
          {cols.map((c) =>
            c.color ? (
              <input key={c.key} type="color" aria-label={c.label} title={c.label} value={/^#[0-9a-f]{6}$/i.test(it[c.key] ?? "") ? it[c.key] : "#7aa2f7"} onChange={(e) => update(i, c.key, e.target.value)} />
            ) : (
              <input key={c.key} type="text" list={c.list} placeholder={c.label} aria-label={c.label} style={{ flex: c.wide ? "2 1 170px" : "1 1 110px", width: "auto" }} value={it[c.key] ?? ""} onChange={(e) => update(i, c.key, e.target.value)} />
            ),
          )}
          <button className="btn sm icon danger" aria-label={`Remove ${noun}`} onClick={() => write(items.filter((_, x) => x !== i))}><Icon n="x" /></button>
        </div>
      ))}
      <div className="row">
        <button className="btn sm" disabled={max !== undefined && items.length >= max} onClick={() => write([...items, { ...blank }])}>+ Add {noun}</button>
        {max !== undefined && <span className="hint">up to {max}</span>}
      </div>
    </div>
  );
}

export const WorkingEditor = () => (
  <RowsEditor path="workingOn" noun="project" max={4}
    cols={[{ key: "title", label: "Title" }, { key: "description", label: "One line", wide: true }, { key: "url", label: "https://…", wide: true }]}
    blank={{ title: "" }} />
);

export const LinksEditor = () => (
  <>
    <datalist id="iconlist">{[...Object.keys(ICONS), ...Object.keys(BRANDS)].map((i) => <option key={i} value={i} />)}</datalist>
    <RowsEditor path="links" noun="link"
      cols={[{ key: "label", label: "Label" }, { key: "url", label: "https://…", wide: true }, { key: "icon", label: "icon", list: "iconlist" }, { key: "color", label: "Color", color: true }]}
      blank={{ label: "", url: "", icon: "globe" }} />
  </>
);

// ── tech stack ───────────────────────────────────────────────────────────────
type Cat = { category: string; items: { name: string; image: string }[] };

export function StackEditor() {
  const raw = useRaw();
  const assets = useAssets();
  const cats: Cat[] = raw.techStack ?? [];
  const [picking, setPicking] = useState<number | null>(null);
  const write = (next: Cat[]) => edit((r) => (next.length ? (r.techStack = next) : delete r.techStack), "techStack");
  const upd = (i: number, fn: (c: Cat) => Cat) => write(cats.map((c, x) => (x === i ? fn(c) : c)));

  return (
    <div className="stack">
      {cats.map((cat, i) => (
        <div className="card-box stack" key={i}>
          <div className="row">
            <input type="text" aria-label="Category name" placeholder="Category" value={cat.category} style={{ maxWidth: 240 }} onChange={(e) => upd(i, (c) => ({ ...c, category: e.target.value }))} />
            <span className="grow" />
            <button className="btn sm danger" onClick={() => write(cats.filter((_, x) => x !== i))}>Remove category</button>
          </div>
          <div className="chips">
            {cat.items.map((it, j) => (
              <span className="tool" key={`${it.image}-${j}`}>
                <img src={imgSrc(assets, it.image)} alt="" />
                {it.name}
                <button title="Remove" aria-label={`Remove ${it.name}`} onClick={() => upd(i, (c) => ({ ...c, items: c.items.filter((_, y) => y !== j) }))}><Icon n="x" /></button>
              </span>
            ))}
            <button className="btn sm" onClick={() => setPicking(i)}>+ Add icon</button>
          </div>
        </div>
      ))}
      <div className="row">
        <button className="btn sm" onClick={() => write([...cats, { category: `Category ${cats.length + 1}`, items: [] }])}>+ Add category</button>
      </div>
      {picking !== null && (
        <IconPicker onClose={() => setPicking(null)} onPick={(item) => { upd(picking, (c) => ({ ...c, items: [...c.items, item] })); setPicking(null); }} />
      )}
    </div>
  );
}

function IconPicker({ onPick, onClose }: { onPick: (item: { name: string; image: string }) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [all, setAll] = useState<Devicon[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    ref.current?.showModal();
    loadDevicons().then(setAll).catch(() => setFailed(true));
  }, []);

  const add = (n: string, file: string, u: string) => {
    addAssets({ [file]: { url: u } });
    onPick({ name: n, image: file });
  };
  const addCustom = () => {
    if (!name.trim() || !/^https:\/\//.test(url.trim())) return alert("Enter a name and an https:// image URL.");
    const ext = (url.match(/\.(svg|png|jpe?g|gif|webp)(\?|$)/i)?.[1] ?? "svg").toLowerCase();
    add(name.trim(), `assets/img/${slug(name)}.${ext}`, url.trim());
  };
  const list = all ? searchDevicons(all, q) : [];

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <div className="dlg-head"><b>Pick an icon</b><button className="btn sm" onClick={() => ref.current?.close()}>Close</button></div>
      <div className="dlg-body">
        <input type="search" autoFocus placeholder="Search devicon (python, docker, react…)" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="pk-grid">
          {list.map((d) => (
            <button key={d.name} type="button" title={d.name} onClick={() => add(d.name.replace(/^./, (c) => c.toUpperCase()), `assets/img/${slug(d.name)}.svg`, deviconUrl(d))}>
              <img src={deviconUrl(d)} loading="lazy" alt="" />
              {d.name}
            </button>
          ))}
          {!all && !failed && <span className="log">Loading icons…</span>}
          {failed && <span className="log bad">Icons could not be loaded. Add your own image below.</span>}
          {all && !list.length && <span className="log">No icon matches.</span>}
        </div>
        <div className="card-box stack">
          <b>Or use your own image</b>
          <div className="row">
            <input type="text" placeholder="Name" style={{ flex: "1 1 120px", width: "auto" }} value={name} onChange={(e) => setName(e.target.value)} />
            <input type="text" placeholder="https://…/logo.svg" style={{ flex: "2 1 220px", width: "auto" }} value={url} onChange={(e) => setUrl(e.target.value)} />
            <button className="btn sm" onClick={addCustom}>Add</button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
