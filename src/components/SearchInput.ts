import type { RenderContext } from "./base.js";
import type { SearchInputBlock } from "../config/types.js";
import { renderBox } from "./Box.js";
import { pad, stringWidth, truncate } from "./base.js";
import { fgColor, bold, dim, reset } from "../style/colors.js";

export interface SearchInputRenderState {
  query: string;
  cursorPos: number;
  editing: boolean;
  highlightIndex: number;
  filteredItems: { label: string; value: string }[];
}

/** Simple fuzzy match: all chars of query appear in order in target. */
function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

/** Filter items by query against label and keywords. */
export function filterSearchItems(
  items: SearchInputBlock["items"],
  query: string,
  maxResults: number,
): { label: string; value: string }[] {
  if (!query) return items.slice(0, maxResults);

  const results: { label: string; value: string; score: number }[] = [];
  for (const item of items) {
    const labelMatch = fuzzyMatch(query, item.label);
    const keywordMatch = item.keywords?.some(k => fuzzyMatch(query, k)) ?? false;
    const exactLabel = item.label.toLowerCase().includes(query.toLowerCase());

    if (labelMatch || keywordMatch) {
      // Score: exact > fuzzy label > fuzzy keyword
      const score = exactLabel ? 2 : labelMatch ? 1 : 0;
      results.push({ label: item.label, value: item.value, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults).map(r => ({ label: r.label, value: r.value }));
}

export function renderSearchInput(
  config: SearchInputBlock,
  state: SearchInputRenderState,
  ctx: RenderContext,
): string[] {
  const theme = ctx.theme;
  const lines: string[] = [];
  const isFocused = !!ctx.focused;
  const isEditing = state.editing;
  const innerWidth = Math.max(1, ctx.width - 4);

  // Label (with search icon)
  const labelText = config.label ?? "";
  const searchIcon = "\ud83d\udd0d"; // This may be 2-wide in some terminals; use text fallback
  if (labelText) {
    lines.push(fgColor(isFocused ? theme.accent : theme.text) + bold + "  " + labelText + reset);
  }

  // Build search input line
  let inputLine: string;
  if (state.query.length === 0 && !isEditing) {
    inputLine = fgColor(theme.subtle) + dim + (config.placeholder ?? "Search...") + reset;
  } else if (isEditing) {
    const pos = Math.min(state.cursorPos, state.query.length);
    const before = state.query.substring(0, pos);
    const after = state.query.substring(pos);
    inputLine =
      fgColor(theme.text) + before +
      fgColor(theme.accent) + "\u2588" + reset +
      fgColor(theme.text) + after + reset;
  } else {
    inputLine = fgColor(theme.text) + state.query + reset;
  }

  // Build content: input line + filtered results
  const contentLines: string[] = [inputLine];
  const maxResults = config.maxResults ?? 10;

  if (isEditing || state.query.length > 0 || isFocused) {
    // Show results
    const filtered = state.filteredItems;
    if (filtered.length === 0) {
      contentLines.push(fgColor(theme.subtle) + dim + "No results" + reset);
    } else {
      for (let i = 0; i < filtered.length; i++) {
        const item = filtered[i];
        const isHighlighted = i === state.highlightIndex;
        const prefix = isHighlighted ? "\u276f " : "  ";
        const itemColor = isHighlighted ? theme.accent : theme.text;
        const itemLabel = truncate(item.label, Math.max(1, innerWidth - 2));
        contentLines.push(fgColor(itemColor) + (isHighlighted ? bold : "") + prefix + itemLabel + reset);
      }
    }
  }

  const borderColor = isFocused ? theme.accent : theme.border;
  const hasSeparator = contentLines.length > 1;
  const boxLines = renderBox({
    content: contentLines,
    width: ctx.width,
    border: (ctx.borderStyle as any) ?? "rounded",
    padding: 1,
    borderColor,
    midSeparatorAfter: hasSeparator ? 0 : undefined,
  }, ctx);

  lines.push(...boxLines);
  return lines;
}
