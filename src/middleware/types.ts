import type { RouteParams } from "../router/types.js";

/** Context passed to middleware. */
export interface MiddlewareContext {
  page: string;
  params: RouteParams;
  state: Record<string, unknown> | null;
}

/** Middleware result — void to continue, redirect to change destination. */
export type MiddlewareResult = void | undefined | { redirect: string; params?: RouteParams };

/** Middleware function signature. */
export type MiddlewareFn = (context: MiddlewareContext) => Promise<MiddlewareResult> | MiddlewareResult;
