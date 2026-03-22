import type { Site, SiteConfig, PageConfig, ContentBlock } from "../config/types.js";
import { themes, defaultTheme, type Theme, type BuiltinThemeName } from "../style/theme.js";
import { fgColor, reset, bold, dim, italic, setColorMode } from "../style/colors.js";
import { gradientLines } from "../style/gradient.js";
import type { BorderStyle } from "../style/borders.js";
import { detectTerminal } from "../helpers/detect-terminal.js";
import { input, type KeyPress } from "./input.js";
import { screen, getScreenSize } from "./screen.js";
import { eventBus } from "./events.js";
import { Router } from "../navigation/router.js";
import { FocusManager } from "../navigation/focus.js";
import { keyToAction } from "../navigation/keybindings.js";
import { renderBanner, centerBanner } from "../ascii/banner.js";
import { animationEngine } from "../animation/engine.js";
import { createTypingAnimation } from "../animation/typing.js";
import { createStaggerAnimation } from "../animation/stagger.js";
import { getSpinnerFrame } from "../animation/spinner.js";
import { getTransitionFrameCount } from "../animation/transition.js";
// Component renderers
import { renderMenu, type MenuItem } from "../components/Menu.js";
import { renderText } from "../components/Text.js";
import { renderCard } from "../components/Card.js";
import { renderTimeline } from "../components/Timeline.js";
import { renderProgressBar } from "../components/ProgressBar.js";
import { renderTable } from "../components/Table.js";
import { renderLink } from "../components/Link.js";
import { renderDivider } from "../components/Divider.js";
import { renderSpacer } from "../components/Spacer.js";
import { renderQuote } from "../components/Quote.js";
import { renderBadge } from "../components/Badge.js";
import { renderHero } from "../components/Hero.js";
import { renderList } from "../components/List.js";
import { renderImage } from "../components/Image.js";
import { renderAccordion } from "../components/Accordion.js";
import { renderTabs } from "../components/Tabs.js";
import { renderGallery } from "../components/Gallery.js";
import { renderScrollView, scrollUp, scrollDown, type ScrollState } from "../components/ScrollView.js";
import { renderInput } from "../components/Input.js";
import { renderBox } from "../components/Box.js";
import { stripAnsi, pad, stringWidth, charWidth, wrapText, type RenderContext } from "../components/base.js";
import { openUrl } from "../helpers/open-url.js";

/** A focusable item on a content page. */
type FocusItem =
  | { kind: "block"; block: ContentBlock }
  | { kind: "accordion-item"; accordion: ContentBlock & { type: "accordion" }; itemIndex: number }
  | { kind: "timeline-item"; timeline: ContentBlock & { type: "timeline" }; itemIndex: number };

