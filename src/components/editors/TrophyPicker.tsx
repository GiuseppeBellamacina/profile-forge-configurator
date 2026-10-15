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
    if (!seen || cache.has(title)) return;
    let live = true;
    const { grid: _grid, ...rest } = raw;
    const trophies = { ...raw.trophies, titles: [title], hideTitles: [], ranks: [], hideRanks: [], extra: ["Issues", "Reviews"], columns: 1, rows: 0, marginW: 0, marginH: 0, padding: 0, align: "left" };
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
    <button ref={box} type="button" className={`tile fthumb-tile${t.earned ? "" : " dim"}`} aria-pressed={on} onClick={onClick} title={t.hint}>
      <span className="fthumb">{url && <img alt="" src={url} />}</span>
      <span className="meta"><b>{t.name}</b>{t.earned && !t.secret && <small>{t.rank}</small>}</span>
    </button>
  );
}

/** One trophy in the order grid: drag it onto another cell to move it there. */
function SortCell({ title, t, cut, cache, i, drag, over, setDrag, setOver, move }: {
  title: string; t?: Tile; cut: boolean; cache: Map<string, string>; i: number; drag: number | null; over: number | null;
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
    </div>
  );
}

/** Pick the trophies the card shows (writes trophies.titles / extra / birthday). Earned ones in colour, the rest faded with how to earn them on hover. */
export function TrophyPicker() {
  const raw = useRaw();
  const assets = useAssets();
  const profile = useSession((s) => s.profile);
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const titles: string[] = raw.trophies?.titles ?? [];

  const list = useMemo(() => {
    try {
      const k = normalize(clone(raw));
      k.trophies.extra = new Set(["issues", "reviews"]);
      return tiles(summarize(profile, k).trophies);
    } catch {
      return []; // an invalid config is reported by the preview; this must not unmount the app
    }
  }, [raw, profile]);
  const key = JSON.stringify([raw.colors, raw.themes, raw.customThemes, raw.trophies?.parts, raw.trophies?.noBg, raw.trophies?.noFrame]);
  const cache = useMemo(() => new Map<string, string>(), [key, assets, profile]);
  useEffect(() => () => cache.forEach((u) => URL.revokeObjectURL(u)), [cache]);
  useEffect(() => { open && ref.current?.showModal(); }, [open]);

  const toggle = (t: Tile) => edit((r) => {
    const tr = (r.trophies ??= {});
    const cur: string[] = tr.titles ?? [];
    const has = cur.some((x) => same(x, t.title));
    tr.titles = has ? cur.filter((x) => !same(x, t.title)) : [...cur, t.title];
    if (t.optional) {
      const ex: string[] = tr.extra ?? [];
      tr.extra = has ? ex.filter((x) => !same(x, t.title)) : [...ex, t.title];
    }
    if (t.title === "Birthday" && has) delete tr.birthday;
  });
  const [bm = "", bd = ""] = String(raw.trophies?.birthday ?? "").split("-").slice(-2); // "MM-DD" or "YYYY-MM-DD"
  const saveBirthday = (m: string, d: string) => setVal("trophies.birthday", `${m}-${pad(Math.min(+d, DAYS[+m - 1]))}`);
  // what the card shows, in order: the chosen trophies, or every earned one while nothing is chosen
  const order = titles.length ? titles : list.filter((t) => t.earned && !t.optional).map((t) => t.title);
  const move = (from: number, to: number) => edit((r) => {
    const cur: string[] = [...order];
    if (from === to || to < 0 || to >= cur.length) return;
    cur.splice(to, 0, cur.splice(from, 1)[0]);
    (r.trophies ??= {}).titles = cur;
  });
  // the same columns, margins and row limit as the card, so the grid looks like the trophy panel
  const o = raw.trophies ?? {};
  const gx = o.marginW ?? 14, gy = o.marginH ?? 14, pd = o.padding ?? 20;
  const fit = Math.max(1, Math.floor((940 - 2 * pd + gx) / (70 + gx)));
  const cols = o.columns > 0 ? Math.min(order.length, o.columns) : Math.min(order.length, fit);
  const shown = o.rows > 0 ? cols * o.rows : order.length;
  const birthdayOn = titles.some((x) => same(x, "Birthday"));

  return (
    <div className="stack" style={{ marginTop: 8 }}>
      <button type="button" className="btn primary" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(true)}>
        Choose trophies{titles.length ? ` (${titles.length})` : ""}
      </button>
      {open && (
        <dialog ref={ref} onClose={() => setOpen(false)} onClick={(e) => e.target === ref.current && ref.current?.close()} style={{ width: "min(860px, 94vw)" }}>
          <div className="dlg-head"><b>Choose trophies</b><button className="btn sm" onClick={() => ref.current?.close()}>Close</button></div>
          <div className="dlg-body">
            <span className="log">
              In colour: trophies you have (with their level). Faded: not yet, hover one to see how to get it. Nothing selected = every earned trophy is shown, in the default order.
              {titles.length > 0 && <> <button className="btn sm" onClick={() => setVal("trophies.titles", [])}>Clear selection</button></>}
            </span>
            {order.length > 1 && (
              <div className="stack">
                <b>Order on the card</b>
                <div className="tsort" style={{ gap: `${gy}px ${gx}px`, padding: pd * 0.8, justifyContent: o.align === "left" ? "flex-start" : "center", ["--cols" as string]: cols, ["--gx" as string]: `${gx}px` }}>
                  {order.map((title, i) => (
                    <SortCell key={title} title={title} t={list.find((t) => same(t.title, title))} cut={i >= shown} cache={cache} i={i} drag={drag} over={over} setDrag={setDrag} setOver={setOver} move={move} />
                  ))}
                </div>
                <span className="hint">Drag a trophy onto another place to move it. Same columns and rows as the card{o.rows > 0 && order.length > shown ? "; the faded ones are cut by the rows limit" : ""}.</span>
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
                    <TrophyTile key={t.title} t={t} cache={cache} on={titles.some((x) => same(x, t.title))} onClick={() => toggle(t)} />
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
