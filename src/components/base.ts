import type { Theme } from "../style/theme.js";
import type { ContentBlock } from "../config/types.js";
import { fgColor, bgColor, reset, bold, dim } from "../style/colors.js";

export interface RenderContext {
  width: number;
  theme: Theme;
  focused?: boolean;
  selected?: boolean;
  borderStyle?: string;
  editing?: boolean;
  /** Available height inside a panel cell. Cards use this to fill uniform height. */
  panelHeight?: number;
  /**
   * Rows the enclosing SEQUENCE of blocks may occupy in total — the page's
   * content viewport at page level, the pane's inner height inside a panel.
   *
   * Distinct from `panelHeight` in two ways that matter. It is advisory: nothing
   * clamps, truncates or reserves against it, so setting it can never shrink a
   * component that ignores it (which is every component but `custom`). And it is
   * the container's TOTAL, never the rows left over after siblings — a block
   * that sized itself to the leftover could not be measured until its siblings
   * were measured, and a `fitPage` image sized FROM that measurement would close
   * the loop.
   */
  availRows?: number;
  /**
   * Mutable out-parameter: when set, the content renderer records the line
   * range [start, end) of the focused block (or the container holding it)
   * relative to the lines it returns. Panels use this to scroll their
   * clipped window so the focused block stays visible.
   */
  focusTrack?: { start: number; end: number };
}

/** A function that renders a content block to string lines. */
export type ComponentRenderer = (block: any, ctx: RenderContext, ...extra: any[]) => string[];

// ─── Unicode-aware display width ──────────────────────────

// The kitty graphics protocol's Unicode placeholder character, U+10EEEE.
// Astral, so it is a surrogate PAIR in JS (`.length === 2`) but occupies
// exactly ONE terminal cell. An image drawn with kitty's `U=1` virtual
// placement is just text: one of these per covered cell, each followed by
// combining diacritics encoding the row index, the column index and optionally
// the high byte of the image id — so every one of those diacritics must
// measure 0 (see ZERO_WIDTH_RANGES below) or the row inflates by one cell per
// column. Kept private: the emitter owns the public constant
// (`PLACEHOLDER_CHAR` in src/image/kitty.ts); this layer only owns its width.
const KITTY_PLACEHOLDER_CODE = 0x10eeee;

/**
 * Codepoints that occupy no terminal cell, as sorted inclusive `[start, end]`
 * pairs in one flat array.
 *
 * WHY a table instead of the hand-written block list this replaced: the block
 * list (U+0300-036F, U+1AB0-1AFF, U+1DC0-1DFF, U+20D0-20FF, U+FE20-FE2F,
 * variation selectors) missed most real combining marks. 18 of the first 48
 * entries of kitty's `rowcolumn-diacritics` table — U+0483..U+0487 and
 * U+0592..U+05A1, i.e. row/column index 30 onward — measured 1 instead of 0,
 * so any placeholder image taller or wider than 30 cells inflated every row by
 * one cell per column and corrupted centring, panel clipping and truncation.
 * The set also reaches into astral space (kitty uses up to U+1D244).
 *
 * Contents = Unicode general categories Mn (non-spacing mark), Me (enclosing
 * mark) and Cf (format), UNIONed with the block ranges the old list covered so
 * unassigned codepoints inside combining blocks keep their previous width.
 * Generated from V8's own Unicode tables (ICU 15.1) — no runtime dependency,
 * no vendored data file — with:
 *
 *   for (cp of 0..0x10FFFF) if (/[\p{Mn}\p{Me}\p{Cf}]/u.test(String.fromCodePoint(cp))) mark(cp)
 *
 * then merged with the legacy blocks and run-length coalesced. Verified to
 * cover all 297 entries of kitty's real `gen/rowcolumn-diacritics.txt`; the
 * count is deliberately NOT relied on anywhere (published copies of that file
 * differ in length and its own header only promises "more than 255"), the
 * category membership is what matters. 356 ranges / 2232 codepoints.
 */
