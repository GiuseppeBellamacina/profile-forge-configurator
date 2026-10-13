import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/publish", async (orig) => ({
  ...(await orig<typeof import("../lib/publish")>()),
  api: { repo: vi.fn(), file: vi.fn(), tree: vi.fn() },
}));

import { api } from "../lib/publish";
import { configStore } from "./config";
import { importFromRepo, importStore } from "./repoImport";

const mocked = api as unknown as Record<"repo" | "file" | "tree", ReturnType<typeof vi.fn>>;
const config = {
  $schema: "x", themes: { dark: "dracula" }, card: { radius: 33 },
  techStack: [{ category: "T", items: [{ name: "py", image: "assets/img/python.svg" }, { name: "big", image: "assets/img/huge.png" }, { name: "x", image: "assets/img/gone.svg" }] }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocked.repo.mockResolvedValue({ default_branch: "main" });
  mocked.file.mockImplementation(async (_t: string, _o: string, _r: string, path: string) =>
    path === "config.json" ? { text: JSON.stringify(config), sha: "1" } : path === "README.md" ? { text: "# hi\n", sha: "2" } : null);
  mocked.tree.mockResolvedValue([{ path: "assets/img/python.svg", size: 2000 }, { path: "assets/img/huge.png", size: 5_000_000 }, { path: "README.md", size: 10 }]);
});

describe("importFromRepo", () => {
  it("loads the config, only the images it uses (within limits) and the README", async () => {
    await importFromRepo("tok", "ada");
    const s = importStore.get();
    expect(s.error).toBe("");
    expect(s.readme).toBe("# hi\n");
    expect(s.report?.configFile).toBe("config.json");
    expect(s.report?.loaded).toEqual(["assets/img/python.svg"]);
    expect(s.report?.skipped.map((x) => x.path)).toEqual(["assets/img/huge.png", "assets/img/gone.svg"]);
    expect(configStore.get().raw.card.radius).toBe(33);
    expect(configStore.get().raw.$schema).toBeUndefined();
    expect(configStore.get().assets["assets/img/python.svg"].url).toBe("https://raw.githubusercontent.com/ada/ada/main/assets/img/python.svg");
    expect(mocked.tree).toHaveBeenCalledTimes(1); // one request for every size, no per-file download
  });

  it("keeps the current configuration when the repo has an invalid config", async () => {
    mocked.file.mockImplementation(async (_t: string, _o: string, _r: string, path: string) => (path === "config.json" ? { text: '{"nope": 1}', sha: "1" } : null));
    const before = JSON.stringify(configStore.get().raw);
    await importFromRepo("tok", "ada");
    expect(importStore.get().report?.configError).toMatch(/nope/);
    expect(JSON.stringify(configStore.get().raw)).toBe(before);
  });

  it("reports a missing config and a missing repository", async () => {
    mocked.file.mockResolvedValue(null);
    await importFromRepo("tok", "ada");
    expect(importStore.get().report?.configFile).toBeNull();
    mocked.repo.mockResolvedValue(null);
    await importFromRepo("tok", "ada");
    expect(importStore.get().error).toMatch(/does not exist/);
  });
});
