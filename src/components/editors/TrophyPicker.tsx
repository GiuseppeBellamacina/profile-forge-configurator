import { useEffect, useMemo, useRef, useState } from "react";
import { SECRETS, normalize, summarize } from "../../core";
import { clone } from "../../lib/path";
import { renderCard } from "../../lib/renderCard";
import { tiles, type Tile } from "../../lib/trophies";
import { setVal, edit, useAssets, useRaw } from "../../store/config";
import { useSession } from "../../store/session";
import { later } from "./ThemeEditor";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const pad = (n: number) => String(n).padStart(2, "0");

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** The picture of one trophy (drawn when it scrolls into view, cached per title). */
function useThumb<E extends HTMLElement>(title: string, cache: Map<string, string>) {
  const raw = useRaw();
  const assets = useAssets();
  const profile = useSession((s) => s.profile);
  const box = useRef<E>(null);
  const [url, setUrl] = useState(cache.get(title) ?? "");
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setSeen(true), io.disconnect()), { rootMargin: "150px" });
    box.current && io.observe(box.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => setUrl(cache.get(title) ?? ""), [cache, title]);
  useEffect(() => {
    if (!seen) return;
    const hit = cache.get(title);
    if (hit) return setUrl(hit);
    let live = true;
    const { grid: _grid, ...rest } = raw;
    const trophies = { ...raw.trophies, titles: [title], hideTitles: [], order: [], ranks: [], hideRanks: [], columns: 1, rows: 0, marginW: 0, marginH: 0, padding: 0, align: "left" };
    const secret = SECRETS.find((s) => s.title === title);
    // a secret you do not have is not in the data: draw it anyway (the tile is dimmed)
    const tweak = secret && ((d: any) => { d.trophies = [{ title: secret.title, rank: "SECRET", label: secret.label, score: null, progress: 1, secret: { glyph: secret.glyph, tone: secret.tone, hint: secret.hint, special: secret.special ?? null, value: null } }]; });
    later(() => renderCard({ ...rest, layout: ["trophies"], trophies, card: { ...raw.card, animations: false } }, assets, profile, null, tweak))
      .then((r) => {
        // crop to the single 110×110 trophy (x 30, y 72 = 42 inside the section + 30 top padding, in a trophies-only card)
        const svg = r.svg.replace(/(<svg[^>]*?) width="\d+" height="\d+" viewBox="[^"]*"/, '$1 width="110" height="110" viewBox="30 72 110 110"');
        const u = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
        cache.set(title, u);
        if (live) setUrl(u);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [seen, cache, title]);
  return [box, url] as const;
}

function TrophyTile({ t, on, cache, onClick }: { t: Tile; on: boolean; cache: Map<string, string>; onClick: () => void }) {
  const [box, url] = useThumb<HTMLButtonElement>(t.title, cache);
  return (
    <button ref={box} type="button" className={`tile fthumb-tile${t.earned ? "" : " dim"}${on ? "" : " hidden"}`} aria-pressed={on} onClick={onClick} title={`${on ? "On the card: click to hide. " : "Hidden: click to show. "}${t.hint}`}>
      <span className="fthumb">
        {url && <img alt="" src={url} />}
        {/* three states: on the card now, allowed but not earned yet (it appears when you earn it), hidden */}
        <span className={`tbadge ${!on ? "off" : t.earned ? "on" : "wait"}`}>{!on ? "Hidden" : t.earned ? "✓ On card" : "Not yet"}</span>
      </span>
      <span className="meta"><b>{t.name}</b>{t.earned && !t.secret && <small>{t.rank}</small>}</span>
    </button>
  );
}

/** One trophy in the order grid: drag it onto another cell to move it there. */
function SortCell({ title, t, cut, lit, onStar, cache, i, drag, over, setDrag, setOver, move }: {
  title: string; t?: Tile; cut: boolean; lit: boolean; onStar: () => void; cache: Map<string, string>; i: number; drag: number | null; over: number | null;
  setDrag: (n: number | null) => void; setOver: (n: number | null) => void; move: (from: number, to: number) => void;
}) {
  const [box, url] = useThumb<HTMLDivElement>(title, cache);
  return (
    <div
      ref={box}
      draggable
      title={`${t?.name ?? title} (${i + 1}). Drag to move`}
      className={`tcell${(t && !t.earned) || cut ? " dim" : ""}${drag === i ? " dragging" : ""}${over === i && drag !== i ? " over" : ""}`}
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(i)); setDrag(i); }}
      onDragEnd={() => (setDrag(null), setOver(null))}
      onDragOver={(e) => { if (drag !== null) (e.preventDefault(), setOver(i)); }}
      onDrop={(e) => { e.preventDefault(); if (drag !== null) move(drag, i); setDrag(null); setOver(null); }}
    >
      {url && <img alt="" src={url} draggable={false} />}
      <span className="tnum">{i + 1}</span>
      <button type="button" className={`tstar${lit ? " on" : ""}`} aria-pressed={lit} title={lit ? "Highlighted on the card (click to remove)" : "Highlight on the card"} onClick={onStar}>{lit ? "★" : "☆"}</button>
    </div>
  );
}

