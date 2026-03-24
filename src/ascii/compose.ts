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

// Re-export effects from split file
export { repeat, mirror, rotate, colorize, gradient, rainbow, shadow } from "./compose-effects.js";
