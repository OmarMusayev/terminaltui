/**
 * TUIRuntime — the main runtime orchestrator.
 * Coordinates input, rendering, navigation, and form handling.
 * Method implementations are split across:
 *   - runtime-input.ts  (key handling)
 *   - runtime-render.ts (rendering)
 *   - runtime-pages.ts  (navigation, focus)
 *   - runtime-forms.ts  (forms, actions)
 */
import type {
  Site, SiteConfig, PageConfig, ContentBlock, DynamicBlock, FormBlock,
} from "../config/types.js";
import type { RouteParams } from "../router/types.js";
import type { ErrorContext } from "../lifecycle/types.js";
import { setNavigateHandler } from "../router/navigate.js";
import { setRenderCallback } from "../state/reactive.js";
import { loadEnv } from "../config/env-loader.js";
import { themes, defaultTheme, type Theme, type BuiltinThemeName } from "../style/theme.js";
import { fgColor, reset, bold, setColorMode, getColorMode, type ColorMode } from "../style/colors.js";
import type { BorderStyle } from "../style/borders.js";
import { detectTerminal } from "../helpers/detect-terminal.js";
import { InputManager, type KeyPress } from "./input.js";
import { Screen, type ScreenSize } from "./screen.js";
import { Router } from "../navigation/router.js";
import { FocusManager } from "../navigation/focus.js";
import type { FocusRect } from "../layout/types.js";
import { animationEngine } from "../animation/engine.js";
import { InputModeManager } from "./input-mode.js";
import { NotificationManager } from "./notifications.js";
import { AsyncContentManager } from "../data/async-content.js";
import { ApiServer } from "../api/server.js";
import { setApiBaseUrl } from "../api/resolve.js";
import { destroyAllFetchers } from "../data/fetcher.js";
import { createInputState, type InputFieldState } from "../data/types.js";
import { stringWidth } from "../components/base.js";
import { getInputDefault } from "../components/Form.js";
import type { RenderContext } from "../components/base.js";
import type { FocusItem, FormResult } from "./runtime-types.js";
import type { TerminalIO } from "./terminal-io.js";
import { ProcessTerminalIO } from "./terminal-io.js";
import type { RuntimeInternal, PageLayoutCache, FrameState } from "./runtime-internal.js";
import type { FileRouter } from "../router/resolver.js";

import { runtimeContext, type RuntimeRef } from "./runtime-context.js";

// Delegated modules
import { handleCommandMode, handleNavigationMode, handleEditMode } from "./runtime-input.js";
import { renderMain, renderBlock as _renderBlock, renderContentBlocks as _renderContentBlocks, resolveDynamic } from "./runtime-render.js";
import { isBlockFocusable as _isBlockFocusable, INPUT_TYPES, TEXT_ENTRY_TYPES } from "./block-taxonomy.js";
import { contentWidth } from "./layout-constants.js";
import { navigateToPage as _navigateToPage, enterPage as _enterPage, getCurrentPage as _getCurrentPage, getPageContent as _getPageContent, resolvePageTitle as _resolvePageTitle, collectFocusItems as _collectFocusItems, pageFocusNext as _pageFocusNext, pageFocusPrev as _pageFocusPrev, initializePageContent as _initializePageContent, registerForms as _registerForms, showFeedback as _showFeedback, executeCommand as _executeCommand } from "./runtime-pages.js";
import { handlePageSelect as _handlePageSelect, validateInput as _validateInput, resetFormFields as _resetFormFields } from "./runtime-forms.js";

