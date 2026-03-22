#!/usr/bin/env npx tsx
/**
 * Debug script — renders the banner directly to stdout
 * (no alternate screen, no animation, no runtime)
 * to isolate whether the issue is in the font, gradient, or runtime.
 */
import { renderBanner, centerBanner } from "../src/ascii/banner.js";
import { gradientLines } from "../src/style/gradient.js";
import { fgColor, reset } from "../src/style/colors.js";
import { createGradient } from "../src/style/colors.js";
import { stripAnsi } from "../src/components/base.js";

const text = "OMAR";
const width = process.stdout.columns || 80;

console.log("\n=== TEST 1: Raw banner (no color) ===");
const raw = renderBanner(text, { font: "ANSI Shadow" });
for (const line of raw) {
  console.log(`|${line}|  (len=${line.length})`);
}

console.log("\n=== TEST 2: Centered banner (no color) ===");
const centered = centerBanner(raw, Math.min(width, 80));
for (const line of centered) {
  console.log(line);
}

console.log("\n=== TEST 3: Single color (accent) ===");
for (const line of centered) {
  console.log(fgColor("#7aa2f7") + line + reset);
}

console.log("\n=== TEST 4: Gradient (2 colors) ===");
const grad2 = gradientLines(centered, ["#ff6b6b", "#4ecdc4"]);
for (const line of grad2) {
  console.log(line);
}

console.log("\n=== TEST 5: Gradient (3 colors) ===");
const grad3 = gradientLines(centered, ["#ff6b6b", "#ffd93d", "#4ecdc4"]);
for (const line of grad3) {
  console.log(line);
}

console.log("\n=== TEST 6: Check gradient color generation ===");
const colors2 = createGradient(["#ff6b6b", "#4ecdc4"], 10);
console.log("2-color gradient (10 steps):", colors2);

console.log("\n=== TEST 7: All fonts ===");
for (const font of ["ANSI Shadow", "Slant", "Calvin S", "Small", "Ogre"]) {
  console.log(`\n--- ${font} ---`);
  const lines = renderBanner("TEST", { font });
  for (const line of lines) {
    console.log(fgColor("#7aa2f7") + line + reset);
  }
}

console.log("\n=== TEST 8: Visual width check ===");
for (const line of centered) {
  const plain = stripAnsi(line);
  console.log(`visual_width=${plain.length}  terminal_width=${width}`);
}

console.log("\nDone. If the above looks correct, the issue is in the runtime renderer.");
console.log("If it looks broken, the issue is in the font/gradient system.\n");
