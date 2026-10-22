import { edit, useRaw } from "../../store/config";
import { useSession } from "../../store/session";
import { Icon } from "../ui/Icon";

type Org = { login: string; avatar: string | null; contributions: number; stars: number };
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const has = (list: string[], login: string) => list.some((x) => same(x, login));

/** Every organization is on the card by default, new ones too: a click hides one (orgs.hide). With sort "custom" the arrows set orgs.order. */
export function OrgPicker() {
  const raw = useRaw();
  const orgs: Org[] = useSession((s) => s.profile)?.orgs ?? [];
  const o = raw.orgs ?? {};
  const select: string[] = o.select ?? [];
  const hide: string[] = o.hide ?? [];
  const custom = o.sort === "custom";
  if (!orgs.length) return <span className="hint">No organizations found in the loaded profile.</span>;

  const on = (login: string) => (!select.length || has(select, login)) && !has(hide, login);
  // an old whitelist (select) becomes "hide the others", so organizations you contribute to later still appear
  const explicit = (r: Record<string, any>) => {
    const t = (r.orgs ??= {});
    if (t.select?.length) {
      t.order ??= t.select;
      t.hide = orgs.filter((x) => !has(t.select, x.login)).map((x) => x.login);
      delete t.select;
    }
    return t;
  };
  const toggle = (login: string) => edit((r) => {
    const t = explicit(r);
    const h: string[] = t.hide ?? [];
    t.hide = has(h, login) ? h.filter((x) => !same(x, login)) : [...h, login];
    if (!t.hide.length) delete t.hide;
  });
  const ord: string[] = o.order?.length ? o.order : select;
  const at = (login: string) => { const i = ord.findIndex((x) => same(x, login)); return i < 0 ? Infinity : i; };
  const list = custom ? [...orgs].sort((a, b) => at(a.login) - at(b.login)) : orgs;
  const shown = list.filter((x) => on(x.login)).map((x) => x.login);
  const move = (login: string, d: number) => edit((r) => {
    const cur = [...shown];
    const i = cur.findIndex((x) => same(x, login));
    if (i + d < 0 || i + d >= cur.length) return;
    cur.splice(i + d, 0, cur.splice(i, 1)[0]);
    explicit(r).order = cur;
  });

  return (
    <div className="stack">
      <span className="hint">Every organization is shown, also the ones you contribute to later. Click one to hide it.{custom ? " The arrows set the order." : " Set Order to “custom” to arrange them by hand."}</span>
      <div className="orglist">
        {list.map((x) => {
          const vis = on(x.login);
          const i = shown.findIndex((s) => same(s, x.login));
          return (
            <div key={x.login} className={`orgrow${vis ? "" : " off"}`}>
              <button type="button" className="orgtag" aria-pressed={vis} onClick={() => toggle(x.login)} title={vis ? "On the card: click to hide" : "Hidden: click to show"}>
                {x.avatar ? <img src={x.avatar} alt="" /> : <span className="orglogo">{x.login[0].toUpperCase()}</span>}
                <b>@{x.login}</b>
                <small>{x.contributions} contrib. · {x.stars}★</small>
                <span className={`tbadge ${vis ? "on" : "off"}`}>{vis ? "✓ On card" : "Hidden"}</span>
              </button>
              {custom && vis && (
                <span className="row" style={{ gap: 4 }}>
                  <button type="button" className="btn sm icon" disabled={i === 0} aria-label={`Move ${x.login} up`} onClick={() => move(x.login, -1)}><Icon n="up" /></button>
                  <button type="button" className="btn sm icon" disabled={i === shown.length - 1} aria-label={`Move ${x.login} down`} onClick={() => move(x.login, 1)}><Icon n="down" /></button>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
