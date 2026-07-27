#!/usr/bin/env npx tsx
/**
 * Automated test: Verify Apple Terminal color compatibility.
 *
 * Pins a PRE-truecolour Terminal.app build and confirms that:
 * 1. Color mode is detected as "256" (never truecolor)
 * 2. fgColor() / bgColor() emit only \x1b[38;5;Nm / \x1b[48;5;Nm codes
 * 3. No truecolor escape codes (\x1b[38;2; or \x1b[48;2;) appear anywhere
 * 4. Gradient text avoids truecolor
 * 5. NO_COLOR mode strips all color codes
 * 6. The build-number gate flips to truecolor at 470 and nowhere earlier
 */

// Must set env BEFORE importing the color module (auto-detects on load).
//
// TERM_PROGRAM_VERSION is pinned rather than merely unset, and that is the
// whole point: Apple Terminal's depth is sniffed from its build number, so a
// suite run FROM Apple Terminal would otherwise inherit the real version and
// this file would assert the opposite of itself on a Tahoe machine. 455 is
// macOS 15's build — the newest one that genuinely cannot do 24-bit.
process.env.TERM_PROGRAM = "Apple_Terminal";
process.env.TERM_PROGRAM_VERSION = "455";
delete process.env.COLORTERM;
delete process.env.NO_COLOR;
delete process.env.TERMINALTUI_COLOR;

// Dynamic import so env is set first
const colors = await import("../src/style/colors.js");

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

// ── Test 4: Gradient text ──────────────────────────────
console.log("\n4. Gradient text");
const gradOutput = colors.applyGradientToText("Hello World", ["#ff0000", "#0000ff"]);
assert(!TRUECOLOR_RE.test(gradOutput), "Gradient text has no truecolor codes");

// ── Test 5: rgbTo256 conversion accuracy ───────────────
console.log("\n5. rgbTo256 conversion");
assert(colors.rgbTo256(0, 0, 0) === 16, "Black maps to 16");
assert(colors.rgbTo256(255, 255, 255) === 231, "White maps to 231");
assert(colors.rgbTo256(128, 128, 128) >= 232 && colors.rgbTo256(128, 128, 128) <= 255,
  "Gray maps to grayscale range");
const redIdx = colors.rgbTo256(255, 0, 0);
assert(redIdx === 16 + 36 * 5, `Pure red maps to index ${16 + 36 * 5}, got ${redIdx}`);

// ── Test 6: NO_COLOR mode ──────────────────────────────
console.log("\n6. NO_COLOR mode");
colors.setColorMode("none");
assert(colors.fgColor("#ff0000") === "", "fgColor returns empty in none mode");
assert(colors.bgColor("#00ff00") === "", "bgColor returns empty in none mode");
const noColorGrad = colors.applyGradientToText("Test", ["#ff0000", "#0000ff"]);
assert(!TRUECOLOR_RE.test(noColorGrad), "No truecolor in none mode gradient");
assert(!COLOR256_RE.test(noColorGrad), "No 256-color in none mode gradient");

// ── Test 7: Apple Terminal build-number gate ───────────
//
// Terminal.app never sets COLORTERM, so this version sniff is the ONLY thing
// standing between a Tahoe user and the 256-colour path. Both directions are
// pinned: a wrong answer above 470 costs a good render, and a wrong answer
// below it paints codes the terminal will mangle.
console.log("\n7. Apple Terminal build-number gate");

/** Resolve a depth for one Apple Terminal build, leaving the env as found. */
function depthForBuild(version: string | undefined): string {
  const had = process.env.TERM_PROGRAM_VERSION;
  if (version === undefined) delete process.env.TERM_PROGRAM_VERSION;
  else process.env.TERM_PROGRAM_VERSION = version;
  try {
    return colors.detectColorSupport();
  } finally {
    if (had === undefined) delete process.env.TERM_PROGRAM_VERSION;
    else process.env.TERM_PROGRAM_VERSION = had;
  }
}

for (const old of ["399", "440", "453", "455", "469"]) {
  assert(depthForBuild(old) === "256", `build ${old} stays 256`);
}
// 470 is the boundary itself, and 470.2 is the build verified by hand on
// macOS 26 — a 60-step ramp through the cube's 0->95 gap rendered smooth.
for (const modern of ["470", "470.2", "471", "500"]) {
  assert(depthForBuild(modern) === "truecolor", `build ${modern} reports truecolor`);
}
// Garbage and absence both fall to the safe side rather than throwing.
for (const bad of [undefined, "", "unknown", "abc"]) {
  assert(depthForBuild(bad) === "256", `unparseable version ${JSON.stringify(bad)} falls back to 256`);
}

// ── Test 7b: TERMINALTUI_COLOR override ────────────────
console.log("\n7b. TERMINALTUI_COLOR override");

/** Resolve a depth under a forced override, leaving the env as found. */
function depthForOverride(value: string): string {
  process.env.TERMINALTUI_COLOR = value;
  try {
    return colors.detectColorSupport();
  } finally {
    delete process.env.TERMINALTUI_COLOR;
  }
}

// Still on the pinned 455 here, so "truecolor" proves the override beats the
// Apple branch rather than merely agreeing with it.
assert(depthForOverride("truecolor") === "truecolor", "override lifts a pre-470 build to truecolor");
assert(depthForOverride("24bit") === "truecolor", "24bit is accepted as a synonym");
assert(depthForOverride("  TrueColor  ") === "truecolor", "override is trimmed and case-insensitive");
assert(depthForOverride("16") === "16", "override can force 16");
assert(depthForOverride("none") === "none", "override can force none");
assert(depthForOverride("nonsense") === "256", "an unrecognised override is ignored, not obeyed");
// NO_COLOR is the published standard and outranks our own knob.
process.env.NO_COLOR = "1";
assert(depthForOverride("truecolor") === "none", "NO_COLOR still outranks TERMINALTUI_COLOR");
delete process.env.NO_COLOR;

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
