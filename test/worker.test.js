import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import worker from "../worker/index.js";

const env = { GITHUB_CLIENT_ID: "cid", GITHUB_CLIENT_SECRET: "sec", ALLOWED_ORIGINS: "https://me.github.io,http://localhost:8080" };
const STATE = "a".repeat(24);
const realFetch = globalThis.fetch;
afterEach(() => (globalThis.fetch = realFetch));
const call = (path, init) => worker.fetch(new Request(`https://auth.example${path}`, init), env);
const login = (extra = "") => call(`/auth/login?return=${encodeURIComponent("https://me.github.io/profile-forge/")}&state=${STATE}${extra}`);

test("login redirects to GitHub with scope, state and a cookie", async () => {
  const res = await login();
  assert.equal(res.status, 302);
  const loc = new URL(res.headers.get("Location"));
  assert.equal(loc.origin + loc.pathname, "https://github.com/login/oauth/authorize");
  assert.equal(loc.searchParams.get("client_id"), "cid");
  assert.equal(loc.searchParams.get("scope"), "public_repo workflow");
  assert.equal(loc.searchParams.get("state"), STATE);
  assert.match(res.headers.get("Set-Cookie"), /HttpOnly; Secure; SameSite=Lax/);
  assert.equal(new URL((await login("&scope=private")).headers.get("Location")).searchParams.get("scope"), "repo read:org workflow");
});

test("login rejects unknown return origins and weak state", async () => {
  assert.equal((await call(`/auth/login?return=${encodeURIComponent("https://evil.example/")}&state=${STATE}`)).status, 400);
  assert.equal((await call(`/auth/login?return=${encodeURIComponent("https://me.github.io/")}&state=short`)).status, 400);
});

test("callback exchanges the code and returns the token in the URL fragment", async () => {
  const cookie = (await login()).headers.get("Set-Cookie").split(";")[0];
  let sent;
  globalThis.fetch = async (u, init) => ((sent = { u, body: JSON.parse(init.body) }), Response.json({ access_token: "gho_tok" }));
  const res = await call(`/auth/callback?code=abc&state=${STATE}`, { headers: { Cookie: cookie } });
  assert.equal(res.status, 302);
  assert.equal(sent.body.client_secret, "sec");
  assert.equal(sent.body.code, "abc");
  const loc = new URL(res.headers.get("Location"));
  assert.equal(loc.origin + loc.pathname, "https://me.github.io/profile-forge/");
  assert.equal(new URLSearchParams(loc.hash.slice(1)).get("pf_token"), "gho_tok");
  assert.equal(new URLSearchParams(loc.hash.slice(1)).get("state"), STATE);
});

test("callback refuses a mismatched state or missing cookie", async () => {
  const cookie = (await login()).headers.get("Set-Cookie").split(";")[0];
  globalThis.fetch = async () => assert.fail("must not call GitHub");
  assert.equal((await call(`/auth/callback?code=abc&state=${"b".repeat(24)}`, { headers: { Cookie: cookie } })).status, 400);
  assert.equal((await call(`/auth/callback?code=abc&state=${STATE}`)).status, 400);
});

test("callback reports a denied sign-in back to the page", async () => {
  const cookie = (await login()).headers.get("Set-Cookie").split(";")[0];
  const res = await call(`/auth/callback?error=access_denied&state=${STATE}`, { headers: { Cookie: cookie } });
  assert.equal(new URLSearchParams(new URL(res.headers.get("Location")).hash.slice(1)).get("pf_error"), "access_denied");
});

test("graphql proxy injects the public token, only for allowed origins and never for mutations", async () => {
  const e = { ...env, GITHUB_PUBLIC_TOKEN: "pub" };
  const post = (origin, body) => worker.fetch(new Request("https://auth.example/api/graphql", { method: "POST", headers: { Origin: origin }, body: JSON.stringify(body) }), e);
  let sent;
  globalThis.fetch = async (u, init) => ((sent = init.headers.Authorization), Response.json({ data: {} }));
  assert.equal((await post("https://me.github.io", { query: "query { viewer { login } }" })).status, 200);
  assert.equal(sent, "bearer pub");
  assert.equal((await post("https://evil.example", { query: "query { a }" })).status, 403);
  assert.equal((await post("https://me.github.io", { query: "mutation { a }" })).status, 400);
});

test("logout revokes the grant only for allowed origins", async () => {
  globalThis.fetch = async (u, init) => (assert.match(u, /applications\/cid\/grant/), assert.match(init.headers.Authorization, /^Basic /), new Response(null, { status: 204 }));
  const ok = await call("/auth/logout", { method: "POST", headers: { Origin: "https://me.github.io", "Content-Type": "application/json" }, body: JSON.stringify({ token: "t" }) });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("Access-Control-Allow-Origin"), "https://me.github.io");
  const bad = await call("/auth/logout", { method: "POST", headers: { Origin: "https://evil.example" }, body: "{}" });
  assert.equal(bad.status, 403);
});
