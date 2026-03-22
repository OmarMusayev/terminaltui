/**
 * Pre-made decorative ASCII art scene generators.
 * Each scene returns string[] sized to the given width.
 */

import { registry } from "../art-registry/index.js";
import type { SceneData } from "../art-registry/types.js";

export type SceneType =
  | "mountains"
  | "cityscape"
  | "forest"
  | "ocean"
  | "space"
  | "clouds"
  | "coffee-cup"
  | "rocket"
  | "cat"
  | "robot"
  | "terminal"
  | "vinyl-record"
  | "cassette"
  | "floppy-disk"
  | "gameboy";

interface SceneOptions {
  width?: number;
  color?: string;
}

/**
 * Simple seeded PRNG (mulberry32).
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
 * Strip trailing whitespace from every line.
 */
function trimLines(lines: string[]): string[] {
  return lines.map((l) => l.trimEnd());
}

/**
 * Center an array of lines within the given width.
 */
function centerLines(lines: string[], width: number): string[] {
  // Center art within width. NEVER truncate — art renders at its natural size.
  // If art is wider than width, just return it as-is (no padding, no clipping).
  return lines.map((line) => {
    const lineW = line.length;
    if (lineW >= width) return line;
    const pad = Math.floor((width - lineW) / 2);
    return " ".repeat(pad) + line;
  });
}

/**
 * Generate a pre-made decorative ASCII art scene.
 *
 * @param type - Which scene to generate.
 * @param options - Optional width (default 60) and color hint.
 * @returns Array of strings, one per line, with no trailing whitespace.
 */
export function scene(
  type: SceneType | string,
  options?: SceneOptions,
): string[] {
  const width = options?.width ?? 60;
  if (width <= 0) return [];

  // Check registry for custom scene
  const custom = registry.get("scene", type) as SceneData | null;
  if (custom) {
    // Return the custom art, optionally centered
    return centerLines(custom.art, width);
  }

  // Fall back to built-in generators
  const generators: Record<SceneType, (w: number) => string[]> = {
    mountains: sceneMountains,
    cityscape: sceneCityscape,
    forest: sceneForest,
    ocean: sceneOcean,
    space: sceneSpace,
    clouds: sceneClouds,
    "coffee-cup": sceneCoffeeCup,
    rocket: sceneRocket,
    cat: sceneCat,
    robot: sceneRobot,
    terminal: sceneTerminal,
    "vinyl-record": sceneVinylRecord,
    cassette: sceneCassette,
    "floppy-disk": sceneFloppyDisk,
    gameboy: sceneGameboy,
  };

  const gen = generators[type as SceneType];
  if (gen) return gen(width);
  return [`[Unknown scene: ${type}]`];
}

// ─── mountains ────────────────────────────────────────────────────────────────

function sceneMountains(width: number): string[] {
  // Base mountain template (46 chars wide)
  const baseTemplate = [
    "                    /\\",
    "         /\\       /    \\        /\\",
    "    /\\  /  \\     /      \\  /\\  /  \\",
    "   /  \\/    \\   /        \\/  \\/    \\",
    "  /    \\     \\_/          \\   \\     \\",
    " /      \\     \\            \\   \\     \\",
    "/________\\_____\\____________\\___\\_____\\",
  ];

  // Find the actual width of the template
  const templateWidth = Math.max(...baseTemplate.map(l => l.length));

  if (width <= templateWidth) {
    // Trim or center if width is smaller than template
    return trimLines(centerLines(baseTemplate, width));
  }

  // Stretch to fill: tile the mountain pattern to fill the width
  // We'll repeat the template side by side with slight overlap
  const repeatSegment = [
    "                  /\\",
    "       /\\       /    \\        /\\",
    "  /\\  /  \\     /      \\  /\\  /  \\",
    " /  \\/    \\   /        \\/  \\/    \\",
    "/    \\     \\_/          \\   \\     \\",
    "      \\     \\            \\   \\     \\",
    "_______\\_____\\____________\\___\\_____\\",
  ];
  const segmentWidth = Math.max(...repeatSegment.map(l => l.length));

  const lines: string[] = [];
  for (let row = 0; row < baseTemplate.length; row++) {
    let line = baseTemplate[row];
    // Pad to template width first
    line = line + " ".repeat(Math.max(0, templateWidth - line.length));
    // Append segments until we reach the desired width
    while (line.length < width) {
      const seg = repeatSegment[row] ?? "";
      line += seg;
      if (line.length < width) {
        line += " ".repeat(Math.min(2, width - line.length));
      }
    }
    // Trim or pad to exact width
    if (line.length > width) {
      line = line.slice(0, width);
    }
    // Ensure ground line fills completely
    if (row === baseTemplate.length - 1) {
      line = line.replace(/ /g, "_");
    }
    lines.push(line);
  }

  return trimLines(lines);
}

