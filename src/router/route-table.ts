/**
 * Builds the route table from scanned page files.
 * Maps filesystem paths to route names and resolves layout chains.
 */
import { join } from "node:path";
import type { Route, RouteTable } from "./types.js";
import type { ScannedFile } from "./scanner.js";

/**
 * Build a route table from scanned pages and layouts.
 */
export function buildRouteTable(
  pages: ScannedFile[],
  layouts: ScannedFile[],
  pagesDir: string,
): RouteTable {
  // Build layout map: directory path → layout file path
  const layoutMap = new Map<string, string>();
  for (const layout of layouts) {
    layoutMap.set(layout.parentDir, layout.absolutePath);
  }

  const routes: Route[] = [];

  for (const page of pages) {
    const route = buildRoute(page, layoutMap, pagesDir);
    if (route) routes.push(route);
  }

  return { routes, layouts: layoutMap };
}

/**
 * Build a single route from a scanned page file.
 */
function buildRoute(
  page: ScannedFile,
  layoutMap: Map<string, string>,
  pagesDir: string,
): Route {
  const name = resolveRouteName(page);
  const layoutChain = resolveLayoutChain(page.parentDir, layoutMap);

  return {
    name,
    filePath: page.absolutePath,
    isIndex: page.isIndex,
    isDynamic: page.isDynamic,
    paramName: page.paramName,
    parentDir: page.parentDir,
    depth: page.depth,
    layoutChain,
  };
}

/**
 * Resolve a route name from a scanned file.
 *
 * Rules:
 * - pages/home.ts → "home"
 * - pages/about.ts → "about"
 * - pages/projects/index.ts → "projects"
 * - pages/projects/[slug].ts → "projects/[slug]"
 * - pages/dashboard/analytics.ts → "dashboard/analytics"
 * - pages/index.ts → "home" (root index is home)
 */
export function resolveRouteName(page: ScannedFile): string {
  if (page.isIndex) {
    // Root index.ts → "home"
    if (page.parentDir === "") return "home";
    // Subdirectory index.ts → directory name
    return page.parentDir;
  }

  // Dynamic routes: keep the [param] in the name
  if (page.isDynamic) {
    if (page.parentDir === "") return `[${page.paramName}]`;
    return `${page.parentDir}/[${page.paramName}]`;
  }

  // Regular file
  if (page.parentDir === "") return page.name;
  return `${page.parentDir}/${page.name}`;
}

/**
 * Resolve the layout chain for a given directory path.
 * Walks from root to the target directory, collecting layout files.
 *
 * For "dashboard/settings":
 *   1. Check "" (root) for layout → pages/layout.ts
 *   2. Check "dashboard" for layout → pages/dashboard/layout.ts
 * Returns: [rootLayout, dashboardLayout]
 */
export function resolveLayoutChain(
  parentDir: string,
  layoutMap: Map<string, string>,
): string[] {
  const chain: string[] = [];

  // Always check root layout first
  const rootLayout = layoutMap.get("");
  if (rootLayout) chain.push(rootLayout);

  // Walk down the directory tree
  if (parentDir !== "") {
    const parts = parentDir.split("/");
    let accumulated = "";
    for (const part of parts) {
      accumulated = accumulated ? `${accumulated}/${part}` : part;
      const layout = layoutMap.get(accumulated);
      if (layout) chain.push(layout);
    }
  }

  return chain;
}

/**
 * Find a route by name in the route table.
 */
export function findRoute(routeTable: RouteTable, name: string): Route | undefined {
  return routeTable.routes.find(r => r.name === name);
}

/**
 * Find a dynamic route that matches a given path.
 * e.g., "projects/my-project" matches "projects/[slug]"
 */
export function matchDynamicRoute(
  routeTable: RouteTable,
  path: string,
): { route: Route; params: Record<string, string> } | undefined {
  const parts = path.split("/");

  for (const route of routeTable.routes) {
    if (!route.isDynamic) continue;

    // Build the expected pattern
    const routeParts = route.name.split("/");
    if (routeParts.length !== parts.length) continue;

    const params: Record<string, string> = {};
    let match = true;

    for (let i = 0; i < routeParts.length; i++) {
      const paramMatch = routeParts[i].match(/^\[(\w+)\]$/);
      if (paramMatch) {
        params[paramMatch[1]] = parts[i];
      } else if (routeParts[i] !== parts[i]) {
        match = false;
        break;
      }
    }

    if (match) return { route, params };
  }

  return undefined;
}