export class TUIRuntime implements RuntimeInternal {
  /** @internal */ site: SiteConfig;
  /** @internal */ theme: Theme;
  /** @internal */ router: Router;
  /** @internal */ focus: FocusManager;
  /** @internal */ borderStyle: BorderStyle;
  /** @internal File router when running file-based projects. */
  fileRouter: FileRouter | null = null;
  /** @internal Focused block exposed to nested layout renderers. */
  currentFocusedBlock: ContentBlock | undefined = undefined;
  /** @internal */ scrollOffset = 0;
  /** @internal */ commandMode = false;
  /** @internal */ commandBuffer = "";
  /** @internal */ feedbackMessage = "";
  /** @internal */ feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  /** @internal */ accordionState: Map<string, number> = new Map();
  /** @internal */ tabState: Map<string, number> = new Map();
  /** @internal */ galleryState: Map<string, number> = new Map();
  /** @internal */ pageFocusIndex = 0;
  /** @internal */ pageFocusItems: FocusItem[] = [];
  /** @internal */ pageScrollOffset = 0;
  /** @internal */ bootComplete = false;
  /** @internal */ bootFrame = 0;
  /** @internal */ bootTimer: ReturnType<typeof setInterval> | null = null;
  /** @internal */ inputMode = new InputModeManager();
  /** @internal */ inputStates: Map<string, InputFieldState> = new Map();
  /** @internal */ formResults: Map<string, FormResult> = new Map();
  /** @internal */ buttonLoading: Map<string, boolean> = new Map();
  /** @internal */ notifications = new NotificationManager();
  /** @internal */ notificationTimer: ReturnType<typeof setInterval> | null = null;
  /** @internal */ asyncManager = new AsyncContentManager();
  /** @internal */ spinnerTimer: ReturnType<typeof setTimeout> | null = null;
  /** @internal */ resolvedPageContent: Map<string, ContentBlock[]> = new Map();
  /** @internal */ formRegistry: Map<string, FormBlock> = new Map();
  /** @internal */ currentParams: RouteParams = {};
  /** @internal */ dynamicCache: Map<string, ContentBlock[]> = new Map();
  /** @internal Structural-path state keys (see block-walker stampBlockKeys). */
  blockKeys: WeakMap<ContentBlock, string> = new WeakMap();
  /** @internal renderMain layout cache — static pages skip per-frame recompute. */
  layoutCache: PageLayoutCache = { contentRef: null, columns: 0, rows: 0, volatile: false };
  /** @internal Line-diff renderer's previous-frame buffer — one per terminal stream (SSH sessions isolated). */
  frameState: FrameState = { rows: [], columns: 0, rowCount: 0, cursorShown: false, valid: false };
  /** @internal */ apiServer: ApiServer | null = null;
  /** @internal */ apiBaseUrl: string | null = null;
  /** @internal */ focusRects: FocusRect[] = [];
  /** @internal */ terminalIO: TerminalIO;
  /** @internal */ _screen: Screen;
  /** @internal */ _input: InputManager;
  /** @internal */ _colorMode: ColorMode = "256";
  /** @internal */ handlingError = false;

  constructor(site: Site, terminalIO?: TerminalIO) {
    this.site = site.config;
    this.theme = this.resolveTheme(site.config.theme);
    this.borderStyle = site.config.borders ?? "rounded";
    this.router = new Router();
    this.focus = new FocusManager();
    this.terminalIO = terminalIO ?? new ProcessTerminalIO();
    this._screen = new Screen();
    this._screen.attachIO(this.terminalIO);
    this._input = new InputManager();
    this._input.attachIO(this.terminalIO);

    const allIds = site.config.pages.map(p => p.id);
    this.router.registerPages(allIds);

    const menuIds = site.config.pages
      .filter(p => typeof p.title === "string" && !(p as any)._hidden)
      .map(p => p.id);
    this.focus.setItems(menuIds);
  }

  /** Whether this runtime is serving over SSH (not a local terminal). */
  get isServeMode(): boolean {
    if (this.terminalIO instanceof ProcessTerminalIO) return false;
    // Allow openUrls override from serve config
    if (this.site.serve?.openUrls === true) return false;
    return true;
  }

  /** Get the current screen size from this runtime's terminal. */
  get screenSize(): ScreenSize {
    return this._screen.size;
  }

  /** Write output to this runtime's terminal. */
  writeOutput(data: string): void {
    this.terminalIO.write(data);
  }

  /**
   * Mark the previous-frame buffer stale so the next frame is a full
   * redraw. Every code path that writes to the terminal without going
   * through writeToTerminal (onError fallbacks, exit message, restore)
   * must call this.
   * @internal
   */
  invalidateFrame(): void {
    this.frameState.valid = false;
  }

