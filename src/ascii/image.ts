/**
 * Image-to-ASCII art converter.
 * Converts PNG, JPG, and WEBP images to ASCII art using different rendering modes.
 *
 * Requires `sharp` as an optional peer dependency.
 * If sharp is not installed, functions return a helpful message instead of crashing.
 */

export interface AsciiImageOptions {
  width?: number;
  height?: number;
  mode?: "ascii" | "braille" | "blocks" | "shading";
  charset?: string;
  invert?: boolean;
  color?: boolean;
  dithering?: "none" | "floyd-steinberg" | "ordered";
  threshold?: number;
}

const DEFAULT_WIDTH = 60;
const DEFAULT_CHARSET = " .:-=+*#%@";
const BLOCK_CHARS = " ░▒▓█";
const BRAILLE_OFFSET = 0x2800;

// Braille dot bit positions for a 2×4 grid:
// col0: rows 0,1,2,6  col1: rows 3,4,5,7
const BRAILLE_MAP: [number, number][] = [
  [0, 3],  // row 0
  [1, 4],  // row 1
  [2, 5],  // row 2
  [6, 7],  // row 3
];

interface PixelGrid {
  data: Uint8Array;
  width: number;
  height: number;
  channels: number;
}

// ---------------------------------------------------------------------------
// Sharp loader
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SharpFn = (input?: string | Buffer) => any;

async function loadSharp(): Promise<SharpFn | null> {
  try {
    // Use a variable to prevent TypeScript from resolving the module at compile time.
    const mod = "sharp";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imported: any = await import(/* webpackIgnore: true */ mod);
    return (imported.default ?? imported) as SharpFn;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function brightness(r: number, g: number, b: number): number {
  // ITU-R BT.601 luminance
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function colorWrap(ch: string, r: number, g: number, b: number): string {
  return `\x1b[38;2;${r};${g};${b}m${ch}\x1b[0m`;
}

// ---------------------------------------------------------------------------
// Dithering
// ---------------------------------------------------------------------------

function applyFloydSteinberg(gray: Float64Array, w: number, h: number, levels: number): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const old = gray[idx];
      const step = 255 / (levels - 1);
      const quantized = Math.round(old / step) * step;
      gray[idx] = quantized;
      const err = old - quantized;

      if (x + 1 < w)          gray[idx + 1]     += err * 7 / 16;
      if (y + 1 < h) {
        if (x - 1 >= 0)       gray[(y + 1) * w + (x - 1)] += err * 3 / 16;
                               gray[(y + 1) * w + x]       += err * 5 / 16;
        if (x + 1 < w)        gray[(y + 1) * w + (x + 1)] += err * 1 / 16;
      }
    }
  }
}

// 4×4 Bayer matrix
const BAYER_4X4 = [
  [ 0,  8,  2, 10],
  [12,  4, 14,  6],
  [ 3, 11,  1,  9],
  [15,  7, 13,  5],
];

function applyOrderedDither(gray: Float64Array, w: number, h: number, levels: number): void {
  const n = 4; // Bayer matrix size
  const step = 255 / (levels - 1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const bayerValue = BAYER_4X4[y % n][x % n] / (n * n) - 0.5;
      gray[idx] = Math.round((gray[idx] + bayerValue * step) / step) * step;
    }
  }
}

// ---------------------------------------------------------------------------
// Pixel loading
// ---------------------------------------------------------------------------

async function loadPixels(
  source: string | Buffer,
  targetW: number,
  targetH: number | undefined,
  sharp: SharpFn,
): Promise<PixelGrid> {
  let pipeline = sharp(source);

  // Determine aspect-ratio-corrected height if not specified.
  let resizeW = targetW;
  let resizeH: number;

  if (targetH != null) {
    resizeH = targetH;
  } else {
    const meta = await sharp(source).metadata();
    const imgW = meta.width ?? targetW;
    const imgH = meta.height ?? targetW;
    // Terminal characters are roughly twice as tall as wide, so multiply by 0.5.
    resizeH = Math.max(1, Math.round((targetW * (imgH / imgW)) * 0.5));
  }

  pipeline = pipeline
    .resize(resizeW, resizeH, { fit: "fill" } as never)
    .ensureAlpha()
    .raw();

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

  return {
    data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    width: info.width,
    height: info.height,
    channels: info.channels,
  };
}

