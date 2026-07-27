import type { Theme, BuiltinThemeName } from "../style/theme.js";
import type { BorderStyle } from "../style/borders.js";
import type { RouteParams } from "../router/types.js";
import type { MiddlewareFn } from "../middleware/types.js";
import type { LifecycleHooks } from "../lifecycle/types.js";
import type { ApiHandler } from "../api/types.js";
// Type-only: the image engine's option vocabulary is shared verbatim so a
// block and the renderer can never disagree about what a mode or a fit means.
import type {
  ImageAlign,
  ImageDither,
  ImageFit,
  ImageMode,
  ImageRenderOptions,
} from "../image/types.js";

// ─── Site Config ───────────────────────────────────────────

export interface SiteConfig {
  name: string;
  handle?: string;
  tagline?: string;
  banner?: BannerConfig;
  theme?: Theme | BuiltinThemeName;
  borders?: BorderStyle;
  animations?: AnimationConfig;
  navigation?: NavigationConfig;
  pages: PageConfig[];
  middleware?: MiddlewareFn[];
  easterEggs?: EasterEggConfig;
  footer?: string | ContentBlock;
  statusBar?: boolean | StatusBarConfig;
  artDir?: string | false;
  /**
   * Root that relative asset paths (currently image blocks) resolve against.
   * File-based projects get this from the runtime; a hand-written config can
   * set it explicitly (e.g. `import.meta.dirname`) when it is not launched from
   * its own directory.
   */
  projectDir?: string;

  // Menu config (file-based routing) — explicit menu overrides auto-generation
  menu?: {
    items?: { label: string; page: string; icon?: string }[];
  };

  // API routes — "METHOD /path" → handler
  api?: Record<string, ApiHandler>;

  // SSH serve config
  serve?: ServeConfig;

  // Lifecycle hooks
  onInit?: LifecycleHooks["onInit"];
  onExit?: LifecycleHooks["onExit"];
  onNavigate?: LifecycleHooks["onNavigate"];
  onError?: LifecycleHooks["onError"];
}

export interface ServeConfig {
  /** SSH port (default: 2222). */
  port?: number;
  /** Host key path (default: .terminaltui/host_key, auto-generated). */
  hostKeyPath?: string;
  /** Max simultaneous SSH connections (default: 100). */
  maxConnections?: number;
  /** Color mode for SSH sessions: "auto" detects from client TERM (default: "auto"). */
  colorMode?: "auto" | "truecolor" | "256" | "16";
  /** Whether to open URLs in the server's browser (default: false in serve mode). */
  openUrls?: boolean;
  /** Authentication config. */
  auth?: {
    passwords?: Record<string, string>;
  };
}

export interface Site {
  config: SiteConfig;
}

export interface PageConfig {
  id: string;
  /** Function titles resolve at render time with the current route params. */
  title: string | ((params: Record<string, string>) => string);
  icon?: string;
  /** Content loaders receive the current route params on each navigation. */
  content: ContentBlock[] | ((params?: Record<string, string>) => Promise<ContentBlock[]>);
  loading?: string | ((params: Record<string, string>) => string);
  refreshInterval?: number;
  onError?: (err: Error) => ContentBlock[];
  middleware?: MiddlewareFn[];
  /** @internal Hide from auto-generated menu (page still navigable). */
  _hidden?: boolean;
}

// ─── Animation Config ──────────────────────────────────────

export interface AnimationConfig {
  boot?: boolean;
  exitMessage?: string;
  speed?: "slow" | "normal" | "fast";
}

export interface NavigationConfig {
  numberJump?: boolean;
  vim?: boolean;
  commandMode?: boolean;
  /** When true, left/right arrow keys navigate between panels on layout pages.
   *  Back = Escape, Select = Enter. Default: true when layouts are present.
   *  Set to false to keep left=back, right=select even on layout pages. */
  panelArrows?: boolean;
}

