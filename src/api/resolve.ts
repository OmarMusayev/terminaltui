/**
 * URL resolution for API routes.
 *
 * Uses globalThis so the base URL is shared across module instances —
 * this is critical because in dev mode the runtime (source) and
 * fetcher/request (npm package) may be separate module copies.
 */

const KEY = "__terminaltui_api_base_url__";

export function setApiBaseUrl(url: string | null): void {
  if (url) {
    (globalThis as any)[KEY] = url;
  } else {
    delete (globalThis as any)[KEY];
  }
}

export function getApiBaseUrl(): string | null {
  return (globalThis as any)[KEY] ?? null;
}

export function resolveUrl(url: string): string {
  const base = getApiBaseUrl();
  if (url.startsWith("/") && base) {
    return `${base}${url}`;
  }
  return url;
}