const ZERO_WIDTH_RANGES: readonly number[] = [
  0xad,0xad, 0x300,0x36f, 0x483,0x489, 0x591,0x5bd, 0x5bf,0x5bf, 0x5c1,0x5c2, 0x5c4,0x5c5,
  0x5c7,0x5c7, 0x600,0x605, 0x610,0x61a, 0x61c,0x61c, 0x64b,0x65f, 0x670,0x670, 0x6d6,0x6dd,
  0x6df,0x6e4, 0x6e7,0x6e8, 0x6ea,0x6ed, 0x70f,0x70f, 0x711,0x711, 0x730,0x74a, 0x7a6,0x7b0,
  0x7eb,0x7f3, 0x7fd,0x7fd, 0x816,0x819, 0x81b,0x823, 0x825,0x827, 0x829,0x82d, 0x859,0x85b,
  0x890,0x891, 0x898,0x89f, 0x8ca,0x902, 0x93a,0x93a, 0x93c,0x93c, 0x941,0x948, 0x94d,0x94d,
  0x951,0x957, 0x962,0x963, 0x981,0x981, 0x9bc,0x9bc, 0x9c1,0x9c4, 0x9cd,0x9cd, 0x9e2,0x9e3,
  0x9fe,0x9fe, 0xa01,0xa02, 0xa3c,0xa3c, 0xa41,0xa42, 0xa47,0xa48, 0xa4b,0xa4d, 0xa51,0xa51,
  0xa70,0xa71, 0xa75,0xa75, 0xa81,0xa82, 0xabc,0xabc, 0xac1,0xac5, 0xac7,0xac8, 0xacd,0xacd,
  0xae2,0xae3, 0xafa,0xaff, 0xb01,0xb01, 0xb3c,0xb3c, 0xb3f,0xb3f, 0xb41,0xb44, 0xb4d,0xb4d,
  0xb55,0xb56, 0xb62,0xb63, 0xb82,0xb82, 0xbc0,0xbc0, 0xbcd,0xbcd, 0xc00,0xc00, 0xc04,0xc04,
  0xc3c,0xc3c, 0xc3e,0xc40, 0xc46,0xc48, 0xc4a,0xc4d, 0xc55,0xc56, 0xc62,0xc63, 0xc81,0xc81,
  0xcbc,0xcbc, 0xcbf,0xcbf, 0xcc6,0xcc6, 0xccc,0xccd, 0xce2,0xce3, 0xd00,0xd01, 0xd3b,0xd3c,
  0xd41,0xd44, 0xd4d,0xd4d, 0xd62,0xd63, 0xd81,0xd81, 0xdca,0xdca, 0xdd2,0xdd4, 0xdd6,0xdd6,
  0xe31,0xe31, 0xe34,0xe3a, 0xe47,0xe4e, 0xeb1,0xeb1, 0xeb4,0xebc, 0xec8,0xece, 0xf18,0xf19,
  0xf35,0xf35, 0xf37,0xf37, 0xf39,0xf39, 0xf71,0xf7e, 0xf80,0xf84, 0xf86,0xf87, 0xf8d,0xf97,
  0xf99,0xfbc, 0xfc6,0xfc6, 0x102d,0x1030, 0x1032,0x1037, 0x1039,0x103a, 0x103d,0x103e,
  0x1058,0x1059, 0x105e,0x1060, 0x1071,0x1074, 0x1082,0x1082, 0x1085,0x1086, 0x108d,0x108d,
  0x109d,0x109d, 0x135d,0x135f, 0x1712,0x1714, 0x1732,0x1733, 0x1752,0x1753, 0x1772,0x1773,
  0x17b4,0x17b5, 0x17b7,0x17bd, 0x17c6,0x17c6, 0x17c9,0x17d3, 0x17dd,0x17dd, 0x180b,0x180f,
  0x1885,0x1886, 0x18a9,0x18a9, 0x1920,0x1922, 0x1927,0x1928, 0x1932,0x1932, 0x1939,0x193b,
  0x1a17,0x1a18, 0x1a1b,0x1a1b, 0x1a56,0x1a56, 0x1a58,0x1a5e, 0x1a60,0x1a60, 0x1a62,0x1a62,
  0x1a65,0x1a6c, 0x1a73,0x1a7c, 0x1a7f,0x1a7f, 0x1ab0,0x1b03, 0x1b34,0x1b34, 0x1b36,0x1b3a,
  0x1b3c,0x1b3c, 0x1b42,0x1b42, 0x1b6b,0x1b73, 0x1b80,0x1b81, 0x1ba2,0x1ba5, 0x1ba8,0x1ba9,
  0x1bab,0x1bad, 0x1be6,0x1be6, 0x1be8,0x1be9, 0x1bed,0x1bed, 0x1bef,0x1bf1, 0x1c2c,0x1c33,
  0x1c36,0x1c37, 0x1cd0,0x1cd2, 0x1cd4,0x1ce0, 0x1ce2,0x1ce8, 0x1ced,0x1ced, 0x1cf4,0x1cf4,
  0x1cf8,0x1cf9, 0x1dc0,0x1dff, 0x200b,0x200f, 0x202a,0x202e, 0x2060,0x2064, 0x2066,0x206f,
  0x20d0,0x20ff, 0x2cef,0x2cf1, 0x2d7f,0x2d7f, 0x2de0,0x2dff, 0x302a,0x302d, 0x3099,0x309a,
  0xa66f,0xa672, 0xa674,0xa67d, 0xa69e,0xa69f, 0xa6f0,0xa6f1, 0xa802,0xa802, 0xa806,0xa806,
  0xa80b,0xa80b, 0xa825,0xa826, 0xa82c,0xa82c, 0xa8c4,0xa8c5, 0xa8e0,0xa8f1, 0xa8ff,0xa8ff,
  0xa926,0xa92d, 0xa947,0xa951, 0xa980,0xa982, 0xa9b3,0xa9b3, 0xa9b6,0xa9b9, 0xa9bc,0xa9bd,
  0xa9e5,0xa9e5, 0xaa29,0xaa2e, 0xaa31,0xaa32, 0xaa35,0xaa36, 0xaa43,0xaa43, 0xaa4c,0xaa4c,
  0xaa7c,0xaa7c, 0xaab0,0xaab0, 0xaab2,0xaab4, 0xaab7,0xaab8, 0xaabe,0xaabf, 0xaac1,0xaac1,
  0xaaec,0xaaed, 0xaaf6,0xaaf6, 0xabe5,0xabe5, 0xabe8,0xabe8, 0xabed,0xabed, 0xfb1e,0xfb1e,
  0xfe00,0xfe0f, 0xfe20,0xfe2f, 0xfeff,0xfeff, 0xfff9,0xfffb, 0x101fd,0x101fd, 0x102e0,0x102e0,
  0x10376,0x1037a, 0x10a01,0x10a03, 0x10a05,0x10a06, 0x10a0c,0x10a0f, 0x10a38,0x10a3a,
  0x10a3f,0x10a3f, 0x10ae5,0x10ae6, 0x10d24,0x10d27, 0x10eab,0x10eac, 0x10efd,0x10eff,
  0x10f46,0x10f50, 0x10f82,0x10f85, 0x11001,0x11001, 0x11038,0x11046, 0x11070,0x11070,
  0x11073,0x11074, 0x1107f,0x11081, 0x110b3,0x110b6, 0x110b9,0x110ba, 0x110bd,0x110bd,
  0x110c2,0x110c2, 0x110cd,0x110cd, 0x11100,0x11102, 0x11127,0x1112b, 0x1112d,0x11134,
  0x11173,0x11173, 0x11180,0x11181, 0x111b6,0x111be, 0x111c9,0x111cc, 0x111cf,0x111cf,
  0x1122f,0x11231, 0x11234,0x11234, 0x11236,0x11237, 0x1123e,0x1123e, 0x11241,0x11241,
  0x112df,0x112df, 0x112e3,0x112ea, 0x11300,0x11301, 0x1133b,0x1133c, 0x11340,0x11340,
  0x11366,0x1136c, 0x11370,0x11374, 0x11438,0x1143f, 0x11442,0x11444, 0x11446,0x11446,
  0x1145e,0x1145e, 0x114b3,0x114b8, 0x114ba,0x114ba, 0x114bf,0x114c0, 0x114c2,0x114c3,
  0x115b2,0x115b5, 0x115bc,0x115bd, 0x115bf,0x115c0, 0x115dc,0x115dd, 0x11633,0x1163a,
  0x1163d,0x1163d, 0x1163f,0x11640, 0x116ab,0x116ab, 0x116ad,0x116ad, 0x116b0,0x116b5,
  0x116b7,0x116b7, 0x1171d,0x1171f, 0x11722,0x11725, 0x11727,0x1172b, 0x1182f,0x11837,
  0x11839,0x1183a, 0x1193b,0x1193c, 0x1193e,0x1193e, 0x11943,0x11943, 0x119d4,0x119d7,
  0x119da,0x119db, 0x119e0,0x119e0, 0x11a01,0x11a0a, 0x11a33,0x11a38, 0x11a3b,0x11a3e,
  0x11a47,0x11a47, 0x11a51,0x11a56, 0x11a59,0x11a5b, 0x11a8a,0x11a96, 0x11a98,0x11a99,
  0x11c30,0x11c36, 0x11c38,0x11c3d, 0x11c3f,0x11c3f, 0x11c92,0x11ca7, 0x11caa,0x11cb0,
  0x11cb2,0x11cb3, 0x11cb5,0x11cb6, 0x11d31,0x11d36, 0x11d3a,0x11d3a, 0x11d3c,0x11d3d,
  0x11d3f,0x11d45, 0x11d47,0x11d47, 0x11d90,0x11d91, 0x11d95,0x11d95, 0x11d97,0x11d97,
  0x11ef3,0x11ef4, 0x11f00,0x11f01, 0x11f36,0x11f3a, 0x11f40,0x11f40, 0x11f42,0x11f42,
  0x13430,0x13440, 0x13447,0x13455, 0x16af0,0x16af4, 0x16b30,0x16b36, 0x16f4f,0x16f4f,
  0x16f8f,0x16f92, 0x16fe4,0x16fe4, 0x1bc9d,0x1bc9e, 0x1bca0,0x1bca3, 0x1cf00,0x1cf2d,
  0x1cf30,0x1cf46, 0x1d167,0x1d169, 0x1d173,0x1d182, 0x1d185,0x1d18b, 0x1d1aa,0x1d1ad,
  0x1d242,0x1d244, 0x1da00,0x1da36, 0x1da3b,0x1da6c, 0x1da75,0x1da75, 0x1da84,0x1da84,
  0x1da9b,0x1da9f, 0x1daa1,0x1daaf, 0x1e000,0x1e006, 0x1e008,0x1e018, 0x1e01b,0x1e021,
  0x1e023,0x1e024, 0x1e026,0x1e02a, 0x1e08f,0x1e08f, 0x1e130,0x1e136, 0x1e2ae,0x1e2ae,
  0x1e2ec,0x1e2ef, 0x1e4ec,0x1e4ef, 0x1e8d0,0x1e8d6, 0x1e944,0x1e94a, 0xe0001,0xe0001,
  0xe0020,0xe007f, 0xe0100,0xe01ef,
];

