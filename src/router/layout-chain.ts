/**
 * Resolves and applies layout nesting for file-based routing.
 *
 * Layout files wrap pages from outside in:
 *   pages/layout.ts (root) → pages/dashboard/layout.ts → page content
 *
 * Each layout receives { children } and returns ContentBlock[].
 */
import type { ContentBlock } from "../config/types.js";
import type { LayoutFunction, Route } from "./types.js";
import { loadLayoutModule } from "./page-loader.js";

/** Cached layout functions by file path. */
const layoutFnCache = new Map<string, LayoutFunction>();

/**
 * Apply the layout chain to page content.
 *
 * Wraps content from innermost to outermost:
 * 1. Page content = [blocks...]
 * 2. Inner layout wraps: innerLayout({ children: pageContent })
 * 3. Outer layout wraps: outerLayout({ children: innerResult })
 *
 * @param content - The raw page content blocks
 * @param layoutChain - Ordered layout file paths (outermost first)
 * @param outDir - Output directory for compiled files
 * @returns Final content blocks with all layouts applied
 */
export async function applyLayoutChain(
  content: ContentBlock[],
  layoutChain: string[],
  outDir: string,
): Promise<ContentBlock[]> {
  if (layoutChain.length === 0) return content;

  // Load all layout functions
  const layouts: LayoutFunction[] = [];
  for (const layoutPath of layoutChain) {
    const fn = await getLayoutFunction(layoutPath, outDir);
    layouts.push(fn);
  }

  // Apply from innermost (last) to outermost (first)
  let result = content;
  for (let i = layouts.length - 1; i >= 0; i--) {
    result = layouts[i]({ children: result });
  }

  return result;
}

/**
 * Get or load a layout function, with caching.
 */
async function getLayoutFunction(
  layoutPath: string,
  outDir: string,
): Promise<LayoutFunction> {
  const cached = layoutFnCache.get(layoutPath);
  if (cached) return cached;

  const mod = await loadLayoutModule(layoutPath, outDir);
  layoutFnCache.set(layoutPath, mod.default);
  return mod.default;
}

/**
 * Invalidate cached layout for a specific file.
 */
export function invalidateLayout(layoutPath: string): void {
  layoutFnCache.delete(layoutPath);
}

/**
 * Clear all cached layouts.
 */
export function clearLayoutCache(): void {
  layoutFnCache.clear();
}
