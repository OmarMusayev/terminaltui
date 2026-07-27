/**
 * Terminal output: line-diffed frame writing with command mode,
 * notifications, and cursor management.
 *
 * writeToTerminal composes the final styled content of every terminal row,
 * diffs it against the previous frame (rt.frameState — one buffer per
 * runtime instance, i.e. per terminal stream, so concurrent SSH sessions
 * are isolated), and transmits only the rows whose final string changed.
 * Each emitted row is cursor-positioned (CUP row;1) and carries the exact
 * reset+erase+content payload the legacy full-frame writer produced, so
 * the resulting on-screen grid is identical by construction — with two
 * INTENDED deltas vs legacy, both fixes for alt-screen scroll corruption:
 *   1. bottom-row overlays (notification/feedback/command input) are
 *      truncated to the terminal width like every other row; the legacy
 *      writer appended them raw, so an over-wide overlay wrapped at the
 *      right margin and scrolled the whole alt screen;
 *   2. row-crossing control characters in overlay text are flattened to
 *      spaces at compose time, and C0 controls (except ESC) are stripped
 *      at emission, so no composed row can ever move the cursor off its
 *      row — a raw LF on the bottom row would scroll the alt screen and
 *      permanently desync the frame buffer.
 *
 * INVARIANT: any code that writes to the terminal WITHOUT going through
 * writeToTerminal (onError fallbacks, exit messages, terminal restore)
 * MUST call rt.invalidateFrame() so the next frame is a full redraw —
 * otherwise the diff is taken against a buffer the screen no longer shows.
 */
import { fgColor, reset } from "../style/colors.js";
import { renderInput } from "../components/Input.js";
import { stringWidth, cutToWidth, type RenderContext } from "../components/base.js";
import type { RuntimeInternal } from "./runtime-internal.js";
import { contentWidth } from "./layout-constants.js";
import { videoActive } from "../video/player.js";

/** ANSI-safe line truncation to prevent terminal wrapping. */
export function truncateLine(line: string, maxWidth: number): string {
  return cutToWidth(line, maxWidth).cut + "\x1b[0m";
}

/**
 * Row-crossing control characters (CR, LF, VT, FF). Overlay text is
 * arbitrary app/error string data (e.g. a thrown Error's multi-line
 * message), and charWidth() treats controls as 0-wide, so the truncation
 * guard alone cannot stop a raw LF from reaching the bottom row — where it
 * scrolls the alt screen and permanently desyncs the frame buffer. Flattened
 * to spaces at compose time (same precedent as the "Blocked:" feedback in
 * runtime-pages.ts, which keeps only the first line).
 */
const ROW_CROSSING_CONTROLS = /[\r\n\v\f]/g;

/**
 * C0 controls other than ESC (\x1b, which introduces SGR/CSI), plus DEL.
 * These never occur in legitimately composed rows; stripping them at
 * emission is defense in depth so no payload can move the cursor off its
 * row regardless of what a renderer composed.
 */
const C0_EXCEPT_ESC = /[\x00-\x1a\x1c-\x1f\x7f]/g;

/** Create the render context used by all component renderers. */
export function createRenderContext(rt: RuntimeInternal, width: number): RenderContext {
  return {
    width: contentWidth(width),
    theme: rt.theme,
    borderStyle: rt.borderStyle,
  };
}

