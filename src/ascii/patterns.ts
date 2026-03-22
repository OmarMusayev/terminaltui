/**
 * Pattern fill generators that tile a rectangular area with decorative characters.
 * Each pattern returns string[] (one element per line), with no trailing whitespace.
 */

import { registry } from "../art-registry/index.js";
import type { PatternData } from "../art-registry/types.js";

export type PatternType =
  | "dots"
  | "crosshatch"
  | "diagonal"
  | "waves"
  | "bricks"
  | "circuit"
  | "rain"
  | "stars"
  | "confetti"
  | "static"
  | "braille-dots"
  | "grid";

interface PatternOptions {
  /** Fill density from 0.0 (sparse) to 1.0 (full). Default varies per pattern. */
  density?: number;
  /** Seed for reproducible pseudo-random output. */
  seed?: number;
}

/**
 * Simple seeded PRNG (mulberry32).
 * Returns a function that produces values in [0, 1).
 */
function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a pattern-filled rectangular area.
 *
 * @param width  - Character width of the output area.
 * @param height - Number of lines in the output area.
 * @param type   - Which pattern to generate.
 * @param options - Optional density (0.0-1.0) and seed for PRNG patterns.
 * @returns Array of strings, one per line, with no trailing whitespace.
 */
export function pattern(
  width: number,
  height: number,
  type: PatternType | string,
  options?: PatternOptions,
): string[] {
  if (width <= 0 || height <= 0) return [];

  // Check registry for custom tile pattern
  const custom = registry.get("pattern", type) as PatternData | null;
  if (custom) {
    return tilePattern(custom.tile, custom.tileWidth, custom.tileHeight, width, height);
  }

  // Fall back to built-in generators
  const density = Math.max(0, Math.min(1, options?.density ?? getDefaultDensity(type as PatternType)));
  const rng = createRng(options?.seed ?? 42);

  const generators: Record<PatternType, () => string[]> = {
    dots: () => patternDots(width, height),
    crosshatch: () => patternCrosshatch(width, height),
    diagonal: () => patternDiagonal(width, height),
    waves: () => patternWaves(width, height),
    bricks: () => patternBricks(width, height),
    circuit: () => patternCircuit(width, height, rng),
    rain: () => patternRain(width, height, density, rng),
    stars: () => patternStars(width, height, density, rng),
    confetti: () => patternConfetti(width, height, density, rng),
    static: () => patternStatic(width, height, rng),
    "braille-dots": () => patternBrailleDots(width, height, rng),
    grid: () => patternGrid(width, height),
  };

  const gen = generators[type as PatternType];
  if (gen) return gen();
  return [];
}

function getDefaultDensity(type: PatternType): number {
  switch (type) {
    case "rain":
      return 0.15;
    case "stars":
      return 0.1;
    case "confetti":
      return 0.15;
    default:
      return 0.5;
  }
}

/**
 * Strip trailing spaces from every line.
 */
function trimLines(lines: string[]): string[] {
  return lines.map(l => l.trimEnd());
}

/**
 * Tile a custom pattern to fill width x height.
 */
function tilePattern(tile: string[], tw: number, th: number, width: number, height: number): string[] {
  const lines: string[] = [];
  for (let y = 0; y < height; y++) {
    const tileRow = tile[y % th] ?? "";
    let line = "";
    while (line.length < width) {
      line += tileRow;
    }
    lines.push(line.slice(0, width));
  }
  return lines;
}

// ─── dots ────────────────────────────────────────────────────────────────────

function patternDots(width: number, height: number): string[] {
  const lines: string[] = [];
  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      line += (x + y) % 2 === 0 ? "\u00B7" : " ";
    }
    lines.push(line);
  }
  return trimLines(lines);
}

// ─── crosshatch ──────────────────────────────────────────────────────────────

function patternCrosshatch(width: number, height: number): string[] {
  const lines: string[] = [];
  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      if ((x + y) % 2 === 0) {
        line += "\u2573"; // ╳
      } else {
        line += " ";
      }
    }
    lines.push(line);
  }
  return trimLines(lines);
}

// ─── diagonal ────────────────────────────────────────────────────────────────

function patternDiagonal(width: number, height: number): string[] {
  const lines: string[] = [];
  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      // Alternating forward and back diagonals based on position
      if ((x + y) % 2 === 0) {
        line += "\u2571"; // ╱
      } else {
        line += "\u2572"; // ╲
      }
    }
    lines.push(line);
  }
  return trimLines(lines);
}

// ─── waves ───────────────────────────────────────────────────────────────────

function patternWaves(width: number, height: number): string[] {
  const lines: string[] = [];
  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      // Create a phase-shifted wave across rows
      const phase = (x + y * 2) % 4;
      if (phase === 0 || phase === 1) {
        line += "\u223F"; // ∿
      } else {
        line += " ";
      }
    }
    lines.push(line);
  }
  return trimLines(lines);
}

// ─── bricks ──────────────────────────────────────────────────────────────────

