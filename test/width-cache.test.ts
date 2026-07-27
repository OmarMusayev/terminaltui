/**
 * Width-cache unit tests (Wave 5, Stage B) — stringWidth memoization and
 * stripAnsi fast path in src/components/base.ts.
 *
 * Correctness gate: the memoized stringWidth must return values identical to
 * the uncached computation for every input — ANSI-styled, CJK, emoji,
 * combining marks, zero-width chars — on both the miss path (first call) and
 * the hit path (second call), and after FIFO eviction.
 */
import {
  stringWidth,
  charWidth,
  stripAnsi,
  __widthCacheInspect,
} from "../src/components/base.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${name}`);
  }
}

function assertEqual(actual: unknown, expected: unknown, name: string) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${name} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/**
 * Independent uncached reference: same primitives (stripAnsi + charWidth),
 * no memoization. The cached stringWidth must agree with this exactly.
 */
function referenceWidth(text: string): number {
  let width = 0;
  for (const ch of stripAnsi(text)) {
    width += charWidth(ch.codePointAt(0) ?? 0);
  }
  return width;
}

const inspect = __widthCacheInspect;

// ─── Correctness corpus ──────────────────────────────────
// [text, expectedWidth, label]. Widths follow this codebase's charWidth
// tables (emoji U+1F300–U+1FAFF = 2, dingbats/misc-symbols = 1, CJK = 2,
// combining/zero-width = 0). Entries span the cache gate: some below the
// 8-length gate (uncached path), some at/above it (cached path).
const corpus: Array<[string, number, string]> = [
  ["", 0, "empty string"],
  ["a", 1, "single ASCII char (below gate)"],
  ["hello", 5, "short ASCII (below gate)"],
  ["hello world", 11, "plain ASCII"],
  ["\x1b[31mhello world\x1b[0m", 11, "ANSI-styled ASCII"],
  ["\x1b[1m\x1b[38;5;208mBold orange title\x1b[0m", 17, "stacked SGR sequences"],
  ["你好世界你好世界", 16, "CJK ideographs (8 chars x 2 cells)"],
  ["こんにちは世界!", 15, "Hiragana + CJK + ASCII bang"],
  ["안녕하세요 세계", 15, "Hangul syllables + space"],
  ["ｆｕｌｌｗｉｄｔｈ", 18, "fullwidth Latin forms"],
  ["🎉🎉🎉🎉", 8, "emoji surrogate pairs (4 x 2 cells)"],
  ["🚀 launch 🔥", 12, "emoji mixed with ASCII"],
  ["éééé", 4, "combining acute accents (width 0)"],
  ["a\u200bb\u200cc\u200dd\ufeff", 4, "zero-width chars (ZWS/ZWNJ/ZWJ/BOM)"],
  ["naïve café text", 15, "Latin-1 precomposed accents"],
  ["\x1b[32m✓\x1b[0m done ✨ ok", 11, "dingbats width 1 + ANSI"],
  ["\x1b[36m你好\x1b[0m 🎨 mix", 11, "ANSI + CJK + emoji mix"],
  ["snowman ☃ here", 14, "misc symbol U+2603 width 1"],
];

console.log("\x1b[1m  stringWidth correctness (miss path, hit path, vs reference)\x1b[0m");

for (const [text, expected, label] of corpus) {
  const first = stringWidth(text); // cache miss (or gate bypass)
  const second = stringWidth(text); // cache hit for gated-in strings
  assertEqual(first, expected, `${label}: first call width`);
  assertEqual(second, expected, `${label}: second call width (hit path)`);
  assertEqual(first, referenceWidth(text), `${label}: matches uncached reference`);
}

// ─── Length gate ─────────────────────────────────────────

console.log("\x1b[1m  length gate\x1b[0m");

