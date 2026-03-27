/**
 * Project validation — catches common issues during dev mode startup.
 */
import { readFileSync } from "node:fs";
import type { RouteTable, PageMetadata } from "./types.js";

export interface ValidationWarning {
  level: "warn" | "error";
  message: string;
}

/**
 * Validate a file-based routing project for common issues.
 */
export function validateProject(
  routeTable: RouteTable,
  metadataMap: Map<string, PageMetadata>,
  pageFiles: Map<string, string>,  // route name → file path
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // 1. Check for duplicate page IDs (shouldn't happen with filesystem, but just in case)
  const seenIds = new Set<string>();
  for (const route of routeTable.routes) {
    if (seenIds.has(route.name)) {
      warnings.push({ level: "error", message: `Duplicate page ID: "${route.name}"` });
    }
    seenIds.add(route.name);
  }

  // 2. Check for menu({ source: "auto" }) in home page (causes duplicate menu)
  const homeRoute = routeTable.routes.find(r => r.name === "home");
  if (homeRoute) {
    const filePath = pageFiles.get("home");
    if (filePath) {
      try {
        const content = readFileSync(filePath, "utf-8");
        if (content.includes('source: "auto"') || content.includes("source: 'auto'")) {
          warnings.push({
            level: "warn",
            message: `pages/home.ts uses menu({ source: "auto" }) — this creates a duplicate menu. The framework renders the navigation menu automatically on the home screen. Remove the menu() call.`,
          });
        }
      } catch { /* ignore read errors */ }
    }
  }

  // 3. Scan all page files for navigate() calls and check targets exist
  const allRouteNames = new Set(routeTable.routes.map(r => r.name));
  for (const [routeName, filePath] of pageFiles) {
    try {
      const content = readFileSync(filePath, "utf-8");
      // Match navigate: "page-id" patterns
      const navMatches = content.matchAll(/navigate:\s*["']([^"']+)["']/g);
      for (const match of navMatches) {
        const targetId = match[1];
        if (!allRouteNames.has(targetId)) {
          // Check if it could be a dynamic route prefix
          const hasDynamicMatch = routeTable.routes.some(r =>
            r.isDynamic && r.name.replace(/\/\[.*?\].*$/, "") === targetId
          );
          if (!hasDynamicMatch) {
            warnings.push({
              level: "warn",
              message: `${routeName}: navigate("${targetId}") — page "${targetId}" not found. Available pages: ${[...allRouteNames].join(", ")}`,
            });
          }
        }
      }
    } catch { /* ignore read errors */ }
  }

  // 4. Check for hidden pages that are never referenced by navigate()
  const navigateTargets = new Set<string>();
  for (const [, filePath] of pageFiles) {
    try {
      const content = readFileSync(filePath, "utf-8");
      const navMatches = content.matchAll(/navigate:\s*["']([^"']+)["']/g);
      for (const match of navMatches) navigateTargets.add(match[1]);
    } catch { /* ignore */ }
  }

  for (const route of routeTable.routes) {
    const meta = metadataMap.get(route.name);
    if (meta?.hidden && !navigateTargets.has(route.name)) {
      warnings.push({
        level: "warn",
        message: `"${route.name}" is hidden but never referenced by navigate(). It may be unreachable.`,
      });
    }
  }

  return warnings;
}

/**
 * Print validation warnings to stderr.
 */
export function printValidationWarnings(warnings: ValidationWarning[]): void {
  if (warnings.length === 0) return;

  process.stderr.write("\n[terminaltui] Project validation:\n");
  for (const w of warnings) {
    const prefix = w.level === "error" ? "  \x1b[31m✗\x1b[0m" : "  \x1b[33m⚠\x1b[0m";
    process.stderr.write(`${prefix} ${w.message}\n`);
  }
  process.stderr.write("\n");
}