/** Write rendered lines to the terminal, transmitting only changed rows. */
export function writeToTerminal(rt: RuntimeInternal, lines: string[], columns: number, rows: number): void {
  // ── Phase 1: compose ────────────────────────────────────────────────
  // frameRows[i] is the final styled content of terminal row i+1, stored
  // UNTRUNCATED — truncation is a pure function of (line, columns), so
  // equal untruncated strings imply equal emitted bytes. Lines beyond
  // `rows` are dropped (same bound as the legacy writer's loop).
  const frameRows: string[] = new Array<string>(rows);
  for (let i = 0; i < rows; i++) frameRows[i] = i < lines.length ? lines[i] : "";

  // Bottom-row overlay, with the same precedence the legacy writer used
  // when painting over the last row: command input > notification >
  // feedback. The legacy overwrite (CUP rows;1 + EL + overlay) left only
  // the overlay visible on that row, so composing it directly is
  // grid-identical.
  if (rows > 0) {
    if (rt.commandMode) {
      const buffer = rt.commandBuffer.replace(ROW_CROSSING_CONTROLS, " ");
      frameRows[rows - 1] = renderInput(":", buffer, createRenderContext(rt, columns)).join("");
    } else {
      const notification = rt.notifications.current;
      if (notification) {
        let color: string, icon: string;
        switch (notification.type) {
          case "success": color = rt.theme.success; icon = "✓"; break;
          case "error": color = rt.theme.error; icon = "✗"; break;
          default: color = rt.theme.accent; icon = "ℹ"; break;
        }
        const message = notification.message.replace(ROW_CROSSING_CONTROLS, " ");
        frameRows[rows - 1] = fgColor(color) + "  " + icon + " " + message + reset;
      } else if (rt.feedbackMessage) {
        const feedback = rt.feedbackMessage.replace(ROW_CROSSING_CONTROLS, " ");
        frameRows[rows - 1] = fgColor(rt.theme.success) + "  " + feedback + reset;
      }
    }
  }

  // ── Phase 1b: settle kitty placements against the composed frame ────
  // `frameRows` is the first point at which "is this image on screen" has an
  // answer: the page is composed in full and only then sliced to the viewport,
  // so `renderBlock` — and therefore `graphicsPlace` — runs for blocks that
  // scrolled away. Committing here is what keeps a gallery page from pushing a
  // full transmission for every image it holds on the first paint.
  rt.graphicsCommit(frameRows);

  // ── Phase 2: diff + emit ────────────────────────────────────────────
  const fs = rt.frameState;
  const fullRedraw = !fs.valid || fs.columns !== columns || fs.rowCount !== rows;

  let body = "";
  for (let i = 0; i < rows; i++) {
    // Compare the FINAL styled strings — SGR-only changes (theme swap,
    // focus highlight) therefore count as changes, as grid identity
    // requires.
    if (!fullRedraw && frameRows[i] === fs.rows[i]) continue;
    // Strip stray C0 controls (defense in depth; a pure function of the
    // composed string, so composed-string equality above still implies
    // emitted-byte equality).
    const line = frameRows[i].replace(C0_EXCEPT_ESC, "");
    // CUP row;1, then the exact reset+erase prefix and (truncated iff too
    // wide) payload the legacy full-frame writer put on this row.
    body += `\x1b[${i + 1};1H\x1b[0m\x1b[2K`;
    body += stringWidth(line) > columns ? truncateLine(line, columns) : line;
  }

  const wantCursor = rt.inputMode.isEditing;
  let out = "";

  if (body.length > 0) {
    // Synchronized output (DEC private mode 2026), but ONLY while a video is
    // playing.
    //
    // The rows above are emitted one CUP at a time, so a terminal is free to
    // repaint between any two of them. For a still page nobody notices — the
    // rows that changed are a menu item and a status line. For a moving
    // picture where every row changes every frame it is a visible horizontal
    // tear: the top of the frame is drawn from frame N and the bottom from
    // frame N+1, photographed and confirmed on the cinema demo before this
    // existed. BSU/ESU tells the terminal to buffer the whole batch and swap
    // it atomically.
    //
    // Gated rather than unconditional because it must not perturb the byte
    // budgets every existing test asserts on: with no video playing the output
    // is byte-identical to what it was. Terminals that do not implement 2026
    // (Apple Terminal among them) ignore both sequences as unknown private
    // modes, so the cost of asking is 16 bytes a frame and the failure mode is
    // the tearing we already had.
    const sync = videoActive(rt);
    if (sync) out += "\x1b[?2026h";
    // Hide-while-painting when the cursor should end up visible, so it
    // doesn't visibly hop across rows mid-frame.
    if (wantCursor) out += "\x1b[?25l";
    out += body;
    // Park at the legacy end position: just after the visible bottom-row
    // content (the legacy writer's last byte landed there). Width is taken
    // on the composed content, capped at the terminal width.
    const parkCol = Math.min(columns, stringWidth(frameRows[rows - 1] ?? "")) + 1;
    out += `\x1b[${rows};${parkCol}H`;
    if (wantCursor) out += "\x1b[?25h";
    else if (fullRedraw || fs.cursorShown) out += "\x1b[?25l";
    // Closes the batch. Emitted LAST so the cursor park and the visibility
    // toggle land inside the same atomic swap as the rows.
    if (sync) out += "\x1b[?2026l";
  } else if (fullRedraw) {
    // Degenerate (rows === 0) full redraw: still assert DECTCEM —
    // restore paths may have clobbered it out-of-band.
    out += wantCursor ? "\x1b[?25h" : "\x1b[?25l";
  } else if (wantCursor !== fs.cursorShown) {
    // Zero-change frame with a cursor-visibility flip: emit only the toggle.
    out += wantCursor ? "\x1b[?25h" : "\x1b[?25l";
  }

  // Store the composed frame (rebuilt fresh each call — no aliasing).
  fs.rows = frameRows;
  fs.columns = columns;
  fs.rowCount = rows;
  fs.cursorShown = wantCursor;
  fs.valid = true;

  if (out.length > 0) rt.writeOutput(out);
}