// charWidth is the hottest function in the render path (per character, per row,
// per frame), so the table above is compiled once at module load into two
// lookups instead of being scanned: an 8 KB bitmap for the BMP (O(1), one
// shift and one mask) and a small sorted array for the ~139 astral ranges
// (binary search, ~8 compares — only ever reached by astral codepoints).
// Build cost is a single pass over ~2.2k codepoints: microseconds, once.
const zeroWidthBmp = new Uint8Array(0x10000 >> 3);
const zeroWidthAstral: Int32Array = (() => {
  const astral: number[] = [];
  for (let i = 0; i < ZERO_WIDTH_RANGES.length; i += 2) {
    let lo = ZERO_WIDTH_RANGES[i];
    const hi = ZERO_WIDTH_RANGES[i + 1];
    if (lo <= 0xffff) {
      const bmpHi = hi < 0xffff ? hi : 0xffff;
      for (let c = lo; c <= bmpHi; c++) zeroWidthBmp[c >> 3] |= 1 << (c & 7);
      if (hi <= 0xffff) continue;
      lo = 0x10000; // range straddles the BMP boundary: astral tail only
    }
    astral.push(lo, hi);
  }
  return Int32Array.from(astral);
})();

/** Binary search of the astral zero-width ranges (flat [start, end] pairs). */
function isAstralZeroWidth(code: number): boolean {
  let lo = 0;
  let hi = (zeroWidthAstral.length >> 1) - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const i = mid << 1;
    if (code < zeroWidthAstral[i]) hi = mid - 1;
    else if (code > zeroWidthAstral[i + 1]) lo = mid + 1;
    else return true;
  }
  return false;
}

