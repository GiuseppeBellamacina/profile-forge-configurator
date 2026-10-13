// GitHub OAuth backend for the profile-forge configurator (Cloudflare Worker, but plain fetch handlers: runs anywhere
// with Request/Response, e.g. Deno or Node 20+). It only does the one thing a static page can't: exchange the OAuth
// `code` for a token using the client secret.
//
//   GET  /auth/login?return=<page url>&state=<nonce>&scope=public|private   -> redirect to GitHub
//   GET  /auth/callback?code&state                                        -> redirect back to the page with #pf_token=…
//   POST /auth/logout  { token }                                          -> revokes the grant (CORS: allowed origins only)
//
// Env: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET (secret), ALLOWED_ORIGINS (comma-separated page origins).
// The token travels back in the URL *fragment*, which browsers never send to any server.

const COOKIE = "pf_oauth";
const SCOPES = { public: "public_repo workflow", private: "repo workflow" };

const origins = (env) => (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
const originOf = (u) => { try { return new URL(u).origin; } catch { return null; } };
const text = (s, status = 200, headers = {}) => new Response(s, { status, headers: { "Content-Type": "text/plain; charset=utf-8", ...headers } });
const cors = (env, req) => {
  const o = req.headers.get("Origin");
  return o && origins(env).includes(o) ? { "Access-Control-Allow-Origin": o, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" } : {};
};
const readCookie = (req, name) => (req.headers.get("Cookie") ?? "").split(/;\s*/).map((c) => c.split("=")).find(([k]) => k === name)?.[1];
const b64u = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env, req) });

    if (url.pathname === "/auth/login" && req.method === "GET") {
      const ret = url.searchParams.get("return") ?? "";
      const state = url.searchParams.get("state") ?? "";
      if (!origins(env).includes(originOf(ret))) return text("return URL not allowed", 400);
      if (!/^[A-Za-z0-9_-]{16,128}$/.test(state)) return text("bad state", 400);
      const scope = SCOPES[url.searchParams.get("scope")] ?? SCOPES.public;
      const gh = new URL("https://github.com/login/oauth/authorize");
      gh.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, scope, state, redirect_uri: `${url.origin}/auth/callback`, allow_signup: "false" });
      return new Response(null, {
        status: 302,
        headers: { Location: gh.href, "Set-Cookie": `${COOKIE}=${state}.${b64u(ret)}; Max-Age=600; Path=/auth; HttpOnly; Secure; SameSite=Lax` },
      });
    }

    if (url.pathname === "/auth/callback" && req.method === "GET") {
      const [saved, retEnc] = (readCookie(req, COOKIE) ?? "").split(".");
      const state = url.searchParams.get("state");
      const clear = `${COOKIE}=; Max-Age=0; Path=/auth; HttpOnly; Secure; SameSite=Lax`;
      if (!saved || !retEnc || saved !== state) return text("Invalid or expired sign-in attempt. Go back and try again.", 400, { "Set-Cookie": clear });
      const ret = unb64u(retEnc);
      if (!origins(env).includes(originOf(ret))) return text("return URL not allowed", 400, { "Set-Cookie": clear });
      const back = (frag) => new Response(null, { status: 302, headers: { Location: `${ret.split("#")[0]}#${frag}`, "Set-Cookie": clear, "Cache-Control": "no-store" } });
      const code = url.searchParams.get("code");
      if (!code) return back(new URLSearchParams({ pf_error: url.searchParams.get("error_description") ?? url.searchParams.get("error") ?? "denied", state }));
      const res = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "profile-forge-oauth" },
        body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: `${url.origin}/auth/callback` }),
      });
      const j = await res.json().catch(() => ({}));
      if (!j.access_token) return back(new URLSearchParams({ pf_error: j.error_description ?? j.error ?? "token exchange failed", state }));
      return back(new URLSearchParams({ pf_token: j.access_token, state }));
    }

    if (url.pathname === "/auth/logout" && req.method === "POST") {
      const headers = cors(env, req);
      if (!headers["Access-Control-Allow-Origin"]) return text("origin not allowed", 403);
      const { token } = await req.json().catch(() => ({}));
      if (!token) return text("missing token", 400, headers);
      // Revoke the whole grant so the app disappears from the user's authorized apps.
      const res = await fetch(`https://api.github.com/applications/${env.GITHUB_CLIENT_ID}/grant`, {
        method: "DELETE",
        headers: { Authorization: `Basic ${btoa(`${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`)}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "profile-forge-oauth" },
        body: JSON.stringify({ access_token: token }),
      });
      return text(res.status === 204 || res.status === 404 ? "ok" : "revoke failed", res.status === 204 || res.status === 404 ? 200 : 502, headers);
    }

    if (url.pathname === "/") return text("profile-forge OAuth backend. Nothing to see here.");
    return text("not found", 404);
  },
};
