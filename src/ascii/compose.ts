import { stripAnsi, stringWidth } from "../components/base.js";
import { fgColor, reset, createGradient } from "../style/colors.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Visible length of a string, ignoring ANSI escape sequences. */
function visLen(line: string): number {
  return stringWidth(line);
}

/** Maximum visible width across all lines. */
function maxWidth(art: string[]): number {
  let w = 0;
  for (const line of art) {
    const vw = visLen(line);
    if (vw > w) w = vw;
  }
  return w;
}

/**
 * Expand a line to exactly `width` visible characters by padding with spaces.
 * If the line is already wider, it is returned unchanged.
 */
function padLineRight(line: string, width: number): string {
  const vw = visLen(line);
  if (vw >= width) return line;
  return line + " ".repeat(width - vw);
}

/**
 * Split a line into an array of per-visible-character segments, where each
 * segment includes any leading ANSI codes so re-joining preserves colors.
 */
function splitVisChars(line: string): string[] {
  const segments: string[] = [];
  let pending = ""; // accumulated ANSI codes before the next visible char

  let inEscape = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\x1b") {
      inEscape = true;
      pending += ch;
      continue;
    }
    if (inEscape) {
      pending += ch;
      if (ch === "m") inEscape = false;
      continue;
    }
    segments.push(pending + ch);
    pending = "";
  }
  // Any trailing ANSI codes (like a reset) get appended to the last segment
  if (pending && segments.length > 0) {
    segments[segments.length - 1] += pending;
  }
  return segments;
}

/** Remove trailing whitespace from every line (visible trailing spaces). */
function trimTrailing(art: string[]): string[] {
  return art.map(line => {
    // We need to trim trailing *visible* spaces while preserving ANSI codes.
    // Strategy: split into segments, pop trailing space-only segments, rejoin.
    const segs = splitVisChars(line);
    // Strip trailing segments that are just a space (possibly with ANSI prefix)
    while (segs.length > 0) {
      const last = segs[segs.length - 1];
      // A segment whose only visible char is a space
      if (stripAnsi(last) === " ") {
        segs.pop();
      } else {
        break;
      }
    }
    // Rejoin and ensure a trailing reset if there were color codes
    const joined = segs.join("");
    // If the line had ANSI and doesn't already end with reset, append it
    if (joined.includes("\x1b[") && !joined.endsWith(reset) && reset) {
      return joined + reset;
    }
    return joined;
  });
}

// ─── Spatial Composition ────────────────────────────────────────────────────

/**
 * Place `over` on top of `base` at position (x, y).
 * Overlay characters replace base characters; spaces in the overlay are
 * treated as transparent and do not overwrite.
 */
export function overlay(
  base: string[],
  over: string[],
  x: number,
  y: number,
): string[] {
  if (base.length === 0) return [];
  if (over.length === 0) return [...base];

  const baseW = maxWidth(base);
  // Ensure every base line is at least baseW wide so we can splice
  const padded = base.map(l => padLineRight(l, baseW));

  const result: string[] = [];

  for (let row = 0; row < padded.length; row++) {
    const overRow = row - y;
    if (overRow < 0 || overRow >= over.length) {
      result.push(padded[row]);
      continue;
    }

    const baseSegs = splitVisChars(padded[row]);
    const overSegs = splitVisChars(over[overRow]);

    // Build a new set of segments
    // Ensure baseSegs is wide enough for x + overSegs.length
    while (baseSegs.length < x + overSegs.length) {
      baseSegs.push(" ");
    }

    for (let col = 0; col < overSegs.length; col++) {
      const seg = overSegs[col];
      // Only overwrite if the visible char is not a space
      const vis = stripAnsi(seg);
      if (vis !== " ") {
        baseSegs[x + col] = seg;
      }
    }

    result.push(baseSegs.join(""));
  }

  return trimTrailing(result);
}

/**
 * Horizontally join two pieces of art with a gap between them.
 * Gap defaults to 2 spaces. Shorter piece is padded with empty lines.
 */
