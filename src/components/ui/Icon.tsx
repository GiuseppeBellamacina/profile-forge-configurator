import type { ReactNode } from "react";

// Small stroke icons (16px grid, currentColor) used instead of text glyphs on buttons.
const PATHS = {
  undo: <><path d="M3 6.5h6.5a3.5 3.5 0 0 1 0 7H6" /><path d="M5.5 3.5 2.5 6.5l3 3" /></>,
  redo: <><path d="M13 6.5H6.5a3.5 3.5 0 0 0 0 7H10" /><path d="m10.5 3.5 3 3-3 3" /></>,
  link: <><path d="M6.5 9.5a3 3 0 0 0 4.2 0l2.3-2.3a3 3 0 0 0-4.2-4.2l-.8.8" /><path d="M9.5 6.5a3 3 0 0 0-4.2 0L3 8.8A3 3 0 0 0 7.2 13l.8-.8" /></>,
  left: <path d="M13 8H3m4-4L3 8l4 4" />,
  right: <path d="M3 8h10M9 4l4 4-4 4" />,
  up: <path d="M8 13V3M4 7l4-4 4 4" />,
  down: <path d="M8 3v10M4 9l4 4 4-4" />,
  x: <path d="m4 4 8 8M12 4l-8 8" />,
  plus: <path d="M8 3v10M3 8h10" />,
  minus: <path d="M3 8h10" />,
  grip: <><circle cx="6" cy="4" r=".6" /><circle cx="10" cy="4" r=".6" /><circle cx="6" cy="8" r=".6" /><circle cx="10" cy="8" r=".6" /><circle cx="6" cy="12" r=".6" /><circle cx="10" cy="12" r=".6" /></>,
  reset: <><path d="M3 8a5 5 0 1 0 1.6-3.7L3 5.8" /><path d="M3 2.5v3.3h3.3" /></>,
  replay: <><path d="M13 8a5 5 0 1 1-1.6-3.7L13 5.8" /><path d="M13 2.5v3.3H9.7" /></>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ n }: { n: IconName }) {
  return (
    <svg className="ic" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[n]}
    </svg>
  );
}
