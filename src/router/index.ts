/**
 * File-based routing system for terminaltui.
 * Re-exports all public types and functions.
 */

// Types
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
} from "./types.js";

// Scanner
export { scanDirectory, scanPages, scanApiDirectory, detectProject } from "./scanner.js";
export type { ScannedFile } from "./scanner.js";

// Route table
export { buildRouteTable, resolveRouteName, resolveLayoutChain, findRoute, matchDynamicRoute } from "./route-table.js";

// Menu builder
export { buildMenu, titleCase } from "./menu-builder.js";

// Page loader
export { compileFile, loadPageModule, loadLayoutModule, loadApiModule, loadFileBasedConfig, invalidateModule, clearModuleCache } from "./page-loader.js";

// Layout chain
export { applyLayoutChain, invalidateLayout, clearLayoutCache } from "./layout-chain.js";

// API loader
export { buildApiRoutes, loadApiRoutes } from "./api-loader.js";

// Resolver
export { FileRouter } from "./resolver.js";