/** ANSI-safe line truncation to prevent terminal wrapping. */
function truncateLine(line: string, maxWidth: number): string {
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

export class TUIRuntime {
  private site: SiteConfig;
  private theme: Theme;
  private router: Router;
  private focus: FocusManager;
  private borderStyle: BorderStyle;
  private scrollOffset = 0;
  private commandMode = false;
  private commandBuffer = "";
  private feedbackMessage = "";
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  // State for interactive components
  private accordionState: Map<string, number> = new Map();
  private tabState: Map<string, number> = new Map();
  private galleryState: Map<string, number> = new Map();
  // Content page item-based focus navigation
  private pageFocusIndex = 0;
  private pageFocusItems: FocusItem[] = [];
  private pageScrollOffset = 0;
  // Animation state
  private bootComplete = false;
  private bootFrame = 0;
  private bootTimer: ReturnType<typeof setInterval> | null = null;

  constructor(site: Site) {
    this.site = site.config;
    this.theme = this.resolveTheme(site.config.theme);
    this.borderStyle = site.config.borders ?? "rounded";
    this.router = new Router();
    this.focus = new FocusManager();

    // Register pages
    const pageIds = site.config.pages.map(p => p.id);
    this.router.registerPages(pageIds);

    // Set up menu focus
    this.focus.setItems(pageIds);
  }

  private resolveTheme(theme?: Theme | BuiltinThemeName): Theme {
    if (!theme) return defaultTheme;
    if (typeof theme === "string") return themes[theme] ?? defaultTheme;
    return theme;
  }

  async start(): Promise<void> {
    // Detect terminal capabilities and sync color mode
    const caps = detectTerminal();
    setColorMode(caps.colorDepth);

    // Set up terminal
    this.setupTerminal();

    // Handle resize
    screen.on("resize", () => this.render());

    // Handle input
    input.on("keypress", (key: KeyPress) => this.handleKey(key));
    input.start();

    // Boot animation or direct render
    if (this.site.animations?.boot) {
      this.runBootAnimation();
    } else {
      this.bootComplete = true;
      this.render();
    }
  }

  private setupTerminal(): void {
    // Alternate screen buffer
    process.stdout.write("\x1b[?1049h");
    // Hide cursor
    process.stdout.write("\x1b[?25l");
    // Clear screen
    process.stdout.write("\x1b[2J");
    process.stdout.write("\x1b[H");

    // Handle cleanup on exit signals
    const cleanup = () => this.cleanup();
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
    process.on("uncaughtException", (err) => {
      this.cleanup();
      console.error(err);
      process.exit(1);
    });
  }

  private cleanup(): void {
    input.stop();
    animationEngine.stop();
    if (this.bootTimer) clearInterval(this.bootTimer);
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    // Show cursor
    process.stdout.write("\x1b[?25h");
    // Exit alternate screen
    process.stdout.write("\x1b[?1049l");
    // Reset colors
    process.stdout.write("\x1b[0m");
  }

  async stop(): Promise<void> {
    // Exit animation
    if (this.site.animations?.exitMessage) {
      const { columns, rows } = getScreenSize();
      process.stdout.write("\x1b[2J\x1b[H");
      const msg = this.site.animations.exitMessage;
      const y = Math.floor(rows / 2);
      const x = Math.max(0, Math.floor((columns - stringWidth(msg)) / 2));
      process.stdout.write(`\x1b[${y};${x}H`);
      process.stdout.write(fgColor(this.theme.accent) + bold + msg + reset);
      await new Promise(r => setTimeout(r, 800));
    }

    this.cleanup();
    process.exit(0);
  }

  private runBootAnimation(): void {
    this.bootComplete = false;
    this.bootFrame = 0;
    const totalFrames = 30; // ~1 second at 30fps

    this.bootTimer = setInterval(() => {
      this.bootFrame++;
      this.render();

      if (this.bootFrame >= totalFrames) {
        if (this.bootTimer) clearInterval(this.bootTimer);
        this.bootTimer = null;
        this.bootComplete = true;
        this.render();
      }
    }, 33);
  }

  private handleKey(key: KeyPress): void {
    // Command mode handling
    if (this.commandMode) {
      if (key.name === "escape") {
        this.commandMode = false;
        this.commandBuffer = "";
        this.render();
        return;
      }
      if (key.name === "return") {
        this.executeCommand(this.commandBuffer);
        this.commandMode = false;
        this.commandBuffer = "";
        this.render();
        return;
      }
      if (key.name === "backspace") {
        this.commandBuffer = this.commandBuffer.slice(0, -1);
        this.render();
        return;
      }
      if (key.char && key.char.length === 1 && !key.ctrl) {
        this.commandBuffer += key.char;
        this.render();
        return;
      }
      return;
    }

    const isHome = this.router.isHome();
    const action = keyToAction(key, isHome);

    if (!action) return;

    switch (action) {
      case "quit":
        this.stop();
        break;

      case "back":
        if (this.router.back()) {
          this.scrollOffset = 0;
          this.pageFocusIndex = 0;
          this.pageScrollOffset = 0;
          this.pageFocusItems = [];
          this.render();
        }
        break;

      case "up":
        if (this.router.isHome()) {
          this.focus.focusPrev();
        } else {
          this.pageFocusPrev();
        }
        this.render();
        break;

      case "down":
        if (this.router.isHome()) {
          this.focus.focusNext();
        } else {
          this.pageFocusNext();
        }
        this.render();
        break;

      case "select":
      case "right":
        if (this.router.isHome()) {
          const focusedId = this.focus.focusedId;
          if (focusedId) {
            this.router.navigate(focusedId);
            this.scrollOffset = 0;
            this.enterPage();
          }
        } else {
          this.handlePageSelect();
        }
        this.render();
        break;

      case "home":
        if (!this.router.isHome()) {
          this.pageFocusIndex = 0;
          this.pageScrollOffset = 0;
        }
        this.render();
        break;

      case "pageDown":
        if (!this.router.isHome() && this.pageFocusItems.length > 0) {
          this.pageFocusIndex = this.pageFocusItems.length - 1;
        }
        this.render();
        break;

      case "command":
        this.commandMode = true;
        this.commandBuffer = "";
        this.render();
        break;

      default:
        // Number jumps
        if (action.startsWith("jump")) {
          const num = parseInt(action.replace("jump", ""));
          if (this.router.isHome()) {
            const idx = num - 1;
            if (idx < this.focus.count) {
              this.focus.focusIndex = idx;
              const pageId = this.router.getPageId(idx);
              if (pageId) {
                this.router.navigate(pageId);
                this.scrollOffset = 0;
                this.enterPage();
              }
            }
          }
          this.render();
        }
        break;
    }
  }

  /** Initialize page focus when entering a page. */
  private enterPage(): void {
    this.pageFocusIndex = 0;
    this.pageScrollOffset = 0;
    this.pageFocusItems = [];
    const currentPage = this.getCurrentPage();
    if (!currentPage) return;
    this.pageFocusItems = this.collectFocusItems(currentPage.content);
  }

  /** Recursively collect focusable items. Accordion items are expanded individually. */
  private collectFocusItems(blocks: ContentBlock[]): FocusItem[] {
    const result: FocusItem[] = [];
    for (const block of blocks) {
      switch (block.type) {
        case "card":
        case "link":
        case "hero":
          result.push({ kind: "block", block });
          break;
        case "accordion":
          for (let i = 0; i < block.items.length; i++) {
            result.push({ kind: "accordion-item", accordion: block, itemIndex: i });
          }
          break;
        case "timeline":
          for (let i = 0; i < block.items.length; i++) {
            result.push({ kind: "timeline-item", timeline: block, itemIndex: i });
          }
          break;
        case "tabs":
          result.push({ kind: "block", block });
          break;
        case "section":
          result.push(...this.collectFocusItems(block.content));
          break;
      }
    }
    return result;
  }

  /** Move focus to next item. */
  private pageFocusNext(): void {
    if (this.pageFocusItems.length === 0) return;
    if (this.pageFocusIndex < this.pageFocusItems.length - 1) {
      this.pageFocusIndex++;
    }
  }

  /** Move focus to previous item. */
  private pageFocusPrev(): void {
    if (this.pageFocusItems.length === 0) return;
    if (this.pageFocusIndex > 0) {
      this.pageFocusIndex--;
    }
  }

  /** Handle enter/select on the currently focused item. */
  private handlePageSelect(): void {
    const item = this.pageFocusItems[this.pageFocusIndex];
    if (!item) return;

    if (item.kind === "accordion-item") {
      // Toggle this accordion item open/closed
      const acc = item.accordion;
      const accKey = acc.items.map(i => i.label).join(",");
      const current = this.accordionState.get(accKey) ?? -1;
      // If this item is already open, close it. Otherwise open it.
      this.accordionState.set(accKey, current === item.itemIndex ? -1 : item.itemIndex);
      return;
    }

    if (item.kind === "timeline-item") {
      // Timeline items are display-only — no action on Enter
      return;
    }

    const block = item.block;

    if (block.type === "link") {
      this.showFeedback(`Opening ${block.url}...`);
      openUrl(block.url).catch(() => {});
      return;
    }

    if (block.type === "card" && block.url) {
      this.showFeedback(`Opening ${block.url}...`);
      openUrl(block.url).catch(() => {});
      return;
    }

    if (block.type === "tabs") {
      const tabKey = block.items.map(i => i.label).join(",");
      const current = this.tabState.get(tabKey) ?? 0;
      this.tabState.set(tabKey, (current + 1) % block.items.length);
      return;
    }

    if (block.type === "hero" && block.cta?.url) {
      this.showFeedback(`Opening ${block.cta.url}...`);
      openUrl(block.cta.url).catch(() => {});
      return;
    }
  }

  private findLinks(blocks: ContentBlock[]): { label: string; url: string }[] {
    const links: { label: string; url: string }[] = [];
    for (const block of blocks) {
      if (block.type === "link") {
        links.push({ label: block.label, url: block.url });
      } else if (block.type === "card" && block.url) {
        links.push({ label: block.title, url: block.url });
      } else if (block.type === "section") {
        links.push(...this.findLinks(block.content));
      }
    }
    return links;
  }

  private getCurrentPage(): PageConfig | undefined {
    return this.site.pages.find(p => p.id === this.router.currentPage);
  }

  private showFeedback(msg: string): void {
    this.feedbackMessage = msg;
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => {
      this.feedbackMessage = "";
      this.render();
    }, 2000);
    this.render();
  }

  private executeCommand(cmd: string): void {
    const trimmed = cmd.trim().toLowerCase();

    if (trimmed === "q" || trimmed === "quit") {
      this.stop();
      return;
    }

    if (trimmed.startsWith("theme ")) {
      const themeName = trimmed.slice(6).trim() as BuiltinThemeName;
      if (themes[themeName]) {
        this.theme = themes[themeName];
        this.showFeedback(`Theme: ${themeName}`);
      } else {
        this.showFeedback(`Unknown theme: ${themeName}`);
      }
      return;
    }

    // Easter egg commands
    if (this.site.easterEggs?.commands?.[trimmed]) {
      const action = this.site.easterEggs.commands[trimmed];
      if (typeof action === "string") {
        this.showFeedback(action);
      } else {
        action();
      }
      return;
    }

    this.showFeedback(`Unknown command: ${cmd}`);
  }

  // ─── RENDERING ───────────────────────────────────────────

  private render(): void {
    const { columns, rows } = getScreenSize();
    const lines: string[] = [];
    const ctx = this.createRenderContext(columns);

    if (this.router.isHome()) {
      this.renderHomePage(lines, ctx, columns, rows);
    } else {
      this.renderContentPage(lines, ctx, columns, rows);
    }

    // Write to terminal
    this.writeToTerminal(lines, columns, rows);
  }

  private createRenderContext(width: number): RenderContext {
    return {
      width: Math.min(width, 100), // cap content width
      theme: this.theme,
      borderStyle: this.borderStyle,
    };
  }

  private renderHomePage(lines: string[], ctx: RenderContext, columns: number, rows: number): void {
    const contentWidth = ctx.width;
    const leftPad = Math.max(0, Math.floor((columns - contentWidth) / 2));
    const padStr = " ".repeat(leftPad);

    // Banner
    if (this.site.banner) {
      let bannerLines = renderBanner(this.site.banner.text, {
        font: this.site.banner.font,
      });
      bannerLines = centerBanner(bannerLines, contentWidth);

      if (this.site.banner.gradient) {
        bannerLines = gradientLines(bannerLines, this.site.banner.gradient);
      } else {
        bannerLines = bannerLines.map(l => fgColor(this.theme.accent) + l + reset);
      }

      // Boot animation: reveal banner progressively
      if (!this.bootComplete && this.site.animations?.boot) {
        const revealLines = Math.floor((this.bootFrame / 30) * bannerLines.length);
        bannerLines = bannerLines.slice(0, revealLines);
      }

      lines.push("");
      for (const bl of bannerLines) {
        lines.push(padStr + bl);
      }
    } else {
      lines.push("");
      const nameStr = fgColor(this.theme.accent) + bold + this.site.name + reset;
      lines.push(padStr + pad(nameStr, contentWidth, "center"));
    }

    lines.push("");

    // Tagline
    if (this.site.tagline) {
      const tagStr = fgColor(this.theme.muted) + italic + this.site.tagline + reset;
      lines.push(padStr + pad(tagStr, contentWidth, "center"));
      lines.push("");
    }

    // Divider
    lines.push(padStr + fgColor(this.theme.border) + "\u2500".repeat(contentWidth) + reset);
    lines.push("");

    // Menu
    const menuItems: MenuItem[] = this.site.pages.map(p => ({
      label: p.title,
      icon: p.icon,
      id: p.id,
    }));

    let menuLines: string[];

    if (!this.bootComplete && this.site.animations?.boot) {
      // Stagger menu items during boot
      const visibleCount = Math.max(0, Math.floor((this.bootFrame - 15) / 3));
      const visibleItems = menuItems.slice(0, visibleCount);
      menuLines = renderMenu(visibleItems, this.focus.focusIndex, ctx);
    } else {
      menuLines = renderMenu(menuItems, this.focus.focusIndex, ctx);
    }

    for (const ml of menuLines) {
      lines.push(padStr + ml);
    }

    // Footer / hints
    lines.push("");
    lines.push(padStr + fgColor(this.theme.border) + "\u2500".repeat(contentWidth) + reset);
    lines.push("");

    const hints = fgColor(this.theme.subtle) + dim +
      "  \u2191\u2193 navigate  \u23ce select  q quit  : command" + reset;
    lines.push(padStr + hints);

    // Handle
    if (this.site.handle) {
      lines.push("");
      lines.push(padStr + fgColor(this.theme.subtle) + dim + "  " + this.site.handle + reset);
    }
  }

  private renderContentPage(lines: string[], ctx: RenderContext, columns: number, rows: number): void {
    const currentPage = this.getCurrentPage();
    if (!currentPage) return;

    // Ensure page focus is initialized
    if (this.pageFocusItems.length === 0 && currentPage.content.length > 0) {
      this.enterPage();
    }

    const contentWidth = ctx.width;
    const leftPad = Math.max(0, Math.floor((columns - contentWidth) / 2));
    const padStr = " ".repeat(leftPad);
    const currentFocus = this.pageFocusItems[this.pageFocusIndex] as FocusItem | undefined;

    // ── Single pass: render all content, track focused item position ──
    const allContentLines: string[] = [];
    let focusedLineStart = -1;
    let focusedLineEnd = -1;

    // Helper: check if a block is the focused one (for simple blocks)
    const isBlockFocused = (block: ContentBlock): boolean => {
      return !!currentFocus && currentFocus.kind === "block" && currentFocus.block === block;
    };

    // Helper: get the focused accordion item index for a specific accordion block (-1 if not focused)
    const focusedAccordionItemIdx = (block: ContentBlock): number => {
      if (!currentFocus || currentFocus.kind !== "accordion-item") return -1;
      if (currentFocus.accordion !== block) return -1;
      return currentFocus.itemIndex;
    };

    const indicator = fgColor(this.theme.accent) + "\u258c" + reset;

    const renderBlocksRecursive = (blocks: ContentBlock[]) => {
      for (const block of blocks) {
        if (block.type === "section") {
          allContentLines.push(fgColor(ctx.theme.accent) + bold + "  " + block.title + reset);
          allContentLines.push(fgColor(ctx.theme.border) + "  " + "\u2500".repeat(Math.max(0, contentWidth - 4)) + reset);
          allContentLines.push("");
          renderBlocksRecursive(block.content);
        } else if (block.type === "accordion") {
          // Render each accordion item individually with per-item focus
          const accFocusIdx = focusedAccordionItemIdx(block);
          const accKey = block.items.map(i => i.label).join(",");
          const openIdx = this.accordionState.get(accKey) ?? -1;

          for (let ai = 0; ai < block.items.length; ai++) {
            const item = block.items[ai];
            const isItemFocused = accFocusIdx === ai;
            const isItemOpen = ai === openIdx;

            if (isItemFocused) focusedLineStart = allContentLines.length;

            // Render the accordion item header
            const arrow = isItemOpen ? "\u25be" : "\u25b8";
            const labelColor = isItemOpen || isItemFocused ? ctx.theme.accent : ctx.theme.text;
            const maxLabelW = Math.max(0, contentWidth - 8);
            const headerLine = fgColor(labelColor) + bold + `  ${arrow} ${item.label.length > maxLabelW ? item.label.substring(0, maxLabelW - 1) + "\u2026" : item.label}` + reset;

            if (isItemFocused) {
              allContentLines.push(indicator + headerLine);
            } else {
              allContentLines.push(" " + headerLine);
            }

            // If this item is open, render its content
            if (isItemOpen) {
              const contentCtx = { ...ctx, width: ctx.width - 4, focused: false };
              for (const cb of item.content) {
                const rendered = this.renderBlock(cb, contentCtx);
                for (const rl of rendered) {
                  allContentLines.push("     " + rl);
                }
              }
              allContentLines.push("");
            }

            if (isItemFocused) focusedLineEnd = allContentLines.length;
          }
        } else if (block.type === "timeline") {
          // Render each timeline item individually with per-item focus
          const tlFocusIdx = currentFocus?.kind === "timeline-item" && currentFocus.timeline === block
            ? currentFocus.itemIndex : -1;

          for (let ti = 0; ti < block.items.length; ti++) {
            const item = block.items[ti];
            const isItemFocused = tlFocusIdx === ti;
            const isFirst = ti === 0;
            const isLast = ti === block.items.length - 1;

            if (isItemFocused) focusedLineStart = allContentLines.length;

            // Filled ● when focused, empty ○ when not
            const dot = isItemFocused ? "\u25cf" : "\u25cb";
            const maxCW = Math.max(0, contentWidth - 6);
            let titleStr = item.title;
            if (item.subtitle) titleStr += " \u00b7 " + item.subtitle;
            const dotColor = isItemFocused ? ctx.theme.accent : ctx.theme.border;
            const titleColor = isItemFocused ? ctx.theme.accent : ctx.theme.text;
            const dotLine = fgColor(dotColor) + "  " + dot + " " + reset + fgColor(titleColor) + bold + titleStr + reset;
            allContentLines.push(" " + dotLine);

            // Period/date
            if ((item as any).period || (item as any).date) {
              const period = (item as any).period ?? (item as any).date;
              allContentLines.push(" " + fgColor(ctx.theme.border) + "  \u2502 " + reset + fgColor(ctx.theme.muted) + dim + period + reset);
            }

            // Description
            if (item.description) {
              const wrapped = wrapText(item.description, Math.max(0, contentWidth - 6));
              for (const wl of wrapped) {
                allContentLines.push(" " + fgColor(ctx.theme.border) + "  \u2502 " + reset + fgColor(ctx.theme.text) + wl + reset);
              }
            }

            // Connector between items
            if (!isLast) {
              allContentLines.push(" " + fgColor(ctx.theme.border) + "  \u2502" + reset);
            }

            if (isItemFocused) focusedLineEnd = allContentLines.length;
          }
        } else {
          const focused = isBlockFocused(block);
          if (focused) focusedLineStart = allContentLines.length;

          const blockIsFocusable = ["card", "link", "hero", "tabs"].includes(block.type);
          const focusCtx = focused ? { ...ctx, focused: true } : ctx;
          const rendered = this.renderBlock(block, focusCtx);

          if (blockIsFocusable && focused) {
            for (const line of rendered) {
              allContentLines.push(indicator + line);
            }
          } else {
            for (const line of rendered) {
              allContentLines.push(" " + line);
            }
          }

          if (focused) focusedLineEnd = allContentLines.length;
        }

        allContentLines.push(""); // spacing between blocks
      }
    };

    renderBlocksRecursive(currentPage.content);

    // Remove trailing empty line
    if (allContentLines.length > 0 && allContentLines[allContentLines.length - 1] === "") {
      allContentLines.pop();
    }

    // ── Adjust scroll BEFORE building display ──
    // Available viewport height for content: total rows - header(4) - footer(3)
    const headerLines = 4; // empty + "← back  Title" + ─── + empty
    const footerLines = 3; // empty + ─── + hints
    const viewportHeight = Math.max(1, rows - headerLines - footerLines);

    if (focusedLineStart >= 0) {
      const blockHeight = focusedLineEnd - focusedLineStart;
      // If focused block is above viewport, scroll up to show it
      if (focusedLineStart < this.pageScrollOffset) {
        this.pageScrollOffset = Math.max(0, focusedLineStart);
      }
      // If focused block is below viewport, scroll down to show it
      else if (focusedLineEnd > this.pageScrollOffset + viewportHeight) {
        this.pageScrollOffset = Math.max(0, focusedLineEnd - viewportHeight);
      }
    }

    // Clamp scroll
    const maxScroll = Math.max(0, allContentLines.length - viewportHeight);
    this.pageScrollOffset = Math.min(this.pageScrollOffset, maxScroll);

    // ── Count items above/below for scroll indicators ──
    let itemsAbove = 0;
    let itemsBelow = 0;
    if (this.pageFocusItems.length > 0) {
      itemsAbove = this.pageFocusIndex;
      itemsBelow = this.pageFocusItems.length - 1 - this.pageFocusIndex;
    }

    // ── Build header ──
    lines.push("");
    const backHint = fgColor(this.theme.subtle) + dim + "\u2190 back" + reset;
    const pageTitle = fgColor(this.theme.accent) + bold +
      (currentPage.icon ? currentPage.icon + " " : "") +
      currentPage.title + reset;
    lines.push(padStr + backHint + "  " + pageTitle);
    lines.push(padStr + fgColor(this.theme.border) + "\u2500".repeat(contentWidth) + reset);

    // Scroll-up indicator (replaces the empty line after header)
    if (this.pageScrollOffset > 0 && itemsAbove > 0) {
      lines.push(padStr + fgColor(this.theme.subtle) + dim + "  \u2191 " + itemsAbove + " item" + (itemsAbove > 1 ? "s" : "") + " above" + reset);
    } else {
      lines.push("");
    }

    // ── Slice content to viewport ──
    const visibleContent = allContentLines.slice(this.pageScrollOffset, this.pageScrollOffset + viewportHeight);
    for (const cl of visibleContent) {
      lines.push(padStr + cl);
    }

    // Pad if content doesn't fill viewport
    while (lines.length < rows - footerLines) {
      lines.push("");
    }

    // ── Build footer ──
    if (itemsBelow > 0) {
      lines.push(padStr + fgColor(this.theme.subtle) + dim + "  \u2193 " + itemsBelow + " item" + (itemsBelow > 1 ? "s" : "") + " below" + reset);
    } else {
      lines.push("");
    }
    lines.push(padStr + fgColor(this.theme.border) + "\u2500".repeat(contentWidth) + reset);
    const pageIdx = this.router.currentIndex + 1;
    const pageTotal = this.router.pageCount;
    lines.push(padStr + fgColor(this.theme.subtle) + dim +
      "  \u2191\u2193 navigate  \u23ce select  \u2190 back  q quit  [" + pageIdx + "/" + pageTotal + "]" + reset);
  }

  renderContentBlocks(blocks: ContentBlock[], ctx: RenderContext): string[] {
    const lines: string[] = [];

    for (const block of blocks) {
      const blockLines = this.renderBlock(block, ctx);
      lines.push(...blockLines);
      lines.push(""); // spacing between blocks
    }

    // Remove trailing empty line
    if (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop();
    }

    return lines;
  }

  private renderBlock(block: ContentBlock, ctx: RenderContext): string[] {
    switch (block.type) {
      case "text":
        return renderText(block.content, ctx, block.style);

      case "card":
        return renderCard(block, ctx);

      case "timeline":
        return renderTimeline(block.items, ctx, block.style);

      case "table":
        return renderTable(block.headers, block.rows, ctx);

      case "list":
        return renderList(block.items, ctx, block.style);

      case "quote":
        return renderQuote(block.text, ctx, {
          attribution: block.attribution,
          style: block.style,
        });

      case "hero":
        return renderHero(block, ctx);

      case "gallery": {
        const galleryKey = JSON.stringify(block.items.map(i => i.title));
        const scrollIdx = this.galleryState.get(galleryKey) ?? 0;
        return renderGallery(block.items, ctx, {
          columns: block.columns,
          scrollIndex: scrollIdx,
        });
      }

      case "tabs": {
        const tabKey = block.items.map(i => i.label).join(",");
        const activeIdx = this.tabState.get(tabKey) ?? 0;
        return renderTabs(block.items, activeIdx, ctx, (blocks, c) => this.renderContentBlocks(blocks, c));
      }

      case "accordion": {
        const accKey = block.items.map(i => i.label).join(",");
        const openIdx = this.accordionState.get(accKey) ?? -1;
        return renderAccordion(block.items, openIdx, ctx, (blocks, c) => this.renderContentBlocks(blocks, c));
      }

      case "link":
        return renderLink(block.label, block.url, ctx, { icon: block.icon });

      case "progressBar":
        return renderProgressBar(block.label, block.value, ctx, {
          max: block.max,
          showPercent: block.showPercent,
        });

      case "badge":
        return [renderBadge(block.text, ctx, { color: block.color, style: block.style })];

      case "image":
        return renderImage(block.path, ctx, { width: block.width, mode: block.mode });

      case "divider":
        return renderDivider(ctx, {
          style: block.style,
          label: block.label,
          color: block.color,
        });

      case "spacer":
        return renderSpacer(block.lines);

      case "section": {
        const sectionLines: string[] = [];
        // Section header
        sectionLines.push(
          fgColor(ctx.theme.accent) + bold + "  " + block.title + reset
        );
        sectionLines.push(
          fgColor(ctx.theme.border) + "  " + "\u2500".repeat(Math.max(0, ctx.width - 4)) + reset
        );
        sectionLines.push("");
        // Section content
        sectionLines.push(...this.renderContentBlocks(block.content, ctx));
        return sectionLines;
      }

      case "custom":
        return block.render(ctx.width, ctx.theme);

      default:
        return [];
    }
  }

  private writeToTerminal(lines: string[], columns: number, rows: number): void {
    // Content page scrolling is handled in renderContentPage now.
    // Home page scrolling (if ever needed) uses the old scrollOffset.
    let displayLines = lines;

    // Build output — clamp each line to terminal width to prevent
    // wrapping that corrupts ANSI escape codes
    let output = "\x1b[H"; // move to top-left

    for (let i = 0; i < rows; i++) {
      output += "\x1b[2K"; // clear line
      if (i < displayLines.length) {
        const line = displayLines[i];
        const lineW = stringWidth(line);
        if (lineW > columns) {
          // ANSI-safe truncation to prevent terminal wrapping
          output += truncateLine(line, columns);
        } else {
          output += line;
        }
      }
      if (i < rows - 1) {
        output += "\n";
      }
    }

    // Command mode / feedback at bottom
    if (this.commandMode) {
      output += `\x1b[${rows};1H\x1b[2K`;
      output += renderInput(":", this.commandBuffer, this.createRenderContext(columns)).join("");
    } else if (this.feedbackMessage) {
      output += `\x1b[${rows};1H\x1b[2K`;
      output += fgColor(this.theme.success) + "  " + this.feedbackMessage + reset;
    }

    process.stdout.write(output);
  }
}

export async function runSite(site: Site): Promise<void> {
  const runtime = new TUIRuntime(site);
  await runtime.start();
}
