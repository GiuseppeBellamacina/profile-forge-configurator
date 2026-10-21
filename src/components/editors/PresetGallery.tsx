import { useEffect, useState } from "react";
import { CORE } from "../../lib/assets";
import { replaceConfig, START } from "../../store/config";
import { clone } from "../../lib/path";
import { uiStore } from "../../store/ui";

const cap = (s: string) => s.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Ready-made configurations (profile-forge/presets/*.json) with the preview images from the docs. */
export function PresetGallery() {
  const [names, setNames] = useState<string[] | null>(null);
  const [v, setV] = useState(""); // changes at every sync, so new preview images are not served from the browser cache
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${CORE}manifest.json`, { cache: "no-cache" })
      .then((r) => r.json())
      .then((m) => (setV(m.version ?? ""), setNames(m.presets)))
      .catch(() => setNames([]));
  }, []);

  const load = async (name: string) => {
    try {
      const json = await (await fetch(`${CORE}presets/${name}.json?v=${v}`)).json();
      delete json.$schema;
      replaceConfig(json);
      uiStore.set({ refit: uiStore.get().refit + 1 });
      setMsg(`Loaded “${cap(name)}”. Tweak it in the next steps.`);
    } catch (e: any) {
      setMsg(`Could not load the preset: ${e.message}`);
    }
  };

  return (
    <div className="stack">
      {names === null && <div className="log">Loading presets…</div>}
      {names?.length === 0 && <div className="empty">Presets are unavailable offline.</div>}
      <div className="gallery">
        {names?.map((n) => (
          <button key={n} type="button" className="tile" onClick={() => load(n)} title={`Load the ${cap(n)} preset`}>
            <span className="thumb">
              <img loading="lazy" alt="" src={`${CORE}preset-previews/${n}-dark.png?v=${v}`} />
            </span>
            <span className="meta">
              <b>{cap(n)}</b>
            </span>
          </button>
        ))}
      </div>
      <div className="row">
        <button
          className="btn sm"
          onClick={() => {
            (replaceConfig(clone(START)), setMsg("Back to the defaults."));
          }}
        >
          Reset to defaults
        </button>
        {msg && <span className="log">{msg}</span>}
      </div>
    </div>
  );
}