/**
 * Get the display width of a single character in terminal cells.
 *
 * Handles:
 * - CJK ideographs (2 cells)
 * - CJK fullwidth forms (2 cells)
 * - Emoji (2 cells)
 * - Combining marks (Mn/Me), format chars (Cf) and zero-width chars (0 cells)
 * - Control characters (0 cells)
 * - The kitty image placeholder U+10EEEE (1 cell, despite being a surrogate
 *   pair — pass the full code POINT, not a UTF-16 unit)
 * - Everything else including box-drawing, block elements (1 cell)
 */
export function charWidth(code: number): number {
  // Fast path: ASCII, Latin-1 and Latin Extended-A/B. Nothing below U+0300 is
  // a combining mark or wide, so the common case is two compares, not twenty.
  if (code < 0x0300) {
    if (code < 32 || code === 0x7f) return 0; // C0 controls and DEL
    if (code === 0x00ad) return 0;            // soft hyphen
    return 1;
  }

  // kitty Unicode placeholder: astral but exactly one cell. Checked before the
  // range tables because a placeholder image emits one per covered cell, and
  // because the default astral fallthrough must never be allowed to claim 2.
  if (code === KITTY_PLACEHOLDER_CODE) return 1;

  // Combining marks / format chars. MUST precede the wide ranges: U+302A-302D
  // and U+3099-309A sit inside the CJK blocks below and are 0, not 2.
  if (code <= 0xffff) {
    if ((zeroWidthBmp[code >> 3] >> (code & 7)) & 1) return 0;
    // Nothing in U+0300..U+10FF is wide (Hangul Jamo starts at U+1100), and
    // nothing in U+2000..U+2E7F is either — that second window carries the
    // block elements and box-drawing glyphs the image cell tier emits by the
    // thousand per frame, so it exits before the CJK compare chain.
    if (code < 0x1100) return 1;
    if (code >= 0x2000 && code <= 0x2e7f) return 1;
  } else if (isAstralZeroWidth(code)) {
    return 0;
  }

  // CJK Ideographs and extensions — 2 cells
  if (code >= 0x4e00 && code <= 0x9fff) return 2;  // CJK Unified Ideographs
  if (code >= 0x3400 && code <= 0x4dbf) return 2;  // CJK Extension A
  if (code >= 0x20000 && code <= 0x2a6df) return 2; // CJK Extension B
  if (code >= 0x2a700 && code <= 0x2b73f) return 2; // CJK Extension C
  if (code >= 0x2b740 && code <= 0x2b81f) return 2; // CJK Extension D
  if (code >= 0xf900 && code <= 0xfaff) return 2;   // CJK Compat Ideographs
  // CJK punctuation, Hiragana, Katakana, Hangul
  if (code >= 0x3000 && code <= 0x303f) return 2;  // CJK Symbols & Punctuation
  if (code >= 0x3040 && code <= 0x309f) return 2;  // Hiragana
  if (code >= 0x30a0 && code <= 0x30ff) return 2;  // Katakana
  if (code >= 0xac00 && code <= 0xd7af) return 2;  // Hangul Syllables
  if (code >= 0x1100 && code <= 0x115f) return 2;  // Hangul Jamo
  // Fullwidth forms
  if (code >= 0xff01 && code <= 0xff60) return 2;
  if (code >= 0xffe0 && code <= 0xffe6) return 2;

  // Emoji (common ranges) — 2 cells
  // Miscellaneous Symbols & Pictographs, Emoticons, Transport, Supplemental Symbols
  if (code >= 0x1f300 && code <= 0x1f9ff) return 2;
  if (code >= 0x1fa00 && code <= 0x1fa6f) return 2;
  if (code >= 0x1fa70 && code <= 0x1faff) return 2;
  // Dingbats (U+2700-27BF) and misc symbols (U+2600-26FF) stay 1 cell — they
  // are terminal-dependent and this codebase has always treated them as narrow.
  // Both are inside the U+2000-2E7F window above, which already returned 1.

  // Everything else: ASCII, Latin, Greek, Cyrillic, box-drawing, block elements, etc.
  return 1;
}

