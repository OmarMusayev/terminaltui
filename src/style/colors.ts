export type ColorMode = "truecolor" | "256" | "16" | "none";

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return null;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(c => c.toString(16).padStart(2, "0")).join("");
}

/**
 * Detect terminal color support.
 * Priority: NO_COLOR → Apple Terminal cap → COLORTERM → known terminals → TERM → fallback
 */
export function detectColorSupport(): ColorMode {
  const env = process.env;

  // NO_COLOR standard: https://no-color.org/
  if (env.NO_COLOR !== undefined) return "none";

  // Apple Terminal — ALWAYS cap at 256-color, never truecolor
  if (env.TERM_PROGRAM === "Apple_Terminal") return "256";

  // Reliable truecolor detection
  if (
    env.COLORTERM === "truecolor" ||
    env.COLORTERM === "24bit"
  ) return "truecolor";

  // Known truecolor terminals
  if (
    env.TERM_PROGRAM === "iTerm.app" ||
    env.TERM_PROGRAM === "WezTerm" ||
    env.TERM_PROGRAM === "vscode" ||
    env.TERM_PROGRAM === "Hyper" ||
    env.TERM_PROGRAM === "WarpTerminal" ||
    env.WT_SESSION !== undefined // Windows Terminal
  ) {
    return env.COLORTERM ? "truecolor" : "256";
  }

  // Fallback: check TERM
  if (env.TERM?.includes("256color")) return "256";
  if (env.TERM) return "16";

  return "none";
}

// Auto-detect on module load
let colorMode: ColorMode = detectColorSupport();

/** Sets the color output mode (truecolor, 256, 16, or none). */
export function setColorMode(mode: ColorMode): void {
  colorMode = mode;
}

/** Returns the current color output mode. */
export function getColorMode(): ColorMode {
  return colorMode;
}

// Convert RGB to closest ANSI 256-color index
export function rgbTo256(r: number, g: number, b: number): number {
  // Check if it's close to a grayscale value (232-255)
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round((r - 8) / 247 * 24) + 232;
  }
  // Map to 6x6x6 color cube (indices 16-231)
  const ri = Math.round(r / 255 * 5);
  const gi = Math.round(g / 255 * 5);
  const bi = Math.round(b / 255 * 5);
  return 16 + 36 * ri + 6 * gi + bi;
}

// Map RGB to nearest ANSI 16-color code (30-37, 90-97 for bright)
const ansi16Table: Array<{ r: number; g: number; b: number; code: number }> = [
  { r: 0, g: 0, b: 0, code: 30 },       // black
  { r: 170, g: 0, b: 0, code: 31 },     // red
  { r: 0, g: 170, b: 0, code: 32 },     // green
  { r: 170, g: 170, b: 0, code: 33 },   // yellow
  { r: 0, g: 0, b: 170, code: 34 },     // blue
  { r: 170, g: 0, b: 170, code: 35 },   // magenta
  { r: 0, g: 170, b: 170, code: 36 },   // cyan
  { r: 170, g: 170, b: 170, code: 37 }, // white
  { r: 85, g: 85, b: 85, code: 90 },    // bright black
  { r: 255, g: 85, b: 85, code: 91 },   // bright red
  { r: 85, g: 255, b: 85, code: 92 },   // bright green
  { r: 255, g: 255, b: 85, code: 93 },  // bright yellow
  { r: 85, g: 85, b: 255, code: 94 },   // bright blue
  { r: 255, g: 85, b: 255, code: 95 },  // bright magenta
  { r: 85, g: 255, b: 255, code: 96 },  // bright cyan
  { r: 255, g: 255, b: 255, code: 97 }, // bright white
];

function rgbTo16(r: number, g: number, b: number): number {
  let best = 30;
  let bestDist = Infinity;
  for (const entry of ansi16Table) {
    const dr = r - entry.r;
    const dg = g - entry.g;
    const db = b - entry.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = entry.code;
    }
  }
  return best;
}

/** Generates an ANSI foreground color escape sequence from a hex color. */
export function fgColor(hex: string): string {
  if (colorMode === "none") return "";
  const rgb = hexToRgb(hex);
  if (!rgb) return "";
  return fgColorRgb(rgb.r, rgb.g, rgb.b);
}

/** Same as fgColor but takes RGB directly. Honors colorMode (256-color fallback for Apple Terminal). */
export function fgColorRgb(r: number, g: number, b: number): string {
  if (colorMode === "none") return "";
  if (colorMode === "16") {
    return `\x1b[${rgbTo16(r, g, b)}m`;
  }
  if (colorMode === "256") {
    return `\x1b[38;5;${rgbTo256(r, g, b)}m`;
  }
  return `\x1b[38;2;${r};${g};${b}m`;
}

export function bgColor(hex: string): string {
  if (colorMode === "none") return "";
  const rgb = hexToRgb(hex);
  if (!rgb) return "";
  if (colorMode === "16") {
    // bg codes are fg + 10
    return `\x1b[${rgbTo16(rgb.r, rgb.g, rgb.b) + 10}m`;
  }
  if (colorMode === "256") {
    return `\x1b[48;5;${rgbTo256(rgb.r, rgb.g, rgb.b)}m`;
  }
  return `\x1b[48;2;${rgb.r};${rgb.g};${rgb.b}m`;
}

export function interpolateColor(from: string, to: string, t: number): string {
  const f = hexToRgb(from);
  const tt = hexToRgb(to);
  if (!f || !tt) return from;
  const r = Math.round(f.r + (tt.r - f.r) * t);
  const g = Math.round(f.g + (tt.g - f.g) * t);
  const b = Math.round(f.b + (tt.b - f.b) * t);
  return rgbToHex(r, g, b);
}

export function createGradient(colors: string[], steps: number): string[] {
  if (colors.length === 0) return [];
  if (colors.length === 1) return Array(steps).fill(colors[0]) as string[];

  const result: string[] = [];

  for (let i = 0; i < steps; i++) {
    const segment = steps <= 1 ? 0 : (i / (steps - 1)) * (colors.length - 1);
    const segIndex = Math.min(Math.floor(segment), colors.length - 2);
    const t = segment - segIndex;
    result.push(interpolateColor(colors[segIndex], colors[Math.min(segIndex + 1, colors.length - 1)], t));
  }

  return result;
}

export function applyGradientToText(text: string, colors: string[]): string {
  if (colorMode === "none") return text;
  const chars = [...text];
  const nonSpaceIndices = chars.map((c, i) => c !== " " ? i : -1).filter(i => i >= 0);
  if (nonSpaceIndices.length === 0) return text;

  const gradientColors = createGradient(colors, nonSpaceIndices.length);
  let colorIdx = 0;
  let result = "";

  for (let i = 0; i < chars.length; i++) {
    if (chars[i] !== " " && colorIdx < gradientColors.length) {
      result += fgColor(gradientColors[colorIdx]) + chars[i];
      colorIdx++;
    } else {
      result += chars[i];
    }
  }

  return result + reset;
}

export const reset = colorMode === "none" ? "" : "\x1b[0m";
export const bold = colorMode === "none" ? "" : "\x1b[1m";
export const dim = colorMode === "none" ? "" : "\x1b[2m";
export const italic = colorMode === "none" ? "" : "\x1b[3m";
export const underline = colorMode === "none" ? "" : "\x1b[4m";
export const inverse = colorMode === "none" ? "" : "\x1b[7m";
