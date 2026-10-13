// The free grid: pure helpers shared by the editor. The geometry mirrors profile-forge's renderer (src/render.js);
// a unit test keeps the two in step.
import { MIN_SPAN, SECTIONS, type Raw } from "../core";

export const COLS = 6;
export const GUTTER = 20;
export const COL_W = 140;
export const X0 = 30;
export const CARD_W = 1000;
export const STEP = COL_W + GUTTER;
export const spanWidth = (n: number) => n * COL_W + (n - 1) * GUTTER;

export type Item = { id: string; span: number };
export type Placed = Item & { x: number; y: number; w: number; h: number };

/** Config value -> items. */
export const itemsOf = (grid: Raw[] | undefined): Item[] =>
  (grid ?? []).map((g) => ({ id: g.section as string, span: Math.max(g.cols ?? (g.section === "header" ? 6 : 3), MIN_SPAN[g.section] ?? 1) }));
/** Items -> config value. */
export const gridOf = (items: Item[]): Raw[] => items.map(({ id, span }) => ({ section: id, cols: span }));

/** Skyline packing, exactly like the renderer: each item goes to the lowest free spot, leftmost on a tie. Items without a height (empty sections) are skipped. */
export function pack(items: Item[], heightOf: (id: string) => number | undefined): Placed[] {
  const heights = Array(COLS).fill(0);
  const out: Placed[] = [];
  for (const { id, span } of items) {
    const h = heightOf(id);
    if (h === undefined) continue;
    let best = 0;
    let bestY = Infinity;
    for (let c = 0; c + span <= COLS; c++) {
      const top = Math.max(...heights.slice(c, c + span));
      if (top < bestY) (bestY = top, best = c);
    }
    for (let i = best; i < best + span; i++) heights[i] = bestY + h + GUTTER;
    out.push({ id, span, x: X0 + best * STEP, y: bestY, w: spanWidth(span), h });
  }
  return out;
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

export const unused = (items: Item[]) => SECTIONS.filter((s) => !items.some((i) => i.id === s));

export const NAMES: Record<string, string> = {
  header: "Header", about: "About me", workingOn: "Working on", stats: "Stats", streak: "Streak",
  languages: "Languages", trophies: "Trophies", heatmap: "Heatmap", techStack: "Tech stack",
};
export const sectionLabel = (id: string) => NAMES[id] ?? id;
