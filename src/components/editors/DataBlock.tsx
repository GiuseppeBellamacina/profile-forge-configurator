import { useEffect, useState } from "react";
import { fieldsOf } from "../../schema/fields";
import { FieldList } from "../ui/Fields";
import { AUTH_URL, loadProfile, signIn, useDemoData, useSession } from "../../store/session";
import { useRaw } from "../../store/config";

/** Where the preview gets its numbers: demo data until a login is typed; sign-in is only needed in the Publish step. */
export function DataBlock() {
  const me = useSession((s) => s.me);
  const fetched = useSession((s) => s.fetched);
  const msg = useSession((s) => s.loadMsg);
  const loading = useSession((s) => s.loading);
  const progress = useSession((s) => s.progress);
  const step = useSession((s) => s.step);
  const granted = useSession((s) => s.priv);
  const wantsPrivate = !!useRaw().includePrivate;
  const [login, setLogin] = useState(fetched?.login ?? me?.login ?? "");
  useEffect(() => setLogin((l) => l || fetched?.login || me?.login || ""), [fetched, me]);
  const value = login;

  const load = () => value.trim() && loadProfile(value.trim(), { force: true }).catch(() => {});

  return (
    <div className="stack">
      <label className="field">
        <span className="field-label">GitHub username</span>
        <input type="text" placeholder="e.g. octocat" value={value} onChange={(e) => setLogin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
      </label>
      <div className="row">
        <button className="btn primary" disabled={loading || !value.trim() || (!me && !AUTH_URL)} onClick={load}>
          {loading ? "Loading…" : "Load my stats"}
        </button>
        <button className="btn" onClick={useDemoData}>Use demo data</button>
      </div>
      {loading && (
        <div className="loadbar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div className="track"><div className="fill" style={{ width: `${Math.max(3, progress * 100)}%` }} /></div>
          <span className="hint">{Math.round(progress * 100)}% · {step}</span>
        </div>
      )}
      {msg && <div className="log">{msg}</div>}
      {me && wantsPrivate && !granted && (
        <div className="log bad">
          Private repositories are not visible with this sign-in.
          <button className="btn" onClick={() => signIn(true)}>Grant private access</button>
        </div>
      )}
      {me && <FieldList fields={fieldsOf("general").fields.filter((f) => f.path === "includePrivate")} />}
    </div>
  );
}
