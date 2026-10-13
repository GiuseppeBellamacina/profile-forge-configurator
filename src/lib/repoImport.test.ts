import { describe, expect, it } from "vitest";
import { LIMITS, pickAssets, readmeDocument, usedAssets } from "./repoImport";

describe("usedAssets", () => {
  it("lists only the repo images the tech stack really uses", () => {
    const raw = {
      techStack: [
        { category: "A", items: [{ name: "py", image: "assets/img/python.svg" }, { name: "py2", image: "assets/img/python.svg" }, { name: "cdn", image: "https://cdn.example/x.svg" }] },
        { category: "B", items: [{ name: "go", image: "./assets/img/go.svg" }, { name: "inline", image: "data:image/svg+xml;base64,AAAA" }] },
      ],
    };
    expect(usedAssets(raw)).toEqual(["assets/img/python.svg", "./assets/img/go.svg"]);
    expect(usedAssets({})).toEqual([]);
  });
});

describe("pickAssets", () => {
  const url = (p: string) => `https://raw.example/${p}`;
  it("loads what fits and explains what it skipped", () => {
    const sizes = new Map([["a.svg", 1000], ["big.png", LIMITS.fileBytes + 1], ["b.svg", 2000]]);
    const r = pickAssets(["a.svg", "./b.svg", "big.png", "missing.svg"], sizes, url);
    expect(r.loaded).toEqual(["a.svg", "./b.svg"]);
    expect(r.assets["./b.svg"].url).toBe("https://raw.example/b.svg");
    expect(r.skipped.map((s) => s.path)).toEqual(["big.png", "missing.svg"]);
    expect(r.skipped[0].reason).toMatch(/too large/);
    expect(r.totalBytes).toBe(3000);
  });
  it("caps the number of files and the total size", () => {
    const many = Array.from({ length: 5 }, (_, i) => `f${i}.svg`);
    const sizes = new Map(many.map((p) => [p, 500_000]));
    const r = pickAssets(many, sizes, url, { files: 3, fileBytes: 1_000_000, totalBytes: 1_200_000 });
    expect(r.loaded).toEqual(["f0.svg", "f1.svg"]); // third would pass 1.2 MB
    expect(r.skipped.map((s) => s.reason)).toEqual([expect.stringMatching(/total size/), expect.stringMatching(/total size/), expect.stringMatching(/total size/)]);
    const cap = pickAssets(many, sizes, url, { files: 2, fileBytes: 1_000_000, totalBytes: 9_000_000 });
    expect(cap.skipped[0].reason).toMatch(/more than 2 files/);
  });
});

describe("readmeDocument", () => {
  const html = '<p>hi</p><picture><source media="(prefers-color-scheme: dark)" srcset="assets/profile-forge-dark.svg"><img src="assets/profile-forge-light.svg" alt="card"></picture><img src="assets/img/other.png">';
  it("swaps the card for the one being edited, per tone, and keeps other images", () => {
    const cards = { dark: "data:image/svg+xml;base64,DARK", light: "data:image/svg+xml;base64,LIGHT" };
    const d = readmeDocument(html, { cards, tone: "dark", base: "https://raw.example/o/r/main/" });
    expect(d).toContain('src="data:image/svg+xml;base64,DARK"');
    expect(d).not.toContain("<source");
    expect(d).toContain('src="assets/img/other.png"');
    expect(d).toContain('<base href="https://raw.example/o/r/main/">');
    expect(readmeDocument(html, { cards, tone: "light", base: "x/" })).toContain("LIGHT");
  });
  it("falls back to the only slot when the tone has none", () => {
    expect(readmeDocument(html, { cards: { dark: "data:DARK" }, tone: "light", base: "x/" })).toContain('src="data:DARK"');
  });
});
