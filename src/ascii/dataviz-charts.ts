/**
 * Advanced data visualization: pieChart and graph (braille line graph).
 * Split from dataviz.ts to keep files under 400 lines.
 */

const BRAILLE_OFFSET = 0x2800;
const BRAILLE_DOT_MAP = [[0, 3], [1, 4], [2, 5], [6, 7]];
const PIE_FILLS = ["\u2588", "\u2593", "\u2592", "\u2591", "\u25aa", "\u25ab", "\u25cf", "\u25cb", "\u25c6", "\u25c7", "\u25a0", "\u25a1"];

function fmtNum(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e6) return String(n);
  if (Math.abs(n) >= 1e6) return n.toExponential(1);
  return n.toPrecision(4);
}

function lpad(s: string, w: number): string {
  return s.length >= w ? s : " ".repeat(w - s.length) + s;
}

function trimRight(lines: string[]): string[] {
  return lines.map(l => l.replace(/\s+$/, ""));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function resampleData(data: number[], targetLen: number): number[] {
  if (data.length === 0) return [];
  if (data.length === 1) return Array(targetLen).fill(data[0]);
  if (targetLen <= 0) return [];
  if (targetLen === 1) return [data.reduce((a, b) => a + b, 0) / data.length];
  const result: number[] = [];
  for (let i = 0; i < targetLen; i++) {
    const t = (i / (targetLen - 1)) * (data.length - 1);
    const lo = Math.floor(t);
    const hi = Math.min(lo + 1, data.length - 1);
    result.push(lerp(data[lo], data[hi], t - lo));
  }
  return result;
}

/** ASCII pie chart rendered with fill characters. */
export function pieChart(
  data: { label: string; value: number }[],
  radius?: number,
): string[] {
  if (data.length === 0) return [];
  const r = radius ?? 8;
  const total = data.reduce((s, d) => s + Math.abs(d.value), 0);
  if (total === 0) return drawEmptyPie(r, data);

  const slices: { startAngle: number; endAngle: number; fill: string; label: string; pct: number }[] = [];
  let cumulative = 0;
  for (let i = 0; i < data.length; i++) {
    const pct = Math.abs(data[i].value) / total;
    const startAngle = cumulative * 2 * Math.PI;
    cumulative += pct;
    slices.push({ startAngle, endAngle: cumulative * 2 * Math.PI, fill: PIE_FILLS[i % PIE_FILLS.length], label: data[i].label, pct });
  }

  const diamY = r * 2 + 1;
  const diamX = r * 4 + 1;
  const cx = r * 2;
  const cy = r;

  const grid: string[][] = [];
  for (let y = 0; y < diamY; y++) {
    const row: string[] = [];
    for (let x = 0; x < diamX; x++) {
      const nx = (x - cx) / 2;
      const ny = cy - y;
      const dist = Math.sqrt(nx * nx + ny * ny);
      if (dist <= r + 0.5) {
        let angle = Math.atan2(ny, nx);
        if (angle < 0) angle += 2 * Math.PI;
        angle = (angle + Math.PI / 2) % (2 * Math.PI);
        let ch = " ";
        for (const slice of slices) {
          if (angle >= slice.startAngle && angle < slice.endAngle) { ch = slice.fill; break; }
        }
        if (ch === " " && slices.length > 0) ch = slices[slices.length - 1].fill;
        row.push(ch);
      } else {
        row.push(" ");
      }
    }
    grid.push(row);
  }

  const lines: string[] = grid.map(row => row.join(""));
  lines.push("");
  for (const slice of slices) {
    lines.push(`  ${slice.fill} ${slice.label} (${(slice.pct * 100).toFixed(1)}%)`);
  }
  return trimRight(lines);
}

function drawEmptyPie(r: number, data: { label: string; value: number }[]): string[] {
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
      line += Math.abs(Math.sqrt(nx * nx + ny * ny) - r) < 0.8 ? "\u00b7" : " ";
    }
    lines.push(line);
  }
  lines.push("");
  for (let i = 0; i < data.length; i++) {
    lines.push(`  ${PIE_FILLS[i % PIE_FILLS.length]} ${data[i].label} (0.0%)`);
  }
  return trimRight(lines);
}