// ─── cityscape ────────────────────────────────────────────────────────────────

function sceneCityscape(width: number): string[] {
  const height = 10;
  const grid: string[][] = [];
  for (let r = 0; r < height; r++) {
    grid.push(new Array(width).fill(" "));
  }

  // Define buildings: starting x position, width, height (in rows from bottom)
  const buildingCount = Math.max(4, Math.floor(width / 8));
  const rng = createRng(314);
  const buildings: Array<{ x: number; w: number; h: number }> = [];

  let bx = 0;
  for (let i = 0; i < buildingCount && bx < width - 2; i++) {
    const bw = Math.floor(rng() * 4) + 3; // 3-6 wide
    const bh = Math.floor(rng() * 6) + 3; // 3-8 tall
    const gap = Math.floor(rng() * 2);
    buildings.push({ x: bx, w: Math.min(bw, width - bx), h: Math.min(bh, height - 1) });
    bx += bw + gap;
  }

  for (const b of buildings) {
    const top = height - b.h;

    // Antenna on tall buildings
    if (b.h >= 6 && top > 0) {
      const antennaX = b.x + Math.floor(b.w / 2);
      if (antennaX < width) {
        grid[top - 1][antennaX] = "│";
        if (top - 2 >= 0) grid[top - 2][antennaX] = "○";
      }
    }

    // Roof
    for (let x = b.x; x < b.x + b.w && x < width; x++) {
      grid[top][x] = x === b.x ? "┌" : x === b.x + b.w - 1 ? "┐" : "─";
    }

    // Body with windows
    for (let r = top + 1; r < height; r++) {
      for (let x = b.x; x < b.x + b.w && x < width; x++) {
        if (x === b.x) {
          grid[r][x] = "│";
        } else if (x === b.x + b.w - 1) {
          grid[r][x] = "│";
        } else {
          // Window pattern: alternate ░ and space
          const isWindowRow = (r - top) % 2 === 1;
          const isWindowCol = (x - b.x) % 2 === 1;
          grid[r][x] = isWindowRow && isWindowCol ? "░" : " ";
        }
      }
    }
  }

  // Find the rightmost column used by any building
  let maxBuildingX = 0;
  for (const b of buildings) {
    const right = Math.min(b.x + b.w, width);
    if (right > maxBuildingX) maxBuildingX = right;
  }

  // Ground line — only as wide as the buildings, not the full width
  for (let x = 0; x < maxBuildingX; x++) {
    if (grid[height - 1][x] === " ") {
      grid[height - 1][x] = "▀";
    }
  }

  return trimLines(grid.map((row) => row.join("")));
}

// ─── forest ──────────────────────────────────────────────────────────────────

