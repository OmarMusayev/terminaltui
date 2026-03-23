import { globalCache } from "./cache.js";

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

export function fetcher<T = any>(options: FetcherOptions<T>): FetcherResult<T> {
  let _data: T | null = null;
  let _loading = true;
  let _error: Error | null = null;
  let _refreshTimer: ReturnType<typeof setInterval> | null = null;
  let _destroyed = false;
  // Use a render callback to trigger UI updates
  let _onChange: (() => void) | null = null;

  const cacheKey = options.url ?? "custom-fetcher-" + Math.random().toString(36).slice(2);
  const useCache = options.cache !== false;
  const cacheTTL = options.cacheTTL ?? 60000;
  const maxRetries = options.retry ?? 0;
  const retryDelay = options.retryDelay ?? 1000;

  async function doFetch(): Promise<void> {
    if (_destroyed) return;

    // Check cache first
    if (useCache) {
      const cached = globalCache.get<T>(cacheKey);
      if (cached !== undefined) {
        _data = cached;
        _loading = false;
        _error = null;
        _onChange?.();
        return;
      }
    }

    _loading = _data === null; // Only show loading if no data yet
    _onChange?.();

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
          const res = await globalThis.fetch(options.url, fetchOpts);
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

        _onChange?.();
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
    _onChange?.();
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

  const result: FetcherResult<T> = {
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
      _onChange?.();
    },

    clear(): void {
      _data = null;
      _error = null;
      _loading = false;
      globalCache.delete(cacheKey);
      _onChange?.();
    },

    destroy(): void {
      _destroyed = true;
      if (_refreshTimer) clearInterval(_refreshTimer);
      _refreshTimer = null;
    },
  };

  // IMPORTANT: We expose a way to set the onChange callback.
  // The runtime will set this when it encounters a fetcher in a dynamic block.
  (result as any)._setOnChange = (cb: () => void) => { _onChange = cb; };

  return result;
}
