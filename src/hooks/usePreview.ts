import { useEffect, useRef, useState } from "react";
import { normalize, render, resolveTheme, summarize } from "../core";
import { dataUri, fonts } from "../lib/assets";
import { clone } from "../lib/path";
import { useAssets, useRaw } from "../store/config";
import { useSession } from "../store/session";
import { useUi } from "../store/ui";

export type Preview = { url: string; error: string; missing: string[]; busy: boolean; light: boolean; slots: string[]; slot: string };
const EMPTY: Preview = { url: "", error: "", missing: [], busy: true, light: false, slots: [], slot: "" };

/** Renders the card with the real renderer whenever the config, the data or the active slot change (debounced). */
export function usePreview(): Preview {
  const raw = useRaw();
  const assets = useAssets();
  const profile = useSession((s) => s.profile);
  const wanted = useUi((s) => s.slot);
  const [out, setOut] = useState<Preview>(EMPTY);
  const lastUrl = useRef("");

  useEffect(() => {
    let stale = false;
    setOut((o) => ({ ...o, busy: true }));
    const timer = setTimeout(async () => {
      try {
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
        if (stale) return;
        const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
        if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
        lastUrl.current = url;
        setOut({ url, error: "", missing, busy: false, light: resolveTheme(theme).base === "light", slots, slot });
      } catch (e: any) {
        if (!stale) setOut((o) => ({ ...o, error: e.message ?? String(e), busy: false }));
      }
    }, 140);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [raw, assets, profile, wanted]);

  return out;
}
