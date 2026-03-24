import type { ComputedValue } from "./types.js";
import { startTracking, stopTracking, getStateById } from "./reactive.js";

export function computed<T>(fn: () => T): ComputedValue<T> {
  let cached: T | undefined;
  let dirty = true;
  let unsubscribes: (() => void)[] = [];

  function invalidate(): void {
    dirty = true;
  }

  function recalculate(): T {
    // Clean up old subscriptions
    for (const unsub of unsubscribes) unsub();
    unsubscribes = [];

    // Track dependencies across all state containers
    startTracking();
    cached = fn();
    const { deps } = stopTracking();

    // Auto-subscribe to all accessed state keys
    for (const [stateId, keys] of deps) {
      const state = getStateById(stateId);
      if (state) {
        for (const key of keys) {
          unsubscribes.push(state.on(key, () => invalidate()));
        }
      }
    }

    dirty = false;
    return cached;
  }

  return {
    get(): T {
      if (dirty || cached === undefined) {
        return recalculate();
      }
      return cached;
    },
    invalidate,
  };
}
