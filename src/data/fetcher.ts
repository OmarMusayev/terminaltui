import { globalCache } from "./cache.js";
import { resolveUrl } from "../api/resolve.js";
import { currentRuntime } from "../core/runtime-context.js";

export interface FetcherOptions<T = any> {
  url?: string;
  fetch?: () => Promise<T>;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  refreshInterval?: number;
  cache?: boolean;
  cacheTTL?: number;
  retry?: number;
  retryDelay?: number;
  transform?: (data: any) => T;
  onError?: (err: Error) => void;
}

export interface FetcherResult<T = any> {
  readonly data: T | null;
  readonly loading: boolean;
  readonly error: Error | null;
  refresh(): Promise<void>;
  mutate(data: T): void;
  clear(): void;
  destroy(): void;
}

// ─── Fetcher Instance Registry ───────────────────────────
// Persists fetcher instances across dynamic block re-renders.
// Without this, every render() call recreates fetchers, leaking
// timers/connections and causing render storms.

const REGISTRY_KEY = "__terminaltui_fetcher_registry__";

function getRegistry(): Map<string, FetcherResult<any>> {
  let reg = (globalThis as any)[REGISTRY_KEY] as Map<string, FetcherResult<any>> | undefined;
  if (!reg) {
    reg = new Map();
    (globalThis as any)[REGISTRY_KEY] = reg;
  }
  return reg;
}

/** Build a stable cache key for a fetcher's options. */
function buildKey(options: FetcherOptions): string {
  if (options.url) {
    return `${options.method ?? "GET"}:${options.url}`;
  }
  // Custom fetch functions can't be meaningfully keyed — give each a unique id
  return "custom-" + Math.random().toString(36).slice(2);
}

/** Destroy all registered fetchers. Called by the runtime on shutdown. */
/** Stops all active fetcher refresh timers. Called during runtime cleanup. */
export function destroyAllFetchers(): void {
  const reg = (globalThis as any)[REGISTRY_KEY] as Map<string, FetcherResult<any>> | undefined;
  if (reg) {
    for (const f of reg.values()) f.destroy();
    reg.clear();
  }
}

// ─── Fetcher Factory ─────────────────────────────────────

/**
 * Creates a declarative data fetcher with automatic caching, refresh, and retry.
 * Returns a reactive result object whose `data` property updates when fetches complete.
 *
 * @param options - URL, refresh interval, cache settings, and error handling
 * @returns A FetcherResult with data, loading state, and error
 */
export function fetcher<T = any>(options: FetcherOptions<T>): FetcherResult<T> {
  // Return existing instance if one exists for this URL
  const key = buildKey(options);
  const registry = getRegistry();
  const existing = registry.get(key);
  if (existing) return existing as FetcherResult<T>;

  // Create new instance
  let _data: T | null = null;
  let _loading = true;
  let _error: Error | null = null;
  let _refreshTimer: ReturnType<typeof setInterval> | null = null;
  let _destroyed = false;
  let _onChange: (() => void) | null = null;

  const cacheKey = options.url ?? key;
  const useCache = options.cache !== false;
  const cacheTTL = options.cacheTTL ?? 60000;
  const maxRetries = options.retry ?? 0;
  const retryDelay = options.retryDelay ?? 1000;

  function scheduleRender(): void {
    if (_onChange) {
      _onChange();
      return;
    }
    const rt = currentRuntime();
    if (rt) {
      rt.render();
      return;
    }
    // Cross-package fallback: when runtime (dev source) and fetcher (installed npm)
    // are separate module copies, AsyncLocalStorage doesn't bridge them.
    const globalCb = (globalThis as any).__terminaltui_render_callback__;
    if (typeof globalCb === "function") globalCb();
  }

  async function doFetch(): Promise<void> {
    if (_destroyed) return;

    // Check cache first
    if (useCache) {
      const cached = globalCache.get<T>(cacheKey);
      if (cached !== undefined) {
        _data = cached;
        _loading = false;
        _error = null;
        // Don't schedule render for cache hits during initial construction —
        // the caller is already reading .data synchronously
        return;
      }
    }

    _loading = _data === null;
    // Don't notify here — we'll notify after the async fetch completes

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        let raw: any;
        if (options.fetch) {
          raw = await options.fetch();
        } else if (options.url) {
          const fetchOpts: RequestInit = {
            method: options.method ?? "GET",
            headers: options.headers ? { ...options.headers } : undefined,
          };
          if (options.body) {
            (fetchOpts.headers as any) ??= {};
            (fetchOpts.headers as any)["Content-Type"] = "application/json";
            fetchOpts.body = JSON.stringify(options.body);
          }
          const res = await globalThis.fetch(resolveUrl(options.url), fetchOpts);
          if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          raw = await res.json();
        } else {
          throw new Error("fetcher requires either url or fetch option");
        }

        const result = options.transform ? options.transform(raw) : raw;

        if (_destroyed) return;
        _data = result;
        _loading = false;
        _error = null;

        if (useCache) {
          globalCache.set(cacheKey, result, cacheTTL);
        }

        scheduleRender();
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, retryDelay));
        }
      }
    }

    if (_destroyed) return;
    _error = lastError;
    _loading = false;
    if (options.onError && lastError) options.onError(lastError);
    scheduleRender();
  }

  // Start initial fetch
  doFetch();

  // Set up auto-refresh
  if (options.refreshInterval) {
    _refreshTimer = setInterval(() => {
      if (useCache) globalCache.delete(cacheKey);
      doFetch();
    }, options.refreshInterval);
  }

  const instance: FetcherResult<T> = {
    get data() { return _data; },
    get loading() { return _loading; },
    get error() { return _error; },

    async refresh(): Promise<void> {
      if (useCache) globalCache.delete(cacheKey);
      await doFetch();
    },

    mutate(data: T): void {
      _data = data;
      _error = null;
      _loading = false;
      if (useCache) globalCache.set(cacheKey, data, cacheTTL);
      scheduleRender();
    },

    clear(): void {
      _data = null;
      _error = null;
      _loading = false;
      globalCache.delete(cacheKey);
      scheduleRender();
    },

    destroy(): void {
      _destroyed = true;
      if (_refreshTimer) clearInterval(_refreshTimer);
      _refreshTimer = null;
      registry.delete(key);
    },
  };

  // Expose _setOnChange for the runtime
  (instance as any)._setOnChange = (cb: () => void) => { _onChange = cb; };

  // Store in registry
  registry.set(key, instance);

  return instance;
}
