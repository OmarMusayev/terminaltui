import type { RenderContext } from "./base.js";
import { fgColor, reset } from "../style/colors.js";

export interface ScrollState {
  offset: number;
  totalLines: number;
  visibleLines: number;
}

export function renderScrollView(content: string[], visibleHeight: number, scrollOffset: number, ctx: RenderContext): { lines: string[]; scrollState: ScrollState } {
  const total = content.length;
  const visible = Math.min(visibleHeight, total);
  const offset = Math.max(0, Math.min(scrollOffset, total - visible));

  const visibleContent = content.slice(offset, offset + visible);

  // Add scroll indicator on the right edge
  const theme = ctx.theme;
  const lines: string[] = [];

  lines.push(...visibleContent);

  return {
    lines,
    scrollState: { offset, totalLines: total, visibleLines: visible },
  };
}

export function scrollUp(state: ScrollState, amount: number = 1): number {
  return Math.max(0, state.offset - amount);
}

export function scrollDown(state: ScrollState, amount: number = 1): number {
  return Math.min(state.totalLines - state.visibleLines, state.offset + amount);
}