function patternBricks(width: number, height: number): string[] {
  const brickWidth = 6; // ├────┤ = 6 chars including borders
  const lines: string[] = [];

  for (let y = 0; y < height; y++) {
    const isOddRow = Math.floor(y / 2) % 2 === 1;
    const offset = isOddRow ? Math.floor(brickWidth / 2) : 0;
    const isTopOfBrick = y % 2 === 0;

    let line = "";

    if (isTopOfBrick) {
      // Horizontal mortar line
      for (let x = 0; x < width; x++) {
        const pos = (x + offset) % brickWidth;
        if (pos === 0) {
          line += "\u253C"; // ┼ junction
        } else {
          line += "\u2500"; // ─
        }
      }
    } else {
      // Brick body with vertical edges
      for (let x = 0; x < width; x++) {
        const pos = (x + offset) % brickWidth;
        if (pos === 0) {
          line += "\u2502"; // │
        } else {
          line += " ";
        }
      }
    }

    lines.push(line);
  }
  return trimLines(lines);
}

// ─── circuit ─────────────────────────────────────────────────────────────────

function patternCircuit(width: number, height: number, rng: () => number): string[] {
  const chars = [
    "\u250C", // ┌
    "\u2500", // ─
    "\u2524", // ┤
    "\u2514", // └
    "\u252C", // ┬
    "\u2510", // ┐
    "\u2502", // │
    "\u2500", // ─
    "\u251C", // ├
    "\u2534", // ┴
    "\u253C", // ┼
    "\u2518", // ┘
  ];

  const lines: string[] = [];
  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      const idx = Math.floor(rng() * chars.length);
      line += chars[idx];
    }
    lines.push(line);
  }
  return trimLines(lines);
}

// ─── rain ────────────────────────────────────────────────────────────────────

function patternRain(width: number, height: number, density: number, rng: () => number): string[] {
  const lines: string[] = [];
  const rainChars = ["|", "\u00B7"]; // | and ·

  for (let y = 0; y < height; y++) {
    const chars: string[] = new Array(width).fill(" ");
    for (let x = 0; x < width; x++) {
      if (rng() < density) {
        chars[x] = rainChars[Math.floor(rng() * rainChars.length)];
      }
    }
    lines.push(chars.join(""));
  }
  return trimLines(lines);
}

// ─── stars ───────────────────────────────────────────────────────────────────

function patternStars(width: number, height: number, density: number, rng: () => number): string[] {
  const starChars = ["\u2726", "\u2605", "\u2736", "\u00B7"]; // ✦ ★ ✶ ·
  const lines: string[] = [];

  for (let y = 0; y < height; y++) {
    const chars: string[] = new Array(width).fill(" ");
    for (let x = 0; x < width; x++) {
      if (rng() < density) {
        chars[x] = starChars[Math.floor(rng() * starChars.length)];
      }
    }
    lines.push(chars.join(""));
  }
  return trimLines(lines);
}

// ─── confetti ────────────────────────────────────────────────────────────────

function patternConfetti(width: number, height: number, density: number, rng: () => number): string[] {
  const confettiChars = [
    "\u25C6", // ◆
    "\u25C7", // ◇
    "\u25CF", // ●
    "\u25CB", // ○
    "\u25A0", // ■
    "\u25A1", // □
    "\u25B2", // ▲
    "\u25B3", // △
  ];
  const lines: string[] = [];

  for (let y = 0; y < height; y++) {
    const chars: string[] = new Array(width).fill(" ");
    for (let x = 0; x < width; x++) {
      if (rng() < density) {
        chars[x] = confettiChars[Math.floor(rng() * confettiChars.length)];
      }
    }
    lines.push(chars.join(""));
  }
  return trimLines(lines);
}

// ─── static ──────────────────────────────────────────────────────────────────

function patternStatic(width: number, height: number, rng: () => number): string[] {
  const staticChars = ["\u2591", "\u2592", "\u2593"]; // ░ ▒ ▓
  const lines: string[] = [];

  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      line += staticChars[Math.floor(rng() * staticChars.length)];
    }
    lines.push(line);
  }
  return trimLines(lines);
}

// ─── braille-dots ────────────────────────────────────────────────────────────

function patternBrailleDots(width: number, height: number, rng: () => number): string[] {
  // Braille characters: U+2800 to U+28FF (256 patterns)
  const BRAILLE_BASE = 0x2800;
  const lines: string[] = [];

  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      // Random dot pattern from the braille range (skip empty 0x2800)
      const dots = Math.floor(rng() * 255) + 1;
      line += String.fromCharCode(BRAILLE_BASE + dots);
    }
    lines.push(line);
  }
  return trimLines(lines);
}

// ─── grid ────────────────────────────────────────────────────────────────────

function patternGrid(width: number, height: number): string[] {
  const cellWidth = 4;
  const cellHeight = 2;
  const lines: string[] = [];

  for (let y = 0; y < height; y++) {
    let line = "";
    const isHorizontal = y % cellHeight === 0;

    for (let x = 0; x < width; x++) {
      const isVertical = x % cellWidth === 0;

      if (isHorizontal && isVertical) {
        line += "\u253C"; // ┼
      } else if (isHorizontal) {
        line += "\u2500"; // ─
      } else if (isVertical) {
        line += "\u2502"; // │
      } else {
        line += " ";
      }
    }
    lines.push(line);
  }
  return trimLines(lines);
}
