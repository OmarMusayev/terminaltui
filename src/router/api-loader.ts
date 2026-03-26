/**
 * Discovers and registers API routes from the api/ directory.
 *
 * Maps file paths to HTTP endpoints:
 *   api/stats.ts → /api/stats (GET, POST, etc. from named exports)
 *   api/projects/[id].ts → /api/projects/:id
 */
import { basename, extname, relative } from "node:path";
import type { ApiRoute, ApiModule, ApiMethodRequest } from "./types.js";
import type { ApiHandler, ApiRequest } from "../api/types.js";
import type { ScannedFile } from "./scanner.js";
import { loadApiModule } from "./page-loader.js";

/**
 * Build API route definitions from scanned api/ files.
 */
export function buildApiRoutes(apiFiles: ScannedFile[]): ApiRoute[] {
  const routes: ApiRoute[] = [];

  for (const file of apiFiles) {
    const endpoint = fileToEndpoint(file);
    const paramNames = extractParamNames(file);

    routes.push({
      endpoint,
      filePath: file.absolutePath,
      methods: [], // Will be populated when module is loaded
      paramNames,
    });
  }

  return routes;
}

/**
 * Convert a scanned file to an API endpoint path.
 *
 * Rules:
 *   stats.ts → /api/stats
 *   contact.ts → /api/contact
 *   projects/[id].ts → /api/projects/:id
 *   projects/index.ts → /api/projects
 */
function fileToEndpoint(file: ScannedFile): string {
  let path = file.relativePath;

  // Remove extension
  path = path.replace(/\.(ts|js|mjs)$/, "");

  // Handle index files
  path = path.replace(/\/index$/, "");
  if (path === "index") path = "";

  // Convert [param] to :param
  path = path.replace(/\[(\w+)\]/g, ":$1");

  return `/api/${path}`.replace(/\/+/g, "/");
}

/**
 * Extract param names from a file's path.
 */
function extractParamNames(file: ScannedFile): string[] {
  const params: string[] = [];
  const matches = file.relativePath.matchAll(/\[(\w+)\]/g);
  for (const match of matches) {
    params.push(match[1]);
  }
  return params;
}

/**
 * Load all API modules and convert them to the existing api record format
 * compatible with ApiServer.registerRoutes().
 *
 * Returns a Record<string, ApiHandler> like:
 *   { "GET /api/stats": handler, "POST /api/contact": handler }
 */
export async function loadApiRoutes(
  apiRoutes: ApiRoute[],
  outDir: string,
): Promise<Record<string, ApiHandler>> {
  const result: Record<string, ApiHandler> = {};

  for (const route of apiRoutes) {
    const mod = await loadApiModule(route.filePath, outDir);
    const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;

    for (const method of methods) {
      const handler = mod[method];
      if (!handler) continue;

      // Update route's methods list
      if (!route.methods.includes(method)) {
        route.methods.push(method);
      }

      // Convert file-based handler to ApiServer-compatible handler
      const key = `${method} ${route.endpoint}`;
      result[key] = createCompatHandler(handler);
    }
  }

  return result;
}

/**
 * Wrap a file-based API handler to match the existing ApiHandler signature.
 * File-based handlers receive { params, body, query, headers }.
 * Existing handlers receive the full ApiRequest.
 */
function createCompatHandler(
  handler: (req: ApiMethodRequest) => unknown | Promise<unknown>,
): ApiHandler {
  return async (req: ApiRequest) => {
    return handler({
      params: req.params,
      body: req.body,
      query: req.query,
      headers: req.headers,
    });
  };
}
