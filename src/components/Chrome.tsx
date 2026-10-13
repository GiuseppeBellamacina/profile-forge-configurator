import { useEffect, useRef, useState } from "react";
import { searchFields } from "../schema/fields";
import { redo, undo, useCanRedo, useCanUndo } from "../store/config";
import { focusField, setStep, STEPS, uiStore, useUi } from "../store/ui";
import { shareUrl } from "./editors/ImportExport";
import { signOut, useSession } from "../store/session";
import { Icon } from "./ui/Icon";

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z" />
  </svg>
);

/** Find any option by name and jump to it. Ctrl/Cmd+K focuses it. */
function SearchBox() {
  const q = useUi((s) => s.query);
  const ref = useRef<HTMLInputElement>(null);
  const results = searchFields(q);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") (e.preventDefault(), ref.current?.focus());
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="search" role="search">
      <SearchIcon />
      <input ref={ref} type="search" placeholder="Find an option…  (Ctrl K)" aria-label="Find an option" value={q}
        onChange={(e) => uiStore.set({ query: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Escape") uiStore.set({ query: "" });
          if (e.key === "Enter" && results[0]) focusField(results[0].group.step, results[0].path);
        }} />
      {q.trim() && (
        <div className="search-results">
          {results.length === 0 && <div className="log" style={{ padding: 8 }}>No option matches “{q}”.</div>}
          {results.map((f) => (
            <button key={f.path} onClick={() => focusField(f.group.step, f.path)}>
              <span>{f.label} <small>· {f.group.title}</small></span>
              <small>{f.path}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const [label, setLabel] = useState("Share");
  const share = async () => {
    await navigator.clipboard?.writeText(await shareUrl());
    setLabel("Link copied ✓");
    setTimeout(() => setLabel("Share"), 1800);
  };
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">pf</span>
        <div><b>profile-forge</b> configurator</div>
      </div>
      <span className="grow" />
      <SearchBox />
      <div className="toolbar">
        <button className="btn sm icon" title="Undo (Ctrl Z)" aria-label="Undo" disabled={!canUndo} onClick={undo}><Icon n="undo" /></button>
        <button className="btn sm icon" title="Redo (Ctrl Y)" aria-label="Redo" disabled={!canRedo} onClick={redo}><Icon n="redo" /></button>
        <button className="btn sm" title="Copy a link to this configuration" onClick={share}><Icon n="link" /> <span className="lbl">{label}</span></button>
      </div>
      <AccountChip />
      <nav className="toplinks">
        <a href="https://github.com/GiuseppeBellamacina/profile-forge/blob/main/GUIDE.md" target="_blank" rel="noopener">Option guide</a>
        <a href="https://github.com/GiuseppeBellamacina/profile-forge" target="_blank" rel="noopener">GitHub</a>
      </nav>
    </header>
  );
}

/** The one place that shows who is signed in and signs out. Nothing is shown while signed out (the steps that need it offer the sign-in). */
function AccountChip() {
  const me = useSession((s) => s.me);
  if (!me) return null;
  return (
    <div className="account" title={`Signed in as @${me.login}`}>
      <img src={me.avatar_url} alt="" />
      <span className="lbl">@{me.login}</span>
      <button className="btn sm ghost" onClick={signOut}>Sign out</button>
    </div>
  );
}

export function Stepper() {
  const step = useUi((s) => s.step);
  const idx = STEPS.findIndex((s) => s.id === step);
  return (
    <nav className="stepper" aria-label="Steps">
      {STEPS.map((s, i) => (
        <button key={s.id} className={`step${i < idx ? " done" : ""}`} aria-current={s.id === step ? "step" : undefined} onClick={() => setStep(s.id)} title={s.hint}>
          <span className="n">{i < idx ? "✓" : i + 1}</span>
          {s.title}
        </button>
      ))}
    </nav>
  );
}

export function StepNav() {
  const step = useUi((s) => s.step);
  const i = STEPS.findIndex((s) => s.id === step);
  const prev = STEPS[i - 1];
  const next = STEPS[i + 1];
  return (
    <div className="editor-foot">
      {prev ? <button className="btn" onClick={() => setStep(prev.id)}><Icon n="left" /> {prev.title}</button> : <span />}
      {next ? <button className="btn primary" onClick={() => setStep(next.id)}>{next.title} <Icon n="right" /></button> : <span />}
    </div>
  );
}
