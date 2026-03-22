import type { Font } from "../ascii/fonts.js";

/**
 * Parse a FIGlet .flf font file into our internal Font format.
 *
 * FLF format overview:
 * - Line 1: header  `flf2a<hardblank> HEIGHT BASELINE MAXLEN OLDLAYOUT COMMENTLINES [PRINTDIR [FULLLAY [CODETAG_COUNT]]]`
 * - Next COMMENTLINES lines are comments (skipped).
 * - Then character definitions in ASCII order starting from space (32) through ~ (126).
 *   Each character is HEIGHT lines. Lines end with `@` (middle) or `@@` (last line).
 *   The hardblank character is replaced with space.
 */
export function parseFLF(flfData: string, name: string): Font {
  const rawLines = flfData.split("\n");

  if (rawLines.length === 0) {
    throw new Error(`parseFLF: empty font data for "${name}"`);
  }

  // ── Parse header ──────────────────────────────────────────────────────────
  const headerLine = rawLines[0];

  // The header must start with "flf2a" (or "flf2" at minimum)
  if (!headerLine.startsWith("flf2")) {
    throw new Error(`parseFLF: invalid FLF header for "${name}": ${headerLine}`);
  }

  // The hardblank char is the character immediately after "flf2a"
  const hardblank = headerLine.charAt(5);

  // Split the rest of the header on whitespace
  const headerParts = headerLine.slice(6).trim().split(/\s+/);

  const height = parseInt(headerParts[0], 10);
  // headerParts[1] = baseline (not needed)
  // headerParts[2] = maxLen (not needed)
  // headerParts[3] = oldLayout (not needed)
  const commentLines = parseInt(headerParts[4], 10) || 0;

  if (isNaN(height) || height <= 0) {
    throw new Error(`parseFLF: invalid height in header for "${name}"`);
  }

  // ── Skip comment lines ────────────────────────────────────────────────────
  const dataStart = 1 + commentLines;

  // ── Parse character definitions ───────────────────────────────────────────
  // Characters 32 (space) through 126 (~) = 95 characters
  const chars: Record<string, string[]> = {};

  // Characters we care about
  const usefulChars = new Set<number>();
  // A-Z (65-90)
  for (let c = 65; c <= 90; c++) usefulChars.add(c);
  // 0-9 (48-57)
  for (let c = 48; c <= 57; c++) usefulChars.add(c);
  // space
  usefulChars.add(32);
  // Punctuation: ! " # $ % & ' ( ) * + , - . / : ; < = > ? @ [ \ ] ^ _ ` { | } ~
  const punctuation = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
  for (const ch of punctuation) usefulChars.add(ch.charCodeAt(0));

  let lineIdx = dataStart;

  for (let code = 32; code <= 126; code++) {
    // Check we have enough lines left
    if (lineIdx + height > rawLines.length) {
      break;
    }

    const charLines: string[] = [];

    for (let h = 0; h < height; h++) {
      let line = rawLines[lineIdx + h] ?? "";

      // Strip the end-of-character markers: @@ (last line) or @ (other lines)
      // The marker appears at the very end of the line
      if (line.endsWith("@@")) {
        line = line.slice(0, -2);
      } else if (line.endsWith("@")) {
        line = line.slice(0, -1);
      }

      // Replace hardblank with space
      if (hardblank && hardblank !== " ") {
        line = line.split(hardblank).join(" ");
      }

      charLines.push(line);
    }

    lineIdx += height;

    // Only store characters we care about
    if (usefulChars.has(code)) {
      const ch = String.fromCharCode(code);
      chars[ch] = charLines;
    }
  }

  return {
    name,
    height,
    chars,
  };
}

/**
 * Parse a plain text art file into string[].
 * Preserves leading whitespace. Trims trailing whitespace per line.
 * Strips any metadata comment lines at the top (lines starting with #).
 */
export function parseTextArt(text: string): string[] {
  const lines = text.split("\n");

  // Skip leading comment lines (lines starting with #)
  let start = 0;
  while (start < lines.length && lines[start].startsWith("#")) {
    start++;
  }

  // Take the remaining lines, trim trailing whitespace per line
  const result = lines.slice(start).map(line => line.trimEnd());

  // Remove trailing empty lines
  while (result.length > 0 && result[result.length - 1] === "") {
    result.pop();
  }

  return result;
}

/**
 * Parse an ANSI art file (.ans) into string[].
 * Preserves ANSI escape codes. Splits on newlines.
 */
export function parseAnsiArt(text: string): string[] {
  return text.split("\n");
}

/**
 * Parse a pattern tile file.
 * First line can be `# tile: WxH` metadata.
 * Returns { tile: string[], tileWidth, tileHeight }.
 */
export function parseTilePattern(text: string): { tile: string[]; tileWidth: number; tileHeight: number } {
  const lines = text.split("\n");

  let tileWidth = 0;
  let tileHeight = 0;
  let start = 0;

  // Check for metadata comment on the first line
  const metaMatch = lines[0]?.match(/^#\s*tile:\s*(\d+)\s*x\s*(\d+)/i);
  if (metaMatch) {
    tileWidth = parseInt(metaMatch[1], 10);
    tileHeight = parseInt(metaMatch[2], 10);
    start = 1;
  }

  // Skip any additional comment lines
  while (start < lines.length && lines[start].startsWith("#")) {
    start++;
  }

  // Collect the tile lines, trim trailing whitespace
  const tile: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    // Stop at trailing empty lines
    if (line === "" && i === lines.length - 1) break;
    tile.push(line);
  }

  // Remove trailing empty lines
  while (tile.length > 0 && tile[tile.length - 1] === "") {
    tile.pop();
  }

  // Auto-detect dimensions if not specified in metadata
  if (tileHeight <= 0) {
    tileHeight = tile.length;
  }
  if (tileWidth <= 0) {
    tileWidth = tile.reduce((max, line) => Math.max(max, line.length), 0);
  }

  return { tile, tileWidth, tileHeight };
}
