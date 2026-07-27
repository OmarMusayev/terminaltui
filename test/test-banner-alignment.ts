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
      if (nonEmpty.length === 0) {
        throw new Error(`renderBanner produced no output for ${fontName}/"${text}"`);
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
          if (firstMaxW === 0) {
            throw new Error(`renderBanner produced blank rows for ${fontName}/"${text[0]}"`);
          }
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

// ─── Letterform legibility ────────────────────────────────

// A banner font whose glyphs align perfectly and still spell a different word is
// no use. `Block` shipped three letters drawn as a horizontal BAR between two
// full-height stems, which is the letter H (or U, depending how high the bar
// sat), and a real terminal capture of the odyssey demo read
// "TRY: TERHINALTUI.DEU" and "HATCHING". The three shapes below are pinned
// verbatim because they were redrawn deliberately and a silent revert is exactly
// the failure that shipped: what each must show is an interior stroke that
// CHANGES COLUMN as it changes row, which is the only cue at four rows that
// separates M from H, V from U and W from H.
const BLOCK_LETTERFORMS: Record<string, string[]> = {
  // A descending V between the stems, not a high crossbar.
  M: ["█▄ ▄█", "█▀▄▀█", "█   █", "█   █"],
  // Strokes that MOVE INWARD as they descend, on half-columns (▌/▐), ending in
  // a point. The half-column grid is the whole letter: on whole cells a stroke
  // cannot step by less than a full column, and a full-column step per row puts
  // consecutive rows corner-to-corner, which renders as a detached speck rather
  // than a join. Three earlier forms failed on that trade — `  ▀  ` under
  // ` █ █ ` was the speck; `▀█▀` fixed the join by cutting the stems to
  // half height; `█▄█` connected everything by keeping the stems PARALLEL,
  // which at size reads as a U with a stub and is the failure this pin exists
  // to catch. What must hold: the gap between the strokes narrows on every row.
  V: ["█   █", "▐▌ ▐▌", " ▐█▌", "  ▀"],
  // Two V's sharing their middle column — same construction, and the letter
  // where the whole-cell forms failed worst, stacking the fault twice.
  W: ["█   █   █", "▐▌ ▐█▌ ▐▌", " ▐█▌ ▐█▌", "  ▀   ▀"],
};

for (const [letter, art] of Object.entries(BLOCK_LETTERFORMS)) {
  test(`Block "${letter}" keeps its redrawn letterform`, () => {
    const got = renderBanner(letter, { font: "Block" }).map(l => l.trimEnd());
    const want = art.map(l => l.trimEnd());
    if (got.join("\n") !== want.join("\n")) {
      throw new Error(`\nexpected:\n${want.join("\n")}\ngot:\n${got.join("\n")}`);
    }
  });
}

// The general form of the same defect, swept over every bundled face: a letter
// that renders identically to a different letter cannot be read as itself.
const CONFUSABLE: Array<[string, string]> = [["M", "H"], ["V", "U"], ["W", "H"], ["O", "Q"], ["I", "L"]];
for (const fontName of Object.keys(fonts)) {
  for (const [a, b] of CONFUSABLE) {
    test(`${fontName} "${a}" is not the same glyph as "${b}"`, () => {
      const artA = renderBanner(a, { font: fontName }).map(l => l.trimEnd()).join("\n");
      const artB = renderBanner(b, { font: fontName }).map(l => l.trimEnd()).join("\n");
      if (artA === artB) throw new Error(`${a} and ${b} render identically`);
    });
  }
}

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
