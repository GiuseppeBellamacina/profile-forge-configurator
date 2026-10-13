import { useEffect, useRef, useState } from "react";
import { renderCard } from "../lib/renderCard";
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
        const { svg, missing, light, slots, slot } = await renderCard(raw, assets, profile, wanted);
        if (stale) return;
        const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
        if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
        lastUrl.current = url;
        setOut({ url, error: "", missing, busy: false, light, slots, slot });
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
