import { useRef, useState } from "react";
import { edit } from "../store/config";
import { uiStore } from "../store/ui";

const CARD_W = 1000; // the card is always 1000 wide: x, y and size are percents of it
type Piece = { motif?: string; image?: string; x?: number; y?: number; anchor?: string; size?: number };

/**
 * Handles over the art of the card: drag one with the mouse to move it. While dragging, the sections fade away (the preview is
 * rendered with `ghost`) so the art behind them can be seen and placed. Positions are written as percents of the card width,
 * from the top or from the bottom as the piece is anchored.
 */
export function DecorOverlay({ pieces, height }: { pieces: Piece[]; height: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ i: number; dx: number; dy: number } | null>(null); // dx, dy: the grab point from the centre of the piece, in percents of the width

  const toPct = (e: React.PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.width) * 100, down: ((r.bottom - e.clientY) / r.width) * 100 };
  };
  const round = (n: number) => Math.round(n * 2) / 2;
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
  const heightPct = (height / CARD_W) * 100; // the card height in percents of its width

  return (
    <div ref={wrap} className="decor-overlay" aria-label="Drag a piece of art to move it">
      {pieces.map((p, i) => {
        const x = p.x ?? 50, y = p.y ?? 20, size = p.size ?? 20;
        const top = p.anchor === "bottom" ? heightPct - y : y; // the centre, from the top, in percents of the width
        return (
          <div
            key={i}
            className={`dbox${drag?.i === i ? " moving" : ""}`}
            title={p.motif ?? p.image?.split("/").pop()}
            style={{ left: `${x}%`, top: `${(top / heightPct) * 100}%`, width: `${size}%`, height: `${(size / heightPct) * 100}%` }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              const q = toPct(e);
              setDrag({ i, dx: q.x - x, dy: p.anchor === "bottom" ? q.down - y : q.y - y });
              uiStore.set({ dragArt: true });
            }}
            onPointerMove={(e) => {
              if (drag?.i !== i) return;
              const q = toPct(e);
              const nx = clamp(round(q.x - drag.dx), -20, 120);
              const ny = clamp(round((p.anchor === "bottom" ? q.down : q.y) - drag.dy), -10, 120);
              edit((r) => { Object.assign(r.card.decor[i], { x: nx, y: ny }); }, `decor-${i}-drag`);
            }}
            onPointerUp={() => { setDrag(null); uiStore.set({ dragArt: false }); }}
            onPointerCancel={() => { setDrag(null); uiStore.set({ dragArt: false }); }}
          >
            <span className="dname">{p.motif ?? p.image?.split("/").pop()}</span>
          </div>
        );
      })}
    </div>
  );
}
