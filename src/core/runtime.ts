/**
 * TUIRuntime — the main runtime orchestrator.
 * Coordinates input, rendering, navigation, and form handling.
 * Method implementations are split across:
 *   - runtime-input.ts  (key handling)
 *   - runtime-render.ts (rendering)
 *   - runtime-pages.ts  (navigation, focus)
 *   - runtime-forms.ts  (forms, actions)
 */
import { dirname } from "node:path";
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
import { stopAllVideo, sweepPlayers, videoActive } from "../video/player.js";
import { setVideoRepaintHook } from "../video/source.js";
import { InputModeManager } from "./input-mode.js";
import { NotificationManager } from "./notifications.js";
import { AsyncContentManager } from "../data/async-content.js";
import { ApiServer } from "../api/server.js";
import { setApiBaseUrl } from "../api/resolve.js";
import { destroyAllFetchers } from "../data/fetcher.js";
import { createInputState, type InputFieldState } from "../data/types.js";
import { stringWidth } from "../components/base.js";
import { setImageProjectDir, setGraphicsSink, setImageTermType } from "../components/Image.js";
import {
  detectGraphics, getGraphicsCapability, probeGraphics, setGraphicsCapability,
  type GraphicsCapability,
} from "../image/capability.js";
import { encodeDelete, imageIdColor } from "../image/kitty.js";
import { onKittyEvicted } from "../image/cache.js";
import { getInputDefault } from "../components/Form.js";
import type { RenderContext } from "../components/base.js";
import type { FocusItem, FormResult } from "./runtime-types.js";
import type { TerminalIO } from "./terminal-io.js";
import { ProcessTerminalIO } from "./terminal-io.js";
import { createGraphicsState } from "./runtime-internal.js";
import type { RuntimeInternal, PageLayoutCache, FrameState, GraphicsState } from "./runtime-internal.js";
import type { FileRouter } from "../router/resolver.js";

import { runtimeContext, type RuntimeRef } from "./runtime-context.js";

// Delegated modules
import { handleCommandMode, handleNavigationMode, handleEditMode } from "./runtime-input.js";
import { renderMain, renderBlock as _renderBlock, renderContentBlocks as _renderContentBlocks, resolveDynamic, isBlockFocusable as _isBlockFocusable } from "./runtime-render.js";
import { bumpVideoRenderSeq } from "./runtime-block-render.js";
import { INPUT_TYPES, TEXT_ENTRY_TYPES } from "./block-taxonomy.js";
import { contentWidth } from "./layout-constants.js";
import { navigateToPage as _navigateToPage, enterPage as _enterPage, getCurrentPage as _getCurrentPage, getPageContent as _getPageContent, resolvePageTitle as _resolvePageTitle, resolvePageLoading as _resolvePageLoading, collectFocusItems as _collectFocusItems, pageFocusNext as _pageFocusNext, pageFocusPrev as _pageFocusPrev, initializePageContent as _initializePageContent, registerForms as _registerForms, showFeedback as _showFeedback, executeCommand as _executeCommand } from "./runtime-pages.js";
import { handlePageSelect as _handlePageSelect, validateInput as _validateInput, resetFormFields as _resetFormFields } from "./runtime-forms.js";

