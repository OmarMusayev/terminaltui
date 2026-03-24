/**
 * ASCII art data visualization generators.
 * Each function returns string[].
 */

const BRAILLE_OFFSET = 0x2800;

// Braille dot positions (per character cell = 2 cols x 4 rows):
//   col0  col1
//    0     3
//    1     4
//    2     5
//    6     7
const BRAILLE_DOT_MAP = [
  [0, 3], // row 0
  [1, 4], // row 1
  [2, 5], // row 2
  [6, 7], // row 3
];

// Block elements for fractional horizontal bar fills (1/8 increments)
const BLOCK_FRAC = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"];

// Block elements for vertical sparklines
const SPARK_CHARS = "▁▂▃▄▅▆▇█";

// Shading characters for heatmap (light to dark)
const DEFAULT_HEAT_CHARS = " ░▒▓█";

// Pie chart fill characters per slice
const PIE_FILLS = ["█", "▓", "▒", "░", "▪", "▫", "●", "○", "◆", "◇", "■", "□"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a number to [lo, hi]. */
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Format a number compactly for axis labels. */
function fmtNum(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e6) return String(n);
  if (Math.abs(n) >= 1e6) return n.toExponential(1);
  return n.toPrecision(4);
}

/** Right-pad a string to a given width. */
function rpad(s: string, w: number): string {
  return s.length >= w ? s : s + " ".repeat(w - s.length);
}

/** Left-pad a string to a given width. */
function lpad(s: string, w: number): string {
  return s.length >= w ? s : " ".repeat(w - s.length) + s;
}

/** Strip trailing whitespace from every line. */
function trimRight(lines: string[]): string[] {
  return lines.map(l => l.replace(/\s+$/, ""));
}

/** Linearly interpolate between a and b. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Downsample or interpolate data to target length. */
function resampleData(data: number[], targetLen: number): number[] {
  if (data.length === 0) return [];
  if (data.length === 1) return Array(targetLen).fill(data[0]);
  if (targetLen <= 0) return [];
  if (targetLen === 1) {
    // Average of all points
    return [data.reduce((a, b) => a + b, 0) / data.length];
  }

  const result: number[] = [];
  for (let i = 0; i < targetLen; i++) {
    const t = (i / (targetLen - 1)) * (data.length - 1);
    const lo = Math.floor(t);
    const hi = Math.min(lo + 1, data.length - 1);
    const frac = t - lo;
    result.push(lerp(data[lo], data[hi], frac));
  }
  return result;
}

// ---------------------------------------------------------------------------
// 1. barChart
// ---------------------------------------------------------------------------

export function barChart(
  data: { label: string; value: number }[],
  options?: {
    width?: number;
    horizontal?: boolean;
    showValues?: boolean;
    maxBarWidth?: number;
  },
): string[] {
  if (data.length === 0) return [];

  const width = options?.width ?? 60;
  const horizontal = options?.horizontal ?? true;
  const showValues = options?.showValues ?? true;

  if (horizontal) {
    return horizontalBarChart(data, width, showValues, options?.maxBarWidth);
  }
  return verticalBarChart(data, width, showValues, options?.maxBarWidth);
}

function horizontalBarChart(
  data: { label: string; value: number }[],
  totalWidth: number,
  showValues: boolean,
  maxBarWidth?: number,
): string[] {
  const maxVal = Math.max(...data.map(d => Math.abs(d.value)), 1);
  const labelWidth = Math.max(...data.map(d => d.label.length));
  const valueStrs = data.map(d => fmtNum(d.value));
  const valueWidth = showValues
    ? Math.max(...valueStrs.map(s => s.length)) + 1
    : 0;

  // Space available for the bar: total - label - " │ " separator - value suffix
  const separatorWidth = 3; // " │ " or " | "
  const availableBar =
    maxBarWidth ??
    Math.max(1, totalWidth - labelWidth - separatorWidth - valueWidth);

  const lines: string[] = [];

  for (let i = 0; i < data.length; i++) {
    const { label, value } = data[i];
    const norm = Math.abs(value) / maxVal;
    const barFloatLen = norm * availableBar;
    const fullBlocks = Math.floor(barFloatLen);
    const fracIndex = Math.round((barFloatLen - fullBlocks) * 8);

    let bar = "█".repeat(fullBlocks);
    if (fracIndex > 0 && fracIndex < 8) {
      bar += BLOCK_FRAC[fracIndex];
    } else if (fracIndex === 8) {
      bar += "█";
    }

    // For zero values show nothing
    if (value === 0) bar = "";

    // Negative indicator
    const prefix = value < 0 ? "-" : "";

    const labelPart = rpad(label, labelWidth);
    const valuePart = showValues ? " " + lpad(valueStrs[i], valueWidth - 1) : "";
    lines.push(`${labelPart} │ ${prefix}${bar}${valuePart}`);
  }

  return trimRight(lines);
}

