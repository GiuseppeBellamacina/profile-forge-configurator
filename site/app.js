import { DEFAULTS, normalize, needsExtras, setPath, SECTIONS, STATS_ITEMS } from "./src/config.js";
import { fetchProfile } from "./src/github.js";
import { LOCALES } from "./src/i18n.js";
import { ICONS, BRANDS } from "./src/icons.js";
import { render } from "./src/render.js";
import { summarize } from "./src/stats.js";
import { COLOR_KEYS, COLOR_NAMES, resolveTheme, THEME_NAMES } from "./src/themes.js";
import { AUTH_URL } from "./config.js";
import { demoProfile } from "./demo-data.js";
import { api, commitFiles, configJson, GitHubError, mergeReadme, readmeBlock, slug, toBytes, workflowYaml } from "./publish.js";
import { zip } from "./zip.js";

// ── small helpers ────────────────────────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === false || v == null) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k in el && k !== "list") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
};
const getPath = (o, p) => p.split(".").reduce((a, k) => a?.[k], o);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const debounce = (fn, ms) => {
  let t;
  return (...a) => (clearTimeout(t), (t = setTimeout(() => fn(...a), ms)));
};
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const load = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

// ── state ────────────────────────────────────────────────────────────────────
const START = { themes: { dark: "catppuccin-mocha", light: "catppuccin-latte" } };
const state = {
  raw: load("pf:raw") ?? structuredClone(START),
  assets: load("pf:assets") ?? {}, // image path -> { url }
  tab: "start", slot: null,
  profile: demoProfile(), source: "demo data",
  token: "", me: null, via: null, authError: "", loadMsg: "", fetched: null, // fetched = { login, priv } once a real profile is loaded
  bytes: new Map(), // image path -> Uint8Array
};
const persist = () => { save("pf:raw", state.raw); save("pf:assets", state.assets); };

