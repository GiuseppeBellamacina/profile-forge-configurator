import { normalize, render, resolveTheme, sectionBoxes, summarize, type Box, type Raw } from "../core";
import { dataUri, fonts } from "./assets";
import { clone } from "./path";

export type Rendered = { svg: string; missing: string[]; light: boolean; slots: string[]; slot: string; height: number; boxes: Box[] };

/** The card as an SVG string for one theme slot, using the real renderer. Shared by the live preview and the theme thumbnails. */
export async function renderCard(raw: Raw, assets: Record<string, { url: string }>, profile: Raw, wanted?: string | null): Promise<Rendered> {
  const k = normalize(clone(raw));
  const slots: string[] = k.slots.map(([s]: [string]) => s);
  const slot = slots.includes(wanted ?? "") ? (wanted as string) : slots[0];
  const [, theme] = k.slots.find(([s]: [string]) => s === slot);
  const sy = k.streak.startingYear as number | null;
  const data = summarize(sy ? { ...profile, days: profile.days.filter(([d]: [string]) => Number(d.slice(0, 4)) >= sy) } : profile, k);

  const missing: string[] = [];
  const items: { name: string; image: string }[] = k.techStack.flatMap((c: { items: { name: string; image: string }[] }) => c.items);
  k.stack = (
    await Promise.all(
      items.map(async (it, n) => {
        try {
          return { name: it.name, id: `i${n}`, data: await dataUri(assets, it.image) };
        } catch {
          missing.push(it.name);
          return null;
        }
      }),
    )
  ).filter(Boolean);

  const colors = { ...k.colors, ...k.colorsByTheme[slot] };
  const svg = render(data, { theme, k, colors, fontCss: await fonts() });
  const { height, boxes } = sectionBoxes(data, { theme, k, colors });
  return { svg, missing, light: resolveTheme(theme).base === "light", slots, slot, height, boxes };
}
