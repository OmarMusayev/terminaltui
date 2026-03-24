/**
 * Additional ASCII art shape generators: star, arrow, hexagon, line.
 * Split from shapes.ts to keep files under 400 lines.
 */

/**
 * Star shape using hand-tuned templates for clean output.
 * Supports 5-point stars at radii 3, 5, 8 and 6-point stars at radius 5.
 * Falls back to math rasterization for other configurations.
 */
export function star(points: number, outerRadius: number, innerRadius?: number): string[] {
  if (points < 2 || outerRadius <= 0) return [];
  if (outerRadius === 1) return ["*"];

  const templates: Record<string, string[]> = {
    "5-3": [
      "   ,",
      "__/ \\__",
      "\\     /",
      "/_   _\\",
      "  \\ /",
      "   '",
    ],
    "5-5": [
      "        .",
      "       ,O,",
      "      ,OOO,",
      "'oooooOOOOOooooo'",
      "  `OOOOOOOOOOO`",
      "    `OOOOOOO`",
      "    OOOO'OOOO",
      "   OOO'   'OOO",
      "  O'         'O",
    ],
    "5-8": [
      "\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2840\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u28b7\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2880\u28bf\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u28b8\u28bf\u2847\u2800\u2800\u2800\u2847\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2880\u28be\u28bf\u28bf\u2800\u2800\u28b8\u28a7\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u28c0\u28fc\u28bf\u28bf\u28bf\u28a7\u2840\u28b8\u28bf\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2800\u2800\u2870\u28b6\u28be\u28bf\u28bf\u28bf\u28bf\u28bf\u28bf\u28bf\u28bf\u28bf\u28bf\u28b6\u2804\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2808\u2899\u28bf\u28bf\u28bf\u28bf\u28bf\u28cb\u28bf\u28bf\u2847\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2808\u28bf\u28bf\u28bf\u2800\u2870\u28bf\u28bf\u28b7\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u28b8\u28bf\u2807\u2800\u28be\u28bf\u28b8\u28bf\u2846\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2880\u2800\u2808\u28bf\u2880\u28fc\u28bf\u2803\u2800\u28bb\u28bf\u28c4\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u28b8\u28c0\u28a0\u28bf\u28bf\u287f\u2801\u2800\u2800\u2800\u28bb\u28bf\u28b6\u28a4\u2840\u2800\u2800\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2800\u2800\u28a0\u28b4\u28b6\u28be\u28bf\u28bf\u28bf\u28db\u2801\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2899\u28bb\u28bf\u28bf\u28b7\u28b6\u28a6\u28a4",
      "\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2808\u2809\u28bf\u289f\u28bf\u28bf\u28b7\u28a6\u2800\u2800\u2800\u2800\u28c0\u28b6\u28bf\u287f\u28cf\u2809\u2809\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2870\u28bf\u28a7\u2800\u2800\u2899\u28bf\u28b7\u2844\u2800\u28b0\u28bf\u289f\u2801\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u28fc\u28bf\u28bf\u2844\u2800\u2800\u2898\u28bf\u28b7\u2870\u28bf\u289f\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2800\u2800\u2800\u28a0\u28bf\u28bf\u28bf\u28a7\u2800\u2800\u2800\u28b9\u28bf\u28bf\u287f\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2800\u2880\u28a0\u28fc\u28bf\u28bf\u28bf\u28bf\u28b7\u28a4\u2840\u2898\u28bf\u28bf\u2847\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
      "\u28a4\u28b6\u28be\u28bf\u28bf\u28bf\u28bf\u28bf\u28bf\u28bf\u28bf\u28bf\u28bf\u28bf\u28bf\u28bf\u28bf\u28a7\u2804\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2809\u2899\u28bb\u28bf\u28bf\u28bf\u28bf\u28bf\u28bf\u287f\u28cb\u2809\u28b9\u28bf\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2800\u2800\u2800\u2808\u28bb\u28bf\u28bf\u28bf\u287f\u2803\u2800\u2800\u2800\u28b8\u280f\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u28bf\u28bf\u28bf\u2803\u2800\u2800\u2800\u2800\u28b8\u2847\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u28b9\u28bf\u28bf\u2800\u2800\u2800\u2800\u2800\u2808\u2803\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2898\u28bf\u2847\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u28bf\u2803\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u28bf\u2801\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
      "\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2839\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800",
    ],
    "6-5": [
      "        /\\",
      "   ____/  \\____",
      "   \\    >  <  /",
      "    /___ __ _\\",
      "       / \\",
      "      /   \\",
      "   __/     \\__",
      "   \\    ^    /",
      "   /__ | __\\",
      "       \\|/",
      "        V",
    ],
  };

  const key = `${points}-${outerRadius}`;
  if (templates[key]) {
    return templates[key].map(l => l.trimEnd());
  }

  // Fallback: math rasterization for unsupported point/radius combos
  const inner = innerRadius ?? Math.floor(outerRadius / 2.5 + 0.5);
  const hScale = 2;
  const canvasH = outerRadius * 2 + 1;
  const canvasW = outerRadius * 2 * hScale + 1;
  const cx = outerRadius * hScale;
  const cy = outerRadius;

  const vertices: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI * 2 * i) / (points * 2) - Math.PI / 2;
    const r = i % 2 === 0 ? outerRadius : inner;
    vertices.push({
      x: cx + Math.cos(angle) * r * hScale,
      y: cy + Math.sin(angle) * r,
    });
  }

  const grid: boolean[][] = [];
  for (let r = 0; r < canvasH; r++) {
    grid[r] = new Array(canvasW).fill(false);
  }

  function pointInPolygon(px: number, py: number): boolean {
    let inside = false;
    const n = vertices.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = vertices[i].x, yi = vertices[i].y;
      const xj = vertices[j].x, yj = vertices[j].y;
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  function nearEdge(px: number, py: number): boolean {
    const n = vertices.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = vertices[i].x, yi = vertices[i].y;
      const xj = vertices[j].x, yj = vertices[j].y;
      const dx = xj - xi, dy = yj - yi;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;
      const t = Math.max(0, Math.min(1, ((px - xi) * dx + (py - yi) * dy) / (len * len)));
      const closestX = xi + t * dx;
      const closestY = yi + t * dy;
      const dist = Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
      if (dist < 0.7) return true;
    }
    return false;
  }

  for (let r = 0; r < canvasH; r++) {
    for (let c = 0; c < canvasW; c++) {
      if (pointInPolygon(c, r) || nearEdge(c, r)) {
        grid[r][c] = true;
      }
    }
  }

  const lines: string[] = [];
  for (let r = 0; r < canvasH; r++) {
    let lineStr = "";
    let lastFilled = -1;
    for (let c = 0; c < canvasW; c++) {
      if (grid[r][c]) {
        lineStr += "*";
        lastFilled = lineStr.length;
      } else {
        lineStr += " ";
      }
    }
    if (lastFilled > 0) {
      lines.push(lineStr.substring(0, lastFilled));
    }
  }

  while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();

  return lines.map(l => l.trimEnd());
}

