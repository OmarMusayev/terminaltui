/**
 * The runtime surface shared by the runtime-*.ts implementation modules.
 * TUIRuntime `implements` this; modules take `rt: RuntimeInternal` instead of
 * local drifting `RT` interfaces. Private machinery (_screen, _input,
 * _colorMode, terminalIO, apiServer, handlingError, timers of boot/notif)
 * is deliberately NOT here.
 */
import type { SiteConfig, PageConfig, ContentBlock, FormBlock } from "../config/types.js";
import type { RouteParams } from "../router/types.js";
import type { Theme } from "../style/theme.js";
import type { BorderStyle } from "../style/borders.js";
import type { Router } from "../navigation/router.js";
import type { FocusManager } from "../navigation/focus.js";
import type { FocusRect } from "../layout/types.js";
import type { InputModeManager } from "./input-mode.js";
import type { NotificationManager } from "./notifications.js";
import type { AsyncContentManager } from "../data/async-content.js";
import type { InputFieldState } from "../data/types.js";
import type { ScreenSize } from "./screen.js";
import type { KeyPress } from "./input.js";
import type { FocusItem, FormResult } from "./runtime-types.js";
import type { FileRouter } from "../router/resolver.js"; // type-only import: no runtime cycle

/**
 * Per-page layout cache consulted by renderMain (§D.4). Static trees skip
 * the per-frame collect/registerForms/computeFocusPositions passes; trees
 * containing dynamic/asyncContent blocks stay volatile and keep the exact
 * per-frame recompute path. A per-frame focus-slot fingerprint
 * (countFocusSlots vs pageFocusItems.length) guards in-place mutation of a
 * static tree: slot-count changes fall back to the slow path.
 */
export interface PageLayoutCache {
  /** Identity of the content array last laid out (null = invalidated). */
  contentRef: ContentBlock[] | null;
  columns: number;
  rows: number;
  /** Tree contains dynamic or asyncContent blocks — recompute every frame. */
  volatile: boolean;
}

/**
 * Previous-frame buffer for the line-diff renderer (writeToTerminal in
 * runtime-terminal.ts). Lives on the runtime instance — exactly one per
 * terminal stream — so concurrent SSH sessions (each owning its own
 * TUIRuntime) can never diff against another session's frame. Never hoist
 * this to module scope.
 */
export interface FrameState {
  /** Final styled content of each terminal row as composed last frame (untruncated). */
  rows: string[];
  /** Dimensions the buffer was rendered at (mismatch ⇒ full redraw). */
  columns: number;
  rowCount: number;
  /** Last emitted DECTCEM state (true = cursor visible). */
  cursorShown: boolean;
  /** False ⇒ the next frame must be a full redraw. */
  valid: boolean;
}

export interface RuntimeInternal {
  // ── Configuration & collaborators ─────────────────────────
  site: SiteConfig;
  theme: Theme;
  router: Router;
  focus: FocusManager;
  borderStyle: BorderStyle;
  /** File router when running file-based projects (was `(rt as any)._fileRouter`). */
  fileRouter: FileRouter | null;

  // ── Navigation / focus state ──────────────────────────────
  scrollOffset: number;
  pageFocusIndex: number;
  pageFocusItems: FocusItem[];
  pageScrollOffset: number;
  focusRects: FocusRect[];
  /** Focused block exposed to nested layout renderers (was ambient any-write). */
  currentFocusedBlock: ContentBlock | undefined;
  currentParams: RouteParams;

  // ── Modes & transient UI ─────────────────────────────────
  commandMode: boolean;
  commandBuffer: string;
  inputMode: InputModeManager;
  feedbackMessage: string;
  feedbackTimer: ReturnType<typeof setTimeout> | null;
  bootComplete: boolean;
  bootFrame: number;
  spinnerTimer: ReturnType<typeof setTimeout> | null;

  // ── Component state stores ────────────────────────────────
  accordionState: Map<string, number>;
  tabState: Map<string, number>;
  galleryState: Map<string, number>;
  inputStates: Map<string, InputFieldState>;
  formResults: Map<string, FormResult>;
  buttonLoading: Map<string, boolean>;
  formRegistry: Map<string, FormBlock>;
  resolvedPageContent: Map<string, ContentBlock[]>;
  /** Serialized params that produced each resolvedPageContent entry — a
   *  params change invalidates the cached content instead of showing the
   *  previous params' page. */
  resolvedPageParams: Map<string, string>;
  dynamicCache: Map<string, ContentBlock[]>;
  /**
   * Structural-path state keys stamped onto blocks by stampBlockKeys()
   * (block-walker.ts). Key format: `${pageId}#${walkPath}` — deterministic
   * across renders, so component state survives refresh/regeneration while
   * same-labeled blocks on different pages no longer share state.
   */
  blockKeys: WeakMap<ContentBlock, string>;
  /** Layout cache for renderMain's static-page fast path (§D.4). */
  layoutCache: PageLayoutCache;
  /** Line-diff renderer's previous-frame buffer (one per terminal stream). */
  frameState: FrameState;

  // ── Services ─────────────────────────────────────────────
  notifications: NotificationManager;
  asyncManager: AsyncContentManager;

  // ── Derived / IO ─────────────────────────────────────────
  readonly screenSize: ScreenSize;
  readonly isServeMode: boolean;
  writeOutput(data: string): void;
  /**
   * Mark the previous-frame buffer stale so the next frame is a full
   * redraw. MUST be called by any code path that writes to the terminal
   * without going through writeToTerminal (error fallbacks, exit
   * messages, terminal restore) — otherwise the next diff is taken
   * against a buffer the screen no longer shows.
   */
  invalidateFrame(): void;

  // ── Methods (implemented on TUIRuntime, many delegating back) ──
  render(): void;
  stop(): Promise<void>;
  setTheme(name: string): boolean;
  navigateToPage(pageId: string, params?: RouteParams): void;
  enterPage(): void;
  getCurrentPage(): PageConfig | undefined;
  getPageContent(page: PageConfig): ContentBlock[] | null;
  resolvePageTitle(page: PageConfig): string;
  resolvePageLoading(page: PageConfig): string;
  collectFocusItems(blocks: ContentBlock[]): FocusItem[];
  initializePageContent(content: ContentBlock[]): void;
  registerForms(blocks: ContentBlock[]): void;
  pageFocusNext(): void;
  pageFocusPrev(): void;
  handlePageSelect(): void;
  handleEditMode(key: KeyPress): void;
  showFeedback(msg: string): void;
  executeCommand(cmd: string): void;
  validateInput(block: ContentBlock): boolean;
  getInputState(id: string, defaultValue?: unknown): InputFieldState;
  /**
   * Path key if stamped, else the legacy label-derived key (defensive
   * fallback so an unstamped block — e.g. rendered via a path we missed —
   * degrades to today's behavior).
   */
  getBlockKey(block: ContentBlock, legacyKey: () => string): string;
  getFocusedInputBlock(): ContentBlock | null;
  isTextEntryType(type: string): boolean;
  isAutoEditKey(key: KeyPress): boolean;
}
