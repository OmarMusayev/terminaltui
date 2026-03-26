/**
 * Filesystem scanner — discovers page files, layout files, and API route files
 * from the project directory structure.
 */
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, basename, extname } from "node:path";
import type { ProjectDetection } from "./types.js";

/** File info discovered during scanning. */
export interface ScannedFile {
  /** Absolute path to the file. */
  absolutePath: string;
  /** Path relative to the scanned directory (e.g., "about.ts", "projects/index.ts"). */
  relativePath: string;
  /** File name without extension. */
  name: string;
  /** Whether this is a layout file. */
  isLayout: boolean;
  /** Whether this is an index file. */
  isIndex: boolean;
  /** Whether this is a dynamic route file (e.g., [slug].ts). */
  isDynamic: boolean;
  /** Param name for dynamic routes. */
  paramName?: string;
  /** Directory depth relative to scan root (0 = root). */
  depth: number;
  /** Parent directory relative to scan root. */
  parentDir: string;
}

/**
 * Scan a directory recursively for .ts files.
 * Ignores non-.ts files, node_modules, hidden directories, and .terminaltui.
 */
export function scanDirectory(dir: string, rootDir?: string): ScannedFile[] {
  const root = rootDir ?? dir;
  const results: ScannedFile[] = [];

  if (!existsSync(dir)) return results;

  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);

    // Skip hidden files/dirs and node_modules
    if (entry.startsWith(".") || entry === "node_modules" || entry === ".terminaltui") {
      continue;
    }

    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...scanDirectory(fullPath, root));
    } else if (stat.isFile() && (extname(entry) === ".ts" || extname(entry) === ".js" || extname(entry) === ".mjs")) {
      const relPath = relative(root, fullPath);
      const nameNoExt = basename(entry, extname(entry));
      const parentDir = relative(root, dir);

      // Detect dynamic routes: [param].ts
      const dynamicMatch = nameNoExt.match(/^\[(\w+)\]$/);

      results.push({
        absolutePath: fullPath,
        relativePath: relPath,
        name: nameNoExt,
        isLayout: nameNoExt === "layout",
        isIndex: nameNoExt === "index",
        isDynamic: !!dynamicMatch,
        paramName: dynamicMatch?.[1],
        depth: parentDir === "" ? 0 : parentDir.split("/").length,
        parentDir,
      });
    }
  }

  return results;
}

/**
 * Scan pages/ directory and categorize files.
 */
export function scanPages(pagesDir: string): {
  pages: ScannedFile[];
  layouts: ScannedFile[];
} {
  const all = scanDirectory(pagesDir);

  return {
    pages: all.filter(f => !f.isLayout),
    layouts: all.filter(f => f.isLayout),
  };
}

/**
 * Scan api/ directory for API route files.
 */
export function scanApiDirectory(apiDir: string): ScannedFile[] {
  return scanDirectory(apiDir);
}

/**
 * Detect project type by checking for config.ts + pages/ vs site.config.ts.
 */
export function detectProject(projectDir: string): ProjectDetection {
  const configTs = join(projectDir, "config.ts");
  const pagesDir = join(projectDir, "pages");
  const apiDir = join(projectDir, "api");

  // Check for file-based routing structure
  if (existsSync(configTs) && existsSync(pagesDir)) {
    return {
      type: "file-based",
      projectDir,
      configPath: configTs,
      pagesDir,
      apiDir: existsSync(apiDir) ? apiDir : undefined,
    };
  }

  // Fall back to single-file config
  const singleFileNames = ["site.config.ts", "site.config.js", "site.config.mjs"];
  for (const name of singleFileNames) {
    const p = join(projectDir, name);
    if (existsSync(p)) {
      return {
        type: "single-file",
        projectDir,
        configPath: p,
      };
    }
  }

  // Default: assume file-based if config.ts exists, even without pages/
  if (existsSync(configTs)) {
    return {
      type: "file-based",
      projectDir,
      configPath: configTs,
      pagesDir: existsSync(pagesDir) ? pagesDir : undefined,
      apiDir: existsSync(apiDir) ? apiDir : undefined,
    };
  }

  throw new Error(
    `No config found in ${projectDir}. Expected config.ts + pages/ (file-based routing) or site.config.ts (single file).`
  );
}
