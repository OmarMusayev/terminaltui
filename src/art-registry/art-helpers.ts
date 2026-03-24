/**
 * Convenience functions for the art registry.
 *
 * Extracted from index.ts to keep files under 400 lines.
 */

import type { Font } from "../ascii/fonts.js";
import type { SceneData, IconData, PatternData, ArtPack, AssetInfo, AssetType } from "./types.js";
import { registry } from "./index.js";

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
