import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
export type View = { s: number; x: number; y: number };
const HOME: View = { s: 1, x: 0, y: 0 };
export const clampZoom = (s: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s));

/** The new view after zooming to `s2` while the point `c` (stage coordinates, relative to the card's own top-left) stays put. */
export function zoomAt(v: View, s2: number, c: { x: number; y: number }): View {
  const s = clampZoom(s2);
  const k = s / v.s;
  return { s, x: c.x - (c.x - v.x) * k, y: c.y - (c.y - v.y) * k };
}

/**
 * Zoom and pan of the card preview: the wheel zooms around the pointer, dragging an empty spot pans, double click resets.
 * `stage` is the viewport, `card` the element that is moved and scaled (transform-origin 0 0).
 */
export function useZoomPan(stage: RefObject<HTMLElement>, card: RefObject<HTMLElement>) {
  const [view, setView] = useState<View>(HOME);
  const touched = useRef(false); // once the user zooms or pans, the view is theirs and is no longer re-fitted

  // the card's natural position inside the stage, which a transform does not change
  const origin = () => {
    const c = card.current;
    return { x: c?.offsetLeft ?? 0, y: c?.offsetTop ?? 0 };
  };
  const at = (clientX: number, clientY: number) => {
    const r = stage.current!.getBoundingClientRect();
    const o = origin();
    return { x: clientX - r.left - o.x, y: clientY - r.top - o.y };
  };

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      touched.current = true;
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      setView((v) => zoomAt(v, v.s * factor, at(e.clientX, e.clientY)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [stage]);

  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // widgets of the grid editor and the art handles keep their own drag
    if ((e.target as HTMLElement).closest(".gbox,.ghandle,.gvhandle,.dbox,button,a,input,select,summary")) return;
    touched.current = true;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  }, []);
  const end = useCallback(() => { drag.current = null; }, []);

  /** The whole card visible: scaled down if it is taller or wider than the stage, never above 100%. */
  const fit = useCallback(() => {
    const el = stage.current;
    const c = card.current;
    if (!el || !c || !c.offsetWidth) return;
    const pad = 16;
    const s = clampZoom(Math.min(1, (el.clientWidth - pad * 2) / c.offsetWidth, (el.clientHeight - pad * 2) / c.offsetHeight));
    setView({ s, x: (el.clientWidth - pad * 2 - c.offsetWidth * s) / 2, y: 0 });
  }, [stage, card]);

  const zoomBy = (factor: number) => {
    touched.current = true;
    const r = stage.current?.getBoundingClientRect();
    if (r) setView((v) => zoomAt(v, v.s * factor, at(r.left + r.width / 2, r.top + r.height / 2)));
  };
  return {
    view,
    reset: () => { touched.current = false; fit(); },
    fit,
    touched,
    zoomIn: () => zoomBy(1.25),
    zoomOut: () => zoomBy(1 / 1.25),
    handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end, onDoubleClick: () => { touched.current = false; fit(); } },
    style: { transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` },
    percent: Math.round(view.s * 100),
    moved: true,
  };
}
