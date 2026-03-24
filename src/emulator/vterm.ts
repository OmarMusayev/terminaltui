/**
 * Virtual terminal — ANSI parser and Cell[][] buffer.
 *
 * Maintains a grid of cells representing the terminal screen.
 * Parses ANSI escape sequences from PTY output and updates cells.
 */

import type { Cell, CellStyle, CursorPosition } from "./types.js";
import {
  emptyCell, hexToRgb, handleCSI as csiDispatch,
  type VTermState,
} from "./vterm-parser.js";

// Re-export parser utilities so existing deep imports still work
export { emptyCell, cloneStyle, hexToRgb, handleSGR } from "./vterm-parser.js";

export class VirtualTerminal {
  private _cols: number;
  private _rows: number;
  private _buffer: Cell[][];
  private _altBuffer: Cell[][] | null = null;
  private _savedMainBuffer: Cell[][] | null = null;
  private _cursorRow = 0;
  private _cursorCol = 0;
  private _cursorVisible = true;
  private _style: CellStyle = { fg: null, bg: null, bold: false, dim: false, italic: false, underline: false, inverse: false };
  private _parseState: "ground" | "escape" | "csi" | "osc" = "ground";
  private _csiBuffer = "";
  private _oscBuffer = "";
  private _lastWriteTime = 0;
  /**
   * When true, translate LF (\n) to CR+LF (\r\n).
   * Mirrors the ONLCR flag in real PTY slave devices.
   * Set to true when connected to a node-pty process.
   */
  onlcr = false;

  /** Event callback for screen changes */
  onUpdate: (() => void) | null = null;

  constructor(cols: number, rows: number) {
    this._cols = cols;
    this._rows = rows;
    this._buffer = this._createBuffer(cols, rows);
  }

  get cols(): number { return this._cols; }
  get rows(): number { return this._rows; }
  get cursorRow(): number { return this._cursorRow; }
  get cursorCol(): number { return this._cursorCol; }
  get cursorVisible(): boolean { return this._cursorVisible; }
  get lastWriteTime(): number { return this._lastWriteTime; }

  cursor(): CursorPosition {
    return { row: this._cursorRow, col: this._cursorCol };
  }

  cells(): Cell[][] {
    return this._buffer.map(row => row.map(c => ({ ...c })));
  }

  cellAt(row: number, col: number): Cell | null {
    if (row < 0 || row >= this._rows || col < 0 || col >= this._cols) return null;
    return { ...this._buffer[row][col] };
  }

  /** Get plain text for the entire screen (ANSI stripped). */
  text(): string {
    return this._buffer
      .map(row => row.map(c => c.char).join("").replace(/\s+$/, ""))
      .join("\n");
  }

  /** Get plain text for a region. */
  textAt(row: number, col: number, w: number, h: number): string {
    const lines: string[] = [];
    for (let r = row; r < Math.min(row + h, this._rows); r++) {
      let line = "";
      for (let c = col; c < Math.min(col + w, this._cols); c++) {
        line += this._buffer[r][c].char;
      }
      lines.push(line.replace(/\s+$/, ""));
    }
    return lines.join("\n");
  }

  /** Check if screen contains a string. */
  contains(str: string): boolean {
    return this.text().includes(str);
  }

  /** Find first occurrence of a string on screen. */
  find(str: string): { row: number; col: number } | null {
    for (let r = 0; r < this._rows; r++) {
      const line = this._buffer[r].map(c => c.char).join("");
      const idx = line.indexOf(str);
      if (idx >= 0) return { row: r, col: idx };
    }
    return null;
  }

  /** Reconstruct ANSI output from cells. */
  ansi(): string {
    const lines: string[] = [];
    for (let r = 0; r < this._rows; r++) {
      let line = "";
      let lastFg: string | null = null;
      let lastBg: string | null = null;
      let lastBold = false;
      let lastDim = false;
      let lastItalic = false;
      let lastUnderline = false;
      let lastInverse = false;

      for (let c = 0; c < this._cols; c++) {
        const cell = this._buffer[r][c];
        const codes: number[] = [];
        if (cell.bold !== lastBold || cell.dim !== lastDim ||
            cell.italic !== lastItalic || cell.underline !== lastUnderline ||
            cell.inverse !== lastInverse || cell.fg !== lastFg || cell.bg !== lastBg) {
          codes.push(0);
          if (cell.bold) codes.push(1);
          if (cell.dim) codes.push(2);
          if (cell.italic) codes.push(3);
          if (cell.underline) codes.push(4);
          if (cell.inverse) codes.push(7);
          if (cell.fg) {
            const rgb = hexToRgb(cell.fg);
            if (rgb) codes.push(38, 2, rgb.r, rgb.g, rgb.b);
          }
          if (cell.bg) {
            const rgb = hexToRgb(cell.bg);
            if (rgb) codes.push(48, 2, rgb.r, rgb.g, rgb.b);
          }
          line += `\x1b[${codes.join(";")}m`;
          lastFg = cell.fg;
          lastBg = cell.bg;
          lastBold = cell.bold;
          lastDim = cell.dim;
          lastItalic = cell.italic;
          lastUnderline = cell.underline;
          lastInverse = cell.inverse;
        }
        line += cell.char;
      }
      line += "\x1b[0m";
      lines.push(line.replace(/\s+$/, ""));
    }
    return lines.join("\n");
  }

  /** Resize the terminal. */
  resize(cols: number, rows: number): void {
    const newBuffer = this._createBuffer(cols, rows);
    for (let r = 0; r < Math.min(rows, this._rows); r++) {
      for (let c = 0; c < Math.min(cols, this._cols); c++) {
        newBuffer[r][c] = { ...this._buffer[r][c] };
      }
    }
    this._cols = cols;
    this._rows = rows;
    this._buffer = newBuffer;
    this._cursorRow = Math.min(this._cursorRow, rows - 1);
    this._cursorCol = Math.min(this._cursorCol, cols - 1);
    this.onUpdate?.();
  }