export interface StatusBarConfig {
  show?: boolean;
  showPageName?: boolean;
  showHints?: boolean;
}

export interface EasterEggConfig {
  konami?: boolean | string;
  commands?: Record<string, string | (() => void)>;
}

// ─── Banner Config ─────────────────────────────────────────

export interface BannerConfig {
  text: string;
  font?: string;
  gradient?: string[];
  align?: "left" | "center" | "right";
  padding?: number;
  shadow?: boolean;
  border?: string | false;
  width?: number;
}

export interface AsciiBannerOptions {
  font?: string;
  gradient?: string[];
  align?: "left" | "center" | "right";
  padding?: number;
  shadow?: boolean;
  border?: string | false;
  width?: number;
}

// ─── Content Blocks ────────────────────────────────────────

export type ContentBlock =
  | TextBlock
  | CardBlock
  | TimelineBlock
  | TableBlock
  | ListBlock
  | QuoteBlock
  | HeroBlock
  | GalleryBlock
  | TabsBlock
  | AccordionBlock
  | LinkBlock
  | ProgressBarBlock
  | BadgeBlock
  | ImageBlock
  | DividerBlock
  | SpacerBlock
  | SectionBlock
  | CustomBlock
  | TextInputBlock
  | TextAreaBlock
  | SelectBlock
  | CheckboxBlock
  | ToggleBlock
  | RadioGroupBlock
  | NumberInputBlock
  | SearchInputBlock
  | ButtonBlock
  | FormBlock
  | AsyncContentBlock
  | DynamicBlock
  | ColumnsBlock
  | RowsBlock
  | GridBlock
  | PanelBlock
  | RowBlock
  | ContainerBlock
  | MenuBlock
  | ChatBlock;

export interface TextBlock {
  type: "text";
  content: string;
  style?: "markdown" | "plain";
}

export interface CardBlock {
  type: "card";
  title: string;
  subtitle?: string;
  body?: string;
  tags?: string[];
  url?: string;
  border?: BorderStyle;
  action?: CardAction;
}

export interface TimelineBlock {
  type: "timeline";
  items: TimelineItem[];
  style?: "connected" | "separated";
}

export interface TimelineItem {
  title: string;
  subtitle?: string;
  period?: string;
  description?: string;
}

export interface TableBlock {
  type: "table";
  headers: string[];
  rows: string[][];
  border?: BorderStyle;
}

export interface ListBlock {
  type: "list";
  items: string[];
  style?: "bullet" | "number" | "dash" | "check" | "arrow";
}

export interface QuoteBlock {
  type: "quote";
  text: string;
  attribution?: string;
  style?: "border" | "indent" | "fancy";
}

export interface HeroBlock {
  type: "hero";
  title: string;
  subtitle?: string;
  cta?: { label: string; url: string };
  art?: string;
}

export interface GalleryBlock {
  type: "gallery";
  items: CardBlock[];
  columns?: number;
}

export interface TabsBlock {
  type: "tabs";
  items: { label: string; content: ContentBlock[] }[];
}

export interface AccordionBlock {
  type: "accordion";
  items: { label: string; content: ContentBlock[] }[];
}

export interface LinkBlock {
  type: "link";
  label: string;
  url: string;
  icon?: string;
}

export interface ProgressBarBlock {
  type: "progressBar";
  label: string;
  value: number;
  max?: number;
  showPercent?: boolean;
}

export interface BadgeBlock {
  type: "badge";
  text: string;
  color?: string;
  style?: "filled" | "outline";
}

