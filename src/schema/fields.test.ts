import { describe, expect, it } from "vitest";
import { COLOR_NAMES, DEFAULTS, normalize, setPath } from "../core";
import { getPath } from "../lib/path";
import { ALL_FIELDS, searchFields, type Field } from "./fields";

// The form is generated from this table, so it must never drift from what profile-forge accepts.
const sample = (f: Field): unknown => {
  switch (f.type) {
    case "text": return f.path === "card.background.gradient" ? "35,aaaaaa,bbbbbb" : f.path === "timezone" ? "Europe/Rome" : "x";
    case "number": return f.min ?? 1;
    case "bool": return true;
    case "color": return "ff8a3d";
    case "select": return f.options.find((o) => o !== null) ?? null;
    case "multi": return [f.options[0]];
    case "list": return ["a"];
  }
};

describe("fields table", () => {
  it("has unique paths", () => {
    const paths = ALL_FIELDS.map((f) => f.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
  it.each(ALL_FIELDS.map((f) => [f.path, f] as const))("%s exists in the profile-forge defaults and accepts a sample value", (path, f) => {
    if (f.type === "color") expect(COLOR_NAMES).toContain(path.split(".")[1]); // colour overrides live under colors.<name>
    else expect(getPath(DEFAULTS, path)).not.toBeUndefined();
    const raw = setPath({}, path, sample(f));
    expect(() => normalize(structuredClone(raw))).not.toThrow();
  });
  it("every select / multi option is accepted by the core", () => {
    for (const f of ALL_FIELDS) {
      if (f.type === "select") for (const o of f.options) expect(() => normalize(setPath({}, f.path, o))).not.toThrow();
      if (f.type === "multi") for (const o of f.options) expect(() => normalize(setPath({}, f.path, [o]))).not.toThrow();
    }
  });
});

describe("searchFields", () => {
  it("finds options by label, path and group", () => {
    expect(searchFields("trophies columns")[0]?.path).toBe("trophies.columns");
    expect(searchFields("radius").some((f) => f.path === "card.radius")).toBe(true);
    expect(searchFields("heatmap").length).toBeGreaterThan(3);
    expect(searchFields("zzzz")).toEqual([]);
    expect(searchFields("")).toEqual([]);
  });
});
