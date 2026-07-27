/**
 * Shared contract for the image rendering engine.
 *
 * Every module under src/image/ codes against these types. Nothing here
 * imports from the runtime — this file is pure data shape so it can be
 * consumed by decoders, the cell engine, the cache, and the component
 * renderer without creating cycles.
 */

// Type-only, so this stays a pure-data module: nothing from style/ is loaded at
// runtime by anything that imports these types.
import type { BorderStyle } from "../style/borders.js";

/** 8-bit RGB triple. */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Decoded RGBA pixel buffer, 4 bytes per pixel, row-major, top-left origin. */
export interface PixelBuffer {
  /** length === width * height * 4, in RGBA order. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Image header read without decoding the full pixel payload. */
export interface ImageHeader {
  width: number;
  height: number;
  format: ImageFormat;
}

export type ImageFormat = "png" | "jpeg" | "gif" | "webp" | "bmp" | "unknown";

/**
 * Rendering tiers, highest fidelity first.
 * - quadrant: 2x2 subcells per cell, two colours (fg + bg)
 * - half:     1x2 subcells per cell, two colours (fg + bg)
 * - solid:    1x1, background colour only (needs zero glyph coverage)
 * - shading:  luminance ramp " ·:░▒▓█", foreground only
 * - ascii:    " .:-=+*#%@" ramp, no colour at all
 * - braille:  2x4 subcells, ONE colour — opt-in only, line art
 * - alt:      bordered alt-text box, used for every failure path
 */
export type ImageTier =
  | "quadrant"
  | "half"
  | "solid"
  | "shading"
  | "ascii"
  | "braille"
  | "alt";

/** What a user may ask for. "auto" negotiates the ladder. */
export type ImageMode = "auto" | ImageTier;

export type ImageFit = "contain" | "cover" | "fill";
export type ImageAlign = "left" | "center" | "right";
export type ImageDither = "auto" | "ordered" | "floyd-steinberg" | "none";

/** Public per-block options. Mirrors ImageBlock's optional fields. */
export interface ImageRenderOptions {
  /** Width in terminal CELLS. Default: fill available content width. */
  width?: number;
  /** Height in terminal CELLS. Aspect preserved unless fit === "fill". */
  height?: number;
  /** Hard cap on derived rows. */
  maxHeight?: number;
  fit?: ImageFit;
  align?: ImageAlign;
  mode?: ImageMode;
  dither?: ImageDither;
  /** Shown while decoding, on failure, and when the format is unsupported. */
  alt?: string;
  /** Hex composited under alpha. Defaults to the theme background. */
  background?: string;
  invert?: boolean;
  /** Ramp for mode "ascii". */
  charset?: string;
  /**
   * Draw a themed border around the image. `true` uses the site's border style,
   * a style name overrides it. Same vocabulary as every other bordered block.
   */
  border?: boolean | BorderStyle;
}

/** Output geometry in terminal cells. */
export interface CellGeometry {
  cols: number;
  rows: number;
}

/**
 * Sub-cell sampling factors per tier. A cell of tier T samples
 * subCellFactor(T).x by subCellFactor(T).y pixels.
 */
export interface SubCellFactor {
  x: number;
  y: number;
}

/**
 * A resampled sub-cell grid ready for glyph fitting.
 *
 * subW === cols * factor.x, subH === rows * factor.y, where factor is the
 * tier's sub-cell factor:
 *   quadrant -> 2x2, half -> 1x2, braille -> 2x4,
 *   solid/shading/ascii -> 1x1
 */
export interface SubCellGrid {
  /** RGBA, length === subW * subH * 4. Alpha already composited. */
  data: Uint8ClampedArray;
  subW: number;
  subH: number;
  cols: number;
  rows: number;
  tier: ImageTier;
}

/** A single fitted cell: a glyph plus its two colours. */
export interface FittedCell {
  /** The chosen glyph. A single BMP or astral codepoint, display width 1. */
  ch: string;
  /** Foreground colour (the glyph's ink). */
  fg: RGB;
  /** Background colour (the cell behind the glyph). */
  bg: RGB;
}

export type DecodeFailure =
  | "no-decoder"
  | "unsupported-format"
  | "not-found"
  | "too-large"
  | "corrupt";

export type DecodeResult =
  | { ok: true; pixels: PixelBuffer; format: ImageFormat }
  | { ok: false; reason: DecodeFailure; detail: string };

/** Terminal capabilities the tier negotiator consumes. */
export interface ImageCapabilities {
  colorMode: "truecolor" | "256" | "16" | "none";
  unicode: boolean;
  /** True when a multiplexer or an unrecognised remote TERM is in play. */
  conservative: boolean;
}

/** Byte budgets. Exceeding any of these degrades to the alt-text tier. */
export const IMAGE_LIMITS = {
  /** Max encoded source bytes we will read off disk. */
  maxSourceBytes: 16 * 1024 * 1024,
  /** Max decoded pixels (width * height). */
  maxPixels: 8192 * 8192,
  /** Max cells in a single rendered image (cols * rows). */
  maxCells: 100 * 200,
} as const;

/** Sub-cell sampling factor for a tier. */
export function subCellFactor(tier: ImageTier): SubCellFactor {
  switch (tier) {
    case "quadrant": return { x: 2, y: 2 };
    case "half":     return { x: 1, y: 2 };
    case "braille":  return { x: 2, y: 4 };
    default:         return { x: 1, y: 1 };
  }
}

/**
 * Terminal cells are about twice as tall as they are wide. Converting an
 * image's pixel aspect ratio into a cell aspect ratio means multiplying the
 * row count by this factor. Applied EXACTLY ONCE, in geometry.ts — the
 * sub-cell factor above is a separate, independent multiplier.
 */
export const CELL_ASPECT = 0.5;
