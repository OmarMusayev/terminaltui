import type {
  Site, SiteConfig, PageConfig, ContentBlock, DynamicBlock,
  TextInputBlock, TextAreaBlock, SelectBlock, CheckboxBlock, ToggleBlock,
  RadioGroupBlock, NumberInputBlock, SearchInputBlock, ButtonBlock,
  FormBlock, AsyncContentBlock, ActionResult,
} from "../config/types.js";
import type { RouteConfig, RouteParams } from "../routing/types.js";
import { setNavigateHandler } from "../routing/navigate.js";
import { runMiddleware } from "../middleware/index.js";
import { setRenderCallback } from "../state/reactive.js";
import { loadEnv } from "../config/env-loader.js";
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
import { InputModeManager } from "./input-mode.js";
import { NotificationManager } from "./notifications.js";
import { AsyncContentManager } from "../data/async-content.js";
import { createInputState, type InputFieldState } from "../data/types.js";
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
import { renderTextInput } from "../components/TextInput.js";
import { renderTextArea } from "../components/TextArea.js";
import { renderSelect } from "../components/Select.js";
import { renderCheckbox } from "../components/Checkbox.js";
import { renderToggle } from "../components/Toggle.js";
import { renderRadioGroup } from "../components/RadioGroup.js";
import { renderNumberInput } from "../components/NumberInput.js";
import { renderSearchInput, filterSearchItems } from "../components/SearchInput.js";
import { renderButton } from "../components/Button.js";
import { renderFormResult, collectFormFieldIds, getInputDefault } from "../components/Form.js";
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
  // Input system state
  private inputMode = new InputModeManager();
  private inputStates: Map<string, InputFieldState> = new Map();
  private formResults: Map<string, { message: string; type: "success" | "error" | "info" }> = new Map();
  private buttonLoading: Map<string, boolean> = new Map();
  // Notifications
  private notifications = new NotificationManager();
  private notificationTimer: ReturnType<typeof setInterval> | null = null;
  // Async content
  private asyncManager = new AsyncContentManager();
  private resolvedPageContent: Map<string, ContentBlock[]> = new Map();
  // Form registry: formId -> FormBlock
  private formRegistry: Map<string, FormBlock> = new Map();
  // Route params for the current page
  private currentParams: RouteParams = {};
  // Cache for dynamic block render results (same objects used for focus + rendering)
  private dynamicCache: Map<string, ContentBlock[]> = new Map();

  constructor(site: Site) {
    this.site = site.config;
    this.theme = this.resolveTheme(site.config.theme);
    this.borderStyle = site.config.borders ?? "rounded";
    this.router = new Router();
    this.focus = new FocusManager();

    // Register pages (all pages + routes)
    const allIds = site.config.pages.map(p => p.id);
    this.router.registerPages(allIds);

    // Set up menu focus (only static pages, not parameterized routes)
    const menuIds = site.config.pages
      .filter(p => typeof p.title === "string")
      .map(p => p.id);
    this.focus.setItems(menuIds);
  }

  private resolveTheme(theme?: Theme | BuiltinThemeName): Theme {
    if (!theme) return defaultTheme;
    if (typeof theme === "string") return themes[theme] ?? defaultTheme;
    return theme;
  }

  async start(): Promise<void> {
    // Load .env files
    loadEnv();

    // Detect terminal capabilities and sync color mode
    const caps = detectTerminal();
    setColorMode(caps.colorDepth);

    // Set up reactive state render callback
    setRenderCallback(() => this.render());

    // Set up global navigate handler
    setNavigateHandler((pageId, params) => {
      this.navigateToPage(pageId, params);
    });

    // Run onInit lifecycle hook
    if (this.site.onInit) {
      try {
        await this.site.onInit({
          state: null, // App-level state is managed by user's createState()
          navigate: (pageId, params) => this.navigateToPage(pageId, params),
        });
      } catch (err) {
        // onInit errors are fatal — show error and continue
        console.error("[terminaltui] onInit error:", err);
      }
    }

    // Set up terminal
    this.setupTerminal();

    // Handle resize
    screen.on("resize", () => this.render());

    // Handle input
    input.on("keypress", (key: KeyPress) => this.handleKey(key));
    input.start();

    // Start notification pruning timer
    this.notificationTimer = setInterval(() => {
      if (this.notifications.prune()) this.render();
    }, 500);

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
    this.asyncManager.cleanup();
    if (this.bootTimer) clearInterval(this.bootTimer);
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    if (this.notificationTimer) clearInterval(this.notificationTimer);
    // Show cursor
    process.stdout.write("\x1b[?25h");
    // Exit alternate screen
    process.stdout.write("\x1b[?1049l");
    // Reset colors
    process.stdout.write("\x1b[0m");
  }

  async stop(): Promise<void> {
    // Run onExit lifecycle hook
    if (this.site.onExit) {
      try {
        await this.site.onExit({
          state: null,
          navigate: () => {},
        });
      } catch { /* ignore exit errors */ }
    }

    // Clean up state system
    setRenderCallback(null);
    setNavigateHandler(null);

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

  // ─── INPUT STATE HELPERS ──────────────────────────────────

  private getInputState(id: string, defaultValue?: any): InputFieldState {
    let state = this.inputStates.get(id);
    if (!state) {
      state = createInputState(defaultValue);
      this.inputStates.set(id, state);
    }
    return state;
  }

  private setInputValue(id: string, value: any): void {
    const state = this.getInputState(id);
    state.value = value;
  }

  /** Get the block for the currently focused item, if it's an input type. */
  private getFocusedInputBlock(): ContentBlock | null {
    const item = this.pageFocusItems[this.pageFocusIndex];
    if (!item || item.kind !== "block") return null;
    const block = item.block;
    const inputTypes = ["textInput", "textArea", "select", "checkbox", "toggle",
      "radioGroup", "numberInput", "searchInput", "button"];
    if (inputTypes.includes(block.type)) return block;
    return null;
  }

  /** Get the ID of the currently focused input block, if any. */
  private getFocusedInputId(): string | null {
    const block = this.getFocusedInputBlock();
    if (!block) return null;
    return (block as any).id ?? null;
  }

  // ─── KEY HANDLING ─────────────────────────────────────────

  private handleKey(key: KeyPress): void {
    // Command mode handling
    if (this.commandMode) {
      this.handleCommandMode(key);
      return;
    }

    // Edit mode: route keys to the focused input
    if (this.inputMode.isEditing) {
      this.handleEditMode(key);
      return;
    }

    // Navigation mode
    this.handleNavigationMode(key);
  }

  private handleCommandMode(key: KeyPress): void {
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
  }

  /** Check if a block type accepts text entry (typing auto-enters edit mode). */
  private isTextEntryType(type: string): boolean {
    return type === "textInput" || type === "textArea" || type === "searchInput" || type === "numberInput";
  }

  /** Check if a key is a typeable character that should auto-enter edit mode. */
  private isAutoEditKey(key: KeyPress): boolean {
    // Printable characters (letters, digits, symbols)
    if (key.char && key.char.length === 1 && !key.ctrl) {
      // Exclude special named keys that are navigation, not typing
      const navKeys = ["up", "down", "left", "right", "escape", "return",
        "delete", "home", "end", "tab"];
      if (!navKeys.includes(key.name)) return true;
    }
    // Space is typeable
    if (key.name === "space") return true;
    // Backspace should delete from input, not navigate back
    if (key.name === "backspace") return true;
    return false;
  }

  private handleNavigationMode(key: KeyPress): void {
    const isHome = this.router.isHome();

    // Auto-enter edit mode when typing on a focused text-entry input
    if (!isHome) {
      const focusedBlock = this.getFocusedInputBlock();
      if (focusedBlock && this.isTextEntryType(focusedBlock.type) && this.isAutoEditKey(key)) {
        const id = (focusedBlock as any).id;
        this.inputMode.enterEdit(id);
        this.getInputState(id, getInputDefault(focusedBlock));
        // Forward the keystroke to the edit handler so the char gets inserted
        this.handleEditMode(key);
        this.render();
        return;
      }
    }

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
          this.inputMode.reset();
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

  /** Handle keystrokes in edit mode. */
  private handleEditMode(key: KeyPress): void {
    const focused = this.getFocusedInputBlock();
    if (!focused) {
      this.inputMode.exitEdit();
      this.render();
      return;
    }

    switch (focused.type) {
      case "textInput":
        this.handleTextInputKey(focused as TextInputBlock, key);
        break;
      case "textArea":
        this.handleTextAreaKey(focused as TextAreaBlock, key);
        break;
      case "select":
        this.handleSelectKey(focused as SelectBlock, key);
        break;
      case "numberInput":
        this.handleNumberInputKey(focused as NumberInputBlock, key);
        break;
      case "searchInput":
        this.handleSearchInputKey(focused as SearchInputBlock, key);
        break;
      case "radioGroup":
        this.handleRadioGroupKey(focused as RadioGroupBlock, key);
        break;
      default:
        // Escape always exits edit mode
        if (key.name === "escape") {
          this.inputMode.exitEdit();
        }
        break;
    }

    this.render();
  }

  // ─── TEXT INPUT KEY HANDLING ───────────────────────────────

  private handleTextInputKey(block: TextInputBlock, key: KeyPress): void {
    const state = this.getInputState(block.id, block.defaultValue ?? "");
    let value = state.value as string;
    let cursor = state.cursorPos;

    if (key.name === "escape") {
      // Validate on blur
      this.validateInput(block);
      this.inputMode.exitEdit();
      return;
    }

    if (key.name === "return") {
      // Validate on blur and advance to next item
      this.validateInput(block);
      this.inputMode.exitEdit();
      this.pageFocusNext();
      return;
    }

    if (key.name === "up") {
      this.validateInput(block);
      this.inputMode.exitEdit();
      this.pageFocusPrev();
      return;
    }

    if (key.name === "down") {
      this.validateInput(block);
      this.inputMode.exitEdit();
      this.pageFocusNext();
      return;
    }

    if (key.name === "backspace") {
      if (cursor > 0) {
        value = value.substring(0, cursor - 1) + value.substring(cursor);
        cursor--;
      }
    } else if (key.name === "delete") {
      if (cursor < value.length) {
        value = value.substring(0, cursor) + value.substring(cursor + 1);
      }
    } else if (key.name === "left") {
      if (cursor > 0) cursor--;
    } else if (key.name === "right") {
      if (cursor < value.length) cursor++;
    } else if (key.name === "home") {
      cursor = 0;
    } else if (key.name === "end") {
      cursor = value.length;
    } else if (key.char && key.char.length === 1 && !key.ctrl && key.name !== "tab") {
      // Insert character
      if (!block.maxLength || value.length < block.maxLength) {
        value = value.substring(0, cursor) + key.char + value.substring(cursor);
        cursor++;
      }
    }

    // Apply transform
    if (block.transform) {
      value = block.transform(value);
      cursor = Math.min(cursor, value.length);
    }

    const changed = state.value !== value;
    state.value = value;
    state.cursorPos = cursor;
    // Clear error while editing
    state.error = null;
    // Fire onChange
    if (changed && block.onChange) block.onChange(value);
  }

  // ─── TEXT AREA KEY HANDLING ───────────────────────────────

  private handleTextAreaKey(block: TextAreaBlock, key: KeyPress): void {
    const state = this.getInputState(block.id, block.defaultValue ?? "");
    let value = state.value as string;
    let cursor = state.cursorPos;

    if (key.name === "escape") {
      this.validateInput(block);
      this.inputMode.exitEdit();
      return;
    }

    if (key.name === "return") {
      // In textarea, Enter inserts newline
      if (!block.maxLength || value.length < block.maxLength) {
        value = value.substring(0, cursor) + "\n" + value.substring(cursor);
        cursor++;
      }
    } else if (key.name === "backspace") {
      if (cursor > 0) {
        value = value.substring(0, cursor - 1) + value.substring(cursor);
        cursor--;
      }
    } else if (key.name === "delete") {
      if (cursor < value.length) {
        value = value.substring(0, cursor) + value.substring(cursor + 1);
      }
    } else if (key.name === "left") {
      if (cursor > 0) cursor--;
    } else if (key.name === "right") {
      if (cursor < value.length) cursor++;
    } else if (key.name === "up") {
      // Move cursor up one line
      const lines = value.substring(0, cursor).split("\n");
      if (lines.length > 1) {
        const currentCol = lines[lines.length - 1].length;
        const prevLine = lines[lines.length - 2];
        const newCol = Math.min(currentCol, prevLine.length);
        cursor = lines.slice(0, -1).join("\n").length - prevLine.length + newCol;
        if (cursor < 0) cursor = 0;
      }
    } else if (key.name === "down") {
      // Move cursor down one line
      const before = value.substring(0, cursor);
      const after = value.substring(cursor);
      const currentLineStart = before.lastIndexOf("\n") + 1;
      const currentCol = cursor - currentLineStart;
      const nextNewline = after.indexOf("\n");
      if (nextNewline >= 0) {
        const afterNext = after.substring(nextNewline + 1);
        const nextLineEnd = afterNext.indexOf("\n");
        const nextLineLen = nextLineEnd >= 0 ? nextLineEnd : afterNext.length;
        const newCol = Math.min(currentCol, nextLineLen);
        cursor = cursor + nextNewline + 1 + newCol;
      }
    } else if (key.name === "home") {
      // Move to start of current line
      const before = value.substring(0, cursor);
      const lineStart = before.lastIndexOf("\n") + 1;
      cursor = lineStart;
    } else if (key.name === "end") {
      // Move to end of current line
      const after = value.substring(cursor);
      const lineEnd = after.indexOf("\n");
      cursor = lineEnd >= 0 ? cursor + lineEnd : value.length;
    } else if (key.char && key.char.length === 1 && !key.ctrl && key.name !== "tab") {
      if (!block.maxLength || value.length < block.maxLength) {
        value = value.substring(0, cursor) + key.char + value.substring(cursor);
        cursor++;
      }
    }

    const changed = state.value !== value;
    state.value = value;
    state.cursorPos = cursor;
    state.error = null;
    if (changed && block.onChange) block.onChange(value);
  }

  // ─── SELECT KEY HANDLING ──────────────────────────────────

  private handleSelectKey(block: SelectBlock, key: KeyPress): void {
    const state = this.getInputState(block.id, block.defaultValue ?? "");

    if (key.name === "escape") {
      state.open = false;
      this.inputMode.exitEdit();
      return;
    }

    if (!state.open) {
      // Dropdown is closed — Enter opens it
      if (key.name === "return") {
        state.open = true;
        // Set highlight to current selection
        const idx = block.options.findIndex(o => o.value === state.value);
        state.highlightIndex = idx >= 0 ? idx : 0;
      }
      return;
    }

    // Dropdown is open
    if (key.name === "up") {
      state.highlightIndex = Math.max(0, state.highlightIndex - 1);
    } else if (key.name === "down") {
      state.highlightIndex = Math.min(block.options.length - 1, state.highlightIndex + 1);
    } else if (key.name === "return") {
      // Confirm selection
      const opt = block.options[state.highlightIndex];
      if (opt) {
        state.value = opt.value;
        block.onChange?.(opt.value);
      }
      state.open = false;
      this.inputMode.exitEdit();
    }
  }

  // ─── NUMBER INPUT KEY HANDLING ────────────────────────────

  private handleNumberInputKey(block: NumberInputBlock, key: KeyPress): void {
    const state = this.getInputState(block.id, block.defaultValue ?? 0);
    const step = block.step ?? 1;
    const min = block.min ?? -Infinity;
    const max = block.max ?? Infinity;

    if (key.name === "escape") {
      this.inputMode.exitEdit();
      return;
    }

    if (key.name === "return" || key.name === "up" || key.name === "down") {
      this.inputMode.exitEdit();
      if (key.name === "up") this.pageFocusPrev();
      if (key.name === "down") this.pageFocusNext();
      return;
    }

    if (key.name === "left" || key.char === "-") {
      state.value = Math.max(min, (state.value as number) - step);
    } else if (key.name === "right" || key.char === "+") {
      state.value = Math.min(max, (state.value as number) + step);
    } else if (key.char && /[0-9]/.test(key.char)) {
      // Direct number entry
      const numStr = String(state.value) === "0" ? key.char : String(state.value) + key.char;
      const num = parseInt(numStr, 10);
      if (!isNaN(num)) {
        state.value = Math.max(min, Math.min(max, num));
      }
    } else if (key.name === "backspace") {
      const numStr = String(state.value).slice(0, -1);
      state.value = numStr ? Math.max(min, Math.min(max, parseInt(numStr, 10) || 0)) : 0;
    }
  }

  // ─── SEARCH INPUT KEY HANDLING ────────────────────────────

  private handleSearchInputKey(block: SearchInputBlock, key: KeyPress): void {
    const state = this.getInputState(block.id, "");
    let query = state.value as string;
    let cursor = state.cursorPos;

    if (key.name === "escape") {
      this.inputMode.exitEdit();
      return;
    }

    if (key.name === "return") {
      // Select highlighted item
      const maxResults = block.maxResults ?? 10;
      const filtered = filterSearchItems(block.items, query, maxResults);
      const selected = filtered[state.highlightIndex];
      if (selected) {
        this.executeSearchAction(block, selected);
      }
      this.inputMode.exitEdit();
      return;
    }

    if (key.name === "up") {
      state.highlightIndex = Math.max(0, state.highlightIndex - 1);
      return;
    }

    if (key.name === "down") {
      const maxResults = block.maxResults ?? 10;
      const filtered = filterSearchItems(block.items, query, maxResults);
      state.highlightIndex = Math.min(filtered.length - 1, state.highlightIndex + 1);
      return;
    }

    // Text editing
    if (key.name === "backspace") {
      if (cursor > 0) {
        query = query.substring(0, cursor - 1) + query.substring(cursor);
        cursor--;
      }
    } else if (key.name === "left") {
      if (cursor > 0) cursor--;
    } else if (key.name === "right") {
      if (cursor < query.length) cursor++;
    } else if (key.char && key.char.length === 1 && !key.ctrl && key.name !== "tab") {
      query = query.substring(0, cursor) + key.char + query.substring(cursor);
      cursor++;
    }

    state.value = query;
    state.cursorPos = cursor;
    // Reset highlight when query changes
    state.highlightIndex = 0;
  }

  /** Execute the appropriate action when a search result is selected. */
  private executeSearchAction(
    block: SearchInputBlock,
    selected: { label: string; value: string },
  ): void {
    const action = block.action ?? (block.onSelect ? "callback" : "navigate");

    if (action === "callback" && block.onSelect) {
      block.onSelect(selected.value);
      return;
    }

    // Navigate action: try page navigation first, then scroll to matching block
    const value = selected.value;

    // 1. Try navigating to a page with this ID
    const pageMatch = this.site.pages.find(p => p.id === value);
    if (pageMatch) {
      this.router.navigate(value);
      this.enterPage();
      this.showFeedback(`\u2192 ${pageMatch.title}`);
      this.render();
      return;
    }

    // 2. Try scrolling to a matching block on the current page
    //    Match by: card title, accordion label, timeline title, link label, or block id
    const found = this.scrollToBlock(value, selected.label);
    if (found) {
      this.showFeedback(selected.label);
      this.render();
      return;
    }

    // 3. Search across ALL pages for a matching block, navigate there
    for (const p of this.site.pages) {
      if (p.id === this.router.currentPage) continue;
      const content = typeof p.content === "function" ? this.resolvedPageContent.get(p.id) : p.content;
      if (!content) continue;
      if (this.blockExistsInContent(value, selected.label, content)) {
        this.router.navigate(p.id);
        this.enterPage();
        // Now scroll to the block on the new page
        this.scrollToBlock(value, selected.label);
        this.showFeedback(`\u2192 ${p.title} \u203a ${selected.label}`);
        this.render();
        return;
      }
    }

    // 4. Fallback: call onSelect if available, otherwise just show feedback
    if (block.onSelect) {
      block.onSelect(value);
    }
    this.showFeedback(selected.label);
  }

  /**
   * Scroll focus to a block matching the given value/label on the current page.
   * Returns true if a match was found.
   */
  /** Normalize a string to alphanumeric for fuzzy matching. */
  private norm(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  private scrollToBlock(value: string, label: string): boolean {
    const valueLower = value.toLowerCase();
    const valueNorm = this.norm(value);
    const labelLower = label.toLowerCase();

    for (let i = 0; i < this.pageFocusItems.length; i++) {
      const item = this.pageFocusItems[i];

      if (item.kind === "block") {
        const b = item.block;
        // Match by block id
        if ("id" in b && (b as any).id === value) {
          this.pageFocusIndex = i;
          return true;
        }
        // Match by card title (exact or normalized)
        if (b.type === "card") {
          const titleNorm = this.norm(b.title);
          if (b.title.toLowerCase().includes(valueLower) || titleNorm.includes(valueNorm) || valueNorm.includes(titleNorm)) {
            this.pageFocusIndex = i;
            return true;
          }
        }
        // Match by link label
        if (b.type === "link") {
          const linkNorm = this.norm(b.label);
          if (b.label.toLowerCase().includes(valueLower) || linkNorm.includes(valueNorm) || valueNorm.includes(linkNorm)) {
            this.pageFocusIndex = i;
            return true;
          }
        }
        // Match by hero title
        if (b.type === "hero") {
          const heroNorm = this.norm(b.title);
          if (b.title.toLowerCase().includes(valueLower) || heroNorm.includes(valueNorm) || valueNorm.includes(heroNorm)) {
            this.pageFocusIndex = i;
            return true;
          }
        }
      }

      if (item.kind === "accordion-item") {
        const accLabel = item.accordion.items[item.itemIndex].label;
        const accNorm = accLabel.toLowerCase().replace(/[^a-z0-9]/g, "");
        const valueNorm = valueLower.replace(/[^a-z0-9]/g, "");
        // Match accordion items by label — e.g. "db.insert(doc)" matches value "db-insert"
        // Normalize both to alphanumeric for fuzzy matching
        if (accLabel.toLowerCase().includes(valueLower) ||
            accNorm.includes(valueNorm) ||
            valueNorm.includes(accNorm) ||
            accLabel.toLowerCase().startsWith(labelLower.split(" — ")[0]?.trim().toLowerCase() ?? "\0")) {
          this.pageFocusIndex = i;
          // Also open the accordion item
          const accKey = item.accordion.items.map(it => it.label).join(",");
          this.accordionState.set(accKey, item.itemIndex);
          return true;
        }
      }

      if (item.kind === "timeline-item") {
        const tlTitle = item.timeline.items[item.itemIndex].title;
        if (tlTitle.toLowerCase().includes(valueLower)) {
          this.pageFocusIndex = i;
          return true;
        }
      }
    }

    return false;
  }

  /** Check if a block matching value/label exists in a content array. */
  private blockExistsInContent(value: string, label: string, blocks: ContentBlock[]): boolean {
    const valueLower = value.toLowerCase();
    const valueNorm = this.norm(value);
    for (const b of blocks) {
      if ("id" in b && (b as any).id === value) return true;
      if (b.type === "card") {
        const n = this.norm(b.title);
        if (b.title.toLowerCase().includes(valueLower) || n.includes(valueNorm) || valueNorm.includes(n)) return true;
      }
      if (b.type === "link") {
        const n = this.norm(b.label);
        if (b.label.toLowerCase().includes(valueLower) || n.includes(valueNorm) || valueNorm.includes(n)) return true;
      }
      if (b.type === "accordion") {
        for (const item of b.items) {
          const itemNorm = item.label.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (item.label.toLowerCase().includes(valueLower) || itemNorm.includes(valueNorm) || valueNorm.includes(itemNorm)) return true;
        }
      }
      if (b.type === "timeline") {
        for (const item of b.items) {
          if (item.title.toLowerCase().includes(valueLower)) return true;
        }
      }
      if (b.type === "section") {
        if (this.blockExistsInContent(value, label, b.content)) return true;
      }
      if (b.type === "form") {
        if (this.blockExistsInContent(value, label, (b as FormBlock).fields)) return true;
      }
    }
    return false;
  }

  // ─── RADIO GROUP KEY HANDLING ─────────────────────────────

  private handleRadioGroupKey(block: RadioGroupBlock, key: KeyPress): void {
    const state = this.getInputState(block.id, block.defaultValue ?? "");

    if (key.name === "escape") {
      this.inputMode.exitEdit();
      return;
    }

    if (key.name === "up") {
      if (state.highlightIndex > 0) {
        state.highlightIndex--;
      } else {
        this.inputMode.exitEdit();
        this.pageFocusPrev();
      }
      return;
    }

    if (key.name === "down") {
      if (state.highlightIndex < block.options.length - 1) {
        state.highlightIndex++;
      } else {
        this.inputMode.exitEdit();
        this.pageFocusNext();
      }
      return;
    }

    if (key.name === "return" || key.name === "space") {
      const opt = block.options[state.highlightIndex];
      if (opt) {
        state.value = opt.value;
        block.onChange?.(opt.value);
      }
      return;
    }
  }

  // ─── VALIDATION ───────────────────────────────────────────

  private validateInput(block: ContentBlock): boolean {
    if (block.type === "textInput") {
      const b = block as TextInputBlock;
      if (b.validate) {
        const state = this.getInputState(b.id, b.defaultValue ?? "");
        const error = b.validate(state.value as string);
        state.error = error;
        return error === null;
      }
    } else if (block.type === "textArea") {
      const b = block as TextAreaBlock;
      if (b.validate) {
        const state = this.getInputState(b.id, b.defaultValue ?? "");
        const error = b.validate(state.value as string);
        state.error = error;
        return error === null;
      }
    }
    return true;
  }

  // ─── PAGE SELECT / ENTER EDIT ─────────────────────────────

  /** Handle enter/select on the currently focused item. */
  private handlePageSelect(): void {
    const item = this.pageFocusItems[this.pageFocusIndex];
    if (!item) return;

    if (item.kind === "accordion-item") {
      // Toggle this accordion item open/closed
      const acc = item.accordion;
      const accKey = acc.items.map(i => i.label).join(",");
      const current = this.accordionState.get(accKey) ?? -1;
      this.accordionState.set(accKey, current === item.itemIndex ? -1 : item.itemIndex);
      return;
    }

    if (item.kind === "timeline-item") {
      // Timeline items are display-only
      return;
    }

    const block = item.block;

    // Input components: Enter starts edit mode
    if (block.type === "textInput" || block.type === "textArea" ||
        block.type === "numberInput" || block.type === "searchInput") {
      const id = (block as any).id;
      this.inputMode.enterEdit(id);
      // Initialize default value if needed
      this.getInputState(id, getInputDefault(block));
      return;
    }

    if (block.type === "select") {
      const id = (block as SelectBlock).id;
      const state = this.getInputState(id, (block as SelectBlock).defaultValue ?? "");
      this.inputMode.enterEdit(id);
      state.open = true;
      const idx = (block as SelectBlock).options.findIndex(o => o.value === state.value);
      state.highlightIndex = idx >= 0 ? idx : 0;
      return;
    }

    if (block.type === "radioGroup") {
      const id = (block as RadioGroupBlock).id;
      const state = this.getInputState(id, (block as RadioGroupBlock).defaultValue ?? "");
      this.inputMode.enterEdit(id);
      const idx = (block as RadioGroupBlock).options.findIndex(o => o.value === state.value);
      state.highlightIndex = idx >= 0 ? idx : 0;
      return;
    }

    // Checkbox / Toggle: Enter/Space toggles directly (no edit mode)
    if (block.type === "checkbox" || block.type === "toggle") {
      const id = (block as any).id;
      const state = this.getInputState(id, (block as any).defaultValue ?? false);
      state.value = !state.value;
      // Fire onChange callback
      (block as any).onChange?.(state.value);
      return;
    }

    // Button: handle press
    if (block.type === "button") {
      this.handleButtonPress(block as ButtonBlock);
      return;
    }

    // Existing: links, cards, hero, tabs
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

    if (block.type === "card" && block.action) {
      this.handleCardAction(block);
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

  private handleButtonPress(button: ButtonBlock): void {
    if (button._formId) {
      // Submit the form
      this.submitForm(button._formId);
      return;
    }

    if (button.onPress) {
      const result = button.onPress();
      if (result && typeof (result as any).then === "function") {
        // Async button
        const btnKey = button.label;
        this.buttonLoading.set(btnKey, true);
        this.render();
        (result as Promise<any>).then((actionResult: any) => {
          this.buttonLoading.delete(btnKey);
          this.showActionResult(actionResult);
          this.render();
        }).catch((err: any) => {
          this.buttonLoading.delete(btnKey);
          this.notifications.error(err instanceof Error ? err.message : String(err));
          this.render();
        });
      } else if (result) {
        // Synchronous ActionResult
        this.showActionResult(result);
        this.render();
      } else {
        // void return — just re-render to reflect any state changes
        this.render();
      }
    }
  }

  /** Show a notification from an ActionResult if present. */
  private showActionResult(result: any): void {
    if (!result || typeof result !== "object") return;
    if ("success" in result) this.notifications.success(result.success);
    else if ("error" in result) this.notifications.error(result.error);
    else if ("info" in result) this.notifications.info(result.info);
  }

  private handleCardAction(card: ContentBlock & { type: "card" }): void {
    if (!card.action) return;

    // Navigate action — go to a page/route
    if (card.action.navigate) {
      this.navigateToPage(card.action.navigate, card.action.params);
      return;
    }

    if (card.action.confirm) {
      this.showFeedback("Action triggered");
    }

    if (!card.action.onPress) return;
    const result = card.action.onPress();
    if (result && typeof (result as any).then === "function") {
      (result as Promise<void>).then(() => {
        this.render();
      }).catch(() => {
        this.render();
      });
    }
  }

  /** Navigate to a page or route, with optional params and middleware. */
  private navigateToPage(pageId: string, params?: RouteParams): void {
    const pageConfig = this.site.pages.find(p => p.id === pageId);
    if (!pageConfig) return;

    // Run middleware
    const middlewareChain = [
      ...(this.site.middleware ?? []),
      ...((pageConfig as any).middleware ?? []),
    ];

    if (middlewareChain.length > 0) {
      runMiddleware(middlewareChain, {
        page: pageId,
        params: params ?? {},
        state: null,
      }).then(result => {
        if (result && "redirect" in result) {
          this.navigateToPage(result.redirect, result.params);
          return;
        }
        this.doNavigate(pageId, params);
      }).catch(() => {
        this.doNavigate(pageId, params);
      });
    } else {
      this.doNavigate(pageId, params);
    }
  }

  private doNavigate(pageId: string, params?: RouteParams): void {
    const from = this.router.currentPage;
    this.router.navigate(pageId);
    this.currentParams = params ?? {};
    this.scrollOffset = 0;
    this.enterPage();

    // Lifecycle hook
    if (this.site.onNavigate) {
      this.site.onNavigate(from, pageId, params);
    }

    this.render();
  }

  private async submitForm(formId: string): Promise<void> {
    const formBlock = this.formRegistry.get(formId);
    if (!formBlock) return;

    // Collect field IDs and validate
    const fieldIds = collectFormFieldIds(formBlock.fields);
    let firstInvalidIdx = -1;

    for (let i = 0; i < formBlock.fields.length; i++) {
      const field = formBlock.fields[i];
      if (!this.validateInput(field)) {
        if (firstInvalidIdx < 0) firstInvalidIdx = i;
      }
    }

    if (firstInvalidIdx >= 0) {
      // Focus the first invalid field
      const invalidField = formBlock.fields[firstInvalidIdx];
      const invalidId = (invalidField as any).id;
      if (invalidId) {
        // Find it in pageFocusItems and focus it
        for (let i = 0; i < this.pageFocusItems.length; i++) {
          const item = this.pageFocusItems[i];
          if (item.kind === "block" && "id" in item.block && (item.block as any).id === invalidId) {
            this.pageFocusIndex = i;
            break;
          }
        }
      }
      this.render();
      return;
    }

    // Collect data
    const data: Record<string, any> = {};
    for (const id of fieldIds) {
      const state = this.inputStates.get(id);
      data[id] = state?.value ?? undefined;
    }

    // Show loading on the submit button
    // Find the button in the form fields
    const btnField = formBlock.fields.find(f => f.type === "button");
    const btnKey = btnField ? (btnField as ButtonBlock).label : "";
    if (btnKey) this.buttonLoading.set(btnKey, true);
    this.render();

    try {
      const result = await formBlock.onSubmit(data);
      if (btnKey) this.buttonLoading.delete(btnKey);

      // Show result
      if ("success" in result) {
        this.formResults.set(formId, { message: result.success, type: "success" });
        this.notifications.success(result.success);
        // Reset fields on successful submit if configured
        if (formBlock.resetOnSubmit) {
          this.resetFormFields(formBlock);
        }
      } else if ("error" in result) {
        this.formResults.set(formId, { message: result.error, type: "error" });
        this.notifications.error(result.error);
      } else if ("info" in result) {
        this.formResults.set(formId, { message: result.info, type: "info" });
        this.notifications.info(result.info);
      }
    } catch (err) {
      if (btnKey) this.buttonLoading.delete(btnKey);
      const msg = err instanceof Error ? err.message : "An error occurred";
      this.formResults.set(formId, { message: msg, type: "error" });
      this.notifications.error(msg);
    }

    this.render();

    // Clear form result after a delay
    setTimeout(() => {
      this.formResults.delete(formId);
      this.render();
    }, 5000);
  }

  // ─── FORM & FIELD RESET ────────────────────────────────

  /** Reset all fields in a form to their default values. */
  private resetFormFields(formBlock: FormBlock): void {
    for (const field of formBlock.fields) {
      if ("id" in field && (field as any).type !== "button") {
        const id = (field as any).id;
        const defaultVal = getInputDefault(field);
        const state = this.inputStates.get(id);
        if (state) {
          state.value = defaultVal;
          state.cursorPos = typeof defaultVal === "string" ? defaultVal.length : 0;
          state.error = null;
          state.open = false;
          state.highlightIndex = 0;
          state.scrollOffset = 0;
        }
      }
    }
  }

  /** Public: reset a form by ID. */
  resetForm(formId: string): void {
    const formBlock = this.formRegistry.get(formId);
    if (formBlock) {
      this.resetFormFields(formBlock);
      this.render();
    }
  }

  /** Public: clear a single field by ID to its default value. */
  clearField(fieldId: string): void {
    const state = this.inputStates.get(fieldId);
    if (state) {
      state.value = "";
      state.cursorPos = 0;
      state.error = null;
      this.render();
    }
  }

  // ─── PAGE NAVIGATION ─────────────────────────────────────

  /** Initialize page focus when entering a page. */
  private enterPage(): void {
    this.pageFocusIndex = 0;
    this.pageScrollOffset = 0;
    this.pageFocusItems = [];
    this.inputMode.reset();
    this.formRegistry.clear();

    const currentPage = this.getCurrentPage();
    if (!currentPage) return;

    // Check if this is a RouteConfig (parameterized route)
    const rawConfig = this.site.pages.find(p => p.id === currentPage.id);
    if (rawConfig && typeof rawConfig.title === "function") {
      // This is a RouteConfig — content takes params
      const routeConfig = rawConfig as RouteConfig;
      this.loadRouteContent(routeConfig);
      return;
    }

    // Handle async page content
    const content = currentPage.content;
    if (typeof content === "function") {
      this.loadAsyncPageContent(currentPage);
      return;
    }

    this.initializePageContent(content);
  }

  /** Load content for a parameterized route. */
  private loadRouteContent(routeConfig: RouteConfig): void {
    const params = this.currentParams;
    const key = `route-${routeConfig.id}-${JSON.stringify(params)}`;

    const loader = async () => {
      const result = routeConfig.content(params);
      return result instanceof Promise ? await result : result;
    };

    this.asyncManager.load(key, loader, () => {
      const state = this.asyncManager.getState(key);
      if (state?.status === "loaded" && state.content) {
        this.resolvedPageContent.set(routeConfig.id, state.content);
        this.initializePageContent(state.content);
      } else if (state?.status === "error" && routeConfig.onError) {
        const fallback = routeConfig.onError(state.error!, params);
        this.resolvedPageContent.set(routeConfig.id, fallback);
        this.initializePageContent(fallback);
      }
      this.render();
    });
  }

  private initializePageContent(content: ContentBlock[]): void {
    this.pageFocusItems = this.collectFocusItems(content);
    // Register forms
    this.registerForms(content);
  }

  private registerForms(blocks: ContentBlock[]): void {
    for (const block of blocks) {
      if (block.type === "form") {
        this.formRegistry.set(block.id, block as FormBlock);
        this.registerForms((block as FormBlock).fields);
      } else if (block.type === "section") {
        this.registerForms(block.content);
      }
    }
  }

  private loadAsyncPageContent(page: PageConfig): void {
    const key = `page-${page.id}`;
    const loader = page.content as () => Promise<ContentBlock[]>;

    this.asyncManager.load(key, loader, () => {
      const state = this.asyncManager.getState(key);
      if (state?.status === "loaded" && state.content) {
        this.resolvedPageContent.set(page.id, state.content);
        this.initializePageContent(state.content);
      } else if (state?.status === "error" && page.onError) {
        const fallback = page.onError(state.error!);
        this.resolvedPageContent.set(page.id, fallback);
        this.initializePageContent(fallback);
      }
      this.render();
    });

    // Set up refresh if configured
    if (page.refreshInterval) {
      this.asyncManager.setupRefresh(key, page.refreshInterval, loader, () => {
        const state = this.asyncManager.getState(key);
        if (state?.status === "loaded" && state.content) {
          this.resolvedPageContent.set(page.id, state.content);
          // Re-collect focus items but try to preserve focus position
          const oldIndex = this.pageFocusIndex;
          this.pageFocusItems = this.collectFocusItems(state.content);
          this.pageFocusIndex = Math.min(oldIndex, Math.max(0, this.pageFocusItems.length - 1));
          this.registerForms(state.content);
        }
        this.render();
      });
    }
  }

  /** Resolve the page title, handling RouteConfig function titles. */
  private resolvePageTitle(page: PageConfig): string {
    const raw = this.site.pages.find(p => p.id === page.id);
    if (raw && typeof raw.title === "function") {
      return (raw.title as (params: RouteParams) => string)(this.currentParams);
    }
    return page.title as string;
  }

  /** Get the effective content for a page (resolved async or static). */
  private getPageContent(page: PageConfig): ContentBlock[] | null {
    if (typeof page.content === "function") {
      return this.resolvedPageContent.get(page.id) ?? null;
    }
    return page.content;
  }

  /** Recursively collect focusable items. */
  private collectFocusItems(blocks: ContentBlock[]): FocusItem[] {
    const result: FocusItem[] = [];
    for (const block of blocks) {
      switch (block.type) {
        case "card":
        case "link":
        case "hero":
          result.push({ kind: "block", block });
          break;
        case "textInput":
        case "textArea":
        case "select":
        case "checkbox":
        case "toggle":
        case "radioGroup":
        case "numberInput":
        case "searchInput":
        case "button":
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
        case "form":
          result.push(...this.collectFocusItems((block as FormBlock).fields));
          break;
        case "dynamic": {
          // Resolve dynamic block using cache for stable object references
          const dynamicBlocks = this.resolveDynamic(block as DynamicBlock);
          result.push(...this.collectFocusItems(dynamicBlocks));
          break;
        }
        default:
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
    const found = this.site.pages.find(p => p.id === this.router.currentPage);
    if (!found) return undefined;
    // RouteConfigs have function titles — treat them as PageConfig for rendering
    // The runtime resolves the title at render time
    return found as PageConfig;
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
    // Invalidate dynamic cache so blocks re-evaluate with latest state,
    // then re-collect focus items so object refs are stable within this render pass
    this.invalidateDynamicCache();

    // Re-collect focus items from the current page to pick up dynamic changes
    const currentPage = this.getCurrentPage();
    if (currentPage && !this.router.isHome()) {
      const content = this.getPageContent(currentPage);
      if (content) {
        const oldIndex = this.pageFocusIndex;
        this.pageFocusItems = this.collectFocusItems(content);
        this.pageFocusIndex = Math.min(oldIndex, Math.max(0, this.pageFocusItems.length - 1));
        this.registerForms(content);
      }
    }

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
      borderStyle: this.borderStyle as string,
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

    // Menu — only show static pages (not parameterized routes)
    const menuItems: MenuItem[] = this.site.pages
      .filter(p => typeof p.title === "string") // Routes have function titles
      .map(p => ({
        label: p.title as string,
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

    // Get content (may be async-resolved)
    const content = this.getPageContent(currentPage);

    // If content is still loading (async page)
    if (content === null) {
      const loadingMsg = currentPage.loading ?? "Loading...";
      const contentWidth = ctx.width;
      const leftPad = Math.max(0, Math.floor((columns - contentWidth) / 2));
      const padStr = " ".repeat(leftPad);

      lines.push("");
      const backHint = fgColor(this.theme.subtle) + dim + "\u2190 back" + reset;
      const pageTitle = fgColor(this.theme.accent) + bold +
        (currentPage.icon ? currentPage.icon + " " : "") +
        this.resolvePageTitle(currentPage) + reset;
      lines.push(padStr + backHint + "  " + pageTitle);
      lines.push(padStr + fgColor(this.theme.border) + "\u2500".repeat(contentWidth) + reset);
      lines.push("");
      // Spinner
      const spinner = getSpinnerFrame("dots", Math.floor(Date.now() / 80));
      lines.push(padStr + "  " + fgColor(this.theme.accent) + spinner + reset +
        fgColor(this.theme.muted) + " " + loadingMsg + reset);
      return;
    }

    // Ensure page focus is initialized
    if (this.pageFocusItems.length === 0 && content.length > 0) {
      this.initializePageContent(content);
    }

    const contentWidth = ctx.width;
    const leftPad = Math.max(0, Math.floor((columns - contentWidth) / 2));
    const padStr = " ".repeat(leftPad);
    const currentFocus = this.pageFocusItems[this.pageFocusIndex] as FocusItem | undefined;

    // ── Single pass: render all content, track focused item position ──
    const allContentLines: string[] = [];
    let focusedLineStart = -1;
    let focusedLineEnd = -1;

    // Helper: check if a block is the focused one
    const isBlockFocused = (block: ContentBlock): boolean => {
      return !!currentFocus && currentFocus.kind === "block" && currentFocus.block === block;
    };

    // Helper: get the focused accordion item index for a specific accordion block
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
        } else if (block.type === "form") {
          // Render form fields
          renderBlocksRecursive((block as FormBlock).fields);
          // Render form result message if any
          const formResult = this.formResults.get((block as FormBlock).id);
          if (formResult) {
            const resultLines = renderFormResult(
              { resultMessage: formResult.message, resultType: formResult.type },
              ctx,
            );
            for (const rl of resultLines) {
              allContentLines.push(" " + rl);
            }
            allContentLines.push("");
          }
        } else if (block.type === "dynamic") {
          // Expand dynamic block inline using cached results for stable object refs
          const dynamicChildren = this.resolveDynamic(block as DynamicBlock);
          renderBlocksRecursive(dynamicChildren);
          // Skip the trailing spacer that renderBlocksRecursive adds per-block,
          // since the expanded children already added their own spacers
          continue;
        } else if (block.type === "asyncContent") {
          this.renderAsyncContentBlock(block as AsyncContentBlock, allContentLines, ctx, renderBlocksRecursive);
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

            const arrow = isItemOpen ? "\u25be" : "\u25b8";
            const labelColor = isItemOpen || isItemFocused ? ctx.theme.accent : ctx.theme.text;
            const maxLabelW = Math.max(0, contentWidth - 8);
            const headerLine = fgColor(labelColor) + bold + `  ${arrow} ${item.label.length > maxLabelW ? item.label.substring(0, maxLabelW - 1) + "\u2026" : item.label}` + reset;

            if (isItemFocused) {
              allContentLines.push(indicator + headerLine);
            } else {
              allContentLines.push(" " + headerLine);
            }

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
          const tlFocusIdx = currentFocus?.kind === "timeline-item" && currentFocus.timeline === block
            ? currentFocus.itemIndex : -1;

          for (let ti = 0; ti < block.items.length; ti++) {
            const item = block.items[ti];
            const isItemFocused = tlFocusIdx === ti;
            const isLast = ti === block.items.length - 1;

            if (isItemFocused) focusedLineStart = allContentLines.length;

            const dot = isItemFocused ? "\u25cf" : "\u25cb";
            let titleStr = item.title;
            if (item.subtitle) titleStr += " \u00b7 " + item.subtitle;
            const dotColor = isItemFocused ? ctx.theme.accent : ctx.theme.border;
            const titleColor = isItemFocused ? ctx.theme.accent : ctx.theme.text;
            const dotLine = fgColor(dotColor) + "  " + dot + " " + reset + fgColor(titleColor) + bold + titleStr + reset;
            allContentLines.push(" " + dotLine);

            if ((item as any).period || (item as any).date) {
              const period = (item as any).period ?? (item as any).date;
              allContentLines.push(" " + fgColor(ctx.theme.border) + "  \u2502 " + reset + fgColor(ctx.theme.muted) + dim + period + reset);
            }

            if (item.description) {
              const wrapped = wrapText(item.description, Math.max(0, contentWidth - 6));
              for (const wl of wrapped) {
                allContentLines.push(" " + fgColor(ctx.theme.border) + "  \u2502 " + reset + fgColor(ctx.theme.text) + wl + reset);
              }
            }

            if (!isLast) {
              allContentLines.push(" " + fgColor(ctx.theme.border) + "  \u2502" + reset);
            }

            if (isItemFocused) focusedLineEnd = allContentLines.length;
          }
        } else {
          const focused = isBlockFocused(block);
          if (focused) focusedLineStart = allContentLines.length;

          const blockIsFocusable = this.isBlockFocusable(block);
          const isEditing = focused && this.inputMode.isEditing;
          const focusCtx = focused ? { ...ctx, focused: true, editing: isEditing } : ctx;
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

    renderBlocksRecursive(content);

    // Remove trailing empty line
    if (allContentLines.length > 0 && allContentLines[allContentLines.length - 1] === "") {
      allContentLines.pop();
    }

    // ── Adjust scroll ──
    const headerLines = 4;
    const footerLines = 3;
    const viewportHeight = Math.max(1, rows - headerLines - footerLines);

    if (focusedLineStart >= 0) {
      if (focusedLineStart < this.pageScrollOffset) {
        this.pageScrollOffset = Math.max(0, focusedLineStart);
      } else if (focusedLineEnd > this.pageScrollOffset + viewportHeight) {
        this.pageScrollOffset = Math.max(0, focusedLineEnd - viewportHeight);
      }
    }

    const maxScroll = Math.max(0, allContentLines.length - viewportHeight);
    this.pageScrollOffset = Math.min(this.pageScrollOffset, maxScroll);

    // ── Count items above/below ──
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

    // Scroll-up indicator
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

    // Status bar with mode indicator
    const pageIdx = this.router.currentIndex + 1;
    const pageTotal = this.router.pageCount;
    if (this.inputMode.isEditing) {
      lines.push(padStr + fgColor(this.theme.accent) + bold +
        "  \u2500\u2500 Editing \u2500\u2500" + reset + fgColor(this.theme.subtle) + dim +
        " Type to input  Esc done  [" + pageIdx + "/" + pageTotal + "]" + reset);
    } else {
      lines.push(padStr + fgColor(this.theme.subtle) + dim +
        "  \u2191\u2193 navigate  \u23ce select  \u2190 back  q quit  [" + pageIdx + "/" + pageTotal + "]" + reset);
    }
  }

  private renderAsyncContentBlock(
    block: AsyncContentBlock,
    allContentLines: string[],
    ctx: RenderContext,
    renderRecursive: (blocks: ContentBlock[]) => void,
  ): void {
    const asyncId = block._asyncId ?? "async-anon";
    const state = this.asyncManager.getState(asyncId);

    if (!state) {
      // Start loading
      this.asyncManager.load(asyncId, block.load, () => this.render());
      const loadingMsg = block.loading ?? "Loading...";
      const spinner = getSpinnerFrame("dots", Math.floor(Date.now() / 80));
      allContentLines.push(
        " " + fgColor(ctx.theme.accent) + spinner + reset +
        fgColor(ctx.theme.muted) + " " + loadingMsg + reset
      );
      return;
    }

    if (state.status === "loading") {
      const loadingMsg = block.loading ?? "Loading...";
      const spinner = getSpinnerFrame("dots", Math.floor(Date.now() / 80));
      allContentLines.push(
        " " + fgColor(ctx.theme.accent) + spinner + reset +
        fgColor(ctx.theme.muted) + " " + loadingMsg + reset
      );
      // Keep rendering to animate spinner
      setTimeout(() => this.render(), 100);
      return;
    }

    if (state.status === "error") {
      if (block.fallback) {
        renderRecursive(block.fallback);
      } else {
        allContentLines.push(
          " " + fgColor(ctx.theme.error) + "\u26a0 " +
          (state.error?.message ?? "Failed to load content") + reset
        );
      }
      return;
    }

    // Loaded
    if (state.content) {
      renderRecursive(state.content);
    }
  }

  /** Check if a block type is focusable. */
  /** Resolve a dynamic block's children, using cache for stable object references. */
  private resolveDynamic(block: DynamicBlock): ContentBlock[] {
    const id = block._dynamicId ?? "";
    const cached = this.dynamicCache.get(id);
    if (cached) return cached;
    try {
      const result = block.render();
      const blocks = Array.isArray(result) ? result : [result];
      if (id) this.dynamicCache.set(id, blocks);
      return blocks;
    } catch {
      return [];
    }
  }

  /** Invalidate dynamic cache so next render re-evaluates. */
  private invalidateDynamicCache(): void {
    this.dynamicCache.clear();
  }

  private isBlockFocusable(block: ContentBlock): boolean {
    return ["card", "link", "hero", "tabs",
      "textInput", "textArea", "select", "checkbox", "toggle",
      "radioGroup", "numberInput", "searchInput", "button",
    ].includes(block.type);
  }

  renderContentBlocks(blocks: ContentBlock[], ctx: RenderContext): string[] {
    const lines: string[] = [];

    for (const block of blocks) {
      const blockLines = this.renderBlock(block, ctx);
      lines.push(...blockLines);
      lines.push(""); // spacing between blocks
    }

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
        sectionLines.push(fgColor(ctx.theme.accent) + bold + "  " + block.title + reset);
        sectionLines.push(fgColor(ctx.theme.border) + "  " + "\u2500".repeat(Math.max(0, ctx.width - 4)) + reset);
        sectionLines.push("");
        sectionLines.push(...this.renderContentBlocks(block.content, ctx));
        return sectionLines;
      }

      case "custom":
        return block.render(ctx.width, ctx.theme);

      // ─── Input Components ───────────────────────────────
      case "textInput": {
        const state = this.getInputState(block.id, block.defaultValue ?? "");
        return renderTextInput(block, {
          value: state.value as string,
          cursorPos: state.cursorPos,
          editing: !!ctx.editing,
          error: state.error,
        }, ctx);
      }

      case "textArea": {
        const state = this.getInputState(block.id, block.defaultValue ?? "");
        return renderTextArea(block, {
          value: state.value as string,
          cursorPos: state.cursorPos,
          editing: !!ctx.editing,
          error: state.error,
          scrollOffset: state.scrollOffset,
        }, ctx);
      }

      case "select": {
        const state = this.getInputState(block.id, block.defaultValue ?? "");
        return renderSelect(block, {
          value: state.value as string,
          open: state.open,
          highlightIndex: state.highlightIndex,
        }, ctx);
      }

      case "checkbox": {
        const state = this.getInputState(block.id, block.defaultValue ?? false);
        return renderCheckbox(block, state.value as boolean, ctx);
      }

      case "toggle": {
        const state = this.getInputState(block.id, block.defaultValue ?? false);
        return renderToggle(block, state.value as boolean, ctx);
      }

      case "radioGroup": {
        const state = this.getInputState(block.id, block.defaultValue ?? "");
        return renderRadioGroup(block, {
          value: state.value as string,
          highlightIndex: state.highlightIndex,
        }, ctx);
      }

      case "numberInput": {
        const state = this.getInputState(block.id, block.defaultValue ?? 0);
        return renderNumberInput(block, {
          value: state.value as number,
          editing: !!ctx.editing,
          textBuffer: "",
        }, ctx);
      }

      case "searchInput": {
        const state = this.getInputState(block.id, "");
        const maxResults = block.maxResults ?? 10;
        const filtered = filterSearchItems(block.items, state.value as string, maxResults);
        return renderSearchInput(block, {
          query: state.value as string,
          cursorPos: state.cursorPos,
          editing: !!ctx.editing,
          highlightIndex: state.highlightIndex,
          filteredItems: filtered,
        }, ctx);
      }

      case "button": {
        const isLoading = this.buttonLoading.get(block.label) ?? false;
        return renderButton(block, ctx, isLoading);
      }

      case "form": {
        // Form renders its fields via renderContentBlocks
        const formLines = this.renderContentBlocks(block.fields, ctx);
        const formResult = this.formResults.get(block.id);
        if (formResult) {
          formLines.push("");
          formLines.push(...renderFormResult(
            { resultMessage: formResult.message, resultType: formResult.type },
            ctx,
          ));
        }
        return formLines;
      }

      case "asyncContent":
        // Handled in renderBlocksRecursive
        return [];

      case "dynamic": {
        // Use cached results for stable object references
        const dynamicBlocks = this.resolveDynamic(block as DynamicBlock);
        return this.renderContentBlocks(dynamicBlocks, ctx);
      }

      default:
        return [];
    }
  }

  private writeToTerminal(lines: string[], columns: number, rows: number): void {
    let displayLines = lines;

    let output = "\x1b[H"; // move to top-left

    for (let i = 0; i < rows; i++) {
      output += "\x1b[2K"; // clear line
      if (i < displayLines.length) {
        const line = displayLines[i];
        const lineW = stringWidth(line);
        if (lineW > columns) {
          output += truncateLine(line, columns);
        } else {
          output += line;
        }
      }
      if (i < rows - 1) {
        output += "\n";
      }
    }

    // Command mode / feedback / notification at bottom
    if (this.commandMode) {
      output += `\x1b[${rows};1H\x1b[2K`;
      output += renderInput(":", this.commandBuffer, this.createRenderContext(columns)).join("");
    } else {
      const notification = this.notifications.current;
      if (notification) {
        output += `\x1b[${rows};1H\x1b[2K`;
        let color: string;
        let icon: string;
        switch (notification.type) {
          case "success": color = this.theme.success; icon = "\u2713"; break;
          case "error": color = this.theme.error; icon = "\u2717"; break;
          default: color = this.theme.accent; icon = "\u2139"; break;
        }
        output += fgColor(color) + "  " + icon + " " + notification.message + reset;
      } else if (this.feedbackMessage) {
        output += `\x1b[${rows};1H\x1b[2K`;
        output += fgColor(this.theme.success) + "  " + this.feedbackMessage + reset;
      }
    }

    // Show/hide cursor based on edit mode
    if (this.inputMode.isEditing) {
      output += "\x1b[?25h"; // show cursor
    } else {
      output += "\x1b[?25l"; // hide cursor
    }

    process.stdout.write(output);
  }
}

export async function runSite(site: Site): Promise<void> {
  const runtime = new TUIRuntime(site);
  await runtime.start();
}