function deletePath(o, path) {
  const keys = path.split(".");
  const chain = [o];
  for (const k of keys.slice(0, -1)) { if (!chain.at(-1)?.[k] || typeof chain.at(-1)[k] !== "object") return; chain.push(chain.at(-1)[k]); }
  delete chain.at(-1)[keys.at(-1)];
  for (let i = chain.length - 1; i > 0; i--) if (!Object.keys(chain[i]).length) delete chain[i - 1][keys[i - 1]];
}
/** Store a value, dropping it when it equals the default so config.json stays minimal. */
function setVal(path, val) {
  const def = getPath(DEFAULTS, path);
  const empty = val === undefined || val === "" || (Array.isArray(val) && !val.length && (!def || !def.length));
  if (empty || eq(val, def) || (val === null && def == null)) deletePath(state.raw, path);
  else setPath(state.raw, path, val);
  changed();
  // Private repos change the numbers, so this is the only option that fetches the profile again (and only once per value).
  if (path === "includePrivate" && state.fetched) loadProfile(state.fetched.login).catch(() => {});
}
const val = (path) => getPath(state.raw, path) ?? getPath(DEFAULTS, path);
const changed = () => { persist(); update(); };
const ssGet = (k) => { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } };
const ssSet = (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ── generic field builders ───────────────────────────────────────────────────
const label = (text, hint, ...ctl) => h("label", { class: "f" }, h("span", {}, text, hint ? h("small", {}, ` ${hint}`) : null), ...ctl);
const pretty = (v) => (v === null ? "default" : String(v));

const F = {
  text: (path, text, o = {}) => label(text, o.hint, h("input", { type: "text", value: getPath(state.raw, path) ?? "", placeholder: o.placeholder ?? (getPath(DEFAULTS, path) ?? ""), list: o.list, oninput: (e) => setVal(path, e.target.value.trim() || undefined) })),
  number: (path, text, o = {}) => label(text, o.hint, h("input", { type: "number", min: o.min, max: o.max, step: o.step ?? 1, value: getPath(state.raw, path) ?? "", placeholder: String(getPath(DEFAULTS, path) ?? "default"), oninput: (e) => setVal(path, e.target.value === "" ? undefined : Number(e.target.value)) })),
  bool: (path, text, o = {}) => h("label", { class: "f inline" }, h("input", { type: "checkbox", checked: !!val(path), onchange: (e) => setVal(path, e.target.checked) }), h("span", {}, text, o.hint ? h("small", {}, ` ${o.hint}`) : null)),
  select: (path, text, options, o = {}) => {
    const cur = val(path);
    return label(text, o.hint, h("select", { onchange: (e) => setVal(path, options[Number(e.target.value)]) },
      options.map((opt, i) => h("option", { value: i, selected: eq(opt, cur) }, pretty(opt) + (eq(opt, getPath(DEFAULTS, path)) && opt !== null ? " (default)" : "")))));
  },
  multi: (path, text, options, o = {}) => {
    const cur = new Set(val(path) ?? []);
    const box = h("div", { class: "checks" });
    for (const opt of options)
      box.append(h("label", {}, h("input", { type: "checkbox", checked: cur.has(opt), onchange: (e) => {
        const now = options.filter((x) => (x === opt ? e.target.checked : cur.has(x)));
        if (o.max && now.length > o.max) { e.target.checked = false; return; }
        e.target.checked ? cur.add(opt) : cur.delete(opt);
        setVal(path, options.filter((x) => cur.has(x)));
      } }), opt));
    return label(text, o.hint, box);
  },
  list: (path, text, o = {}) => label(text, o.hint ?? "comma separated", h("input", { type: "text", value: (getPath(state.raw, path) ?? []).join(", "), placeholder: o.placeholder, oninput: (e) => setVal(path, e.target.value.split(",").map((x) => x.trim()).filter(Boolean)) })),
};

// ── tabs ─────────────────────────────────────────────────────────────────────
const SECTION_OPTS = [...SECTIONS];
const TABS = [
  ["start", "Start"], ["layout", "Layout"], ["look", "Look"], ["header", "Header"], ["stats", "Stats"], ["streak", "Streak"],
  ["languages", "Languages"], ["trophies", "Trophies"], ["heatmap", "Heatmap"], ["content", "Content"], ["publish", "Publish"],
];
const section = (title, ...kids) => [h("h3", {}, title), ...kids];

const PANELS = {
  start: () => [
    ...section("Start from a preset", h("p", {}, "Pick a ready-made look, then tweak it in the other tabs. Your changes are saved in this browser."), presetPicker()),
    ...section("Your data", h("p", {}, "Until you sign in the preview shows demo data. Once signed in, your own profile is fetched one time and every edit reuses it."), dataBlock()),
    ...section("General",
      F.text("user", "GitHub login", { hint: "(the action defaults to the repo owner)", placeholder: "repo owner" }),
      F.select("locale", "Language", LOCALES),
      F.text("timezone", "Time zone", { hint: "decides what “today” is for streaks", list: "tzlist" }),
      F.bool("includePrivate", "Count private repositories", { hint: "needs the “private data” sign-in; reloads your profile once" })),
    ...section("Import / export", importBlock()),
  ],
  layout: () => [
    ...section("Section order", h("p", {}, "Put two sections in one row for a side-by-side layout (stats, streak and donut / pie languages are half width)."), layoutEditor()),
    F.multi("hideSections", "Hide sections", [...SECTION_OPTS, "rank"], { hint: "“rank” hides only the ring in the header" }),
    ...section("Card",
      F.number("card.radius", "Corner radius", { min: 0, max: 60 }),
      F.bool("card.hideBorder", "Hide border"),
      F.bool("card.animations", "Animations"),
      F.select("card.background.pattern", "Background pattern", ["none", "dots", "grid", "diagonal"]),
      F.bool("card.background.glow", "Accent glow"),
      F.text("card.background.gradient", "Background gradient", { hint: "angle,color1,color2,…", placeholder: "35,4158d0,c850c0,ffcc70" })),
  ],
  look: () => [
    ...section("Themes", h("p", {}, "The slot names (dark / light) decide the file names, so your README never changes when you swap themes."), themePicker()),
    ...section("Custom themes", customThemesEditor()),
    ...section("Color overrides", colorsEditor()),
  ],
  header: () => [
    F.text("title", "Title", { hint: "shown next to @login" }),
    F.select("header.avatar", "Avatar", ["circle", "rounded", "hide"]),
    F.select("header.rankIcon", "Rank ring shows", ["level", "percentile", "github"]),
    F.multi("header.facts", "Facts", ["contributionsThisYear", "bestDay", "busiestWeekday", "currentStreak", "longestStreak", "topLanguage", "stars", "followers"], { max: 4, hint: "up to 4" }),
  ],
  stats: () => [
    F.text("stats.title", "Title"),
    F.multi("stats.hide", "Hide rows", STATS_ITEMS),
    F.multi("stats.show", "Extra rows", ["prsMerged", "prsMergedPercentage", "discussionsStarted", "discussionsAnswered"], { hint: "extra API calls" }),
    F.bool("stats.icons", "Icons"),
    F.bool("stats.textBold", "Bold values"),
    F.select("stats.numberFormat", "Number format", ["long", "short"]),
    F.select("stats.numberPrecision", "Short number decimals", [null, 0, 1, 2]),
    F.number("stats.lineHeight", "Row height", { min: 18, max: 60 }),
    F.number("stats.commitsYear", "Count commits of one year only", { min: 2005, max: 2100 }),
    F.list("stats.excludeRepos", "Exclude repos", { hint: "comma separated names" }),
  ],
  streak: () => [
    F.text("streak.title", "Title"),
    F.multi("streak.hide", "Hide columns", ["total", "current", "longest"]),
    F.select("streak.mode", "Mode", ["daily", "weekly"]),
    F.multi("streak.excludeDays", "Excluded weekdays", ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], { hint: "neither extend nor break a streak" }),
    F.bool("streak.excludeDaysLabel", "Show “Excludes: …” label"),
    F.number("streak.startingYear", "First year counted", { min: 2005, max: 2100 }),
    F.text("streak.dateFormat", "Date format", { hint: "d j m n M F y Y; [text] hidden in the current year", placeholder: "M j[, Y]" }),
    F.bool("streak.shortNumbers", "Short numbers"),
  ],
  languages: () => [
    F.text("languages.title", "Title"),
    F.select("languages.layout", "Layout", ["bar", "compact", "donut", "donut-vertical", "pie"]),
    F.number("languages.count", "How many languages", { min: 1, max: 20 }),
    F.list("languages.hide", "Hide languages", { placeholder: "HTML, CSS" }),
    F.list("languages.excludeRepos", "Exclude repos"),
    F.bool("languages.hideProgress", "Hide percentages / sizes"),
    F.select("languages.statsFormat", "Show", ["percentages", "bytes"]),
    F.number("languages.sizeWeight", "Size weight", { step: 0.1, min: 0, max: 10, hint: "score = bytes^size × repos^count" }),
    F.number("languages.countWeight", "Repo count weight", { step: 0.1, min: 0, max: 10 }),
  ],
  trophies: () => [
    F.text("trophies.title", "Title"),
    F.multi("trophies.extra", "Opt-in trophies", ["Issues", "Reviews"]),
    F.list("trophies.titles", "Only these trophies", { placeholder: "Star, Commit, PR, Followers" }),
    F.list("trophies.hideTitles", "Hide trophies"),
    F.list("trophies.ranks", "Only these ranks", { placeholder: "-C  (SSS SS S AAA AA A B C SECRET)", hint: "“-” drops a rank" }),
    F.list("trophies.hideRanks", "Hide ranks"),
    F.number("trophies.columns", "Columns", { min: -1, max: 12, hint: "0 = all in one row" }),
    F.number("trophies.rows", "Rows", { min: 0, max: 10, hint: "0 = no limit" }),
    F.number("trophies.marginW", "Horizontal margin", { min: 0, max: 60 }),
    F.number("trophies.marginH", "Vertical margin", { min: 0, max: 60 }),
    F.bool("trophies.noBg", "No trophy background"),
    F.bool("trophies.noFrame", "No trophy frame"),
  ],
  heatmap: () => [
    F.number("heatmap.weeks", "Weeks", { min: 4, max: 53 }),
    F.select("heatmap.cell", "Cell shape", ["square", "round"]),
    F.select("heatmap.weekStart", "Week starts on", ["sun", "mon"]),
    F.bool("heatmap.legend", "Legend"),
    F.bool("heatmap.monthLabels", "Month labels"),
  ],
  content: () => [
    ...section("About", aboutEditor()),
    ...section("Working on", workingEditor()),
    ...section("Links", h("p", {}, "Each link becomes its own clickable button image."), linksEditor()),
    ...section("Tech stack", h("p", {}, "Icons come from devicon. They are committed to your repo under assets/img/."), stackEditor()),
  ],
  publish: () => publishPanel(),
};