/** Uncached width computation: strip ANSI codes, then sum character widths. */
function computeWidth(text: string): number {
  const stripped = stripAnsi(text);
  let width = 0;
  for (const ch of stripped) {
    width += charWidth(ch.codePointAt(0) ?? 0);
  }
  return width;
}

// Width memoization (Wave 5, Stage B). Keyed by the string itself — strings
// are immutable and width is a pure function of the string, so a cached
// entry is correct forever (across pages, themes, and SSH sessions; sharing
// process-wide is safe, unlike the per-runtime frame buffer).
//
// Eviction is FIFO via Map insertion order (hits do NOT refresh position):
// frame strings recur every frame and per-frame distinct-string churn is
// ~2 orders of magnitude below the cap, so FIFO keeps hot entries resident.
// Worst-case memory ≈ 8k entries × ~200 chars ≈ 3 MB. Do not raise the cap
// without a bench.
const WIDTH_CACHE_CAP = 8192;
// Below this length a Map probe (hash + compare) rivals the scan itself, so
// short strings skip the cache entirely. Bench-tunable (plausible range 4–16).
const WIDTH_CACHE_MIN_LEN = 8;
// And above this length the entry costs more than the scan it saves. The cap is
// an ENTRY count, so the ~3 MB budget above assumes ~200-char rows; a single
// image row is ~1.5 KB of block glyphs and SGR, and saturating the cache with
// them measured 23.7 MB of heap held process-wide across every SSH session.
// The gate lives here rather than at the call sites because two independent
// callers (writeToTerminal, Panel) already forgot the rule.
const WIDTH_CACHE_MAX_LEN = 512;
const widthCache = new Map<string, number>();

