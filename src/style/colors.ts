import type { RGB } from "../image/types.js";
import { ANSI16_TABLE, xterm256Index, xterm256Rgb } from "./xterm-palette.js";

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
 * The Terminal.app build that first renders 24-bit colour faithfully.
 *
 * Terminal.app is the one significant terminal that gained truecolour without
 * ever setting COLORTERM, so there is no capability signal to read and the
 * depth has to be sniffed from `TERM_PROGRAM_VERSION` (its CFBundleVersion).
 * macOS 26 Tahoe ships build 470; every earlier build parses an SGR `38;2`
 * triple but snaps it to its own 256-colour palette, which is strictly worse
 * than quantizing here — we lose control of the rounding and gain nothing.
 *
 * Announced at WWDC 2025 and confirmed in termstandard/colors#69. Verified
 * directly against build 470.2 on macOS 26: a 60-step ramp spanning the
 * xterm cube's 0→95 gap came out perfectly smooth, where a 256-snapping build
 * renders that same ramp as three hard bands.
 */
const APPLE_TRUECOLOR_BUILD = 470;

/**
 * Apple Terminal's colour depth for a given `TERM_PROGRAM_VERSION`.
 *
 * An absent or unparseable version resolves to "256" — the safe end of the
 * guess, since over-reporting paints every themed component with codes the
 * terminal will mangle, while under-reporting merely quantizes.
 */
function appleTerminalColorMode(version: string | undefined): ColorMode {
  const build = parseInt(version ?? "", 10);
  return Number.isNaN(build) || build < APPLE_TRUECOLOR_BUILD ? "256" : "truecolor";
}

/**
 * Detect terminal color support from the environment (NO_COLOR / TERM_PROGRAM /
 * COLORTERM / TERM). This is the single canonical capability sniffer —
 * detectTerminal() in helpers/detect-terminal.ts delegates its colorDepth to
 * this function (adding a non-TTY → "none" gate on top).
 * Priority: NO_COLOR → TERMINALTUI_COLOR → Apple Terminal build → COLORTERM →
 * known terminals → TERM → fallback
 */
export function detectColorSupport(): ColorMode {
  const env = process.env;

  // NO_COLOR standard: https://no-color.org/
  if (env.NO_COLOR !== undefined) return "none";

  // Explicit override, mirroring TERMINALTUI_GRAPHICS. Every branch below this
  // is a heuristic — and the Apple one is a version sniff, which is the kind of
  // guess that has to come with a way out. Also the only way to view the
  // 256-colour path on a terminal that now reports truecolour.
  const forced = env.TERMINALTUI_COLOR?.trim().toLowerCase();
  if (forced === "truecolor" || forced === "24bit") return "truecolor";
  if (forced === "256" || forced === "16" || forced === "none") {
    return forced === "256" ? "256" : forced === "16" ? "16" : "none";
  }

  // Apple Terminal: version-sniffed, never declared. See the note on
  // APPLE_TRUECOLOR_BUILD for why this cannot read COLORTERM like the rest.
  if (env.TERM_PROGRAM === "Apple_Terminal") {
    return appleTerminalColorMode(env.TERM_PROGRAM_VERSION);
  }

  // Reliable truecolor detection
  if (
    env.COLORTERM === "truecolor" ||
    env.COLORTERM === "24bit" ||
    env.TERM?.includes("truecolor") ||
    env.TERM?.includes("24bit")
  ) return "truecolor";

  // Known truecolor terminals (native truecolor support even when COLORTERM
  // isn't propagated)
  if (
    env.TERM_PROGRAM === "iTerm.app" ||
    env.TERM_PROGRAM === "WezTerm" ||
    env.TERM_PROGRAM === "vscode" ||
    env.TERM_PROGRAM === "Hyper" ||
    env.TERM_PROGRAM === "WarpTerminal" ||
    env.WT_SESSION !== undefined // Windows Terminal
  ) {
    return "truecolor";
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
  // Recompute the text-attribute live bindings so a runtime mode change
  // (per-SSH-connection color, or a test forcing a mode) actually takes
  // effect. They'd otherwise stay frozen to the mode detected at load.
  reset = colorMode === "none" ? "" : "\x1b[0m";
  bold = colorMode === "none" ? "" : "\x1b[1m";
  dim = colorMode === "none" ? "" : "\x1b[2m";
  italic = colorMode === "none" ? "" : "\x1b[3m";
  underline = colorMode === "none" ? "" : "\x1b[4m";
  inverse = colorMode === "none" ? "" : "\x1b[7m";
}

/** Returns the current color output mode. */
export function getColorMode(): ColorMode {
  return colorMode;
}

/**
 * Coerces an arbitrary number to a valid 8-bit channel.
 *
 * Load-bearing, not defensive dressing: resampled channel means arrive
 * fractional, and a fractional index into the palette's per-byte LUTs reads
 * `undefined`, which then poisons the result with NaN. Written so NaN falls
 * to 0. (`xterm256Index` clamps too; this keeps the guarantee local to every
 * caller of the emitters below.)
 */
function clamp8(v: number): number {
  return v > 0 ? (v < 255 ? Math.round(v) : 255) : 0;
}

/**
 * Maps RGB to the nearest ANSI 256-color index, considering the 6x6x6 cube
 * (16-231) and the 24-step grey ramp (232-255) as one 240-entry palette.
 *
 * The search itself lives in style/xterm-palette.ts, which `image/quantize.ts`
 * also uses. That is not tidiness: the emitter paints what this returns while
 * `dither.ts` diffuses its error against what the image path returns, so any
 * divergence makes the ditherer correct toward a colour that is never drawn.
 * The two used to be independent implementations and disagreed on 878,094 of
 * 16,777,216 colours at one point. One search, one table, no contract.
 */
export function rgbTo256(r: number, g: number, b: number): number {
  return xterm256Index(clamp8(r), clamp8(g), clamp8(b));
}

/**
 * Inverse of rgbTo256 for the 240 image-safe indices (16-255). Lets callers
 * doing quantized-error glyph fitting score a candidate against the colour the
 * terminal will actually paint. Indices 0-15 return black — they are
 * theme-defined and have no fixed RGB.
 */
export function ansi256ToRgb(index: number): RGB {
  return xterm256Rgb(index);
}

// The 16 ANSI colours come from style/xterm-palette.ts so the emitter and the
// image quantizer assume the same values. The SEARCH below stays here and stays
// plain-RGB: UI chrome matches on RGB distance, pixels match in DIN99d
// (image/quantize.ts), and that difference is deliberate.
const ansi16Table = ANSI16_TABLE;

/**
 * Maps RGB to the nearest ANSI 16-color FOREGROUND code (30-37, 90-97).
 * Background codes are this value plus 10.
 *
 * Exported so the image engine can reach the same table the rest of the
 * framework uses instead of shipping a second, divergent palette.
 */
export function rgbTo16(r: number, g: number, b: number): number {
  const cr = clamp8(r);
  const cg = clamp8(g);
  const cb = clamp8(b);
  let best = 30;
  let bestDist = Infinity;
  for (const entry of ansi16Table) {
    const dr = cr - entry.r;
    const dg = cg - entry.g;
    const db = cb - entry.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = entry.code;
    }
  }
  return best;
}