export function sideBySide(
  left: string[],
  right: string[],
  gap: number = 2,
): string[] {
  if (left.length === 0 && right.length === 0) return [];
  if (left.length === 0) return [...right];
  if (right.length === 0) return [...left];

  const height = Math.max(left.length, right.length);
  const leftW = maxWidth(left);
  const gapStr = " ".repeat(gap);

  const result: string[] = [];
  for (let i = 0; i < height; i++) {
    const l = i < left.length ? padLineRight(left[i], leftW) : " ".repeat(leftW);
    const r = i < right.length ? right[i] : "";
    result.push(l + gapStr + r);
  }

  return trimTrailing(result);
}

/**
 * Vertically stack two pieces of art with a gap (empty lines) between them.
 * Gap defaults to 1.
 */
export function stack(
  top: string[],
  bottom: string[],
  gap: number = 1,
): string[] {
  if (top.length === 0 && bottom.length === 0) return [];
  if (top.length === 0) return [...bottom];
  if (bottom.length === 0) return [...top];

  const result: string[] = [...top];
  for (let i = 0; i < gap; i++) {
    result.push("");
  }
  result.push(...bottom);
  return result;
}

/**
 * Center each line within the given width.
 * Lines wider than `width` are truncated (visible characters).
 */
export function center(art: string[], width: number): string[] {
  if (art.length === 0) return [];

  return trimTrailing(
    art.map(line => {
      const vw = visLen(line);
      if (vw > width) {
        // Truncate to `width` visible characters
        const segs = splitVisChars(line);
        const truncated = segs.slice(0, width).join("");
        return truncated + (truncated.includes("\x1b[") && reset ? reset : "");
      }
      const totalPad = width - vw;
      const leftPad = Math.floor(totalPad / 2);
      return " ".repeat(leftPad) + line;
    }),
  );
}