  private detectRemoteColorMode(): import("../style/colors.js").ColorMode {
    const term = (this.terminalIO.termType ?? "").toLowerCase();
    // Known truecolor terminals
    if (
      term.includes("kitty") ||
      term.includes("ghostty") ||
      term.includes("wezterm") ||
      term.includes("alacritty") ||
      term.includes("truecolor") ||
      term.includes("24bit")
    ) return "truecolor";
    // 256-color terminals
    if (term.includes("256color")) return "256";
    // Basic terminals
    if (term && !term.includes("256") && !term.includes("color")) return "16";
    // Safe default
    return "256";
  }

  private resolveTheme(theme?: Theme | BuiltinThemeName): Theme {
    if (!theme) return defaultTheme;
    if (typeof theme === "string") return themes[theme] ?? defaultTheme;
    return theme;
  }

  async start(): Promise<void> {
    // Run inside an AsyncLocalStorage context so that all input handlers,
    // timers, and async chains forked from here resolve `currentRuntime()` to
    // this instance. Without this, concurrent SSH sessions would clobber each
    // other's render/navigate/api-base-url through shared module-level state.
    const ref: RuntimeRef = this;
    await runtimeContext.run(ref, () => this.startInner());
  }

  private async startInner(): Promise<void> {
    loadEnv();

    if (this.site.api && Object.keys(this.site.api).length > 0) {
      this.apiServer = new ApiServer();
      this.apiServer.registerRoutes(this.site.api);
      await this.apiServer.start();
      setApiBaseUrl(this.apiServer.getBaseUrl());
    }

    const caps = detectTerminal();
    if (this.terminalIO instanceof ProcessTerminalIO) {
      this._colorMode = caps.colorDepth;
    } else {
      const configMode = this.site.serve?.colorMode;
      if (configMode && configMode !== "auto") {
        this._colorMode = configMode;
      } else {
        this._colorMode = this.detectRemoteColorMode();
      }
    }
    setColorMode(this._colorMode);

    // Legacy callbacks for code paths outside an AsyncLocalStorage scope
    // (cross-package fetcher.ts; unit tests). Inside an active runtime,
    // currentRuntime() is consulted first so these clobbers don't matter.
    setRenderCallback(() => this.render());
    let renderTimer: ReturnType<typeof setTimeout> | null = null;
    (globalThis as any).__terminaltui_render_callback__ = () => {
      if (renderTimer) return;
      renderTimer = setTimeout(() => { renderTimer = null; this.render(); }, 0);
    };

    setNavigateHandler((pageId, params) => this.navigateToPage(pageId, params));

    if (this.site.onInit) {
      try {
        await this.site.onInit({ state: null, navigate: (pageId, params) => this.navigateToPage(pageId, params) });
      } catch (err) {
        console.error("[terminaltui] onInit error:", err);
      }
    }

    this.setupTerminal();
    // Treat every resize event as out-of-band damage, not just dimension
    // changes: SIGWINCH is coalesced, so a shrink+restore to the original
    // size delivers ONE event whose final dims equal the stored frame — the
    // dims check in writeToTerminal would diff to zero bytes while the real
    // terminal already clipped/blanked cells during the transient shrink.
    this._screen.on("resize", () => { this.invalidateFrame(); this.render(); });
    this._input.on("keypress", (key: KeyPress) => this.handleKey(key));
    // In-band resize (CSI 8;rows;cols t) — used when the host can't signal
    // real dimensions via the TTY (e.g. the emulator's non-PTY fallback).
    this._input.on("resize", ({ columns, rows }: { columns: number; rows: number }) => {
      this._screen.setSize(columns, rows);
    });
    this._input.start();

    this.notificationTimer = setInterval(() => {
      if (this.notifications.prune()) this.render();
    }, 500);

    if (this.site.animations?.boot) {
      this.runBootAnimation();
    } else {
      this.bootComplete = true;
      this.render();
    }
  }

