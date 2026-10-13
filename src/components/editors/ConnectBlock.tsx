import { useState } from "react";
import { AUTH_URL, signIn, signOut, useSession } from "../../store/session";

/** Sign in with GitHub (OAuth backend). Only needed to publish; the preview works without it. */
export function ConnectBlock() {
  const me = useSession((s) => s.me);
  const authError = useSession((s) => s.authError);
  const [priv, setPriv] = useState(false);

  if (me)
    return (
      <div className="me">
        <img src={me.avatar_url} alt="" />
        <span className="ok">Signed in as @{me.login}</span>
        <span className="grow" />
        <button className="btn sm" onClick={signOut}>Disconnect</button>
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
      <button className="btn primary" onClick={() => signIn(priv)}>Sign in with GitHub</button>
      <label className="field inline">
        <span className="field-label">
          Also read my private contributions <small>(asks for the repo scope instead of public_repo)</small>
        </span>
        <button type="button" role="switch" aria-checked={priv} className="toggle" onClick={() => setPriv(!priv)} />
      </label>
      <p className="hint">You’ll be sent to GitHub to approve, then brought back here. The permission covers your repositories, but the app only writes to the one you pick in the Publish step.</p>
      {error}
    </div>
  );
}
