import { setVal, useRaw } from "../../store/config";
import { useSession } from "../../store/session";
import { Icon } from "../ui/Icon";

type Org = { login: string; avatar: string | null; contributions: number; stars: number };
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Which organizations the card shows (orgs.select: empty = all) and, with sort "custom", in which order. */
export function OrgPicker() {
  const raw = useRaw();
  const orgs: Org[] = useSession((s) => s.profile)?.orgs ?? [];
  const select: string[] = raw.orgs?.select ?? [];
  const custom = raw.orgs?.sort === "custom";
  if (!orgs.length) return <span className="hint">No organizations found in the loaded profile.</span>;

  const on = (login: string) => !select.length || select.some((x) => same(x, login));
  const toggle = (login: string) => {
    const cur = select.length ? select : orgs.map((o) => o.login);
    const next = on(login) ? cur.filter((x) => !same(x, login)) : [...cur, login];
    setVal("orgs.select", next.length === orgs.length && !custom ? [] : next);
  };
  const ordered = custom && select.length ? [...orgs].sort((a, b) => select.findIndex((x) => same(x, a.login)) - select.findIndex((x) => same(x, b.login))) : orgs;
  const move = (i: number, to: number) => {
    const cur = ordered.filter((o) => on(o.login)).map((o) => o.login);
    if (to < 0 || to >= cur.length) return;
    cur.splice(to, 0, cur.splice(i, 1)[0]);
    setVal("orgs.select", cur);
  };
  let n = -1;
  return (
    <div className="stack">
      <span className="hint">Untick an organization to hide it.{custom ? " The arrows set the order." : " Set Order to “custom” to arrange them by hand."}</span>
      <div className="list">
        {ordered.map((o) => {
          const shown = on(o.login);
          const i = shown ? ++n : -1;
          return (
            <label className="item" key={o.login}>
              <input type="checkbox" checked={shown} onChange={() => toggle(o.login)} />
              {o.avatar && <img src={o.avatar} alt="" width={20} height={20} style={{ borderRadius: "50%" }} />}
              <span className="grow">{o.login}</span>
              <span className="hint">{o.contributions} contrib. · {o.stars}★</span>
              {custom && shown && (
                <>
                  <button type="button" className="btn sm icon" aria-label={`Move ${o.login} up`} onClick={(e) => (e.preventDefault(), move(i, i - 1))}><Icon n="up" /></button>
                  <button type="button" className="btn sm icon" aria-label={`Move ${o.login} down`} onClick={(e) => (e.preventDefault(), move(i, i + 1))}><Icon n="down" /></button>
                </>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