// ── editors ──────────────────────────────────────────────────────────────────
function presetPicker() {
  const sel = h("select", {}, h("option", { value: "" }, "Choose a preset…"));
  const names = ["minimal", "dashboard", "terminal", "pastel-it", "trophy-case", "cyberpunk", "portfolio", "streak-focus", "open-source"];
  for (const n of names) sel.append(h("option", { value: n }, n));
  const msg = h("div", { class: "log" });
  sel.onchange = async () => {
    if (!sel.value) return;
    if (!confirm("Replace your current configuration with this preset?")) { sel.value = ""; return; }
    try {
      const json = await (await fetch(`./presets/${sel.value}.json`)).json();
      delete json.$schema;
      state.raw = json;
      msg.textContent = `Loaded “${sel.value}”.`;
      changed();
      renderPanel();
    } catch (e) { msg.textContent = `Could not load the preset: ${e.message}`; }
  };
  return h("div", { class: "list" }, sel, msg,
    h("div", { class: "row" }, h("button", { class: "btn sm", onclick: () => { if (confirm("Reset everything to the defaults?")) { state.raw = structuredClone(START); changed(); renderPanel(); } } }, "Reset to defaults")));
}

function importBlock() {
  const ta = h("textarea", { placeholder: "Paste an existing config.json here", rows: 5 });
  const msg = h("div", { class: "log" });
  const apply = (text) => {
    try {
      const j = JSON.parse(text);
      delete j.$schema;
      normalize(structuredClone(j));
      state.raw = j;
      changed();
      renderPanel();
    } catch (e) { msg.textContent = `Not a valid profile-forge config: ${e.message}`; msg.className = "log bad"; }
  };
  return h("div", { class: "list" }, ta,
    h("div", { class: "row" },
      h("button", { class: "btn sm", onclick: () => apply(ta.value) }, "Import pasted JSON"),
      h("label", { class: "btn sm" }, "Upload config.json", h("input", { type: "file", accept: ".json,application/json", hidden: true, onchange: async (e) => e.target.files[0] && apply(await e.target.files[0].text()) }))), msg);
}

// ── sign-in and profile data ─────────────────────────────────────────────────
async function setSession(token, via) {
  let me;
  try { me = await api.user(token); } catch (e) { throw e; }
  state.token = token; state.via = via; state.authError = "";
  state.me = { login: me.login, avatar_url: me.avatar_url };
  ssSet("pf:session", { token, via, me: state.me });
  loadProfile(me.login).catch(() => {});
}

function signIn(priv) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  ssSet("pf:nonce", nonce);
  ssSet("pf:tab", state.tab);
  const ret = encodeURIComponent(location.origin + location.pathname);
  location.href = `${AUTH_URL}/auth/login?return=${ret}&state=${nonce}&scope=${priv ? "private" : "public"}`;
}

