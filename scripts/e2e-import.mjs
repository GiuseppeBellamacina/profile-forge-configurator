// Pastes a config.json into the Start step and checks that the controls of every step show its values.
//   npm run build && npx vite preview &   then   npm run e2e:import
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const EDGE = process.env.BROWSER ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9335;
const URL0 = process.argv[2] ?? "http://localhost:8080/";
const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(tmpdir(), `pf-e2e-imp-${Date.now()}`)}`, "--window-size=1440,1000", "about:blank"], { stdio: "ignore" });
let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
let ok = true;
const check = (name, pass, extra = "") => { ok &&= pass; console.log(`${pass ? "PASS" : "FAIL"}  ${name}${pass ? "" : "  " + JSON.stringify(extra)}`); };
const step = async (name) => { await ev(`[...document.querySelectorAll(".step")].find((b) => b.textContent.includes(${JSON.stringify(name)}))?.click()`); await sleep(500); };
const val = (path) => ev(`(() => { const e = document.getElementById("ctl-${path}"); return e ? (e.tagName === "SELECT" ? e.options[e.selectedIndex].text : e.value) : null; })()`);
const pressed = (path, label) => ev(`(() => { const f = document.getElementById("field-${path}"); return [...(f?.querySelectorAll("[aria-pressed=true]") ?? [])].map((b) => b.textContent.trim()); })()`);

const cfg = {
  title: "Data Person", locale: "it", timezone: "Europe/Rome", includePrivate: false,
  themes: { dark: "dracula", light: "gruvbox-light", print: "nord" },
  card: { radius: 41, hideBorder: true, background: { pattern: "grid" } },
  grid: [{ section: "header" }, { section: "stats", cols: 4, height: 280 }, { section: "streak", cols: 3 }],
  header: { avatar: "rounded", rankIcon: "percentile", frame: "neon", rankStyle: "hexagon", rankThickness: 12, facts: ["stars", "followers"] },
  trophies: { parts: ["title", "bar"], align: "left", padding: 30 },
  stats: { numberFormat: "short", lineHeight: 40, hide: ["issues"] },
  streak: { mode: "weekly", dateFormat: "j M[ Y]" },
  languages: { layout: "pie", count: 5 },
  heatmap: { weeks: 30, cell: "moon", mode: "snake", snakePath: "busy" },
  colors: { icon_color: "ff0066", snakeColor: "ff8a3d", frameColor: "00ff88", levelS: "ffaa00" },
};

try {
  let targets;
  for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://localhost:${PORT}/json/list`)).json(); if (targets.some((t) => t.type === "page")) break; } catch {} await sleep(250); }
  ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => { const d = JSON.parse(m.data); const p = pending.get(d.id); if (p) (pending.delete(d.id), d.error ? p.rej(new Error(d.error.message)) : p.res(d.result)); };
  await send("Page.enable");
  await send("Page.navigate", { url: `${URL0}?step=start` });
  await sleep(1500);
  await ev(`localStorage.clear()`);
  await send("Page.navigate", { url: `${URL0}?step=start` });
  await sleep(1500);

  await ev(`(() => { const t = document.querySelector("textarea"); t.focus(); })()`);
  await send("Input.insertText", { text: JSON.stringify(cfg) });
  await sleep(300);
  await ev(`[...document.querySelectorAll("button")].find((b) => b.textContent.includes("Import pasted JSON")).click()`);
  await sleep(800);

  // Start: open the General group and read the controls
  check("Start: language", (await val("locale"))?.startsWith("it"), await val("locale"));
  check("Start: time zone", (await val("timezone")) === "Europe/Rome", await val("timezone"));
  await step("Look");
  check("Look: card radius", (await val("card.radius")) === "41", await val("card.radius"));
  check("Look: pattern", (await val("card.background.pattern"))?.startsWith("grid"), await val("card.background.pattern"));
  check("Look: advanced slots opened for the extra slot", await ev(`!!document.querySelector('.item input[value="print"]')`));
  await step("Layout");
  const rows = await ev(`[...document.querySelectorAll(".item b.lay-chip")].map((b) => b.textContent)`);
  check("Layout: grid list", JSON.stringify(rows) === JSON.stringify(["Header", "Stats", "Streak"]), rows);
  await step("Details");
  await ev(`document.querySelectorAll("details.acc").forEach((d) => (d.open = true))`);
  await sleep(300);
  check("Details: title", (await val("title")) === "Data Person", await val("title"));
  check("Details: avatar", (await val("header.avatar"))?.startsWith("rounded"), await val("header.avatar"));
  check("Details: numberFormat", (await val("stats.numberFormat"))?.startsWith("short"), await val("stats.numberFormat"));
  check("Details: line height", (await val("stats.lineHeight")) === "40", await val("stats.lineHeight"));
  check("Details: streak mode", (await val("streak.mode"))?.startsWith("weekly"), await val("streak.mode"));
  check("Details: date format", (await val("streak.dateFormat")) === "j M[ Y]", await val("streak.dateFormat"));
  check("Details: languages layout", (await val("languages.layout"))?.startsWith("pie"), await val("languages.layout"));
  check("Details: heatmap weeks", (await val("heatmap.weeks")) === "30", await val("heatmap.weeks"));
  check("Details: heatmap shape", (await val("heatmap.cell"))?.startsWith("moon"), await val("heatmap.cell"));
  check("Details: snake route shown for snake mode", (await val("heatmap.snakePath"))?.startsWith("busy"), await val("heatmap.snakePath"));
  const snakeHex = await ev(`document.getElementById("field-colors.snakeColor")?.querySelector("input[type=text]")?.value`);
  check("Details: snake color shown", snakeHex === "ff8a3d", snakeHex);
  await ev(`(() => { const e = document.getElementById("ctl-heatmap.mode"); e.value = "0"; e.dispatchEvent(new Event("change", { bubbles: true })); })()`);
  await sleep(300);
  check("Details: snake options hide again for the plain grid", (await val("heatmap.snakePath")) === null && (await ev(`!document.getElementById("field-colors.snakeColor")`)));
  const frameHex = await ev(`document.getElementById("field-colors.frameColor")?.querySelector("input[type=text]")?.value`);
  check("Details: frame color", frameHex === "00ff88", frameHex);
  check("Details: rank shape and thickness", (await val("header.rankStyle"))?.startsWith("hexagon") && (await val("header.rankThickness")) === "12", [await val("header.rankStyle"), await val("header.rankThickness")]);
  check("Details: trophy padding", (await val("trophies.padding")) === "30", await val("trophies.padding"));
  check("Details: trophy parts", (await pressed("trophies.parts")).join() === "title,bar", await pressed("trophies.parts"));
  check("Details: the frame gallery is there", (await ev(`document.querySelectorAll(".fthumb-tile").length`)) >= 10);
  await ev(`(() => { const e = document.getElementById("ctl-header.avatar"); e.value = "2"; e.dispatchEvent(new Event("change", { bubbles: true })); })()`);
  await sleep(300);
  check("Details: no frame picker when the avatar is hidden", (await ev(`document.querySelectorAll(".fthumb-tile").length`)) === 0 && (await ev(`!document.getElementById("field-colors.frameColor") && !document.getElementById("ctl-header.frameAnimation")`)));
  const facts = await pressed("header.facts");
  check("Details: header facts", facts.join() === "stars,followers", facts);
  check("Details: stats hide", (await pressed("stats.hide")).join() === "issues", await pressed("stats.hide"));
} catch (e) { ok = false; console.log("ERROR", e.message); }
ws?.close(); edge.kill();
process.exit(ok ? 0 : 1);
