interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class DataCache {
  private entries = new Map<string, CacheEntry<any>>();

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl: number): void {
    this.entries.set(key, { data, timestamp: Date.now(), ttl });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}

export const globalCache = new DataCache();
