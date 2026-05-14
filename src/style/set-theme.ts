import { currentRuntime } from "../core/runtime-context.js";
import type { BuiltinThemeName } from "./theme.js";

/**
 * Switch the active theme from inside a page or component.
 *
 * Mirrors `:theme <name>` for use from button onPress / state callbacks.
 * Returns false if the runtime is unavailable (called outside an active
 * `start()` scope) or if the name doesn't match a built-in theme.
 *
 * @example
 * ```ts
 * button({
 *   label: "Dracula",
 *   onPress: () => {
 *     setTheme("dracula");
 *     return { success: "Theme: dracula" };
 *   },
 * });
 * ```
 */
export function setTheme(name: BuiltinThemeName | string): boolean {
  const rt = currentRuntime();
  if (rt?.setTheme) {
    return rt.setTheme(name);
  }
  return false;
}
