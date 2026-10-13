// Real mouse drags on the free-grid overlay (headless Edge/Chrome over the DevTools protocol), against `vite preview`.
//   npm run build && npx vite preview &   then   npm run e2e:grid
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const EDGE = process.env.BROWSER ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9334;
const URL0 = process.argv[2] ?? "http://localhost:8080/";
const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(tmpdir(), `pf-e2e-grid-${Date.now()}`)}`, "--window-size=1440,1000", "about:blank"], { stdio: "ignore" });
let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
const mouse = (type, x, y) => send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1, pointerType: "mouse" });
const grid = async () => JSON.parse(await ev(`localStorage.getItem("pf:raw")`)).grid;
const box = (name) => ev(`(() => { const b = [...document.querySelectorAll(".gbox")].find((e) => e.querySelector(".gname").textContent === ${JSON.stringify(name)}); if (!b) return null; const r = b.getBoundingClientRect(); const h = b.querySelector(".ghandle")?.getBoundingClientRect(); const v = b.querySelector(".gvhandle").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, hx: h && h.x + h.width / 2, hy: h && h.y + h.height / 2, vx: v.x + v.width / 2, vy: v.y + v.height / 2 }; })()`);
let ok = true;
const check = (name, pass, extra = "") => { ok &&= pass; console.log(`${pass ? "PASS" : "FAIL"}  ${name}${pass ? "" : "  " + JSON.stringify(extra)}`); };

try {
  let targets;
  for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://localhost:${PORT}/json/list`)).json(); if (targets.some((t) => t.type === "page")) break; } catch {} await sleep(250); }
  ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => { const d = JSON.parse(m.data); const p = pending.get(d.id); if (p) (pending.delete(d.id), d.error ? p.rej(new Error(d.error.message)) : p.res(d.result)); };
  await send("Page.enable");
  await send("Page.navigate", { url: `${URL0}?step=layout` });
  await sleep(1500);
  const seed = { themes: { dark: "dark" }, grid: [{ section: "header" }, { section: "stats", cols: 3 }, { section: "trophies", cols: 3 }, { section: "heatmap", cols: 3 }, { section: "about", cols: 3 }] };
  await ev(`localStorage.setItem("pf:raw", ${JSON.stringify(JSON.stringify(seed))})`);
  await send("Page.navigate", { url: `${URL0}?step=layout` });
  await sleep(2500);

  if (process.env.SHOT) (await import("node:fs")).writeFileSync(process.env.SHOT, Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  check("overlay shows the sections", (await ev(`document.querySelectorAll(".gbox").length`)) >= 5);

  // resize "Stats" from 3 to 4 columns by dragging its right handle
  const s = await box("Stats");
  const step = (s.w / 460) * 160; // a 3-column widget is 460 card pixels wide; one more column is 160
  await mouse("mouseMoved", s.hx, s.hy); await mouse("mousePressed", s.hx, s.hy);
  for (let i = 1; i <= 8; i++) await mouse("mouseMoved", s.hx + (step * i) / 8, s.hy);
  await mouse("mouseReleased", s.hx + step, s.hy);
  await sleep(400);
  check("dragging the right edge widens Stats", (await grid()).find((g) => g.section === "stats").cols === 4, await grid());

  // make "Heatmap" taller by dragging its bottom edge down 100 card pixels
  await sleep(1500);
  const hm = await box("Heatmap");
  const dy = (hm.w / 460) * 100;
  await mouse("mouseMoved", hm.vx, hm.vy); await mouse("mousePressed", hm.vx, hm.vy);
  for (let i = 1; i <= 8; i++) await mouse("mouseMoved", hm.vx, hm.vy + (dy * i) / 8);
  await mouse("mouseReleased", hm.vx, hm.vy + dy);
  await sleep(400);
  const heat = (await grid()).find((g) => g.section === "heatmap");
  check("dragging the bottom edge makes Heatmap taller", heat.height > 100, heat);

  await sleep(1500);
  // move "About" next to Stats's old neighbour: drop it on the Trophies box
  const a = await box("About me"), t = await box("Trophies");
  const from = [a.x + a.w / 2, a.y + a.h / 2], to = [t.x + t.w / 2, t.y + 20];
  await mouse("mouseMoved", ...from); await mouse("mousePressed", ...from);
  for (let i = 1; i <= 10; i++) await mouse("mouseMoved", from[0] + ((to[0] - from[0]) * i) / 10, from[1] + ((to[1] - from[1]) * i) / 10);
  await mouse("mouseReleased", ...to);
  await sleep(400);
  const order = (await grid()).map((g) => g.section).join();
  check("dragging About up changes the order", order !== "header,stats,trophies,heatmap,about", order);
  check("still valid config (all sections once)", new Set((await grid()).map((g) => g.section)).size === 5);
} catch (e) { ok = false; console.log("ERROR", e.message); }
ws?.close(); edge.kill();
process.exit(ok ? 0 : 1);