/** Inverse of rgbTo16: the reference RGB behind an ANSI 16-color code. */
export function ansi16ToRgb(code: number): RGB {
  const entry = ansi16Table.find(e => e.code === code || e.code + 10 === code);
  return entry ? { r: entry.r, g: entry.g, b: entry.b } : { r: 0, g: 0, b: 0 };
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
  return `\x1b[38;2;${clamp8(r)};${clamp8(g)};${clamp8(b)}m`;
}

export function bgColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "";
  return bgColorRgb(rgb.r, rgb.g, rgb.b);
}

/** Same as bgColor but takes RGB directly. Honors colorMode (256-color fallback for Apple Terminal). */
export function bgColorRgb(r: number, g: number, b: number): string {
  if (colorMode === "none") return "";
  if (colorMode === "16") {
    // bg codes are fg + 10
    return `\x1b[${rgbTo16(r, g, b) + 10}m`;
  }
  if (colorMode === "256") {
    return `\x1b[48;5;${rgbTo256(r, g, b)}m`;
  }
  return `\x1b[48;2;${clamp8(r)};${clamp8(g)};${clamp8(b)}m`;
}

/**
 * Emits ONE combined SGR carrying both the foreground and the background of a
 * cell, e.g. `\x1b[38;2;r;g;b;48;2;r;g;bm`.
 *
 * Per-cell image output pays for escapes twice over: bytes on the wire (the
 * combined form measured ~5% smaller) and, more importantly, one CSI parse per
 * cell instead of two on the receiving terminal. Callers still owe a trailing
 * `reset` at end of row — a background emitted here leaks into the focus gutter
 * and the centring pad otherwise.
 */
export function cellColorRgb(fg: RGB, bg: RGB): string {
  if (colorMode === "none") return "";
  if (colorMode === "16") {
    return `\x1b[${rgbTo16(fg.r, fg.g, fg.b)};${rgbTo16(bg.r, bg.g, bg.b) + 10}m`;
  }
  if (colorMode === "256") {
    return `\x1b[38;5;${rgbTo256(fg.r, fg.g, fg.b)};48;5;${rgbTo256(bg.r, bg.g, bg.b)}m`;
  }
  return (
    `\x1b[38;2;${clamp8(fg.r)};${clamp8(fg.g)};${clamp8(fg.b)}` +
    `;48;2;${clamp8(bg.r)};${clamp8(bg.g)};${clamp8(bg.b)}m`
  );
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

// Exported as `let` (live bindings) so setColorMode() can update them at
// runtime — see setColorMode above. Initialized from the load-time mode.
export let reset = colorMode === "none" ? "" : "\x1b[0m";
export let bold = colorMode === "none" ? "" : "\x1b[1m";
export let dim = colorMode === "none" ? "" : "\x1b[2m";
export let italic = colorMode === "none" ? "" : "\x1b[3m";
export let underline = colorMode === "none" ? "" : "\x1b[4m";
export let inverse = colorMode === "none" ? "" : "\x1b[7m";

// A less generic name for `reset`, for modules that already have a local
// `reset` in scope. Re-exporting the binding (rather than copying its value)
// keeps it live, so setColorMode() still updates it.
export { reset as sgrReset };
