import { useRef, useState } from "react";
import type { Box } from "../core";
import { edit } from "../store/config";
import { CARD_W, dropOrder, gridOf, heightFor, pack, sectionLabel, spanFor, spanWidth, type Item } from "../lib/grid";

type Drag = { kind: "move"; id: string; from: { x: number; y: number }; dx: number; dy: number } | { kind: "size"; id: string; span: number }
  | { kind: "tall"; id: string; height: number | undefined };

/**
 * Handles drawn over the card preview: drag a widget to move it, drag its right edge to resize it (in columns).
 * Positions come from the renderer (sectionBoxes); the order and widths are written to config.grid.
 */
export function GridOverlay({ boxes, height, items }: { boxes: Box[]; height: number; items: Item[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const heightOf = (id: string) => boxes.find((b) => b.id === id)?.minH; // what the content needs; items may ask for taller
  const commit = (next: Item[]) => edit((r) => { r.grid = gridOf(next); }, "grid");

  const point = (e: React.PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * CARD_W) / r.width, y: ((e.clientY - r.top) * CARD_W) / r.width };
  };
  const pct = (b: { x: number; y: number; w: number; h: number }) => ({
    left: `${(b.x / CARD_W) * 100}%`, top: `${(b.y / height) * 100}%`, width: `${(b.w / CARD_W) * 100}%`, height: `${(b.h / height) * 100}%`,
  });

  // where the dragged widget would land if dropped now
  const ghost = (() => {
    if (!drag) return null;
    const b = boxes.find((x) => x.id === drag.id);
    if (!b) return null;
    if (drag.kind === "size") return { ...b, w: spanWidth(drag.span) };
    if (drag.kind === "tall") return { ...b, h: Math.max(b.minH, drag.height ?? 0) };
    const order = dropOrder(items, drag.id, { x: b.x + b.w / 2 + drag.dx, y: b.y + b.h / 2 + drag.dy }, heightOf);
    return pack(order, heightOf).find((p) => p.id === drag.id) ?? null;
  })();

  const finish = () => {
    if (drag && ghost) {
      if (drag.kind === "size") commit(items.map((i) => (i.id === drag.id ? { ...i, span: drag.span } : i)));
      else if (drag.kind === "tall") commit(items.map((i) => (i.id === drag.id ? { id: i.id, span: i.span, ...(drag.height ? { height: drag.height } : {}) } : i)));
      else if (Math.hypot(drag.dx, drag.dy) > 6) {
        const b = boxes.find((x) => x.id === drag.id)!;
        commit(dropOrder(items, drag.id, { x: b.x + b.w / 2 + drag.dx, y: b.y + b.h / 2 + drag.dy }, heightOf));
      }
    }
    setDrag(null);
  };

  return (
    <div ref={wrap} className="grid-overlay" aria-label="Drag a widget to move it, drag its right edge to resize it">
      {boxes.map((b) => {
        const moving = drag?.kind === "move" && drag.id === b.id;
        const shown = moving ? { ...b, x: b.x + drag.dx, y: b.y + drag.dy } : drag?.kind === "size" && drag.id === b.id ? { ...b, w: spanWidth(drag.span) } : drag?.kind === "tall" && drag.id === b.id ? { ...b, h: Math.max(b.minH, drag.height ?? 0) } : b;
        return (
          <div
            key={b.id}
            className={`gbox${moving ? " moving" : ""}`}
            style={pct(shown)}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest(".ghandle")) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              setDrag({ kind: "move", id: b.id, from: point(e), dx: 0, dy: 0 });
            }}
            onPointerMove={(e) => {
              if (drag?.kind === "move" && drag.id === b.id) {
                const p = point(e);
                setDrag({ ...drag, dx: p.x - drag.from.x, dy: p.y - drag.from.y });
              }
            }}
            onPointerUp={finish}
            onPointerCancel={() => setDrag(null)}
          >
            <span className="gname">{sectionLabel(b.id)}</span>
            <span
              className="gvhandle"
              title="Drag to change the height"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                setDrag({ kind: "tall", id: b.id, height: items.find((i) => i.id === b.id)?.height });
              }}
              onPointerMove={(e) => {
                if (drag?.kind === "tall" && drag.id === b.id) setDrag({ ...drag, height: heightFor(b.minH, b.y, point(e).y) });
              }}
              onPointerUp={(e) => { e.stopPropagation(); finish(); }}
            />
            {b.id !== "header" && (
              <span
                className="ghandle"
                title="Drag to resize"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setDrag({ kind: "size", id: b.id, span: items.find((i) => i.id === b.id)!.span });
                }}
                onPointerMove={(e) => {
                  if (drag?.kind === "size" && drag.id === b.id) setDrag({ ...drag, span: spanFor(b.id, b.x, point(e).x) });
                }}
                onPointerUp={(e) => { e.stopPropagation(); finish(); }}
              />
            )}
          </div>
        );
      })}
      {ghost && <div className="gghost" style={pct(ghost)} />}
    </div>
  );
}