export interface ImageBlock {
  type: "image";
  /**
   * Path relative to the project root, an absolute path, a `file:` URL or a
   * `data:` URI. Remote `http(s)` sources cannot be decoded synchronously and
   * render as alt text.
   */
  path: string;
  /** Width in terminal CELLS. Default: fill the available content width. */
  width?: number;
  /** Height in terminal CELLS. Aspect is preserved unless `fit: "fill"`. */
  height?: number;
  /** Hard cap on derived rows. */
  maxHeight?: number;
  /** Default "contain", which never letterboxes — the block just gets smaller. */
  fit?: ImageFit;
  /** Horizontal placement inside the block's allocation. Default "center". */
  align?: ImageAlign;
  /**
   * Force a rendering tier. Default "auto" negotiates the ladder from the
   * viewer's colour depth and glyph coverage. Pin it in demos and snapshot
   * tests so output is byte-stable across terminals.
   *
   * "blocks" is the original published spelling of the half-block tier and is
   * still accepted; it maps to "half".
   */
  mode?: ImageMode | "blocks";
  /**
   * "auto" = no dithering, at every colour depth. Both algorithms stay
   * available explicitly.
   *
   * One sample here is one whole terminal cell, which is enormous, so the
   * dispersion that error diffusion relies on never fuses in the eye — it just
   * reads as confetti. At 256 the 240-entry palette is dense enough that
   * nearest-colour is already smooth. At 16, reproducing a mid grey means
   * alternating between black and a saturated primary, which renders a
   * photograph as scattered dots on black with no identifiable content; the
   * undithered image is a legible posterised photograph (measured on the
   * pillars fixture: RMSE 32.5 undithered against 52.0 dithered). An earlier
   * version defaulted 16 to Floyd-Steinberg on the belief that undithered
   * output was "nearly empty" — that emptiness was a separate bug, the shading
   * tier painting coverage x colour, i.e. luminance squared.
   *
   * "ordered" (Bayer) is never chosen automatically either: it shares one
   * threshold across all three channels, so it can shift lightness but never
   * manufacture chroma, and at 256 colours it measured worse than no dithering.
   */
  dither?: ImageDither;
  /** Shown while decoding, on failure, and when the format is unsupported. */
  alt?: string;
  /** Hex composited under alpha. Defaults to the theme background. */
  background?: string;
  invert?: boolean;
  /** Ramp for `mode: "ascii"`. Default " .:-=+*#%@". */
  charset?: string;
  /**
   * Draw a themed border around the image. Default false.
   *
   * Same vocabulary as `card`, `table` and `panel`: `true` uses the site's
   * `borderStyle`, a style name overrides it. The border is added OUTSIDE
   * `width`/`height`, so `{ width: 40, border: true }` occupies 42 columns.
   *
   * The alt-text box drawn when an image cannot be decoded is always bordered,
   * regardless of this option — a missing asset has to be visible.
   */
  border?: boolean | BorderStyle;
  /**
   * Let the viewer resize this image's frame at runtime. Default false.
   *
   * A resizable image becomes FOCUSABLE — it takes a focus slot, is reachable
   * with the arrow keys, and answers `+`/`=` (grow), `-`/`_` (shrink) and `0`
   * (back to the declared size). It renders one extra row carrying the current
   * size and those keys.
   *
   * Opting in matters. Focusability is otherwise decided by block TYPE, so
   * making every image focusable would insert a slot into every page that shows
   * one and shift every focus index below it. This is the ONLY option in the
   * framework that confers focus — note that `PanelConfig.focusable`, which
   * looks like a sibling, is inert.
   *
   * Because the engine samples per CELL, a wider frame is not a magnified
   * picture: it is a fresh resample into a larger sub-cell grid, so the
   * rendered detail genuinely increases. The frame is clamped to the content
   * column (99 cells) and to the visible height, so growing it can never push
   * its own bottom edge off screen.
   */
  resizable?: boolean;
  /**
   * Size this image to the rows the PAGE actually has left, rather than to a
   * width picked by hand for one window. Default false.
   *
   * The page composes every other block first, then grants this image whatever
   * rows remain in the content viewport; geometry back-solves the column count
   * from the source aspect, so the picture stays aspect-correct and the page
   * stops scrolling. Re-derived every frame, so it re-fits on resize.
   *
   * `width` still applies as a CEILING and `maxHeight` as a tighter cap, so
   * `{ fitPage: true }` on its own is the usual form — it is the constant you
   * are trying to delete.
   *
   * INERT in three places, deliberately:
   * - on a `resizable` image, because the viewer's chosen size must win;
   * - inside a panel/columns/rows/grid cell, because the pane's own inner
   *   height already governs the image through `ctx.panelHeight`;
   * - on the home page, which composes its own fixed layout.
   *
   * With several opted-in images on one page the leftover is split evenly
   * between them; `contain` then shrinks each to aspect, so a page may end up
   * shorter than its viewport but never taller by their doing.
   */
  fitPage?: boolean;
}

