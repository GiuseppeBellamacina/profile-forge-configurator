import { useEffect, useRef, useState } from "react";
import type { Box } from "../core";
import { renderCard } from "../lib/renderCard";
import { useAssets, useRaw } from "../store/config";
import { useSession } from "../store/session";
import { uiStore, useUi } from "../store/ui";

/** While arranging the layout, sections without content still show a sample so you can see where they land. Preview only: the published card is unchanged. */
const withSamples = (raw: Record<string, any>) => {
  const out = { ...raw };
  if (!out.about?.length) out.about = ["Your about text appears here. Write it in the Content step."];
  if (!out.workingOn?.length) out.workingOn = [{ title: "Project name", description: "What you are building" }, { title: "Another project", description: "One line about it" }];
  if (!out.techStack?.length)
    out.techStack = [{ category: "Sample", items: ["python", "docker", "git", "linux", "javascript", "numpy"].map((n) => ({ name: n, image: `assets/img/${n}.svg` })) }];
  return out;
};

/** Options that drive an animation (avatar ring, snake, logo marquee, bars…). Changing one replays the card even in the still steps; colors, layout and text edits stay still. */
const ANIMATED = ["header", "marquee", "heatmap", "techStack", "trophies", "stats", "streak", "languages", "card"];
const touchesAnimated = (a: Record<string, any>, b: Record<string, any>) => ANIMATED.some((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));

export type Preview = { url: string; error: string; missing: string[]; busy: boolean; light: boolean; slots: string[]; slot: string; height: number; boxes: Box[] };
const EMPTY: Preview = { url: "", error: "", missing: [], busy: true, light: false, slots: [], slot: "", height: 0, boxes: [] };

/** Renders the card with the real renderer whenever the config, the data or the active slot change (debounced). */
export function usePreview(): Preview {
  const raw = useRaw();
  const assets = useAssets();
  const profile = useSession((s) => s.profile);
  const wanted = useUi((s) => s.slot);
  const step = useUi((s) => s.step);
  const still = ["look", "layout", "sections", "content"].includes(step); // while editing: no animation, near-instant updates
  const samples = step === "layout";
  const [out, setOut] = useState<Preview>(EMPTY);
  const lastUrl = useRef("");
  // this config came from an edit of an animated option: render it animated once
  const track = useRef({ raw, anim: false });
  if (track.current.raw !== raw) track.current = { raw, anim: touchesAnimated(track.current.raw, raw) };
  const anim = track.current.anim;

  useEffect(() => {
    let stale = false;
    setOut((o) => ({ ...o, busy: true }));
    const timer = setTimeout(async () => {
      try {
        const { svg, missing, light, slots, slot, height, boxes } = await renderCard(
          still && !anim ? { ...(samples ? withSamples(raw) : raw), card: { ...raw.card, animations: false } } : samples ? withSamples(raw) : raw,
          assets,
          profile,
          wanted,
        );
        if (stale) return;
        const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
        if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
        lastUrl.current = url;
        setOut({ url, error: "", missing, busy: false, light, slots, slot, height, boxes });
        uiStore.set({ boxes });
      } catch (e: any) {
        if (!stale) setOut((o) => ({ ...o, error: e.message ?? String(e), busy: false }));
      }
    }, still && !anim ? 30 : 140);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [raw, assets, profile, wanted, still, samples, anim]);

  return out;
}
