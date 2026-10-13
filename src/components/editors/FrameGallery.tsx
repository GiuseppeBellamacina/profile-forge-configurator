import { useEffect, useMemo, useRef, useState } from "react";
import { renderCard } from "../../lib/renderCard";
import { setVal, useAssets, useRaw } from "../../store/config";
import { useSession } from "../../store/session";
import { later } from "./ThemeEditor";

const FRAMES = ["ring", "none", "auto", "double", "dashed", "neon", "pixel", "glitch", "laurel", "flames", "sakura", "stars", "halo", "aurora"];

/** The avatar of the user (with their level and colours) in every frame; click one to use it. Drawn when it scrolls into view. */
function Tile({ frame, cache }: { frame: string; cache: Map<string, string> }) {
  const raw = useRaw();
  const assets = useAssets();
  const profile = useSession((s) => s.profile);
  const box = useRef<HTMLButtonElement>(null);
  const [url, setUrl] = useState(cache.get(frame) ?? "");
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setSeen(true), io.disconnect()), { rootMargin: "150px" });
    box.current && io.observe(box.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => setUrl(cache.get(frame) ?? ""), [cache, frame]);
  useEffect(() => {
    if (!seen || cache.has(frame)) return;
    let live = true;
    const { grid: _grid, ...rest } = raw;
    later(() => renderCard({ ...rest, layout: ["header"], header: { ...raw.header, frame }, card: { ...raw.card, animations: false } }, assets, profile))
      .then((r) => {
        const u = URL.createObjectURL(new Blob([r.svg], { type: "image/svg+xml" }));
        cache.set(frame, u);
        if (live) setUrl(u);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [seen, cache, frame]);

  return (
    <button ref={box} type="button" className="tile fthumb-tile" aria-pressed={(raw.header?.frame ?? "ring") === frame} onClick={() => setVal("header.frame", frame)} title={frame}>
      <span className="fthumb">{url && <img alt="" src={url} />}</span>
      <span className="meta"><b>{frame}</b></span>
    </button>
  );
}

export function FrameGallery() {
  const raw = useRaw();
  const assets = useAssets();
  const profile = useSession((s) => s.profile);
  // thumbnails depend on the header options, the colours and the loaded profile, not on the frame being chosen
  const key = JSON.stringify([raw.header?.avatar, raw.colors, raw.themes, raw.customThemes, raw.header?.frameAnimation]);
  const cache = useMemo(() => new Map<string, string>(), [key, assets, profile]);
  useEffect(() => () => cache.forEach((u) => URL.revokeObjectURL(u)), [cache]);
  return (
    <div className="gallery fgallery">
      {FRAMES.map((f) => <Tile key={f} frame={f} cache={cache} />)}
    </div>
  );
}