/**
 * Everything `image()` accepts besides the path.
 *
 * Derived from {@link ImageBlock} rather than restated, so the helper and the
 * block can never drift apart.
 */
export type ImageOptions = Omit<ImageBlock, "type" | "path">;

/**
 * Compile-time parity between the AUTHORING type above and the ENGINE's
 * {@link ImageRenderOptions}.
 *
 * The two are declared separately so each can carry documentation aimed at its
 * own reader, but they describe one feature and used to be able to drift
 * silently — adding a field to one would simply not reach the other, and nothing
 * typechecked the relationship. Both directions are asserted, so a new option on
 * either side is a build error until it exists on both.
 *
 * `mode` is excluded because the divergence there is deliberate: the block
 * additionally accepts the legacy `"blocks"` spelling, which `optionsOf()` maps
 * onto the `"half"` tier before the engine ever sees it.
 *
 * `resizable` is excluded for a different deliberate reason: it is an
 * INTERACTION option, not a rendering one. The engine renders a frame the
 * viewer grew exactly as it renders one the author declared that size — the
 * resize is applied upstream, by rewriting `width`/`maxHeight` before geometry
 * ever runs (src/image/frame.ts) — so the engine has no business knowing the
 * flag exists. Excluding it explicitly keeps the assertion sharp: an optional
 * property is structurally satisfied by its own absence, so leaving it in would
 * have silently weakened the check rather than failing it.
 *
 * `fitPage` is excluded for exactly the same reason as `resizable`, and through
 * exactly the same mechanism: it is a PAGE-LAYOUT option, and the page spends it
 * by rewriting `maxHeight` before geometry runs (`pageFitImageBlock` in
 * src/image/frame.ts). Pushing it into `ImageRenderOptions` would teach the pure
 * cell engine what a page viewport is, which is the coupling this split exists
 * to prevent — and the engine could not act on it anyway, since it never sees
 * the sibling blocks whose heights define the leftover.
 */
type Assert<T extends true> = T;

/**
 * `Required<>` on both sides is load-bearing, and was missing.
 *
 * Every property on both types is OPTIONAL, and an optional property is
 * structurally satisfied by its own ABSENCE in both directions — so without
 * `Required<>` the assertion below passed for any pair of types at all. So did
 * the earlier `? true : never` form, because nothing constrained the result:
 * `[never, never]` is a perfectly legal tuple alias. Verified: adding
 * `bogus?: number` to `ImageBlock` left `tsc --noEmit` at exit 0. With
 * `Assert<>` and `Required<>` the same edit is TS2344.
 */
type _ImageOptionParity = [
  Assert<
    Required<Omit<ImageOptions, "mode" | "resizable" | "fitPage">> extends
      Required<Omit<ImageRenderOptions, "mode">> ? true : false
  >,
  Assert<
    Required<Omit<ImageRenderOptions, "mode">> extends
      Required<Omit<ImageOptions, "mode" | "resizable" | "fitPage">> ? true : false
  >,
];
// Referenced so the alias is not dead code; the assertion is the whole point.
export type ImageOptionParity = _ImageOptionParity;

