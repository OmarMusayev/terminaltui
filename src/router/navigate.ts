import type { RouteParams } from "./types.js";

/**
 * Global navigate function.
 * Set by the runtime at startup so user code can call navigate() from anywhere.
 */
let _navigateFn: ((pageId: string, params?: RouteParams) => void) | null = null;

export function setNavigateHandler(fn: ((pageId: string, params?: RouteParams) => void) | null): void {
  _navigateFn = fn;
}

/**
 * Navigate to a page or route programmatically.
 *
 * @param pageId - The page or route ID to navigate to
 * @param params - Optional route parameters (for dynamic routes like [slug].ts)
 */
export function navigate(pageId: string, params?: RouteParams): void {
  if (!_navigateFn) {
    throw new Error("navigate() called before runtime initialization");
  }
  _navigateFn(pageId, params);
}
