import { DEFAULTS, MIN_SPAN, SECTIONS } from "../../core";
import { gridOf, heightSteps, itemsFromLayout, itemsOf, sectionLabel, unused, type Item } from "../../lib/grid";
import { clone } from "../../lib/path";
import { edit, useRaw } from "../../store/config";
import { useUi } from "../../store/ui";
import { Icon } from "../ui/Icon";

const commit = (next: Item[]) => edit((r) => { r.grid = gridOf(next); }, "grid");

/** The same arrangement as a list: width in columns, order, add and remove. The preview next to it has drag handles. */
export function GridEditor() {
  const raw = useRaw();
  const items = itemsOf(raw.grid);
  const boxes = useUi((s) => s.boxes);
  const naturalOf = (id: string) => boxes.find((b) => b.id === id)?.minH ?? 0;
  const free = unused(items);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    next.splice(to, 0, next.splice(from, 1)[0]);
    commit(next);
  };
  return (
    <div className="stack">
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
            <label className="row" style={{ gap: 6 }}>
              <span className="hint">height</span>
              <select aria-label={`Height of ${sectionLabel(it.id)}`} style={{ width: "auto" }} value={it.height ?? 0}
                onChange={(e) => commit(items.map((x) => (x.id === it.id ? { id: x.id, span: x.span, ...(Number(e.target.value) ? { height: Number(e.target.value) } : {}) } : x)))}>
                <option value={0}>Auto</option>
                {it.height && !heightSteps(naturalOf(it.id)).some((s) => s.height === it.height) && <option value={it.height}>{it.height}px</option>}
                {heightSteps(naturalOf(it.id)).map((s) => <option key={s.rows} value={s.height}>{s.rows} {s.rows === 1 ? "row" : "rows"}</option>)}
              </select>
            </label>
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
    <div className="row">
      <button className="btn primary" onClick={start}>Arrange sections freely</button>
    </div>
  );
}