{
  const { minLen } = inspect();
  const short = "abc-123"; // 7 chars, below the gate
  assert(short.length < minLen, "gate probe is below minLen");
  stringWidth(short);
  assert(!inspect().has(short), "strings below the gate are never cached");

  const longEnough = "abc-1234"; // exactly at the gate
  assert(longEnough.length >= minLen, "gated probe is at/above minLen");
  stringWidth(longEnough);
  assert(inspect().has(longEnough), "strings at/above the gate are cached after a call");

  // Upper gate. The cap is an ENTRY count sized for ~200-char UI rows; a single
  // truecolor image row is ~1.5 KB, and letting those in took heapUsed from
  // 5.3 MB to 29.0 MB while FIFO-evicting every legitimate UI string. Both
  // gates return the SAME width as the cached path — only residency differs.
  const { maxLen } = inspect();
  const atMax = "x".repeat(maxLen);
  stringWidth(atMax);
  assert(inspect().has(atMax), "strings exactly at maxLen are still cached");

  const tooLong = "x".repeat(maxLen + 1);
  const before = inspect().size;
  assertEqual(stringWidth(tooLong), maxLen + 1, "over-long strings still measure correctly");
  assert(!inspect().has(tooLong), "strings above the gate are never cached");
  assertEqual(inspect().size, before, "and do not grow the cache");

  // A realistic image row: block glyphs behind SGR pairs, measured uncached.
  let imageRow = "";
  for (let i = 0; i < 80; i++) imageRow += `\x1b[38;2;${i};${i};${i};48;2;${i};0;0m▀`;
  imageRow += "\x1b[0m";
  assert(imageRow.length > maxLen, "the synthetic image row exceeds the gate");
  assertEqual(stringWidth(imageRow), 80, "an 80-cell image row measures 80 columns");
  assert(!inspect().has(imageRow), "image rows stay out of the shared memo");
}

// ─── Eviction cap (FIFO) ─────────────────────────────────

console.log("\x1b[1m  eviction cap\x1b[0m");

{
  const { cap } = inspect();
  assertEqual(cap, 8192, "cap is the designed 8192");

  const probe = (i: number) => `evict-probe-${i}-padding`; // ≥ 8 chars, distinct
  const overflow = cap + 100;
  for (let i = 0; i < overflow; i++) stringWidth(probe(i));

  assertEqual(inspect().size, cap, "cache size stays exactly at cap after overflow");
  assert(!inspect().has(probe(0)), "oldest entry evicted (FIFO)");
  assert(inspect().has(probe(overflow - 1)), "newest entry retained");

  // Evicted strings still compute correctly and re-enter the cache.
  assertEqual(stringWidth(probe(0)), referenceWidth(probe(0)), "evicted string recomputes correctly");
  assert(inspect().has(probe(0)), "recomputed string is re-cached");
  assertEqual(inspect().size, cap, "re-cache keeps size at cap");

  // Corpus entries evicted by the churn must still return correct widths.
  for (const [text, expected, label] of corpus) {
    assertEqual(stringWidth(text), expected, `${label}: correct after cache churn`);
  }
}

// ─── stripAnsi fast path ─────────────────────────────────

console.log("\x1b[1m  stripAnsi fast path\x1b[0m");

{
  assertEqual(stripAnsi("plain text, no escapes"), "plain text, no escapes", "plain string returned unchanged");
  assertEqual(stripAnsi(""), "", "empty string unchanged");
  assertEqual(stripAnsi("\x1b[31mred\x1b[0m"), "red", "SGR sequences stripped");
  assertEqual(stripAnsi("\x1b[1m\x1b[38;5;208mX\x1b[0m"), "X", "stacked SGR stripped");
  // Non-SGR escapes (CUP/EL) are NOT stripped — same as before the fast path.
  assertEqual(stripAnsi("\x1b[2K"), "\x1b[2K", "non-SGR escape (EL) untouched");
  assertEqual(stripAnsi("\x1b[5;10H"), "\x1b[5;10H", "non-SGR escape (CUP) untouched");
  assertEqual(stripAnsi("mix \x1b[32mgreen\x1b[0m and \x1b[2K"), "mix green and \x1b[2K", "SGR stripped, non-SGR kept in same string");
}

// ─── Summary ─────────────────────────────────────────────

console.log("");
if (failed === 0) {
  console.log(`  \x1b[32m${passed} passed\x1b[0m, 0 failed`);
} else {
  console.log(`  \x1b[31m${failed} failed\x1b[0m, ${passed} passed`);
  process.exit(1);
}
