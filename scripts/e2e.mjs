// Drives a headless Chromium browser (Edge / Chrome) over the DevTools protocol: real clicks and typing against `vite preview`.
//   npm run build && npx vite preview &   then   BROWSER="path/to/msedge-or-chrome" npm run e2e
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const EDGE = process.env.BROWSER ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9333;
const URL0 = process.argv[2] ?? "http://localhost:8080/";
const prof = join(tmpdir(), `pf-e2e-${Date.now()}`);
const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, "--window-size=1440,900", "about:blank"], { stdio: "ignore" });

let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const results = [];
const check = (name, ok, extra = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + extra}`); };
const raw = async () => JSON.parse((await ev(`localStorage.getItem("pf:raw")`)) ?? "{}");

try {
  let targets;
  for (let i = 0; i < 40; i++) {
    try { targets = await (await fetch(`http://localhost:${PORT}/json/list`)).json(); if (targets.some((t) => t.type === "page")) break; } catch {}
    await sleep(250);
  }
  const page = targets.find((t) => t.type === "page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => { const d = JSON.parse(m.data); const p = pending.get(d.id); if (p) (pending.delete(d.id), d.error ? p.rej(new Error(d.error.message)) : p.res(d.result)); };
  await send("Page.enable");

  const open = async (step) => { await send("Page.navigate", { url: `${URL0}?step=${step}` }); await sleep(1500); };
  await open("look");
  await ev(`localStorage.clear(); sessionStorage.clear()`);
  await open("look");

  // 1. clicking the label text of a bool toggles it; clicking it again toggles back (it must not hit the reset button)
  const labelClick = `(() => { const t = document.querySelector('#field-card\\\\.hideBorder .field-label span:not(.dot)'); t.click(); })()`;
  await ev(labelClick); await sleep(200);
  check("bool: label click turns it on", (await raw()).card?.hideBorder === true, JSON.stringify(await raw()));
  await ev(labelClick); await sleep(200);
  check("bool: label click again turns it off (not reset-by-accident)", (await raw()).card === undefined, JSON.stringify(await raw()));
  await ev(labelClick); await sleep(200);
  await ev(`document.querySelector('#field-card\\\\.hideBorder .reset').click()`); await sleep(200);
  check("bool: reset button removes the value", (await raw()).card === undefined);

  // 2. typing a hex color one character at a time
  await ev(`[...document.querySelectorAll('summary')].find((s) => s.textContent.includes('Color overrides')).click()`); await sleep(200);
  await ev(`document.querySelector('input[aria-label="bg_color hex"]').focus()`);
  for (const ch of "fff") { await send("Input.insertText", { text: ch }); await sleep(120); }
  const colors = (await raw()).colors;
  check("hex input: typing f-f-f reaches the store as 'fff'", colors?.bg_color === "fff", JSON.stringify(colors));
  check("hex input: draft shows what was typed", (await ev(`document.querySelector('input[aria-label="bg_color hex"]').value`)) === "fff");

  // 3. details step: clicking a multi's label does not toggle a chip
  await open("sections");
  await ev(`document.querySelector('#field-header\\\\.facts .field-label span:not(.dot)').click()`); await sleep(200);
  check("multi: clicking the label toggles nothing", (await raw()).header === undefined, JSON.stringify((await raw()).header));
  await ev(`[...document.querySelectorAll('#field-header\\\\.facts .chip')].find((c) => c.textContent === 'stars').click()`); await sleep(200);
  check("multi: clicking a chip toggles it", JSON.stringify((await raw()).header?.facts)?.includes("stars"));

  // 4. text field: spaces can be typed in the middle of a value
  await ev(`document.querySelector('#ctl-title').focus()`);
  for (const ch of "AI & ML") { await send("Input.insertText", { text: ch }); await sleep(60); }
  check("text: 'AI & ML' keeps its spaces", (await raw()).title === "AI & ML", JSON.stringify((await raw()).title));

  // 5. undo via keyboard shortcut outside a text field
  await ev(`document.activeElement.blur()`);
  await send("Input.dispatchKeyEvent", { type: "keyDown", modifiers: 2, key: "z", code: "KeyZ", windowsVirtualKeyCode: 90 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", modifiers: 2, key: "z", code: "KeyZ", windowsVirtualKeyCode: 90 });
  await sleep(200);
  check("undo: Ctrl+Z reverts the last edit", (await raw()).title === undefined, JSON.stringify((await raw()).title));

  // 6. search jumps to the option's step
  await ev(`document.querySelector('.search input').focus()`);
  for (const ch of "radius") await send("Input.insertText", { text: ch });
  await sleep(200);
  await ev(`document.querySelector('.search-results button').click()`); await sleep(500);
  check("search: 'radius' opens the Look step and highlights card.radius", (await ev(`!!document.querySelector('#field-card\\\\.radius.flash') && document.querySelector('.step[aria-current]').textContent.includes('Look')`)) === true);

  // 7. preview rendered an <img> with a blob url and no error banner
  await sleep(600);
  check("preview: card image is rendered", (await ev(`!!document.querySelector('.stage img')?.src.startsWith('blob:') && !document.querySelector('.pv-error')`)) === true);
} catch (e) {
  console.log("ERROR", e.message);
  results.push(false);
} finally {
  try { ws?.close(); } catch {}
  edge.kill();
  console.log(results.every(Boolean) ? "ALL PASSED" : "SOME FAILED");
  process.exit(results.every(Boolean) ? 0 : 1);
}
