import { useEffect, useState, type ReactNode } from "react";
import { DEFAULTS } from "../../core";
import { getPath } from "../../lib/path";
import type { Field } from "../../schema/fields";
import { isSet, resetPath, setVal, useRaw, valueOf } from "../../store/config";
import { useUi } from "../../store/ui";

/** Keeps what the user is typing, and only re-syncs from the store when the value changed from outside (undo, reset, preset). */
function useDraft(stored: string, commit: (v: string) => void) {
  const [draft, setDraft] = useState(stored);
  useEffect(() => {
    setDraft((d) => (d.trim() === stored.trim() ? d : stored));
  }, [stored]);
  return [draft, (v: string) => (setDraft(v), commit(v))] as const;
}

/** Label, "modified" dot and per-field reset around any control. */
export function Shell({ path, label, hint, children, inline }: { path: string; label: string; hint?: string; children: ReactNode; inline?: boolean }) {
  const raw = useRaw();
  const flash = useUi((s) => s.focusPath === path);
  const set = isSet(raw, path);
  const head = (
    <span className="field-label">
      {set && <span className="dot" title="Different from the default" />}
      <span>
        {label}
        {hint && <small> {hint}</small>}
      </span>
      {set && (
        <button type="button" className="reset" title="Reset to default" onClick={(e) => (e.preventDefault(), resetPath(path))}>
          ↺ reset
        </button>
      )}
    </span>
  );
  return (
    <label className={`field${inline ? " inline" : ""}${flash ? " flash" : ""}`} id={`field-${path}`}>
      {head}
      {children}
    </label>
  );
}

const show = (v: unknown) => (v === null || v === undefined ? "default" : String(v));

export function FieldView({ field }: { field: Field }) {
  const raw = useRaw();
  const { path } = field;
  const def = getPath(DEFAULTS, path);
  const cur = valueOf(raw, path);
  const own = getPath(raw, path);

  switch (field.type) {
    case "text":
      return <TextControl field={field} stored={own ?? ""} def={def} />;
    case "number":
      return <NumberControl field={field} stored={own === undefined ? "" : String(own)} def={def} />;
    case "list":
      return <ListControl field={field} stored={Array.isArray(own) ? own.join(", ") : ""} />;
    case "bool":
      return (
        <Shell path={path} label={field.label} hint={field.hint} inline>
          <button type="button" role="switch" aria-checked={!!cur} className="toggle" onClick={() => setVal(path, !cur)} />
        </Shell>
      );
    case "select": {
      const idx = field.options.findIndex((o) => o === cur);
      return (
        <Shell path={path} label={field.label} hint={field.hint}>
          <select value={idx < 0 ? 0 : idx} onChange={(e) => setVal(path, field.options[Number(e.target.value)])}>
            {field.options.map((o, i) => (
              <option key={i} value={i}>
                {show(o)}
                {o === def && o !== null ? " (default)" : ""}
              </option>
            ))}
          </select>
        </Shell>
      );
    }
    case "multi": {
      const sel = new Set<string>(Array.isArray(cur) ? cur : []);
      const toggle = (o: string) => {
        const next = new Set(sel);
        next.has(o) ? next.delete(o) : next.add(o);
        if (field.max && next.size > field.max) return;
        setVal(path, field.options.filter((x) => next.has(x)));
      };
      return (
        <Shell path={path} label={field.label} hint={field.hint}>
          <span className="chips">
            {field.options.map((o) => (
              <button type="button" key={o} className="chip" aria-pressed={sel.has(o)} onClick={(e) => (e.preventDefault(), toggle(o))}>
                {o}
              </button>
            ))}
          </span>
        </Shell>
      );
    }
  }
}

function TextControl({ field, stored, def }: { field: Extract<Field, { type: "text" }>; stored: string; def: unknown }) {
  const [draft, setDraft] = useDraft(stored, (v) => setVal(field.path, v.trim() || undefined));
  return (
    <Shell path={field.path} label={field.label} hint={field.hint}>
      <input type="text" value={draft} list={field.list === "timezones" ? "timezones" : undefined} placeholder={field.placeholder ?? (def == null ? "" : String(def))} onChange={(e) => setDraft(e.target.value)} />
    </Shell>
  );
}

function NumberControl({ field, stored, def }: { field: Extract<Field, { type: "number" }>; stored: string; def: unknown }) {
  const [draft, setDraft] = useDraft(stored, (v) => setVal(field.path, v === "" ? undefined : Number(v)));
  return (
    <Shell path={field.path} label={field.label} hint={field.hint}>
      <input type="number" min={field.min} max={field.max} step={field.step ?? 1} value={draft} placeholder={def == null ? "default" : String(def)} onChange={(e) => setDraft(e.target.value)} />
    </Shell>
  );
}

function ListControl({ field, stored }: { field: Extract<Field, { type: "list" }>; stored: string }) {
  const [draft, setDraft] = useDraft(stored, (v) => setVal(field.path, v.split(",").map((x) => x.trim()).filter(Boolean)));
  return (
    <Shell path={field.path} label={field.label} hint={field.hint ?? "comma separated"}>
      <input type="text" value={draft} placeholder={field.placeholder} onChange={(e) => setDraft(e.target.value)} />
    </Shell>
  );
}

/** A group's fields in one list. */
export const FieldList = ({ fields }: { fields: Field[] }) => (
  <>
    {fields.map((f) => (
      <FieldView key={f.path} field={f} />
    ))}
  </>
);
