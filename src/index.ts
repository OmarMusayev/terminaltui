// Site definition
export { defineSite, page } from "./config/parser.js";

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
  ascii,
  markdown,
  gradient,
  sparkline,
  divider,
  spacer,
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

// ASCII Art System
export { renderBanner, centerBanner, getBannerWidth } from "./ascii/banner.js";
export type { BannerOptions } from "./ascii/banner.js";
export { fonts } from "./ascii/fonts.js";
export type { Font } from "./ascii/fonts.js";
export { icons, getIcon } from "./ascii/art.js";
export { sparkline as brailleSparkline, dotMatrix, braillePattern } from "./ascii/braille.js";

// ASCII Art Generators
import * as _shapes from "./ascii/shapes.js";
import * as _patterns from "./ascii/patterns.js";
import * as _scenes from "./ascii/scenes.js";
import * as _dataviz from "./ascii/dataviz.js";
import * as _compose from "./ascii/compose.js";
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

/** Art composition and manipulation utilities. */
export const artCompose = {
  overlay: _compose.overlay,
  sideBySide: _compose.sideBySide,
  stack: _compose.stack,
  center: _compose.center,
  pad: _compose.pad,
  crop: _compose.crop,
  repeat: _compose.repeat,
  mirror: _compose.mirror,
  rotate: _compose.rotate,
  colorize: _compose.colorize,
  gradient: _compose.gradient,
  rainbow: _compose.rainbow,
  shadow: _compose.shadow,
};

// Art Registry
export {
  registry,
  registerFont, registerScene, registerIcon, registerPattern,
  registerArtPack, useArtPack, listArt, getArtInfo,
} from "./art-registry/index.js";
export { createArtPack } from "./art-registry/loader.js";
export type { ArtPack, SceneData, IconData, PatternData, AssetInfo } from "./art-registry/types.js";

// Runtime
export { TUIRuntime, runSite } from "./core/runtime.js";