/**
 * Calculate the display width of a string in terminal cells.
 * Strips ANSI codes, then sums character widths.
 *
 * Results for strings of length 8..512 are memoized in a bounded (8192-entry,
 * FIFO-evicted) module-level cache; return values are identical to the
 * uncached computation for every input.
 */
export function stringWidth(text: string): number {
  // Uncached fast paths: too short to be worth a probe, or too long to be worth
  // the residency.
  if (text.length < WIDTH_CACHE_MIN_LEN || text.length > WIDTH_CACHE_MAX_LEN) {
    return computeWidth(text);
  }
  const hit = widthCache.get(text);
  if (hit !== undefined) return hit;
  const w = computeWidth(text);
  if (widthCache.size >= WIDTH_CACHE_CAP) {
    widthCache.delete(widthCache.keys().next().value!); // evict oldest (insertion order)
  }
  widthCache.set(text, w);
  return w;
}

/**
 * @internal Test-only introspection for the width cache (size, cap, gate,
 * membership). Not re-exported from the public index — do not use outside
 * tests.
 */
export function __widthCacheInspect(): {
  size: number;
  cap: number;
  minLen: number;
  maxLen: number;
  has: (text: string) => boolean;
} {
  return {
    size: widthCache.size,
    cap: WIDTH_CACHE_CAP,
    minLen: WIDTH_CACHE_MIN_LEN,
    maxLen: WIDTH_CACHE_MAX_LEN,
    has: (text: string) => widthCache.has(text),
  };
}