export interface DividerBlock {
  type: "divider";
  style?: "solid" | "dashed" | "dotted" | "double" | "label";
  label?: string;
  color?: string;
}

export interface SpacerBlock {
  type: "spacer";
  lines?: number;
}

export interface SectionBlock {
  type: "section";
  title: string;
  content: ContentBlock[];
}

/**
 * What a `custom` block may size itself against, beyond its width.
 *
 * Exists so display type can pick a FONT from the room it has instead of from a
 * constant chosen for one window — the vertical twin of the `width` argument
 * `render` has always received.
 */
export interface CustomRenderContext {
  /**
   * Rows the enclosing sequence may occupy in total: the page's content
   * viewport, or the pane's inner height inside a panel.
   *
   * The container's TOTAL, deliberately, not the rows left after the block's
   * siblings. A block sized to the leftover could not be measured until every
   * sibling had been, and an image sized from that measurement would close the
   * loop; against the total, every custom block still composes in one pass and
   * its real height flows into the leftover automatically.
   *
   * Nothing clamps to it. A block that returns more rows than this simply makes
   * the page scroll, exactly as it does today.
   */
  readonly availRows: number;
  /** Terminal columns, for a block that needs the window rather than its slot. */
  readonly columns: number;
  /** Terminal rows. */
  readonly rows: number;
}

export interface CustomBlock {
  type: "custom";
  /**
   * `ctx` is optional so that every existing `(width, theme) => string[]` stays
   * assignable — widening a callback's parameter list is source-compatible, and
   * there is exactly one dispatch site in the framework.
   */
  render: (width: number, theme: Theme, ctx?: CustomRenderContext) => string[];
}

// ─── Input Components ─────────────────────────────────────

export interface TextInputBlock {
  type: "textInput";
  id: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  maxLength?: number;
  validate?: (value: string) => string | null;
  mask?: boolean;
  transform?: (value: string) => string;
  onChange?: (value: string) => void;
}

export interface TextAreaBlock {
  type: "textArea";
  id: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  rows?: number;
  maxLength?: number;
  validate?: (value: string) => string | null;
  onChange?: (value: string) => void;
}

export interface SelectBlock {
  type: "select";
  id: string;
  label: string;
  options: { label: string; value: string }[];
  defaultValue?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
}

export interface CheckboxBlock {
  type: "checkbox";
  id: string;
  label: string;
  defaultValue?: boolean;
  onChange?: (value: boolean) => void;
}

export interface ToggleBlock {
  type: "toggle";
  id: string;
  label: string;
  defaultValue?: boolean;
  onLabel?: string;
  offLabel?: string;
  onChange?: (value: boolean) => void;
}

export interface RadioGroupBlock {
  type: "radioGroup";
  id: string;
  label: string;
  options: { label: string; value: string }[];
  defaultValue?: string;
  onChange?: (value: string) => void;
}

