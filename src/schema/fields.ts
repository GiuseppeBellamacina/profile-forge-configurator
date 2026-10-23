// Every simple option of config.json as data. The forms, the search box, the "modified" badges and the per-field
// reset all read this table: to add or rename an option, edit it here (and nowhere else).
import { LOCALES, STATS_ITEMS } from "../core";
import type { StepId } from "../store/ui";

// `when`: the field only shows while another option has that value (e.g. the snake options while the heatmap style is "snake").
type Cond = { path: string; equals?: unknown; not?: unknown };
type Base = { path: string; label: string; hint?: string; when?: Cond | Cond[] };
export type Field =
  | (Base & { type: "text"; placeholder?: string; list?: "timezones"; examples?: { value: string; shows: string }[] })
  | (Base & { type: "number"; min?: number; max?: number; step?: number })
  | (Base & { type: "bool" })
  | (Base & { type: "color" }) // a colour override: path is colors.<name>
  | (Base & { type: "select"; options: (string | number | null)[] })
  | (Base & { type: "multi"; options: string[]; max?: number })
  | (Base & { type: "list"; placeholder?: string });

export type Group = { id: string; title: string; blurb?: string; step: StepId; fields: Field[] };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const GROUPS: Group[] = [
  {
    id: "general", title: "General", step: "start",
    fields: [
      { type: "select", path: "locale", label: "Language", options: LOCALES },
      { type: "text", path: "timezone", label: "Time zone", hint: "decides what “today” is for streaks", list: "timezones" },
      { type: "bool", path: "includePrivate", label: "Count private repositories", hint: "reloads your profile once; appears after you sign in" },
    ],
  },
  {
    id: "card", title: "Card", blurb: "Frame, corners and background of the whole card.", step: "look",
    fields: [
      { type: "number", path: "card.radius", label: "Corner radius", min: 0, max: 60 },
      { type: "bool", path: "card.hideBorder", label: "Hide border" },
      { type: "bool", path: "card.animations", label: "Animations" },
      { type: "select", path: "card.background.pattern", label: "Background pattern", options: ["none", "dots", "grid", "diagonal"] },
      { type: "bool", path: "card.background.glow", label: "Accent glow" },
      { type: "text", path: "card.background.gradient", label: "Background gradient", hint: "angle,color1,color2,…", placeholder: "35,4158d0,c850c0,ffcc70" },
    ],
  },
  {
    id: "header", title: "Header", blurb: "Avatar, name, rank ring and the facts next to them.", step: "sections",
    fields: [
      { type: "text", path: "title", label: "Title", hint: "shown next to @login" },
      { type: "select", path: "header.avatar", label: "Avatar", options: ["circle", "rounded", "hide"] },
      { type: "select", path: "header.frameAnimation", label: "Frame motion", options: ["default", "none", "spin", "pulse", "twinkle"], when: [{ path: "header.frame", not: "none" }, { path: "header.avatar", not: "hide" }] },
      { type: "color", path: "colors.frameColor", label: "Frame color", hint: "default: the color of your level", when: [{ path: "header.frame", not: "none" }, { path: "header.avatar", not: "hide" }] },
      { type: "select", path: "header.rankIcon", label: "Rank shows", options: ["level", "percentile", "github"] },
      { type: "select", path: "header.rankEffect", label: "Rank effect", options: ["auto", "none", "halo", "shine", "embers", "rainbow"], hint: "auto: by level (S a halo, SSS light and sparkles, X glowing embers); the others at any level" },
      { type: "select", path: "header.rankStyle", label: "Rank shape", options: ["ring", "hexagon", "shield"] },
      { type: "number", path: "header.rankThickness", label: "Rank thickness", min: 4, max: 16 },
      { type: "multi", path: "hideSections", label: "Hide", hint: "to drop a whole section, just remove it in Layout", options: ["rank"] },
      {
        type: "multi", path: "header.facts", label: "Facts", hint: "up to 4", max: 4,
        options: ["contributionsThisYear", "bestDay", "busiestWeekday", "currentStreak", "longestStreak", "topLanguage", "stars", "followers"],
      },
    ],
  },
  {
    id: "stats", title: "Stats", blurb: "Stars, commits, pull requests…", step: "sections",
    fields: [
      { type: "text", path: "stats.title", label: "Title" },
      { type: "multi", path: "stats.hide", label: "Hide rows", options: STATS_ITEMS },
      { type: "multi", path: "stats.show", label: "Extra rows", hint: "extra API calls", options: ["prsMerged", "prsMergedPercentage", "discussionsStarted", "discussionsAnswered"] },
      { type: "bool", path: "stats.icons", label: "Icons" },
      { type: "bool", path: "stats.textBold", label: "Bold values" },
      { type: "select", path: "stats.numberFormat", label: "Number format", options: ["long", "short"] },
      { type: "select", path: "stats.numberPrecision", label: "Short number decimals", options: [null, 0, 1, 2] },
      { type: "number", path: "stats.lineHeight", label: "Row height", min: 18, max: 60 },
      { type: "number", path: "stats.commitsYear", label: "Count commits of one year only", min: 2005, max: 2100 },
      { type: "list", path: "stats.excludeRepos", label: "Exclude repos", hint: "comma separated names" },
    ],
  },
  {
    id: "streak", title: "Streak", blurb: "Total, current and longest streak.", step: "sections",
    fields: [
      { type: "text", path: "streak.title", label: "Title" },
      { type: "multi", path: "streak.hide", label: "Hide columns", options: ["total", "current", "longest"] },
      { type: "select", path: "streak.mode", label: "Mode", options: ["daily", "weekly"] },
      { type: "multi", path: "streak.excludeDays", label: "Excluded weekdays", hint: "neither extend nor break a streak", options: WEEKDAYS },
      { type: "bool", path: "streak.excludeDaysLabel", label: "Show “Excludes: …” label" },
      { type: "number", path: "streak.startingYear", label: "First year counted", min: 2005, max: 2100 },
      {
        type: "text", path: "streak.dateFormat", label: "Date format", placeholder: "M j[, Y]",
        hint: "d day 05, j day 5, m month 03, n month 3, M Mar, F March, y 26, Y 2026. Text in [ ] only shows when the year is not the current one.",
        examples: [
          { value: "M j[, Y]", shows: "Jul 27, 2025  ·  Aug 19" },
          { value: "j M[ Y]", shows: "27 Jul 2025  ·  19 Aug" },
          { value: "j F Y", shows: "27 July 2025" },
          { value: "d/m/Y", shows: "27/07/2025" },
          { value: "n/j/y", shows: "7/27/25" },
          { value: "Y-m-d", shows: "2025-07-27" },
        ],
      },
      { type: "bool", path: "streak.shortNumbers", label: "Short numbers" },
    ],
  },
  {
    id: "languages", title: "Languages", blurb: "Your most used languages.", step: "sections",
    fields: [
      { type: "text", path: "languages.title", label: "Title" },
      { type: "select", path: "languages.layout", label: "Layout", options: ["bar", "compact", "donut", "donut-vertical", "pie"] },
      { type: "number", path: "languages.count", label: "How many languages", min: 1, max: 20 },
      { type: "list", path: "languages.hide", label: "Hide languages", placeholder: "HTML, CSS" },
      { type: "list", path: "languages.excludeRepos", label: "Exclude repos" },
      { type: "bool", path: "languages.hideProgress", label: "Hide percentages / sizes" },
      { type: "select", path: "languages.statsFormat", label: "Show", options: ["percentages", "bytes"] },
      { type: "number", path: "languages.sizeWeight", label: "Size weight", step: 0.1, min: 0, max: 10, hint: "score = bytes^size × repos^count" },
      { type: "number", path: "languages.countWeight", label: "Repo count weight", step: 0.1, min: 0, max: 10 },
    ],
  },
  {
    id: "trophies", title: "Trophies", blurb: "The trophy case.", step: "sections",
    fields: [
      { type: "select", path: "trophies.sort", label: "Order", options: ["default", "rank", "name"], hint: "default: the order you set in Choose trophies. rank: highest level first. name: A-Z" },
      { type: "text", path: "trophies.title", label: "Title" },
      { type: "list", path: "trophies.ranks", label: "Only these ranks", placeholder: "-E  (E E+ D- … S+ SSS SECRET)", hint: "“-” drops a rank; a bare letter means its whole family (B = B- B B+)" },
      { type: "list", path: "trophies.hideRanks", label: "Hide ranks" },
      { type: "number", path: "trophies.columns", label: "Columns", min: -1, max: 12, hint: "0 = all in one row" },
      { type: "number", path: "trophies.rows", label: "Rows", min: 0, max: 10, hint: "0 = no limit" },
      { type: "multi", path: "trophies.parts", label: "Show on each trophy", options: ["title", "label", "score", "bar"] },
      { type: "number", path: "trophies.marginW", label: "Horizontal margin", min: 0, max: 60 },
      { type: "number", path: "trophies.marginH", label: "Vertical margin", min: 0, max: 60 },
      { type: "number", path: "trophies.padding", label: "Panel padding", min: 0, max: 60 },
      { type: "select", path: "trophies.align", label: "Alignment", options: ["center", "left"] },
      { type: "bool", path: "trophies.noBg", label: "No trophy background" },
      { type: "bool", path: "trophies.noFrame", label: "No trophy frame" },
    ],
  },
  {
    id: "techStack", title: "Tech stack", blurb: "The scrolling logos.", step: "sections",
    fields: [
      { type: "number", path: "marquee.speed", label: "Speed", min: 5, max: 200, hint: "pixels per second" },
      { type: "number", path: "marquee.rows", label: "Rows", min: 1, max: 4, hint: "they scroll in alternating directions" },
      { type: "select", path: "marquee.order", label: "Order", options: ["shuffle", "config", "name"], hint: "shuffle: random at every generation (the preview keeps one fixed order). config: as listed. name: A-Z" },
      { type: "bool", path: "marquee.byCategory", label: "Order inside each category", hint: "keeps the categories in sequence instead of mixing all the logos" },
    ],
  },
  {
    id: "terminal", title: "Terminal", blurb: "A terminal whose commands type themselves.", step: "sections",
    fields: [{ type: "text", path: "terminal.title", label: "Window title", placeholder: "<login>@github: ~" }],
  },
  {
    id: "orgs", title: "Contributed to", blurb: "The organizations you contributed to.", step: "sections",
    fields: [
      { type: "text", path: "orgs.title", label: "Title" },
      { type: "select", path: "orgs.sort", label: "Order", options: ["contributions", "popularity", "custom"], hint: "popularity: stars of the repos you contributed to. custom: your order, below" },
      { type: "select", path: "orgs.mode", label: "Style", options: ["static", "scroll"], hint: "scroll: one row that keeps moving" },
      { type: "select", path: "orgs.direction", label: "Direction", options: ["left", "right"], when: { path: "orgs.mode", equals: "scroll" } },
      { type: "number", path: "orgs.speed", label: "Speed", min: 5, max: 200, hint: "pixels per second", when: { path: "orgs.mode", equals: "scroll" } },
    ],
  },
  {
    id: "rhythm", title: "Rhythm", blurb: "When you code: per weekday and per month.", step: "sections",
    fields: [
      { type: "text", path: "rhythm.title", label: "Title" },
      { type: "multi", path: "rhythm.show", label: "Show", options: ["weekdays", "months"] },
    ],
  },
  {
    id: "heatmap", title: "Heatmap", blurb: "The contribution calendar.", step: "sections",
    fields: [
      { type: "select", path: "heatmap.mode", label: "Style", hint: "snake: an animated snake eats the contributions. pacman: a whole automatic game of Pac-Man with the four ghosts on a playfield skinned by your heatmap (day shapes do not apply)", options: ["grid", "snake", "pacman"] },
      { type: "select", path: "heatmap.pacmanMaze", label: "Maze", hint: "data: your quiet days become the walls (it changes with your data). classic: a fixed arcade maze. open: no walls", options: ["data", "classic", "open"], when: { path: "heatmap.mode", equals: "pacman" } },
      { type: "number", path: "heatmap.pacmanLives", label: "Lives", min: 1, max: 5, when: { path: "heatmap.mode", equals: "pacman" } },
      { type: "color", path: "colors.pacmanColor", label: "Pac-Man color", hint: "default: yellow. For one theme only, use Look, Color overrides.", when: { path: "heatmap.mode", equals: "pacman" } },
      {
        type: "select", path: "heatmap.snakePath", label: "Snake route", when: { path: "heatmap.mode", equals: "snake" },
        hint: "smart: quietest days first, then busier ones. busy: busiest first. nearest: always the closest day. sweep: column by column. rows: row by row. spiral: outside in.",
        options: ["smart", "busy", "nearest", "sweep", "rows", "spiral"],
      },
      { type: "number", path: "heatmap.snakeLength", label: "Snake length", min: 3, max: 12, hint: "cells", when: { path: "heatmap.mode", equals: "snake" } },
      { type: "select", path: "heatmap.snakeStyle", label: "Snake style", hint: "rainbow: every segment its own colour. glow: a soft halo around the body", options: ["classic", "rainbow", "glow"], when: { path: "heatmap.mode", equals: "snake" } },
      { type: "color", path: "colors.snakeColor", label: "Snake color", hint: "default: the theme ring color. For one theme only, use Look, Color overrides.", when: { path: "heatmap.mode", equals: "snake" } },
      { type: "number", path: "heatmap.weeks", label: "Weeks", min: 4, max: 53 },
      { type: "select", path: "heatmap.cell", label: "Cell shape", hint: "triangle tiles up and down; snowflake is brighter with more contributions; moon grows from an empty disc to a full moon; hexagon nests like a honeycomb; mixed is a stable random mix of square, round and triangle", options: ["square", "round", "triangle", "snowflake", "moon", "hexagon", "mixed"] , when: { path: "heatmap.mode", not: "pacman" } },
      { type: "select", path: "heatmap.weekStart", label: "Week starts on", options: ["sun", "mon"] },
      { type: "bool", path: "heatmap.legend", label: "Legend" },
      { type: "bool", path: "heatmap.monthLabels", label: "Month labels" },
    ],
  },
];

export const ALL_FIELDS = GROUPS.flatMap((g) => g.fields.map((f) => ({ ...f, group: g })));
export const fieldsOf = (id: string) => GROUPS.find((g) => g.id === id)!;
export const groupsOf = (step: StepId) => GROUPS.filter((g) => g.step === step);

/** Search over labels, paths, hints and group names. */
export function searchFields(q: string, limit = 8) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return ALL_FIELDS.filter((f) => {
    const hay = `${f.label} ${f.path} ${f.hint ?? ""} ${f.group.title}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  }).slice(0, limit);
}
