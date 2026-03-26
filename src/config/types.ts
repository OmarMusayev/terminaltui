import type { Theme, BuiltinThemeName } from "../style/theme.js";
import type { BorderStyle } from "../style/borders.js";
import type { RouteConfig, MiddlewareFn, RouteParams } from "../routing/types.js";
import type { LifecycleHooks } from "../lifecycle/types.js";
import type { ApiHandler } from "../api/types.js";

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
  pages: (PageConfig | RouteConfig)[];
  middleware?: MiddlewareFn[];
  easterEggs?: EasterEggConfig;
  footer?: string | ContentBlock;
  statusBar?: boolean | StatusBarConfig;
  artDir?: string | false;

  // API routes — "METHOD /path" → handler
  api?: Record<string, ApiHandler>;

  // Lifecycle hooks
  onInit?: LifecycleHooks["onInit"];
  onExit?: LifecycleHooks["onExit"];
  onNavigate?: LifecycleHooks["onNavigate"];
  onError?: LifecycleHooks["onError"];
}

export interface Site {
  config: SiteConfig;
}

export interface PageConfig {
  id: string;
  title: string;
  icon?: string;
  content: ContentBlock[] | (() => Promise<ContentBlock[]>);
  loading?: string;
  refreshInterval?: number;
  onError?: (err: Error) => ContentBlock[];
  middleware?: MiddlewareFn[];
}

// ─── Animation Config ──────────────────────────────────────

export interface AnimationConfig {
  boot?: boolean;
  transitions?: "instant" | "fade" | "slide" | "wipe";
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
  | SplitBlock
  | GridBlock
  | PanelBlock
  | BoxBlock
  | RowBlock
  | ContainerBlock
  | MenuBlock;

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
  path: string;
  width?: number;
  mode?: "ascii" | "braille" | "blocks";
}

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

export interface CustomBlock {
  type: "custom";
  render: (width: number, theme: Theme) => string[];
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
  deps?: string[];
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
  focusable?: boolean;
}

export interface SplitConfig {
  direction: "horizontal" | "vertical";
  ratio?: number;
  border?: boolean;
  first: ContentBlock[];
  second: ContentBlock[];
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

export interface SplitBlock {
  type: "split";
  config: SplitConfig;
}

export interface GridBlock {
  type: "grid";
  config: GridConfig;
}

export interface PanelBlock {
  type: "panel";
  config: PanelConfig;
}

export interface BoxConfig {
  direction?: "column" | "row";
  width?: string | number;
  height?: string | number;
  gap?: number;
  padding?: number;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "space-between" | "space-around";
  wrap?: boolean;
  children: ContentBlock[];
}

export interface BoxBlock {
  type: "box";
  config: BoxConfig;
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
