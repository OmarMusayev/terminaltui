#!/usr/bin/env npx tsx
/**
 * Automated test: Verify Apple Terminal color compatibility.
 *
 * Sets TERM_PROGRAM=Apple_Terminal and confirms that:
 * 1. Color mode is detected as "256" (never truecolor)
 * 2. fgColor() / bgColor() emit only \x1b[38;5;Nm / \x1b[48;5;Nm codes
 * 3. No truecolor escape codes (\x1b[38;2; or \x1b[48;2;) appear anywhere
 * 4. The ScreenBuffer renderer also avoids truecolor
 * 5. Gradient text avoids truecolor
 * 6. NO_COLOR mode strips all color codes
 */

// Must set env BEFORE importing the color module (auto-detects on load)
process.env.TERM_PROGRAM = "Apple_Terminal";
delete process.env.COLORTERM;
delete process.env.NO_COLOR;

// Dynamic import so env is set first
const colors = await import("../src/style/colors.js");
const renderer = await import("../src/core/renderer.js");

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg}`);
  }
}

const TRUECOLOR_RE = /\x1b\[(?:38|48);2;\d+;\d+;\d+m/;
const COLOR256_RE = /\x1b\[(?:38|48);5;\d+m/;

console.log("Apple Terminal Color Compatibility Tests\n");

// ── Test 1: Detection ──────────────────────────────────
console.log("1. Color mode detection");
assert(
  colors.getColorMode() === "256",
  `Color mode should be "256", got "${colors.getColorMode()}"`
);

// ── Test 2: fgColor output ─────────────────────────────
console.log("\n2. fgColor() output format");
const testColors = ["#ff6b6b", "#4ecdc4", "#ffffff", "#000000", "#888888", "#1a1a2e"];
for (const hex of testColors) {
  const result = colors.fgColor(hex);
  assert(!TRUECOLOR_RE.test(result), `fgColor("${hex}") has no truecolor codes`);
  assert(COLOR256_RE.test(result), `fgColor("${hex}") uses 256-color format`);
}

// ── Test 3: bgColor output ─────────────────────────────
console.log("\n3. bgColor() output format");
for (const hex of testColors) {
  const result = colors.bgColor(hex);
  assert(!TRUECOLOR_RE.test(result), `bgColor("${hex}") has no truecolor codes`);
  assert(COLOR256_RE.test(result), `bgColor("${hex}") uses 256-color format`);
}

// ── Test 4: ScreenBuffer cellToAnsi ────────────────────
console.log("\n4. ScreenBuffer rendering");
const buf = new renderer.ScreenBuffer(10, 1);
buf.setCell(0, 0, { char: "X", fg: "#ff0000", bg: "#00ff00", bold: true });
const output = buf.flush();
assert(!TRUECOLOR_RE.test(output), "ScreenBuffer flush has no truecolor codes");

// ── Test 5: Gradient text ──────────────────────────────
console.log("\n5. Gradient text");
const gradOutput = colors.applyGradientToText("Hello World", ["#ff0000", "#0000ff"]);
assert(!TRUECOLOR_RE.test(gradOutput), "Gradient text has no truecolor codes");

// ── Test 6: rgbTo256 conversion accuracy ───────────────
console.log("\n6. rgbTo256 conversion");
assert(colors.rgbTo256(0, 0, 0) === 16, "Black maps to 16");
assert(colors.rgbTo256(255, 255, 255) === 231, "White maps to 231");
assert(colors.rgbTo256(128, 128, 128) >= 232 && colors.rgbTo256(128, 128, 128) <= 255,
  "Gray maps to grayscale range");
const redIdx = colors.rgbTo256(255, 0, 0);
assert(redIdx === 16 + 36 * 5, `Pure red maps to index ${16 + 36 * 5}, got ${redIdx}`);

// ── Test 7: NO_COLOR mode ──────────────────────────────
console.log("\n7. NO_COLOR mode");
colors.setColorMode("none");
assert(colors.fgColor("#ff0000") === "", "fgColor returns empty in none mode");
assert(colors.bgColor("#00ff00") === "", "bgColor returns empty in none mode");
const noColorGrad = colors.applyGradientToText("Test", ["#ff0000", "#0000ff"]);
assert(!TRUECOLOR_RE.test(noColorGrad), "No truecolor in none mode gradient");
assert(!COLOR256_RE.test(noColorGrad), "No 256-color in none mode gradient");

// ── Test 8: 16-color mode ──────────────────────────────
console.log("\n8. 16-color mode");
colors.setColorMode("16");
const fg16 = colors.fgColor("#ff0000");
assert(!TRUECOLOR_RE.test(fg16), "16-color fg has no truecolor codes");
assert(!COLOR256_RE.test(fg16), "16-color fg has no 256-color codes");
assert(/\x1b\[\d+m/.test(fg16), "16-color fg uses basic ANSI code");

// ── Summary ────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("All Apple Terminal color tests passed!");
}
