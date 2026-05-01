/**
 * Compiles and loads page modules using esbuild.
 * Same compilation pipeline as the existing site.config.ts compilation.
 */
import { resolve, dirname, join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import type { PageModule, LayoutModule, ApiModule, FileBasedConfig } from "./types.js";

/** Cache of compiled modules by absolute file path. */
const moduleCache = new Map<string, unknown>();

/**
 * Compile a TypeScript file to JavaScript using esbuild.
 * Returns the path to the compiled .mjs file.
 */
export async function compileFile(
  filePath: string,
  outDir: string,
): Promise<string> {
  const absPath = resolve(filePath);

  // In dev (tsx/ts-node), import the source file directly — skips a wasteful
  // bundle pass and avoids hitting native binary deps (e.g. ssh2's .node files)
  // when a project's pages import the framework via a relative path.
  if (process.execArgv.some(a => a.includes("tsx") || a.includes("ts-node"))) {
    return absPath;
  }

  const outFile = join(outDir, fileToOutName(absPath));
  mkdirSync(outDir, { recursive: true });

  try {
    const { build } = await import("esbuild");
    await build({
      entryPoints: [absPath],
      outfile: outFile,
      bundle: true,
      format: "esm",
      platform: "node",
      // Externalize the framework regardless of whether the project imports it
      // by package name or a relative path into src/. The `*` patterns let
      // esbuild treat any matching path as an external dep at runtime.
      external: ["terminaltui", "*/src/index.js", "*/src/index.ts", "ssh2", "node-pty"],
      target: "node18",
    });
  } catch (err: any) {
    throw new Error(
      `Failed to compile ${filePath}. esbuild is required for file-based routing in production.\n` +
      `Install it: npm install esbuild\n\n` +
      `Original error: ${err?.message || err}`
    );
  }

  return outFile;
}

/**
 * Generate a unique output filename from a source path.
 *
 * Uses a sha1 of the absolute path so the cache key is collision-free.
 * The previous "last 80 chars" scheme could collide for deeply nested
 * paths sharing a tail (e.g. two projects' identical pages/index.ts).
 * The basename prefix is preserved to keep filenames recognizable in /dist.
 */
function fileToOutName(absPath: string): string {
  const hash = createHash("sha1").update(absPath).digest("hex").slice(0, 12);
  const base = absPath.split(/[/\\]/).pop() ?? "module";
  const safeBase = base.replace(/\.[tj]sx?$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${safeBase}.${hash}.mjs`;
}

/**
 * Load a compiled module from a file path.
 */
async function loadModule(filePath: string): Promise<unknown> {
  const cached = moduleCache.get(filePath);
  if (cached) return cached;

  const fileUrl = pathToFileURL(resolve(filePath)).href;
  const mod = await import(fileUrl);
  moduleCache.set(filePath, mod);
  return mod;
}

/**
 * Load a page module — returns its default export (PageFunction) and metadata.
 */
export async function loadPageModule(
  filePath: string,
  outDir: string,
): Promise<PageModule> {
  const compiled = await compileFile(filePath, outDir);
  const mod = await loadModule(compiled) as Record<string, unknown>;

  if (typeof mod.default !== "function") {
    throw new Error(
      `Page file ${filePath} must have a default export that is a function. ` +
      `Got: ${typeof mod.default}`
    );
  }

  return {
    default: mod.default as PageModule["default"],
    metadata: mod.metadata as PageModule["metadata"],
  };
}

/**
 * Load a layout module — returns its default export (LayoutFunction).
 */
export async function loadLayoutModule(
  filePath: string,
  outDir: string,
): Promise<LayoutModule> {
  const compiled = await compileFile(filePath, outDir);
  const mod = await loadModule(compiled) as Record<string, unknown>;

  if (typeof mod.default !== "function") {
    throw new Error(
      `Layout file ${filePath} must have a default export that is a function. ` +
      `Got: ${typeof mod.default}`
    );
  }

  return {
    default: mod.default as LayoutModule["default"],
  };
}

/**
 * Load an API module — returns named HTTP method exports.
 */
export async function loadApiModule(
  filePath: string,
  outDir: string,
): Promise<ApiModule> {
  const compiled = await compileFile(filePath, outDir);
  const mod = await loadModule(compiled) as Record<string, unknown>;

  const apiModule: ApiModule = {};
  const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;

  for (const method of methods) {
    if (typeof mod[method] === "function") {
      apiModule[method] = mod[method] as ApiModule[typeof method];
    }
  }

  return apiModule;
}

/**
 * Load the file-based config (config.ts default export).
 */
export async function loadFileBasedConfig(
  configPath: string,
  outDir: string,
): Promise<FileBasedConfig> {
  const compiled = await compileFile(configPath, outDir);
  const mod = await loadModule(compiled) as Record<string, unknown>;

  const config = mod.default as FileBasedConfig;
  if (!config || typeof config !== "object") {
    throw new Error(
      `config.ts must have a default export created with defineConfig(). ` +
      `Got: ${typeof config}`
    );
  }

  if (!config.name) {
    throw new Error("config.ts must include a 'name' field.");
  }

  return config;
}

/**
 * Invalidate the module cache for a specific file.
 * Used during hot reload in dev mode.
 */
export function invalidateModule(filePath: string): void {
  const absPath = resolve(filePath);
  moduleCache.delete(absPath);
  // Also remove any compiled variants
  for (const [key] of moduleCache) {
    if (key.includes(fileToOutName(absPath))) {
      moduleCache.delete(key);
    }
  }
}

/**
 * Clear the entire module cache.
 */
export function clearModuleCache(): void {
  moduleCache.clear();
}
