// GitHub sign-in (OAuth via the worker) and the profile used by the preview.
import { fetchProfile, normalize, type Raw } from "../core";
import { demoProfile } from "../lib/demo";
import { clone } from "../lib/path";
import { api } from "../lib/publish";
import { session as ss } from "../lib/storage";
import { configStore } from "./config";
import { createStore, useStore } from "./store";
import { uiStore, type StepId } from "./ui";

// Set at build time (VITE_AUTH_URL, from the AUTH_URL repository variable). Empty = no sign-in and no pre-login preview.
export const AUTH_URL: string = ((import.meta.env.VITE_AUTH_URL as string | undefined) ?? "").replace(/\/$/, "");

type Me = { login: string; avatar_url: string };
type S = {
  token: string; priv: boolean; me: Me | null; via: "oauth" | null; authError: string;
  profile: Raw; source: string; loadMsg: string; loading: boolean; progress: number; step: string; fetched: { login: string; priv: boolean } | null;
};
export const sessionStore = createStore<S>({
  token: "", priv: false, me: null, via: null, authError: "", profile: demoProfile(), source: "demo data", loadMsg: "", loading: false, progress: 0, step: "", fetched: null,
});
export const useSession = <T,>(select: (s: S) => T) => useStore(sessionStore, select);

export async function setSession(token: string, via: "oauth") {
  const u = await api.user(token);
  const me = { login: u.login as string, avatar_url: u.avatar_url as string };
  const priv = !!ss.get("pf:priv"); // the grant asked at sign-in: only "repo" lets the API see private repositories
  sessionStore.set({ token, priv, via, authError: "", me });
  ss.set("pf:session", { token, priv, via, me });
  loadProfile(me.login).catch(() => {});
}

export function signIn(priv: boolean) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  ss.set("pf:nonce", nonce);
  ss.set("pf:priv", priv);
  ss.set("pf:tab", uiStore.get().step);
  const ret = encodeURIComponent(location.origin + location.pathname);
  location.href = `${AUTH_URL}/auth/login?return=${ret}&state=${nonce}&scope=${priv ? "private" : "public"}`;
}

export async function signOut() {
  const { via, token } = sessionStore.get();
  if (via === "oauth" && AUTH_URL)
    await fetch(`${AUTH_URL}/auth/logout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => {});
  ss.set("pf:session", null);
  sessionStore.set({ token: "", priv: false, me: null, via: null, fetched: null, loadMsg: "", profile: demoProfile(), source: "demo data" });
}

export function useDemoData() {
  sessionStore.set({ profile: demoProfile(), fetched: null, source: "demo data", loadMsg: "Back to demo data." });
}

/** Fetch a profile once; later edits reuse it. Cached per login (and private flag) in this tab. */
export async function loadProfile(login: string, { force = false } = {}) {
  const { token, priv: granted } = sessionStore.get();
  if (!token && !AUTH_URL) throw new Error("Preview needs the sign-in backend, which isn’t configured on this site.");
  const raw = configStore.get().raw;
  const priv = !!token && granted && !!raw.includePrivate; // private data needs the user's own token with the "repo" grant
  const key = `pf:profile:v2:${login}:${priv}`; // v2: profiles cached before the organizations were fetched are dropped
  const cached = !force && ss.get<Raw>(key);
  if (cached) {
    sessionStore.set({ profile: cached, fetched: { login, priv }, source: `@${login}`, loadMsg: `Showing @${login}.` });
    return;
  }
  sessionStore.set({ loading: true, progress: 0, step: "Starting…", source: `loading @${login}…`, loadMsg: "Fetching the profile: it can take a while on large accounts, only this once." });
  try {
    normalize(clone(raw)); // fail early on an invalid config
    // signed out: read-only public proxy on the worker
    const via = token ? {} : { endpoint: `${AUTH_URL}/api/graphql` };
    const p = await fetchProfile({ login, token: token || "anon", includePrivate: priv, tz: raw.timezone ?? "UTC", startingYear: null, extras: true, ...via, onProgress: (progress: number, step: string) => sessionStore.set({ progress, step }) });
    ss.set(key, p);
    sessionStore.set({ profile: p, fetched: { login, priv }, source: `@${login}`, loadMsg: `Showing @${login}.`, loading: false, progress: 1 });
  } catch (e: any) {
    const f = sessionStore.get().fetched;
    sessionStore.set({ source: f ? `@${f.login}` : "demo data", loadMsg: `Could not load @${login}: ${e.message}`, loading: false, progress: 0 });
    throw e;
  }
}

/** Back from GitHub sign-in (token in the URL fragment), or a session kept in this tab. Returns true if the URL carried auth data. */
export async function bootSession(): Promise<boolean> {
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.has("pf_token") || hash.has("pf_error")) {
    history.replaceState(null, "", location.pathname + location.search);
    const saved = ss.get<StepId>("pf:tab");
    if (saved) uiStore.set({ step: saved });
    const ok = hash.get("state") && hash.get("state") === ss.get("pf:nonce");
    ss.set("pf:nonce", null);
    if (!ok) sessionStore.set({ authError: "The sign-in could not be verified. Please try again." });
    else if (hash.has("pf_error")) sessionStore.set({ authError: `GitHub sign-in failed: ${hash.get("pf_error")}` });
    else await setSession(hash.get("pf_token")!, "oauth").catch((e) => sessionStore.set({ authError: e.message }));
    return true;
  }
  const s = ss.get<{ token: string; priv?: boolean; via: "oauth"; me: Me }>("pf:session");
  if (s?.token) {
    sessionStore.set({ token: s.token, priv: !!s.priv, via: s.via, me: s.me });
    loadProfile(s.me.login).catch(() => {});
  }
  return false;
}