/** Arrow shape in four directions with customizable style. */
export function arrow(
  direction: "up" | "down" | "left" | "right",
  length: number,
  style?: "thin" | "thick" | "double"
): string[] {
  if (length <= 0) return [];

  const s = style ?? "thin";
  const chars = {
    thin: { h: "\u2500", v: "\u2502", up: "\u25b2", down: "\u25bc", left: "\u25c0", right: "\u25b6" },
    thick: { h: "\u2501", v: "\u2503", up: "\u25b2", down: "\u25bc", left: "\u25c0", right: "\u25b6" },
    double: { h: "\u2550", v: "\u2551", up: "\u25b2", down: "\u25bc", left: "\u25c0", right: "\u25b6" },
  }[s];

  if (length === 1) return [chars[direction]];

  const lines: string[] = [];
  switch (direction) {
    case "right": lines.push(chars.h.repeat(length - 1) + chars.right); break;
    case "left": lines.push(chars.left + chars.h.repeat(length - 1)); break;
    case "down":
      for (let i = 0; i < length - 1; i++) lines.push(chars.v);
      lines.push(chars.down);
      break;
    case "up":
      lines.push(chars.up);
      for (let i = 0; i < length - 1; i++) lines.push(chars.v);
      break;
  }
  return lines;
}

/** Regular hexagon using / \ _ characters. */
export function hexagon(size: number): string[] {
  if (size <= 0) return [];
  if (size === 1) return ["/_\\", "\\_/"];

  const lines: string[] = [];
  const topWidth = size * 2;
  lines.push(" ".repeat(size) + " " + "_".repeat(topWidth));

  for (let i = 0; i < size; i++) {
    const indent = size - i - 1;
    const innerWidth = topWidth + 2 * i;
    lines.push(" ".repeat(indent) + "/" + " ".repeat(innerWidth) + "\\");
  }

  for (let i = size - 1; i >= 0; i--) {
    const indent = size - i - 1;
    const innerWidth = topWidth + 2 * i;
    if (i === 0) {
      lines.push(" ".repeat(indent) + "\\" + "_".repeat(innerWidth) + "/");
    } else {
      lines.push(" ".repeat(indent) + "\\" + " ".repeat(innerWidth) + "/");
    }
  }

  return lines.map(l => l.trimEnd());
}

/** Decorative horizontal line with various styles. */
export function line(length: number, style?: "solid" | "dashed" | "dotted" | "double" | "wave" | "zigzag"): string[] {
  if (length <= 0) return [];
  const s = style ?? "solid";
  switch (s) {
    case "solid": return ["\u2500".repeat(length)];
    case "dashed": return ["\u254c".repeat(length)];
    case "dotted": return ["\u2504".repeat(length)];
    case "double": return ["\u2550".repeat(length)];
    case "wave": return ["\u223f".repeat(length)];
    case "zigzag": {
      let result = "";
      for (let i = 0; i < length; i++) result += "\u2307";
      return [result];
    }
  }
}