  private setupTerminal(): void {
    this.terminalIO.write("\x1b[?1049h");
    this.terminalIO.write("\x1b[?25l");
    this.terminalIO.write("\x1b[2J");
    this.terminalIO.write("\x1b[H");
    // Only attach process-level signal handlers for local terminal sessions.
    // SSH sessions are cleaned up by the SSH server on channel close.
    if (this.terminalIO instanceof ProcessTerminalIO) {
      // Restore the terminal, then actually exit: registering a handler
      // cancels Node's default terminate-on-signal, so without process.exit
      // any user-held handle (timers, sockets) would leave a zombie with the
      // UI already torn down. Exit codes follow the 128+signum convention.
      const onSignal = (signal: "SIGINT" | "SIGTERM") => {
        try { this.cleanup(); } catch { /* keep exiting */ }
        process.exit(signal === "SIGINT" ? 130 : 143);
      };
      process.once("SIGINT", () => onSignal("SIGINT"));
      process.once("SIGTERM", () => onSignal("SIGTERM"));
      process.on("uncaughtException", (err) => { this.cleanup(); console.error(err); process.exit(1); });
    }
  }

  cleanup(): void {
    this._input.stop();
    this.asyncManager.cleanup();
    if (this.bootTimer) clearInterval(this.bootTimer);
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    if (this.notificationTimer) clearInterval(this.notificationTimer);
    if (this.spinnerTimer) { clearTimeout(this.spinnerTimer); this.spinnerTimer = null; }
    if (this.apiServer) this.apiServer.stop();
    // Process-global singletons (animation engine, fetcher registry, api base
    // URL slot, render-callback fallback) are shared by every SSH session in
    // this process — only the runtime that owns the local terminal may tear
    // them down, or one session's disconnect would break its siblings.
    if (this.terminalIO instanceof ProcessTerminalIO) {
      animationEngine.stop();
      destroyAllFetchers();
      if (this.apiServer) setApiBaseUrl(null);
      delete (globalThis as any).__terminaltui_render_callback__;
    }
    this.invalidateFrame(); // restore writes bypass writeToTerminal
    this.terminalIO.write("\x1b[?25h");
    this.terminalIO.write("\x1b[?1049l");
    this.terminalIO.write("\x1b[0m");
    this.terminalIO.dispose();
  }

  async stop(): Promise<void> {
    if (this.site.onExit) {
      try { await this.site.onExit({ state: null, navigate: () => {} }); } catch { /* ignore */ }
    }
    setRenderCallback(null);
    setNavigateHandler(null);
    if (this.site.animations?.exitMessage) {
      const { columns, rows } = this.screenSize;
      this.invalidateFrame(); // exit message bypasses writeToTerminal
      this.terminalIO.write("\x1b[2J\x1b[H");
      const msg = this.site.animations.exitMessage;
      const y = Math.floor(rows / 2);
      const x = Math.max(0, Math.floor((columns - stringWidth(msg)) / 2));
      // ANSI CUP is 1-based; y/x are 0-based offsets
      this.terminalIO.write(`\x1b[${y + 1};${x + 1}H`);
      this.terminalIO.write(fgColor(this.theme.accent) + bold + msg + reset);
      await new Promise(r => setTimeout(r, 800));
    }
    this.cleanup();
    // Only exit the process for local terminal sessions
    if (this.terminalIO instanceof ProcessTerminalIO) {
      process.exit(0);
    }
  }

