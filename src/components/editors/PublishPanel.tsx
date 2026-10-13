import { useEffect, useState, type ReactNode } from "react";
import { assetBytes } from "../../lib/assets";
import { api, commitFiles, configJson, mergeReadme, readmeBlock, toBytes, workflowYaml, type FileEntry } from "../../lib/publish";
import { zip } from "../../lib/zip";
import { useAssets, useRaw } from "../../store/config";
import { useSession } from "../../store/session";
import { ConnectBlock } from "./ConnectBlock";

type Msg = { kind: "info" | "ok" | "bad"; text: string; link?: { href: string; label: string } } | null;
const errText = (e: any) => e.message + (e.hint ? ` ${e.hint}` : "");

const Step = ({ n, title, children }: { n: string; title: string; children: ReactNode }) => (
  <div className="pub-step">
    <h3><i>{n}</i>{title}</h3>
    {children}
  </div>
);

/** Remembered while the page is open, so leaving the Publish step doesn't throw away the repository check. */
const memo = {
  owner: "", repo: "", branch: "", readme: "merge" as "merge" | "skip", ref: "v1", hour: 3, onConfig: true, message: "Add profile-forge card",
  existing: new Map<string, string | null>(), readmeText: null as string | null, off: new Set<string>(), ready: false,
};

