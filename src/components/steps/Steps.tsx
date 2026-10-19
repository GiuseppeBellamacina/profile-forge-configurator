import { useEffect, useState, type ReactNode } from "react";
import { DEFAULTS } from "../../core";
import { fieldsOf, groupsOf, type Group } from "../../schema/fields";
import { isSet, useRaw } from "../../store/config";
import { useUi } from "../../store/ui";
import { AboutEditor, LinksEditor, StackEditor, TerminalEditor, WorkingEditor } from "../editors/ContentEditors";
import { DataBlock } from "../editors/DataBlock";
import { ImportExport } from "../editors/ImportExport";
import { FlagPicker } from "../editors/FlagPicker";
import { TrophyPicker } from "../editors/TrophyPicker";
import { FrameGallery } from "../editors/FrameGallery";
import { ImportFromRepo } from "../editors/ImportFromRepo";
import { LevelColors } from "../editors/LevelColors";
import { GridEditor, UseGrid } from "../editors/GridEditor";
import { LayoutEditor } from "../editors/LayoutEditor";
import { PresetGallery } from "../editors/PresetGallery";
import { PublishPanel } from "../editors/PublishPanel";
import { AdvancedSlots, ColorsEditor, CustomThemes, ThemeGallery } from "../editors/ThemeEditor";
import { FieldList } from "../ui/Fields";

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
    <Section title="Start from a preset">
      <PresetGallery />
    </Section>
    <Section title="Your data">
      <DataBlock />
    </Section>
    <Section title="Import my current setup">
      <ImportFromRepo />
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
    <Section title="Themes">
      <ThemeGallery />
      <AdvancedSlots />
    </Section>
    <Section title="Make it yours">
      <Collapse title="Level colors"><LevelColors /></Collapse>
      <Collapse title="Color overrides"><ColorsEditor /></Collapse>
      <Collapse title="Custom themes"><CustomThemes /></Collapse>
    </Section>
    <Section title="Card">
      <FieldList fields={fieldsOf("card").fields} />
    </Section>
  </>
);

export function LayoutStep() {
  const grid = useRaw().grid;
  return (
    <>
      <Section title={grid ? "Arrange the card" : "Section order"}>
        {grid ? <GridEditor /> : <><UseGrid /><LayoutEditor /></>}
      </Section>
    </>
  );
}

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
        {changed > 0 && <span className="badge-n">{changed} changed</span>}
      </summary>
      <div className="acc-body">
        {group.id === "trophies" && <TrophyPicker />}
        {group.id === "header" && <FlagPicker />}
        <FieldList fields={group.fields} />
        {group.id === "header" && raw.header?.avatar !== "hide" && <FrameGallery />}
        {group.id === "techStack" && <StackEditor />}
        {group.id === "terminal" && <TerminalEditor />}
      </div>
    </details>
  );
}

/** Only the sections that are in the card, in the order of the card. */
export function SectionsStep() {
  const raw = useRaw();
  const groups = groupsOf("sections");
  const shown: Group[] = (raw.layout ?? DEFAULTS.layout).flat().flatMap((id: string) => groups.filter((g) => g.id === id));
  return <>{shown.map((g, i) => <Accordion key={g.id} group={g} first={i === 0} />)}</>;
}

export const ContentStep = () => (
  <>
    <Section title="About">
      <AboutEditor />
    </Section>
    <Section title="Working on">
      <WorkingEditor />
    </Section>
    <Section title="Links">
      <LinksEditor />
    </Section>
    <Section title="Terminal">
      <TerminalEditor />
    </Section>
    <Section title="Tech stack">
      <StackEditor />
    </Section>
  </>
);

export const PublishStep = () => <PublishPanel />;