async function signOut() {
  if (state.via === "oauth" && AUTH_URL) await fetch(`${AUTH_URL}/auth/logout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: state.token }) }).catch(() => {});
  state.token = ""; state.me = null; state.via = null; state.fetched = null; state.loadMsg = "";
  ssSet("pf:session", null);
  state.profile = demoProfile(); state.source = "demo data";
  renderPanel(); update();
}

/** Fetch a profile once; later edits reuse it. Cached per login in this tab. */
async function loadProfile(login, { force = false } = {}) {
  if (!state.token) throw new Error("Sign in first.");
  const priv = !!state.raw.includePrivate;
  const key = `pf:profile:${login}:${priv}`;
  const cached = !force && ssGet(key);
  if (cached) {
    Object.assign(state, { profile: cached, fetched: { login, priv }, source: `@${login}`, loadMsg: `Showing @${login}.` });
    refreshChip(); update();
    return;
  }
  state.source = `loading @${login}…`; state.loadMsg = "Fetching your profile (a few seconds, only this once)…";
  refreshChip();
  try {
    const p = await fetchProfile({ login, token: state.token, includePrivate: priv, tz: state.raw.timezone ?? "UTC", startingYear: null, extras: true });
    ssSet(key, p);
    Object.assign(state, { profile: p, fetched: { login, priv }, source: `@${login}`, loadMsg: `Showing @${login}.` });
  } catch (e) {
    state.source = state.fetched ? `@${state.fetched.login}` : "demo data";
    state.loadMsg = `Could not load @${login}: ${e.message}`;
    refreshChip(); refreshStatus();
    throw e;
  }
  refreshChip(); refreshStatus(); update();
}
const refreshChip = () => { const c = $("#source"); if (c) c.textContent = state.source; };
const refreshStatus = () => { for (const el of document.querySelectorAll(".js-status")) el.textContent = state.loadMsg; };

function connectBlock() {
  if (state.me) {
    return h("div", { class: "me" }, h("img", { src: state.me.avatar_url, alt: "" }), h("span", { class: "ok" }, `Signed in as @${state.me.login}`), h("span", { class: "grow" }),
      h("button", { class: "btn sm", onclick: signOut }, "Disconnect"));
  }
  const msg = h("div", { class: "log bad" }, state.authError);
  const tok = h("input", { type: "password", placeholder: "ghp_… or github_pat_…", autocomplete: "off" });
  const pat = h("div", { class: "list" },
    label("Personal access token", "kept in this tab only", tok),
    h("div", { class: "row" },
      h("button", { class: "btn", onclick: async () => { try { await setSession(tok.value.trim(), "pat"); renderPanel(); } catch (e) { msg.textContent = e.message + (e.hint ? ` ${e.hint}` : ""); } } }, "Connect"),
      h("a", { href: "https://github.com/settings/tokens/new?scopes=repo,workflow&description=profile-forge%20configurator", target: "_blank", rel: "noopener" }, "Create a classic token (repo + workflow)")));
  if (!AUTH_URL) return h("div", { class: "list" }, h("p", {}, "Sign in with a personal access token (the OAuth backend isn’t configured on this site)."), pat, msg);
  const priv = h("input", { type: "checkbox" });
  return h("div", { class: "authbox" },
    h("button", { class: "btn primary gh", onclick: () => signIn(priv.checked) }, "Sign in with GitHub"),
    h("label", { class: "f inline" }, priv, h("span", {}, "Also read my private contributions", h("small", {}, " (asks for the repo scope instead of public_repo)"))),
    h("p", { class: "hint" }, "You’ll be sent to GitHub to approve, then brought back here. The app can only write to repositories you pick in the publish step."),
    msg,
    h("details", { class: "alt" }, h("summary", {}, "Use a personal access token instead"), pat));
}

function dataBlock() {
  const login = h("input", { type: "text", placeholder: "your GitHub login", value: state.fetched?.login ?? state.me?.login ?? "" });
  const status = h("div", { class: "log js-status" }, state.loadMsg);
  return h("div", { class: "list" }, connectBlock(),
    state.me && [label("Profile to preview", "any public login works", login),
      h("div", { class: "row" },
        h("button", { class: "btn", onclick: () => { const u = login.value.trim(); u && loadProfile(u, { force: true }).catch(() => {}); } }, "Load profile"),
        h("button", { class: "btn", onclick: () => { state.profile = demoProfile(); state.fetched = null; state.source = "demo data"; state.loadMsg = "Back to demo data."; refreshChip(); refreshStatus(); update(); } }, "Use demo data")),
      status]);
}

function layoutEditor() {
  const box = h("div", { class: "list" });
  const rows = () => state.raw.layout ?? structuredClone(DEFAULTS.layout);
  const commit = (r) => { setVal("layout", r); draw(); };
  const draw = () => {
    const cur = rows();
    box.replaceChildren(...cur.map((row, i) => {
      const cells = Array.isArray(row) ? row : [row];
      const pick = (j) => h("select", { onchange: (e) => { const n = [...cells]; n[j] = e.target.value; commit(cur.map((r, x) => (x === i ? (n.length === 1 ? n[0] : n) : r))); } },
        SECTION_OPTS.map((s) => h("option", { value: s, selected: s === cells[j] }, s)));
      return h("div", { class: "item" }, h("span", { class: "num" }, i + 1),
        pick(0),
        cells[1] ? [pick(1), h("button", { class: "btn sm", title: "Single column", onclick: () => commit(cur.map((r, x) => (x === i ? cells[0] : r))) }, "−")]
          : h("button", { class: "btn sm", title: "Add a second section in this row", onclick: () => commit(cur.map((r, x) => (x === i ? [cells[0], SECTION_OPTS.find((s) => !cur.flat().includes(s)) ?? "stats"] : r))) }, "+ pair"),
        h("button", { class: "btn sm", disabled: i === 0, onclick: () => { const n = [...cur]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; commit(n); } }, "↑"),
        h("button", { class: "btn sm", disabled: i === cur.length - 1, onclick: () => { const n = [...cur]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; commit(n); } }, "↓"),
        h("button", { class: "btn sm danger", onclick: () => commit(cur.filter((_, x) => x !== i)) }, "✕"));
    }), h("div", { class: "row" },
      h("button", { class: "btn sm", onclick: () => commit([...rows(), SECTION_OPTS.find((s) => !rows().flat().includes(s)) ?? "heatmap"]) }, "+ Add row"),
      h("button", { class: "btn sm", onclick: () => { deletePath(state.raw, "layout"); changed(); draw(); } }, "Reset order")));
  };
  draw();
  return box;
}

const themeSlots = () => (Array.isArray(state.raw.themes) ? Object.fromEntries(state.raw.themes.map((t) => [t, t])) : state.raw.themes ?? START.themes);

function themePicker() {
  const box = h("div", { class: "list" });
  const draw = () => {
    const slots = themeSlots();
    const names = THEME_NAMES();
    box.replaceChildren(...Object.entries(slots).map(([slot, theme]) =>
      h("div", { class: "item" }, h("input", { type: "text", value: slot, style: "width:90px;flex:none", title: "Slot name = file name suffix", onchange: (e) => {
        const n = e.target.value.trim().replace(/[^\w-]/g, "") || slot;
        const out = {}; for (const [s, t] of Object.entries(slots)) out[s === slot ? n : s] = t;
        state.raw.themes = out; changed();
      } }),
        h("select", { onchange: (e) => { state.raw.themes = { ...slots, [slot]: e.target.value }; changed(); } }, names.map((n) => h("option", { value: n, selected: n === theme }, n))),
        Object.keys(slots).length > 1 && h("button", { class: "btn sm danger", onclick: () => { const { [slot]: _, ...rest } = slots; state.raw.themes = rest; changed(); draw(); } }, "✕"))),
      h("div", { class: "row" }, h("button", { class: "btn sm", onclick: () => { state.raw.themes = { ...slots, [`slot${Object.keys(slots).length + 1}`]: "dracula" }; changed(); draw(); } }, "+ Add slot"),
        h("span", { class: "hint" }, "47 built-in themes; previews in the repo’s docs/themes folder.")));
  };
  draw();
  return box;
}

const colorWidget = (key, get, set, themeName) => {
  const raw = get(key) ?? "";
  const fallback = () => { try { const c = resolveTheme(themeName); const f = COLOR_KEYS[key][0]; return c[f] ?? c.muted; } catch { return "#888888"; } };
  const hex6 = (v) => { const x = String(v).replace("#", ""); return /^[0-9a-f]{6}/i.test(x) ? "#" + x.slice(0, 6) : /^[0-9a-f]{3}$/i.test(x) ? "#" + [...x].map((c) => c + c).join("") : "#888888"; };
  const text = h("input", { type: "text", value: raw, placeholder: String(fallback()).replace("#", "").slice(0, 8), maxLength: 9 });
  const pick = h("input", { type: "color", value: hex6(raw || fallback()) });
  text.oninput = () => { if (/^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(text.value) || !text.value) { set(key, text.value.replace("#", "") || undefined); if (text.value) pick.value = hex6(text.value); } };
  pick.oninput = () => { text.value = pick.value.slice(1); set(key, text.value); };
  return h("div", { class: "cf" }, h("span", {}, key), pick, text, h("button", { title: "Reset", onclick: () => { text.value = ""; set(key, undefined); } }, "↺"));
};

function colorsEditor() {
  const box = h("div", { class: "list" });
  let target = "all";
  const draw = () => {
    const slots = Object.keys(themeSlots());
    const path = target === "all" ? "colors" : `colorsByTheme.${target}`;
    const themeName = themeSlots()[target === "all" ? slots[0] : target];
    const get = (k) => getPath(state.raw, `${path}.${k}`);
    const set = (k, v) => setVal(`${path}.${k}`, v);
    box.replaceChildren(
      label("Apply to", null, h("select", { onchange: (e) => { target = e.target.value; draw(); } }, h("option", { value: "all", selected: target === "all" }, "all slots"), slots.map((s) => h("option", { value: s, selected: s === target }, `only “${s}”`)))),
      h("div", { class: "colors" }, COLOR_NAMES.filter((k) => k !== "bg_gradient").map((k) => colorWidget(k, get, set, themeName))),
      F.text(`${path}.bg_gradient`, "bg_gradient", { hint: "angle,color1,color2,…", placeholder: "120,0f2027,203a43,2c5364" }));
  };
  draw();
  return box;
}

function customThemesEditor() {
  const box = h("div", { class: "list" });
  const draw = () => {
    const customs = state.raw.customThemes ?? {};
    const names = () => THEME_NAMES();
    box.replaceChildren(...Object.entries(customs).map(([name, spec]) => {
      const get = (k) => customs[name]?.[k];
      const set = (k, v) => { const c = (state.raw.customThemes ??= {}); c[name] = { ...c[name] }; v === undefined ? delete c[name][k] : (c[name][k] = v); changed(); };
      return h("div", { class: "card-box" },
        h("div", { class: "row" },
          h("input", { type: "text", value: name, style: "max-width:170px", onchange: (e) => {
            const n = e.target.value.trim().replace(/\s+/g, "-"); if (!n || n in customs || names().includes(n)) { e.target.value = name; return; }
            const out = {}; for (const [k, v] of Object.entries(customs)) out[k === name ? n : k] = v;
            state.raw.customThemes = out;
            for (const [s, t] of Object.entries(themeSlots())) if (t === name) state.raw.themes = { ...themeSlots(), [s]: n };
            changed(); draw();
          } }),
          h("span", { class: "hint" }, "based on"),
          h("select", { onchange: (e) => set("base", e.target.value) }, names().filter((n) => n !== name).map((n) => h("option", { value: n, selected: n === (spec.base ?? "dark") }, n))),
          h("button", { class: "btn sm danger", onclick: () => { delete customs[name]; if (!Object.keys(customs).length) delete state.raw.customThemes; changed(); renderPanel(); } }, "✕")),
        h("div", { class: "colors" }, COLOR_NAMES.filter((k) => k !== "bg_gradient").map((k) => colorWidget(k, get, set, spec.base ?? "dark"))),
        label("bg_gradient", "angle,color1,color2,…", h("input", { type: "text", value: spec.bg_gradient ?? "", oninput: (e) => set("bg_gradient", e.target.value.trim() || undefined) })));
    }),
      h("div", { class: "row" }, h("button", { class: "btn sm", onclick: () => {
        let n = "my-theme", i = 1; while (THEME_NAMES().includes(n)) n = `my-theme-${++i}`;
        (state.raw.customThemes ??= {})[n] = { base: "dark" }; changed(); renderPanel();
      } }, "+ New custom theme"), h("span", { class: "hint" }, "Then pick it in Themes above.")));
  };
  draw();
  return box;
}

function aboutEditor() {
  return h("div", { class: "list" },
    F.text("title", "Title (next to @login)"),
    label("About", "one paragraph per blank line; **bold** markers are stripped",
      h("textarea", { rows: 6, value: (state.raw.about ?? []).join("\n\n"), oninput: (e) => setVal("about", e.target.value.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)) })));
}

/** Generic editor for a list of flat objects. */
function rowsEditor(path, fields, blank, noun) {
  const box = h("div", { class: "list" });
  const draw = () => {
    const cur = state.raw[path] ?? [];
    const write = (n) => { n.length ? (state.raw[path] = n) : delete state.raw[path]; changed(); };
    box.replaceChildren(...cur.map((it, i) => h("div", { class: "item" },
      fields.map((f) => f.type === "color"
        ? h("input", { type: "color", value: /^#[0-9a-f]{6}$/i.test(it[f.key] ?? "") ? it[f.key] : "#7aa2f7", title: f.label, oninput: (e) => { cur[i] = { ...it, [f.key]: e.target.value }; write(cur); } })
        : h("input", { type: "text", value: it[f.key] ?? "", placeholder: f.label, list: f.list, style: f.wide ? "flex:2 1 160px" : "", oninput: (e) => { const n = { ...cur[i], [f.key]: e.target.value }; if (!e.target.value) delete n[f.key]; cur[i] = n; write(cur); } })),
      h("button", { class: "btn sm danger", onclick: () => { write(cur.filter((_, x) => x !== i)); draw(); } }, "✕"))),
      h("div", { class: "row" }, h("button", { class: "btn sm", onclick: () => { write([...cur, { ...blank }]); draw(); } }, `+ Add ${noun}`)));
  };
  draw();
  return box;
}
const workingEditor = () => rowsEditor("workingOn", [{ key: "title", label: "Title" }, { key: "description", label: "One line", wide: true }, { key: "url", label: "https://…", wide: true }], { title: "" }, "project");
const linksEditor = () => h("div", {}, h("datalist", { id: "iconlist" }, [...Object.keys(ICONS), ...Object.keys(BRANDS)].map((i) => h("option", { value: i }))),
  rowsEditor("links", [{ key: "label", label: "Label" }, { key: "url", label: "https://…", wide: true }, { key: "icon", label: "icon", list: "iconlist" }, { key: "color", type: "color", label: "Color" }], { label: "", url: "", icon: "globe" }, "link"));

// tech stack + devicon picker
const DEVICON = "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0";
let deviconList = null;
const iconUrl = (d) => `${DEVICON}/icons/${d.name}/${d.name}-${d.versions.svg.includes("original") ? "original" : d.versions.svg[0]}.svg`;
const imgSrc = (path) => state.assets[path]?.url ?? `./presets/${path}`;

function stackEditor() {
  const box = h("div", { class: "list" });
  const draw = () => {
    const cats = state.raw.techStack ?? [];
    const write = () => { cats.length ? (state.raw.techStack = cats) : delete state.raw.techStack; changed(); draw(); };
    box.replaceChildren(...cats.map((cat, i) => h("div", { class: "card-box" },
      h("div", { class: "row" },
        h("input", { type: "text", value: cat.category, placeholder: "Category", onchange: (e) => { cat.category = e.target.value; changed(); } }),
        h("button", { class: "btn sm danger", onclick: () => { cats.splice(i, 1); write(); } }, "Remove category")),
      h("div", { class: "chips" }, cat.items.map((it, j) => h("span", { class: "tool" }, h("img", { src: imgSrc(it.image), alt: "" }), it.name, h("button", { title: "Remove", onclick: () => { cat.items.splice(j, 1); write(); } }, "✕"))),
        h("button", { class: "btn sm", onclick: () => openPicker((item) => { cat.items.push(item); write(); }) }, "+ Add icon")))),
      h("div", { class: "row" }, h("button", { class: "btn sm", onclick: () => { cats.push({ category: `Category ${cats.length + 1}`, items: [] }); state.raw.techStack = cats; changed(); draw(); } }, "+ Add category")));
  };
  draw();
  return box;
}

async function openPicker(onPick) {
  const dlg = $("#picker"), grid = $("#pkGrid"), search = $("#pkSearch");
  const add = (name, file, url) => { state.assets[file] = { url }; persist(); dlg.close(); onPick({ name, image: file }); };
  const showIcons = () => {
    const q = search.value.trim().toLowerCase();
    const list = (deviconList ?? []).filter((d) => !q || d.name.includes(q) || d.altnames?.some((a) => a.includes(q)) || d.tags?.some((t) => t.includes(q))).slice(0, 150);
    grid.replaceChildren(...list.map((d) => h("button", { type: "button", title: d.name, onclick: () => add(d.name.replace(/^./, (c) => c.toUpperCase()), `assets/img/${slug(d.name)}.svg`, iconUrl(d)) }, h("img", { src: iconUrl(d), loading: "lazy", alt: "" }), d.name)));
    if (!list.length) grid.textContent = deviconList ? "No icon matches." : "Loading icons…";
  };
  search.oninput = showIcons;
  $("#pkAdd").onclick = () => {
    const name = $("#pkName").value.trim(), url = $("#pkUrl").value.trim();
    if (!name || !/^https:\/\//.test(url)) return alert("Enter a name and an https:// image URL.");
    const ext = (url.match(/\.(svg|png|jpe?g|gif|webp)(\?|$)/i)?.[1] ?? "svg").toLowerCase();
    add(name, `assets/img/${slug(name)}.${ext}`, url);
  };
  dlg.showModal();
  showIcons();
  if (!deviconList) {
    try { deviconList = await (await fetch(`${DEVICON}/devicon.json`)).json(); showIcons(); }
    catch { grid.textContent = "Could not load the devicon list (offline?). You can still add your own image below."; }
  }
}

// ── preview ──────────────────────────────────────────────────────────────────
let fontCss = "";
async function fonts() {
  if (fontCss) return fontCss;
  const face = async (family, file) => {
    const bytes = new Uint8Array(await (await fetch(`./fonts/${file}`)).arrayBuffer());
    let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `@font-face{font-family:'${family}';font-weight:300 800;src:url(data:font/woff2;base64,${btoa(s)}) format("woff2")}`;
  };
  return (fontCss = (await face("Inter", "inter.woff2")) + (await face("Space Grotesk", "space-grotesk.woff2")));
}
const MIME = { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
const extOf = (p) => p.split(".").pop().toLowerCase();
async function assetBytes(path) {
  if (state.bytes.has(path)) return state.bytes.get(path);
  const res = await fetch(imgSrc(path));
  if (!res.ok) throw new Error(`Could not fetch ${path} (${res.status})`);
  const b = new Uint8Array(await res.arrayBuffer());
  state.bytes.set(path, b);
  return b;
}
const dataUri = async (path) => {
  const b = await assetBytes(path);
  let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return `data:${MIME[extOf(path)] ?? "image/png"};base64,${btoa(s)}`;
};

let blobUrl, token = 0;
async function renderPreview() {
  const mine = ++token;
  const err = $("#err"), busy = $("#busy");
  busy.classList.add("on");
  try {
    const k = normalize(structuredClone(state.raw));
    const slots = k.slots.map(([s]) => s);
    if (!slots.includes(state.slot)) state.slot = slots[0];
    drawSlots(slots);
    const [, theme] = k.slots.find(([s]) => s === state.slot);
    const sy = k.streak.startingYear;
    const data = summarize(sy ? { ...state.profile, days: state.profile.days.filter(([d]) => Number(d.slice(0, 4)) >= sy) } : state.profile, k);
    const items = k.techStack.flatMap((c) => c.items);
    const missing = [];
    k.stack = (await Promise.all(items.map(async (it, n) => {
      try { return { name: it.name, id: `i${n}`, data: await dataUri(it.image) }; } catch { missing.push(it.name); return null; }
    }))).filter(Boolean);
    if (mine !== token) return;
    const colors = { ...k.colors, ...k.colorsByTheme[state.slot] };
    const svg = render(data, { theme, k, colors, fontCss: await fonts() });
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    $("#card").src = url;
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = url;
    const stage = $("#stage");
    stage.className = `stage ${/light/.test(resolveTheme(theme).base) ? "light" : "dark"}`;
    err.hidden = !missing.length;
    if (missing.length) err.textContent = `Could not load icons: ${missing.join(", ")}`;
  } catch (e) {
    if (mine !== token) return;
    err.hidden = false;
    err.textContent = e.message;
  } finally {
    if (mine === token) busy.classList.remove("on");
  }
  $("#json").textContent = configJson(state.raw);
  $("#source").textContent = state.source;
}
const update = debounce(renderPreview, 140);

function drawSlots(slots) {
  const box = $("#slots");
  if (box.dataset.k === slots.join("|") + state.slot) return;
  box.dataset.k = slots.join("|") + state.slot;
  box.replaceChildren(...slots.map((s) => h("button", { "aria-pressed": s === state.slot, onclick: () => { state.slot = s; renderPreview(); } }, s)));
}

// ── publish ──────────────────────────────────────────────────────────────────
const pub = { owner: "", repo: "", branch: "", readme: "merge", ref: "v1", hour: 3, onConfig: true, message: "Add profile-forge card", existing: new Map(), off: new Set(), readmeText: null };

async function buildFiles() {
  const files = [
    { path: "config.json", content: configJson(state.raw) },
    { path: ".github/workflows/profile-forge.yml", content: workflowYaml({ ref: pub.ref, hour: pub.hour, onConfigChange: pub.onConfig }) },
  ];
  const images = [...new Set((state.raw.techStack ?? []).flatMap((c) => c.items.map((i) => i.image)))];
  for (const p of images) files.push({ path: p, content: await assetBytes(p).catch(() => null), binary: true });
  const block = readmeBlock(state.raw);
  if (pub.readme === "merge") files.push({ path: "README.md", content: mergeReadme(pub.readmeText, block), readme: true });
  return files.filter((f) => f.content !== null);
}

function publishPanel() {
  const out = h("div", { class: "list" });
  const log = h("div", { class: "log" });
  const filesBox = h("div", { class: "files" });
  const act = h("div", { class: "list" });
  const row = (f) => {
    const st = pub.existing.get(f.path);
    const same = st !== undefined && st !== null && (typeof f.content === "string" ? st === f.content : true);
    const badge = !pub.existing.size ? null : st === null || st === undefined ? "new" : same ? "unchanged" : "changed";
    return h("div", { class: "file" }, h("input", { type: "checkbox", checked: !pub.off.has(f.path), onchange: (e) => (e.target.checked ? pub.off.delete(f.path) : pub.off.add(f.path)) }),
      h("code", {}, f.path), badge ? h("span", { class: `badge ${badge}` }, badge) : h("span"));
  };
  const drawFiles = async () => {
    const files = await buildFiles();
    filesBox.replaceChildren(...files.map(row));
    return files;
  };
  const check = async () => {
    log.textContent = "Checking the repository…";
    try {
      const { owner, repo } = pub;
      let r = await api.repo(state.token, owner, repo);
      if (!r) {
        if (owner.toLowerCase() === state.me.login.toLowerCase() && confirm(`${owner}/${repo} does not exist. Create it now? It must be public to show on your profile.`)) r = await api.createRepo(state.token, repo);
        else { log.textContent = "Repository not found."; return; }
      }
      pub.branch = r.default_branch;
      pub.existing = new Map();
      for (const p of ["config.json", ".github/workflows/profile-forge.yml", "README.md"]) {
        const f = await api.file(state.token, owner, repo, p, pub.branch);
        pub.existing.set(p, f ? f.text : null);
        if (p === "README.md") pub.readmeText = f?.text ?? null;
      }
      const files = await buildFiles();
      for (const f of files) if (!pub.existing.has(f.path)) pub.existing.set(f.path, null);
      await drawFiles();
      log.replaceChildren(h("span", { class: "ok" }, `Ready: ${owner}/${repo} on branch ${pub.branch}.`));
      commitBtn.disabled = false;
    } catch (e) { log.replaceChildren(h("span", { class: "bad" }, e.message + (e.hint ? ` ${e.hint}` : ""))); }
  };
  const commitBtn = h("button", { class: "btn primary", disabled: true, onclick: async () => {
    commitBtn.disabled = true;
    try {
      const files = (await buildFiles()).filter((f) => !pub.off.has(f.path));
      const c = await commitFiles(state.token, pub.owner, pub.repo, pub.branch, files, pub.message, (m) => (log.textContent = m));
      log.replaceChildren(h("span", { class: "ok" }, "Committed! "), h("a", { href: c.html_url ?? `https://github.com/${pub.owner}/${pub.repo}/commits/${pub.branch}`, target: "_blank", rel: "noopener" }, "View the commit"));
      act.replaceChildren(
        h("p", {}, "The card is created by the workflow. Run it once now (it also runs daily and when config.json changes):"),
        h("div", { class: "row" },
          h("button", { class: "btn primary", onclick: async (e) => {
            e.target.disabled = true;
            try { await api.dispatch(state.token, pub.owner, pub.repo, "profile-forge.yml", pub.branch); e.target.textContent = "Workflow started ✓"; }
            catch (er) { e.target.disabled = false; log.replaceChildren(h("span", { class: "bad" }, `${er.message}. Open the Actions tab and press “Run workflow”.`)); }
          } }, "Run the workflow now"),
          h("a", { href: `https://github.com/${pub.owner}/${pub.repo}/actions/workflows/profile-forge.yml`, target: "_blank", rel: "noopener" }, "Open Actions"),
          h("a", { href: `https://github.com/${pub.owner}`, target: "_blank", rel: "noopener" }, "See your profile")));
    } catch (e) { log.replaceChildren(h("span", { class: "bad" }, e.message + (e.hint ? ` ${e.hint}` : ""))); }
    commitBtn.disabled = false;
  } }, "Commit to my repository");

  const ownerIn = h("input", { type: "text", value: pub.owner, placeholder: "login", oninput: (e) => (pub.owner = e.target.value.trim()) });
  const repoIn = h("input", { type: "text", value: pub.repo, placeholder: "repo", oninput: (e) => (pub.repo = e.target.value.trim()) });
  const opt = h("div", { class: "list" },
    label("Repository", "your profile repo is named after your login", h("div", { class: "row" }, ownerIn, "/", repoIn)),
    label("Commit message", null, h("input", { type: "text", value: pub.message, oninput: (e) => (pub.message = e.target.value) })),
    label("README.md", null, h("select", { onchange: (e) => { pub.readme = e.target.value; drawFiles(); } },
      h("option", { value: "merge", selected: pub.readme === "merge" }, "Add the card block to my README (keeps the rest)"), h("option", { value: "skip", selected: pub.readme === "skip" }, "Don’t touch my README"))),
    h("div", { class: "row" },
      label("Action version", null, h("input", { type: "text", value: pub.ref, oninput: (e) => { pub.ref = e.target.value.trim() || "v1"; } })),
      label("Daily refresh (UTC hour)", null, h("input", { type: "number", min: 0, max: 23, value: pub.hour, oninput: (e) => { pub.hour = Math.min(23, Math.max(0, Number(e.target.value) || 0)); } }))),
    F_bool(() => pub.onConfig, (v) => (pub.onConfig = v), "Also rebuild the card whenever config.json changes"));
  const dl = h("div", { class: "row" },
    h("button", { class: "btn", onclick: async () => {
      const files = (await buildFiles()).filter((f) => !f.readme);
      files.push({ path: "README-snippet.md", content: readmeBlock(state.raw) });
      const blob = zip(files.map((f) => ({ path: f.path, bytes: toBytes(f.content) })));
      h("a", { href: URL.createObjectURL(blob), download: "profile-forge-setup.zip" }).click();
    } }, "Download everything as .zip"),
    h("button", { class: "btn", onclick: async (e) => { await navigator.clipboard?.writeText(readmeBlock(state.raw)); e.target.textContent = "Copied ✓"; setTimeout(() => (e.target.textContent = "Copy README snippet"), 1500); } }, "Copy README snippet"));
  const manual = h("div", { class: "list" },
    h("p", {}, "No token? Create the two text files on github.com (the page pre-fills them), then upload the icons from the .zip, or just unzip into the repo."),
    h("div", { class: "row" },
      h("button", { class: "btn sm", onclick: () => newFile("config.json", configJson(state.raw)) }, "Create config.json on GitHub"),
      h("button", { class: "btn sm", onclick: () => newFile(".github/workflows/profile-forge.yml", workflowYaml({ ref: pub.ref, hour: pub.hour, onConfigChange: pub.onConfig })) }, "Create workflow on GitHub")));
  const newFile = (filename, value) => {
    const who = pub.owner || state.me?.login;
    if (!who) return alert("Type your login in the repository field first.");
    window.open(`https://github.com/${who}/${pub.repo || who}/new/${pub.branch || "main"}?filename=${encodeURIComponent(filename)}&value=${encodeURIComponent(value)}`, "_blank", "noopener");
  };

  const prepare = () => { if (state.me) { pub.owner ||= state.me.login; pub.repo ||= state.me.login; ownerIn.value = pub.owner; repoIn.value = pub.repo; } };
  prepare();
  drawFiles();
  out.append(
    h("p", {}, "Publishing adds: ", h("code", {}, "config.json"), ", the workflow, the icons you picked (assets/img/) and the card block in README.md, in one commit."),
    h("div", { class: "step" }, h("h3", {}, h("i", {}, "1"), "Connect GitHub"), connectBlock(),
      state.me ? null : h("p", { class: "hint" }, "Sign-in is needed only to commit for you. You can always download the files instead (below).")),
    h("div", { class: "step" }, h("h3", {}, h("i", {}, "2"), "Choose the repository & options"), opt,
      h("button", { class: "btn", onclick: () => { if (!state.me) return (log.textContent = "Connect first."); prepare(); if (!pub.owner || !pub.repo) return (log.textContent = "Fill in the repository."); check(); } }, "Check repository & review files")),
    h("div", { class: "step" }, h("h3", {}, h("i", {}, "3"), "Review & commit"), filesBox, h("div", { class: "row" }, commitBtn), log, act),
    h("div", { class: "step" }, h("h3", {}, h("i", {}, "↓"), "Prefer to do it by hand?"), dl, manual));
  return [out];
}
function F_bool(get, set, text) {
  return h("label", { class: "f inline" }, h("input", { type: "checkbox", checked: get(), onchange: (e) => set(e.target.checked) }), h("span", {}, text));
}

