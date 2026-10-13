import { useRef, useState } from "react";
import { clone } from "../../lib/path";
import { configJson } from "../../lib/publish";
import { encodeShare } from "../../lib/share";
import { configStore, replaceConfig, validate } from "../../store/config";

export const shareUrl = async () => {
  const { raw, assets } = configStore.get();
  const a = Object.fromEntries(Object.entries(assets).filter(([, v]) => /^https:\/\//.test(v.url)));
  return `${location.origin}${location.pathname}#c=${await encodeShare({ c: raw, a })}`;
};

export function ImportExport() {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [shareLabel, setShareLabel] = useState("Copy share link");
  const file = useRef<HTMLInputElement>(null);

  const apply = (src: string) => {
    try {
      const j = JSON.parse(src);
      delete j.$schema;
      validate(clone(j));
      replaceConfig(j);
      setMsg({ ok: true, text: "Imported." });
      setText("");
    } catch (e: any) {
      setMsg({ ok: false, text: `Not a valid profile-forge config: ${e.message}` });
    }
  };

  const share = async () => {
    await navigator.clipboard?.writeText(await shareUrl());
    setShareLabel("Link copied ✓");
    setTimeout(() => setShareLabel("Copy share link"), 1800);
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([configJson(configStore.get().raw)], { type: "application/json" }));
    a.download = "config.json";
    a.click();
  };

  return (
    <div className="stack">
      <div className="row">
        <button className="btn" onClick={share}>🔗 {shareLabel}</button>
        <button className="btn" onClick={download}>Download config.json</button>
      </div>
      <p className="hint">The share link contains your whole configuration (no server involved): anyone who opens it can load it into their own editor.</p>
      <textarea rows={4} placeholder="Paste an existing config.json here" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row">
        <button className="btn sm" disabled={!text.trim()} onClick={() => apply(text)}>Import pasted JSON</button>
        <button className="btn sm" onClick={() => file.current?.click()}>Upload config.json</button>
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={async (e) => e.target.files?.[0] && apply(await e.target.files[0].text())} />
      </div>
      {msg && <div className={`log ${msg.ok ? "ok" : "bad"}`}>{msg.text}</div>}
    </div>
  );
}
