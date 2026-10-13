import { useEffect, useState } from "react";
import { AUTH_URL, loadProfile, useDemoData, useSession } from "../../store/session";

/** Where the preview gets its numbers: demo data until a login is typed; sign-in is only needed in the Publish step. */
export function DataBlock() {
  const me = useSession((s) => s.me);
  const fetched = useSession((s) => s.fetched);
  const msg = useSession((s) => s.loadMsg);
  const loading = useSession((s) => s.loading);
  const [login, setLogin] = useState(fetched?.login ?? me?.login ?? "");
  useEffect(() => setLogin((l) => l || fetched?.login || me?.login || ""), [fetched, me]);
  const value = login;

  const load = () => value.trim() && loadProfile(value.trim(), { force: true }).catch(() => {});

  return (
    <div className="stack">
      <label className="field">
        <span className="field-label">GitHub username <small>shows your real stats in the preview. No password, no sign-in.</small></span>
        <input type="text" placeholder="e.g. octocat" value={value} onChange={(e) => setLogin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
      </label>
      <div className="row">
        <button className="btn primary" disabled={loading || !value.trim() || (!me && !AUTH_URL)} onClick={load}>
          {loading ? "Loading…" : "Load my stats"}
        </button>
        <button className="btn" onClick={useDemoData}>Use demo data</button>
      </div>
      {msg && <div className="log">{msg}</div>}
    </div>
  );
}
