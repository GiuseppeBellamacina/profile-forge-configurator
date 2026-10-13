import { DEFAULTS, MIN_SPAN, SECTIONS } from "../../core";
import { gridOf, itemsFromLayout, itemsOf, sectionLabel, unused, type Item } from "../../lib/grid";
import { clone } from "../../lib/path";
import { edit, useRaw } from "../../store/config";
import { Icon } from "../ui/Icon";

const commit = (next: Item[]) => edit((r) => { r.grid = gridOf(next); }, "grid");

/** The same arrangement as a list: width in columns, order, add and remove. The preview next to it has drag handles. */
export function GridEditor() {
  const raw = useRaw();
  const items = itemsOf(raw.grid);
  const free = unused(items);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    next.splice(to, 0, next.splice(from, 1)[0]);
    commit(next);
  };
  return (
    <div className="stack">
      <p className="hint">Drag a widget on the preview to move it, or drag its right edge to make it wider or narrower. Widgets fall to the lowest free spot, so a short one fills the gap next to a tall one.</p>
      <div className="list">
        {items.map((it, i) => (
          <div className="item" key={it.id}>
            <span className="num">{i + 1}</span>
            <b className="lay-chip" style={{ minWidth: 110 }}>{sectionLabel(it.id)}</b>
            {it.id === "header" ? (
              <span className="hint">full width</span>
            ) : (
              <label className="row" style={{ gap: 6 }}>
                <span className="hint">width</span>
                <select aria-label={`Width of ${sectionLabel(it.id)}`} style={{ width: "auto" }} value={it.span} onChange={(e) => commit(items.map((x) => (x.id === it.id ? { ...x, span: Number(e.target.value) } : x)))}>
                  {[1, 2, 3, 4, 5, 6].filter((n) => n >= (MIN_SPAN[it.id] ?? 1)).map((n) => <option key={n} value={n}>{n} / 6</option>)}
                </select>
              </label>
            )}
            <span className="grow" />
            <button className="btn sm icon" disabled={i === 0} aria-label="Move earlier" onClick={() => move(i, i - 1)}><Icon n="up" /></button>
            <button className="btn sm icon" disabled={i === items.length - 1} aria-label="Move later" onClick={() => move(i, i + 1)}><Icon n="down" /></button>
            <button className="btn sm icon danger" aria-label={`Remove ${sectionLabel(it.id)}`} onClick={() => commit(items.filter((x) => x.id !== it.id))}><Icon n="x" /></button>
          </div>
        ))}
      </div>
      {!items.length && <div className="empty">The card would be empty. Add a section.</div>}
      <div className="row">
        {free.length > 0 && <span className="hint">Add:</span>}
        {free.map((s) => (
          <button key={s} className="chip" onClick={() => commit([...items, { id: s, span: s === "header" ? 6 : Math.max(3, MIN_SPAN[s]) }])}><Icon n="plus" /> {sectionLabel(s)}</button>
        ))}
        <span className="grow" />
        <button className="btn sm ghost" onClick={() => edit((r) => { delete r.grid; })}>Back to simple rows</button>
      </div>
    </div>
  );
}

/** Starts the free grid from the current rows layout. */
export function UseGrid() {
  const raw = useRaw();
  const start = () => {
    const hidden = new Set<string>(raw.hideSections ?? []);
    const layout = (clone(raw.layout ?? DEFAULTS.layout) as (string | string[])[])
      .map((r) => (Array.isArray(r) ? r.filter((s) => !hidden.has(s)) : hidden.has(r) ? [] : r))
      .filter((r) => (Array.isArray(r) ? r.length : true));
    const chart = ["donut", "donut-vertical", "pie"].includes(raw.languages?.layout);
    commit(itemsFromLayout(layout, chart).filter((i) => SECTIONS.includes(i.id)));
  };
  return (
    <div className="hint-box">
      <b>Want to place and resize sections by hand?</b>
      <p style={{ margin: "6px 0 10px" }}>The free grid lets you drag sections around the card and give each one its own width, like widgets on a phone. Your current layout is converted (you can undo or go back).</p>
      <button className="btn primary" onClick={start}>Use the free grid</button>
    </div>
  );
}