function sceneForest(width: number): string[] {
  const height = 8;
  const grid: string[][] = [];
  for (let r = 0; r < height; r++) {
    grid.push(new Array(width).fill(" "));
  }

  const rng = createRng(271);
  const treeCount = Math.max(3, Math.floor(width / 7));

  let tx = 1;
  for (let i = 0; i < treeCount && tx < width - 3; i++) {
    const type = rng() > 0.5 ? "conifer" : "deciduous";
    const treeH = Math.floor(rng() * 3) + 4; // 4-6 tall

    if (type === "conifer") {
      // Conifer: stacked triangles ▲
      const baseRow = height - 2;
      // Trunk
      if (tx < width) grid[baseRow + 1][tx] = "│";
      if (tx < width) grid[baseRow][tx] = "│";

      // Foliage layers
      for (let layer = 0; layer < Math.min(treeH - 2, baseRow); layer++) {
        const row = baseRow - 1 - layer;
        if (row < 0) break;
        const spread = Math.max(0, Math.min(layer, 2));

        for (let dx = -spread; dx <= spread; dx++) {
          const x = tx + dx;
          if (x >= 0 && x < width) {
            if (layer === treeH - 3 && dx === 0) {
              grid[row][x] = "▲";
            } else {
              grid[row][x] = "█";
            }
          }
        }
      }
    } else {
      // Deciduous: round crown ♣
      const baseRow = height - 2;
      // Trunk
      if (tx < width) grid[baseRow + 1][tx] = "│";
      if (tx < width) grid[baseRow][tx] = "│";

      // Crown
      for (let layer = 0; layer < Math.min(3, baseRow); layer++) {
        const row = baseRow - 1 - layer;
        if (row < 0) break;
        const spread = layer === 2 ? 0 : layer === 1 ? 1 : 2;

        for (let dx = -spread; dx <= spread; dx++) {
          const x = tx + dx;
          if (x >= 0 && x < width) {
            if (layer === 2 && dx === 0) {
              grid[row][x] = "♣";
            } else {
              grid[row][x] = layer === 0 ? "░" : "▒";
            }
          }
        }
      }
    }

    tx += Math.floor(rng() * 4) + 5;
  }

  // Ground line
  for (let x = 0; x < width; x++) {
    if (grid[height - 1][x] === " ") {
      grid[height - 1][x] = rng() > 0.3 ? "▁" : "▂";
    }
  }

  return trimLines(grid.map((row) => row.join("")));
}

// ─── ocean ───────────────────────────────────────────────────────────────────

function sceneOcean(width: number): string[] {
  const height = 6;
  const lines: string[] = [];

  const waveChars = ["∿", "~", "≈", "~", "∿", "≈"];
  const deepChars = ["░", "≈", "░", "~"];

  for (let r = 0; r < height; r++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      const phase = (x + r * 3) % 8;
      if (r === 0) {
        // Sky/horizon line
        line += phase < 4 ? "~" : " ";
      } else if (r === 1) {
        // Waves
        line += waveChars[(x + 1) % waveChars.length];
      } else if (r === 2) {
        // More waves with some foam
        const c = (x + 2) % 6;
        line += c < 3 ? "≈" : "~";
      } else if (r === 3) {
        // Transition
        const c = (x + r) % 5;
        line += c < 2 ? "░" : "≈";
      } else {
        // Deep water
        line += deepChars[(x + r) % deepChars.length];
      }
    }
    lines.push(line);
  }

  return trimLines(lines);
}

// ─── space ───────────────────────────────────────────────────────────────────

function sceneSpace(width: number): string[] {
  const height = 8;
  const rng = createRng(42);
  const grid: string[][] = [];

  for (let r = 0; r < height; r++) {
    grid.push(new Array(width).fill(" "));
  }

  // Scatter stars
  const starChars = ["·", "*", "✦", "★", "·", "·", "*", "·"];
  const starCount = Math.floor(width * height * 0.08);

  for (let i = 0; i < starCount; i++) {
    const x = Math.floor(rng() * width);
    const y = Math.floor(rng() * height);
    grid[y][x] = starChars[Math.floor(rng() * starChars.length)];
  }

  // Draw crescent moon in upper-right area
  const moonCx = Math.min(Math.floor(width * 0.75), width - 6);
  const moonCy = 1;

  const moonPattern = [
    "  ╭──╮",
    " ╱    │",
    "│     │",
    " ╲   ╱",
    "  ╰─╯",
  ];

  for (let mr = 0; mr < moonPattern.length; mr++) {
    const row = moonCy + mr;
    if (row >= height) break;
    for (let mc = 0; mc < moonPattern[mr].length; mc++) {
      const col = moonCx + mc;
      if (col >= width) break;
      if (moonPattern[mr][mc] !== " ") {
        grid[row][col] = moonPattern[mr][mc];
      }
    }
  }

  return trimLines(grid.map((row) => row.join("")));
}

