import { SECRETS, trophyTable, type Raw } from "../core";

/** "MM-DD" kept from a date input value (YYYY-MM-DD); the birth year never goes into the public config. */
export const birthdayOf = (date: string) => (/^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(5) : null);
/** Back to a date input value (year 2000 is a leap year, so 02-29 works). */
export const birthdayInput = (b?: string | null) => (b ? `${b.length === 5 ? "2000-" : ""}${b}` : "");

export type Tile = { title: string; name: string; secret: boolean; optional: boolean; rank: string; earned: boolean; hint: string };

const need = (key: string, min: number) => (key === "experience" ? `~${Math.round((min * 100) / 365)} years` : `${min}+`);

/** Every trophy the card can show, with whether the profile earned it and how to get it. `earned` = trophies from summarize(). */
export function tiles(earned: Raw[]): Tile[] {
  const got = new Map(earned.map((t) => [t.title, t]));
  const levels = trophyTable().map((t): Tile => {
    const e = got.get(t.title);
    const rank = e?.rank ?? "?";
    const steps = [...t.levels].reverse().map((l) => `${l.level}: ${need(t.key, l.min)}`).join(", ");
    return {
      title: t.title, name: t.title, secret: false, optional: t.optional, rank, earned: rank !== "?",
      hint: `${e && rank !== "?" ? `${e.label} (${rank}). ` : ""}${t.title} trophy, levels: ${steps}`,
    };
  });
  const secrets = SECRETS.map((s): Tile => ({
    title: s.title, name: s.label, secret: true, optional: false, rank: "SECRET", earned: got.has(s.title), hint: `Secret: ${s.hint}`,
  }));
  return [...levels, ...secrets];
}
