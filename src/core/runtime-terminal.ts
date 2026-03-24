/**
 * Terminal output: writing rendered lines to stdout with
 * command mode, notifications, and cursor management.
 */
import { fgColor, reset } from "../style/colors.js";
import { renderInput } from "../components/Input.js";
import { stringWidth, charWidth, type RenderContext } from "../components/base.js";

interface RT {
  theme: any;
  borderStyle: string;
  commandMode: boolean;
  commandBuffer: string;
  feedbackMessage: string;
  inputMode: any;
  notifications: any;
}

/** ANSI-safe line truncation to prevent terminal wrapping. */
export function truncateLine(line: string, maxWidth: number): string {
  let visLen = 0;
  let result = "";
  let inEscape = false;
  for (const ch of line) {
    if (ch === "\x1b") { inEscape = true; result += ch; continue; }
    if (inEscape) { result += ch; if (ch === "m") inEscape = false; continue; }
    const cw = charWidth(ch.codePointAt(0) ?? 0);
    if (visLen + cw > maxWidth) break;
    result += ch;
    visLen += cw;
  }
  return result + "\x1b[0m";
}

/** Create the render context used by all component renderers. */
export function createRenderContext(rt: RT, width: number): RenderContext {
  return {
    width: Math.min(width, 100),
    theme: rt.theme,
    borderStyle: rt.borderStyle,
  };
}

/** Write rendered lines to the terminal. */
export function writeToTerminal(rt: RT, lines: string[], columns: number, rows: number): void {
  let output = "\x1b[H";
  for (let i = 0; i < rows; i++) {
    output += "\x1b[2K";
    if (i < lines.length) {
      const line = lines[i];
      if (stringWidth(line) > columns) output += truncateLine(line, columns);
      else output += line;
    }
    if (i < rows - 1) output += "\n";
  }

  if (rt.commandMode) {
    output += `\x1b[${rows};1H\x1b[2K`;
    output += renderInput(":", rt.commandBuffer, createRenderContext(rt, columns)).join("");
  } else {
    const notification = rt.notifications.current;
    if (notification) {
      output += `\x1b[${rows};1H\x1b[2K`;
      let color: string, icon: string;
      switch (notification.type) {
        case "success": color = rt.theme.success; icon = "\u2713"; break;
        case "error": color = rt.theme.error; icon = "\u2717"; break;
        default: color = rt.theme.accent; icon = "\u2139"; break;
      }
      output += fgColor(color) + "  " + icon + " " + notification.message + reset;
    } else if (rt.feedbackMessage) {
      output += `\x1b[${rows};1H\x1b[2K`;
      output += fgColor(rt.theme.success) + "  " + rt.feedbackMessage + reset;
    }
  }

  output += rt.inputMode.isEditing ? "\x1b[?25h" : "\x1b[?25l";
  process.stdout.write(output);
}