export function PublishPanel() {
  const raw = useRaw();
  const assets = useAssets();
  const me = useSession((s) => s.me);
  const token = useSession((s) => s.token);

  const [owner, setOwner] = useState(memo.owner);
  const [repo, setRepo] = useState(memo.repo);
  const [branch, setBranch] = useState(memo.branch);
  const [readme, setReadme] = useState(memo.readme);
  const [ref, setRef] = useState(memo.ref);
  const [hour, setHour] = useState(memo.hour);
  const [onConfig, setOnConfig] = useState(memo.onConfig);
  const [message, setMessage] = useState(memo.message);
  const [existing, setExisting] = useState(memo.existing);
  const [readmeText, setReadmeText] = useState(memo.readmeText);
  const [off, setOff] = useState(memo.off);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [ready, setReady] = useState(memo.ready);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);

  Object.assign(memo, { owner, repo, branch, readme, ref, hour, onConfig, message, existing, readmeText, off, ready });

  // Default the repository to the signed-in user's profile repo (<login>/<login>).
  useEffect(() => {
    if (me) (setOwner((o) => o || me.login), setRepo((r) => r || me.login));
  }, [me]);

  // Everything that would be committed, recomputed when anything it depends on changes.
  useEffect(() => {
    let stale = false;
    (async () => {
      const list: FileEntry[] = [
        { path: "config.json", content: configJson(raw) },
        { path: ".github/workflows/profile-forge.yml", content: workflowYaml({ ref, hour, onConfigChange: onConfig }) },
      ];
      const images = [...new Set<string>((raw.techStack ?? []).flatMap((c: { items: { image: string }[] }) => c.items.map((i) => i.image)))];
      for (const p of images) list.push({ path: p, content: await assetBytes(assets, p).catch(() => null), binary: true });
      if (readme === "merge") list.push({ path: "README.md", content: mergeReadme(readmeText, readmeBlock(raw)), readme: true });
      if (!stale) setFiles(list.filter((f) => f.content !== null));
    })();
    return () => { stale = true; };
  }, [raw, assets, ref, hour, onConfig, readme, readmeText]);

  const check = async () => {
    if (!me) return setMsg({ kind: "bad", text: "Connect to GitHub first." });
    if (!owner || !repo) return setMsg({ kind: "bad", text: "Fill in the repository." });
    setMsg({ kind: "info", text: "Checking the repository…" });
    try {
      let r = await api.repo(token, owner, repo);
      if (!r) {
        if (owner.toLowerCase() === me.login.toLowerCase() && confirm(`${owner}/${repo} does not exist. Create it now? It must be public to show on your profile.`)) r = await api.createRepo(token, repo);
        else return setMsg({ kind: "bad", text: "Repository not found." });
      }
      const ex = new Map<string, string | null>();
      for (const p of ["config.json", ".github/workflows/profile-forge.yml", "README.md"]) {
        const f = await api.file(token, owner, repo, p, r.default_branch);
        ex.set(p, f ? f.text : null);
        if (p === "README.md") setReadmeText(f?.text ?? null);
      }
      setBranch(r.default_branch);
      setExisting(ex);
      setReady(true);
      setDone(false);
      setMsg({ kind: "ok", text: `Ready: ${owner}/${repo} on branch ${r.default_branch}.` });
    } catch (e) {
      setMsg({ kind: "bad", text: errText(e) });
    }
  };

  const commit = async () => {
    setBusy(true);
    try {
      // merge into the latest README, not the one seen at "Check"
      const latest = (await api.file(token, owner, repo, "README.md", branch))?.text ?? null;
      const chosen = files
        .map((f) => (f.readme ? { ...f, content: mergeReadme(latest, readmeBlock(raw)) } : f))
        .filter((f) => !off.has(f.path)) as { path: string; content: string | Uint8Array }[];
      const c = await commitFiles(token, owner, repo, branch, chosen, message, (m) => setMsg({ kind: "info", text: m }));
      setMsg({ kind: "ok", text: "Committed! ", link: { href: c.html_url ?? `https://github.com/${owner}/${repo}/commits/${branch}`, label: "View the commit" } });
      setDone(true);
    } catch (e) {
      setMsg({ kind: "bad", text: errText(e) });
    }
    setBusy(false);
  };

  const run = async () => {
    setStarted(true);
    try {
      await api.dispatch(token, owner, repo, "profile-forge.yml", branch);
    } catch (e: any) {
      setStarted(false);
      setMsg({ kind: "bad", text: `${e.message}. Open the Actions tab and press “Run workflow”.` });
    }
  };

  const badge = (f: FileEntry) => {
    if (!existing.size) return null;
    const st = existing.get(f.path);
    if (st === null || st === undefined) return "new";
    return typeof f.content === "string" && st === f.content ? "unchanged" : "changed";
  };

  const downloadZip = () => {
    const entries = files.filter((f) => !f.readme).map((f) => ({ path: f.path, bytes: toBytes(f.content as string | Uint8Array) }));
    entries.push({ path: "README-snippet.md", bytes: toBytes(readmeBlock(raw)) });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(zip(entries));
    a.download = "profile-forge-setup.zip";
    a.click();
  };
  const [snip, setSnip] = useState("Copy README snippet");
  const newFile = (filename: string, value: string) => {
    const who = owner || me?.login;
    if (!who) return alert("Type your login in the repository field first.");
    window.open(`https://github.com/${who}/${repo || who}/new/${branch || "main"}?filename=${encodeURIComponent(filename)}&value=${encodeURIComponent(value)}`, "_blank", "noopener");
  };

  return (
    <div>
      <p className="hint" style={{ marginBottom: 14 }}>
        Publishing adds <code>config.json</code>, the workflow, the icons you picked (<code>assets/img/</code>) and the card block in <code>README.md</code>, in one commit.
      </p>

      <Step n="1" title="Connect GitHub">
        <ConnectBlock />
        {!me && <p className="hint">Sign-in is only needed to commit for you. You can always download the files instead (below).</p>}
      </Step>

      <Step n="2" title="Choose the repository & options">
        <label className="field">
          <span className="field-label">Repository <small>your profile repo is named after your login</small></span>
          <span className="row" style={{ flexWrap: "nowrap" }}>
            <input type="text" placeholder="login" value={owner} onChange={(e) => (setOwner(e.target.value.trim()), setReady(false))} />
            <span>/</span>
            <input type="text" placeholder="repo" value={repo} onChange={(e) => (setRepo(e.target.value.trim()), setReady(false))} />
          </span>
        </label>
        <label className="field">
          <span className="field-label">Commit message</span>
          <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">README.md</span>
          <select value={readme} onChange={(e) => setReadme(e.target.value as "merge" | "skip")}>
            <option value="merge">Add the card block to my README (keeps the rest)</option>
            <option value="skip">Don’t touch my README</option>
          </select>
        </label>
        <div className="row">
          <label className="field" style={{ flex: 1 }}>
            <span className="field-label">Action version</span>
            <input type="text" value={ref} onChange={(e) => setRef(e.target.value.trim() || "v1")} />
          </label>
          <label className="field" style={{ flex: 1 }}>
            <span className="field-label">Daily refresh <small>UTC hour</small></span>
            <input type="number" min={0} max={23} value={hour} onChange={(e) => setHour(Math.min(23, Math.max(0, Number(e.target.value) || 0)))} />
          </label>
        </div>
        <label className="field inline">
          <span className="field-label">Also rebuild the card whenever config.json changes</span>
          <button type="button" role="switch" aria-checked={onConfig} className="toggle" onClick={() => setOnConfig(!onConfig)} />
        </label>
        <button className="btn" onClick={check}>Check repository & review files</button>
      </Step>

      <Step n="3" title="Review & commit">
        <div className="files">
          {files.map((f) => {
            const b = badge(f);
            return (
              <label className="file" key={f.path}>
                <input type="checkbox" checked={!off.has(f.path)} onChange={(e) => setOff((o) => { const n = new Set(o); e.target.checked ? n.delete(f.path) : n.add(f.path); return n; })} />
                <code>{f.path}</code>
                {b ? <span className={`badge ${b}`}>{b}</span> : <span />}
              </label>
            );
          })}
        </div>
        <div className="row">
          <button className="btn primary" disabled={!ready || busy || files.every((f) => off.has(f.path))} onClick={commit}>
            {busy ? "Committing…" : "Commit to my repository"}
          </button>
        </div>
        {msg && (
          <div className={`log ${msg.kind === "ok" ? "ok" : msg.kind === "bad" ? "bad" : ""}`}>
            {msg.text}
            {msg.link && <a href={msg.link.href} target="_blank" rel="noopener">{msg.link.label}</a>}
          </div>
        )}
        {done && (
          <div className="stack">
            <p>The card is created by the workflow. Run it once now (it also runs daily and when config.json changes):</p>
            <div className="row">
              <button className="btn primary" disabled={started} onClick={run}>{started ? "Workflow started ✓" : "Run the workflow now"}</button>
              <a href={`https://github.com/${owner}/${repo}/actions/workflows/profile-forge.yml`} target="_blank" rel="noopener">Open Actions</a>
              <a href={`https://github.com/${owner}`} target="_blank" rel="noopener">See your profile</a>
            </div>
          </div>
        )}
      </Step>

      <Step n="↓" title="Prefer to do it by hand?">
        <div className="row">
          <button className="btn" onClick={downloadZip}>Download everything as .zip</button>
          <button className="btn" onClick={async () => { await navigator.clipboard?.writeText(readmeBlock(raw)); setSnip("Copied ✓"); setTimeout(() => setSnip("Copy README snippet"), 1500); }}>{snip}</button>
        </div>
        <p className="hint">No token? Create the two text files on github.com (the page pre-fills them), then upload the icons from the .zip, or just unzip into the repo.</p>
        <div className="row">
          <button className="btn sm" onClick={() => newFile("config.json", configJson(raw))}>Create config.json on GitHub</button>
          <button className="btn sm" onClick={() => newFile(".github/workflows/profile-forge.yml", workflowYaml({ ref, hour, onConfigChange: onConfig }))}>Create workflow on GitHub</button>
        </div>
      </Step>
    </div>
  );
}
