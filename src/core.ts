// The only place that touches profile-forge's JS. The rest of the app imports typed names from here.
import * as config from "@core/config.js";
import * as github from "@core/github.js";
import * as i18n from "@core/i18n.js";
import * as icons from "@core/icons.js";
import * as renderer from "@core/render.js";
import * as stats from "@core/stats.js";
import * as themes from "@core/themes.js";

export type Raw = Record<string, any>;

export const DEFAULTS: Raw = config.DEFAULTS;
export const SECTIONS: string[] = config.SECTIONS;
export const STATS_ITEMS: string[] = config.STATS_ITEMS;
export const normalize: (raw: Raw) => Raw = config.normalize;
export const needsExtras: (k: Raw) => boolean = config.needsExtras;
export const setPath: (o: Raw, path: string, value: unknown) => Raw = config.setPath;

export const LOCALES: string[] = i18n.LOCALES;
export const ICONS: Record<string, string> = icons.ICONS;
export const BRANDS: Record<string, string> = icons.BRANDS;

export const render: (data: Raw, opts: Raw) => string = renderer.render;
export const summarize: (profile: Raw, k: Raw) => Raw = stats.summarize;
export const fetchProfile: (opts: Raw) => Promise<Raw> = github.fetchProfile;

/** Built-in theme names, captured before any custom theme gets registered (registerThemes mutates the core's table). */
export const BUILTIN_THEMES: string[] = themes.THEME_NAMES();
/** Built-ins plus the custom themes of this config; the only list the UI should offer. */
export const themeNames = (raw: Raw): string[] => [...BUILTIN_THEMES, ...Object.keys(raw.customThemes ?? {})];
export const COLOR_NAMES: string[] = themes.COLOR_NAMES;
export const COLOR_KEYS: Record<string, string[]> = themes.COLOR_KEYS;
export const registerThemes: (custom: Raw) => void = themes.registerThemes;
export const resolveTheme: (name: string, colors?: Raw) => Raw = themes.resolveTheme;