export class TUIRuntime implements RuntimeInternal {
  /** @internal */ site: SiteConfig;
  /** @internal */ theme: Theme;
  /** @internal */ router: Router;
  /** @internal */ focus: FocusManager;
  /** @internal */ borderStyle: BorderStyle;
  /** @internal File router when running file-based projects. */
  fileRouter: FileRouter | null = null;
  /** @internal Absolute project root — relative asset paths resolve against
   *  this rather than process.cwd(). Assigned by the entry point that knows
   *  the project (runFileBasedSite, serve); undefined for bare embedders. */
  projectDir: string | undefined = undefined;
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
  /** @internal */ resolvedPageParams: Map<string, string> = new Map();
  /** @internal */ formRegistry: Map<string, FormBlock> = new Map();
  /** @internal */ currentParams: RouteParams = {};
  /** @internal */ dynamicCache: Map<string, ContentBlock[]> = new Map();
  /** @internal Structural-path state keys (see block-walker stampBlockKeys). */
  blockKeys: WeakMap<ContentBlock, string> = new WeakMap();
  /** @internal renderMain layout cache — static pages skip per-frame recompute. */
  layoutCache: PageLayoutCache = { contentRef: null, columns: 0, rows: 0, volatile: false };
  /** @internal Line-diff renderer's previous-frame buffer — one per terminal stream (SSH sessions isolated). */
  frameState: FrameState = { rows: [], columns: 0, rowCount: 0, cursorShown: false, valid: false };
  /** @internal Kitty graphics bookkeeping — one per terminal stream, same isolation rule. */
  graphics: GraphicsState = createGraphicsState();
  /**
   * @internal This session's graphics verdict, settled once at start.
   *
   * Held on the instance and re-published before every frame for the same
   * reason `_colorMode` is: capability.ts's session slot is module-level, so in
   * a serve process a kitty client and an Apple Terminal client would otherwise
   * take turns overwriting it and each would occasionally render the other's
   * tier. Null until `start()` settles it, which is what keeps a bare
   * `new TUIRuntime(...).render()` (unit tests, embedders) from clobbering a
   * value it never established.
   */
  private graphicsCapability: GraphicsCapability | null = null;
  /** @internal Unsubscribe from cache-eviction notices; installed at start, dropped at cleanup. */
  private graphicsUnsubscribe: (() => void) | null = null;
  /** @internal True while the post-transmit repaint is running (re-entry guard). */
  private graphicsRepainting = false;
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
   *
   * KITTY IMAGES ARE NOT RETIRED HERE, and that is a deliberate reversal.
   * This method used to queue a delete for every live image on the theory that
   * after an out-of-band paint we no longer know what the terminal is showing.
   * Only half of that is true: an `\x1b[2J` erases the placeholder CELLS, not
   * the pixels — those live in the terminal's own image store, keyed by id —
   * and a full redraw re-emits the cells, which is sufficient. Verified on
   * kitty 0.46: after a full clear, re-emitting the identical placement rows
   * brings the picture back with no re-transmission at all.
   *
   * Retiring them cost a re-send of every on-screen image on EVERY SIGWINCH,
   * because the resize handler calls this per event. Measured on a 110x60
   * terminal with a 99-column image: 1963 KiB and 15 ms of synchronous work per
   * resize event, 19.17 MiB across a ten-event window drag, with the geometry —
   * and therefore the image id — never changing. Over SSH that stalls the
   * channel for seconds and the app looks hung.
   * @internal
   */
  invalidateFrame(): void {
    this.frameState.valid = false;
  }

  /**
   * Record that a kitty image appears in the frame being composed.
   *
   * Called from `renderImage()` for every kitty-tier block on every frame, so
   * the steady-state path is deliberately two set operations and nothing else:
   * no encoding, no writing, no allocation. `transmit` is a thunk that is
   * passed every time and INVOKED almost never — that is what keeps "exactly
   * one transmission per (image, size, terminal)" a property enforced in ONE
   * place instead of a rule every caller has to remember, and it is why a
   * megabyte of base64 is never built on a frame that does not need it.
   *
   * The thunk is not invoked HERE either, even on the first placement: this
   * runs while the page is being composed in full, before it is sliced to the
   * viewport, so a block that scrolls off the bottom reaches this line exactly
   * like one the viewer can see. `graphicsCommit()` invokes the thunks that
   * survived the slice. See {@link GraphicsState.intent}.
   *
   * @returns False when this id is known-dead — its thunk threw on an earlier
   *   frame, so the source stopped being decodable. The caller MUST then demote
   *   to the cell tiers; leaving placement cells on screen for pixels that will
   *   never arrive is the one failure mode the kitty path is not allowed to
   *   have, and it used to be permanent (every frame retried the dead decode
   *   behind a grid of tofu).
   * @internal
   */
  graphicsPlace(id: number, transmit: () => string): boolean {
    const g = this.graphics;
    if (g.failed.has(id)) return false;
    g.placed.add(id);
    if (!g.sent.has(id)) g.intent.set(id, transmit);
    return true;
  }

