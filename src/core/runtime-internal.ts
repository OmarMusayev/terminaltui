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
import type { GraphicsSink } from "../components/Image.js"; // type-only: the renderer defines the contract it needs

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

/**
 * Kitty graphics bookkeeping for ONE terminal.
 *
 * Per-runtime for the same reason `FrameState` is: an image lives in a specific
 * terminal's memory, and two concurrent SSH sessions have transmitted entirely
 * different sets of them. Hoisting any of this to module scope would let one
 * session's "already sent" suppress another session's transmission and paint
 * that client a rectangle of nothing.
 *
 * The three sets encode a small state machine, evaluated once per frame in
 * `TUIRuntime.render()`:
 *
 *   placed      ids whose placeholder cells are in the frame being composed
 *   lastPlaced  the same, for the frame already on screen
 *   sent        ids this terminal is believed to be holding pixels for
 *
 * `lastPlaced \ placed` is the set of images that just left the screen — a page
 * navigation, a resize that re-keyed an image, a block that stopped rendering —
 * and each one is owed a delete, because kitty and Ghostty hold transmitted
 * pixels against a 320 MB per-buffer quota until told otherwise, and virtual
 * placements count.
 */
export interface GraphicsState {
  /** Ids this terminal has received pixels for and has not been told to drop. */
  sent: Set<number>;
  /** Ids placed in the frame currently being composed. */
  placed: Set<number>;
  /** Ids placed in the frame currently on screen. */
  lastPlaced: Set<number>;
  /**
   * Ids declared by this frame's blocks that have NOT been transmitted yet,
   * with the thunk that would build the payload.
   *
   * The thunk is held rather than invoked because `renderBlock` runs for every
   * block on the page, including the ones that scroll off the bottom: the page
   * is composed in full and then sliced. Transmitting there sent a full image
   * for every image on the page on the first paint (measured: 6 of 6 on a page
   * whose viewport held one, 2141 KiB). `graphicsCommit()` resolves this map
   * against the COMPOSED FRAME, so only pixels the viewer can actually see go
   * down the wire.
   */
  intent: Map<number, () => string>;
  /**
   * Ids whose transmit thunk threw. Their source stopped being decodable
   * between frames, so `graphicsPlace()` refuses them from here on and the
   * renderer draws cells instead — otherwise every frame retries a known-dead
   * decode behind a permanent grid of placeholder cells.
   */
  failed: Set<number>;
  /** Payloads (transmissions and deletes, in order) owed to the terminal. */
  queue: string[];
  /** Ids whose transmission is IN the queue but not yet written. */
  inFlight: number[];
  /** A transmission was queued this frame; active video preloads it before placement. */
  pendingTransmit: boolean;
}

/** A fresh, empty graphics state. One per runtime, built in the constructor. */
export function createGraphicsState(): GraphicsState {
  return {
    sent: new Set(),
    placed: new Set(),
    lastPlaced: new Set(),
    intent: new Map(),
    failed: new Set(),
    queue: [],
    inFlight: [],
    pendingTransmit: false,
  };
}

export interface RuntimeInternal extends GraphicsSink {
  // ── Configuration & collaborators ─────────────────────────
  site: SiteConfig;
  theme: Theme;
  router: Router;
  focus: FocusManager;
  borderStyle: BorderStyle;
  /** File router when running file-based projects (was `(rt as any)._fileRouter`). */
  fileRouter: FileRouter | null;
  /**
   * Absolute project root, when known. Relative asset paths written by page
   * authors (`image("./logo.png")`) resolve against this, NOT `process.cwd()`
   * — `terminaltui dev demos/x/config.ts` and `terminaltui demo <name>` both
   * run from a directory that is not the project. Undefined when the runtime
   * was constructed without a project (embedders, compiled `_entry.ts`), in
   * which case the caller falls back to `process.cwd()`.
   */
  projectDir: string | undefined;

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
  /**
   * Kitty graphics bookkeeping (one per terminal stream). `graphicsPlace()`,
   * inherited from `GraphicsSink`, is the only thing the renderer touches;
   * everything else is drained by the runtime after the frame is written.
   */
  graphics: GraphicsState;
  /**
   * Resolve this frame's kitty placement intents against the COMPOSED rows and
   * queue the transmissions the viewer can actually see. Called by
   * `writeToTerminal` after composition and before any byte is emitted.
   */
  graphicsCommit(frameRows: readonly string[]): void;

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
   *
   * It ALSO retires every transmitted kitty image: an out-of-band paint has
   * erased the placeholder cells the pixels were hanging on, and the frame
   * buffer no longer describes what the terminal shows, so the pixels are
   * re-established from scratch rather than trusted.
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
