import { useState } from "react";
import { AUTH_URL, setSession, signIn, signOut, useSession } from "../../store/session";

/** Sign in with GitHub (OAuth backend) or a personal access token. Used by the Start and Publish steps. */
export function ConnectBlock() {
  const me = useSession((s) => s.me);
  const authError = useSession((s) => s.authError);
  const [priv, setPriv] = useState(false);
  const [token, setToken] = useState("");
  const [err, setErr] = useState("");

  if (me)
    return (
      <div className="me">
        <img src={me.avatar_url} alt="" />
        <span className="ok">Signed in as @{me.login}</span>
        <span className="grow" />
        <button className="btn sm" onClick={signOut}>Disconnect</button>
      </div>
    );

  const connect = async () => {
    try {
      setErr("");
      await setSession(token.trim(), "pat");
    } catch (e: any) {
      setErr(e.message + (e.hint ? ` ${e.hint}` : ""));
    }
  };

  const pat = (
    <div className="stack">
      <label className="field">
        <span className="field-label">Personal access token <small>kept in this tab only</small></span>
        <input type="password" autoComplete="off" placeholder="ghp_… or github_pat_…" value={token} onChange={(e) => setToken(e.target.value)} />
      </label>
      <div className="row">
        <button className="btn" disabled={!token.trim()} onClick={connect}>Connect</button>
        <a href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=profile-forge%20configurator" target="_blank" rel="noopener">
          Create a classic token (repo + workflow)
        </a>
      </div>
    </div>
  );
  const error = (err || authError) && <div className="log bad">{err || authError}</div>;

  if (!AUTH_URL)
    return (
      <div className="stack">
        <p className="hint">Sign in with a personal access token (the GitHub sign-in button isn’t configured on this site).</p>
        {pat}
        {error}
      </div>
    );

  return (
    <div className="authbox">
      <button className="btn primary" onClick={() => signIn(priv)}>Sign in with GitHub</button>
      <label className="field inline">
        <span className="field-label">
          Also read my private contributions <small>(asks for the repo scope instead of public_repo)</small>
        </span>
        <button type="button" role="switch" aria-checked={priv} className="toggle" onClick={() => setPriv(!priv)} />
      </label>
      <p className="hint">You’ll be sent to GitHub to approve, then brought back here. The app can only write to repositories you pick in the publish step.</p>
      {error}
      <details>
        <summary className="hint" style={{ cursor: "pointer" }}>Use a personal access token instead</summary>
        <div style={{ marginTop: 10 }}>{pat}</div>
      </details>
    </div>
  );
}
