/**
 * Route resolver — resolves route names to loaded page modules,
 * handles dynamic parameter matching, and orchestrates page loading
 * with layout chain application.
 */
import type { ContentBlock, PageConfig } from "../config/types.js";
import type {
  Route, RouteTable, PageModule, PageMetadata, PageContext,
  FileBasedConfig, AutoMenuItem,
} from "./types.js";
import { findRoute, matchDynamicRoute } from "./route-table.js";
import { loadPageModule } from "./page-loader.js";
import { applyLayoutChain } from "./layout-chain.js";
import { buildMenu } from "./menu-builder.js";
import { scanPages, scanApiDirectory } from "./scanner.js";
import { buildRouteTable } from "./route-table.js";
import { buildApiRoutes, loadApiRoutes } from "./api-loader.js";
import { validateProject, printValidationWarnings, type ValidationWarning } from "./validate.js";

/** Cached page modules and metadata. */
const pageModuleCache = new Map<string, PageModule>();

/**
 * The main file-based router. Coordinates scanning, loading, and resolving.
 */
export class FileRouter {
  private routeTable: RouteTable | null = null;
  private config: FileBasedConfig;
  private pagesDir: string;
  private apiDir: string | undefined;
  private outDir: string;
  private metadataMap = new Map<string, PageMetadata>();
  private menuItems: AutoMenuItem[] = [];

  constructor(opts: {
    config: FileBasedConfig;
    pagesDir: string;
    apiDir?: string;
    outDir: string;
  }) {
    this.config = opts.config;
    this.pagesDir = opts.pagesDir;
    this.apiDir = opts.apiDir;
    this.outDir = opts.outDir;
  }

  /**
   * Initialize the router: scan files, build route table, load metadata, build menu.
   */
  async initialize(): Promise<void> {
    // Scan pages
    const { pages, layouts } = scanPages(this.pagesDir);
    this.routeTable = buildRouteTable(pages, layouts, this.pagesDir);

    // Load metadata from all page modules
    await this.loadAllMetadata();

    // Build menu
    this.menuItems = buildMenu(
      this.routeTable,
      this.metadataMap,
      this.config.menu,
    );
  }

  /**
   * Load metadata from all page modules (needed for menu building).
   */
  private async loadAllMetadata(): Promise<void> {
    if (!this.routeTable) return;

    for (const route of this.routeTable.routes) {
      try {
        const mod = await this.getPageModule(route);
        if (mod.metadata) {
          this.metadataMap.set(route.name, mod.metadata);
        }
      } catch {
        // Skip files that fail to load during metadata scan
      }
    }
  }

  /**
   * Get or load a page module for a route.
   */
  private async getPageModule(route: Route): Promise<PageModule> {
    const cached = pageModuleCache.get(route.filePath);
    if (cached) return cached;

    const mod = await loadPageModule(route.filePath, this.outDir);
    pageModuleCache.set(route.filePath, mod);
    return mod;
  }

  /**
   * Get the route table.
   */
  getRouteTable(): RouteTable {
    if (!this.routeTable) throw new Error("Router not initialized");
    return this.routeTable;
  }

  /**
   * Get the auto-generated menu items.
   */
  getMenuItems(): AutoMenuItem[] {
    return this.menuItems;
  }

  /**
   * Get all route names (for Router.registerPages).
   */
  getAllRouteNames(): string[] {
    if (!this.routeTable) return [];
    return this.routeTable.routes.map(r => r.name);
  }

  /**
   * Get menu-visible route names (for FocusManager).
   */
  getMenuRouteNames(): string[] {
    return this.menuItems.map(m => m.page);
  }

