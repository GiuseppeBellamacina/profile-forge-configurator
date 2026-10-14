import { useEffect, useMemo, useRef, useState } from "react";
import { SECRETS, normalize, summarize } from "../../core";
import { clone } from "../../lib/path";
import { renderCard } from "../../lib/renderCard";
import { birthdayInput, birthdayOf, tiles, type Tile } from "../../lib/trophies";
import { setVal, edit, useAssets, useRaw } from "../../store/config";
import { useSession } from "../../store/session";
import { later } from "./ThemeEditor";

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function TrophyTile({ t, on, cache, onClick }: { t: Tile; on: boolean; cache: Map<string, string>; onClick: () => void }) {
  const raw = useRaw();
  const assets = useAssets();
  const profile = useSession((s) => s.profile);
  const box = useRef<HTMLButtonElement>(null);
  const [url, setUrl] = useState(cache.get(t.title) ?? "");
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setSeen(true), io.disconnect()), { rootMargin: "150px" });
    box.current && io.observe(box.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => setUrl(cache.get(t.title) ?? ""), [cache, t.title]);
  useEffect(() => {
    if (!seen || cache.has(t.title)) return;
    let live = true;
    const { grid: _grid, ...rest } = raw;
    const trophies = { ...raw.trophies, titles: [t.title], hideTitles: [], ranks: [], hideRanks: [], extra: ["Issues", "Reviews"], columns: 1, rows: 0, marginW: 0, marginH: 0, padding: 0, align: "left" };
    const secret = SECRETS.find((s) => s.title === t.title);
    // a secret you do not have is not in the data: draw it anyway (the tile is dimmed)
    const tweak = secret && ((d: any) => { d.trophies = [{ title: secret.title, rank: "SECRET", label: secret.label, score: null, progress: 1, secret: { glyph: secret.glyph, tone: secret.tone, hint: secret.hint, special: secret.special ?? null, value: null } }]; });
    later(() => renderCard({ ...rest, layout: ["trophies"], trophies, card: { ...raw.card, animations: false } }, assets, profile, null, tweak))
      .then((r) => {
        // crop to the single 110×110 trophy (x 30, y 72 = 42 inside the section + 30 top padding, in a trophies-only card)
        const svg = r.svg.replace(/(<svg[^>]*?) width="\d+" height="\d+" viewBox="[^"]*"/, '$1 width="110" height="110" viewBox="30 72 110 110"');
        const u = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
        cache.set(t.title, u);
        if (live) setUrl(u);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [seen, cache, t.title]);

  return (
    <button ref={box} type="button" className={`tile fthumb-tile${t.earned ? "" : " dim"}`} aria-pressed={on} onClick={onClick} title={t.hint}>
      <span className="fthumb">{url && <img alt="" src={url} />}</span>
      <span className="meta"><b>{t.name}</b>{t.earned && !t.secret && <small>{t.rank}</small>}</span>
    </button>
  );
}

/** Pick the trophies the card shows (writes trophies.titles / extra / birthday). Earned ones in colour, the rest faded with how to earn them on hover. */
export function TrophyPicker() {
  const raw = useRaw();
  const assets = useAssets();
  const profile = useSession((s) => s.profile);
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const titles: string[] = raw.trophies?.titles ?? [];

  const list = useMemo(() => {
    const k = normalize(clone(raw));
    k.trophies.extra = new Set(["issues", "reviews"]);
    return tiles(summarize(profile, k).trophies);
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
  const birthdayOn = titles.some((x) => same(x, "Birthday"));

  return (
    <div className="stack" style={{ marginTop: 8 }}>
      <button type="button" className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(true)}>
        Choose trophies{titles.length ? ` (${titles.length})` : ""}
      </button>
      {open && (
        <dialog ref={ref} onClose={() => setOpen(false)} onClick={(e) => e.target === ref.current && ref.current?.close()} style={{ width: "min(860px, 94vw)" }}>
          <div className="dlg-head"><b>Choose trophies</b><button className="btn sm" onClick={() => ref.current?.close()}>Close</button></div>
          <div className="dlg-body">
            <span className="log">
              In colour: trophies you have (with their level). Faded: not yet, hover one to see how to get it. Nothing selected = every earned trophy is shown.
              {titles.length > 0 && <> <button className="btn sm" onClick={() => setVal("trophies.titles", [])}>Clear selection</button></>}
            </span>
            {birthdayOn && (
              <label className="field">
                <span className="field-label">Birthday</span>
                <input type="date" value={birthdayInput(raw.trophies?.birthday)} onChange={(e) => setVal("trophies.birthday", birthdayOf(e.target.value) ?? undefined)} />
                <span className="hint">Only used for the Happy Birthday trophy, which shows on that day. Only month and day are saved.</span>
              </label>
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
