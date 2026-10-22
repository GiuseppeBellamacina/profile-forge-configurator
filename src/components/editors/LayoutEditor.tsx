import { useState } from "react";
import { DEFAULTS, SECTIONS } from "../../core";
import { clone } from "../../lib/path";
import { resetPath, setVal, useRaw } from "../../store/config";
import { Icon } from "../ui/Icon";

type Row = string | string[];
const NAMES: Record<string, string> = {
  header: "Header", about: "About me", workingOn: "Working on", stats: "Stats", streak: "Streak",
  languages: "Languages", trophies: "Trophies", heatmap: "Heatmap", techStack: "Tech stack",
  terminal: "Terminal", rhythm: "Rhythm", orgs: "Contributed to",
};
const label = (s: string) => NAMES[s] ?? s;
// Any two sections can share a row at half width, except the header (which always spans the card).
const PAIRABLE = SECTIONS.filter((s) => s !== "header");

/** Section order. Drag a row by its handle (mouse) or use the arrows (touch). A row can hold two half-width sections. */
export function LayoutEditor() {
  const raw = useRaw();
  const rows: Row[] = raw.layout ?? clone(DEFAULTS.layout);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const used = new Set(rows.flat());
  const free = SECTIONS.filter((s) => !used.has(s));
  const commit = (next: Row[]) => setVal("layout", next);
  const cells = (row: Row) => (Array.isArray(row) ? row : [row]);
  // Put section `id` next to row i's section: it leaves the row it was in (that row shrinks or disappears).
  const beside = (i: number, id: string) => {
    const first = cells(rows[i])[0];
    const next = rows
      .map((r, x) => (x === i ? [first, id] : cells(r).filter((y) => y !== id)))
      .filter((r) => r.length)
      .map((r) => (r.length === 1 ? r[0] : r));
    commit(next);
  };
  const replace = (i: number, row: Row) => commit(rows.map((r, x) => (x === i ? row : r)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length || from === to) return;
    const next = [...rows];
    next.splice(to, 0, next.splice(from, 1)[0]);
    commit(next);
  };

  return (
    <div className="stack">
      <div className="list">
        {rows.map((row, i) => {
          const c = cells(row);
          const pick = (j: number) => (
            <select className="lay-chip" aria-label={`Section ${j + 1} of row ${i + 1}`} style={{ width: "auto" }} value={c[j]}
              onChange={(e) => { const n = [...c]; n[j] = e.target.value; replace(i, n.length === 1 ? n[0] : n); }}>
              {(c.length === 2 ? PAIRABLE : SECTIONS).map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </select>
          );
          return (
            <div
              key={i}
              className={`item${drag === i ? " dragging" : ""}${over === i && drag !== i ? " over" : ""}`}
              draggable={drag === i}
              onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
              onDragEnd={() => (setDrag(null), setOver(null))}
              onDragOver={(e) => { if (drag !== null) (e.preventDefault(), setOver(i)); }}
              onDrop={(e) => { e.preventDefault(); if (drag !== null) move(drag, i); setDrag(null); setOver(null); }}
            >
              <span className="grip" title="Drag to reorder" onMouseDown={() => setDrag(i)} onMouseUp={() => setDrag(null)}><Icon n="grip" /></span>
              <span className="num">{i + 1}</span>
              {pick(0)}
              {c[1] ? (
                <>
                  {pick(1)}
                  <button className="btn sm" title="Back to a single column" onClick={() => replace(i, c[0])}><Icon n="minus" /></button>
                </>
              ) : PAIRABLE.includes(c[0]) ? (
                <select className="lay-chip" aria-label={`Put a section next to ${label(c[0])}`} style={{ width: "auto" }} value="" onChange={(e) => e.target.value && beside(i, e.target.value)}>
                  <option value="">+ Put next to it…</option>
                  {PAIRABLE.filter((x) => x !== c[0] && !used.has(x)).length > 0 && (
                    <optgroup label="Not in the card yet">
                      {PAIRABLE.filter((x) => x !== c[0] && !used.has(x)).map((x) => <option key={x} value={x}>{label(x)}</option>)}
                    </optgroup>
                  )}
                  <optgroup label="Move from another row">
                    {rows.flatMap((r, ri) => (ri === i ? [] : cells(r).filter((x) => PAIRABLE.includes(x) && x !== c[0]))).map((x) => <option key={x} value={x}>{label(x)}</option>)}
                  </optgroup>
                </select>
              ) : null}
              <span className="grow" />
              <button className="btn sm icon" disabled={i === 0} aria-label="Move up" onClick={() => move(i, i - 1)}><Icon n="up" /></button>
              <button className="btn sm icon" disabled={i === rows.length - 1} aria-label="Move down" onClick={() => move(i, i + 1)}><Icon n="down" /></button>
              <button className="btn sm icon danger" aria-label="Remove row" onClick={() => commit(rows.filter((_, x) => x !== i))}><Icon n="x" /></button>
            </div>
          );
        })}
      </div>
      {!rows.length && <div className="empty">The card would be empty. Add a section.</div>}
      <div className="row">
        {free.length > 0 && (
          <>
            <span className="hint">Add:</span>
            {free.map((s) => (
              <button key={s} className="chip" onClick={() => commit([...rows, s])}><Icon n="plus" /> {label(s)}</button>
            ))}
          </>
        )}
        <span className="grow" />
        <button className="btn sm ghost" onClick={() => resetPath("layout")}>Reset order</button>
      </div>
    </div>
  );
}
