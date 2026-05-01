/**
 * URL resolution for API routes.
 *
 * Inside an active runtime, the base URL comes from AsyncLocalStorage so
 * concurrent SSH sessions don't see each other's port. Outside, we fall
 * back to a globalThis slot — this matters in dev mode where the runtime
 * (source) and fetcher/request (npm package) may be separate module copies.
 */
import { currentRuntime } from "../core/runtime-context.js";

const KEY = "__terminaltui_api_base_url__";

export function setApiBaseUrl(url: string | null): void {
  const rt = currentRuntime();
  if (rt) {
    rt.apiBaseUrl = url;
    return;
  }
  if (url) {
    (globalThis as any)[KEY] = url;
  } else {
    delete (globalThis as any)[KEY];
  }
}

export function getApiBaseUrl(): string | null {
  const rt = currentRuntime();
  if (rt && rt.apiBaseUrl !== undefined) return rt.apiBaseUrl;
  return (globalThis as any)[KEY] ?? null;
}

export function resolveUrl(url: string): string {
  const base = getApiBaseUrl();
  if (url.startsWith("/") && base) {
    return `${base}${url}`;
  }
  return url;
}