/** Braille line graph with Y-axis labels and X-axis. */
export function graph(data: number[], width?: number, height?: number): string[] {
  if (data.length === 0) return [];
  const charWidth = width ?? 60;
  const charHeight = height ?? 15;
  if (charWidth <= 0 || charHeight <= 0) return [];

  const dotW = charWidth * 2;
  const dotH = charHeight * 4;
  const resampled = resampleData(data, dotW);
  const minVal = Math.min(...resampled);
  const maxVal = Math.max(...resampled);
  const range = maxVal - minVal || 1;

  const grid: number[][] = [];
  for (let r = 0; r < charHeight; r++) grid.push(new Array(charWidth).fill(0));

  for (let dx = 0; dx < dotW; dx++) {
    const norm = (resampled[dx] - minVal) / range;
    const dy = Math.round(norm * (dotH - 1));
    const charCol = Math.floor(dx / 2);
    const dotCol = dx % 2;
    const invertedDy = dotH - 1 - dy;
    const charRow = Math.floor(invertedDy / 4);
    const dotRow = invertedDy % 4;
    if (charRow >= 0 && charRow < charHeight && charCol >= 0 && charCol < charWidth) {
      grid[charRow][charCol] |= (1 << BRAILLE_DOT_MAP[dotRow][dotCol]);
    }
  }

  for (let dx = 0; dx < dotW - 1; dx++) {
    const dy0 = Math.round(((resampled[dx] - minVal) / range) * (dotH - 1));
    const dy1 = Math.round(((resampled[dx + 1] - minVal) / range) * (dotH - 1));
    const steps = Math.abs(dy1 - dy0);
    if (steps > 1) {
      const dir = dy1 > dy0 ? 1 : -1;
      for (let s = 1; s < steps; s++) {
        const iy = dy0 + s * dir;
        const charCol = Math.floor(dx / 2);
        const dotCol = dx % 2;
        const invertedIy = dotH - 1 - iy;
        const charRow = Math.floor(invertedIy / 4);
        const dotRow = invertedIy % 4;
        if (charRow >= 0 && charRow < charHeight && charCol >= 0 && charCol < charWidth) {
          grid[charRow][charCol] |= (1 << BRAILLE_DOT_MAP[dotRow][dotCol]);
        }
      }
    }
  }

  const numYLabels = Math.min(charHeight, 5);
  const yLabels: Map<number, string> = new Map();
  for (let i = 0; i < numYLabels; i++) {
    const row = Math.round((i / (numYLabels - 1)) * (charHeight - 1));
    yLabels.set(row, fmtNum(maxVal - (row / (charHeight - 1)) * range));
  }
  const yLabelWidth = Math.max(...Array.from(yLabels.values()).map(s => s.length));

  const lines: string[] = [];
  for (let r = 0; r < charHeight; r++) {
    const yLabel = yLabels.has(r) ? lpad(yLabels.get(r)!, yLabelWidth) : " ".repeat(yLabelWidth);
    lines.push(`${yLabel} \u2524${grid[r].map(dots => String.fromCharCode(BRAILLE_OFFSET + dots)).join("")}`);
  }
  lines.push(" ".repeat(yLabelWidth) + " \u2514" + "\u2500".repeat(charWidth));
  const xStart = "0";
  const xEnd = String(data.length - 1);
  const gap = charWidth - xStart.length - xEnd.length;
  lines.push(" ".repeat(yLabelWidth + 2) + xStart + (gap > 0 ? " ".repeat(gap) + xEnd : ""));

  return trimRight(lines);
}
