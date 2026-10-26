import { imageRefs, normalize, render, stackItems, resolveTheme, sectionBoxes, summarize, type Box, type Raw } from "../core";
import { dataUri, fonts } from "./assets";
import { deviconUrl, findDevicon, loadDevicons } from "./devicon";
import { b64 } from "./publish";
import { clone } from "./path";

export type Rendered = { svg: string; missing: string[]; light: boolean; slots: string[]; slot: string; height: number; boxes: Box[] };

/** An icon whose file cannot be loaded (renamed, not pushed yet) is looked up in devicon by its name or file name. */
async function deviconData(it: { name: string; image: string }) {
  const d = findDevicon(await loadDevicons(), it);
  const res = d && (await fetch(deviconUrl(d)));
  if (!res?.ok) throw new Error(`no devicon for ${it.name}`);
  return `data:image/svg+xml;base64,${b64(new Uint8Array(await res.arrayBuffer()))}`;
}

/** The card as an SVG string for one theme slot, using the real renderer. Shared by the live preview and the theme thumbnails. */
export async function renderCard(raw: Raw, assets: Record<string, { url: string }>, profile: Raw, wanted?: string | null, tweak?: (data: Raw) => void): Promise<Rendered> {
  const k = normalize(clone(raw));
  const slots: string[] = k.slots.map(([s]: [string]) => s);
  const slot = slots.includes(wanted ?? "") ? (wanted as string) : slots[0];
  const [, theme] = k.slots.find(([s]: [string]) => s === slot);
  const sy = k.streak.startingYear as number | null;
  const data = summarize(sy ? { ...profile, days: profile.days.filter(([d]: [string]) => Number(d.slice(0, 4)) >= sy) } : profile, k);

  tweak?.(data);
  const missing: string[] = [];
  // a fixed seed: the shuffle must not jump at every keystroke (the published card reshuffles at each generation)
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const items = stackItems<{ name: string; image: string }>(k.techStack, k.marquee, rand);
  k.stack = (
    await Promise.all(
      items.map(async (it, n) => {
        try {
          return { name: it.name, id: `i${n}`, data: await dataUri(assets, it.image).catch(() => deviconData(it)) };
        } catch {
          missing.push(it.name);
          return null;
        }
      }),
    )
  ).filter(Boolean);

  // the background image and the images of the decor, embedded like the flag
  k.images = Object.fromEntries(
    (await Promise.all(imageRefs(k).map(async (ref) => [ref, await dataUri(assets, ref).catch((e) => (console.warn("card image not loaded:", e.message), null))] as const))).filter(([, u]) => u),
  );

  if (k.header.flag) k.flagData = await dataUri(assets, k.header.flag).catch((e) => (console.warn("flag not loaded:", e.message), null));

  const colors = { ...k.colors, ...k.colorsByTheme[slot] };
  const svg = render(data, { theme, k, colors, fontCss: await fonts() });
  const { height, boxes } = sectionBoxes(data, { theme, k, colors });
  return { svg, missing, light: resolveTheme(theme).base === "light", slots, slot, height, boxes };
}