  private runBootAnimation(): void {
    this.bootComplete = false;
    this.bootFrame = 0;
    const totalFrames = 30;
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

  // ─── Delegated methods ──────────────────────────────────

  private handleKey(key: KeyPress): void {
    try {
      if (this.commandMode) { handleCommandMode(this, key); return; }
      if (this.inputMode.isEditing) { this.handleEditMode(key); return; }
      handleNavigationMode(this, key);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (!this.site.onError) throw error;
      this.invokeOnError(error, { page: this.getCurrentPage()?.id, params: this.currentParams, phase: "action" });
    }
  }

  /**
   * Invoke the site-level onError lifecycle hook. If it returns fallback
   * blocks they are painted directly (renderMain may be the failing path);
   * a throwing hook must never take the app down.
   * @internal
   */
  invokeOnError(error: Error, context: ErrorContext): void {
    const hook = this.site.onError;
    if (!hook) throw error;
    if (this.handlingError) {
      console.error("[terminaltui] error while handling error:", error);
      this.invalidateFrame(); // stderr shares the TTY in local mode; console.error bypassed writeToTerminal
      return;
    }
    this.handlingError = true;
    try {
      const fallback = hook(error, context);
      if (Array.isArray(fallback)) {
        const { columns } = this.screenSize;
        const ctx: RenderContext = {
          width: Math.max(20, contentWidth(columns)),
          theme: this.theme,
          borderStyle: this.borderStyle,
        };
        const lines = this.renderContentBlocks(fallback, ctx);
        this.invalidateFrame(); // fallback paint bypasses writeToTerminal
        this.terminalIO.write("\x1b[2J\x1b[H");
        this.terminalIO.write(lines.join("\r\n"));
      } else if (context.phase === "render") {
        // Can't re-render through the failing pipeline; show a plain message.
        this.invalidateFrame(); // plain-text paint bypasses writeToTerminal
        this.terminalIO.write("\x1b[2J\x1b[H");
        this.terminalIO.write(`Error: ${error.message}`);
      } else {
        this.showFeedback(`Error: ${error.message}`);
      }
    } catch (hookErr) {
      console.error("[terminaltui] onError hook failed:", hookErr, "\noriginal error:", error);
      this.invalidateFrame(); // stderr shares the TTY in local mode; console.error bypassed writeToTerminal
    } finally {
      this.handlingError = false;
    }
  }

  /** @internal */ handleEditMode(key: KeyPress): void { handleEditMode(this, key); }
  /** @internal */ render(): void {
    const prev = getColorMode();
    setColorMode(this._colorMode);
    try {
      renderMain(this);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (!this.site.onError || this.handlingError) throw error;
      this.invokeOnError(error, { page: this.getCurrentPage()?.id, params: this.currentParams, phase: "render" });
    } finally {
      setColorMode(prev);
    }
  }
  /** @internal */ navigateToPage(pageId: string, params?: RouteParams): void {
    try {
      _navigateToPage(this, pageId, params);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (!this.site.onError) throw error;
      this.invokeOnError(error, { page: pageId, params, phase: "render" });
    }
  }
  /**
   * Swap the active theme. Used by both the `:theme` command and the
   * public `setTheme()` helper that pages call from button onPress.
   * Returns false if the name doesn't match a built-in theme.
   */
  setTheme(name: string): boolean {
    const theme = themes[name as keyof typeof themes];
    if (!theme) return false;
    this.theme = theme;
    this.render();
    return true;
  }
  /** @internal */ enterPage(): void { _enterPage(this); }
  /** @internal */ getCurrentPage(): PageConfig | undefined { return _getCurrentPage(this); }
  /** @internal */ getPageContent(page: PageConfig): ContentBlock[] | null { return _getPageContent(this, page); }
  /** @internal */ resolvePageTitle(page: PageConfig): string { return _resolvePageTitle(this, page); }
  /** @internal */ collectFocusItems(blocks: ContentBlock[]): FocusItem[] { return _collectFocusItems(this, blocks); }
  /** @internal */ initializePageContent(content: ContentBlock[]): void { _initializePageContent(this, content); }
  /** @internal */ registerForms(blocks: ContentBlock[]): void { _registerForms(this, blocks); }
  /** @internal */ pageFocusNext(): void { _pageFocusNext(this); }
  /** @internal */ pageFocusPrev(): void { _pageFocusPrev(this); }
  /** @internal */ handlePageSelect(): void { _handlePageSelect(this); }
  /** @internal */ showFeedback(msg: string): void { _showFeedback(this, msg); }
  /** @internal */ executeCommand(cmd: string): void { _executeCommand(this, cmd); }
  /** @internal */ validateInput(block: ContentBlock): boolean { return _validateInput(this, block); }
  /** @internal */ renderBlock(block: ContentBlock, ctx: RenderContext): string[] { return _renderBlock(this, block, ctx); }
  /** @internal */ isBlockFocusable(block: ContentBlock): boolean { return _isBlockFocusable(block); }

  renderContentBlocks(blocks: ContentBlock[], ctx: RenderContext): string[] {
    return _renderContentBlocks(this, blocks, ctx);
  }

  /** @internal */ getInputState(id: string, defaultValue?: unknown): InputFieldState {
    let state = this.inputStates.get(id);
    if (!state) { state = createInputState(defaultValue); this.inputStates.set(id, state); }
    return state;
  }

  /**
   * Component-state key for a block: the stamped structural-path key if
   * present, else the caller's legacy label-derived key (defensive fallback
   * so an unstamped block degrades to the pre-Stage-3 behavior).
   * @internal
   */
  getBlockKey(block: ContentBlock, legacyKey: () => string): string {
    return this.blockKeys.get(block) ?? legacyKey();
  }

  /** @internal */ getFocusedInputBlock(): ContentBlock | null {
    const item = this.pageFocusItems[this.pageFocusIndex];
    if (!item || item.kind !== "block") return null;
    const block = item.block;
    if (INPUT_TYPES.has(block.type)) return block;
    return null;
  }

  /** @internal */ getFocusedInputId(): string | null {
    const block = this.getFocusedInputBlock();
    if (!block) return null;
    return (block as any).id ?? null;
  }

  /** @internal */ isTextEntryType(type: string): boolean {
    return TEXT_ENTRY_TYPES.has(type);
  }

  /** @internal */ isAutoEditKey(key: KeyPress): boolean {
    if (key.char && key.char.length === 1 && !key.ctrl) {
      const navKeys = ["up", "down", "left", "right", "escape", "return", "delete", "home", "end", "tab"];
      if (!navKeys.includes(key.name)) return true;
    }
    if (key.name === "space") return true;
    if (key.name === "backspace") return true;
    return false;
  }

  resetForm(formId: string): void {
    const formBlock = this.formRegistry.get(formId);
    if (formBlock) { _resetFormFields(this, formBlock); this.render(); }
  }

  clearField(fieldId: string): void {
    const state = this.inputStates.get(fieldId);
    if (state) { state.value = ""; state.cursorPos = 0; state.error = null; this.render(); }
  }
}

/**
 * Run a file-based routing project.
 * Scans pages/, builds route table, and converts to SiteConfig before starting.
 */
export async function runFileBasedSite(opts: {
  config: import("../router/types.js").FileBasedConfig;
  pagesDir: string;
  apiDir?: string;
  outDir: string;
  terminalIO?: TerminalIO;
}): Promise<void> {
  const { FileRouter } = await import("../router/resolver.js");

  const router = new FileRouter({
    config: opts.config,
    pagesDir: opts.pagesDir,
    apiDir: opts.apiDir,
    outDir: opts.outDir,
  });

  await router.initialize();

  // Validate project structure and warn about issues
  router.validateAndPrint();

  // Build pages array from file-based routes
  const pages = await router.buildPagesArray();

  // Load API routes
  const apiRoutes = await router.loadApiRoutes();

  // Build SiteConfig
  const siteConfig: SiteConfig = {
    name: opts.config.name,
    handle: opts.config.handle,
    tagline: opts.config.tagline,
    banner: opts.config.banner,
    theme: opts.config.theme,
    borders: opts.config.borders,
    animations: opts.config.animations,
    navigation: opts.config.navigation,
    easterEggs: opts.config.easterEggs,
    footer: opts.config.footer,
    statusBar: opts.config.statusBar,
    artDir: opts.config.artDir,
    middleware: opts.config.middleware,
    menu: opts.config.menu,
    pages,
    api: {
      ...(apiRoutes || {}),
    },
    onInit: opts.config.onInit,
    onExit: opts.config.onExit,
    onNavigate: opts.config.onNavigate,
    onError: opts.config.onError,
  };

  // Store the menu items from the router on the runtime for menu rendering
  const site: Site = { config: siteConfig };
  const runtime = new TUIRuntime(site, opts.terminalIO);

  // Attach file router for menu({ source: "auto" }) resolution
  runtime.fileRouter = router;

  await runtime.start();
}
