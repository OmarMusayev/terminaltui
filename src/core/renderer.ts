import { fgColor, bgColor } from "../style/colors.js";

export interface Cell {
  char: string;
  fg: string | null;
  bg: string | null;
  bold: boolean;
  italic: boolean;
  dim: boolean;
  underline: boolean;
  inverse: boolean;
  strikethrough: boolean;
}

export function createCell(char: string = " "): Cell {
  return {
    char,
    fg: null,
    bg: null,
    bold: false,
    italic: false,
    dim: false,
    underline: false,
    inverse: false,
    strikethrough: false,
  };
}

export function cellsEqual(a: Cell, b: Cell): boolean {
  return (
    a.char === b.char &&
    a.fg === b.fg &&
    a.bg === b.bg &&
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.dim === b.dim &&
    a.underline === b.underline &&
    a.inverse === b.inverse &&
    a.strikethrough === b.strikethrough
  );
}

export class ScreenBuffer {
  width: number;
  height: number;
  cells: Cell[][];
  private prevCells: Cell[][] | null = null;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cells = this.createGrid(width, height);
  }

  private createGrid(w: number, h: number): Cell[][] {
    const grid: Cell[][] = [];
    for (let y = 0; y < h; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < w; x++) {
        row.push(createCell());
      }
      grid.push(row);
    }
    return grid;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.cells = this.createGrid(width, height);
    this.prevCells = null;
  }

  clear(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.cells[y][x] = createCell();
      }
    }
  }

  setCell(x: number, y: number, cell: Partial<Cell>): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const existing = this.cells[y][x];
    if (cell.char !== undefined) existing.char = cell.char;
    if (cell.fg !== undefined) existing.fg = cell.fg;
    if (cell.bg !== undefined) existing.bg = cell.bg;
    if (cell.bold !== undefined) existing.bold = cell.bold;
    if (cell.italic !== undefined) existing.italic = cell.italic;
    if (cell.dim !== undefined) existing.dim = cell.dim;
    if (cell.underline !== undefined) existing.underline = cell.underline;
    if (cell.inverse !== undefined) existing.inverse = cell.inverse;
    if (cell.strikethrough !== undefined) existing.strikethrough = cell.strikethrough;
  }

  writeText(x: number, y: number, text: string, style?: Partial<Cell>): void {
    for (let i = 0; i < text.length; i++) {
      if (x + i >= this.width) break;
      this.setCell(x + i, y, { char: text[i], ...style });
    }
  }

  flush(): string {
    let output = "";
    const fullRedraw = this.prevCells === null;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        const prev = this.prevCells?.[y]?.[x];

        if (!fullRedraw && prev && cellsEqual(cell, prev)) continue;

        output += `\x1b[${y + 1};${x + 1}H`; // move cursor
        output += cellToAnsi(cell);
      }
    }

    output += "\x1b[0m"; // reset

    // Save current as previous for next diff
    this.prevCells = this.cells.map(row => row.map(cell => ({ ...cell })));

    return output;
  }

  fullRender(): string {
    this.prevCells = null;
    return this.flush();
  }
}

function cellToAnsi(cell: Cell): string {
  let seq = "\x1b[0m"; // reset first
  const attrs: string[] = [];

  if (cell.bold) attrs.push("1");
  if (cell.dim) attrs.push("2");
  if (cell.italic) attrs.push("3");
  if (cell.underline) attrs.push("4");
  if (cell.inverse) attrs.push("7");
  if (cell.strikethrough) attrs.push("9");

  // Build attribute sequence
  let attrSeq = attrs.length > 0 ? `\x1b[${attrs.join(";")}m` : "";

  // Use the color system (respects terminal capability detection)
  let fgSeq = cell.fg ? fgColor(cell.fg) : "";
  let bgSeq = cell.bg ? bgColor(cell.bg) : "";

  if (attrSeq || fgSeq || bgSeq) {
    seq = "\x1b[0m" + attrSeq + fgSeq + bgSeq;
  }

  return seq + cell.char;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return null;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

export { hexToRgb };
