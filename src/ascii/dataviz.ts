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

// ---------------------------------------------------------------------------
// 4. pieChart
// ---------------------------------------------------------------------------

export function pieChart(
  data: { label: string; value: number }[],
  radius?: number,
): string[] {
  if (data.length === 0) return [];

  const r = radius ?? 8;
  const total = data.reduce((s, d) => s + Math.abs(d.value), 0);
  if (total === 0) {
    // All zeros — draw empty circle
    return drawEmptyPie(r, data);
  }

  // Compute cumulative angles (0..2*PI)
  const slices: { startAngle: number; endAngle: number; fill: string; label: string; pct: number }[] = [];
  let cumulative = 0;
  for (let i = 0; i < data.length; i++) {
    const pct = Math.abs(data[i].value) / total;
    const startAngle = cumulative * 2 * Math.PI;
    cumulative += pct;
    const endAngle = cumulative * 2 * Math.PI;
    slices.push({
      startAngle,
      endAngle,
      fill: PIE_FILLS[i % PIE_FILLS.length],
      label: data[i].label,
      pct,
    });
  }

  // Render into a character grid.
  // Use 2:1 aspect correction (chars are ~twice as tall as wide).
  const diamY = r * 2 + 1;
  const diamX = r * 4 + 1; // double width for aspect ratio
  const cx = r * 2;
  const cy = r;

  const grid: string[][] = [];
  for (let y = 0; y < diamY; y++) {
    const row: string[] = [];
    for (let x = 0; x < diamX; x++) {
      // Map to normalised coords (aspect-corrected)
      const nx = (x - cx) / 2; // divide by 2 to undo horizontal stretch
      const ny = cy - y;       // flip so +y is up
      const dist = Math.sqrt(nx * nx + ny * ny);

      if (dist <= r + 0.5) {
        // Inside or on the circle
        let angle = Math.atan2(ny, nx);
        if (angle < 0) angle += 2 * Math.PI;
        // Start from top (12 o'clock): rotate by +PI/2
        angle = (angle + Math.PI / 2) % (2 * Math.PI);

        // Find which slice this angle belongs to
        let ch = " ";
        for (const slice of slices) {
          if (angle >= slice.startAngle && angle < slice.endAngle) {
            ch = slice.fill;
            break;
          }
        }
        // Handle floating-point edge at 2*PI
        if (ch === " " && slices.length > 0) {
          ch = slices[slices.length - 1].fill;
        }
        row.push(ch);
      } else {
        row.push(" ");
      }
    }
    grid.push(row);
  }

  const lines: string[] = grid.map(row => row.join(""));

  // Legend
  lines.push("");
  for (const slice of slices) {
    const pctStr = (slice.pct * 100).toFixed(1) + "%";
    lines.push(`  ${slice.fill} ${slice.label} (${pctStr})`);
  }

  return trimRight(lines);
}

function drawEmptyPie(
  r: number,
  data: { label: string; value: number }[],
): string[] {
  const diamY = r * 2 + 1;
  const diamX = r * 4 + 1;
  const cx = r * 2;
  const cy = r;

  const lines: string[] = [];
  for (let y = 0; y < diamY; y++) {
    let line = "";
    for (let x = 0; x < diamX; x++) {
      const nx = (x - cx) / 2;
      const ny = cy - y;
      const dist = Math.sqrt(nx * nx + ny * ny);
      if (Math.abs(dist - r) < 0.8) {
        line += "·";
      } else {
        line += " ";
      }
    }
    lines.push(line);
  }

  lines.push("");
  for (let i = 0; i < data.length; i++) {
    lines.push(`  ${PIE_FILLS[i % PIE_FILLS.length]} ${data[i].label} (0.0%)`);
  }

  return trimRight(lines);
}

// ---------------------------------------------------------------------------
// 5. graph (braille line graph)
// ---------------------------------------------------------------------------

