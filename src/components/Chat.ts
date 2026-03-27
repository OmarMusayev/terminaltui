/**
 * Chat component — renders a scrollable message history with input.
 * Messages are sent to an API endpoint and responses displayed inline.
 */
import { fgColor, reset, bold, dim, italic } from "../style/colors.js";
import { computeBoxDimensions, COMPONENT_DEFAULTS } from "../layout/box-model.js";
import { stringWidth, wrapText, type RenderContext } from "./base.js";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatState {
  messages: ChatMessage[];
  input: string;
  cursorPos: number;
  loading: boolean;
  error: string | null;
}

export function renderChat(
  block: {
    id: string;
    placeholder?: string;
    suggestedQuestions?: string[];
  },
  state: ChatState,
  ctx: RenderContext,
): string[] {
  const dims = computeBoxDimensions(ctx.width, { padding: 1, border: true });
  const innerWidth = dims.content;
  const lines: string[] = [];

  // Render message history
  if (state.messages.length === 0 && !state.loading) {
    // Empty state — show suggested questions
    if (block.suggestedQuestions && block.suggestedQuestions.length > 0) {
      lines.push(fgColor(ctx.theme.muted) + dim + "  Try asking:" + reset);
      for (const q of block.suggestedQuestions) {
        lines.push(fgColor(ctx.theme.subtle) + "    " + q + reset);
      }
      lines.push("");
    }
  } else {
    for (const msg of state.messages) {
      if (msg.role === "user") {
        lines.push(fgColor(ctx.theme.accent) + bold + "  You: " + reset + fgColor(ctx.theme.text) + msg.content + reset);
      } else {
        const wrapped = wrapText(msg.content, Math.max(1, innerWidth - 6));
        lines.push(fgColor(ctx.theme.muted) + bold + "  AI: " + reset + fgColor(ctx.theme.text) + wrapped[0] + reset);
        for (let i = 1; i < wrapped.length; i++) {
          lines.push("      " + fgColor(ctx.theme.text) + wrapped[i] + reset);
        }
      }
      lines.push("");
    }
  }

  // Loading indicator
  if (state.loading) {
    lines.push(fgColor(ctx.theme.accent) + "  ..." + reset);
    lines.push("");
  }

  // Error
  if (state.error) {
    lines.push(fgColor(ctx.theme.error) + "  " + state.error + reset);
    lines.push("");
  }

  // Input line
  const placeholder = block.placeholder ?? "Type a message...";
  const inputDisplay = state.input || (ctx.editing ? "" : fgColor(ctx.theme.subtle) + placeholder + reset);
  const prefix = ctx.editing
    ? fgColor(ctx.theme.accent) + bold + "  > " + reset
    : fgColor(ctx.theme.muted) + "  > " + reset;
  lines.push(prefix + inputDisplay);

  return lines;
}
