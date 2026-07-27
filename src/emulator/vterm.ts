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
import { charWidth } from "../components/base.js";

// Re-export parser utilities so existing deep imports still work
export { emptyCell, cloneStyle, hexToRgb, handleSGR } from "./vterm-parser.js";

/**
 * One terminator-delimited string sequence the parser swallowed.
 *
 * Graphics protocols (kitty = APC, sixel = DCS, iTerm2 inline = OSC 1337)
 * carry their pixels in these, and none of it belongs in the cell grid. The
 * sink lets a test assert "a payload of N bytes was emitted at row R" without
 * modelling a single pixel — the only thing that is ever assertable about a
 * protocol tier.
 */
export interface GraphicsRecord {
  /** Introducer family. Superset of the graphics-carrying three so PM/SOS are logged too. */
  protocol: "osc" | "dcs" | "apc" | "pm" | "sos";
  /** Identifying head of the sequence — see CONTROL_DATA_MAX. */
  controlData: string;
  /**
   * Bytes of the whole logical transfer, introducers and terminators included.
   * For a chunked kitty transmission that is every chunk summed, not the first
   * one — see {@link isKittyContinuation}.
   */
  byteLength: number;
  /** Cursor position when the introducer arrived — where the image would land. */
  row: number;
  col: number;
  /** Escape sequences the transfer was split across. 1 for everything unchunked. */
  chunks: number;
}

/**
 * How much of a sequence's head is kept. Kitty control data and iTerm2 file
 * headers are both well under this; the rest is base64 nobody can assert on,
 * and retaining it would mean holding whole images in memory.
 */
const CONTROL_DATA_MAX = 128;

/** Ceiling on retained records so a long emulator session cannot grow without bound. */
const GRAPHICS_SINK_MAX = 256;

/**
 * Whether an APC body continues a chunked kitty transmission rather than
 * starting a new one.
 *
 * The protocol splits one image across `m=1` chunks terminated by `m=0`, and
 * only the FIRST chunk carries the control keys that identify it (`a=T`, `i=`,
 * `c=`, `r=`, `f=`); every continuation carries `m` and `q` and nothing else.
 * Recording those separately made the sink actively misleading on exactly the
 * tier it exists to observe: a full-width image is ~260 chunks, so the one
 * informative record was pushed out by GRAPHICS_SINK_MAX and `graphics()`
 * reported a successful transmission as a wall of anonymous continuations.
 * Coalescing also restores the documented meaning of `byteLength` — the size of
 * the payload, not of an arbitrary 4 KB slice of it.
 */
function isKittyContinuation(controlData: string): boolean {
  const keys = kittyKeys(controlData);
  // An `a=` key means the block names an action, i.e. it starts something.
  return keys.some(k => /^m=[01]$/.test(k)) && !keys.some(k => k.startsWith("a="));
}

/** Whether a kitty control block promises more chunks (`m=1`). */
function kittyExpectsMore(controlData: string): boolean {
  return kittyKeys(controlData).includes("m=1");
}

/**
 * Split a kitty control block into its `key=value` pairs.
 *
 * The leading `G` is the APC's protocol introducer, not part of the first key —
 * dropping it here is what keeps `m=1` findable in a continuation block
 * (`Gm=1,q=2`), where it is the first pair and carries no comma in front of it.
 */
function kittyKeys(controlData: string): string[] {
  return controlData.replace(/^G/, "").split(",");
}

/**
 * Trim a sequence body down to its identifying head.
 *
 * The three families split their control data from their payload differently:
 * DCS parameters end at the sequence's final byte (ECMA-48 0x40-0x7E) — sixel's
 * `q` in `ESC P 0;1;0 q <pixels>`; APC (kitty) uses `;` — `Ga=T,f=100;<base64>`.
 * OSC bodies are short and self-describing (`0;My Title`, `1337;File=...`), so
 * they are kept whole up to the cap.
 */