  /**
   * Resolve this frame's placement intents against the frame that was actually
   * composed, and queue the transmissions the viewer can see.
   *
   * Called from `writeToTerminal` with the composed rows, before any byte goes
   * out. An image's placement rows all carry `imageIdColor(id)`, a literal
   * 24-bit SGR unique to the id, so "is this image on screen" is one exact
   * substring test per un-transmitted image — and there are none of those on a
   * steady-state frame, which is why this costs nothing in the common case.
   *
   * A thunk that throws marks the id dead and invalidates the frame, so the
   * very next paint re-runs `renderImage`, gets `false` from `graphicsPlace`
   * and draws cells. One frame can therefore carry placement cells for pixels
   * that never arrived; before this the condition was permanent.
   * @internal
   */
  graphicsCommit(frameRows: readonly string[]): void {
    const g = this.graphics;
    if (g.intent.size === 0) return;
    let onScreen: string | null = null;
    for (const [id, transmit] of g.intent) {
      // `inFlight` means the bytes are already queued from an earlier frame
      // whose write failed. Building a second copy would put the same image on
      // the wire twice; the queued one is retried by `drainGraphics`.
      if (g.sent.has(id) || g.inFlight.includes(id)) continue;
      onScreen ??= frameRows.join("\n");
      if (!onScreen.includes(imageIdColor(id))) continue;
      try {
        g.queue.push(transmit());
      } catch {
        // The source stopped decoding between the cache entry being built and
        // now. Demote permanently rather than retrying a known-dead decode.
        g.failed.add(id);
        this.frameState.valid = false;
        continue;
      }
      g.inFlight.push(id);
      g.pendingTransmit = true;
    }
    g.intent.clear();
  }

  /**
   * Settle this frame's graphics: delete what left the screen, write what is
   * owed, and repaint if pixels arrived after the cells that reference them.
   *
   * Runs AFTER `renderMain()` — i.e. after `writeToTerminal()` has put the
   * frame on screen — because the payload must go down the unfiltered
   * `writeOutput()` pipe and never through the row composer, where `cutToWidth`
   * would shred base64 at the first `m` and the C0 strip would eat the escape.
   *
   * THE REPAINT. A placeholder cell references an image by id; a terminal that
   * meets the cell before the transmission has nothing to draw there. kitty and
   * Ghostty both mark the screen dirty when an image arrives and would repaint
   * on their own, but neither behaviour is written down as a guarantee, and
   * "the first frame after an image appears is blank" is a bug that would only
   * show up on hardware nobody here has. So when a transmission actually went
   * out, the frame is invalidated and composed once more, which re-emits the
   * placeholder rows with the pixels already in place. It costs one extra frame
   * composition per image per size — never on a steady-state frame, because
   * nothing is queued then.
   *
   * A PLAYING VIDEO IS EXEMPT. It transmits a new id every frame, so "one extra
   * composition per image" becomes one extra composition per FRAME, forever —
   * the whole page laid out, composed and diffed twice, 12 times a second, and
   * two full frames written where one was wanted. The guarantee the repaint
   * buys is not needed there either: the thing it protects against is a
   * placement that sits on screen indefinitely with no pixels behind it, and a
   * video re-places 83 ms later regardless. The worst case is that the very
   * first frame of a clip is blank on a terminal that does not self-repaint,
   * and the second one is not.
   */
  private settleGraphics(): void {
    if (this.drainGraphics() && !this.graphicsRepainting && !videoActive(this)) {
      this.graphicsRepainting = true;
      try {
        this.invalidateFrame();
        renderMain(this);
        this.drainGraphics();
      } finally {
        this.graphicsRepainting = false;
      }
    }
  }

  /**
   * One sweep-and-write pass.
   * @returns True when a transmission was written, i.e. the placeholder rows on
   *   screen were composed before the pixels they reference existed.
   */
  private drainGraphics(): boolean {
    const g = this.graphics;

    // Anything on screen last frame and absent from this one has left: a page
    // navigation, a resize that re-keyed the image, a block that stopped
    // rendering. Free the terminal's copy — nothing else ever will.
    for (const id of g.lastPlaced) {
      if (g.placed.has(id)) continue;
      if (g.sent.delete(id)) g.queue.push(encodeDelete(id));
    }
    // Swap the two sets and reuse the emptied one, so a steady-state frame
    // allocates nothing here.
    const recycled = g.lastPlaced;
    g.lastPlaced = g.placed;
    recycled.clear();
    g.placed = recycled;

    const wrote = g.pendingTransmit;
    g.pendingTransmit = false;
    if (g.queue.length === 0) return false;

    // An id counts as DELIVERED only once its bytes have left the process. The
    // bookkeeping used to run at queue time, so a throwing `writeOutput` left
    // the id recorded as sent forever while its placeholder rows sat on screen
    // over nothing. Clearing the queue after the write has the same shape: a
    // failed write simply retries everything on the next frame.
    this.writeOutput(g.queue.join(""));
    g.queue.length = 0;
    for (const id of g.inFlight) g.sent.add(id);
    g.inFlight.length = 0;
    return wrote;
  }