  /**
   * Resolve a page by name — load its module, execute the function,
   * apply layout chain, return final content blocks.
   *
   * @param pageName - Route name (e.g., "about", "projects/my-project")
   * @param params - Dynamic route params
   * @returns Content blocks ready for rendering
   */
  async resolvePage(
    pageName: string,
    params?: Record<string, string>,
  ): Promise<ContentBlock[]> {
    if (!this.routeTable) throw new Error("Router not initialized");

    // Try static route first
    let route = findRoute(this.routeTable, pageName);
    let resolvedParams = params ?? {};

    // Try dynamic route matching
    if (!route) {
      const match = matchDynamicRoute(this.routeTable, pageName);
      if (match) {
        route = match.route;
        resolvedParams = { ...match.params, ...params };
      }
    }

    if (!route) {
      throw new Error(`Route not found: ${pageName}`);
    }

    // Load and execute page function
    const mod = await this.getPageModule(route);
    const context: PageContext | undefined = route.isDynamic || Object.keys(resolvedParams).length > 0
      ? { params: resolvedParams }
      : undefined;

    let content = await mod.default(context);

    // Apply layout chain
    if (route.layoutChain.length > 0) {
      content = await applyLayoutChain(content, route.layoutChain, this.outDir);
    }

    return content;
  }

  /**
   * Convert the file-based structure to a SiteConfig-compatible pages array.
   * This is the bridge between file-based routing and the existing runtime.
   */
  async buildPagesArray(): Promise<PageConfig[]> {
    if (!this.routeTable) throw new Error("Router not initialized");

    const pages: PageConfig[] = [];

    for (const menuItem of this.menuItems) {
      const route = findRoute(this.routeTable!, menuItem.page);
      if (!route) continue;

      const meta = this.metadataMap.get(route.name);

      pages.push({
        id: route.name,
        title: menuItem.label,
        icon: menuItem.icon,
        content: this.createPageContentLoader(route),
      });
    }

    // Also add non-menu pages (hidden, dynamic, sub-pages)
    for (const route of this.routeTable.routes) {
      if (pages.some(p => p.id === route.name)) continue;

      const meta = this.metadataMap.get(route.name);

      pages.push({
        id: route.name,
        title: meta?.label ?? route.name,
        icon: meta?.icon,
        _hidden: true,
        content: this.createPageContentLoader(route),
      });
    }

    return pages;
  }

  /**
   * Create a content loader function for a route.
   * Returns an async function that loads, executes, and applies layouts.
   * For dynamic routes, the loader is called with no args but the runtime
   * passes params via rt.currentParams which the route content handler reads.
   */
  private createPageContentLoader(route: Route): () => Promise<ContentBlock[]> {
    const self = this;
    return async () => {
      const mod = await self.getPageModule(route);

      // For dynamic routes, pass params from the runtime context
      let context: PageContext | undefined;
      if (route.isDynamic) {
        // Params are set on rt.currentParams before this loader is called
        // We can't access rt here, but the runtime calls this as page.content()
        // The params will be passed through the existing route/async content system
        context = undefined; // Will be handled by the runtime's existing route param system
      }

      let content = await mod.default(context);

      if (route.layoutChain.length > 0) {
        content = await applyLayoutChain(content, route.layoutChain, self.outDir);
      }

      return content;
    };
  }

  /**
   * Load API routes and return them in the existing format.
   */
  async loadApiRoutes(): Promise<Record<string, import("../api/types.js").ApiHandler>> {
    if (!this.apiDir) return {};

    const apiFiles = scanApiDirectory(this.apiDir);
    const apiRoutes = buildApiRoutes(apiFiles);
    return loadApiRoutes(apiRoutes, this.outDir);
  }

  /**
   * Get metadata for a specific route.
   */
  getMetadata(routeName: string): PageMetadata | undefined {
    return this.metadataMap.get(routeName);
  }

  /**
   * Validate the project and return warnings.
   */
  validate(): ValidationWarning[] {
    if (!this.routeTable) return [];
    const pageFiles = new Map<string, string>();
    for (const route of this.routeTable.routes) {
      pageFiles.set(route.name, route.filePath);
    }
    return validateProject(this.routeTable, this.metadataMap, pageFiles);
  }

  /**
   * Validate and print warnings to stderr.
   */
  validateAndPrint(): void {
    const warnings = this.validate();
    printValidationWarnings(warnings);
  }

  /**
   * Invalidate caches for a specific file (for hot reload).
   */
  invalidate(filePath: string): void {
    pageModuleCache.delete(filePath);
  }

  /**
   * Clear all caches and re-scan.
   */
  async reload(): Promise<void> {
    pageModuleCache.clear();
    this.metadataMap.clear();
    await this.initialize();
  }
}