function controlDataOf(protocol: GraphicsRecord["protocol"], body: string): string {
  let head = body;
  if (protocol === "dcs") {
    const final = /[\x40-\x7e]/.exec(body);
    if (final) head = body.slice(0, final.index + 1);
  } else if (protocol === "apc") {
    const semi = body.indexOf(";");
    if (semi >= 0) head = body.slice(0, semi);
  }
  return head.slice(0, CONTROL_DATA_MAX);
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
  private _parseState: "ground" | "escape" | "csi" | "osc" | "dcs" | "apc" | "pm" | "sos" = "ground";
  private _csiBuffer = "";
  private _stringBuffer = "";
  private _stringProtocol: GraphicsRecord["protocol"] = "osc";
  private _stringStartRow = 0;
  private _stringStartCol = 0;
  private _graphics: GraphicsRecord[] = [];
  /** A chunked kitty transmission is in flight; its head is the last record. */
  private _kittyOpen = false;
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

  /**
   * String sequences (OSC/DCS/APC/PM/SOS) the parser swallowed, in arrival
   * order. Deliberately separate from the cell grid: a graphics payload must
   * never touch a cell, so this is the only place a test can see one.
   */
  graphics(): GraphicsRecord[] {
    return this._graphics.map(g => ({ ...g }));
  }

  /** Check if screen contains a string. */
  contains(str: string): boolean {
    return this.text().includes(str);
  }

  /** Find first occurrence of a string on screen. */
  find(str: string): { row: number; col: number } | null {
    for (let r = 0; r < this._rows; r++) {
      // Map string indices back to buffer columns: wide-char continuation
      // cells hold "" (0 units) and surrogate pairs hold 2 units per cell.
      let line = "";
      const colOf: number[] = [];
      for (let c = 0; c < this._cols; c++) {
        const chars = this._buffer[r][c].char;
        for (let k = 0; k < chars.length; k++) colOf.push(c);
        line += chars;
      }
      const idx = line.indexOf(str);
      if (idx >= 0) return { row: r, col: colOf[idx] };
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
      // Iterate by code point so surrogate pairs (emoji) stay intact
      const code = data.codePointAt(i)!;
      const ch = code > 0xffff ? data.slice(i, i + 2) : data[i];
      if (code > 0xffff) i++;

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
            this._beginString("osc");
          } else if (ch === "P") {
            // DCS — sixel lives here. Without this state every payload byte
            // (all >= 0x20) reached _putChar and wrapped the real UI off screen.
            this._beginString("dcs");
          } else if (ch === "_") {
            this._beginString("apc"); // kitty graphics
          } else if (ch === "^") {
            this._beginString("pm");
          } else if (ch === "X") {
            this._beginString("sos");
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

        // All five string families are consumed identically: swallow bytes
        // until ST (ESC \), plus BEL for OSC only, as xterm does.
        case "osc":
        case "dcs":
        case "apc":
        case "pm":
        case "sos": {
          const st = ch === "\\" && this._stringBuffer.endsWith("\x1b");
          const bel = ch === "\x07" && this._stringProtocol === "osc";
          if (st || bel) {
            // The ST's ESC was appended on the previous iteration; drop it.
            this._endString(st ? this._stringBuffer.slice(0, -1) : this._stringBuffer, st ? 2 : 1);
          } else {
            this._stringBuffer += ch;
          }
          break;
        }
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

  /** Enter a string-sequence state, remembering where on screen it started. */
  private _beginString(protocol: GraphicsRecord["protocol"]): void {
    this._parseState = protocol;
    this._stringProtocol = protocol;
    this._stringBuffer = "";
    this._stringStartRow = this._cursorRow;
    this._stringStartCol = this._cursorCol;
  }

  /** Leave a string-sequence state, logging it to the graphics sink. */
  private _endString(body: string, terminatorLength: number): void {
    const protocol = this._stringProtocol;
    const controlData = controlDataOf(protocol, body);
    const byteLength = 2 + body.length + terminatorLength; // ESC + introducer + body + ST/BEL

    // Fold a chunked kitty transmission back into the record that identifies
    // it. Only done when a transmission is genuinely open, so a continuation
    // whose head was never seen (a capture started mid-stream) is still
    // recorded rather than silently dropped.
    const head = this._graphics[this._graphics.length - 1];
    // `head` is non-null whenever _kittyOpen is set (it is only set just after a
    // push), but checked rather than assumed so that clearing the sink later
    // cannot turn this into a crash inside a test harness.
    if (protocol === "apc" && this._kittyOpen && head !== undefined && isKittyContinuation(controlData)) {
      head.byteLength += byteLength;
      head.chunks++;
      this._kittyOpen = kittyExpectsMore(controlData);
      this._stringBuffer = "";
      this._parseState = "ground";
      return;
    }

    this._graphics.push({
      protocol,
      controlData,
      byteLength,
      row: this._stringStartRow,
      col: this._stringStartCol,
      chunks: 1,
    });
    // Any other sequence ends whatever transmission was in flight: a chunked
    // kitty transfer must not be interrupted, so an interleaved one means the
    // stream is not what we thought and merging further chunks would corrupt
    // the record.
    this._kittyOpen = protocol === "apc" && kittyExpectsMore(controlData);
    if (this._graphics.length > GRAPHICS_SINK_MAX) this._graphics.shift();
    this._stringBuffer = "";
    this._parseState = "ground";
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
    const width = charWidth(ch.codePointAt(0) ?? 0);

    if (width === 0) {
      // Combining mark / variation selector — attach to the previous cell
      const r = this._cursorRow;
      let c = Math.min(this._cursorCol, this._cols) - 1;
      if (c >= 0 && this._buffer[r][c].char === "") c--; // skip continuation
      if (c >= 0) this._buffer[r][c].char += ch;
      return;
    }

    if (this._cursorCol + width > this._cols) {
      this._cursorCol = 0;
      this._lineFeed();
    }
    const row = this._cursorRow;
    const col = this._cursorCol;
    this._repairWideAt(row, col);
    this._buffer[row][col] = {
      char: ch,
      fg: this._style.fg,
      bg: this._style.bg,
      bold: this._style.bold,
      dim: this._style.dim,
      italic: this._style.italic,
      underline: this._style.underline,
      inverse: this._style.inverse,
    };
    if (width === 2 && col + 1 < this._cols) {
      // Continuation cell: char "" keeps text()/ansi() joins width-correct
      this._repairWideAt(row, col + 1);
      this._buffer[row][col + 1] = { ...this._buffer[row][col], char: "" };
    }
    this._cursorCol += width;
  }

  /**
   * Before overwriting (row, col), blank the orphaned half of any wide
   * char that spans this cell so the row never holds a dangling lead
   * or continuation.
   */
  private _repairWideAt(row: number, col: number): void {
    const cell = this._buffer[row][col];
    if (cell.char === "") {
      if (col > 0) this._buffer[row][col - 1] = { ...this._buffer[row][col - 1], char: " " };
    } else if (charWidth(cell.char.codePointAt(0) ?? 0) === 2 &&
               col + 1 < this._cols && this._buffer[row][col + 1].char === "") {
      this._buffer[row][col + 1] = { ...this._buffer[row][col + 1], char: " " };
    }
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
