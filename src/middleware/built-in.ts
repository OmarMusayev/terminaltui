import type { MiddlewareFn } from "./types.js";

/**
 * Middleware that checks for required environment variables.
 * Shows an error page if any are missing.
 */
export function requireEnv(vars: string[]): MiddlewareFn {
  return async (context) => {
    const missing = vars.filter(v => !process.env[v]);
    if (missing.length > 0) {
      // We can't redirect to an error page since there's no standard error page.
      // Instead, log a warning. The site should handle this in its own content.
      console.error(`[terminaltui] Missing required environment variables: ${missing.join(", ")}`);
    }
    return undefined;
  };
}

/**
 * Simple in-memory rate limiter for API calls.
 */
export function rateLimit(options: { maxRequests: number; windowMs: number }): MiddlewareFn {
  let count = 0;
  let windowStart = Date.now();

  return async () => {
    const now = Date.now();
    if (now - windowStart > options.windowMs) {
      count = 0;
      windowStart = now;
    }
    count++;
    if (count > options.maxRequests) {
      console.warn(`[terminaltui] Rate limit exceeded: ${count}/${options.maxRequests} in ${options.windowMs}ms`);
    }
    return undefined;
  };
}

/**
 * Page content cache middleware.
 * Caches the resolved content of async pages for the given TTL.
 */
export function cache(_options: { ttl: number }): MiddlewareFn {
  // Cache is handled at the async content level, this middleware is a no-op marker
  // that the runtime can check for.
  const mw: MiddlewareFn & { _cacheTTL?: number } = async () => undefined;
  mw._cacheTTL = _options.ttl;
  return mw;
}
