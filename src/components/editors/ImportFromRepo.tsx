import { useEffect, useState } from "react";
import { api, mergeReadme, readmeBlock } from "../../lib/publish";
import { README_MAX, readmeDocument } from "../../lib/repoImport";
import { renderCard } from "../../lib/renderCard";
import { useAssets, useRaw } from "../../store/config";
import { importFromRepo, useImport } from "../../store/repoImport";
import { useSession } from "../../store/session";
import { ConnectBlock } from "./ConnectBlock";

const dataUrl = (svg: string) => {
  let bin = "";
  for (const b of new TextEncoder().encode(svg)) bin += String.fromCharCode(b);
  return `data:image/svg+xml;base64,${btoa(bin)}`;
};

/** The README of the repo with the card being edited in place of its profile-forge block, rendered by GitHub inside a sandboxed frame. */
function ReadmePreview() {
  const raw = useRaw();
  const assets = useAssets();
  const profile = useSession((s) => s.profile);
  const token = useSession((s) => s.token);
  const { readme, repo, branch } = useImport((s) => s);
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState<"dark" | "light">("dark");
  const [doc, setDoc] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!open || !token) return;
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const md = mergeReadme(readme, readmeBlock(raw));
        if (md.length > README_MAX) return setMsg("This README is too long to preview here.");
        setMsg("Rendering…");
        const first = await renderCard(raw, assets, profile);
        const cards: Record<string, string> = {};
        for (const slot of first.slots) cards[slot] = dataUrl(slot === first.slot ? first.svg : (await renderCard(raw, assets, profile, slot)).svg);
        const html = await api.markdown(token, md, repo);
        if (stale) return;
        setDoc(readmeDocument(html, { cards, tone, base: `https://raw.githubusercontent.com/${repo}/${branch}/` }));
        setMsg("");
      } catch (e: any) {
        if (!stale) setMsg(e.message);
      }
    }, 900);
    return () => { stale = true; clearTimeout(timer); };
  }, [open, raw, assets, profile, token, readme, repo, branch, tone]);

  return (
    <details className="acc" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Preview my README with this card</summary>
      <div className="acc-body" style={{ paddingTop: 12 }}>
        <div className="row">
          <div className="seg" role="group" aria-label="README theme">
            {(["dark", "light"] as const).map((t) => <button key={t} aria-pressed={tone === t} onClick={() => setTone(t)}>{t}</button>)}
          </div>
        </div>
        {msg && <div className="log">{msg}</div>}
        {doc && <iframe className="readme-frame" title="README preview" sandbox="" srcDoc={doc} />}
      </div>
    </details>
  );
}

/** Start step: sign in, then pull the current config.json (if there is one), the images it uses, and the README. */
export function ImportFromRepo() {
  const me = useSession((s) => s.me);
  const token = useSession((s) => s.token);
  const { loading, error, report } = useImport((s) => s);

  if (!me)
    return (
      <div className="stack">
        <p className="hint">Load the setup you already have on GitHub.</p>
        <ConnectBlock />
      </div>
    );

  return (
    <div className="stack">
      <div className="row">
        <button className="btn primary" disabled={loading} onClick={() => importFromRepo(token, me.login)}>
          {loading ? "Importing…" : `Import from ${me.login}/${me.login}`}
        </button>
      </div>
      {error && <div className="log bad">{error}</div>}
      {report && (
        <div className="stack">
          {report.configFile ? (
            report.configError ? (
              <div className="log bad">Found {report.configFile} but it is not valid: {report.configError}</div>
            ) : (
              <div className="log ok">Imported {report.configFile}.</div>
            )
          ) : (
            <div className="log">No config.json found in {report.repo}.</div>
          )}
          {report.used > 0 && !report.configError && (
            <div className="log">
              Icons loaded: {report.loaded.length} of {report.used}.
              {report.skipped.length > 0 && (
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {report.skipped.map((s) => <li key={s.path}><code>{s.path}</code>: {s.reason}</li>)}
                </ul>
              )}
             
            </div>
          )}
          {report.hasReadme ? <ReadmePreview /> : <div className="log">No README.md found in {report.repo}.</div>}
        </div>
      )}
    </div>
  );
}
