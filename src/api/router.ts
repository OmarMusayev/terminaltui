import type { ApiHandler, WsHandler, ParsedRoute } from "./types.js";

/**
 * Parse a route key like "GET /containers/:id" into a method, regex pattern,
 * and param name list.
 */
export function parseRouteKey(key: string): { method: string; pattern: RegExp; paramNames: string[] } {
  const spaceIdx = key.indexOf(" ");
  if (spaceIdx === -1) {
    throw new Error(`Invalid API route key: "${key}". Expected format: "METHOD /path"`);
  }

  const method = key.slice(0, spaceIdx).toUpperCase();
  const path = key.slice(spaceIdx + 1).trim();

  if (!path.startsWith("/")) {
    throw new Error(`API route path must start with "/": "${key}"`);
  }

  const paramNames: string[] = [];
  const patternStr = path.replace(/:(\w+)/g, (_, name) => {
    paramNames.push(name);
    return "([^/]+)";
  });

  const pattern = new RegExp(`^${patternStr}$`);
  return { method, pattern, paramNames };
}

/**
 * Parse all route definitions from the api config object into a list of
 * ParsedRoute entries.
 */
export function parseRoutes(api: Record<string, ApiHandler | WsHandler>): ParsedRoute[] {
  const routes: ParsedRoute[] = [];

  for (const [key, handler] of Object.entries(api)) {
    const { method, pattern, paramNames } = parseRouteKey(key);
    routes.push({ method, pattern, paramNames, handler });
  }

  return routes;
}

/**
 * Match an incoming request method + pathname against parsed routes.
 * Returns the matched route and extracted params, or null.
 */
export function matchRoute(
  routes: ParsedRoute[],
  method: string,
  pathname: string,
): { route: ParsedRoute; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = pathname.match(route.pattern);
    if (!match) continue;

    const params: Record<string, string> = {};
    route.paramNames.forEach((name, i) => {
      params[name] = decodeURIComponent(match[i + 1]);
    });

    return { route, params };
  }

  return null;
}
