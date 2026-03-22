export type BorderStyle = "single" | "double" | "rounded" | "heavy" | "dashed" | "ascii" | "none";

export interface BorderChars {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  horizontal: string;
  vertical: string;
  teeLeft: string;
  teeRight: string;
  teeUp: string;
  teeDown: string;
  cross: string;
}

export const borderPresets: Record<BorderStyle, BorderChars> = {
  single: {
    topLeft: "\u250c", topRight: "\u2510",
    bottomLeft: "\u2514", bottomRight: "\u2518",
    horizontal: "\u2500", vertical: "\u2502",
    teeLeft: "\u2524", teeRight: "\u251c",
    teeUp: "\u2534", teeDown: "\u252c",
    cross: "\u253c",
  },
  double: {
    topLeft: "\u2554", topRight: "\u2557",
    bottomLeft: "\u255a", bottomRight: "\u255d",
    horizontal: "\u2550", vertical: "\u2551",
    teeLeft: "\u2563", teeRight: "\u2560",
    teeUp: "\u2569", teeDown: "\u2566",
    cross: "\u256c",
  },
  rounded: {
    topLeft: "\u256d", topRight: "\u256e",
    bottomLeft: "\u2570", bottomRight: "\u256f",
    horizontal: "\u2500", vertical: "\u2502",
    teeLeft: "\u2524", teeRight: "\u251c",
    teeUp: "\u2534", teeDown: "\u252c",
    cross: "\u253c",
  },
  heavy: {
    topLeft: "\u250f", topRight: "\u2513",
    bottomLeft: "\u2517", bottomRight: "\u251b",
    horizontal: "\u2501", vertical: "\u2503",
    teeLeft: "\u252b", teeRight: "\u2523",
    teeUp: "\u253b", teeDown: "\u2533",
    cross: "\u254b",
  },
  dashed: {
    topLeft: "\u250c", topRight: "\u2510",
    bottomLeft: "\u2514", bottomRight: "\u2518",
    horizontal: "\u2504", vertical: "\u2506",
    teeLeft: "\u2524", teeRight: "\u251c",
    teeUp: "\u2534", teeDown: "\u252c",
    cross: "\u253c",
  },
  ascii: {
    topLeft: "+", topRight: "+",
    bottomLeft: "+", bottomRight: "+",
    horizontal: "-", vertical: "|",
    teeLeft: "+", teeRight: "+",
    teeUp: "+", teeDown: "+",
    cross: "+",
  },
  none: {
    topLeft: " ", topRight: " ",
    bottomLeft: " ", bottomRight: " ",
    horizontal: " ", vertical: " ",
    teeLeft: " ", teeRight: " ",
    teeUp: " ", teeDown: " ",
    cross: " ",
  },
};

export function getBorderChars(style: BorderStyle | undefined): BorderChars {
  return borderPresets[style ?? "rounded"] ?? borderPresets.rounded;
}

export function drawBox(width: number, height: number, style: BorderStyle = "rounded"): string[] {
  const chars = getBorderChars(style);
  const lines: string[] = [];
  const innerWidth = Math.max(0, width - 2);

  lines.push(chars.topLeft + chars.horizontal.repeat(innerWidth) + chars.topRight);
  for (let i = 0; i < height - 2; i++) {
    lines.push(chars.vertical + " ".repeat(innerWidth) + chars.vertical);
  }
  if (height > 1) {
    lines.push(chars.bottomLeft + chars.horizontal.repeat(innerWidth) + chars.bottomRight);
  }

  return lines;
}

export function drawBoxWithTitle(width: number, height: number, title: string, style: BorderStyle = "rounded"): string[] {
  const chars = getBorderChars(style);
  const lines: string[] = [];
  const innerWidth = Math.max(0, width - 2);

  // Top border with title
  const titleText = ` ${title} `;
  const titleLen = titleText.length;
  const remaining = Math.max(0, innerWidth - titleLen - 1);
  lines.push(chars.topLeft + chars.horizontal + titleText + chars.horizontal.repeat(remaining) + chars.topRight);

  for (let i = 0; i < height - 2; i++) {
    lines.push(chars.vertical + " ".repeat(innerWidth) + chars.vertical);
  }
  if (height > 1) {
    lines.push(chars.bottomLeft + chars.horizontal.repeat(innerWidth) + chars.bottomRight);
  }

  return lines;
}
