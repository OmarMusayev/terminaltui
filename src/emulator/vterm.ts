/**
 * Virtual terminal — ANSI parser and Cell[][] buffer.
 *
 * Maintains a grid of cells representing the terminal screen.
 * Parses ANSI escape sequences from PTY output and updates cells.
 */

import type { Cell, CellStyle, CursorPosition } from "./types.js";
import { ANSI_256_TO_HEX, ansiBasicToHex } from "./types.js";

function emptyCell(): Cell {
  return { char: " ", fg: null, bg: null, bold: false, dim: false, italic: false, underline: false, inverse: false };
}

function cloneStyle(style: CellStyle): CellStyle {
  return { fg: style.fg, bg: style.bg, bold: style.bold, dim: style.dim, italic: style.italic, underline: style.underline, inverse: style.inverse };
}

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
    this._buffer = this.createBuffer(cols, rows);
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
        // Build SGR codes for style changes
        const codes: number[] = [];
        if (cell.bold !== lastBold || cell.dim !== lastDim ||
            cell.italic !== lastItalic || cell.underline !== lastUnderline ||
            cell.inverse !== lastInverse || cell.fg !== lastFg || cell.bg !== lastBg) {
          codes.push(0); // reset
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
    const newBuffer = this.createBuffer(cols, rows);
    // Copy existing content
    for (let r = 0; r < Math.min(rows, this._rows); r++) {
      for (let c = 0; c < Math.min(cols, this._cols); c++) {
        newBuffer[r][c] = { ...this._buffer[r][c] };
      }
    }
    this._cols = cols;
    this._rows = rows;
    this._buffer = newBuffer;
    // Clamp cursor
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
            this.lineFeed();
          } else if (ch === "\b") {
            if (this._cursorCol > 0) this._cursorCol--;
          } else if (ch === "\t") {
            // Tab to next 8-column stop
            this._cursorCol = Math.min(this._cols - 1, (Math.floor(this._cursorCol / 8) + 1) * 8);
          } else if (code === 7) {
            // BEL — ignore
          } else if (code >= 32) {
            this.putChar(ch);
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
            // Designate character set — consume next char
            i++; // skip charset designation char
            this._parseState = "ground";
          } else if (ch === "=") {
            // Application keypad mode — ignore
            this._parseState = "ground";
          } else if (ch === ">") {
            // Normal keypad mode — ignore
            this._parseState = "ground";
          } else if (ch === "7") {
            // Save cursor — simplified ignore
            this._parseState = "ground";
          } else if (ch === "8") {
            // Restore cursor — simplified ignore
            this._parseState = "ground";
          } else if (ch === "M") {
            // Reverse index — scroll down
            this.reverseIndex();
            this._parseState = "ground";
          } else {
            this._parseState = "ground";
          }
          break;

        case "csi":
          if (ch >= "0" && ch <= "9" || ch === ";" || ch === "?" || ch === ">" || ch === "!" || ch === " ") {
            this._csiBuffer += ch;
          } else {
            this.handleCSI(this._csiBuffer, ch);
            this._parseState = "ground";
          }
          break;

        case "osc":
          if (ch === "\x07" || (ch === "\\" && this._oscBuffer.endsWith("\x1b"))) {
            // OSC terminated — ignore OSC content
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

  private createBuffer(cols: number, rows: number): Cell[][] {
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

  private putChar(ch: string): void {
    // Line wrap if at right edge
    if (this._cursorCol >= this._cols) {
      this._cursorCol = 0;
      this.lineFeed();
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

  private lineFeed(): void {
    if (this._cursorRow < this._rows - 1) {
      this._cursorRow++;
    } else {
      this.scrollUp();
    }
  }

  private scrollUp(): void {
    // Remove first row, add empty row at bottom
    this._buffer.shift();
    const newRow: Cell[] = [];
    for (let c = 0; c < this._cols; c++) {
      newRow.push(emptyCell());
    }
    this._buffer.push(newRow);
  }

  private reverseIndex(): void {
    if (this._cursorRow > 0) {
      this._cursorRow--;
    } else {
      // Scroll down — add empty row at top
      this._buffer.pop();
      const newRow: Cell[] = [];
      for (let c = 0; c < this._cols; c++) {
        newRow.push(emptyCell());
      }
      this._buffer.unshift(newRow);
    }
  }

  private handleCSI(params: string, final: string): void {
    // Private mode sequences
    if (params.startsWith("?")) {
      this.handlePrivateMode(params.slice(1), final);
      return;
    }

    const parts = params.split(";").map(s => (s === "" ? 0 : parseInt(s, 10)));

    switch (final) {
      case "A": // Cursor Up
        this._cursorRow = Math.max(0, this._cursorRow - (parts[0] || 1));
        break;

      case "B": // Cursor Down
        this._cursorRow = Math.min(this._rows - 1, this._cursorRow + (parts[0] || 1));
        break;

      case "C": // Cursor Forward
        this._cursorCol = Math.min(this._cols - 1, this._cursorCol + (parts[0] || 1));
        break;

      case "D": // Cursor Back
        this._cursorCol = Math.max(0, this._cursorCol - (parts[0] || 1));
        break;

      case "E": // Cursor Next Line
        this._cursorRow = Math.min(this._rows - 1, this._cursorRow + (parts[0] || 1));
        this._cursorCol = 0;
        break;

      case "F": // Cursor Previous Line
        this._cursorRow = Math.max(0, this._cursorRow - (parts[0] || 1));
        this._cursorCol = 0;
        break;

      case "G": // Cursor Horizontal Absolute
        this._cursorCol = Math.min(this._cols - 1, Math.max(0, (parts[0] || 1) - 1));
        break;

      case "H": // Cursor Position
      case "f":
        this._cursorRow = Math.min(this._rows - 1, Math.max(0, (parts[0] || 1) - 1));
        this._cursorCol = Math.min(this._cols - 1, Math.max(0, (parts[1] || 1) - 1));
        break;

      case "J": // Erase in Display
        this.eraseInDisplay(parts[0] || 0);
        break;

      case "K": // Erase in Line
        this.eraseInLine(parts[0] || 0);
        break;

      case "L": { // Insert Lines
        const count = parts[0] || 1;
        for (let i = 0; i < count; i++) {
          this._buffer.splice(this._cursorRow, 0,
            Array.from({ length: this._cols }, () => emptyCell()));
          this._buffer.pop();
        }
        break;
      }

      case "M": { // Delete Lines
        const count = parts[0] || 1;
        for (let i = 0; i < count; i++) {
          this._buffer.splice(this._cursorRow, 1);
          this._buffer.push(Array.from({ length: this._cols }, () => emptyCell()));
        }
        break;
      }

      case "P": { // Delete Characters
        const count = Math.min(parts[0] || 1, this._cols - this._cursorCol);
        const row = this._buffer[this._cursorRow];
        row.splice(this._cursorCol, count);
        for (let i = 0; i < count; i++) row.push(emptyCell());
        break;
      }

      case "@": { // Insert Characters
        const count = Math.min(parts[0] || 1, this._cols - this._cursorCol);
        const row = this._buffer[this._cursorRow];
        for (let i = 0; i < count; i++) row.splice(this._cursorCol, 0, emptyCell());
        row.length = this._cols;
        break;
      }

      case "S": { // Scroll Up
        const count = parts[0] || 1;
        for (let i = 0; i < count; i++) this.scrollUp();
        break;
      }

      case "T": { // Scroll Down
        const count = parts[0] || 1;
        for (let i = 0; i < count; i++) this.reverseIndex();
        break;
      }

      case "m": // SGR
        this.handleSGR(params);
        break;

      case "r": // Set Scrolling Region — simplified, ignore
        break;

      case "s": // Save cursor position
        break;

      case "u": // Restore cursor position
        break;

      case "n": // Device Status Report — ignore
        break;

      case "c": // Device Attributes — ignore
        break;

      case "l": // Reset Mode — ignore non-private
        break;

      case "h": // Set Mode — ignore non-private
        break;

      case "t": // Window manipulation — ignore
        break;

      case "X": { // Erase Characters
        const count = Math.min(parts[0] || 1, this._cols - this._cursorCol);
        for (let i = 0; i < count; i++) {
          if (this._cursorCol + i < this._cols) {
            this._buffer[this._cursorRow][this._cursorCol + i] = emptyCell();
          }
        }
        break;
      }

      case "d": // Vertical Position Absolute
        this._cursorRow = Math.min(this._rows - 1, Math.max(0, (parts[0] || 1) - 1));
        break;

      default:
        // Unknown CSI sequence — ignore
        break;
    }
  }

  private handlePrivateMode(params: string, final: string): void {
    const parts = params.split(";").map(s => parseInt(s, 10));
    const mode = parts[0];

    switch (final) {
      case "h": // Set (enable)
        if (mode === 25) {
          this._cursorVisible = true;
        } else if (mode === 1049) {
          // Enter alternate screen buffer
          this._savedMainBuffer = this._buffer.map(row => row.map(c => ({ ...c })));
          this._altBuffer = this.createBuffer(this._cols, this._rows);
          this._buffer = this._altBuffer;
          this._cursorRow = 0;
          this._cursorCol = 0;
        } else if (mode === 1) {
          // Application cursor keys — ignore
        } else if (mode === 7) {
          // Auto-wrap mode — already the default
        } else if (mode === 2004) {
          // Bracketed paste mode — ignore
        }
        break;

      case "l": // Reset (disable)
        if (mode === 25) {
          this._cursorVisible = false;
        } else if (mode === 1049) {
          // Leave alternate screen buffer
          if (this._savedMainBuffer) {
            this._buffer = this._savedMainBuffer;
            this._savedMainBuffer = null;
            this._altBuffer = null;
          }
        } else if (mode === 1) {
          // Normal cursor keys — ignore
        } else if (mode === 2004) {
          // Disable bracketed paste — ignore
        }
        break;
    }
  }

  private handleSGR(params: string): void {
    if (params === "" || params === "0") {
      this._style = { fg: null, bg: null, bold: false, dim: false, italic: false, underline: false, inverse: false };
      return;
    }

    const parts = params.split(";").map(s => (s === "" ? 0 : parseInt(s, 10)));
    let i = 0;

    while (i < parts.length) {
      const code = parts[i];

      switch (code) {
        case 0: // Reset
          this._style = { fg: null, bg: null, bold: false, dim: false, italic: false, underline: false, inverse: false };
          break;
        case 1: this._style.bold = true; break;
        case 2: this._style.dim = true; break;
        case 3: this._style.italic = true; break;
        case 4: this._style.underline = true; break;
        case 7: this._style.inverse = true; break;
        case 22: this._style.bold = false; this._style.dim = false; break;
        case 23: this._style.italic = false; break;
        case 24: this._style.underline = false; break;
        case 27: this._style.inverse = false; break;

        // Foreground colors (basic)
        case 30: case 31: case 32: case 33:
        case 34: case 35: case 36: case 37:
          this._style.fg = ansiBasicToHex(code);
          break;
        case 39: // Default fg
          this._style.fg = null;
          break;

        // Background colors (basic)
        case 40: case 41: case 42: case 43:
        case 44: case 45: case 46: case 47:
          this._style.bg = ansiBasicToHex(code);
          break;
        case 49: // Default bg
          this._style.bg = null;
          break;

        // Bright foreground
        case 90: case 91: case 92: case 93:
        case 94: case 95: case 96: case 97:
          this._style.fg = ansiBasicToHex(code);
          break;

        // Bright background
        case 100: case 101: case 102: case 103:
        case 104: case 105: case 106: case 107:
          this._style.bg = ansiBasicToHex(code);
          break;

        case 38: // Extended fg
          if (i + 1 < parts.length) {
            if (parts[i + 1] === 5 && i + 2 < parts.length) {
              // 256-color: \x1b[38;5;{n}m
              const idx = parts[i + 2];
              this._style.fg = idx >= 0 && idx < 256 ? ANSI_256_TO_HEX[idx] : null;
              i += 2;
            } else if (parts[i + 1] === 2 && i + 4 < parts.length) {
              // Truecolor: \x1b[38;2;{r};{g};{b}m
              const r = parts[i + 2];
              const g = parts[i + 3];
              const b = parts[i + 4];
              this._style.fg = "#" +
                r.toString(16).padStart(2, "0") +
                g.toString(16).padStart(2, "0") +
                b.toString(16).padStart(2, "0");
              i += 4;
            }
          }
          break;

        case 48: // Extended bg
          if (i + 1 < parts.length) {
            if (parts[i + 1] === 5 && i + 2 < parts.length) {
              // 256-color: \x1b[48;5;{n}m
              const idx = parts[i + 2];
              this._style.bg = idx >= 0 && idx < 256 ? ANSI_256_TO_HEX[idx] : null;
              i += 2;
            } else if (parts[i + 1] === 2 && i + 4 < parts.length) {
              // Truecolor: \x1b[48;2;{r};{g};{b}m
              const r = parts[i + 2];
              const g = parts[i + 3];
              const b = parts[i + 4];
              this._style.bg = "#" +
                r.toString(16).padStart(2, "0") +
                g.toString(16).padStart(2, "0") +
                b.toString(16).padStart(2, "0");
              i += 4;
            }
          }
          break;

        default:
          break;
      }
      i++;
    }
  }

  private eraseInDisplay(mode: number): void {
    switch (mode) {
      case 0: // From cursor to end
        // Clear rest of current line
        for (let c = this._cursorCol; c < this._cols; c++) {
          this._buffer[this._cursorRow][c] = emptyCell();
        }
        // Clear all lines below
        for (let r = this._cursorRow + 1; r < this._rows; r++) {
          for (let c = 0; c < this._cols; c++) {
            this._buffer[r][c] = emptyCell();
          }
        }
        break;

      case 1: // From start to cursor
        // Clear all lines above
        for (let r = 0; r < this._cursorRow; r++) {
          for (let c = 0; c < this._cols; c++) {
            this._buffer[r][c] = emptyCell();
          }
        }
        // Clear start of current line to cursor
        for (let c = 0; c <= this._cursorCol; c++) {
          this._buffer[this._cursorRow][c] = emptyCell();
        }
        break;

      case 2: // Entire screen
      case 3: // Entire screen + scrollback (treat same as 2)
        for (let r = 0; r < this._rows; r++) {
          for (let c = 0; c < this._cols; c++) {
            this._buffer[r][c] = emptyCell();
          }
        }
        break;
    }
  }

  private eraseInLine(mode: number): void {
    switch (mode) {
      case 0: // From cursor to end
        for (let c = this._cursorCol; c < this._cols; c++) {
          this._buffer[this._cursorRow][c] = emptyCell();
        }
        break;

      case 1: // From start to cursor
        for (let c = 0; c <= this._cursorCol; c++) {
          this._buffer[this._cursorRow][c] = emptyCell();
        }
        break;

      case 2: // Entire line
        for (let c = 0; c < this._cols; c++) {
          this._buffer[this._cursorRow][c] = emptyCell();
        }
        break;
    }
  }
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
