import type { Font } from "../ascii/fonts.js";
import type {
  SceneData,
  IconData,
  PatternData,
  ArtPack,
  AssetInfo,
  AssetType,
} from "./types.js";
import { parseFLF } from "./parser.js";

export type { SceneData, IconData, PatternData, ArtPack, AssetInfo, AssetType };

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Normalise an asset name: lowercase, spaces/underscores to hyphens. */
function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Check if data is a SceneData object (has an `art` array). */
function isSceneData(data: string[] | SceneData): data is SceneData {
  return !Array.isArray(data) && Array.isArray((data as SceneData).art);
}

/** Check if data is an IconData object (has size slots or author). */
function isIconData(data: string[] | IconData): data is IconData {
  if (Array.isArray(data)) return false;
  const d = data as IconData;
  return (
    d.small !== undefined ||
    d.medium !== undefined ||
    d.large !== undefined ||
    d.art !== undefined ||
    d.author !== undefined ||
    d.source !== undefined
  );
}

// ── ArtRegistry ─────────────────────────────────────────────────────────────

interface FontEntry {
  font: Font;
  source: string;
  author?: string;
}

interface SceneEntry {
  scene: SceneData;
  source: string;
}

interface IconEntry {
  icon: IconData;
  source: string;
}

interface PatternEntry {
  pattern: PatternData;
  source: string;
}

export class ArtRegistry {
  private fonts = new Map<string, FontEntry>();
  private scenes = new Map<string, SceneEntry>();
  private icons = new Map<string, IconEntry>();
  private patterns = new Map<string, PatternEntry>();

  // ── register ────────────────────────────────────────────────────────────

  register(
    type: "font",
    name: string,
    data: string | Font,
    source?: string,
  ): void;
  register(
    type: "scene",
    name: string,
    data: string[] | SceneData,
    source?: string,
  ): void;
  register(
    type: "icon",
    name: string,
    data: string[] | IconData,
    source?: string,
  ): void;
  register(
    type: "pattern",
    name: string,
    data: PatternData,
    source?: string,
  ): void;
  register(
    type: AssetType,
    name: string,
    data: string | Font | string[] | SceneData | IconData | PatternData,
    source: string = "custom",
  ): void {
    const key = normaliseName(name);

    switch (type) {
      case "font": {
        if (this.fonts.has(key)) {
          process.stderr.write(
            `[art-registry] warning: font "${key}" overwritten (source: ${source})\n`,
          );
        }
        let font: Font;
        if (typeof data === "string") {
          // FLF data string — parse it
          font = parseFLF(data, key);
        } else {
          font = data as Font;
        }
        this.fonts.set(key, { font, source, author: undefined });
        break;
      }

      case "scene": {
        if (this.scenes.has(key)) {
          process.stderr.write(
            `[art-registry] warning: scene "${key}" overwritten (source: ${source})\n`,
          );
        }
        let scene: SceneData;
        if (Array.isArray(data)) {
          scene = { art: data as string[], source };
        } else if (isSceneData(data as string[] | SceneData)) {
          scene = { ...(data as SceneData), source: (data as SceneData).source ?? source };
        } else {
          throw new Error(`Invalid scene data for "${name}"`);
        }
        this.scenes.set(key, { scene, source });
        break;
      }

      case "icon": {
        if (this.icons.has(key)) {
          process.stderr.write(
            `[art-registry] warning: icon "${key}" overwritten (source: ${source})\n`,
          );
        }
        let icon: IconData;
        if (Array.isArray(data)) {
          icon = autoSizeIcon(data as string[], source);
        } else if (isIconData(data as string[] | IconData)) {
          icon = { ...(data as IconData), source: (data as IconData).source ?? source };
        } else {
          throw new Error(`Invalid icon data for "${name}"`);
        }
        this.icons.set(key, { icon, source });
        break;
      }

      case "pattern": {
        if (this.patterns.has(key)) {
          process.stderr.write(
            `[art-registry] warning: pattern "${key}" overwritten (source: ${source})\n`,
          );
        }
        const pat = data as PatternData;
        this.patterns.set(key, {
          pattern: { ...pat, source: pat.source ?? source },
          source,
        });
        break;
      }
    }
  }

  // ── get ─────────────────────────────────────────────────────────────────

  get(type: "font", name: string): Font | null;
  get(type: "scene", name: string): SceneData | null;
  get(type: "icon", name: string): IconData | null;
  get(type: "pattern", name: string): PatternData | null;
  get(
    type: AssetType,
    name: string,
  ): Font | SceneData | IconData | PatternData | null {
    const key = normaliseName(name);
    const map = this.mapFor(type);

    // Direct lookup
    const entry = map.get(key);
    if (entry) return this.unwrapEntry(type, entry);

    // Try namespaced lookup: if the name contains "/", search with it normalised
    if (name.includes("/")) {
      const nsKey = normaliseName(name.replace("/", "-"));
      const nsEntry = map.get(nsKey);
      if (nsEntry) return this.unwrapEntry(type, nsEntry);
    }

    // Try matching against namespaced entries: "asset" matches "pack-name-asset"
    for (const [entryKey, entryVal] of map) {
      if (entryKey.endsWith(`-${key}`) || entryKey.endsWith(`/${key}`)) {
        return this.unwrapEntry(type, entryVal);
      }
    }

    return null;
  }

