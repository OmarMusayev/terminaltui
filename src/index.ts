
// Content helpers
export {
  section,
  card,
  timeline,
  table,
  list,
  quote,
  hero,
  gallery,
  tabs,
  accordion,
  link,
  skillBar,
  progressBar,
  badge,
  image,
  text,
  ascii,
  markdown,
  gradient,
  sparkline,
  divider,
  spacer,
  // Input components
  textInput,
  textArea,
  select,
  checkbox,
  toggle,
  radioGroup,
  numberInput,
  searchInput,
  button,
  form,
  asyncContent,
  // Layout components
  columns,
  rows,
  grid,
  panel,
  col,
  row,
  container,
  // Menu component (file-based routing)
  menu,
  // Chat component
  chat,
} from "./config/parser.js";

// Types
export type {
  SiteConfig,
  Site,
  PageConfig,
  ContentBlock,
  TextBlock,
  CardBlock,
  TimelineBlock,
  TimelineItem,
  TableBlock,
  ListBlock,
  QuoteBlock,
  HeroBlock,
  GalleryBlock,
  TabsBlock,
  AccordionBlock,
  LinkBlock,
  ProgressBarBlock,
  BadgeBlock,
  ImageBlock,
  DividerBlock,
  SpacerBlock,
  SectionBlock,
  CustomBlock,
  BannerConfig,
  AsciiBannerOptions,
  AnimationConfig,
  NavigationConfig,
  EasterEggConfig,
  StatusBarConfig,
  LinkOptions,
  TextInputBlock,
  TextAreaBlock,
  SelectBlock,
  CheckboxBlock,
  ToggleBlock,
  RadioGroupBlock,
  NumberInputBlock,
  SearchInputBlock,
  ButtonBlock,
  FormBlock,
  AsyncContentBlock,
  ActionResult,
  CardAction,
  DynamicBlock,
  PanelConfig,
  GridConfig,
  ColumnsBlock,
  RowsBlock,
  GridBlock,
  PanelBlock,
  ColConfig,
  RowBlock,
  ContainerBlock,
  MenuBlock,
  MenuBlockItem,
  ChatBlock,
  ServeConfig,
} from "./config/types.js";

// Theme
export { themes, defaultTheme } from "./style/theme.js";
export type { Theme, BuiltinThemeName } from "./style/theme.js";

// Color system
export { detectColorSupport, setColorMode, getColorMode, fgColor, bgColor } from "./style/colors.js";
export type { ColorMode } from "./style/colors.js";

// Borders
export type { BorderStyle } from "./style/borders.js";

// Unicode-aware string measurement
export { stringWidth, charWidth } from "./components/base.js";

// Box model
export { computeBoxDimensions, COMPONENT_DEFAULTS } from "./layout/box-model.js";
export type { BoxDimensions, BoxOptions } from "./layout/box-model.js";

// Component system
export { componentRegistry } from "./components/base.js";
export type { Component, ComponentRenderer, RenderContext } from "./components/base.js";

// ASCII Art System
export { renderBanner, centerBanner, getBannerWidth } from "./ascii/banner.js";
export type { BannerOptions } from "./ascii/banner.js";
export { fonts } from "./ascii/fonts.js";
export type { Font } from "./ascii/fonts.js";
export { icons, getIcon } from "./ascii/art.js";

// ASCII Art Generators
import * as _shapes from "./ascii/shapes.js";
import * as _patterns from "./ascii/patterns.js";
import * as _scenes from "./ascii/scenes.js";
import * as _dataviz from "./ascii/dataviz.js";
import { getIcon as _getIcon } from "./ascii/art.js";
export { asciiImage } from "./ascii/image.js";
export type { AsciiImageOptions } from "./ascii/image.js";

/** ASCII art shape, pattern, scene, data visualization, and icon generators. */
export const asciiArt = {
  // Shapes
  box: _shapes.box,
  circle: _shapes.circle,
  diamond: _shapes.diamond,
  triangle: _shapes.triangle,
  heart: _shapes.heart,
  star: _shapes.star,
  arrow: _shapes.arrow,
  hexagon: _shapes.hexagon,
  line: _shapes.line,

  // Patterns
  pattern: _patterns.pattern,

  // Scenes
  scene: _scenes.scene,

  // Icons
  getIcon: _getIcon,

  // Data Visualization
  barChart: _dataviz.barChart,
  sparkline: _dataviz.sparkline,
  heatmap: _dataviz.heatmap,
  pieChart: _dataviz.pieChart,
  graph: _dataviz.graph,
};

// Runtime
export { TUIRuntime, runFileBasedSite } from "./core/runtime.js";

// Terminal I/O abstraction
export { ProcessTerminalIO } from "./core/terminal-io.js";
export type { TerminalIO } from "./core/terminal-io.js";

// SSH Server
export { SSHServer } from "./core/ssh-server.js";
export type { ServeOptions } from "./core/ssh-server.js";

// ─── State System ─────────────────────────────────────────
export { createState } from "./state/reactive.js";
export { computed } from "./state/computed.js";
export { dynamic } from "./state/dynamic.js";
export { createPersistentState } from "./state/persistent.js";
export type { StateContainer, ComputedValue, PersistentStateOptions } from "./state/types.js";

// ─── Data Fetching ────────────────────────────────────────
export { fetcher, destroyAllFetchers } from "./data/fetcher.js";
export type { FetcherOptions, FetcherResult } from "./data/fetcher.js";
export { request } from "./data/request.js";
export type { RequestOptions, RequestResult } from "./data/request.js";
export { liveData } from "./data/live-data.js";
export type { LiveDataConnection } from "./data/live-data.js";

// ─── Routing ──────────────────────────────────────────────
export { navigate } from "./router/navigate.js";
export type { RouteParams, NavigateAction, HistoryEntry } from "./router/types.js";

// ─── Middleware ───────────────────────────────────────────
export { middleware, redirect } from "./middleware/index.js";
export { requireEnv, rateLimit } from "./middleware/built-in.js";
export type { MiddlewareFn, MiddlewareContext, MiddlewareResult } from "./middleware/types.js";

// ─── Lifecycle ───────────────────────────────────────────
export type { AppContext, ErrorContext, LifecycleHooks } from "./lifecycle/types.js";

// ─── Config ──────────────────────────────────────────────
export { defineConfig, defineEnv } from "./config/define-config.js";
export type { ConfigField, ConfigSchema, ConfigContainer } from "./config/define-config.js";
export { loadEnv } from "./config/env-loader.js";

// ─── API Routes ──────────────────────────────────────
export { ApiServer } from "./api/server.js";
export { setApiBaseUrl } from "./api/resolve.js";
export type { ApiRequest, ApiHandler } from "./api/types.js";

// ─── File-Based Router ───────────────────────────────
export { FileRouter } from "./router/resolver.js";
export type {
  Route,
  RouteTable,
  PageContext,
  LayoutContext,
  PageMetadata,
  PageFunction,
  LayoutFunction,
  PageModule,
  LayoutModule,
  ApiModule,
  ApiMethodHandler,
  ApiMethodRequest,
  ApiRoute,
  AutoMenuItem,
  MenuConfig,
  MenuItemConfig,
  FileBasedConfig,
  ProjectType,
  ProjectDetection,
} from "./router/types.js";
export { detectProject } from "./router/scanner.js";
