import { useState } from "react";
import { DEFAULTS, SECTIONS } from "../../core";
import { clone } from "../../lib/path";
import { resetPath, setVal, useRaw } from "../../store/config";

type Row = string | string[];
const NAMES: Record<string, string> = {
  header: "Header", about: "About me", workingOn: "Working on", stats: "Stats", streak: "Streak",
  languages: "Languages", trophies: "Trophies", heatmap: "Heatmap", techStack: "Tech stack",
};
const label = (s: string) => NAMES[s] ?? s;

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
              {SECTIONS.map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </select>
          );
          return (
            <div
              key={i}
              className={`item${drag === i ? " dragging" : ""}${over === i && drag !== i ? " over" : ""}`}
              draggable={drag === i}
              onDragEnd={() => (setDrag(null), setOver(null))}
              onDragOver={(e) => { if (drag !== null) (e.preventDefault(), setOver(i)); }}
              onDrop={(e) => { e.preventDefault(); if (drag !== null) move(drag, i); setDrag(null); setOver(null); }}
            >
              <span className="grip" title="Drag to reorder" onMouseDown={() => setDrag(i)} onMouseUp={() => setDrag(null)}>⋮⋮</span>
              <span className="num">{i + 1}</span>
              {pick(0)}
              {c[1] ? (
                <>
                  {pick(1)}
                  <button className="btn sm" title="Back to a single column" onClick={() => replace(i, c[0])}>−</button>
                </>
              ) : (
                <button className="btn sm" title="Add a second section in this row (half width)" onClick={() => replace(i, [c[0], free[0] ?? "stats"])}>+ side by side</button>
              )}
              <span className="grow" />
              <button className="btn sm icon" disabled={i === 0} aria-label="Move up" onClick={() => move(i, i - 1)}>↑</button>
              <button className="btn sm icon" disabled={i === rows.length - 1} aria-label="Move down" onClick={() => move(i, i + 1)}>↓</button>
              <button className="btn sm icon danger" aria-label="Remove row" onClick={() => commit(rows.filter((_, x) => x !== i))}>✕</button>
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
              <button key={s} className="chip" onClick={() => commit([...rows, s])}>+ {label(s)}</button>
            ))}
          </>
        )}
        <span className="grow" />
        <button className="btn sm ghost" onClick={() => resetPath("layout")}>Reset order</button>
      </div>
      <p className="hint">Half-width sections (stats, streak, and languages as donut / pie) can share a row; a half-width section on its own is centered.</p>
    </div>
  );
}
