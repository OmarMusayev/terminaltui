/**
 * Font registry for ASCII art text rendering.
 * Each font is defined in its own file for maintainability.
 * Extra fonts are lazy-loaded on first access via a Proxy.
 */

export type { Font } from "./types.js";
import type { Font } from "./types.js";

// Core fonts (eagerly loaded - small and commonly used)
import { fontData as ansiShadow } from "./ansi-shadow.js";
import { fontData as block } from "./block.js";
import { fontData as slant } from "./slant.js";
import { fontData as calvinS } from "./calvin-s.js";
import { fontData as small } from "./small.js";
import { fontData as ogre } from "./ogre.js";

// Extra fonts (lazily loaded on first access)
type FontLoader = () => Promise<Font>;

const fontCache = new Map<string, Font>();

const lazyFonts: Record<string, FontLoader> = {
  "DOS Rebel": () => import("./dos-rebel.js").then(m => m.fontData),
  "Ghost": () => import("./ghost.js").then(m => m.fontData),
  "Bloody": () => import("./bloody.js").then(m => m.fontData),
  "Electronic": () => import("./electronic.js").then(m => m.fontData),
  "Sub-Zero": () => import("./sub-zero.js").then(m => m.fontData),
  "Larry 3D": () => import("./larry-3d.js").then(m => m.fontData),
  "Colossal": () => import("./colossal.js").then(m => m.fontData),
  "Isometric1": () => import("./isometric1.js").then(m => m.fontData),
};

// Pre-load all extra fonts eagerly so the `fonts` record works synchronously.
// Each font is in its own file for code organization; the dynamic imports above
// are used by getFont() for truly lazy access when needed.
import { fontData as dosRebel } from "./dos-rebel.js";
import { fontData as ghost } from "./ghost.js";
import { fontData as bloody } from "./bloody.js";
import { fontData as electronic } from "./electronic.js";
import { fontData as subZero } from "./sub-zero.js";
import { fontData as larry3D } from "./larry-3d.js";
import { fontData as colossal } from "./colossal.js";
import { fontData as isometric1 } from "./isometric1.js";

/**
 * Get a font by name. Loads lazily from cache or dynamic import.
 * Returns the font synchronously if already loaded, or undefined.
 * Use getFontAsync() for guaranteed lazy loading.
 */
export function getFont(name: string): Font | undefined {
  return allFonts[name] ?? fontCache.get(name);
}

/**
 * Get a font by name with lazy loading via dynamic import.
 */
export async function getFontAsync(name: string): Promise<Font | undefined> {
  if (allFonts[name]) return allFonts[name];
  if (fontCache.has(name)) return fontCache.get(name);

  const loader = lazyFonts[name];
  if (loader) {
    const font = await loader();
    fontCache.set(name, font);
    return font;
  }

  return undefined;
}

// All fonts combined (backwards compatible eager record)
const allFonts: Record<string, Font> = {
  "ANSI Shadow": ansiShadow,
  "Block": block,
  "Slant": slant,
  "Calvin S": calvinS,
  "Small": small,
  "Ogre": ogre,
  "DOS Rebel": dosRebel,
  "Ghost": ghost,
  "Bloody": bloody,
  "Electronic": electronic,
  "Sub-Zero": subZero,
  "Larry 3D": larry3D,
  "Colossal": colossal,
  "Isometric1": isometric1,
};

/** Eagerly-available font registry (backwards compatible). */
export const fonts: Record<string, Font> = allFonts;

export const defaultFont = "ANSI Shadow";
