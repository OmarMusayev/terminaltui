/**
 * ASCII art geometric shape generators.
 * Each function returns string[] (one element per line).
 */

import { getBorderChars, type BorderStyle } from "../style/borders.js";

type BoxStyle = "single" | "double" | "rounded" | "heavy" | "ascii";

/**
 * Rectangle using border characters.
 */
export function box(width: number, height: number, style?: BoxStyle): string[] {
  if (width <= 0 || height <= 0) return [];
  if (width === 1 && height === 1) return ["*"];

  const chars = getBorderChars(style ?? "single");
  const lines: string[] = [];
  const innerWidth = Math.max(0, width - 2);

  if (height === 1) {
    return [chars.horizontal.repeat(width)];
  }

  lines.push(chars.topLeft + chars.horizontal.repeat(innerWidth) + chars.topRight);
  for (let i = 0; i < height - 2; i++) {
    lines.push(chars.vertical + " ".repeat(innerWidth) + chars.vertical);
  }
  lines.push(chars.bottomLeft + chars.horizontal.repeat(innerWidth) + chars.bottomRight);

  return lines;
}

/**
 * Circle/ellipse approximation for the terminal.
 * Uses hand-tuned templates for common radii (2-8) for clean output.
 * Falls back to math rasterization with █ for other sizes.
 */
export function circle(radius: number, fill?: string): string[] {
  if (radius <= 0) return [];
  if (radius === 1) return ["██"];

  // Hand-tuned circle templates for radii 2-8.
  // Each uses █ for the outline, accounting for 2:1 terminal aspect ratio.
  const templates: Record<number, string[]> = {
    2: [
      "  ████",
      "██    ██",
      "██    ██",
      "  ████",
    ],
    3: [
      "     ****",
      "   **    **",
      "  **      **",
      "  **      **",
      "   **    **",
      "     ****",
    ],
    4: [
      "      ██████",
      "    ██      ██",
      "  ██          ██",
      "  ██          ██",
      "  ██          ██",
      "    ██      ██",
      "      ██████",
    ],
    5: [
      "       ******",
      "     **      **",
      "   **          **",
      "  **            **",
      "  **            **",
      "  **            **",
      "   **          **",
      "     **      **",
      "       ******",
    ],
    6: [
      "        ████████",
      "      ██        ██",
      "    ██            ██",
      "   ██              ██",
      "  ██                ██",
      "  ██                ██",
      "   ██              ██",
      "    ██            ██",
      "      ██        ██",
      "        ████████",
    ],
    7: [
      "          ████████",
      "       ██        ██",
      "     ██            ██",
      "    ██              ██",
      "   ██                ██",
      "  ██                  ██",
      "  ██                  ██",
      "   ██                ██",
      "    ██              ██",
      "     ██            ██",
      "       ██        ██",
      "          ████████",
    ],
    8: [
      "           ██████████",
      "        ██          ██",
      "      ██              ██",
      "     ██                ██",
      "    ██                  ██",
      "   ██                    ██",
      "   ██                    ██",
      "   ██                    ██",
      "    ██                  ██",
      "     ██                ██",
      "      ██              ██",
      "        ██          ██",
      "           ██████████",
    ],
  };

  // Use template if available
  if (templates[radius]) {
    return templates[radius].map(l => l.trimEnd());
  }

  // Fallback: math rasterization with █ for radii outside templates
  const fillChar = fill ?? " ";
  const diameter = radius * 2;
  const hScale = 2;
  const width = diameter * hScale;
  const lines: string[] = [];

  for (let y = 0; y <= diameter; y++) {
    const dy = y - radius;
    let line = "";
    let lastNonSpace = -1;

    for (let x = 0; x <= width; x++) {
      const dx = (x - radius * hScale) / hScale;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (Math.abs(dist - radius) < 0.5) {
        line += "█";
        lastNonSpace = line.length;
      } else if (dist < radius - 0.5) {
        line += fillChar;
        if (fillChar !== " ") {
          lastNonSpace = line.length;
        }
      } else {
        line += " ";
      }
    }

    const trimmed = line.substring(0, lastNonSpace >= 0 ? lastNonSpace : 0);
    if (trimmed.length > 0 || (y > 0 && y < diameter)) {
      lines.push(trimmed);
    }
  }

  while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();

  return lines.map(l => l.trimEnd());
}

/**
 * Diamond shape using / and \ chars.
 * Size is the half-width (distance from center to edge).
 */
export function diamond(size: number, fill?: string): string[] {
  if (size <= 0) return [];
  if (size === 1) return ["/\\", "\\/"];

  const fillChar = fill ?? " ";
  const lines: string[] = [];
  const width = size * 2;

  // Top half (including middle)
  for (let i = 0; i < size; i++) {
    const spaces = size - i - 1;
    const inner = i * 2;
    if (inner === 0) {
      lines.push(" ".repeat(spaces) + "/\\");
    } else {
      const content = fillChar.repeat(inner);
      lines.push(" ".repeat(spaces) + "/" + content + "\\");
    }
  }

  // Bottom half
  for (let i = size - 1; i >= 0; i--) {
    const spaces = size - i - 1;
    const inner = i * 2;
    if (inner === 0) {
      lines.push(" ".repeat(spaces) + "\\/");
    } else {
      const content = fillChar.repeat(inner);
      lines.push(" ".repeat(spaces) + "\\" + content + "/");
    }
  }

  return lines.map(l => l.trimEnd());
}