// ─── clouds ──────────────────────────────────────────────────────────────────

function sceneClouds(width: number): string[] {
  const height = 6;
  const grid: string[][] = [];
  for (let r = 0; r < height; r++) {
    grid.push(new Array(width).fill(" "));
  }

  // Draw clouds at different positions
  const cloudPositions = [
    { x: Math.floor(width * 0.05), y: 0 },
    { x: Math.floor(width * 0.4), y: 1 },
    { x: Math.floor(width * 0.7), y: 0 },
    { x: Math.floor(width * 0.2), y: 3 },
    { x: Math.floor(width * 0.6), y: 3 },
  ];

  const cloudTemplate = [
    "   ╭───╮",
    " ╭─┤░░░├──╮",
    "╭┤░░░░░░░░├╮",
    "╰┴────────┴╯",
  ];

  for (const cp of cloudPositions) {
    for (let cr = 0; cr < cloudTemplate.length; cr++) {
      const row = cp.y + cr;
      if (row >= height) break;
      for (let cc = 0; cc < cloudTemplate[cr].length; cc++) {
        const col = cp.x + cc;
        if (col >= width) break;
        if (cloudTemplate[cr][cc] !== " " || grid[row][col] === " ") {
          if (cloudTemplate[cr][cc] !== " ") {
            grid[row][col] = cloudTemplate[cr][cc];
          }
        }
      }
    }
  }

  return trimLines(grid.map((row) => row.join("")));
}

// ─── coffee-cup ──────────────────────────────────────────────────────────────

function sceneCoffeeCup(width: number): string[] {
  const art = [
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⢀⡴⠁⠀⠀⣠⠎⠀⠀⠀⣴⠂⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⢠⣿⣧⡀⠀⢰⣿⣄⠀⠀⣾⣿⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠙⠻⣿⣷⡌⠛⢿⣿⣦⠈⠛⢿⣷⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⡸⠟⠀⠀⢀⠿⠃⠀⠀⠀⠟⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⢀⣀⣀⣈⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⠀⡀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠿⣷⣦⡀⠀⠀⠀",
    "⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⠀⠀⠈⠻⣷⡀⠀⠀",
    "⠀⠀⠀⠀⠘⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠇⠀⠀⠀⠀⣿⡇⠀⠀",
    "⠀⠀⠀⠀⠀⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠀⠀⠀⣀⣾⡿⠁⠀⠀",
    "⠀⠀⠀⠀⠀⠈⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠃⣸⣿⣿⠿⠛⠁⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠘⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠈⢿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠠⣶⣶⣶⣶⣶⣶⣶⣶⣶⣶⣶⣶⣶⣶⣶⣶⣶⣶⣶⣶⡆⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠀⠀⠀⠀⠀⠀⠀",
  ];

  return trimLines(centerLines(art, width));
}

// ─── rocket ──────────────────────────────────────────────────────────────────