export function graph(
  data: number[],
  width?: number,
  height?: number,
): string[] {
  if (data.length === 0) return [];

  const charWidth = width ?? 60;
  const charHeight = height ?? 15;

  if (charWidth <= 0 || charHeight <= 0) return [];

  // Braille resolution: each character = 2 dots wide, 4 dots tall
  const dotW = charWidth * 2;
  const dotH = charHeight * 4;

  // Resample data to fit dot-width
  const resampled = resampleData(data, dotW);

  const minVal = Math.min(...resampled);
  const maxVal = Math.max(...resampled);
  const range = maxVal - minVal || 1;

  // Build braille grid (charHeight rows x charWidth cols)
  // Each cell is an 8-bit braille pattern
  const grid: number[][] = [];
  for (let r = 0; r < charHeight; r++) {
    grid.push(new Array(charWidth).fill(0));
  }

  // Plot each data point
  for (let dx = 0; dx < dotW; dx++) {
    const norm = (resampled[dx] - minVal) / range;
    const dy = Math.round(norm * (dotH - 1)); // 0 = bottom, dotH-1 = top

    // Map dot position to char cell
    const charCol = Math.floor(dx / 2);
    const dotCol = dx % 2; // 0 = left, 1 = right

    // Invert Y: top of the grid is row 0
    const invertedDy = dotH - 1 - dy;
    const charRow = Math.floor(invertedDy / 4);
    const dotRow = invertedDy % 4;

    if (charRow >= 0 && charRow < charHeight && charCol >= 0 && charCol < charWidth) {
      const bit = BRAILLE_DOT_MAP[dotRow][dotCol];
      grid[charRow][charCol] |= (1 << bit);
    }
  }

  // Also draw line segments between consecutive dots for continuity
  for (let dx = 0; dx < dotW - 1; dx++) {
    const norm0 = (resampled[dx] - minVal) / range;
    const norm1 = (resampled[dx + 1] - minVal) / range;
    const dy0 = Math.round(norm0 * (dotH - 1));
    const dy1 = Math.round(norm1 * (dotH - 1));

    // Bresenham-style interpolation between dy0 and dy1 at this dx
    const steps = Math.abs(dy1 - dy0);
    if (steps > 1) {
      const dir = dy1 > dy0 ? 1 : -1;
      for (let s = 1; s < steps; s++) {
        const iy = dy0 + s * dir;
        // For interpolated dots, use the same x column
        const charCol = Math.floor(dx / 2);
        const dotCol = dx % 2;
        const invertedIy = dotH - 1 - iy;
        const charRow = Math.floor(invertedIy / 4);
        const dotRow = invertedIy % 4;

        if (charRow >= 0 && charRow < charHeight && charCol >= 0 && charCol < charWidth) {
          const bit = BRAILLE_DOT_MAP[dotRow][dotCol];
          grid[charRow][charCol] |= (1 << bit);
        }
      }
    }
  }

  // Build Y-axis labels
  const numYLabels = Math.min(charHeight, 5);
  const yLabels: Map<number, string> = new Map();
  for (let i = 0; i < numYLabels; i++) {
    const row = Math.round((i / (numYLabels - 1)) * (charHeight - 1));
    const val = maxVal - (row / (charHeight - 1)) * range;
    yLabels.set(row, fmtNum(val));
  }

  const yLabelWidth = Math.max(
    ...Array.from(yLabels.values()).map(s => s.length),
  );

  // Assemble output lines
  const lines: string[] = [];

  for (let r = 0; r < charHeight; r++) {
    const yLabel = yLabels.has(r)
      ? lpad(yLabels.get(r)!, yLabelWidth)
      : " ".repeat(yLabelWidth);

    const brailleLine = grid[r]
      .map(dots => String.fromCharCode(BRAILLE_OFFSET + dots))
      .join("");

    lines.push(`${yLabel} ┤${brailleLine}`);
  }

  // X-axis
  lines.push(" ".repeat(yLabelWidth) + " └" + "─".repeat(charWidth));

  // X-axis labels (start and end indices)
  const xStart = "0";
  const xEnd = String(data.length - 1);
  const xAxisPadding = " ".repeat(yLabelWidth + 2);
  const gap = charWidth - xStart.length - xEnd.length;
  if (gap > 0) {
    lines.push(xAxisPadding + xStart + " ".repeat(gap) + xEnd);
  } else {
    lines.push(xAxisPadding + xStart);
  }

  return trimRight(lines);
}
