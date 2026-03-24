/**
 * ANSI escape sequence parser helpers for VirtualTerminal.
 *
 * Extracted from vterm.ts to keep files under 400 lines.
 */

import type { Cell, CellStyle } from "./types.js";
import { ANSI_256_TO_HEX, ansiBasicToHex } from "./types.js";

export function emptyCell(): Cell {
  return { char: " ", fg: null, bg: null, bold: false, dim: false, italic: false, underline: false, inverse: false };
}

export function cloneStyle(style: CellStyle): CellStyle {
  return { fg: style.fg, bg: style.bg, bold: style.bold, dim: style.dim, italic: style.italic, underline: style.underline, inverse: style.inverse };
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return null;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

/**
 * Mutable terminal state passed to parser functions.
 * This interface allows the parser to modify VirtualTerminal internals.
 */
export interface VTermState {
  cols: number;
  rows: number;
  cursorRow: number;
  cursorCol: number;
  cursorVisible: boolean;
  style: CellStyle;
  buffer: Cell[][];
  altBuffer: Cell[][] | null;
  savedMainBuffer: Cell[][] | null;
  createBuffer(cols: number, rows: number): Cell[][];
  scrollUp(): void;
  reverseIndex(): void;
}

/**
 * Handle SGR (Select Graphic Rendition) parameters.
 * Mutates the provided style object in place.
 */
export function handleSGR(params: string, style: CellStyle): void {
  if (params === "" || params === "0") {
    style.fg = null;
    style.bg = null;
    style.bold = false;
    style.dim = false;
    style.italic = false;
    style.underline = false;
    style.inverse = false;
    return;
  }

  const parts = params.split(";").map(s => (s === "" ? 0 : parseInt(s, 10)));
  let i = 0;

  while (i < parts.length) {
    const code = parts[i];

    switch (code) {
      case 0: // Reset
        style.fg = null;
        style.bg = null;
        style.bold = false;
        style.dim = false;
        style.italic = false;
        style.underline = false;
        style.inverse = false;
        break;
      case 1: style.bold = true; break;
      case 2: style.dim = true; break;
      case 3: style.italic = true; break;
      case 4: style.underline = true; break;
      case 7: style.inverse = true; break;
      case 22: style.bold = false; style.dim = false; break;
      case 23: style.italic = false; break;
      case 24: style.underline = false; break;
      case 27: style.inverse = false; break;

      // Foreground colors (basic)
      case 30: case 31: case 32: case 33:
      case 34: case 35: case 36: case 37:
        style.fg = ansiBasicToHex(code);
        break;
      case 39: style.fg = null; break;

      // Background colors (basic)
      case 40: case 41: case 42: case 43:
      case 44: case 45: case 46: case 47:
        style.bg = ansiBasicToHex(code);
        break;
      case 49: style.bg = null; break;

      // Bright foreground
      case 90: case 91: case 92: case 93:
      case 94: case 95: case 96: case 97:
        style.fg = ansiBasicToHex(code);
        break;

      // Bright background
      case 100: case 101: case 102: case 103:
      case 104: case 105: case 106: case 107:
        style.bg = ansiBasicToHex(code);
        break;

      case 38: // Extended fg
        if (i + 1 < parts.length) {
          if (parts[i + 1] === 5 && i + 2 < parts.length) {
            const idx = parts[i + 2];
            style.fg = idx >= 0 && idx < 256 ? ANSI_256_TO_HEX[idx] : null;
            i += 2;
          } else if (parts[i + 1] === 2 && i + 4 < parts.length) {
            const r = parts[i + 2], g = parts[i + 3], b = parts[i + 4];
            style.fg = "#" + r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0");
            i += 4;
          }
        }
        break;

      case 48: // Extended bg
        if (i + 1 < parts.length) {
          if (parts[i + 1] === 5 && i + 2 < parts.length) {
            const idx = parts[i + 2];
            style.bg = idx >= 0 && idx < 256 ? ANSI_256_TO_HEX[idx] : null;
            i += 2;
          } else if (parts[i + 1] === 2 && i + 4 < parts.length) {
            const r = parts[i + 2], g = parts[i + 3], b = parts[i + 4];
            style.bg = "#" + r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0");
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

/** Handle CSI (Control Sequence Introducer) sequences. */
export function handleCSI(params: string, final: string, state: VTermState): void {
  // Private mode sequences
  if (params.startsWith("?")) {
    handlePrivateMode(params.slice(1), final, state);
    return;
  }

  const parts = params.split(";").map(s => (s === "" ? 0 : parseInt(s, 10)));

  switch (final) {
    case "A": // Cursor Up
      state.cursorRow = Math.max(0, state.cursorRow - (parts[0] || 1));
      break;
    case "B": // Cursor Down
      state.cursorRow = Math.min(state.rows - 1, state.cursorRow + (parts[0] || 1));
      break;
    case "C": // Cursor Forward
      state.cursorCol = Math.min(state.cols - 1, state.cursorCol + (parts[0] || 1));
      break;
    case "D": // Cursor Back
      state.cursorCol = Math.max(0, state.cursorCol - (parts[0] || 1));
      break;
    case "E": // Cursor Next Line
      state.cursorRow = Math.min(state.rows - 1, state.cursorRow + (parts[0] || 1));
      state.cursorCol = 0;
      break;
    case "F": // Cursor Previous Line
      state.cursorRow = Math.max(0, state.cursorRow - (parts[0] || 1));
      state.cursorCol = 0;
      break;
    case "G": // Cursor Horizontal Absolute
      state.cursorCol = Math.min(state.cols - 1, Math.max(0, (parts[0] || 1) - 1));
      break;
    case "H": // Cursor Position
    case "f":
      state.cursorRow = Math.min(state.rows - 1, Math.max(0, (parts[0] || 1) - 1));
      state.cursorCol = Math.min(state.cols - 1, Math.max(0, (parts[1] || 1) - 1));
      break;
    case "J": // Erase in Display
      eraseInDisplay(parts[0] || 0, state);
      break;
    case "K": // Erase in Line
      eraseInLine(parts[0] || 0, state);
      break;
    case "L": { // Insert Lines
      const count = parts[0] || 1;
      for (let i = 0; i < count; i++) {
        state.buffer.splice(state.cursorRow, 0,
          Array.from({ length: state.cols }, () => emptyCell()));
        state.buffer.pop();
      }
      break;
    }
    case "M": { // Delete Lines
      const count = parts[0] || 1;
      for (let i = 0; i < count; i++) {
        state.buffer.splice(state.cursorRow, 1);
        state.buffer.push(Array.from({ length: state.cols }, () => emptyCell()));
      }
      break;
    }
    case "P": { // Delete Characters
      const count = Math.min(parts[0] || 1, state.cols - state.cursorCol);
      const row = state.buffer[state.cursorRow];
      row.splice(state.cursorCol, count);
      for (let i = 0; i < count; i++) row.push(emptyCell());
      break;
    }
    case "@": { // Insert Characters
      const count = Math.min(parts[0] || 1, state.cols - state.cursorCol);
      const row = state.buffer[state.cursorRow];
      for (let i = 0; i < count; i++) row.splice(state.cursorCol, 0, emptyCell());
      row.length = state.cols;
      break;
    }
    case "S": { // Scroll Up
      const count = parts[0] || 1;
      for (let i = 0; i < count; i++) state.scrollUp();
      break;
    }
    case "T": { // Scroll Down
      const count = parts[0] || 1;
      for (let i = 0; i < count; i++) state.reverseIndex();
      break;
    }
    case "m": // SGR
      handleSGR(params, state.style);
      break;
    case "X": { // Erase Characters
      const count = Math.min(parts[0] || 1, state.cols - state.cursorCol);
      for (let i = 0; i < count; i++) {
        if (state.cursorCol + i < state.cols) {
          state.buffer[state.cursorRow][state.cursorCol + i] = emptyCell();
        }
      }
      break;
    }
    case "d": // Vertical Position Absolute
      state.cursorRow = Math.min(state.rows - 1, Math.max(0, (parts[0] || 1) - 1));
      break;
    // Ignored sequences: r, s, u, n, c, l, h, t
    default:
      break;
  }
}

/** Handle private mode sequences (CSI ? ...). */
export function handlePrivateMode(params: string, final: string, state: VTermState): void {
  const parts = params.split(";").map(s => parseInt(s, 10));
  const mode = parts[0];

  switch (final) {
    case "h": // Set (enable)
      if (mode === 25) {
        state.cursorVisible = true;
      } else if (mode === 1049) {
        // Enter alternate screen buffer
        state.savedMainBuffer = state.buffer.map(row => row.map(c => ({ ...c })));
        state.altBuffer = state.createBuffer(state.cols, state.rows);
        state.buffer = state.altBuffer;
        state.cursorRow = 0;
        state.cursorCol = 0;
      }
      // mode 1 (app cursor keys), 7 (auto-wrap), 2004 (bracketed paste) — ignore
      break;

    case "l": // Reset (disable)
      if (mode === 25) {
        state.cursorVisible = false;
      } else if (mode === 1049) {
        // Leave alternate screen buffer
        if (state.savedMainBuffer) {
          state.buffer = state.savedMainBuffer;
          state.savedMainBuffer = null;
          state.altBuffer = null;
        }
      }
      // mode 1, 2004 — ignore
      break;
  }
}

/** Erase in Display (CSI J). */
export function eraseInDisplay(mode: number, state: VTermState): void {
  switch (mode) {
    case 0: // From cursor to end
      for (let c = state.cursorCol; c < state.cols; c++) {
        state.buffer[state.cursorRow][c] = emptyCell();
      }
      for (let r = state.cursorRow + 1; r < state.rows; r++) {
        for (let c = 0; c < state.cols; c++) {
          state.buffer[r][c] = emptyCell();
        }
      }
      break;
    case 1: // From start to cursor
      for (let r = 0; r < state.cursorRow; r++) {
        for (let c = 0; c < state.cols; c++) {
          state.buffer[r][c] = emptyCell();
        }
      }
      for (let c = 0; c <= state.cursorCol; c++) {
        state.buffer[state.cursorRow][c] = emptyCell();
      }
      break;
    case 2: // Entire screen
    case 3: // Entire screen + scrollback
      for (let r = 0; r < state.rows; r++) {
        for (let c = 0; c < state.cols; c++) {
          state.buffer[r][c] = emptyCell();
        }
      }
      break;
  }
}

/** Erase in Line (CSI K). */
export function eraseInLine(mode: number, state: VTermState): void {
  switch (mode) {
    case 0: // From cursor to end
      for (let c = state.cursorCol; c < state.cols; c++) {
        state.buffer[state.cursorRow][c] = emptyCell();
      }
      break;
    case 1: // From start to cursor
      for (let c = 0; c <= state.cursorCol; c++) {
        state.buffer[state.cursorRow][c] = emptyCell();
      }
      break;
    case 2: // Entire line
      for (let c = 0; c < state.cols; c++) {
        state.buffer[state.cursorRow][c] = emptyCell();
      }
      break;
  }
}
