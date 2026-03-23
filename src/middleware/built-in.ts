import type { MiddlewareFn } from "./types.js";

/**
 * Middleware that checks for required environment variables.
 * If any are missing, throws an error that prevents the page from loading
 * and shows a clear message about what's needed.
 */
export function requireEnv(vars: string[]): MiddlewareFn {
  return async () => {
    const missing = vars.filter(v => !process.env[v]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}\n` +
        `Set them in a .env file or export them before running.`
      );
    }
    return undefined;
  };
}

/**
 * Simple in-memory rate limiter.
 * Tracks navigation count within a time window. When the limit is exceeded,
 * throws an error to prevent the navigation.
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
      throw new Error(
        `Rate limit exceeded: ${count}/${options.maxRequests} requests in ${options.windowMs}ms window.`
      );
    }
    return undefined;
  };
}
