import { useEffect, useState, type ReactNode } from "react";
import { SECTIONS } from "../../core";
import { fieldsOf, groupsOf, type Field, type Group } from "../../schema/fields";
import { isSet, useRaw } from "../../store/config";
import { useUi } from "../../store/ui";
import { AboutEditor, LinksEditor, StackEditor, WorkingEditor } from "../editors/ContentEditors";
import { DataBlock } from "../editors/DataBlock";
import { ImportExport } from "../editors/ImportExport";
import { LayoutEditor } from "../editors/LayoutEditor";
import { PresetGallery } from "../editors/PresetGallery";
import { PublishPanel } from "../editors/PublishPanel";
import { ColorsEditor, CustomThemes, ThemeGallery, ThemeSlots } from "../editors/ThemeEditor";
import { FieldList, FieldView } from "../ui/Fields";
import { Icon } from "../ui/Icon";

export const Section = ({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) => (
  <section className="section">
    <h3>{title}</h3>
    {hint && <p>{hint}</p>}
    <div className="stack">{children}</div>
  </section>
);

const Collapse = ({ title, children }: { title: string; children: ReactNode }) => (
  <details className="acc">
    <summary>{title}</summary>
    <div className="acc-body" style={{ paddingTop: 12 }}>{children}</div>
  </details>
);

export const StartStep = () => (
  <>
    <Section title="Start from a preset" hint="Pick a ready-made look, then tweak it in the next steps. Your changes are saved in this browser, and you can undo anything.">
      <PresetGallery />
    </Section>
    <Section title="Your data" hint="Type your GitHub username to preview your real stats (fetched once, every edit reuses them). Without it the preview shows demo data.">
      <DataBlock />
    </Section>
    <Section title="General">
      <FieldList fields={fieldsOf("general").fields.filter((f) => f.path !== "includePrivate")} />
    </Section>
    <Section title="Import, export & share">
      <ImportExport />
    </Section>
  </>
);

export const LookStep = () => (
  <>
    <Section title="Themes" hint="Pick the slot you want to change, then click a theme. The slot names (dark / light) decide the file names, so your README never changes when you swap themes.">
      <ThemeGallery />
      <Collapse title="Slots (advanced)"><ThemeSlots /></Collapse>
    </Section>
    <Section title="Make it yours">
      <Collapse title="Color overrides"><ColorsEditor /></Collapse>
      <Collapse title="Custom themes"><CustomThemes /></Collapse>
    </Section>
    <Section title="Card" hint={fieldsOf("card").blurb}>
      <FieldList fields={fieldsOf("card").fields} />
    </Section>
  </>
);

const HIDE: Field = { type: "multi", path: "hideSections", label: "Hide sections", hint: "“rank” hides only the ring in the header", options: [...SECTIONS, "rank"] };

export const LayoutStep = () => (
  <>
    <Section title="Section order" hint="Put two sections in one row for a side-by-side layout.">
      <LayoutEditor />
    </Section>
    <Section title="Visibility">
      <FieldView field={HIDE} />
    </Section>
  </>
);

/** One collapsible group of options; opens by itself when search sends you to one of its fields. */
function Accordion({ group, first }: { group: Group; first: boolean }) {
  const raw = useRaw();
  const focus = useUi((s) => s.focusPath);
  const changed = group.fields.filter((f) => isSet(raw, f.path)).length;
  const [open, setOpen] = useState(first);
  useEffect(() => {
    if (focus && group.fields.some((f) => f.path === focus)) setOpen(true);
  }, [focus, group]);
  return (
    <details className="acc" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>
        {group.title}
        {group.blurb && <small>{group.blurb}</small>}
        {changed > 0 && <span className="badge-n">{changed} changed</span>}
      </summary>
      <div className="acc-body">
        <FieldList fields={group.fields} />
      </div>
    </details>
  );
}

export const SectionsStep = () => (
  <>
    <p className="hint" style={{ marginBottom: 14 }}>Every option of every section. A dot marks what differs from the default; <b><Icon n="reset" /> reset</b> puts one back.</p>
    {groupsOf("sections").map((g, i) => <Accordion key={g.id} group={g} first={i === 0} />)}
  </>
);

export const ContentStep = () => (
  <>
    <Section title="About" hint="Shown as a panel under the header. Leave it empty to skip it.">
      <AboutEditor />
    </Section>
    <Section title="Working on" hint="Up to four project cards.">
      <WorkingEditor />
    </Section>
    <Section title="Links" hint="Each link becomes its own clickable button image (GitHub doesn’t make links inside an SVG clickable).">
      <LinksEditor />
    </Section>
    <Section title="Tech stack" hint="Icons come from devicon (or your own image URL). They are committed to your repo under assets/img/.">
      <StackEditor />
    </Section>
  </>
);

export const PublishStep = () => <PublishPanel />;