  // ── has ─────────────────────────────────────────────────────────────────

  has(type: AssetType, name: string): boolean {
    // Use a type assertion to call the general overload
    return (this.get as (t: AssetType, n: string) => unknown)(type, name) !== null;
  }

  // ── list ────────────────────────────────────────────────────────────────

  list(type?: AssetType): string[] {
    if (type) {
      return Array.from(this.mapFor(type).keys()).sort();
    }
    // Return all names across all types
    const all = new Set<string>();
    for (const key of this.fonts.keys()) all.add(key);
    for (const key of this.scenes.keys()) all.add(key);
    for (const key of this.icons.keys()) all.add(key);
    for (const key of this.patterns.keys()) all.add(key);
    return Array.from(all).sort();
  }

  // ── getInfo ─────────────────────────────────────────────────────────────

  getInfo(type: AssetType, name: string): AssetInfo | null {
    const key = normaliseName(name);
    const map = this.mapFor(type);
    const entry = map.get(key);
    if (!entry) return null;

    const base: AssetInfo = { name: key, type, source: "" };

    switch (type) {
      case "font": {
        const e = entry as FontEntry;
        base.source = e.source;
        base.author = e.author;
        break;
      }
      case "scene": {
        const e = entry as SceneEntry;
        base.source = e.source;
        base.author = e.scene.author;
        base.description = e.scene.description;
        break;
      }
      case "icon": {
        const e = entry as IconEntry;
        base.source = e.source;
        base.author = e.icon.author;
        break;
      }
      case "pattern": {
        const e = entry as PatternEntry;
        base.source = e.source;
        base.author = e.pattern.author;
        break;
      }
    }

    return base;
  }

  // ── loadPack ────────────────────────────────────────────────────────────

  loadPack(pack: ArtPack): void {
    const packSource = `pack:${pack.name}`;

    if (pack.fonts) {
      for (const [name, data] of Object.entries(pack.fonts)) {
        this.register("font", name, data, packSource);
        // If the pack has an author and the font entry doesn't yet, set it
        if (pack.author) {
          const key = normaliseName(name);
          const entry = this.fonts.get(key);
          if (entry && !entry.author) {
            entry.author = pack.author;
          }
        }
      }
    }

    if (pack.scenes) {
      for (const [name, data] of Object.entries(pack.scenes)) {
        this.register("scene", name, data, packSource);
      }
    }

    if (pack.icons) {
      for (const [name, data] of Object.entries(pack.icons)) {
        this.register("icon", name, data, packSource);
      }
    }

    if (pack.patterns) {
      for (const [name, data] of Object.entries(pack.patterns)) {
        this.register("pattern", name, data, packSource);
      }
    }
  }

  // ── clear ───────────────────────────────────────────────────────────────

  clear(): void {
    this.fonts.clear();
    this.scenes.clear();
    this.icons.clear();
    this.patterns.clear();
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private mapFor(
    type: AssetType,
  ): Map<string, FontEntry | SceneEntry | IconEntry | PatternEntry> {
    switch (type) {
      case "font":
        return this.fonts as Map<string, FontEntry>;
      case "scene":
        return this.scenes as Map<string, SceneEntry>;
      case "icon":
        return this.icons as Map<string, IconEntry>;
      case "pattern":
        return this.patterns as Map<string, PatternEntry>;
    }
  }

  private unwrapEntry(
    type: AssetType,
    entry: FontEntry | SceneEntry | IconEntry | PatternEntry,
  ): Font | SceneData | IconData | PatternData {
    switch (type) {
      case "font":
        return (entry as FontEntry).font;
      case "scene":
        return (entry as SceneEntry).scene;
      case "icon":
        return (entry as IconEntry).icon;
      case "pattern":
        return (entry as PatternEntry).pattern;
    }
  }
}

// ── Auto-size icon helper ─────────────────────────────────────────────────

function autoSizeIcon(lines: string[], source: string): IconData {
  const lineCount = lines.length;
  const icon: IconData = { source };

  if (lineCount <= 4) {
    icon.small = lines;
  } else if (lineCount <= 6) {
    icon.medium = lines;
  } else {
    icon.large = lines;
  }

  return icon;
}

// ── Singleton ─────────────────────────────────────────────────────────────

export const registry = new ArtRegistry();

// ── Convenience functions ─────────────────────────────────────────────────

export function registerFont(name: string, data: string | Font): void {
  registry.register("font", name, data);
}

export function registerScene(name: string, data: string[] | SceneData): void {
  registry.register("scene", name, data);
}

export function registerIcon(name: string, data: string[] | IconData): void {
  registry.register("icon", name, data);
}

export function registerPattern(name: string, data: PatternData): void {
  registry.register("pattern", name, data);
}

export function registerArtPack(pack: ArtPack): void {
  registry.loadPack(pack);
}

/** Alias for registerArtPack. */
export function useArtPack(pack: ArtPack): void {
  registry.loadPack(pack);
}

export function listArt(): {
  fonts: string[];
  scenes: string[];
  icons: string[];
  patterns: string[];
} {
  return {
    fonts: registry.list("font"),
    scenes: registry.list("scene"),
    icons: registry.list("icon"),
    patterns: registry.list("pattern"),
  };
}

export function getArtInfo(type: AssetType, name: string): AssetInfo | null {
  return registry.getInfo(type, name);
}
