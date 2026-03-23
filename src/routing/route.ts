import type { RouteConfig } from "./types.js";

/**
 * Define a parameterized route.
 * Unlike page(), routes receive params and their content is always a function.
 */
export function route(id: string, config: Omit<RouteConfig, "id">): RouteConfig {
  return { id, ...config };
}