// ── shell ────────────────────────────────────────────────────────────────────
function renderPanel() {
  const panel = $("#panel");
  panel.replaceChildren(...PANELS[state.tab]().flat());
  const i = TABS.findIndex(([id]) => id === state.tab);
  const go = (n) => () => { state.tab = TABS[n][0]; renderPanel(); $("#tabs").scrollIntoView({ block: "start" }); };
  panel.append(h("div", { class: "nav" }, i > 0 ? h("button", { class: "btn", onclick: go(i - 1) }, `← ${TABS[i - 1][1]}`) : h("span"), i < TABS.length - 1 ? h("button", { class: "btn primary", onclick: go(i + 1) }, `${TABS[i + 1][1]} →`) : null));
  for (const t of document.querySelectorAll(".tab")) {
    const on = t.dataset.id === state.tab;
    t.setAttribute("aria-selected", on);
    if (on) t.scrollIntoView({ inline: "center", block: "nearest" });
  }
}
$("#tabs").append(...TABS.map(([id, name]) => h("button", { class: "tab", role: "tab", "data-id": id, onclick: () => { state.tab = id; renderPanel(); } }, name)));
document.body.append(h("datalist", { id: "tzlist" }, (Intl.supportedValuesOf?.("timeZone") ?? ["UTC"]).map((z) => h("option", { value: z }))));
$("#replay").onclick = () => { const c = $("#card"); const s = c.src; c.src = ""; c.src = s; };
$("#copyJson").onclick = async (e) => { await navigator.clipboard?.writeText(configJson(state.raw)); e.target.textContent = "Copied ✓"; setTimeout(() => (e.target.textContent = "Copy"), 1500); };
$("#dlJson").onclick = () => h("a", { href: URL.createObjectURL(new Blob([configJson(state.raw)], { type: "application/json" })), download: "config.json" }).click();

