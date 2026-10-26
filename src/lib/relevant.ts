import { DEFAULTS, type Raw } from "../core";
import { ALL_FIELDS } from "../schema/fields";
import { clone, deletePath, getPath } from "./path";

/**
 * The config without the options that do not apply to it: what the form hides (the snake options while the heatmap is Pac-Man, the cell
 * shape while it is Pac-Man, the glow options with the glow off...) is not written to config.json. The editor keeps the values (go back
 * to a snake and they are there); only what is exported, shown and published is trimmed.
 */
export function relevant(raw: Raw): Raw {
  const out = clone(raw);
  const val = (p: string) => getPath(out, p) ?? getPath(DEFAULTS, p);
  const slots = Object.keys(out.colorsByTheme ?? {});
  const drop = (path: string, colorName?: string) => {
    deletePath(out, path);
    if (colorName) for (const s of slots) deletePath(out, `colorsByTheme.${s}.${colorName}`);
  };
  for (const f of ALL_FIELDS) {
    if (!f.when) continue;
    const shown = [f.when].flat().every((w) => ("not" in w ? val(w.path) !== w.not : val(w.path) === w.equals));
    if (!shown) drop(f.path, f.type === "color" ? f.path.split(".")[1] : undefined);
  }
  // the same theme in every slot: one card is enough (the README then shows a single image, see readmeBlock)
  const themes = out.themes;
  if (themes && !Array.isArray(themes)) {
    const names = Object.keys(themes);
    if (names.length > 1 && names.every((n) => themes[n] === themes[names[0]])) {
      out.themes = { [names[0]]: themes[names[0]] };
      for (const s of names.slice(1)) deletePath(out, `colorsByTheme.${s}`);
    }
  }
  if (val("heatmap.mode") !== "snake") drop("colors.snakeColor", "snakeColor"); // its colour has no field of its own: it sits in the colour overrides
  return out;
}
