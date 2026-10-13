import { useState } from "react";
import { AUTH_URL, signIn, useSession } from "../../store/session";

/** Sign in with GitHub (OAuth backend): the permission switch first, since it decides what GitHub is asked for, then the button. Once signed in this is just a status line; the one place to sign out is the top bar. */
export function ConnectBlock() {
  const me = useSession((s) => s.me);
  const authError = useSession((s) => s.authError);
  const [priv, setPriv] = useState(false);

  if (me)
    return (
      <div className="me">
        <img src={me.avatar_url} alt="" />
        <span className="ok">Signed in as @{me.login}</span>
      </div>
    );

  const error = authError && <div className="log bad">{authError}</div>;

  if (!AUTH_URL)
    return (
      <div className="stack">
        <p className="hint">Sign-in isn’t configured on this site. You can still design a card and download it as a zip in the Publish step.</p>
        {error}
      </div>
    );

  return (
    <div className="authbox">
      <label className="field inline">
        <span className="field-label">
          Also read my private contributions <small>(asks GitHub for the repo permission instead of public_repo)</small>
        </span>
        <button type="button" role="switch" aria-checked={priv} aria-label="Also read my private contributions" className="toggle" onClick={() => setPriv(!priv)} />
      </label>
      <button className="btn primary" onClick={() => signIn(priv)}>Sign in with GitHub</button>
      <p className="hint">You’ll be sent to GitHub to approve, then brought back here. The permission covers your repositories, but the app only writes to the one you pick in the Publish step.</p>
      {error}
    </div>
  );
}
