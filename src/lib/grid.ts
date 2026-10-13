// The free grid: pure helpers shared by the editor. The geometry mirrors profile-forge's renderer (src/render.js);
// a unit test keeps the two in step.
import { MIN_SPAN, SECTIONS, type Raw } from "../core";

export const COLS = 6;
export const GUTTER = 20;
export const COL_W = 140;
export const X0 = 30;
export const CARD_W = 1000;
export const STEP = COL_W + GUTTER;
export const TOP_PAD = 30; // the renderer moves everything down when no header sits at the top
export const spanWidth = (n: number) => n * COL_W + (n - 1) * GUTTER;

export type Item = { id: string; span: number; height?: number };
export type Placed = Item & { x: number; y: number; w: number; h: number };

/** Config value -> items. */
export const itemsOf = (grid: Raw[] | undefined): Item[] =>
  (grid ?? []).map((g) => ({ id: g.section as string, span: Math.max(g.cols ?? (g.section === "header" ? 6 : 3), MIN_SPAN[g.section] ?? 1), ...(g.height ? { height: g.height as number } : {}) }));
/** Items -> config value. */
export const gridOf = (items: Item[]): Raw[] => items.map(({ id, span, height }) => ({ section: id, cols: span, ...(height ? { height } : {}) }));

/** Skyline packing, exactly like the renderer: each item goes to the lowest free spot, leftmost on a tie. Items without a height (empty sections) are skipped. */
export function pack(items: Item[], heightOf: (id: string) => number | undefined): Placed[] {
  // heightOf is the height the content needs; an item may ask for a taller card
  const heights = Array(COLS).fill(0);
  const out: Placed[] = [];
  for (const { id, span, height } of items) {
    const natural = heightOf(id);
    if (natural === undefined) continue;
    const h = Math.max(natural, height ?? 0);
    let best = 0;
    let bestY = Infinity;
    for (let c = 0; c + span <= COLS; c++) {
      const top = Math.max(...heights.slice(c, c + span));
      if (top < bestY) (bestY = top, best = c);
    }
    for (let i = best; i < best + span; i++) heights[i] = bestY + h + GUTTER;
    out.push({ id, span, x: X0 + best * STEP, y: bestY, w: spanWidth(span), h });
  }
  const lift = out.length && !out.some((p) => p.id === "header" && p.y === 0) ? TOP_PAD : 0;
  return out.map((p) => ({ ...p, y: p.y + lift }));
}

/** Rows layout -> grid items: pairs share the row, the sections that are half width by nature keep their size. */
export function itemsFromLayout(layout: (string | string[])[], languagesIsChart: boolean): Item[] {
  const natural = (id: string) => id === "stats" || id === "streak" || (id === "languages" && languagesIsChart);
  return layout.flatMap((row) => {
    const r = Array.isArray(row) ? row : [row];
    return r.map((id) => ({ id, span: r.length === 2 || natural(id) ? 3 : 6 }));
  });
}

/**
 * Where to put `id` so that it lands closest to `target` (a point on the card, the centre of the dragged widget):
 * try every position in the order, pack, and keep the one whose result is nearest. Returns the new order.
 */
export function dropOrder(items: Item[], id: string, target: { x: number; y: number }, heightOf: (id: string) => number | undefined): Item[] {
  const me = items.find((i) => i.id === id)!;
  const rest = items.filter((i) => i.id !== id);
  let best = items;
  let bestD = Infinity;
  for (let at = 0; at <= rest.length; at++) {
    const order = [...rest.slice(0, at), me, ...rest.slice(at)];
    const box = pack(order, heightOf).find((p) => p.id === id);
    if (!box) continue;
    const dist = Math.hypot(box.x + box.w / 2 - target.x, box.y + box.h / 2 - target.y);
    if (dist < bestD - 0.01) (bestD = dist, best = order);
  }
  return best;
}

/** Width in columns for a right-edge drag: the pointer x (card pixels) against the widget's left edge. */
export const spanFor = (id: string, left: number, pointerX: number) =>
  Math.min(COLS, Math.max(MIN_SPAN[id] ?? 1, Math.round((pointerX - left + GUTTER) / STEP)));

// Heights come in whole rows of 80px with the same 20px gutter as the columns (1 row = 80, 2 = 180, 3 = 280, ...),
// so cards in neighbouring columns can line up. "Auto" is the height of the content.
export const ROW_H = 80;
export const MAX_ROWS = 12;
export const rowsHeight = (n: number) => n * ROW_H + (n - 1) * GUTTER;
/** The heights a card can take, above what its content needs (that one is "auto"). */
export const heightSteps = (natural: number) => Array.from({ length: MAX_ROWS }, (_, i) => i + 1).map((n) => ({ rows: n, height: rowsHeight(n) })).filter((s) => s.height > natural + 2);
/** Card height for a bottom-edge drag: the nearest step; undefined (auto) when the content height is the nearest. */
export const heightFor = (natural: number, top: number, pointerY: number): number | undefined => {
  const h = pointerY - top;
  let best: number | undefined;
  let bestD = Math.abs(h - natural);
  for (const s of heightSteps(natural)) {
    const d = Math.abs(h - s.height);
    if (d < bestD) (bestD = d, best = s.height);
  }
  return best;
};

export const unused = (items: Item[]) => SECTIONS.filter((s) => !items.some((i) => i.id === s));

export const NAMES: Record<string, string> = {
  header: "Header", about: "About me", workingOn: "Working on", stats: "Stats", streak: "Streak",
  languages: "Languages", trophies: "Trophies", heatmap: "Heatmap", techStack: "Tech stack",
};
export const sectionLabel = (id: string) => NAMES[id] ?? id;
