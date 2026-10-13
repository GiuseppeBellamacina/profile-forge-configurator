// Importing the user's current setup from <login>/<login>: config.json, the images it uses, and the README.
import { normalize } from "../core";
import { api } from "../lib/publish";
import { clone } from "../lib/path";
import { pickAssets, usedAssets, type Skipped } from "../lib/repoImport";
import { addAssets, replaceConfig } from "./config";
import { createStore, useStore } from "./store";

export type ImportReport = {
  repo: string; branch: string; configFile: string | null; configError: string;
  used: number; loaded: string[]; skipped: Skipped[]; truncated: boolean; hasReadme: boolean;
};
type S = { loading: boolean; error: string; report: ImportReport | null; readme: string | null; branch: string; repo: string };
export const importStore = createStore<S>({ loading: false, error: "", report: null, readme: null, branch: "", repo: "" });
export const useImport = <T,>(select: (s: S) => T) => useStore(importStore, select);

/** Pulls the user's existing profile-forge setup. Replaces the current configuration only if the repo has a valid config. */
export async function importFromRepo(token: string, login: string) {
  importStore.set({ loading: true, error: "", report: null });
  try {
    const repo = await api.repo(token, login, login);
    if (!repo) throw new Error(`${login}/${login} does not exist yet. Publish once to create it, or start from a preset.`);
    const branch: string = repo.default_branch;
    const rawUrl = (p: string) => `https://raw.githubusercontent.com/${login}/${login}/${branch}/${p.split("/").map(encodeURIComponent).join("/")}`;
    const report: ImportReport = { repo: `${login}/${login}`, branch, configFile: null, configError: "", used: 0, loaded: [], skipped: [], truncated: false, hasReadme: false };

    const readme = (await api.file(token, login, login, "README.md", branch))?.text ?? null;
    report.hasReadme = readme !== null;

    for (const name of ["config.json", "profile.json"]) {
      const f = await api.file(token, login, login, name, branch);
      if (!f) continue;
      report.configFile = name;
      try {
        const cfg = JSON.parse(f.text);
        delete cfg.$schema;
        normalize(clone(cfg)); // names the offending key when the file is invalid
        // only the images this config uses, read from the repo's file list (one request), with limits
        const used = usedAssets(cfg);
        report.used = used.length;
        let picked = { assets: {}, loaded: [] as string[], skipped: [] as Skipped[] };
        if (used.length) {
          const files = await api.tree(token, login, login, branch);
          report.truncated = files.length >= 100_000;
          picked = pickAssets(used, new Map(files.map((x) => [x.path, x.size])), rawUrl);
        }
        report.loaded = picked.loaded;
        report.skipped = picked.skipped;
        replaceConfig(cfg);
        addAssets(picked.assets);
      } catch (e: any) {
        report.configError = e.message;
      }
      break;
    }
    importStore.set({ loading: false, report, readme, branch, repo: `${login}/${login}` });
  } catch (e: any) {
    importStore.set({ loading: false, error: e.message + (e.hint ? ` ${e.hint}` : "") });
  }
}
