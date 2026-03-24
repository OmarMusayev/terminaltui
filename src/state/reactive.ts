import type { StateContainer, StateListener, WildcardListener, Unsubscribe } from "./types.js";

// Global tracking for auto-dependency detection in computed/dynamic
let _tracking = false;
let _trackedKeys = new Set<string>();
let _trackedStateId: string | null = null;
let _trackedDeps = new Map<string, Set<string>>();

// Registry of state containers by ID for auto-subscription in computed()
const _stateRegistry = new Map<string, StateContainer<any>>();

export function getStateById(id: string): StateContainer<any> | undefined {
  return _stateRegistry.get(id);
}

export function startTracking(stateId?: string): void {
  _tracking = true;
  _trackedKeys.clear();
  _trackedStateId = stateId ?? null;
  _trackedDeps.clear();
}

export function stopTracking(): { stateId: string; keys: Set<string>; deps: Map<string, Set<string>> } {
  _tracking = false;
  const result = {
    stateId: _trackedStateId ?? '',
    keys: new Set(_trackedKeys),
    deps: new Map(_trackedDeps),
  };
  _trackedKeys.clear();
  _trackedStateId = null;
  _trackedDeps.clear();
  return result;
}

export function isTracking(): boolean {
  return _tracking;
}

function trackAccess(stateId: string, key: string): void {
  if (!_trackedDeps.has(stateId)) {
    _trackedDeps.set(stateId, new Set());
  }
  _trackedDeps.get(stateId)!.add(key);
}

let stateIdCounter = 0;

// Global render callback — set by the runtime to trigger re-renders
let _renderCallback: (() => void) | null = null;
export function setRenderCallback(cb: (() => void) | null): void {
  _renderCallback = cb;
}
export function getRenderCallback(): (() => void) | null {
  return _renderCallback;
}

/**
 * Creates a reactive state container. Changes trigger UI re-renders automatically.
 *
 * @param initial - Initial state values
 * @returns A state container with get/set/update/batch/subscribe methods
 *
 * @example
 * const counter = createState({ count: 0 });
 * counter.set("count", counter.get("count") + 1);
 */
export function createState<T extends Record<string, any>>(initial: T): StateContainer<T> {
  const id = `state-${stateIdCounter++}`;
  const data = { ...initial };
  const listeners = new Map<string, Set<StateListener>>();
  const wildcardListeners = new Set<WildcardListener>();
  let batching = false;
  let pendingChanges = new Map<string, { newVal: any; oldVal: any }>();

  function notify(key: string, newVal: any, oldVal: any): void {
    if (batching) {
      pendingChanges.set(key, { newVal, oldVal });
      return;
    }
    const keyListeners = listeners.get(key);
    if (keyListeners) {
      for (const fn of keyListeners) fn(newVal, oldVal);
    }
    for (const fn of wildcardListeners) fn(key, newVal);
    // Trigger global re-render
    _renderCallback?.();
  }

  function flushBatch(): void {
    const changes = new Map(pendingChanges);
    pendingChanges.clear();
    for (const [key, { newVal, oldVal }] of changes) {
      const keyListeners = listeners.get(key);
      if (keyListeners) {
        for (const fn of keyListeners) fn(newVal, oldVal);
      }
      for (const fn of wildcardListeners) fn(key, newVal);
    }
    if (changes.size > 0) {
      _renderCallback?.();
    }
  }

  const container: StateContainer<T> = {
    _id: id,

    get(key?: any): any {
      if (key === undefined) {
        // Track all keys if tracking is active
        if (_tracking) {
          if (_trackedStateId === null || _trackedStateId === id) {
            for (const k of Object.keys(data)) {
              _trackedKeys.add(k);
              trackAccess(id, k);
            }
          }
        }
        return { ...data };
      }
      // Track this key access
      if (_tracking) {
        if (_trackedStateId === null || _trackedStateId === id) {
          _trackedKeys.add(key);
          trackAccess(id, key);
        }
      }
      return data[key as keyof T];
    },

    set(key: any, value: any): void {
      const oldVal = data[key as keyof T];
      if (oldVal === value) return; // no change
      (data as any)[key] = value;
      notify(key as string, value, oldVal);
    },

    update(key: any, fn: (prev: any) => any): void {
      const oldVal = data[key as keyof T];
      const newVal = fn(oldVal);
      if (oldVal === newVal) return;
      (data as any)[key] = newVal;
      notify(key as string, newVal, oldVal);
    },

    batch(fn: () => void): void {
      batching = true;
      try {
        fn();
      } finally {
        batching = false;
        flushBatch();
      }
    },

    on(key: any, handler: any): Unsubscribe {
      if (key === "*") {
        wildcardListeners.add(handler);
        return () => wildcardListeners.delete(handler);
      }
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key)!.add(handler);
      return () => listeners.get(key)?.delete(handler);
    },

    keys(): (keyof T)[] {
      return Object.keys(data) as (keyof T)[];
    },
  };

  _stateRegistry.set(id, container);
  return container;
}
