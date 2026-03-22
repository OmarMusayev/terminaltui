/**
 * Screen reader — structured data extraction from Cell[][] buffer.
 *
 * Understands how terminaltui components render and can extract
 * menus, cards, links, page names, etc. from the virtual terminal.
 */

import type { VirtualTerminal } from "./vterm.js";
import type { Cell, MenuResult, CardResult, LinkResult, FindResult } from "./types.js";

// ── Character constants ────────────────────────────────────

// Menu cursor indicator
const CURSOR_CHAR = "\u276f";  // ❯

// Box-drawing corners (for card detection)
const TOP_LEFT_CHARS = ["\u256d", "\u250c", "\u2554", "\u250f", "+"];  // ╭ ┌ ╔ ┏ +
const TOP_RIGHT_CHARS = ["\u256e", "\u2510", "\u2557", "\u2513", "+"];
const BOTTOM_LEFT_CHARS = ["\u2570", "\u2514", "\u255a", "\u2517", "+"];
const BOTTOM_RIGHT_CHARS = ["\u256f", "\u2518", "\u255d", "\u251b", "+"];
const HORIZONTAL_CHARS = ["\u2500", "\u2550", "\u2501", "\u2504", "-"];  // ─ ═ ━ ╌ -
const VERTICAL_CHARS = ["\u2502", "\u2551", "\u2503", "\u2506", "|"];    // │ ║ ┃ ╵ |

// Section title underline
const SECTION_UNDERLINE = "\u2500";  // ─

// Link arrow icon
const LINK_ARROW = "\u2192";  // →

export class ScreenReader {
  private vterm: VirtualTerminal;

  constructor(vterm: VirtualTerminal) {
    this.vterm = vterm;
  }

  /** Get full screen text (ANSI stripped). */
  text(): string {
    return this.vterm.text();
  }

  /** Get full screen with ANSI codes. */
  ansi(): string {
    return this.vterm.ansi();
  }

  /** Get Cell[][] grid. */
  cells(): Cell[][] {
    return this.vterm.cells();
  }

  /** Get text in a region. */
  textAt(row: number, col: number, w: number, h: number): string {
    return this.vterm.textAt(row, col, w, h);
  }

  /** Check if screen contains text. */
  contains(str: string): boolean {
    return this.vterm.contains(str);
  }

  /** Find first occurrence of text on screen. */
  find(str: string): FindResult | null {
    return this.vterm.find(str);
  }

  /** Get cursor position. */
  cursor(): { row: number; col: number } {
    return this.vterm.cursor();
  }

