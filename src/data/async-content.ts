import type { ContentBlock, AsyncContentBlock } from "../config/types.js";
import type { AsyncState } from "./types.js";

/**
 * Manages async content loading for pages and asyncContent blocks.
 */
export class AsyncContentManager {
  private states: Map<string, AsyncState> = new Map();
  private refreshTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  // Per-key load generation. A resolving load/refresh only writes its result
  // if no newer load (or reset) superseded it — without this, navigating
  // post/1 → post/2 quickly lets the slower stale fetch clobber the newer one.
  private epochs: Map<string, number> = new Map();

  /** Get the state for a given key. */
  getState(key: string): AsyncState | undefined {
    return this.states.get(key);
  }

  /** Check if content needs loading. */
  needsLoad(key: string): boolean {
    const state = this.states.get(key);
    return !state || state.status === "loading";
  }

  /**
   * Start loading async content.
   * Returns immediately — the callback is called when loading completes.
   */
  load(
    key: string,
    loader: () => Promise<ContentBlock[]>,
    onComplete: () => void,
  ): void {
    const existing = this.states.get(key);
    if (existing?.status === "loading") return; // Already loading

    const epoch = (this.epochs.get(key) ?? 0) + 1;
    this.epochs.set(key, epoch);
    this.states.set(key, { status: "loading" });

    loader().then(content => {
      if (this.epochs.get(key) !== epoch) return; // Superseded
      this.states.set(key, { status: "loaded", content, lastLoadTime: Date.now() });
      onComplete();
    }).catch(error => {
      if (this.epochs.get(key) !== epoch) return; // Superseded
      this.states.set(key, { status: "error", error: error instanceof Error ? error : new Error(String(error)) });
      onComplete();
    });
  }

  /** Set up a refresh interval for an async key. */
  setupRefresh(
    key: string,
    interval: number,
    loader: () => Promise<ContentBlock[]>,
    onComplete: () => void,
  ): void {
    // Clear existing timer if any
    this.clearRefresh(key);

    const timer = setInterval(() => {
      // Don't set to "loading" for refreshes — keep existing content visible
      const current = this.states.get(key);
      const epoch = this.epochs.get(key) ?? 0;
      loader().then(content => {
        if (this.epochs.get(key) !== epoch) return; // Superseded
        this.states.set(key, { status: "loaded", content, lastLoadTime: Date.now() });
        onComplete();
      }).catch(error => {
        if (this.epochs.get(key) !== epoch) return; // Superseded
        // On refresh error, keep existing content but log the error
        if (current?.content) {
          this.states.set(key, { ...current, lastLoadTime: Date.now() });
        } else {
          this.states.set(key, { status: "error", error: error instanceof Error ? error : new Error(String(error)) });
        }
        onComplete();
      });
    }, interval);

    this.refreshTimers.set(key, timer);
  }

  /** Clear a refresh timer. */
  clearRefresh(key: string): void {
    const timer = this.refreshTimers.get(key);
    if (timer) {
      clearInterval(timer);
      this.refreshTimers.delete(key);
    }
  }

  /** Force reload a key. */
  reload(
    key: string,
    loader: () => Promise<ContentBlock[]>,
    onComplete: () => void,
  ): void {
    this.states.delete(key);
    this.load(key, loader, onComplete);
  }

  /** Clean up all timers. */
  cleanup(): void {
    for (const timer of this.refreshTimers.values()) {
      clearInterval(timer);
    }
    this.refreshTimers.clear();
  }

  /** Reset state for a specific key. Discards any in-flight load's result. */
  reset(key: string): void {
    this.epochs.set(key, (this.epochs.get(key) ?? 0) + 1);
    this.states.delete(key);
    this.clearRefresh(key);
  }
}
