/**
 * Re-export extra fonts for backwards compatibility.
 * Font data now lives in individual files under fonts/.
 */
import type { Font } from "./fonts.js";
import { fontData as dosRebel } from "./fonts/dos-rebel.js";
import { fontData as ghost } from "./fonts/ghost.js";
import { fontData as bloody } from "./fonts/bloody.js";
import { fontData as electronic } from "./fonts/electronic.js";
import { fontData as subZero } from "./fonts/sub-zero.js";
import { fontData as larry3D } from "./fonts/larry-3d.js";
import { fontData as colossal } from "./fonts/colossal.js";
import { fontData as isometric1 } from "./fonts/isometric1.js";

export const extraFonts: Record<string, Font> = {
  "DOS Rebel": dosRebel,
  "Ghost": ghost,
  "Bloody": bloody,
  "Electronic": electronic,
  "Sub-Zero": subZero,
  "Larry 3D": larry3D,
  "Colossal": colossal,
  "Isometric1": isometric1,
};