// ---------------------------------------------------------------------------
// Grayscale extraction
// ---------------------------------------------------------------------------

function extractGray(pixels: PixelGrid, invert: boolean): Float64Array {
  const { data, width, height, channels } = pixels;
  const gray = new Float64Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const off = i * channels;
    const r = data[off];
    const g = data[off + 1];
    const b = data[off + 2];
    let v = brightness(r, g, b);
    if (invert) v = 255 - v;
    gray[i] = v;
  }
  return gray;
}

function sampleColor(pixels: PixelGrid, x: number, y: number, w: number, h: number): [number, number, number] {
  const { data, width, channels } = pixels;
  let rSum = 0, gSum = 0, bSum = 0, count = 0;

  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const px = x + dx;
      const py = y + dy;
      if (px >= pixels.width || py >= pixels.height) continue;
      const off = (py * width + px) * channels;
      rSum += data[off];
      gSum += data[off + 1];
      bSum += data[off + 2];
      count++;
    }
  }

  if (count === 0) return [0, 0, 0];
  return [
    Math.round(rSum / count),
    Math.round(gSum / count),
    Math.round(bSum / count),
  ];
}

// ---------------------------------------------------------------------------
// Rendering modes
// ---------------------------------------------------------------------------

function renderAscii(
  pixels: PixelGrid,
  gray: Float64Array,
  charset: string,
  useColor: boolean,
): string[] {
  const { width, height } = pixels;
  const lines: string[] = [];

  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const v = clamp(gray[idx], 0, 255);
      const ci = Math.round((v / 255) * (charset.length - 1));
      let ch = charset[ci];
      if (useColor) {
        const [r, g, b] = sampleColor(pixels, x, y, 1, 1);
        ch = colorWrap(ch, r, g, b);
      }
      line += ch;
    }
    lines.push(line);
  }
  return lines;
}

function renderBraille(
  pixels: PixelGrid,
  gray: Float64Array,
  threshold: number,
  useColor: boolean,
): string[] {
  const { width, height } = pixels;
  const lines: string[] = [];

  // Process in 2-wide × 4-tall blocks
  for (let by = 0; by < height; by += 4) {
    let line = "";
    for (let bx = 0; bx < width; bx += 2) {
      let code = 0;

      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 2; col++) {
          const px = bx + col;
          const py = by + row;
          if (px < width && py < height) {
            const v = gray[py * width + px];
            if (v >= threshold) {
              code |= (1 << BRAILLE_MAP[row][col]);
            }
          }
        }
      }

      let ch = String.fromCharCode(BRAILLE_OFFSET + code);
      if (useColor) {
        const [r, g, b] = sampleColor(pixels, bx, by, 2, 4);
        ch = colorWrap(ch, r, g, b);
      }
      line += ch;
    }
    lines.push(line);
  }
  return lines;
}

function renderBlocks(
  pixels: PixelGrid,
  gray: Float64Array,
  threshold: number,
  useColor: boolean,
): string[] {
  const { width, height } = pixels;
  const lines: string[] = [];

  // Each character covers 1 column × 2 rows
  for (let y = 0; y < height; y += 2) {
    let line = "";
    for (let x = 0; x < width; x++) {
      const topIdx = y * width + x;
      const botIdx = (y + 1) < height ? (y + 1) * width + x : -1;

      const topOn = gray[topIdx] >= threshold;
      const botOn = botIdx >= 0 ? gray[botIdx] >= threshold : false;

      let ch: string;
      if (topOn && botOn) {
        ch = "█";
      } else if (topOn && !botOn) {
        ch = "▀";
      } else if (!topOn && botOn) {
        ch = "▄";
      } else {
        ch = " ";
      }

      if (useColor) {
        const [r, g, b] = sampleColor(pixels, x, y, 1, 2);
        ch = colorWrap(ch, r, g, b);
      }
      line += ch;
    }
    lines.push(line);
  }
  return lines;
}

