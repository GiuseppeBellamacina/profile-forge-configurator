import { useEffect } from "react";
import { Stepper, StepNav, TopBar } from "./components/Chrome";
import { Preview } from "./components/Preview";
import { ContentStep, LayoutStep, LookStep, PublishStep, SectionsStep, StartStep } from "./components/steps/Steps";
import { decodeShare } from "./lib/share";
import { configStore, redo, replaceConfig, undo } from "./store/config";
import { bootSession, loadProfile, sessionStore } from "./store/session";
import { STEPS, useUi } from "./store/ui";

const BODY = { start: StartStep, look: LookStep, layout: LayoutStep, sections: SectionsStep, content: ContentStep, publish: PublishStep };

/** Open a shared link (#c=…) once; the sign-in fragment (#pf_token=…) is handled first by bootSession. */
async function bootShare() {
  const c = new URLSearchParams(location.hash.slice(1)).get("c");
  if (!c) return;
  history.replaceState(null, "", location.pathname + location.search);
  try {
    const shared = await decodeShare(c);
    replaceConfig(shared.c, shared.a);
  } catch (e: any) {
    alert(`This share link could not be opened: ${e.message}`);
  }
}

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export default function App() {
  const step = useUi((s) => s.step);
  const Body = BODY[step];
  const meta = STEPS.find((s) => s.id === step)!;

  useEffect(() => {
    bootSession().then((hadAuth) => (hadAuth ? undefined : bootShare()));

    // Ctrl/Cmd+Z / Y undo and redo the configuration, unless a text field has focus (it keeps its own undo).
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || typing(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) (e.preventDefault(), undo());
      else if (k === "y" || (k === "z" && e.shiftKey)) (e.preventDefault(), redo());
    };
    addEventListener("keydown", onKey);

    // Private repositories change the numbers, so this is the only option that re-fetches the profile (once per value).
    let priv = !!configStore.get().raw.includePrivate;
    const off = configStore.subscribe(() => {
      const now = !!configStore.get().raw.includePrivate;
      const f = sessionStore.get().fetched;
      if (now !== priv && f) loadProfile(f.login).catch(() => {});
      priv = now;
    });
    return () => (removeEventListener("keydown", onKey), off());
  }, []);

  return (
    <div className="app">
      <TopBar />
      <main className="main">
        <section className="editor" aria-label="Options">
          <Stepper />
          <div className="editor-scroll" id="editor-scroll">
            <div className="step-head">
              <h2>{meta.title}</h2>
              <p>{meta.hint}</p>
            </div>
            <Body />
          </div>
          <StepNav />
        </section>
        <Preview />
      </main>
      <datalist id="timezones">{(Intl.supportedValuesOf?.("timeZone") ?? ["UTC"]).map((z) => <option key={z} value={z} />)}</datalist>
    </div>
  );
}
