/**
 * Per-runtime context propagated through AsyncLocalStorage.
 *
 * Why this exists: helpers like `state.set()`, `navigate()`, and
 * `resolveUrl()` are imported by user code from any module — we cannot
 * pass a runtime reference through every call. With multiple concurrent
 * SSH sessions sharing one Node process, a module-level "current runtime"
 * global gets clobbered every time another session starts.
 *
 * AsyncLocalStorage propagates the active runtime through the async chain
 * of input handlers, timers, and awaited promises that originate from
 * `TUIRuntime.start()`. Lookups in user code resolve to the right session.
 *
 * Helpers that consult this context fall back to legacy module globals
 * when no context is active (e.g. unit tests).
 */
import { AsyncLocalStorage } from "node:async_hooks";

export interface RuntimeRef {
  render(): void;
  navigateToPage(pageId: string, params?: Record<string, string>): void;
  apiBaseUrl?: string | null;
}

export const runtimeContext = new AsyncLocalStorage<RuntimeRef>();

export function currentRuntime(): RuntimeRef | undefined {
  return runtimeContext.getStore();
}
