/** Listener for a specific state key change. */
export type StateListener<T = any> = (newValue: T, oldValue: T) => void;

/** Listener for any state change. */
export type WildcardListener = (key: string, newValue: any) => void;

/** Unsubscribe function returned by on(). */
export type Unsubscribe = () => void;

/** A reactive state container. */
export interface StateContainer<T extends Record<string, any>> {
  get(): T;
  get<K extends keyof T>(key: K): T[K];
  set<K extends keyof T>(key: K, value: T[K]): void;
  update<K extends keyof T>(key: K, fn: (prev: T[K]) => T[K]): void;
  batch(fn: () => void): void;
  on<K extends keyof T>(key: K, handler: StateListener<T[K]>): Unsubscribe;
  on(key: "*", handler: WildcardListener): Unsubscribe;
  /** Get all keys. */
  keys(): (keyof T)[];
  /** Internal: ID for tracking. */
  _id: string;
}

/** Options for persistent state. */
export interface PersistentStateOptions<T extends Record<string, any>> {
  path: string;
  defaults: T;
  encrypt?: boolean;
}

/** A computed/derived value. */
export interface ComputedValue<T> {
  get(): T;
  /** Force recalculation. */
  invalidate(): void;
}
