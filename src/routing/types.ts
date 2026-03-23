import type { ContentBlock } from "../config/types.js";

/** Route parameters passed to parameterized routes. */
export type RouteParams = Record<string, string>;

/** A parameterized route definition. */
export interface RouteConfig {
  id: string;
  title: string | ((params: RouteParams) => string);
  icon?: string;
  content: ((params: RouteParams) => Promise<ContentBlock[]>) | ((params: RouteParams) => ContentBlock[]);
  loading?: string | ((params: RouteParams) => string);
  onError?: (err: Error, params: RouteParams) => ContentBlock[];
  middleware?: MiddlewareFn[];
}

/** Navigation history entry with optional params. */
export interface HistoryEntry {
  page: string;
  params?: RouteParams;
}

/** Navigate action on a card or button. */
export interface NavigateAction {
  navigate: string;
  params?: RouteParams;
}

/** Middleware function signature. */
export type MiddlewareFn = (context: MiddlewareContext) => Promise<MiddlewareResult> | MiddlewareResult;

/** Context passed to middleware. */
export interface MiddlewareContext {
  page: string;
  params: RouteParams;
  state: any; // StateContainer — typed as any to avoid circular deps
}

/** Middleware result — void to continue, redirect to change destination. */
export type MiddlewareResult = void | undefined | { redirect: string; params?: RouteParams };
