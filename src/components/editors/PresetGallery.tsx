import { useEffect, useState } from "react";
import { CORE } from "../../lib/assets";
import { replaceConfig, START } from "../../store/config";
import { clone } from "../../lib/path";

const cap = (s: string) => s.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Ready-made configurations (profile-forge/presets/*.json) with the preview images from the docs. */
export function PresetGallery() {
  const [names, setNames] = useState<string[] | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${CORE}manifest.json`)
      .then((r) => r.json())
      .then((m) => setNames(m.presets))
      .catch(() => setNames([]));
  }, []);

  const load = async (name: string) => {
    if (!confirm(`Replace your current configuration with the “${cap(name)}” preset? You can undo this.`)) return;
    try {
      const json = await (await fetch(`${CORE}presets/${name}.json`)).json();
      delete json.$schema;
      replaceConfig(json);
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
              <img loading="lazy" alt="" src={`${CORE}preset-previews/${n}-dark.png`} />
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
            if (confirm("Reset everything to the defaults? You can undo this.")) (replaceConfig(clone(START)), setMsg("Back to the defaults."));
          }}
        >
          Reset to defaults
        </button>
        {msg && <span className="log">{msg}</span>}
      </div>
    </div>
  );
}