function verticalBarChart(
  data: { label: string; value: number }[],
  totalWidth: number,
  showValues: boolean,
  _maxBarWidth?: number,
): string[] {
  const maxVal = Math.max(...data.map(d => Math.abs(d.value)), 1);
  const colWidth = Math.max(
    3,
    Math.min(
      Math.max(...data.map(d => d.label.length)) + 1,
      Math.floor(totalWidth / data.length),
    ),
  );
  const chartHeight = _maxBarWidth ?? 15;
  const lines: string[] = [];

  // Build columns top to bottom
  for (let row = chartHeight; row >= 1; row--) {
    let line = "";
    for (let i = 0; i < data.length; i++) {
      const norm = (Math.abs(data[i].value) / maxVal) * chartHeight;
      let cell: string;
      if (norm >= row) {
        cell = "█".repeat(colWidth - 1);
      } else if (norm > row - 1) {
        // Fractional fill — use vertical block elements
        const frac = norm - (row - 1);
        const blockIdx = Math.round(frac * 8);
        if (blockIdx === 0) {
          cell = " ".repeat(colWidth - 1);
        } else {
          const ch = SPARK_CHARS[clamp(blockIdx - 1, 0, 7)];
          cell = ch.repeat(colWidth - 1);
        }
      } else {
        cell = " ".repeat(colWidth - 1);
      }
      line += cell + " ";
    }
    lines.push(line);
  }

  // Baseline
  lines.push("─".repeat(colWidth * data.length));

  // Labels
  let labelLine = "";
  for (const d of data) {
    labelLine += rpad(d.label.slice(0, colWidth - 1), colWidth);
  }
  lines.push(labelLine);

  // Values
  if (showValues) {
    let valLine = "";
    for (const d of data) {
      valLine += rpad(fmtNum(d.value).slice(0, colWidth - 1), colWidth);
    }
    lines.push(valLine);
  }

  return trimRight(lines);
}

// ---------------------------------------------------------------------------
// 2. sparkline (enhanced)
// ---------------------------------------------------------------------------

export function sparkline(data: number[], width?: number): string[] {
  if (data.length === 0) return [""];

  const targetWidth = width ?? data.length;
  if (targetWidth <= 0) return [""];

  const resampled = resampleData(data, targetWidth);
  const max = Math.max(...resampled, 0);
  const min = Math.min(...resampled, 0);
  const range = max - min || 1;

  const result = resampled
    .map(v => {
      const idx = Math.round(((v - min) / range) * (SPARK_CHARS.length - 1));
      return SPARK_CHARS[clamp(idx, 0, SPARK_CHARS.length - 1)];
    })
    .join("");

  return [result];
}

// ---------------------------------------------------------------------------
// 3. heatmap
// ---------------------------------------------------------------------------

export function heatmap(
  data: number[][],
  options?: {
    chars?: string;
    showScale?: boolean;
  },
): string[] {
  if (data.length === 0) return [];

  const chars = options?.chars ?? DEFAULT_HEAT_CHARS;
  const showScale = options?.showScale ?? false;

  // Flatten to find min/max
  const flat = data.flat();
  if (flat.length === 0) return [];

  const minVal = Math.min(...flat);
  const maxVal = Math.max(...flat);
  const range = maxVal - minVal || 1;

  const lines: string[] = [];

  for (const row of data) {
    let line = "";
    for (const val of row) {
      const norm = (val - minVal) / range;
      const idx = Math.round(norm * (chars.length - 1));
      line += chars[clamp(idx, 0, chars.length - 1)];
    }
    lines.push(line);
  }

  if (showScale) {
    lines.push("");
    let scaleLine = `${fmtNum(minVal)} `;
    for (let i = 0; i < chars.length; i++) {
      scaleLine += chars[i];
    }
    scaleLine += ` ${fmtNum(maxVal)}`;
    lines.push(scaleLine);
  }

  return trimRight(lines);
}


// Re-export chart types from split file
export { pieChart, graph } from "./dataviz-charts.js";