function sceneRocket(width: number): string[] {
  // Rocket art from ascii.co.uk/art/rockets
  const art = [
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣤⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⣴⣿⣿⡿⣆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣰⣿⣿⠛⠹⣼⣆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣰⣿⣿⣿⣧⣄⠀⢹⣆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⢰⣿⣫⠏⡉⠈⠉⠀⠀⢿⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⣠⣾⡿⣿⠀⢷⣆⢀⠀⠀⢸⣿⣷⡄⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⢀⣾⣯⣿⢁⣿⡶⣶⣮⡁⠀⢀⣞⣿⢻⡟⢦⡄⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⢀⣴⣿⣿⡟⡇⢸⣯⣿⡍⣯⠅⠄⢻⣿⣿⣾⡇⠀⠙⢶⣄⠀⠀⠀",
    "⠀⠀⢀⣰⣟⣉⣉⡿⢳⣿⢾⣿⣿⡃⢻⠂⡀⠀⠉⠉⢸⣿⡶⣶⠾⢟⣷⣄⠀",
    "⠀⢠⣿⣿⣉⣟⣿⡇⣾⠃⠘⢛⠛⠃⠘⠃⠀⠀⠀⠀⢹⣿⡿⢟⣻⣫⣽⣿⠀",
    "⠀⢸⡇⢶⣮⣿⣿⠟⢻⣇⠘⣺⣶⢘⣃⠀⠀⠀⠀⠀⢸⣿⣿⠋⢙⣿⣿⣿⠀",
    "⠀⢸⣷⣾⣿⣿⣿⣦⠸⢻⣿⣿⣿⣿⣿⣧⣄⠀⠀⠀⢈⣿⣿⣷⣾⣿⣿⣿⠀",
    "⠀⠘⠛⠛⠛⠛⢻⣿⣶⣾⣿⣾⣿⣤⣿⣷⣤⡤⠀⢠⣼⣿⡏⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⢾⡿⠉⠁⠐⠾⣿⡆⢸⡇⠀⠀⢐⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⢺⠀⢤⣤⢴⣤⠙⡃⠘⠁⠀⠀⣿⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠸⣧⠈⠉⠘⣿⠆⠈⢘⡀⠀⠀⠀⠀⠈⣿⡏⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⢰⣿⡟⠹⡟⠉⠘⠃⠉⠉⠉⠁⠀⠀⠀⣿⡇⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⢸⣿⣇⣀⣇⣷⣘⣋⡀⠀⠀⠀⠀⠀⠀⣿⡇⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠸⣿⣿⣽⣿⣷⢰⡶⢐⡂⠀⠀⠀⠀⠀⣿⡇⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⢘⣿⡯⣽⣿⣿⣿⡓⢾⠓⠒⠆⠀⠀⠘⢻⡇⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⡿⠿⣿⣿⣿⣶⣾⣿⠆⠀⠀⣿⡇⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⢰⣿⣿⠟⢷⣴⣿⣿⣯⡍⠉⠉⠀⢀⡀⢹⡇⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠐⢿⣿⣿⢰⣾⣿⡟⢿⣿⣿⣆⠀⠀⠛⠁⣸⡇⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⢸⣿⡟⠿⣿⣿⣗⡒⠚⠛⠛⠓⠂⠀⠀⢿⡇⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⢸⣿⣵⡇⢸⣿⣧⣀⠀⠀⠀⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⢸⣿⣿⣅⣾⣿⣇⣈⣘⣛⠀⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⣿⣻⡿⢻⣿⡏⠉⠉⠉⠁⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠸⢿⣼⣅⣼⣿⡃⣠⠰⠶⠀⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⣿⣯⡟⢿⣿⡿⢿⣧⡀⠀⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠸⣿⡿⣧⣾⣿⣿⠖⠚⠋⠁⠀⠀⣀⠀⢸⡇⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⣿⣿⣜⣻⣿⣿⡀⣠⣤⡀⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⣿⡏⠹⣽⣿⡏⠛⠈⠉⠁⠉⠀⠈⠁⢸⡇⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⣿⡏⠀⢸⣿⡷⠼⠤⠄⠀⠆⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⣿⡇⠀⢸⣿⡇⠀⠀⠀⢸⡇⠀⠀⠀⣸⣧⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⣼⣿⣷⡾⢸⣿⡇⣷⠀⠀⠈⡇⠀⠀⢰⣿⣿⣇⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⣼⡏⢸⡏⣁⣼⣿⣧⣉⡀⠀⠀⠛⠀⠀⢸⡏⣿⣿⣆⠀⠀⠀⠀",
    "⠀⠀⠀⠀⡼⠋⣿⠘⡯⣽⣹⣿⡟⠁⠉⠻⠀⠀⠀⠀⢸⡇⣿⣄⠹⣆⠀⠀⠀",
    "⠀⠀⠀⣸⠃⢠⣿⠀⣧⠌⢹⣿⣷⣦⡤⠤⠤⢤⠄⠤⢾⡇⣿⡇⠀⠘⣧⠀⠀",
    "⠀⠀⣼⢣⡀⢻⣿⠀⠀⡀⢸⣿⡇⣿⠁⠀⠺⣿⣿⠄⢠⣿⣿⡷⠦⣤⡜⢧⡀",
    "⠠⣾⡷⠿⠇⢸⣿⣀⣀⣧⣼⣿⣇⣜⣂⣿⣆⣤⣀⣀⢸⣿⣿⣿⠶⠶⠤⢾⣧",
    "⠀⣿⡗⠒⠒⢲⣿⢩⣹⣏⢿⣿⣿⡀⠀⠈⠁⠀⠀⠀⢸⣿⣿⡟⠋⠙⣻⣻⣿",
    "⠀⣿⡇⠀⠀⢸⣿⢸⡿⡏⢻⣿⣿⣻⡇⡀⠀⠀⠀⠈⢹⣿⣿⡇⠠⠀⢉⣹⣿",
    "⠀⣿⡇⠀⠀⢼⣿⣿⡇⣷⣾⣧⣿⣮⠷⣶⣦⣦⣀⣴⢾⣿⣽⣷⡌⠒⠶⢾⣿",
    "⠀⣿⣧⡶⠒⢻⣿⠈⠀⣼⣿⣿⣿⠇⠀⠀⠀⠀⠀⠀⢸⣿⣿⣇⠈⠛⠛⢻⣿",
    "⠀⣿⡇⠹⢦⣼⣿⣿⡖⡟⣹⣿⣿⠷⠀⠀⠀⠀⠀⠶⠸⣿⣿⡏⠑⣠⣬⣿⣿",
    "⠀⣿⡇⢀⣠⣸⣿⣸⡇⢺⣿⣿⣿⣤⣀⣀⠀⠀⠀⣷⢠⣿⣿⣷⣤⣤⣤⣾⣿",
    "⠀⠛⠛⣧⣹⣿⣿⣿⣿⣿⣿⣿⣿⣾⡿⢿⣶⣷⣶⣿⣾⣿⣿⣟⣋⣙⡛⠛⠛",
  ];

  return trimLines(centerLines(art, width));
}

