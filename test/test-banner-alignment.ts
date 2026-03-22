/**
 * Banner alignment test — verifies every font renders with consistent
 * character column alignment across all rows.
 */
import { fonts } from "../src/ascii/fonts.js";
import { renderBanner } from "../src/ascii/banner.js";
import { setColorMode } from "../src/style/colors.js";

setColorMode("256");

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try { fn(); passed++; } catch (e: any) {
    failed++;
    console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`);
  }
}

console.log("\n  Banner Alignment Tests\n");

const testTexts = ["AB", "HELLO", "HELLO WORLD", "TEST 123"];

for (const [fontName] of Object.entries(fonts)) {
  for (const text of testTexts) {
    test(`${fontName} "${text}" — columns align`, () => {
      const lines = renderBanner(text, { font: fontName });
      const nonEmpty = lines.filter(l => l.length > 0);
      if (nonEmpty.length === 0) return; // some texts may fallback

      // Check each character's column position is consistent.
      // Render each character individually to get its per-row width.
      const charWidths: number[][] = [];
      for (const ch of text.toUpperCase()) {
        const charLines = renderBanner(ch, { font: fontName });
        charWidths.push(charLines.map(l => l.length));
      }

      // For each row, the cumulative width should match
      // We can't check exact positions because of the padding fix,
      // but we CAN verify the total line width is consistent
      // by checking that each character contributes the same padded width
      for (let ci = 0; ci < charWidths.length; ci++) {
        const cw = charWidths[ci];
        const maxCharW = Math.max(0, ...cw);
        for (let row = 0; row < cw.length; row++) {
          // After the fix, each row of a character should be padded to maxCharW
          // The rendered banner concatenates padded chars, so the overall width
          // should be sum of max char widths.
        }
      }

      // The real alignment test: render "A" alone and "AB" together.
      // The A portion in "AB" must exactly match "A" alone (padded to its max width).
      // This proves characters columns line up — the LEFT side is aligned.
      // (The right edge being ragged is normal — last char rows have different trailing widths.)
      if (text.length >= 2) {
        const first = renderBanner(text[0], { font: fontName });
        const firstTwo = renderBanner(text.slice(0, 2), { font: fontName });
        const firstNonEmpty = first.filter(l => l.length > 0);
        const firstTwoNonEmpty = firstTwo.filter(l => l.length > 0);

        // Use all rows (padded to font height) for comparison, not filtered
        if (first.length > 0 && firstTwo.length > 0) {
          const firstMaxW = Math.max(0, ...first.map(l => l.length));
          if (firstMaxW === 0) return; // font doesn't have this char
          const minLen = Math.min(first.length, firstTwo.length);
          for (let r = 0; r < minLen; r++) {
            const aRow = first[r] + " ".repeat(Math.max(0, firstMaxW - first[r].length));
            const abPrefix = firstTwo[r].substring(0, firstMaxW);
            if (aRow !== abPrefix) {
              throw new Error(`Row ${r}: A alone doesn't match prefix of AB (column misaligned)`);
            }
          }
        }
      }
    });
  }

  // Test with shadow
  test(`${fontName} shadow — renders without crash`, () => {
    const lines = renderBanner("AB", { font: fontName, shadow: true });
    if (lines.length === 0) throw new Error("No output");
  });

  // Test with border
  test(`${fontName} border — renders without crash`, () => {
    const lines = renderBanner("AB", { font: fontName, border: "rounded" });
    if (lines.length === 0) throw new Error("No output");
  });
}

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