function renderShading(
  pixels: PixelGrid,
  gray: Float64Array,
  useColor: boolean,
): string[] {
  // Extended charset combining block elements and ASCII for higher detail
  const shadingChars = " ·:░▒▓█";
  const { width, height } = pixels;
  const lines: string[] = [];

  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const v = clamp(gray[idx], 0, 255);
      const ci = Math.round((v / 255) * (shadingChars.length - 1));
      let ch = shadingChars[ci];
      if (useColor) {
        const [r, g, b] = sampleColor(pixels, x, y, 1, 1);
        ch = colorWrap(ch, r, g, b);
      }
      line += ch;
    }
    lines.push(line);
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Convert an image (PNG, JPG, WEBP) to ASCII art.
 *
 * @param source - File path (string) or raw image data (Buffer)
 * @param options - Rendering options
 * @returns Array of strings, one per output row
 */
export async function asciiImage(
  source: string | Buffer,
  options?: AsciiImageOptions,
): Promise<string[]> {
  const {
    width = DEFAULT_WIDTH,
    height,
    mode = "ascii",
    charset = DEFAULT_CHARSET,
    invert = false,
    color = false,
    dithering = "none",
    threshold = 128,
  } = options ?? {};

  // --- Load sharp dynamically ---
  const sharp = await loadSharp();
  if (sharp == null) {
    return [
      "[Image: install sharp for image support]",
      "  npm install sharp",
    ];
  }

  // --- Determine pixel dimensions for the requested mode ---
  let pixelW: number;
  let pixelH: number | undefined;

  if (mode === "braille") {
    // Braille characters span 2×4 pixels, so we need 2× / 4× the output chars
    pixelW = width * 2;
    pixelH = height != null ? height * 4 : undefined;
  } else if (mode === "blocks") {
    // Block characters span 1×2 pixels
    pixelW = width;
    pixelH = height != null ? height * 2 : undefined;
  } else {
    pixelW = width;
    pixelH = height;
  }

  // --- Load and resize image ---
  let pixels: PixelGrid;
  try {
    pixels = await loadPixels(source, pixelW, pixelH, sharp);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("Input file is missing") ||
      msg.includes("ENOENT") ||
      msg.includes("no such file")
    ) {
      return [`[Error: could not load image: ${typeof source === "string" ? source : "(buffer)"}]`];
    }
    return ["[Error: could not decode image]"];
  }

  // --- Extract grayscale ---
  const gray = extractGray(pixels, invert);

  // --- Apply dithering ---
  const ditherLevels =
    mode === "ascii" ? charset.length :
    mode === "shading" ? 7 :
    mode === "blocks" ? BLOCK_CHARS.length :
    2; // braille is binary

  if (dithering === "floyd-steinberg") {
    applyFloydSteinberg(gray, pixels.width, pixels.height, ditherLevels);
  } else if (dithering === "ordered") {
    applyOrderedDither(gray, pixels.width, pixels.height, ditherLevels);
  }

  // Clamp after dithering
  for (let i = 0; i < gray.length; i++) {
    gray[i] = clamp(gray[i], 0, 255);
  }

  // --- Render based on mode ---
  switch (mode) {
    case "ascii":
      return renderAscii(pixels, gray, charset, color);
    case "braille":
      return renderBraille(pixels, gray, threshold, color);
    case "blocks":
      return renderBlocks(pixels, gray, threshold, color);
    case "shading":
      return renderShading(pixels, gray, color);
    default:
      return renderAscii(pixels, gray, charset, color);
  }
}
