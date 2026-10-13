import { useEffect, useState } from "react";
import { loadProfile, useDemoData, useSession } from "../../store/session";
import { ConnectBlock } from "./ConnectBlock";

/** Where the preview gets its numbers: demo data until the user signs in and loads a profile. */
export function DataBlock() {
  const me = useSession((s) => s.me);
  const fetched = useSession((s) => s.fetched);
  const msg = useSession((s) => s.loadMsg);
  const loading = useSession((s) => s.loading);
  const [login, setLogin] = useState(fetched?.login ?? me?.login ?? "");
  useEffect(() => setLogin((l) => l || fetched?.login || me?.login || ""), [fetched, me]);
  const value = login;

  return (
    <div className="stack">
      <ConnectBlock />
      {me && (
        <>
          <label className="field">
            <span className="field-label">Profile to preview <small>any public login works</small></span>
            <input type="text" placeholder="your GitHub login" value={value} onChange={(e) => setLogin(e.target.value)} />
          </label>
          <div className="row">
            <button className="btn" disabled={loading || !value.trim()} onClick={() => loadProfile(value.trim(), { force: true }).catch(() => {})}>
              {loading ? "Loading…" : "Load profile"}
            </button>
            <button className="btn" onClick={useDemoData}>Use demo data</button>
          </div>
          {msg && <div className="log">{msg}</div>}
        </>
      )}
    </div>
  );
}
