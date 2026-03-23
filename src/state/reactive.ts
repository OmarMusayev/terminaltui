import type { StateContainer, StateListener, WildcardListener, Unsubscribe } from "./types.js";

// Global tracking for auto-dependency detection in computed/dynamic
let _tracking = false;
let _trackedKeys = new Set<string>();
let _trackedStateId: string | null = null;

export function startTracking(stateId: string): void {
  _tracking = true;
  _trackedKeys.clear();
  _trackedStateId = stateId;
}

export function stopTracking(): { stateId: string; keys: Set<string> } {
  _tracking = false;
  const result = { stateId: _trackedStateId!, keys: new Set(_trackedKeys) };
  _trackedKeys.clear();
  _trackedStateId = null;
  return result;
}

export function isTracking(): boolean {
  return _tracking;
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
        if (_tracking && _trackedStateId === id) {
          for (const k of Object.keys(data)) _trackedKeys.add(k);
        }
        return { ...data };
      }
      // Track this key access
      if (_tracking && _trackedStateId === id) {
        _trackedKeys.add(key);
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

  return container;
}
