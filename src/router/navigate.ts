import type { RouteParams } from "./types.js";
import { currentRuntime } from "../core/runtime-context.js";

/**
 * Fallback navigate handler — used outside of an AsyncLocalStorage context.
 * Inside an active runtime, currentRuntime().navigateToPage is preferred and
 * isolates per-session navigation across SSH sessions.
 */
let _navigateFn: ((pageId: string, params?: RouteParams) => void) | null = null;

export function setNavigateHandler(fn: ((pageId: string, params?: RouteParams) => void) | null): void {
  _navigateFn = fn;
}

/**
 * Navigate to a page or route programmatically.
 */
export function navigate(pageId: string, params?: RouteParams): void {
  const rt = currentRuntime();
  if (rt) {
    rt.navigateToPage(pageId, params);
    return;
  }
  if (!_navigateFn) {
    throw new Error("navigate() called before runtime initialization");
  }
  _navigateFn(pageId, params);
}