export interface NumberInputBlock {
  type: "numberInput";
  id: string;
  label: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface SearchInputBlock {
  type: "searchInput";
  id: string;
  label?: string;
  placeholder?: string;
  items: { label: string; value: string; keywords?: string[] }[];
  onSelect?: (value: string) => void;
  maxResults?: number;
  /**
   * What happens when a result is selected:
   * - "navigate": jump to a page matching the value, or scroll to a matching block on the current page
   * - "callback": call onSelect (default if onSelect is provided)
   */
  action?: "navigate" | "callback";
}

export interface ButtonBlock {
  type: "button";
  label: string;
  style?: "primary" | "secondary" | "danger";
  onPress?: () => void | Promise<void>;
  loading?: boolean;
  _formId?: string;
}

export interface FormBlock {
  type: "form";
  id: string;
  onSubmit: (data: Record<string, unknown>) => Promise<ActionResult> | ActionResult;
  fields: ContentBlock[];
  /** Reset all field values to defaults after successful submit. Default: false. */
  resetOnSubmit?: boolean;
}

export interface AsyncContentBlock {
  type: "asyncContent";
  load: () => Promise<ContentBlock[]>;
  loading?: string;
  fallback?: ContentBlock[];
  _asyncId?: string;
}

// ─── Dynamic Block ────────────────────────────────────────

export interface DynamicBlock {
  type: "dynamic";
  render: () => ContentBlock | ContentBlock[];
  _dynamicId?: string;
}

// ─── Action Types ─────────────────────────────────────────

export type ActionResult = { success: string } | { error: string } | { info: string };

export interface CardAction {
  label?: string;
  style?: "primary" | "secondary" | "danger";
  confirm?: string;
  onPress?: () => void | Promise<void>;
  /** Navigate to a page or route. */
  navigate?: string;
  /** Route parameters for parameterized routes. */
  params?: RouteParams;
}

// ─── Link Options ──────────────────────────────────────────

export interface LinkOptions {
  icon?: string;
}

// ─── Layout Components ───────────────────────────────────

export interface PanelConfig {
  content: ContentBlock[];
  width?: string | number;
  height?: string | number;
  title?: string;
  border?: boolean | "left" | "right" | "top" | "bottom" | BorderStyle;
  padding?: number;
  scrollable?: boolean;
  /**
   * NOT IMPLEMENTED. Accepted for backward compatibility and read by nothing.
   *
   * Focusability is decided by block TYPE (`FOCUSABLE_TYPES` in
   * core/block-taxonomy.ts) plus the one option that widens it,
   * `ImageBlock.resizable`; "panel" is in neither, so setting this has no
   * effect and produces no warning. It is documented rather than deleted
   * because removing it would turn a silent no-op into a compile error in
   * existing configs.
   *
   * If panel focus is ever implemented, the single widening point is
   * `focusSlotsOf()` in image/frame.ts — every walker that assigns focus
   * indices already goes through it.
   */
  focusable?: boolean;
}

export interface GridConfig {
  cols: number;
  rows?: number;
  gap?: number;
  items: PanelConfig[];
}

export interface ColumnsBlock {
  type: "columns";
  panels: PanelConfig[];
}

export interface RowsBlock {
  type: "rows";
  panels: PanelConfig[];
}

export interface GridBlock {
  type: "grid";
  config: GridConfig;
}

export interface PanelBlock {
  type: "panel";
  config: PanelConfig;
}

// ─── Grid System (12-column) ──────────────────────────

export interface ColConfig {
  content: ContentBlock[];
  span?: number;       // 1-12, default: auto (12 / numCols in row)
  offset?: number;     // 0-11, default: 0
  xs?: number;         // span at <60 cols
  sm?: number;         // span at 60-89 cols
  md?: number;         // span at 90-119 cols
  lg?: number;         // span at >=120 cols
  padding?: number;    // inner padding, default: 0
}

export interface RowBlock {
  type: "row";
  cols: ColConfig[];
  gap?: number;        // gap between cols, default: 1
}

export interface ContainerBlock {
  type: "container";
  content: ContentBlock[];
  maxWidth?: number;
  padding?: number;
  center?: boolean;    // default: true
}

// ─── Menu Block (for file-based routing) ─────────────────

export interface MenuBlock {
  type: "menu";
  /** "auto" = auto-generated from pages/ directory. */
  source?: "auto";
  /** Manual items (overrides source). */
  items?: MenuBlockItem[];
  /** Filter function for auto-generated items. */
  filter?: (route: { name: string; depth: number }) => boolean;
}

export interface MenuBlockItem {
  label: string;
  page: string;
  icon?: string;
}

// ─── Chat Block ──────────────────────────────────────────

export interface ChatBlock {
  type: "chat";
  id: string;
  /** POST endpoint that receives { message, history } and returns { response }. */
  endpoint: string;
  placeholder?: string;
  suggestedQuestions?: string[];
  systemPrompt?: string;
  maxHistory?: number;
}
