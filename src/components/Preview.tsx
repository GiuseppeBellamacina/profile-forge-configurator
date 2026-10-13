import { useEffect, useState } from "react";
import { usePreview } from "../hooks/usePreview";
import { configJson } from "../lib/publish";
import { useRaw } from "../store/config";
import { useSession } from "../store/session";
import { uiStore, useUi } from "../store/ui";
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
  const [replay, setReplay] = useState(0);
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
        <button className="btn sm" title="Replay the animation" onClick={() => setReplay((n) => n + 1)}>
          <Icon n="replay" /> Replay
        </button>
      </div>
      {pv.error && <div className="pv-error">{pv.error}</div>}
      {!pv.error && pv.missing.length > 0 && <div className="pv-error">Could not load icons: {pv.missing.join(", ")}</div>}
      <div className={`stage ${pv.light ? "light" : ""}`} onClick={() => matchMedia("(max-width: 980px)").matches && !open && uiStore.set({ sheetOpen: true })}>
        {pv.url && <img key={replay} src={pv.url} alt="Card preview" />}
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
