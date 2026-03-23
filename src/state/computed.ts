import type { ComputedValue } from "./types.js";
import { startTracking, stopTracking } from "./reactive.js";

export function computed<T>(fn: () => T): ComputedValue<T> {
  let cached: T | undefined;
  let dirty = true;
  let deps: { stateId: string; keys: Set<string> } | null = null;
  let unsubscribes: (() => void)[] = [];

  function recalculate(): T {
    // Clean up old subscriptions
    for (const unsub of unsubscribes) unsub();
    unsubscribes = [];

    // Track dependencies
    // We need access to the state containers to subscribe.
    // For simplicity, just recalculate every time get() is called if dirty.
    cached = fn();
    dirty = false;
    return cached;
  }

  return {
    get(): T {
      // Always recalculate if dirty (simple approach — no auto-subscription)
      // For real reactivity, the state.on() mechanism handles re-renders
      if (dirty || cached === undefined) {
        return recalculate();
      }
      return cached;
    },
    invalidate(): void {
      dirty = true;
    },
  };
}
