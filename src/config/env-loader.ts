import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Parse a .env file into key-value pairs.
 * Supports:
 * - KEY=VALUE
 * - KEY="VALUE" (quoted values, preserves spaces)
 * - KEY='VALUE' (single-quoted)
 * - # comments
 * - Empty lines (ignored)
 * - Inline comments: KEY=VALUE # comment
 */
function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith("#")) continue;

    const eqIdx = line.indexOf("=");
    if (eqIdx < 0) continue;

    const key = line.substring(0, eqIdx).trim();
    let value = line.substring(eqIdx + 1).trim();

    // Handle quoted values
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      // Strip inline comments (unquoted values only)
      const commentIdx = value.indexOf(" #");
      if (commentIdx >= 0) {
        value = value.substring(0, commentIdx).trim();
      }
    }

    result[key] = value;
  }

  return result;
}

/**
 * Load environment variables from .env files.
 * Priority (later overrides earlier):
 *   1. .env
 *   2. .env.local
 *   3. .env.production (if NODE_ENV=production)
 *   4. .env.development (if NODE_ENV=development)
 *
 * Does NOT override existing process.env values.
 */
export function loadEnv(cwd?: string): void {
  const root = cwd ?? process.cwd();
  const nodeEnv = process.env.NODE_ENV ?? "";

  const files = [
    ".env",
    ".env.local",
  ];

  if (nodeEnv === "production") {
    files.push(".env.production");
  } else if (nodeEnv === "development") {
    files.push(".env.development");
  }

  for (const file of files) {
    const filePath = resolve(root, file);
    if (!existsSync(filePath)) continue;

    try {
      const content = readFileSync(filePath, "utf-8");
      const vars = parseEnvFile(content);

      for (const [key, value] of Object.entries(vars)) {
        // Don't override existing env vars
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    } catch {
      // Silently skip unreadable files
    }
  }
}
