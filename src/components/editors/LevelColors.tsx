import { getPath } from "../../lib/path";
import { setVal, themeSlots, useRaw } from "../../store/config";
import { ColorWidget } from "./ThemeEditor";

const LEVELS: [string, string][] = [["levelE", "E"], ["levelD", "D"], ["levelC", "C"], ["levelB", "B"], ["levelA", "A"], ["levelS", "S"], ["levelTop", "SSS"], ["levelX", "X (top 0.1%)"]];

/** One colour per letter ("+" is a little brighter, "-" a little duller); they colour the rank, the trophies and an automatic avatar frame. */
export function LevelColors() {
  const raw = useRaw();
  const theme = Object.values(themeSlots(raw))[0] ?? "dark";
  return (
    <div className="colors">
      {LEVELS.map(([k, label]) => (
        <ColorWidget key={k} k={k} label={label} theme={theme} value={getPath(raw, `colors.${k}`) ?? ""} onSet={(v) => setVal(`colors.${k}`, v)} />
      ))}
    </div>
  );
}
