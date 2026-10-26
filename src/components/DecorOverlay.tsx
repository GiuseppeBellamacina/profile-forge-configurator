import { useEffect, useRef, useState } from "react";
import { MOTIFS, resolveTheme } from "../core";
import { imgSrc } from "../lib/assets";
import { edit, themeSlots, useAssets, useRaw } from "../store/config";
import { uiStore } from "../store/ui";

const CARD_W = 1000; // the card is always 1000 wide: x, y and size are percents of it
type Piece = { motif?: string; image?: string; text?: string; x?: number; y?: number; anchor?: string; size?: number; rotate?: number; opacity?: number; color?: string; color2?: string; flip?: boolean };

/**
 * Handles over the art of the card: drag one with the mouse to move it.
 * The card is not drawn again while the mouse moves (that is what made it slow): when the drag starts the card is drawn once without
 * that piece and with the sections faded (so the art behind them can be seen), a copy of the piece follows the mouse, and the new
 * position is written when the mouse is released. Positions are percents of the card width, from the top or the bottom as anchored.
 */
export function DecorOverlay({ pieces, height }: { pieces: Piece[]; height: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const raw = useRaw();
  const assets = useAssets();
  const [drag, setDrag] = useState<{ i: number; dx: number; dy: number; x: number; y: number } | null>(null); // dx, dy: the grab point from the centre; x, y: where the piece is now
  const first = Object.values(themeSlots(raw))[0] ?? "dark";
  let accent = "#5b8cff", accent2 = "#9aa4b5";
  try { const c = resolveTheme(first) as Record<string, string>; accent = c.accent; accent2 = c.accent2; } catch { /* unknown theme while editing */ }

  // never leave the card faded: whatever ends the drag (a release outside the window, another step, a closed panel), it ends here
  const end = () => { setDrag(null); uiStore.set({ dragArt: null }); };
  useEffect(() => {
    addEventListener("pointerup", end);
    addEventListener("pointercancel", end);
    return () => { removeEventListener("pointerup", end); removeEventListener("pointercancel", end); end(); };
  }, []);

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
        const moving = drag?.i === i;
        const x = moving ? drag.x : p.x ?? 50;
        const y = moving ? drag.y : p.y ?? 20;
        const size = p.size ?? 20;
        const top = p.anchor === "bottom" ? heightPct - y : y; // the centre, from the top, in percents of the width
        const a = p.color ? `#${p.color}` : accent2, b = p.color2 ? `#${p.color2}` : accent;
        const look = { opacity: p.opacity ?? 0.5, transform: `rotate(${p.rotate ?? 0}deg) scaleX(${p.flip ? -1 : 1})` };
        return (
          <div
            key={i}
            className={`dbox${moving ? " moving" : ""}`}
            title={p.text ?? p.motif ?? p.image?.split("/").pop()}
            style={{ left: `${x}%`, top: `${(top / heightPct) * 100}%`, width: `${size}%`, height: `${(size / heightPct) * 100}%` }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              const q = toPct(e);
              const px = p.x ?? 50, py = p.y ?? 20;
              setDrag({ i, dx: q.x - px, dy: (p.anchor === "bottom" ? q.down : q.y) - py, x: px, y: py });
              uiStore.set({ dragArt: i });
            }}
            onPointerMove={(e) => {
              if (!moving) return;
              const q = toPct(e);
              setDrag({ ...drag, x: clamp(round(q.x - drag.dx), -20, 120), y: clamp(round((p.anchor === "bottom" ? q.down : q.y) - drag.dy), -10, 120) });
            }}
            onPointerUp={() => {
              if (moving) edit((r) => { Object.assign(r.card.decor[i], { x: drag.x, y: drag.y }); }, `decor-${i}-drag`);
              end();
            }}
            onLostPointerCapture={() => moving && end()}
          >
            {moving && (p.text !== undefined
              ? <svg viewBox="0 0 100 100" style={look}><text x="50" y="68" textAnchor="middle" fontSize={Math.min(64, Math.round(165 / Math.max(3, p.text.length)))} fontWeight="800" fill={p.color ? `#${p.color}` : accent} stroke={p.color2 ? `#${p.color2}` : "#14141c"} strokeWidth="6" paintOrder="stroke">{p.text}</text></svg>
              : p.motif
              ? <svg viewBox="0 0 100 100" style={look} dangerouslySetInnerHTML={{ __html: MOTIFS[p.motif](a, b) }} />
              : <img src={imgSrc(assets, p.image ?? "")} alt="" style={{ ...look, width: "100%", height: "100%", objectFit: "contain" }} />)}
            <span className="dname">{p.text ?? p.motif ?? p.image?.split("/").pop()}</span>
          </div>
        );
      })}
    </div>
  );
}