  /** Write data from PTY into the terminal. */
  write(data: string): void {
    this._lastWriteTime = Date.now();
    for (let i = 0; i < data.length; i++) {
      const ch = data[i];
      const code = ch.charCodeAt(0);

      switch (this._parseState) {
        case "ground":
          if (ch === "\x1b") {
            this._parseState = "escape";
          } else if (ch === "\r") {
            this._cursorCol = 0;
          } else if (ch === "\n") {
            if (this.onlcr) this._cursorCol = 0;
            this._lineFeed();
          } else if (ch === "\b") {
            if (this._cursorCol > 0) this._cursorCol--;
          } else if (ch === "\t") {
            this._cursorCol = Math.min(this._cols - 1, (Math.floor(this._cursorCol / 8) + 1) * 8);
          } else if (code === 7) {
            // BEL — ignore
          } else if (code >= 32) {
            this._putChar(ch);
          }
          break;

        case "escape":
          if (ch === "[") {
            this._parseState = "csi";
            this._csiBuffer = "";
          } else if (ch === "]") {
            this._parseState = "osc";
            this._oscBuffer = "";
          } else if (ch === "(") {
            i++; // skip charset designation char
            this._parseState = "ground";
          } else if (ch === "=" || ch === ">" || ch === "7" || ch === "8") {
            this._parseState = "ground";
          } else if (ch === "M") {
            this._reverseIndex();
            this._parseState = "ground";
          } else {
            this._parseState = "ground";
          }
          break;

        case "csi":
          if (ch >= "0" && ch <= "9" || ch === ";" || ch === "?" || ch === ">" || ch === "!" || ch === " ") {
            this._csiBuffer += ch;
          } else {
            csiDispatch(this._csiBuffer, ch, this._state());
            this._syncFromState();
            this._parseState = "ground";
          }
          break;

        case "osc":
          if (ch === "\x07" || (ch === "\\" && this._oscBuffer.endsWith("\x1b"))) {
            this._parseState = "ground";
          } else {
            this._oscBuffer += ch;
          }
          break;
      }
    }
    this.onUpdate?.();
  }

  /** Clear the entire screen. */
  clear(): void {
    for (let r = 0; r < this._rows; r++) {
      for (let c = 0; c < this._cols; c++) {
        this._buffer[r][c] = emptyCell();
      }
    }
    this._cursorRow = 0;
    this._cursorCol = 0;
  }

  // ── Private ──────────────────────────────────────────────

  /** Build a VTermState snapshot for parser functions. */
  private _stateObj: VTermState | null = null;

  private _state(): VTermState {
    // Reuse object to avoid allocations on every CSI
    if (!this._stateObj) {
      this._stateObj = {
        cols: this._cols,
        rows: this._rows,
        cursorRow: this._cursorRow,
        cursorCol: this._cursorCol,
        cursorVisible: this._cursorVisible,
        style: this._style,
        buffer: this._buffer,
        altBuffer: this._altBuffer,
        savedMainBuffer: this._savedMainBuffer,
        createBuffer: (c, r) => this._createBuffer(c, r),
        scrollUp: () => this._scrollUp(),
        reverseIndex: () => this._reverseIndex(),
      };
    }
    const s = this._stateObj;
    s.cols = this._cols;
    s.rows = this._rows;
    s.cursorRow = this._cursorRow;
    s.cursorCol = this._cursorCol;
    s.cursorVisible = this._cursorVisible;
    s.style = this._style;
    s.buffer = this._buffer;
    s.altBuffer = this._altBuffer;
    s.savedMainBuffer = this._savedMainBuffer;
    return s;
  }

  /** Sync back from state object after parser mutates it. */
  private _syncFromState(): void {
    const s = this._stateObj!;
    this._cursorRow = s.cursorRow;
    this._cursorCol = s.cursorCol;
    this._cursorVisible = s.cursorVisible;
    this._buffer = s.buffer;
    this._altBuffer = s.altBuffer;
    this._savedMainBuffer = s.savedMainBuffer;
  }

  private _createBuffer(cols: number, rows: number): Cell[][] {
    const buf: Cell[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < cols; c++) {
        row.push(emptyCell());
      }
      buf.push(row);
    }
    return buf;
  }

  private _putChar(ch: string): void {
    if (this._cursorCol >= this._cols) {
      this._cursorCol = 0;
      this._lineFeed();
    }
    this._buffer[this._cursorRow][this._cursorCol] = {
      char: ch,
      fg: this._style.fg,
      bg: this._style.bg,
      bold: this._style.bold,
      dim: this._style.dim,
      italic: this._style.italic,
      underline: this._style.underline,
      inverse: this._style.inverse,
    };
    this._cursorCol++;
  }

  private _lineFeed(): void {
    if (this._cursorRow < this._rows - 1) {
      this._cursorRow++;
    } else {
      this._scrollUp();
    }
  }

  private _scrollUp(): void {
    this._buffer.shift();
    const newRow: Cell[] = [];
    for (let c = 0; c < this._cols; c++) {
      newRow.push(emptyCell());
    }
    this._buffer.push(newRow);
  }

  private _reverseIndex(): void {
    if (this._cursorRow > 0) {
      this._cursorRow--;
    } else {
      this._buffer.pop();
      const newRow: Cell[] = [];
      for (let c = 0; c < this._cols; c++) {
        newRow.push(emptyCell());
      }
      this._buffer.unshift(newRow);
    }
  }
}