// preview sheet (phones): always visible, tap to enlarge
const sheet = $("#preview");
const mobile = () => matchMedia("(max-width: 980px)").matches;
const setSheet = (open) => {
  sheet.classList.toggle("open", open);
  $("#sheetToggle").setAttribute("aria-expanded", open);
  $("#sheetToggle .hl").textContent = open ? "Close preview" : "Live preview · tap to enlarge";
  document.body.classList.toggle("noscroll", open && mobile());
};
$("#sheetToggle").onclick = () => setSheet(!sheet.classList.contains("open"));
$("#stage").addEventListener("click", () => mobile() && !sheet.classList.contains("open") && setSheet(true));
addEventListener("keydown", (e) => e.key === "Escape" && setSheet(false));
setSheet(false);

// back from GitHub sign-in (token arrives in the URL fragment), or a session kept in this tab
async function boot() {
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.has("pf_token") || hash.has("pf_error")) {
    history.replaceState(null, "", location.pathname + location.search);
    state.tab = ssGet("pf:tab") ?? "start";
    const ok = hash.get("state") && hash.get("state") === ssGet("pf:nonce");
    ssSet("pf:nonce", null);
    if (!ok) state.authError = "The sign-in could not be verified. Please try again.";
    else if (hash.has("pf_error")) state.authError = `GitHub sign-in failed: ${hash.get("pf_error")}`;
    else await setSession(hash.get("pf_token"), "oauth").catch((e) => (state.authError = e.message));
  } else {
    const s = ssGet("pf:session");
    if (s?.token) { Object.assign(state, { token: s.token, via: s.via, me: s.me }); loadProfile(s.me.login).catch(() => {}); }
  }
  renderPanel();
  renderPreview();
}
boot();