// ─── Styling helpers ──────────────────────────────────────

export function styled(text: string, color: string): string {
  return fgColor(color) + text + reset;
}

export function styledBold(text: string, color: string): string {
  return bold + fgColor(color) + text + reset;
}

export function styledDim(text: string, color: string): string {
  return dim + fgColor(color) + text + reset;
}

// ─── Layout helpers (width-aware) ─────────────────────────

export function pad(text: string, width: number, align: "left" | "center" | "right" = "left"): string {
  const visLen = stringWidth(text);
  const padding = Math.max(0, width - visLen);
  switch (align) {
    case "center": {
      const left = Math.floor(padding / 2);
      const right = padding - left;
      return " ".repeat(left) + text + " ".repeat(right);
    }
    case "right":
      return " ".repeat(padding) + text;
    default:
      return text + " ".repeat(padding);
  }
}

export function stripAnsi(text: string): string {
  // Fast path: zero-alloc identity return for plain strings (most wrapText
  // words, raw table-cell text) — skips the regex entirely.
  if (text.indexOf("\x1b") === -1) return text;
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * ANSI-aware prefix cut: copies escape sequences through untouched and keeps
 * visible characters while their total display width stays within `budget`
 * cells. `clipped` reports whether any visible character was dropped.
 */
export function cutToWidth(text: string, budget: number): { cut: string; clipped: boolean } {
  let visLen = 0;
  let result = "";
  let inEscape = false;
  let clipped = false;
  for (const ch of text) {
    if (ch === "\x1b") { inEscape = true; result += ch; continue; }
    if (inEscape) { result += ch; if (ch === "m") inEscape = false; continue; }
    const cw = charWidth(ch.codePointAt(0) ?? 0);
    if (visLen + cw > budget) { clipped = true; break; }
    result += ch;
    visLen += cw;
  }
  return { cut: result, clipped };
}

export function truncate(text: string, maxWidth: number): string {
  if (!text) return "";
  if (stringWidth(text) <= maxWidth) return text;
  // Truncate accounting for ANSI codes and char widths, reserving one cell for the ellipsis
  const { cut, clipped } = cutToWidth(text, maxWidth - 1);
  return cut + (clipped ? "\u2026" : "") + reset;
}

export function wrapText(text: string, width: number): string[] {
  if (width <= 0) return [];

  // Split on newlines first, then wrap each paragraph
  const paragraphs = text.split("\n");
  const allLines: string[] = [];

  for (const para of paragraphs) {
    if (para.length === 0) {
      allLines.push("");
      continue;
    }
    const words = para.split(" ");
    let currentLine = "";
    let currentWidth = 0;

    for (const word of words) {
      const wordWidth = stringWidth(word);
      // Force-break words wider than width
      if (wordWidth > width) {
        if (currentLine) {
          allLines.push(currentLine);
          currentLine = "";
          currentWidth = 0;
        }
        // Break character by character
        let chunk = "";
        let chunkW = 0;
        for (const ch of word) {
          const cw = charWidth(ch.codePointAt(0) ?? 0);
          if (chunkW + cw > width && chunk) {
            allLines.push(chunk);
            chunk = "";
            chunkW = 0;
          }
          chunk += ch;
          chunkW += cw;
        }
        currentLine = chunk;
        currentWidth = chunkW;
        continue;
      }

      if (currentWidth === 0) {
        currentLine = word;
        currentWidth = wordWidth;
      } else if (currentWidth + 1 + wordWidth <= width) {
        currentLine += " " + word;
        currentWidth += 1 + wordWidth;
      } else {
        allLines.push(currentLine);
        currentLine = word;
        currentWidth = wordWidth;
      }
    }
    if (currentLine) allLines.push(currentLine);
  }

  return allLines.length > 0 ? allLines : [""];
}