/**
 * Triangle shape.
 * direction: "up" | "down" | "left" | "right"
 */
export function triangle(size: number, direction?: "up" | "down" | "left" | "right"): string[] {
  if (size <= 0) return [];
  if (size === 1) return ["*"];

  const dir = direction ?? "up";
  const lines: string[] = [];

  switch (dir) {
    case "up": {
      // Top point going down to base
      for (let i = 0; i < size - 1; i++) {
        const padding = size - i - 1;
        if (i === 0) {
          lines.push(" ".repeat(padding) + "/\\");
        } else {
          lines.push(" ".repeat(padding) + "/" + " ".repeat(i * 2) + "\\");
        }
      }
      // Base
      const baseWidth = (size - 1) * 2 + 2;
      lines.push("/" + "_".repeat(baseWidth - 2) + "\\");
      break;
    }
    case "down": {
      // Top base going down to point
      const baseWidth = (size - 1) * 2 + 2;
      lines.push("\\" + "‾".repeat(baseWidth - 2) + "/");
      for (let i = size - 2; i > 0; i--) {
        const padding = size - i - 1;
        lines.push(" ".repeat(padding) + "\\" + " ".repeat(i * 2) + "/");
      }
      lines.push(" ".repeat(size - 1) + "\\/");
      break;
    }
    case "right": {
      // Right-pointing triangle
      const height = size * 2 - 1;
      const mid = size - 1;
      for (let i = 0; i < height; i++) {
        const dist = i <= mid ? i : height - 1 - i;
        if (i === 0) {
          lines.push("\\");
        } else if (i === height - 1) {
          lines.push("/");
        } else if (i === mid) {
          lines.push("─".repeat(dist) + "▶");
        } else if (i < mid) {
          lines.push(" ".repeat(dist) + "\\");
        } else {
          lines.push(" ".repeat(dist) + "/");
        }
      }
      break;
    }
    case "left": {
      // Left-pointing triangle
      const height = size * 2 - 1;
      const mid = size - 1;
      const maxWidth = size;
      for (let i = 0; i < height; i++) {
        const dist = i <= mid ? i : height - 1 - i;
        const indent = maxWidth - dist - 1;
        if (i === 0) {
          lines.push(" ".repeat(indent) + "/");
        } else if (i === height - 1) {
          lines.push(" ".repeat(indent) + "\\");
        } else if (i === mid) {
          lines.push("◀" + "─".repeat(dist));
        } else if (i < mid) {
          lines.push(" ".repeat(indent) + "/");
        } else {
          lines.push(" ".repeat(indent) + "\\");
        }
      }
      break;
    }
  }

  return lines.map(l => l.trimEnd());
}

/**
 * Heart shape. Size 3-10.
 */
export function heart(size: number): string[] {
  if (size <= 0) return [];
  if (size < 3) size = 3;

  // ASCII art hearts from ascii.co.uk/art/hearts
  const templates: Record<number, string[]> = {
    3: [
      "⢰⠏⠉⠳⡜⠉⠙⡆",
      "⠘⢦⡀⠀⠁⢠⡾⠁",
      "⠀⠀⠙⢦⡴⠟⠀⠀",
    ],
    5: [
      "  /\\  /\\",
      " /  \\/  \\",
      " \\      /",
      "  \\    /",
      "   \\  /",
      "    \\/",
    ],
    7: [
      "   ***     ***",
      " **   ** **   **",
      "*       *       *",
      "*               *",
      " *             *",
      "  **         **",
      "    **     **",
      "      ** **",
      "        *",
    ],
    10: [
      "⠀⠀⢀⣤⣾⣿⣿⣿⣿⣿⣶⣤⡀⢀⣤⣶⣿⣿⣿⣿⣿⣷⣤⡀⠀⠀",
      "⠀⣰⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣆⠀",
      "⢠⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡄",
      "⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇",
      "⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀",
      "⠀⠘⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠃⠀",
      "⠀⠀⠈⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠁⠀⠀",
      "⠀⠀⠀⠀⠙⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠋⠀⠀⠀⠀",
      "⠀⠀⠀⠀⠀⠀⠙⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠋⠀⠀⠀⠀⠀⠀",
      "⠀⠀⠀⠀⠀⠀⠀⠀⠙⢿⣿⣿⣿⣿⣿⣿⡿⠋⠀⠀⠀⠀⠀⠀⠀⠀",
      "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠻⣿⣿⠟⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
      "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    ],
  };

  const keys = Object.keys(templates).map(Number).sort((a, b) => a - b);
  let best = keys[keys.length - 1];
  for (const k of keys) {
    if (k >= size) { best = k; break; }
  }

  return (templates[best] ?? templates[10]).map(l => l.trimEnd());
}

// Re-export complex shapes from split file
export { star, arrow, hexagon, line } from "./shapes-extra.js";
