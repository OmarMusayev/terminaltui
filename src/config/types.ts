import type { Theme, BuiltinThemeName } from "../style/theme.js";
import type { BorderStyle } from "../style/borders.js";

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
  easterEggs?: EasterEggConfig;
  footer?: string | ContentBlock;
  statusBar?: boolean | StatusBarConfig;
  artDir?: string | false;  // path to art directory, default "./art", false to disable
}

export interface Site {
  config: SiteConfig;
}

export interface PageConfig {
  id: string;
  title: string;
  icon?: string;
  content: ContentBlock[];
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
  | CustomBlock;

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

// ─── Link Options ──────────────────────────────────────────

export interface LinkOptions {
  icon?: string;
}
