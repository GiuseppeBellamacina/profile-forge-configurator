import { beforeEach, describe, expect, it } from "vitest";
import { configStore, edit, redo, replaceConfig, resetPath, setVal, START, themeSlots, undo, valueOf } from "./config";

const raw = () => configStore.get().raw;
beforeEach(() => configStore.set({ raw: structuredClone(START), assets: {}, past: [], future: [] }));

describe("setVal", () => {
  it("drops values equal to the default so config.json stays minimal", () => {
    setVal("stats.numberFormat", "short");
    expect(raw().stats).toEqual({ numberFormat: "short" });
    setVal("stats.numberFormat", "long"); // the default
    expect(raw().stats).toBeUndefined();
  });
  it("treats empty strings and empty lists as unset", () => {
    setVal("title", "Dev");
    setVal("title", "");
    expect(raw().title).toBeUndefined();
    setVal("languages.hide", ["html"]);
    setVal("languages.hide", []);
    expect(raw().languages).toBeUndefined();
  });
  it("reads back defaults for unset fields", () => {
    expect(valueOf(raw(), "heatmap.weeks")).toBe(53);
    setVal("heatmap.weeks", 30);
    expect(valueOf(raw(), "heatmap.weeks")).toBe(30);
  });
  it("resetPath removes one field and prunes empty parents", () => {
    setVal("card.background.pattern", "dots");
    resetPath("card.background.pattern");
    expect(raw().card).toBeUndefined();
  });
});

describe("undo / redo", () => {
  it("steps back and forward", () => {
    setVal("locale", "it");
    edit((r) => (r.title = "x"));
    undo();
    expect(raw().title).toBeUndefined();
    expect(raw().locale).toBe("it");
    redo();
    expect(raw().title).toBe("x");
    undo();
    undo();
    expect(raw()).toEqual(START);
  });
  it("groups rapid edits of the same field into one step", () => {
    for (const v of ["a", "ab", "abc"]) setVal("title", v);
    expect(configStore.get().past).toHaveLength(1);
    undo();
    expect(raw().title).toBeUndefined();
  });
  it("a new edit clears the redo stack", () => {
    setVal("locale", "it");
    undo();
    setVal("locale", "de");
    expect(configStore.get().future).toHaveLength(0);
  });
  it("replaceConfig is one undoable step", () => {
    replaceConfig({ themes: ["dracula"], title: "Hi" });
    expect(raw().title).toBe("Hi");
    undo();
    expect(raw()).toEqual(START);
  });
});

describe("themeSlots", () => {
  it("normalizes the list form and the map form", () => {
    expect(themeSlots({ themes: ["dracula", "nord"] })).toEqual({ dracula: "dracula", nord: "nord" });
    expect(themeSlots({ themes: { dark: "dracula" } })).toEqual({ dark: "dracula" });
    expect(themeSlots({})).toEqual(START.themes);
  });
});