// ─── cat ─────────────────────────────────────────────────────────────────────

function sceneCat(width: number): string[] {
  // Cat art from asciiart.eu
  const art = [
    "  /\\_/\\",
    " ( o.o )",
    "  > ^ <",
    " /|   |\\",
    "(_|   |_)",
  ];

  return trimLines(centerLines(art, width));
}

// ─── robot ───────────────────────────────────────────────────────────────────

function sceneRobot(width: number): string[] {
  const art = [
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⠞⠉⠉⢳⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⡀⠀⠀⣠⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⡖⢾⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⠁⠸⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡞⠀⠀⣇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢰⠒⠒⠒⠒⠒⠒⠲⠲⠚⠓⠒⠒⠛⠓⢒⣖⠒⠒⠒⠒⠒⠒⢲⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣼⠀⠀⠀⠀⢠⠖⠋⠉⠷⣄⠀⠀⢠⠖⠉⠉⠑⢦⠀⠀⠀⠀⢸⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡟⠉⢻⠀⠀⠀⠀⣿⣾⣿⣦⡀⢸⠀⠀⢿⣿⣿⣷⡀⢸⠀⠀⠀⠀⢸⠋⠙⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡇⠀⢸⠀⣀⠀⠀⠘⢿⣿⢟⣂⠞⠀⠀⠈⠿⣿⣿⣡⠞⠀⠀⠀⠀⢸⠀⠀⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡇⣾⠉⠉⠙⢧⡀⠀⠀⠉⠉⠁⠀⠀⠀⠀⠀⠈⠉⠀⠀⠀⣠⠞⠉⠉⡙⣇⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⣻⠀⠀⠀⠀⠙⢦⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣠⠞⠁⠀⠀⠀⠇⡏⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠿⡤⣤⣤⣤⣤⣤⣤⣤⣤⣤⢤⠤⠤⠤⠤⢤⣤⣤⣤⣤⣤⣤⡤⢤⣤⠇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡴⠟⠛⠦⣄⡀⣀⣿⡛⣛⣛⣛⢛⢛⢛⣷⣀⣀⣴⢛⡛⠶⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡟⠀⠀⣿⣩⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⢿⢭⡉⡇⠀⠸⣆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣸⡇⠀⠀⣿⣽⠀⠀⣶⡆⠀⠀⠀⠀⠀⢠⡄⠀⠀⠀⢠⣇⡇⠀⢀⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣰⠃⠘⢦⣰⣿⣿⠀⢰⡿⡇⣄⠀⠀⠀⠀⣼⣇⣠⠀⠀⢸⣿⣇⡠⠞⠈⢧⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⣰⡃⠀⠀⢠⠟⣿⣿⠤⠾⠀⢻⠛⡄⢰⠤⠽⠏⣿⡟⡷⠶⢼⡿⡟⢆⠀⠀⠈⣣⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⢠⡟⠛⠦⣴⠏⠀⣿⣼⠀⠀⠀⠀⠀⢻⡞⠀⠀⠀⠻⠇⠀⠀⠀⡇⡇⠈⢷⡴⠚⠙⣆⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⢀⡴⠿⢦⣀⡾⠁⠀⠀⣿⢾⣀⣀⣀⣀⣀⣀⣁⣀⣀⣀⣀⣀⣀⣀⣠⣷⡇⠀⠈⠻⣄⡰⠾⠶⣄⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⣀⣤⡴⣟⠀⠀⠀⣹⠀⠀⠀⠰⣿⣈⡿⢯⡉⣿⣿⣿⣿⣿⣿⣿⣿⡏⢉⡿⢯⣀⡇⠀⠀⠀⢿⠀⠀⠀⢸⡦⣤⣄⠀⠀⠀",
    "⠀⢀⡴⠋⠀⠁⠹⣤⣀⡤⠏⠀⠀⠀⠐⣿⠹⣄⡼⠟⣿⣿⣿⣿⣿⣿⣿⣿⡶⠻⣶⡴⠿⡇⠀⠀⠀⠘⢦⣀⣠⠞⠃⠀⠈⠳⡀⠀",
    "⢠⡟⠀⢠⡶⣄⠀⠀⢸⠀⠀⠀⠀⠀⠘⢿⣤⣼⣤⣤⣤⣶⣧⣶⣦⣶⣴⣦⣤⣤⣴⣤⣤⡇⠀⠀⠀⠀⠀⣼⠀⠀⣀⠶⣄⠀⠹⡄",
    "⠸⣇⡴⠋⢠⠞⠀⣰⠟⠁⠀⠀⠀⠀⠀⠀⢿⡀⠀⠀⠀⠀⣨⡷⠀⢺⣆⢀⠀⠀⠀⢀⡽⠀⠀⠀⠀⠀⠀⠹⣄⠀⠹⣄⠈⢳⣠⠇",
    "⠀⠙⠁⣴⣋⣀⡴⠋⠀⠀⠀⠀⠀⠀⠀⠀⣼⠋⠉⠉⠉⠉⠙⣦⡠⣶⠋⠉⠉⠉⠉⠉⢳⠄⠀⠀⠀⠀⠀⠀⠈⠣⣀⣙⣦⡀⠛⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣹⠖⠖⠲⠒⠒⠿⣇⡀⣨⠗⠒⠒⠒⠒⠲⣯⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠉⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢹⣤⠤⠤⢴⢶⣶⡟⠂⢙⡦⠤⠤⢤⣤⣤⡟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡤⠖⠛⠚⠛⠚⠓⠲⢤⡷⠀⣻⠦⠖⠒⠛⠛⠛⠛⠒⠤⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡞⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⣧⠀⣺⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠳⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣿⠁⢻⣄⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣹⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  ];

  return trimLines(centerLines(art, width));
}

// ─── terminal ────────────────────────────────────────────────────────────────

function sceneTerminal(width: number): string[] {
  const innerW = Math.max(20, width - 2);
  const border = "─".repeat(innerW);

  function padLine(content: string): string {
    const contentLen = [...content].length; // codepoint count (safe for BMP chars used here)
    const padding = Math.max(0, innerW - contentLen);
    return "\u2502" + content + " ".repeat(padding) + "\u2502";
  }

  const lines = [
    "┌" + border + "┐",
    padLine(" ● ○ ○   Terminal"),
    "├" + border + "┤",
    padLine(' $ echo "hello world"'),
    padLine(" hello world"),
    padLine(" $ npm start"),
    padLine(" Server running on :3000"),
    padLine(" $ █"),
    "└" + border + "┘",
  ];

  return trimLines(centerLines(lines, width));
}

// ─── vinyl-record ────────────────────────────────────────────────────────────

function sceneVinylRecord(width: number): string[] {
  const art = [
    "     ╭───────────╮",
    "   ╭─┤░░░░░░░░░░░├─╮",
    "  │░░│░░░╭───╮░░░│░░│",
    "  │░░│░░░│ ◎ │░░░│░░│",
    "  │░░│░░░╰───╯░░░│░░│",
    "   ╰─┤░░░░░░░░░░░├─╯",
    "     ╰───────────╯",
  ];

  return trimLines(centerLines(art, width));
}

// ─── cassette ────────────────────────────────────────────────────────────────

function sceneCassette(width: number): string[] {
  const art = [
    " ┌────────────────────────┐",
    " │  MIXTAPE  vol.1  C-90  │",
    " │ ┌──────────────────┐   │",
    " │ │  ╭──╮  ░░░ ╭──╮  │  │",
    " │ │  │◎ │ ░░░░░│ ◎│  │  │",
    " │ │  ╰──╯  ░░░ ╰──╯  │  │",
    " │ └──────────────────┘   │",
    " │  ╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲   │",
    " └────────────────────────┘",
  ];

  return trimLines(centerLines(art, width));
}

// ─── floppy-disk ─────────────────────────────────────────────────────────────

function sceneFloppyDisk(width: number): string[] {
  const art = [
    " ┌───────────────────┐",
    " │ ┌───────────────┐ │",
    " │ │ ▒▒▒▒▒▒▒▒▒▒▒▒▒ │ │",
    " │ └───────────────┘ │",
    " │                   │",
    " │  ┌─────────────┐  │",
    " │  │ ░░░░░░░░░░░ │  │",
    " │  │ ░░░░░░░░░░░ │  │",
    " │  │ ░░░░░░░░░░░ │  │",
    " └──┴─────────────┴──┘",
  ];

  return trimLines(centerLines(art, width));
}

// ─── gameboy ─────────────────────────────────────────────────────────────────

function sceneGameboy(width: number): string[] {
  const art = [
    "  ╭──────────────────╮",
    "  │  ╭────────────╮  │",
    "  │  │            │  │",
    "  │  │   GAME     │  │",
    "  │  │    BOY     │  │",
    "  │  │            │  │",
    "  │  ╰────────────╯  │",
    "  │        ┌─┐       │",
    "  │   ┌─┐  └─┘       │",
    "  │ ──┤ ├──    (A)(B) │",
    "  │   └─┘            │",
    "  │      START SELECT │",
    "  ╰──────────────────╯",
  ];

  return trimLines(centerLines(art, width));
}
