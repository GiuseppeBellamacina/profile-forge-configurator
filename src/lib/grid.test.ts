import { describe, expect, it } from "vitest";
import { normalize, sectionBoxes, summarize } from "../core";
import { demoProfile } from "./demo";
import { dropOrder, gridOf, heightFor, itemsOf, itemsFromLayout, pack, spanFor } from "./grid";

const items = itemsOf([
  { section: "header" }, { section: "stats", cols: 3 }, { section: "trophies", cols: 3 }, { section: "heatmap", cols: 3 },
  { section: "languages", cols: 4 }, { section: "streak", cols: 3 }, { section: "about", cols: 2 },
]);

describe("grid packing", () => {
  const k = normalize({ grid: gridOf(items), about: ["Hello there"] });
  const { boxes, height } = sectionBoxes(summarize(demoProfile(), k), { k });
  const heightOf = (id: string) => boxes.find((b) => b.id === id)?.minH;

  it("matches the renderer exactly", () => {
    const mine = pack(items, heightOf);
    expect(mine.map(({ id, x, y, w, h }) => ({ id, x, y, w, h }))).toEqual(boxes.map(({ id, x, y, w, h }) => ({ id, x, y, w, h })));
    expect(height).toBe(Math.max(...boxes.map((b) => b.y + b.h)) + 28);
  });

  it("dropping a widget near a spot puts it there", () => {
    const heat = boxes.find((b) => b.id === "heatmap")!;
    // drag "about" to the heatmap's position: it takes a place at or before the heatmap in the order
    const order = dropOrder(items, "about", { x: heat.x + 10, y: heat.y + 10 }, heightOf);
    const at = pack(order, heightOf).find((p) => p.id === "about")!;
    expect(Math.abs(at.y - heat.y)).toBeLessThan(heat.h);
  });

  it("resize snaps to columns and respects the minimum", () => {
    expect(spanFor("about", 30, 30 + 300 + 5)).toBe(2);
    expect(spanFor("about", 30, 30 + 940)).toBe(6);
    expect(spanFor("stats", 30, 40)).toBe(3);
  });

  it("rows convert to a grid", () => {
    expect(itemsFromLayout(["header", ["about", "workingOn"], "stats", "trophies"], false)).toEqual([
      { id: "header", span: 6 }, { id: "about", span: 3 }, { id: "workingOn", span: 3 }, { id: "stats", span: 3 }, { id: "trophies", span: 6 },
    ]);
  });

  it("a taller card matches the renderer and snaps back to auto", () => {
    const tall = items.map((i) => (i.id === "stats" ? { ...i, height: 400 } : i));
    const k2 = normalize({ grid: gridOf(tall), about: ["Hello there"] });
    const r2 = sectionBoxes(summarize(demoProfile(), k2), { k: k2 }).boxes;
    expect(pack(tall, heightOf).map(({ id, y, h }) => ({ id, y, h }))).toEqual(r2.map(({ id, y, h }) => ({ id, y, h })));
    expect(r2.find((b) => b.id === "stats")!.h).toBe(400);
    expect(heightFor(200, 100, 100 + 203)).toBeUndefined();
    expect(heightFor(200, 100, 100 + 347)).toBe(350);
  });
});
