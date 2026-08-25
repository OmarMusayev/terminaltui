/**
 * Direction registry and URL helpers.
 *
 * While this is an exploration, every direction is previewable at its own base
 * (`/d/paper/`). Promoting a winner to the real site means changing `base` to
 * "/" for that direction — no link in any template has to be edited.
 */
export const DIRECTIONS = [
  {
    key: "paper",
    name: "Paper",
    blurb: "Swiss editorial. Warm near-white, hairline rules, vermilion accent. Type does the work.",
    defaultTheme: "light" as const,
  },
  {
    key: "phosphor",
    name: "Phosphor",
    blurb: "Terminal-native. Dark, monospaced, laid out in panes like a tiling window manager.",
    defaultTheme: "dark" as const,
  },
  {
    key: "blueprint",
    name: "Blueprint",
    blurb: "Technical datasheet. Dotted grid, measurement ticks, specifications over adjectives.",
    defaultTheme: "light" as const,
  },
  {
    key: "editorial",
    name: "Editorial",
    blurb: "Magazine. Serif headlines against pixel display type, cream stock, long-form first.",
    defaultTheme: "light" as const,
  },
  {
    key: "gallery",
    name: "Gallery",
    blurb: "Museum. Near-black, enormous air, the terminal captures presented as exhibits.",
    defaultTheme: "dark" as const,
  },
] as const;

export type DirectionKey = (typeof DIRECTIONS)[number]["key"];
export const DIRECTION_KEYS = DIRECTIONS.map((d) => d.key);

export function getDirection(key: string) {
  return DIRECTIONS.find((d) => d.key === key) ?? DIRECTIONS[0];
}

/** Join a base ("/d/paper/") and a path ("blog/") into one clean absolute URL. */
export function url(base: string, path = ""): string {
  const b = base.endsWith("/") ? base : base + "/";
  const p = path.startsWith("/") ? path.slice(1) : path;
  return (b + p).replace(/\/{2,}/g, "/");
}

export function baseFor(dir: string): string {
  if (dir === "paper") return "/";
  return `/d/${dir}/`;
}

/**
 * "24 Jul 2026" — unambiguous, no locale surprises.
 *
 * Formatted in UTC deliberately. A date-only string like "2026-03-23" parses as
 * UTC midnight, so rendering it in a negative-offset zone gives the previous
 * day: the same post shows 24 Jul in London and 23 Jul in California. The dates
 * here are editorial facts, not instants, so they are read back in the zone
 * they were written in.
 */
export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** 200 wpm, floored at 1. Counts words, not characters. */
export function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}
