/**
 * Type definitions for the file-based routing system.
 * Follows Next.js App Router conventions adapted for terminal UIs.
 */
import type { ContentBlock, SiteConfig } from "../config/types.js";
import type { ApiHandler, ApiRequest } from "../api/types.js";

// ─── Route Types ───────────────────────────────────────────

/** A discovered route from the pages/ directory. */
export interface Route {
  /** Route name: "about", "projects", "projects/[slug]", "dashboard/analytics" */
  name: string;
  /** Relative file path from project root: "pages/about.ts" */
  filePath: string;
  /** True for index.ts files */
  isIndex: boolean;
  /** True for [param].ts files */
  isDynamic: boolean;
  /** Param name for dynamic routes: "slug" for [slug].ts */
  paramName?: string;
  /** Parent directory relative to pages/: "" for root, "dashboard" for subdirectory */
  parentDir: string;
  /** Depth: 0 for root pages, 1 for first subdirectory, etc. */
  depth: number;
  /** Chain of layout files from outermost to innermost */
  layoutChain: string[];
}

/** The complete route table built from scanning pages/. */
export interface RouteTable {
  routes: Route[];
  layouts: Map<string, string>; // directory path → layout file path
}

// ─── Page Module Types ─────────────────────────────────────

/** Context passed to page functions. */
export interface PageContext {
  params: Record<string, string>;
}

/** Context passed to layout functions. */
export interface LayoutContext {
  children: ContentBlock[];
}

/** Metadata exported from a page file. */
export interface PageMetadata {
  label?: string;
  order?: number;
  icon?: string;
  hidden?: boolean;
  transition?: "fade" | "slide" | "wipe" | "instant";
  middleware?: string[];
}

/** A page function — default export of a page file. */
export type PageFunction = (context?: PageContext) => ContentBlock[] | Promise<ContentBlock[]>;

/** A layout function — default export of a layout file. */
export type LayoutFunction = (context: LayoutContext) => ContentBlock[];

/** What a page .ts file exports. */
export interface PageModule {
  default: PageFunction;
  metadata?: PageMetadata;
}

/** What a layout .ts file exports. */
export interface LayoutModule {
  default: LayoutFunction;
}

// ─── API Module Types ──────────────────────────────────────

/** What an api/ .ts file exports — named exports matching HTTP methods. */
export interface ApiModule {
  GET?: ApiMethodHandler;
  POST?: ApiMethodHandler;
  PUT?: ApiMethodHandler;
  DELETE?: ApiMethodHandler;
  PATCH?: ApiMethodHandler;
}

/** API method handler — receives request context, returns JSON-serializable value. */
export type ApiMethodHandler = (request: ApiMethodRequest) => unknown | Promise<unknown>;

/** Request object for file-based API handlers. */
export interface ApiMethodRequest {
  params: Record<string, string>;
  body: unknown;
  query: Record<string, string>;
  headers: Record<string, string>;
}

/** A discovered API route. */
export interface ApiRoute {
  /** Endpoint path: "/api/stats", "/api/projects/:id" */
  endpoint: string;
  /** File path relative to project root */
  filePath: string;
  /** HTTP methods available */
  methods: string[];
  /** Dynamic param names */
  paramNames: string[];
}

// ─── Menu Types ────────────────────────────────────────────

/** Menu item built from route table + metadata. */
export interface AutoMenuItem {
  label: string;
  page: string;
  icon?: string;
  order: number;
}

/** Menu config in defineConfig(). */
export interface MenuConfig {
  /** Manual menu items — overrides auto-generation. */
  items?: MenuItemConfig[];
  /** Reorder auto-generated items by page name. */
  order?: string[];
  /** Override labels for specific page names. */
  labels?: Record<string, string>;
  /** Override icons for specific page names. */
  icons?: Record<string, string>;
  /** Exclude specific pages from auto menu. */
  exclude?: string[];
}

export interface MenuItemConfig {
  label: string;
  page: string;
  icon?: string;
}

// ─── File-Based Site Config ────────────────────────────────

/** Config shape for file-based routing (config.ts default export). */
export interface FileBasedConfig {
  name: string;
  handle?: string;
  tagline?: string;
  banner?: SiteConfig["banner"];
  theme?: SiteConfig["theme"];
  borders?: SiteConfig["borders"];
  animations?: SiteConfig["animations"];
  navigation?: SiteConfig["navigation"];
  easterEggs?: SiteConfig["easterEggs"];
  footer?: SiteConfig["footer"];
  statusBar?: SiteConfig["statusBar"];
  artDir?: SiteConfig["artDir"];
  middleware?: SiteConfig["middleware"];
  menu?: MenuConfig;
  env?: Record<string, unknown>;
  onInit?: SiteConfig["onInit"];
  onExit?: SiteConfig["onExit"];
  onNavigate?: SiteConfig["onNavigate"];
  onError?: SiteConfig["onError"];
}

/** Detected project type. */
export type ProjectType = "file-based" | "single-file";

/** Result of project detection. */
export interface ProjectDetection {
  type: ProjectType;
  projectDir: string;
  configPath: string;       // config.ts (file-based) or site.config.ts (single-file)
  pagesDir?: string;        // pages/ directory for file-based
  apiDir?: string;          // api/ directory for file-based
}