/** Every trophy is on the card by default (new ones too); the gallery hides the ones you do not want (trophies.hideTitles) and the
 * grid sets their order (trophies.order). Earned ones in colour, the rest faded with how to earn them on hover. */
export function TrophyPicker() {
  const raw = useRaw();
  const assets = useAssets();
  const profile = useSession((s) => s.profile);
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const titles: string[] = raw.trophies?.titles ?? []; // an old whitelist, still honoured until the first change here
  const hidden: string[] = raw.trophies?.hideTitles ?? [];
  const isOn = (title: string) => (titles.length ? titles.some((x) => same(x, title)) : !hidden.some((x) => same(x, title)));

  const list = useMemo(() => {
    try {
      const k = normalize(clone(raw));
      return tiles(summarize(profile, k).trophies);
    } catch {
      return []; // an invalid config is reported by the preview; this must not unmount the app
    }
  }, [raw, profile]);
  const key = JSON.stringify([raw.colors, raw.themes, raw.customThemes, raw.trophies?.parts, raw.trophies?.noBg, raw.trophies?.noFrame]);
  const cache = useMemo(() => new Map<string, string>(), [key, assets, profile]);
  useEffect(() => () => cache.forEach((u) => URL.revokeObjectURL(u)), [cache]);
  useEffect(() => { open && ref.current?.showModal(); }, [open]);

  // an old whitelist (titles) becomes "show everything except these": the others on the card are hidden, its order is kept,
  // and secret trophies not earned yet stay allowed, so they appear once earned
  const explicit = (tr: Record<string, any>) => {
    if (!tr.titles?.length) return;
    tr.order ??= tr.titles;
    tr.hideTitles = list.filter((t) => (!t.secret || t.earned) && !tr.titles.some((x: string) => same(x, t.title))).map((t) => t.title);
    delete tr.titles;
  };
  const toggle = (t: Tile) => edit((r) => {
    const tr = (r.trophies ??= {});
    explicit(tr);
    const h: string[] = tr.hideTitles ?? [];
    const off = h.some((x) => same(x, t.title));
    tr.hideTitles = off ? h.filter((x) => !same(x, t.title)) : [...h, t.title];
    if (!tr.hideTitles.length) delete tr.hideTitles;
    if (t.title === "Birthday" && !off) delete tr.birthday;
  });
  const [bm = "", bd = ""] = String(raw.trophies?.birthday ?? "").split("-").slice(-2); // "MM-DD" or "YYYY-MM-DD"
  const saveBirthday = (m: string, d: string) => setVal("trophies.birthday", `${m}-${pad(Math.min(+d, DAYS[+m - 1]))}`);
  // what the card shows, in order: the trophies listed in `order` first, then the others in the default order
  const ord: string[] = raw.trophies?.order?.length ? raw.trophies.order : titles;
  const at = (title: string) => { const i = ord.findIndex((x) => same(x, title)); return i < 0 ? Infinity : i; };
  const order = list
    .filter((t) => (!t.secret || t.earned) && isOn(t.title))
    .map((t, i) => [t.title, i] as const)
    .sort((a, b) => at(a[0]) - at(b[0]) || a[1] - b[1])
    .map(([t]) => t);
  const lit: string[] = raw.trophies?.highlight ?? [];
  const star = (title: string) => setVal("trophies.highlight", lit.some((x) => same(x, title)) ? lit.filter((x) => !same(x, title)) : [...lit, title]);
  const move = (from: number, to: number) => edit((r) => {
    const cur: string[] = [...order];
    if (from === to || to < 0 || to >= cur.length) return;
    cur.splice(to, 0, cur.splice(from, 1)[0]);
    const tr = (r.trophies ??= {});
    explicit(tr);
    tr.order = cur;
  });
  // the same columns, margins and row limit as the card, so the grid looks like the trophy panel
  const o = raw.trophies ?? {};
  const gx = o.marginW ?? 14, gy = o.marginH ?? 14, pd = o.padding ?? 20;
  const fit = Math.max(1, Math.floor((940 - 2 * pd + gx) / (70 + gx)));
  const cols = o.columns > 0 ? Math.min(order.length, o.columns) : Math.min(order.length, fit);
  const shown = o.rows > 0 ? cols * o.rows : order.length;
  const birthdayOn = isOn("Birthday");

  return (
    <div className="stack" style={{ marginTop: 8 }}>
      <button type="button" className="btn primary" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(true)}>
        Choose trophies{hidden.length && !titles.length ? ` (${hidden.length} hidden)` : ""}
      </button>
      {open && (
        <dialog ref={ref} onClose={() => setOpen(false)} onClick={(e) => e.target === ref.current && ref.current?.close()} style={{ width: "min(860px, 94vw)" }}>
          <div className="dlg-head"><b>Choose trophies</b><button className="btn sm" onClick={() => ref.current?.close()}>Close</button></div>
          <div className="dlg-body">
            <span className="log">
              Every trophy you earn is on the card, new ones too. Click one to hide it or show it again. <span className="tbadge on inline">✓ On card</span> you have it and it is shown · <span className="tbadge wait inline">Not yet</span> not earned yet, it appears when you earn it (hover for how) · <span className="tbadge off inline">Hidden</span> never shown.
              {(titles.length > 0 || hidden.length > 0) && <> <button className="btn sm" onClick={() => edit((r) => { if (r.trophies) { delete r.trophies.titles; delete r.trophies.hideTitles; } })}>Show all</button></>}
            </span>
            {order.length > 1 && (
              <div className="stack">
                <b>Order on the card</b>
                <div className="tsort" style={{ gap: `${gy}px ${gx}px`, padding: pd * 0.8, justifyContent: o.align === "left" ? "flex-start" : "center", ["--cols" as string]: cols, ["--gx" as string]: `${gx}px` }}>
                  {order.map((title, i) => (
                    <SortCell key={title} title={title} t={list.find((t) => same(t.title, title))} cut={i >= shown} lit={lit.some((x) => same(x, title))} onStar={() => star(title)} cache={cache} i={i} drag={drag} over={over} setDrag={setDrag} setOver={setOver} move={move} />
                  ))}
                </div>
                <span className="hint">Drag a trophy onto another place to move it, ☆ to make it glow. Same columns and rows as the card{o.rows > 0 && order.length > shown ? "; the faded ones are cut by the rows limit" : ""}.{o.sort && o.sort !== "default" ? ` Order (Details) is set to “${o.sort}”, which sorts the card on its own: set it to “default” to use this order.` : ""}</span>
              </div>
            )}
            {birthdayOn && (
              <div className="field">
                <span className="field-label">Birthday</span>
                <span className="row">
                  <select aria-label="Month" value={bm} onChange={(e) => saveBirthday(e.target.value, bd || "01")}>
                    <option value="" disabled>Month</option>
                    {MONTHS.map((m, i) => <option key={m} value={pad(i + 1)}>{m}</option>)}
                  </select>
                  <select aria-label="Day" value={bd} disabled={!bm} onChange={(e) => saveBirthday(bm, e.target.value)}>
                    <option value="" disabled>Day</option>
                    {Array.from({ length: DAYS[+bm - 1] ?? 31 }, (_, i) => <option key={i} value={pad(i + 1)}>{i + 1}</option>)}
                  </select>
                </span>
                <span className="hint">Only used for the Happy Birthday trophy, which shows on that day. Only month and day are saved.</span>
              </div>
            )}
            {[["Level trophies", false], ["Secret trophies", true]].map(([name, secret]) => (
              <section key={String(name)} className="stack">
                <b>{name}</b>
                <div className="gallery tgallery">
                  {list.filter((t) => t.secret === secret).map((t) => (
                    <TrophyTile key={t.title} t={t} cache={cache} on={isOn(t.title)} onClick={() => toggle(t)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </dialog>
      )}
    </div>
  );
}
