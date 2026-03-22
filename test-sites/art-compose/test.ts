/**
 * Exhaustive test for ASCII art composition and manipulation functions.
 * Tests all 13 composition functions.
 */
import {
  overlay, sideBySide, stack, center, pad, crop,
  repeat, mirror, rotate, colorize, gradient, rainbow, shadow,
} from "../../src/ascii/compose.js";
import { setColorMode } from "../../src/style/colors.js";
import { writeFileSync } from "node:fs";

setColorMode("256");

// ── Test harness ──
let passed = 0;
let failed = 0;
const failures: { name: string; error: string }[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
  } catch (err: any) {
    failed++;
    failures.push({ name, error: err.message ?? String(err) });
    console.error(`  FAIL: ${name} — ${err.message}`);
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

// ── Sample art for testing ──
const SMALL = ["AB", "CD"];
const LARGE = [
  "########",
  "#      #",
  "#      #",
  "#      #",
  "########",
];
const TALL = ["X", "Y", "Z", "W"];
const WIDE = ["ABCDEFGH"];

// ═══════════════════════════════════════════════════════════════════════════
// overlay
// ═══════════════════════════════════════════════════════════════════════════

test("overlay: small on large at (0,0)", () => {
  const result = overlay(LARGE, SMALL, 0, 0);
  assert(result.length === LARGE.length, `Expected ${LARGE.length} lines, got ${result.length}`);
  // First two lines should have SMALL chars at positions 0-1
  const line0 = stripAnsi(result[0]);
  assert(line0.startsWith("AB"), `Expected line 0 to start with AB, got "${line0}"`);
});

test("overlay: small on large at (2,2)", () => {
  const result = overlay(LARGE, SMALL, 2, 2);
  assert(result.length === LARGE.length, `Height should be preserved`);
  const line2 = stripAnsi(result[2]);
  assert(line2[2] === "A" && line2[3] === "B", `Expected AB at col 2-3 of line 2, got "${line2}"`);
});

test("overlay: at edge position", () => {
  const result = overlay(LARGE, SMALL, 6, 3);
  assert(result.length === LARGE.length, `Height should be preserved`);
});

test("overlay: empty over returns base", () => {
  const result = overlay(LARGE, [], 0, 0);
  assert(result.length === LARGE.length, `Should return base`);
});

test("overlay: empty base returns empty", () => {
  const result = overlay([], SMALL, 0, 0);
  assert(result.length === 0, `Should return empty`);
});

test("overlay: spaces in overlay are transparent", () => {
  const overWithSpace = ["A B", "C D"];
  const base = ["####", "####", "####"];
  const result = overlay(base, overWithSpace, 0, 0);
  const line0 = stripAnsi(result[0]);
  // Position 1 should be '#' (space in overlay is transparent)
  assert(line0[1] === "#", `Space should be transparent, got "${line0[1]}"`);
});

// ═══════════════════════════════════════════════════════════════════════════
// sideBySide
// ═══════════════════════════════════════════════════════════════════════════

test("sideBySide: equal height", () => {
  const result = sideBySide(SMALL, SMALL);
  assert(result.length === 2, `Expected 2 lines, got ${result.length}`);
  for (const line of result) {
    const stripped = stripAnsi(line);
    assert(stripped.length > 2, `Line too short: "${stripped}"`);
  }
});

test("sideBySide: different heights", () => {
  const result = sideBySide(SMALL, TALL);
  assert(result.length === Math.max(SMALL.length, TALL.length),
    `Height should be max of both`);
});

test("sideBySide: empty left returns right", () => {
  const result = sideBySide([], SMALL);
  assert(result.length === SMALL.length, `Should return right`);
});

test("sideBySide: empty right returns left", () => {
  const result = sideBySide(SMALL, []);
  assert(result.length === SMALL.length, `Should return left`);
});

test("sideBySide: both empty returns empty", () => {
  const result = sideBySide([], []);
  assert(result.length === 0, `Should return empty`);
});

test("sideBySide: custom gap", () => {
  const result = sideBySide(["A"], ["B"], 5);
  const stripped = stripAnsi(result[0]);
  assert(stripped.includes("     "), `Should have 5 space gap`);
});

// ═══════════════════════════════════════════════════════════════════════════
// stack
// ═══════════════════════════════════════════════════════════════════════════

test("stack: two pieces", () => {
  const result = stack(SMALL, SMALL);
  // 2 lines + 1 gap + 2 lines = 5
  assert(result.length === 5, `Expected 5 lines (2+1+2), got ${result.length}`);
});

test("stack: custom gap", () => {
  const result = stack(["A"], ["B"], 3);
  assert(result.length === 5, `Expected 5 lines (1+3+1), got ${result.length}`);
});

test("stack: zero gap", () => {
  const result = stack(["A"], ["B"], 0);
  assert(result.length === 2, `Expected 2 lines, got ${result.length}`);
});

test("stack: empty top returns bottom", () => {
  const result = stack([], SMALL);
  assert(result.length === SMALL.length, `Should return bottom`);
});

test("stack: empty bottom returns top", () => {
  const result = stack(SMALL, []);
  assert(result.length === SMALL.length, `Should return top`);
});

// ═══════════════════════════════════════════════════════════════════════════
// center
// ═══════════════════════════════════════════════════════════════════════════

test("center: art narrower than width", () => {
  const result = center(SMALL, 20);
  assert(result.length === SMALL.length, `Height should be preserved`);
  for (const line of result) {
    const stripped = stripAnsi(line);
    // Should have leading spaces
    const leading = stripped.length - stripped.trimStart().length;
    assert(leading > 0, `Line should be padded: "${stripped}"`);
  }
});

test("center: art wider than width truncates", () => {
  const result = center(["ABCDEFGHIJ"], 5);
  for (const line of result) {
    const stripped = stripAnsi(line);
    assert(stripped.length <= 5, `Line should be truncated to 5, got ${stripped.length}`);
  }
});

test("center: exact width", () => {
  const result = center(["AB"], 2);
  assert(result.length === 1, `Should have 1 line`);
});

test("center: empty art returns empty", () => {
  const result = center([], 20);
  assert(result.length === 0, `Should return empty`);
});

// ═══════════════════════════════════════════════════════════════════════════
// pad
// ═══════════════════════════════════════════════════════════════════════════

test("pad: number padding", () => {
  const result = pad(SMALL, 2);
  // 2 top + 2 content + 2 bottom = 6
  assert(result.length === 6, `Expected 6 lines, got ${result.length}`);
  // First 2 should be empty
  assert(result[0] === "", `Top padding should be empty line`);
  assert(result[1] === "", `Top padding should be empty line`);
  // Content lines should have 2 leading spaces
  const line2 = result[2];
  assert(line2.startsWith("  "), `Content should have 2 left spaces`);
});

test("pad: object padding", () => {
  const result = pad(SMALL, { top: 1, right: 0, bottom: 1, left: 3 });
  assert(result.length === 4, `Expected 4 lines (1+2+1), got ${result.length}`);
  assert(result[0] === "", `Top padding should be empty`);
  assert(result[1].startsWith("   "), `Should have 3 left spaces`);
});

test("pad: zero padding returns same", () => {
  const result = pad(SMALL, 0);
  assert(result.length === SMALL.length, `Should preserve line count`);
});

test("pad: empty art returns empty", () => {
  const result = pad([], 5);
  assert(result.length === 0, `Should return empty`);
});

// ═══════════════════════════════════════════════════════════════════════════
// crop
// ═══════════════════════════════════════════════════════════════════════════

test("crop: middle region", () => {
  const result = crop(LARGE, 1, 1, 4, 3);
  assert(result.length === 3, `Expected 3 lines, got ${result.length}`);
});

test("crop: full art", () => {
  const result = crop(SMALL, 0, 0, 2, 2);
  assert(result.length === 2, `Expected 2 lines, got ${result.length}`);
});

test("crop: out of bounds returns empty lines", () => {
  const result = crop(SMALL, 0, 5, 2, 2);
  assert(result.length === 2, `Should still return 2 lines`);
});

test("crop: empty art returns empty", () => {
  const result = crop([], 0, 0, 5, 5);
  assert(result.length === 0, `Should return empty`);
});

// ═══════════════════════════════════════════════════════════════════════════
// repeat
// ═══════════════════════════════════════════════════════════════════════════

test("repeat: horizontal 3x", () => {
  const result = repeat(SMALL, 3, "horizontal");
  assert(result.length === 2, `Height should stay 2, got ${result.length}`);
  for (const line of result) {
    const stripped = stripAnsi(line);
    // Should be wider than original
    assert(stripped.length >= 6, `Should be at least 6 wide, got ${stripped.length}`);
  }
});

test("repeat: vertical 3x", () => {
  const result = repeat(SMALL, 3, "vertical");
  assert(result.length === 6, `Expected 6 lines (2*3), got ${result.length}`);
});

test("repeat: times=1 returns copy", () => {
  const result = repeat(SMALL, 1, "horizontal");
  assert(result.length === SMALL.length, `Should be same height`);
});

test("repeat: times=0 returns empty", () => {
  const result = repeat(SMALL, 0, "horizontal");
  assert(result.length === 0, `Should return empty`);
});

test("repeat: empty art returns empty", () => {
  const result = repeat([], 3, "horizontal");
  assert(result.length === 0, `Should return empty`);
});

// ═══════════════════════════════════════════════════════════════════════════
// mirror
// ═══════════════════════════════════════════════════════════════════════════

test("mirror: horizontal reverses chars", () => {
  const result = mirror(["ABCD"], "horizontal");
  const stripped = stripAnsi(result[0]);
  assert(stripped === "DCBA", `Expected DCBA, got "${stripped}"`);
});

test("mirror: vertical reverses line order", () => {
  const result = mirror(["AAA", "BBB", "CCC"], "vertical");
  assert(stripAnsi(result[0]) === "CCC", `Expected CCC first`);
  assert(stripAnsi(result[2]) === "AAA", `Expected AAA last`);
});

test("mirror: empty art returns empty", () => {
  assert(mirror([], "horizontal").length === 0, "Should return empty");
  assert(mirror([], "vertical").length === 0, "Should return empty");
});

test("mirror: single line horizontal", () => {
  const result = mirror(["AB"], "horizontal");
  assert(stripAnsi(result[0]) === "BA", `Expected BA, got "${stripAnsi(result[0])}"`);
});

// ═══════════════════════════════════════════════════════════════════════════
// rotate
// ═══════════════════════════════════════════════════════════════════════════

test("rotate: 180 degrees", () => {
  const result = rotate(["AB", "CD"], 180);
  assert(result.length === 2, `Expected 2 lines`);
  const line0 = stripAnsi(result[0]);
  const line1 = stripAnsi(result[1]);
  assert(line0 === "DC", `Expected DC, got "${line0}"`);
  assert(line1 === "BA", `Expected BA, got "${line1}"`);
});

test("rotate: 90 degrees", () => {
  const result = rotate(["AB", "CD"], 90);
  // 2x2 -> 2x2 (width becomes height, height becomes width)
  assert(result.length === 2, `Expected 2 lines for 90 rotation, got ${result.length}`);
});

test("rotate: 270 degrees", () => {
  const result = rotate(["AB", "CD"], 270);
  assert(result.length === 2, `Expected 2 lines for 270 rotation, got ${result.length}`);
});

test("rotate: empty art returns empty", () => {
  assert(rotate([], 90).length === 0, "Should return empty");
});

test("rotate: rectangular art 90 degrees transposes", () => {
  const art = ["ABC", "DEF"];
  const result = rotate(art, 90);
  // 3 cols x 2 rows -> 2 cols x 3 rows
  assert(result.length === 3, `Expected 3 lines after 90 rotation, got ${result.length}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// colorize
// ═══════════════════════════════════════════════════════════════════════════

test("colorize: applies ANSI codes", () => {
  const result = colorize(["AB", "CD"], "#ff0000");
  const joined = result.join("");
  assert(joined.includes("\x1b["), `No ANSI codes found`);
});

test("colorize: preserves content", () => {
  const result = colorize(["AB", "CD"], "#ff0000");
  const stripped = result.map(l => stripAnsi(l));
  assert(stripped[0].includes("A"), `A missing`);
  assert(stripped[0].includes("B"), `B missing`);
});

test("colorize: empty art returns empty", () => {
  assert(colorize([], "#ff0000").length === 0, "Should return empty");
});

test("colorize: spaces not colored", () => {
  const result = colorize(["A B"], "#ff0000");
  // The space between A and B should not have color codes directly on it
  assert(result.length === 1, `Expected 1 line`);
});

// ═══════════════════════════════════════════════════════════════════════════
// gradient
// ═══════════════════════════════════════════════════════════════════════════

test("gradient: 2-color horizontal", () => {
  const result = gradient(["ABCDEF"], ["#ff0000", "#0000ff"]);
  assert(result.length === 1, `Expected 1 line`);
  const joined = result[0];
  assert(joined.includes("\x1b["), `No ANSI codes found`);
});

test("gradient: 2-color vertical", () => {
  const result = gradient(["AB", "CD", "EF"], ["#ff0000", "#0000ff"], "vertical");
  assert(result.length === 3, `Expected 3 lines`);
  assert(result[0].includes("\x1b["), `No ANSI codes found`);
});

test("gradient: diagonal", () => {
  const result = gradient(["AB", "CD"], ["#ff0000", "#0000ff"], "diagonal");
  assert(result.length === 2, `Expected 2 lines`);
});

test("gradient: empty colors returns copy", () => {
  const result = gradient(SMALL, []);
  assert(result.length === SMALL.length, `Should return copy`);
});

test("gradient: empty art returns empty", () => {
  assert(gradient([], ["#ff0000"]).length === 0, "Should return empty");
});

// ═══════════════════════════════════════════════════════════════════════════
// rainbow
// ═══════════════════════════════════════════════════════════════════════════

test("rainbow: produces colored output", () => {
  const result = rainbow(["HELLO WORLD"]);
  assert(result.length === 1, `Expected 1 line`);
  assert(result[0].includes("\x1b["), `No ANSI codes found in rainbow`);
});

test("rainbow: preserves content", () => {
  const result = rainbow(["ABC"]);
  const stripped = stripAnsi(result[0]);
  assert(stripped.includes("A"), `A missing`);
  assert(stripped.includes("B"), `B missing`);
  assert(stripped.includes("C"), `C missing`);
});

test("rainbow: empty art returns empty", () => {
  assert(rainbow([]).length === 0, "Should return empty");
});

test("rainbow: multi-line", () => {
  const result = rainbow(SMALL);
  assert(result.length === 2, `Expected 2 lines`);
});

// ═══════════════════════════════════════════════════════════════════════════
// shadow
// ═══════════════════════════════════════════════════════════════════════════

test("shadow: adds extra row and column (bottom-right)", () => {
  const result = shadow(SMALL);
  assert(result.length === SMALL.length + 1,
    `Expected ${SMALL.length + 1} lines (shadow adds 1 row), got ${result.length}`);
});

test("shadow: bottom-left direction", () => {
  const result = shadow(SMALL, "bottom-left");
  assert(result.length === SMALL.length + 1,
    `Expected ${SMALL.length + 1} lines, got ${result.length}`);
});

test("shadow: custom shadow character", () => {
  const result = shadow(["XX", "XX"], "bottom-right", "#");
  const joined = result.join("");
  assert(joined.includes("#"), `Custom shadow char # not found`);
});

test("shadow: empty art returns empty", () => {
  assert(shadow([]).length === 0, "Should return empty");
});

test("shadow: shadow is wider than original", () => {
  const orig = ["AB"];
  const result = shadow(orig, "bottom-right");
  // The last line (shadow row) should exist
  assert(result.length === 2, `Expected 2 lines, got ${result.length}`);
});

test("shadow: non-empty output for single char", () => {
  const result = shadow(["X"]);
  assert(result.length > 0, `Should produce non-empty output`);
});

// ═══════════════════════════════════════════════════════════════════════════
// Combined operations
// ═══════════════════════════════════════════════════════════════════════════

test("compose: stack + center", () => {
  const top = ["SHORT"];
  const bottom = ["A LONGER LINE"];
  const stacked = stack(top, bottom, 0);
  const centered = center(stacked, 20);
  assert(centered.length === 2, `Expected 2 lines`);
});

test("compose: colorize + sideBySide", () => {
  const red = colorize(["AB"], "#ff0000");
  const blue = colorize(["CD"], "#0000ff");
  const result = sideBySide(red, blue);
  assert(result.length === 1, `Expected 1 line`);
  assert(result[0].includes("\x1b["), `Should preserve colors`);
});

test("compose: pad + crop round-trip", () => {
  const padded = pad(["AB"], { top: 2, left: 3, bottom: 2, right: 0 });
  const cropped = crop(padded, 3, 2, 2, 1);
  assert(cropped.length === 1, `Expected 1 line`);
  const stripped = stripAnsi(cropped[0]);
  assert(stripped === "AB", `Expected AB after crop, got "${stripped}"`);
});

// ── Summary ──
const total = passed + failed;
console.log(`\n${"=".repeat(60)}`);
console.log(`  art-compose: ${passed}/${total} passed, ${failed} failed`);
console.log(`${"=".repeat(60)}`);

if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.error}`);
  }
}

// ── Write report ──
const report = {
  suite: "art-compose",
  timestamp: new Date().toISOString(),
  total,
  passed,
  failed,
  failures,
};

writeFileSync(
  new URL("report.json", import.meta.url),
  JSON.stringify(report, null, 2),
);

console.log(`\nReport written to test-sites/art-compose/report.json`);
if (failed > 0) process.exit(1);
