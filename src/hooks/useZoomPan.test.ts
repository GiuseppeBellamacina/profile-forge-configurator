import { describe, expect, it } from "vitest";
import { clampZoom, MAX_ZOOM, MIN_ZOOM, zoomAt } from "./useZoomPan";

describe("zoomAt", () => {
  it("keeps the point under the cursor where it was", () => {
    const v = { s: 1, x: 40, y: -20 };
    const c = { x: 300, y: 200 };
    const next = zoomAt(v, 2, c);
    // the card-local point under the cursor before and after
    const local = (view: typeof v) => ({ x: (c.x - view.x) / view.s, y: (c.y - view.y) / view.s });
    expect(local(next).x).toBeCloseTo(local(v).x);
    expect(local(next).y).toBeCloseTo(local(v).y);
    expect(next.s).toBe(2);
  });
  it("stays within the zoom limits", () => {
    expect(zoomAt({ s: 1, x: 0, y: 0 }, 99, { x: 0, y: 0 }).s).toBe(MAX_ZOOM);
    expect(zoomAt({ s: 1, x: 0, y: 0 }, 0.001, { x: 0, y: 0 }).s).toBe(MIN_ZOOM);
    expect(clampZoom(1.5)).toBe(1.5);
  });
  it("zooming out and back in returns to the same view", () => {
    const v = { s: 1, x: 10, y: 15 };
    const c = { x: 123, y: 77 };
    const back = zoomAt(zoomAt(v, 0.5, c), 1, c);
    expect(back.x).toBeCloseTo(v.x);
    expect(back.y).toBeCloseTo(v.y);
  });
});
