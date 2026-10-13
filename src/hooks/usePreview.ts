import { useEffect, useRef, useState } from "react";
import type { Box } from "../core";
import { renderCard } from "../lib/renderCard";
import { useAssets, useRaw } from "../store/config";
import { useSession } from "../store/session";
import { useUi } from "../store/ui";

/** While arranging the layout, sections without content still show a sample so you can see where they land. Preview only: the published card is unchanged. */
const withSamples = (raw: Record<string, any>) => {
  const out = { ...raw };
  if (!out.about?.length) out.about = ["Your about text appears here. Write it in the Content step."];
  if (!out.workingOn?.length) out.workingOn = [{ title: "Project name", description: "What you are building" }, { title: "Another project", description: "One line about it" }];
  if (!out.techStack?.length)
    out.techStack = [{ category: "Sample", items: ["python", "docker", "git", "linux", "javascript", "numpy"].map((n) => ({ name: n, image: `assets/img/${n}.svg` })) }];
  return out;
};

export type Preview = { url: string; error: string; missing: string[]; busy: boolean; light: boolean; slots: string[]; slot: string; height: number; boxes: Box[] };
const EMPTY: Preview = { url: "", error: "", missing: [], busy: true, light: false, slots: [], slot: "", height: 0, boxes: [] };

/** Renders the card with the real renderer whenever the config, the data or the active slot change (debounced). */
export function usePreview(): Preview {
  const raw = useRaw();
  const assets = useAssets();
  const profile = useSession((s) => s.profile);
  const wanted = useUi((s) => s.slot);
  const step = useUi((s) => s.step);
  const still = step === "look";
  const samples = step === "layout"; // while picking themes / colors: no intro animation, near-instant updates
  const [out, setOut] = useState<Preview>(EMPTY);
  const lastUrl = useRef("");

  useEffect(() => {
    let stale = false;
    setOut((o) => ({ ...o, busy: true }));
    const timer = setTimeout(async () => {
      try {
        const { svg, missing, light, slots, slot, height, boxes } = await renderCard(
          still ? { ...raw, card: { ...raw.card, animations: false } } : samples ? withSamples(raw) : raw,
          assets,
          profile,
          wanted,
        );
        if (stale) return;
        const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
        if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
        lastUrl.current = url;
        setOut({ url, error: "", missing, busy: false, light, slots, slot, height, boxes });
      } catch (e: any) {
        if (!stale) setOut((o) => ({ ...o, error: e.message ?? String(e), busy: false }));
      }
    }, still ? 30 : 140);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [raw, assets, profile, wanted, still, samples]);

  return out;
}
