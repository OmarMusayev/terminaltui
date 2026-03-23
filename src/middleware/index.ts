import type { MiddlewareFn, MiddlewareContext, MiddlewareResult } from "./types.js";
import type { RouteParams } from "../routing/types.js";

/**
 * Create a middleware function.
 * Middleware runs before a page renders and can redirect, preload data, or block access.
 */
export function middleware(fn: MiddlewareFn): MiddlewareFn {
  return fn;
}

/**
 * Return a redirect result from middleware.
 */
export function redirect(pageId: string, params?: RouteParams): { redirect: string; params?: RouteParams } {
  return { redirect: pageId, params };
}

/**
 * Run a middleware chain. Returns the final redirect if any, or undefined to continue.
 */
export async function runMiddleware(
  chain: MiddlewareFn[],
  context: MiddlewareContext,
): Promise<MiddlewareResult> {
  for (const mw of chain) {
    const result = await mw(context);
    if (result && "redirect" in result) {
      return result;
    }
  }
  return undefined;
}