  /**
   * Detect the current page/view name.
   *
   * Looks for:
   * 1. Section title pattern: bold accented text followed by ─── underline
   * 2. Page header pattern: "← back  PageTitle" followed by ──── divider
   * 3. If neither found, we're on the home page
   */
  currentPage(): string | null {
    const lines = this.getTextLines();

    // Look for page header pattern: "← back  TITLE"
    for (let i = 0; i < Math.min(lines.length, 6); i++) {
      const line = lines[i].trim();
      if (line.includes("\u2190 back")) {
        // Extract page title after "← back"
        const match = line.match(/\u2190\s*back\s+(.+)/);
        if (match) {
          // Strip any icons (emoji-like chars at start)
          const titlePart = match[1].trim();
          return titlePart;
        }
      }
    }

    // Check if on home page — look for menu pattern
    if (this.menu().items.length > 0) {
      return "home";
    }

    // Look for section titles with bold text
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 0 && !trimmed.startsWith("\u2500")) {
        // Could be a section title
        return trimmed;
      }
    }

    return null;
  }

  /**
   * Detect menu items and selection state.
   *
   * Menu format (from Menu.ts):
   *   Selected:   "  ❯ icon label [n]"
   *   Unselected: "     icon label [n]"
   *
   * The [N] suffix is the reliable marker. Icon can be emoji (multi-codepoint).
   */
  menu(): MenuResult {
    const items: string[] = [];
    let selectedIndex = -1;
    const cells = this.vterm.cells();

    for (let r = 0; r < cells.length; r++) {
      const lineText = cells[r].map(c => c.char).join("");
      const trimmed = lineText.trim();

      // Menu items always end with [N] where N is a number
      const bracketMatch = trimmed.match(/\[(\d+)\]\s*$/);
      if (!bracketMatch) continue;

      // Check for cursor indicator (❯)
      const hasCursor = trimmed.includes(CURSOR_CHAR);

      // Extract label: everything between the icon and the [N] suffix
      // Remove the [N] suffix first
      let content = trimmed.replace(/\s*\[\d+\]\s*$/, "").trim();

      // Remove cursor indicator if present
      if (content.startsWith(CURSOR_CHAR)) {
        content = content.slice(1).trim();
      }

      // The first "word" (which could be an emoji) is the icon, rest is the label
      // Split by whitespace, first element is icon, rest is label
      const parts = content.split(/\s+/);
      if (parts.length >= 2) {
        // Icon is parts[0], label is the rest
        const label = parts.slice(1).join(" ");
        if (hasCursor) {
          selectedIndex = items.length;
        }
        items.push(label);
      } else if (parts.length === 1) {
        // Only one word — it's both icon and label (unlikely but handle it)
        if (hasCursor) {
          selectedIndex = items.length;
        }
        items.push(parts[0]);
      }
    }

    return { items, selectedIndex };
  }

  /**
   * Detect cards on screen.
   *
   * Cards are bordered regions with box-drawing characters.
   * Inside: title (bold/accent), subtitle (right-aligned), body, tags [Like This].
   */
  cards(): CardResult[] {
    const results: CardResult[] = [];
    const cells = this.vterm.cells();
    const lines = this.getTextLines();

    let r = 0;
    while (r < lines.length) {
      const trimmed = lines[r].trim();

      // Look for top border of a card
      if (this.isTopBorder(trimmed)) {
        // Scan for bottom border
        let endR = r + 1;
        while (endR < lines.length) {
          const endTrimmed = lines[endR].trim();
          if (this.isBottomBorder(endTrimmed)) {
            break;
          }
          endR++;
        }

        if (endR < lines.length) {
          // Extract card content between borders
          const card = this.parseCardContent(lines.slice(r + 1, endR));
          if (card) results.push(card);
          r = endR + 1;
          continue;
        }
      }
      r++;
    }

    return results;
  }

  /**
   * Detect links on screen.
   *
   * Link formats:
   *   Focused:   "  ❯ → label  url"
   *   Unfocused: "    → label  url"
   */
  links(): LinkResult[] {
    const results: LinkResult[] = [];
    const lines = this.getTextLines();

    for (const line of lines) {
      const trimmed = line.trim();

      // Pattern: optional ❯, then icon (→ or other), then label, then URL
      // Look for arrow or similar icon followed by text and a URL-like string
      const linkMatch = trimmed.match(
        /^(?:\u276f\s+)?(?:[\u2192\u2794\u27a4\u279c]|->)\s+(.+?)\s{2,}(https?:\/\/\S+|www\.\S+|\S+\.\S+\/\S*)/
      );
      if (linkMatch) {
        results.push({
          label: linkMatch[1].trim(),
          url: linkMatch[2].trim(),
        });
      }
    }

    return results;
  }

  // ── Helpers ──────────────────────────────────────────────

  private getTextLines(): string[] {
    return this.vterm.text().split("\n");
  }

  private isTopBorder(line: string): boolean {
    if (line.length < 3) return false;
    const first = line[0];
    const last = line[line.length - 1];
    return (
      TOP_LEFT_CHARS.includes(first) &&
      TOP_RIGHT_CHARS.includes(last) &&
      this.hasHorizontalFill(line)
    );
  }

  private isBottomBorder(line: string): boolean {
    if (line.length < 3) return false;
    const first = line[0];
    const last = line[line.length - 1];
    return (
      BOTTOM_LEFT_CHARS.includes(first) &&
      BOTTOM_RIGHT_CHARS.includes(last) &&
      this.hasHorizontalFill(line)
    );
  }

  private hasHorizontalFill(line: string): boolean {
    let count = 0;
    for (const ch of line) {
      if (HORIZONTAL_CHARS.includes(ch)) count++;
    }
    return count >= 2;
  }

  private parseCardContent(lines: string[]): CardResult | null {
    let title = "";
    let subtitle: string | undefined;
    let body: string | undefined;
    const tags: string[] = [];
    const contentLines: string[] = [];

    for (const line of lines) {
      // Strip vertical border chars
      let content = line.trim();
      if (content.length > 0 && VERTICAL_CHARS.includes(content[0])) {
        content = content.slice(1);
      }
      if (content.length > 0 && VERTICAL_CHARS.includes(content[content.length - 1])) {
        content = content.slice(0, -1);
      }
      content = content.trim();
      if (content.length > 0) {
        contentLines.push(content);
      }
    }

    if (contentLines.length === 0) return null;

    // First line is title (may have ◆/◇ prefix)
    const firstLine = contentLines[0];
    const titleMatch = firstLine.match(/^[\u25c6\u25c7]?\s*(.*)/);
    title = titleMatch ? titleMatch[1].trim() : firstLine;

    // Check if title line has a subtitle (right-aligned text separated by spaces)
    const titleParts = title.split(/\s{3,}/);
    if (titleParts.length >= 2) {
      title = titleParts[0].trim();
      subtitle = titleParts[titleParts.length - 1].trim();
    }

    // Remaining lines: body text and tags
    const bodyParts: string[] = [];
    for (let i = 1; i < contentLines.length; i++) {
      const cl = contentLines[i];
      // Check for tags: [Tag Name]
      const tagMatches = cl.matchAll(/\[([^\]]+)\]/g);
      let hasTags = false;
      for (const m of tagMatches) {
        tags.push(m[1]);
        hasTags = true;
      }
      if (!hasTags) {
        bodyParts.push(cl);
      }
    }

    if (bodyParts.length > 0) {
      body = bodyParts.join(" ").trim();
    }

    return { title, subtitle, body, tags };
  }
}
