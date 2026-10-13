import { describe, expect, it } from "vitest";
import { deletePath } from "./path";
import { configJson, mergeReadme, readmeBlock, slug, workflowYaml, MARK } from "./publish";
import { decodeShare, encodeShare } from "./share";
import { zip } from "./zip";

describe("share links", () => {
  it("round-trips a configuration with its icon urls", async () => {
    const payload = { c: { themes: { dark: "crimson" }, techStack: [{ category: "x", items: [{ name: "Py", image: "assets/img/py.svg" }] }] }, a: { "assets/img/py.svg": { url: "https://cdn.example/py.svg" } } };
    const token = await encodeShare(payload);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/); // safe inside a URL fragment
    expect(await decodeShare(token)).toEqual(payload);
  });
  it("rejects garbage", async () => {
    await expect(decodeShare("not-a-link")).rejects.toThrow();
  });
});

describe("README block", () => {
  const raw = { themes: { dark: "crimson", light: "crimson-light" }, links: [{ label: "Linked In", url: "https://x.dev" }] };
  it("builds a dark/light <picture> and one button per link", () => {
    const b = readmeBlock(raw);
    expect(b).toContain('srcset="assets/profile-forge-dark.svg"');
    expect(b).toContain("assets/buttons/linked-in-light.svg");
  });
  it("replaces its own block and keeps the rest", () => {
    const first = mergeReadme("# Hi\n", readmeBlock(raw));
    expect(first.startsWith(MARK[0])).toBe(true);
    const second = mergeReadme(first, readmeBlock({ themes: { dark: "nord" } }));
    expect(second.match(/profile-forge:start/g)).toHaveLength(1);
    expect(second).toContain("# Hi");
    expect(second).not.toContain("crimson");
  });
});

describe("generated files", () => {
  it("workflow honours the ref, hour and trigger", () => {
    const y = workflowYaml({ ref: "v2", hour: 5, onConfigChange: false });
    expect(y).toContain("profile-forge@v2");
    expect(y).toContain('cron: "17 5 * * *"');
    expect(y).not.toContain("paths: [config.json]");
    expect(workflowYaml()).toContain("paths: [config.json]");
  });
  it("config.json carries the schema url first", () => {
    expect(configJson({ locale: "it" }).split("\n")[1]).toContain("$schema");
  });
  it("slug", () => expect(slug("C++ / Go")).toBe("c-go"));
});

describe("zip", () => {
  it("writes a valid archive signature and entry count", async () => {
    const buf = new Uint8Array(await zip([{ path: "a.txt", bytes: new TextEncoder().encode("hi") }]).arrayBuffer());
    expect([...buf.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect([...buf.slice(-22, -18)]).toEqual([0x50, 0x4b, 0x05, 0x06]);
  });
});

describe("deletePath", () => {
  it("prunes empty parents", () => {
    const o = { a: { b: { c: 1 } }, d: 2 };
    deletePath(o, "a.b.c");
    expect(o).toEqual({ d: 2 });
  });
});
