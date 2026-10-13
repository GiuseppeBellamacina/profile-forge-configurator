import { useEffect, useRef, useState } from "react";
import { usePreview } from "../hooks/usePreview";
import { useZoomPan } from "../hooks/useZoomPan";
import { configJson } from "../lib/publish";
import { useRaw } from "../store/config";
import { useSession } from "../store/session";
import { uiStore, useUi } from "../store/ui";
import { itemsOf } from "../lib/grid";
import { GridOverlay } from "./GridOverlay";
import { Icon } from "./ui/Icon";

const copy = async (text: string, setLabel: (s: string) => void, idle: string) => {
  await navigator.clipboard?.writeText(text);
  setLabel("Copied ✓");
  setTimeout(() => setLabel(idle), 1500);
};

export function Preview() {
  const pv = usePreview();
  const raw = useRaw();
  const source = useSession((s) => s.source);
  const open = useUi((s) => s.sheetOpen);
  const step = useUi((s) => s.step);
  const [replay, setReplay] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const zoom = useZoomPan(stage, card);
  // until the user takes over, keep the whole card in view while it changes size
  useEffect(() => { if (!zoom.touched.current) requestAnimationFrame(zoom.fit); }, [pv.url, pv.height, zoom.fit]);
  const [copyLabel, setCopyLabel] = useState("Copy");
  const json = configJson(raw);

  useEffect(() => {
    document.body.classList.toggle("noscroll", open && matchMedia("(max-width: 980px)").matches);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && uiStore.set({ sheetOpen: false });
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open]);

  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    a.download = "config.json";
    a.click();
  };

  return (
    <aside className={`preview-pane${open ? " open" : ""}`} aria-label="Live preview">
      <button className="handle" aria-expanded={open} onClick={() => uiStore.set({ sheetOpen: !open })}>
        <span className="gr" />
        {open ? "Close preview" : "Live preview · tap to enlarge"}
        {pv.busy && <span className="status">rendering…</span>}
      </button>
      <div className="pv-bar">
        {pv.slots.length > 1 && (
          <div className="seg" role="group" aria-label="Theme slot">
            {pv.slots.map((s) => (
              <button key={s} aria-pressed={s === pv.slot} onClick={() => uiStore.set({ slot: s })}>
                {s}
              </button>
            ))}
          </div>
        )}
        <span className="status" title="Where the numbers come from">{source}</span>
        <span className="grow" />
        <div className="zoom" role="group" aria-label="Zoom">
          <button className="btn sm icon" aria-label="Zoom out" onClick={zoom.zoomOut}><Icon n="minus" /></button>
          <button className="btn sm zoom-val" title="Fit the card (or double click it)" onClick={zoom.reset}>{zoom.percent}%</button>
          <button className="btn sm icon" aria-label="Zoom in" onClick={zoom.zoomIn}><Icon n="plus" /></button>
        </div>
        <button className="btn sm" title="Replay the animation" onClick={() => setReplay((n) => n + 1)}>
          <Icon n="replay" /> Replay
        </button>
      </div>
      {pv.error && <div className="pv-error">{pv.error}</div>}
      {!pv.error && pv.missing.length > 0 && <div className="pv-error">Could not load icons: {pv.missing.join(", ")}</div>}
      <div ref={stage} className={`stage ${pv.light ? "light" : ""}`} {...zoom.handlers} onClick={() => matchMedia("(max-width: 980px)").matches && !open && uiStore.set({ sheetOpen: true })}>
        {pv.url && (
          <div ref={card} className="card-wrap" style={zoom.style}>
            <img key={replay} src={pv.url} alt="Card preview" />
            {step === "layout" && Array.isArray(raw.grid) && pv.boxes.length > 0 && <GridOverlay boxes={pv.boxes} height={pv.height} items={itemsOf(raw.grid)} />}
          </div>
        )}
        <span className={`busy${pv.busy ? " on" : ""}`}>Rendering…</span>
      </div>
      <details className="json-drawer">
        <summary>config.json</summary>
        <div className="body">
          <div className="row">
            <button className="btn sm" onClick={() => copy(json, setCopyLabel, "Copy")}>{copyLabel}</button>
            <button className="btn sm" onClick={download}>Download</button>
          </div>
          <pre>{json}</pre>
        </div>
      </details>
    </aside>
  );
}