  /**
   * Free a kitty image the render cache has dropped. A SAFETY NET, not the
   * primary path — the per-frame sweep in `drainGraphics()` already deletes
   * every image that stops being placed, and an evicted entry stops being
   * placed by construction (its id is gone, so the next frame allocates a new
   * one). This exists so that a future caller who bypasses the sweep still
   * cannot leak pixels into the terminal's 320 MB quota.
   *
   * Two guards, both load-bearing:
   *
   * - An id that is placed in the frame being composed, or in the frame on
   *   screen, is LEFT ALONE. Eviction fires synchronously from `setKittyImage`,
   *   i.e. in the middle of a render, so a page with two images can evict the
   *   first one's entry after its placeholder rows are already composed —
   *   deleting there would blank a rectangle the user is looking at. The sweep
   *   removes it one frame later, when it is genuinely gone.
   * - The cache is process-wide and this runtime may never have transmitted the
   *   id. `sent.delete()` returning false is the normal case in a serve process
   *   with several sessions, and is what keeps one client from deleting
   *   another client's pixels.
   */
  private onGraphicsEvicted(id: number): void {
    const g = this.graphics;
    if (g.placed.has(id) || g.lastPlaced.has(id)) return;
    if (!g.sent.delete(id)) return;
    g.queue.push(encodeDelete(id));
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

    // Publish the project root BEFORE the first layout pass. The flex engine
    // sizes an image block by reading its header, and it reaches the file
    // through the same module-level root the renderer uses. Setting it only
    // from renderImage() would leave frame 1's estimator resolving relative
    // paths against the shell's cwd — it would reserve the square placeholder
    // geometry, and runtime-render.ts's layout cache would keep that stale
    // rect until content identity or the terminal size changed.
    setImageProjectDir(this.projectDir);

    // A video whose source still has to be packed renders its alt box and asks
    // to be woken when ffmpeg finishes. Without this the picture would sit on
    // the placeholder until some unrelated event happened to trigger a repaint.
    setVideoRepaintHook(() => this.render());

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

    // Graphics capability, in the ONE window where asking is safe: after
    // setupTerminal() (raw mode is needed to read a reply un-line-buffered, and
    // terminal setup belongs to that method) and before _input.start() (once
    // InputManager has attached its listener, every reply byte reaches the key
    // handler too — input.ts swallows them correctly today, but a probe that
    // depends on that is a probe waiting to break).
    //
    // probeGraphics() is safe to call unconditionally on the local path: it
    // re-runs the env ladder first and writes ZERO bytes unless the environment
    // is a local interactive TTY that names no terminal it recognises. Apple
    // Terminal, tmux, CI and piped stdio all return immediately.
    if (this.terminalIO instanceof ProcessTerminalIO) {
      this.graphicsCapability = await probeGraphics(this.terminalIO);
    } else {
      // A serve session: the client's pty-req TERM is the ONLY evidence, and an
      // env sniff here would describe the SERVER's shell. Synchronous, emits
      // nothing, and an absent termType resolves to "denied" — cells, never
      // escape bytes aimed at a terminal that cannot read them.
      this.graphicsCapability = detectGraphics({ termType: this.terminalIO.termType ?? "" });
      setGraphicsCapability(this.graphicsCapability);
    }
    // Freeing a dropped image is this runtime's job because only it knows which
    // terminal holds the pixels; the cache cannot import from src/core.
    this.graphicsUnsubscribe = onKittyEvicted(id => this.onGraphicsEvicted(id));

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
    if (this.graphicsUnsubscribe) { this.graphicsUnsubscribe(); this.graphicsUnsubscribe = null; }
    // Hand the terminal's graphics memory back before the alt screen goes away.
    // The ORDERING is load-bearing and must not be "tidied": on kitty an image
    // transmitted on the primary screen renders as nothing inside the alternate
    // screen, so the deletes have to go out before `ESC[?1049l`, not after.
    //
    // Written directly rather than queued: this is the last chance, there will
    // be no further frame to drain the queue, and the payload is a handful of
    // bytes per image. The QUEUE is flushed as well as the live set, in case a
    // frame was composed but never drained. In-flight ids count as live: their
    // bytes may or may not have landed, and a delete for an image the terminal
    // does not hold is a no-op while a leak is not.
    const g = this.graphics;
    if (g.sent.size > 0 || g.queue.length > 0 || g.inFlight.length > 0) {
      let payload = g.queue.join("");
      g.queue.length = 0;
      for (const id of g.inFlight) g.sent.add(id);
      g.inFlight.length = 0;
      for (const id of g.sent) payload += encodeDelete(id);
      g.sent.clear();
      g.lastPlaced.clear();
      g.placed.clear();
      g.intent.clear();
      try { this.terminalIO.write(payload); } catch { /* terminal already gone */ }
    }
    if (this.bootTimer) clearInterval(this.bootTimer);
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    if (this.notificationTimer) clearInterval(this.notificationTimer);
    if (this.spinnerTimer) { clearTimeout(this.spinnerTimer); this.spinnerTimer = null; }
    if (this.apiServer) this.apiServer.stop();
    // Process-global singletons (animation engine, fetcher registry, api base
    // URL slot, render-callback fallback) are shared by every SSH session in
    // this process — only the runtime that owns the local terminal may tear
    // them down, or one session's disconnect would break its siblings.
    // Per-runtime, not process-global: an SSH session disconnecting must stop
    // ITS videos without touching a sibling session's, so this sits outside the
    // ProcessTerminalIO guard below.
    stopAllVideo(this);
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
    // The image renderer reaches this runtime through a module-level slot, the
    // same way it reaches the colour mode: renderBlock()'s signature is fixed,
    // and the whole render pass is synchronous, so a set/restore pair around it
    // is exact even with several SSH sessions in one process.
    const prevSink = setGraphicsSink(this);
    // The client's TERM, so the cell ladder negotiates against the viewer's
    // terminal rather than the daemon's. `?? ""` keeps a remote session in
    // remote mode even when the client sent no pty-req TERM — an unknown
    // remote must fall back to the tier that asks least of the far end, not to
    // whatever the server's own shell happens to advertise. Matches how the
    // graphics verdict is resolved for the same session.
    const prevTermType = setImageTermType(
      this.terminalIO instanceof ProcessTerminalIO ? undefined : this.terminalIO.termType ?? "",
    );
    setColorMode(this._colorMode);
    // Re-assert this session's graphics verdict, not just its colour mode:
    // both live in module-level slots, and in a serve process the sibling
    // session that rendered last left its own value there. RESTORED in the
    // `finally` like the other three, which it was not: the slot is readable
    // outside a render pass — `detectTerminal().graphics` is a documented
    // public helper and a page function may consult it while its content is
    // being resolved — so leaving another session's terminal in it told the
    // wrong client the wrong story. (The pillars demo's home page is exactly
    // such a page.)
    const prevCap = getGraphicsCapability();
    if (this.graphicsCapability !== null) setGraphicsCapability(this.graphicsCapability);
    // One tick of the departure sweep per render PASS. Advancing it before
    // renderMain means every video block drawn in this pass stamps the NEW
    // value, and any player that was not drawn keeps an older one — which is
    // exactly the signal `sweepPlayers` reads to decide a block has left the
    // tree. There is no per-block teardown hook to do this properly.
    const seq = bumpVideoRenderSeq(this);
    try {
      renderMain(this);
      // After the frame is on screen, never before: the transmission is raw
      // base64 and must bypass the row composer entirely.
      this.settleGraphics();
      sweepPlayers(this, seq);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (!this.site.onError || this.handlingError) throw error;
      this.invokeOnError(error, { page: this.getCurrentPage()?.id, params: this.currentParams, phase: "render" });
    } finally {
      setColorMode(prev);
      setGraphicsSink(prevSink);
      setImageTermType(prevTermType);
      setGraphicsCapability(prevCap);
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
  /** @internal */ resolvePageLoading(page: PageConfig): string { return _resolvePageLoading(this, page); }
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
  /**
   * @internal Whether a block takes a focus slot.
   *
   * Routed through runtime-render (i.e. runtime-block-render's widened version)
   * rather than block-taxonomy: focusability is no longer decidable from the
   * block TYPE alone, because `image(..., { resizable: true })` confers a slot
   * that a plain image does not have. Answering from the taxonomy here would
   * disagree with the walkers that actually assign focus indices.
   */
  isBlockFocusable(block: ContentBlock): boolean { return _isBlockFocusable(block); }

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
  /** Absolute project root. Defaults to the parent of `pagesDir`, which is
   *  the project root by construction for every caller (`<project>/pages`). */
  projectDir?: string;
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
    serve: opts.config.serve,
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
  // Relative asset paths resolve against the project, not the shell's cwd —
  // `terminaltui dev demos/x/config.ts` and `terminaltui demo <name>` (which
  // lives under node_modules) are both run from somewhere else entirely.
  runtime.projectDir = opts.projectDir ?? dirname(opts.pagesDir);

  await runtime.start();
}