/** Padding specification: uniform number or per-side. */
export interface PaddingSpec {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

/**
 * Add padding around art.
 * Accepts a number (all sides) or an object with top/right/bottom/left.
 */
export function pad(
  art: string[],
  padding: number | PaddingSpec,
): string[] {
  if (art.length === 0) return [];

  const p: Required<PaddingSpec> =
    typeof padding === "number"
      ? { top: padding, right: padding, bottom: padding, left: padding }
      : {
          top: padding.top ?? 0,
          right: padding.right ?? 0,
          bottom: padding.bottom ?? 0,
          left: padding.left ?? 0,
        };

  const leftStr = " ".repeat(p.left);
  // We don't pad right with trailing spaces—rule says no trailing whitespace.
  // But right padding affects the conceptual width. We only add right padding
  // when there is content on that line that would make it meaningful.
  // Actually, since "no trailing whitespace" is a rule, right padding with
  // spaces would be stripped. So we skip right padding in the output but
  // keep the conceptual API contract (right padding matters for composition
  // when this result is fed into center/overlay/etc.).

  const result: string[] = [];

  // Top padding
  for (let i = 0; i < p.top; i++) {
    result.push("");
  }

  // Content lines with left padding
  for (const line of art) {
    result.push(leftStr + line);
  }

  // Bottom padding
  for (let i = 0; i < p.bottom; i++) {
    result.push("");
  }

  return trimTrailing(result);
}

/**
 * Extract a rectangular region from art.
 */
export function crop(
  art: string[],
  x: number,
  y: number,
  width: number,
  height: number,
): string[] {
  if (art.length === 0) return [];

  const result: string[] = [];
  for (let row = y; row < y + height; row++) {
    if (row < 0 || row >= art.length) {
      result.push("");
      continue;
    }
    const segs = splitVisChars(art[row]);
    const sliced = segs.slice(x, x + width);
    const joined = sliced.join("");
    result.push(joined);
  }

  return trimTrailing(result);
}

/**
 * Repeat art a given number of times either horizontally or vertically.
 */
export function repeat(
  art: string[],
  times: number,
  direction: "horizontal" | "vertical",
): string[] {
  if (art.length === 0 || times <= 0) return [];
  if (times === 1) return [...art];

  if (direction === "horizontal") {
    let result = art;
    for (let i = 1; i < times; i++) {
      result = sideBySide(result, art, 0);
    }
    return result;
  }

  // vertical
  let result = art;
  for (let i = 1; i < times; i++) {
    result = stack(result, art, 0);
  }
  return result;
}

/**
 * Mirror/flip art along an axis.
 * - "horizontal": reverse each line's visible characters.
 * - "vertical": reverse the order of lines.
 */
export function mirror(
  art: string[],
  axis: "horizontal" | "vertical",
): string[] {
  if (art.length === 0) return [];

  if (axis === "vertical") {
    return [...art].reverse();
  }

  // horizontal: reverse visible characters per line
  return trimTrailing(
    art.map(line => {
      const segs = splitVisChars(line);
      segs.reverse();
      return segs.join("");
    }),
  );
}

/**
 * Rotate art by 90, 180, or 270 degrees clockwise.
 * 180° is exact. 90° and 270° transpose and mirror (character approximation).
 */
export function rotate(
  art: string[],
  degrees: 90 | 180 | 270,
): string[] {
  if (art.length === 0) return [];

  if (degrees === 180) {
    return mirror(mirror(art, "horizontal"), "vertical");
  }

  // For 90° and 270° we need to transpose the character grid
  const h = art.length;
  const w = maxWidth(art);

  // Build a grid of visible characters
  const grid: string[][] = [];
  for (let row = 0; row < h; row++) {
    const segs = splitVisChars(art[row]);
    const rowChars: string[] = [];
    for (let col = 0; col < w; col++) {
      rowChars.push(col < segs.length ? segs[col] : " ");
    }
    grid.push(rowChars);
  }

  const result: string[] = [];

  if (degrees === 90) {
    // 90° CW: new[col][h - 1 - row] = old[row][col]
    for (let col = 0; col < w; col++) {
      let line = "";
      for (let row = h - 1; row >= 0; row--) {
        line += grid[row][col];
      }
      result.push(line);
    }
  } else {
    // 270° CW (= 90° CCW): new[w - 1 - col][row] = old[row][col]
    for (let col = w - 1; col >= 0; col--) {
      let line = "";
      for (let row = 0; row < h; row++) {
        line += grid[row][col];
      }
      result.push(line);
    }
  }

  return trimTrailing(result);
}

// ─── Colorization ───────────────────────────────────────────────────────────

/**
 * Apply a single foreground color (hex string) to all non-space characters.
 */
export function colorize(art: string[], color: string): string[] {
  if (art.length === 0) return [];

  const fg = fgColor(color);
  if (!fg) return [...art];

  return trimTrailing(
    art.map(line => {
      const stripped = stripAnsi(line);
      if (stripped.length === 0) return "";

      let result = "";
      let colored = false;
      for (const ch of stripped) {
        if (ch !== " ") {
          if (!colored) {
            result += fg;
            colored = true;
          }
          result += ch;
        } else {
          if (colored) {
            result += reset;
            colored = false;
          }
          result += ch;
        }
      }
      if (colored) result += reset;
      return result;
    }),
  );
}

/**
 * Apply a color gradient across the art.
 * Direction: "horizontal" (per character), "vertical" (per line),
 * or "diagonal" (combined).
 */
export function gradient(
  art: string[],
  colors: string[],
  direction: "horizontal" | "vertical" | "diagonal" = "horizontal",
): string[] {
  if (art.length === 0) return [];
  if (colors.length === 0) return [...art];

  const h = art.length;
  const w = maxWidth(art);
  if (w === 0) return [...art];

  const result: string[] = [];

  if (direction === "vertical") {
    const gradColors = createGradient(colors, h);
    for (let row = 0; row < h; row++) {
      const fg = fgColor(gradColors[row]);
      const stripped = stripAnsi(art[row]);
      if (stripped.length === 0) {
        result.push("");
        continue;
      }
      let line = "";
      for (const ch of stripped) {
        if (ch !== " ") {
          line += fg + ch;
        } else {
          line += ch;
        }
      }
      result.push(line + reset);
    }
  } else if (direction === "horizontal") {
    const gradColors = createGradient(colors, w);
    for (let row = 0; row < h; row++) {
      const stripped = stripAnsi(art[row]);
      if (stripped.length === 0) {
        result.push("");
        continue;
      }
      let line = "";
      for (let col = 0; col < stripped.length; col++) {
        const ch = stripped[col];
        if (ch !== " ") {
          line += fgColor(gradColors[col]) + ch;
        } else {
          line += ch;
        }
      }
      result.push(line + reset);
    }
  } else {
    // diagonal: blend based on (row + col) / (h + w - 2)
    const maxDiag = h + w - 2 || 1;
    const steps = maxDiag + 1;
    const gradColors = createGradient(colors, steps);
    for (let row = 0; row < h; row++) {
      const stripped = stripAnsi(art[row]);
      if (stripped.length === 0) {
        result.push("");
        continue;
      }
      let line = "";
      for (let col = 0; col < stripped.length; col++) {
        const ch = stripped[col];
        if (ch !== " ") {
          const diagIndex = row + col;
          line += fgColor(gradColors[diagIndex]) + ch;
        } else {
          line += ch;
        }
      }
      result.push(line + reset);
    }
  }

  return trimTrailing(result);
}

/** Classic rainbow colors. */
const RAINBOW_COLORS = [
  "#ff0000", // red
  "#ff7f00", // orange
  "#ffff00", // yellow
  "#00ff00", // green
  "#0000ff", // blue
  "#4b0082", // indigo
  "#9400d3", // violet
];

/**
 * Apply a rainbow gradient across the art (horizontal).
 */
export function rainbow(art: string[]): string[] {
  return gradient(art, RAINBOW_COLORS, "horizontal");
}

/**
 * Add a drop shadow behind the art.
 * Direction: "bottom-right" (default) or "bottom-left".
 * Shadow character defaults to "░".
 */
export function shadow(
  art: string[],
  direction: "bottom-right" | "bottom-left" = "bottom-right",
  char: string = "░",
): string[] {
  if (art.length === 0) return [];

  const w = maxWidth(art);
  const h = art.length;

  // Shadow is the same dimensions as the art but shifted by 1 in the
  // shadow direction. The combined canvas is 1 row taller and 1 col wider.
  const totalH = h + 1;
  const totalW = w + 1;

  // Build the shadow layer
  const shadowLayer: string[] = [];
  for (let row = 0; row < totalH; row++) {
    // Shadow row offset: for bottom-right, shadow starts at row=1, col=1
    // For bottom-left, shadow starts at row=1, col=0 (art is at col=1)
    const shadowRowIdx = direction === "bottom-right" ? row - 1 : row - 1;
    if (shadowRowIdx < 0 || shadowRowIdx >= h) {
      shadowLayer.push("");
      continue;
    }
    const srcLine = stripAnsi(art[shadowRowIdx]);
    let shadowLine = "";
    if (direction === "bottom-right") {
      // Shadow at col offset +1
      shadowLine = " ";
      for (let col = 0; col < srcLine.length; col++) {
        shadowLine += srcLine[col] !== " " ? char : " ";
      }
    } else {
      // bottom-left: shadow at col offset -1, but we shift art right by 1
      for (let col = 0; col < srcLine.length; col++) {
        shadowLine += srcLine[col] !== " " ? char : " ";
      }
    }
    shadowLayer.push(shadowLine);
  }

  // Build the art layer positioned on the canvas
  const artLayer: string[] = [];
  for (let row = 0; row < totalH; row++) {
    if (row >= h) {
      artLayer.push("");
      continue;
    }
    if (direction === "bottom-left") {
      // Art is shifted 1 col to the right
      artLayer.push(" " + art[row]);
    } else {
      artLayer.push(art[row]);
    }
  }

  // Composite: art on top of shadow
  return overlay(shadowLayer, artLayer, 0, 0);
}
