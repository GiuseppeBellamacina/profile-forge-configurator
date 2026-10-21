import type { Box } from "../core";
import { session } from "../lib/storage";
import { createStore, useStore } from "./store";

export const STEPS = [
  { id: "start", title: "Start", hint: "Preset, data, general" },
  { id: "look", title: "Look", hint: "Themes & colors" },
  { id: "layout", title: "Layout", hint: "Sections & order" },
  { id: "sections", title: "Details", hint: "Every section's options" },
  { id: "content", title: "Content", hint: "About, projects, stack" },
  { id: "publish", title: "Publish", hint: "Send it to GitHub" },
] as const;
export type StepId = (typeof STEPS)[number]["id"];

// ?step=look opens a step directly (handy for links and screenshots); otherwise the last one, kept across the sign-in redirect.
const saved = new URLSearchParams(location.search).get("step") ?? session.get<string>("pf:tab");
type Ui = { step: StepId; slot: string | null; focusPath: string | null; sheetOpen: boolean; query: string; boxes: Box[]; refit: number };
export const uiStore = createStore<Ui>({
  step: STEPS.some((s) => s.id === saved) ? (saved as StepId) : "start",
  slot: null,
  focusPath: null,
  sheetOpen: false,
  query: "",
  refit: 0, // bumped when a preset is loaded: the preview zooms to show the whole card again
  boxes: [], // where the sections landed in the last render (the grid editor needs their natural heights)
});

export const setStep = (step: StepId) => {
  uiStore.set({ step });
  session.set("pf:tab", step);
  document.getElementById("editor-scroll")?.scrollTo({ top: 0 });
};
export const useUi = <S,>(select: (s: Ui) => S) => useStore(uiStore, select);

/** Jump to a field in another step and flash it. */
export function focusField(step: StepId, path: string) {
  setStep(step);
  uiStore.set({ focusPath: path, query: "" });
  setTimeout(() => {
    document.getElementById(`field-${path}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(() => uiStore.set({ focusPath: null }), 1800);
  }, 60);
}
