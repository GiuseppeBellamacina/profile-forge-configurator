import { useEffect, useRef, useState } from "react";
import { FLAGS, imgSrc } from "../../lib/assets";
import { addAssets, setVal, useAssets, useRaw } from "../../store/config";

type Country = { code: string; name: string };
let cache: Country[] | null = null;
const load = async () => (cache ??= (await (await fetch(`${FLAGS}/country.json`)).json()) as Country[]);

/** Pick a country flag for the header. The svg is added like a tech stack icon: it is saved in the repo as assets/img/flag.svg. */
export function FlagPicker() {
  const raw = useRaw();
  const assets = useAssets();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState<Country[] | null>(null);
  const [q, setQ] = useState("");
  const flag: string | undefined = raw.header?.flag ?? undefined;

  useEffect(() => {
    if (!open) return;
    ref.current?.showModal();
    load().then(setAll).catch(() => setAll([]));
  }, [open]);

  const pick = (c: Country) => {
    const file = "assets/img/flag.svg"; // always the same file: a new flag replaces the old one in the repo
    addAssets({ [file]: { url: `${FLAGS}/flags/4x3/${c.code}.svg` } });
    setVal("header.flag", file);
    ref.current?.close();
  };
  const s = q.trim().toLowerCase();
  const list = (all ?? []).filter((c) => !s || c.name.toLowerCase().includes(s) || c.code === s).slice(0, 120);

  return (
    <div className="row" style={{ marginTop: 8 }}>
      <button type="button" className="btn primary" onClick={() => setOpen(true)}>{flag ? "Change flag" : "Choose a flag"}</button>
      {flag && (
        <>
          <img src={imgSrc(assets, flag)} alt="" height={20} style={{ borderRadius: 3 }} />
          <button type="button" className="btn sm" onClick={() => setVal("header.flag", null)}>Remove flag</button>
        </>
      )}
      {open && (
        <dialog ref={ref} onClose={() => setOpen(false)} onClick={(e) => e.target === ref.current && ref.current?.close()}>
          <div className="dlg-head"><b>Choose a flag</b><button className="btn sm" onClick={() => ref.current?.close()}>Close</button></div>
          <div className="dlg-body">
            <input type="search" autoFocus placeholder="Search a country (italy, japan…)" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="pk-grid">
              {list.map((c) => (
                <button key={c.code} type="button" title={c.name} onClick={() => pick(c)}>
                  <img src={`${FLAGS}/flags/4x3/${c.code}.svg`} loading="lazy" alt="" />
                  {c.name}
                </button>
              ))}
              {!all && <span className="log">Loading flags…</span>}
              {all && !list.length && <span className="log">No country matches.</span>}
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
