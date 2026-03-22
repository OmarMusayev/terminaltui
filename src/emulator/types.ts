/**
 * Core types for the TUI emulator.
 */

// ── Cell & Screen ──────────────────────────────────────────

export interface CellStyle {
  fg: string | null;        // hex color or null for default
  bg: string | null;        // hex color or null for default
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  inverse: boolean;
}

export interface Cell {
  char: string;
  fg: string | null;
  bg: string | null;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  inverse: boolean;
}

export interface CursorPosition {
  row: number;
  col: number;
}

// ── Launch Options ─────────────────────────────────────────

export interface LaunchOptions {
  command: string;
  args?: string[];
  cwd?: string;
  cols?: number;
  rows?: number;
  env?: Record<string, string>;
  timeout?: number;
}

// ── Screen Reader Results ──────────────────────────────────

export interface MenuResult {
  items: string[];
  selectedIndex: number;
}

export interface CardResult {
  title: string;
  subtitle?: string;
  body?: string;
  tags: string[];
}

export interface LinkResult {
  label: string;
  url: string;
}

export interface FindResult {
  row: number;
  col: number;
}

// ── Wait Options ───────────────────────────────────────────

export interface WaitOptions {
  timeout?: number;
  interval?: number;
}

// ── Press Options ──────────────────────────────────────────

export interface PressOptions {
  times?: number;
  delay?: number;
}

// ── Snapshot ───────────────────────────────────────────────

export interface Snapshot {
  text: string;
  ansi: string;
  timestamp: number;
}

// ── Recorder ──────────────────────────────────────────────

export interface RecordedAction {
  type: "press" | "type" | "wait" | "screenshot" | "assert";
  timestamp: number;
  data: Record<string, unknown>;
}

export interface RecordedScript {
  startedAt: number;
  actions: RecordedAction[];
  command: string;
  cols: number;
  rows: number;
}

// ── Reporter ──────────────────────────────────────────────

export interface TestStep {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
  screenshot?: string;
}

export interface TestReport {
  name: string;
  command: string;
  cols: number;
  rows: number;
  steps: TestStep[];
  totalDuration: number;
  passed: number;
  failed: number;
}

// ── Color lookup ──────────────────────────────────────────

/** Maps ANSI 256-color index to hex. Used by vterm to resolve colors. */
export const ANSI_256_TO_HEX: string[] = (() => {
  const table: string[] = [];

  // 0-7: standard colors
  const std = [
    "#000000", "#aa0000", "#00aa00", "#aa5500",
    "#0000aa", "#aa00aa", "#00aaaa", "#aaaaaa",
  ];
  table.push(...std);

  // 8-15: bright colors
  const bright = [
    "#555555", "#ff5555", "#55ff55", "#ffff55",
    "#5555ff", "#ff55ff", "#55ffff", "#ffffff",
  ];
  table.push(...bright);

  // 16-231: 6x6x6 color cube
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        const rv = r === 0 ? 0 : 55 + r * 40;
        const gv = g === 0 ? 0 : 55 + g * 40;
        const bv = b === 0 ? 0 : 55 + b * 40;
        table.push(
          "#" +
          rv.toString(16).padStart(2, "0") +
          gv.toString(16).padStart(2, "0") +
          bv.toString(16).padStart(2, "0")
        );
      }
    }
  }

  // 232-255: grayscale ramp
  for (let i = 0; i < 24; i++) {
    const v = 8 + i * 10;
    const hex = v.toString(16).padStart(2, "0");
    table.push(`#${hex}${hex}${hex}`);
  }

  return table;
})();

/** Maps basic ANSI color code (30-37, 90-97) to hex. */
export function ansiBasicToHex(code: number): string | null {
  // fg codes: 30-37, 90-97
  // bg codes: 40-47, 100-107 (subtract 10 to get fg equivalent)
  let idx: number;
  if (code >= 30 && code <= 37) idx = code - 30;
  else if (code >= 90 && code <= 97) idx = code - 90 + 8;
  else if (code >= 40 && code <= 47) idx = code - 40;
  else if (code >= 100 && code <= 107) idx = code - 100 + 8;
  else return null;
  return ANSI_256_TO_HEX[idx];
}
