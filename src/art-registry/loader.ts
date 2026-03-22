import * as fs from "node:fs";
import * as path from "node:path";
import type { ArtPack } from "./types.js";
import { parseFLF, parseTextArt, parseAnsiArt, parseTilePattern } from "./parser.js";

/**
 * Create an ArtPack from a plain object.
 * Convenience constructor for programmatic pack creation.
 */
export function createArtPack(pack: ArtPack): ArtPack {
  return pack;
}

/**
 * Sanitize a filename into a valid asset name.
 * "My Cool Scene.txt" -> "my-cool-scene"
 */
export function sanitizeAssetName(filename: string): string {
  // Strip extension
  const ext = path.extname(filename);
  const base = ext ? filename.slice(0, -ext.length) : filename;

  return base
    .toLowerCase()
    .replace(/[\s_]+/g, "-")   // spaces and underscores to hyphens
    .replace(/[^a-z0-9-]/g, "") // strip anything that isn't alphanumeric or hyphen
    .replace(/-+/g, "-")        // collapse multiple hyphens
    .replace(/^-|-$/g, "");     // trim leading/trailing hyphens
}

/**
 * List files in a directory, skipping dotfiles and underscore-prefixed files.
 * Returns empty array if the directory doesn't exist.
 */
function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  try {
    return fs.readdirSync(dir).filter(name => {
      if (name.startsWith(".") || name.startsWith("_")) return false;
      const fullPath = path.join(dir, name);
      return fs.statSync(fullPath).isFile();
    });
  } catch {
    return [];
  }
}

/**
 * Scan a directory for art assets and return an ArtPack.
 *
 * Expected structure:
 *   dir/
 *     fonts/*.flf
 *     scenes/*.txt, *.ans
 *     icons/*.txt
 *     patterns/*.txt
 *     images/*.png, *.jpg, *.webp (noted but not loaded -- loaded on demand)
 *
 * File names become asset names (lowercased, spaces to hyphens, extension stripped).
 */
export function loadArtDirectory(dir: string): ArtPack {
  const dirName = path.basename(dir);
  const pack: ArtPack = {
    name: dirName,
  };

  // ── Fonts (.flf) ─────────────────────────────────────────────────────────
  const fontsDir = path.join(dir, "fonts");
  const fontFiles = listFiles(fontsDir).filter(f => f.endsWith(".flf"));

  if (fontFiles.length > 0) {
    pack.fonts = {};
    for (const file of fontFiles) {
      const assetName = sanitizeAssetName(file);
      try {
        const data = fs.readFileSync(path.join(fontsDir, file), "utf-8");
        pack.fonts[assetName] = data; // Store raw FLF string; registry will parse it
      } catch {
        // Skip files that can't be read
      }
    }
  }

  // ── Scenes (.txt, .ans) ──────────────────────────────────────────────────
  const scenesDir = path.join(dir, "scenes");
  const sceneFiles = listFiles(scenesDir).filter(f =>
    f.endsWith(".txt") || f.endsWith(".ans")
  );

  if (sceneFiles.length > 0) {
    pack.scenes = {};
    for (const file of sceneFiles) {
      const assetName = sanitizeAssetName(file);
      try {
        const raw = fs.readFileSync(path.join(scenesDir, file), "utf-8");
        const lines = file.endsWith(".ans") ? parseAnsiArt(raw) : parseTextArt(raw);
        pack.scenes[assetName] = lines;
      } catch {
        // Skip files that can't be read
      }
    }
  }

  // ── Icons (.txt) ─────────────────────────────────────────────────────────
  const iconsDir = path.join(dir, "icons");
  const iconFiles = listFiles(iconsDir).filter(f => f.endsWith(".txt"));

  if (iconFiles.length > 0) {
    pack.icons = {};
    for (const file of iconFiles) {
      const assetName = sanitizeAssetName(file);
      try {
        const raw = fs.readFileSync(path.join(iconsDir, file), "utf-8");
        const lines = parseTextArt(raw);
        pack.icons[assetName] = lines;
      } catch {
        // Skip files that can't be read
      }
    }
  }

  // ── Patterns (.txt) ──────────────────────────────────────────────────────
  const patternsDir = path.join(dir, "patterns");
  const patternFiles = listFiles(patternsDir).filter(f => f.endsWith(".txt"));

  if (patternFiles.length > 0) {
    pack.patterns = {};
    for (const file of patternFiles) {
      const assetName = sanitizeAssetName(file);
      try {
        const raw = fs.readFileSync(path.join(patternsDir, file), "utf-8");
        pack.patterns[assetName] = parseTilePattern(raw);
      } catch {
        // Skip files that can't be read
      }
    }
  }

  return pack;
}
