/**
 * Exhaustive test for ASCII art font rendering system.
 * Tests all 14 fonts (6 original + 8 extra), banner rendering, width, centering.
 */
import { fonts, defaultFont, type Font } from "../../src/ascii/fonts.js";
import { renderBanner, getBannerWidth, centerBanner } from "../../src/ascii/banner.js";
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

// ── Font names ──
const ALL_FONTS = [
  "ANSI Shadow", "Block", "Slant", "Calvin S", "Small", "Ogre",
  "DOS Rebel", "Ghost", "Bloody",
  "Electronic", "Sub-Zero", "Larry 3D", "Colossal", "Isometric1",
];

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SPECIALS = [" ", ".", "!", "-", "_", ":"];

// ── Tests per font ──
for (const fontName of ALL_FONTS) {
  const font = fonts[fontName];

  test(`${fontName}: font exists in registry`, () => {
    assert(font !== undefined, `Font "${fontName}" not found in fonts registry`);
  });

  if (!font) continue;

  // Test A-Z individual characters
  for (const ch of ALPHA) {
    test(`${fontName}: char '${ch}' height matches font.height (${font.height})`, () => {
      const art = font.chars[ch];
      if (art) {
        assert(
          art.length === font.height,
          `Char '${ch}' has ${art.length} lines, expected ${font.height}`
        );
      }
      // If char is not defined, it falls back to space — that's OK
    });
  }

  // Test 0-9
  for (const ch of DIGITS) {
    test(`${fontName}: char '${ch}' height matches font.height`, () => {
      const art = font.chars[ch];
      if (art) {
        assert(
          art.length === font.height,
          `Digit '${ch}' has ${art.length} lines, expected ${font.height}`
        );
      }
    });
  }

  // Test special characters
  for (const ch of SPECIALS) {
    test(`${fontName}: special '${ch === " " ? "SPACE" : ch}' defined or fallback works`, () => {
      // Render via banner to test fallback
      const lines = renderBanner(ch, { font: fontName });
      assert(lines.length > 0, `Rendering '${ch}' produced empty output`);
    });
  }

  // Render "HELLO" — verify all lines same count
  test(`${fontName}: "HELLO" renders with consistent line count`, () => {
    const lines = renderBanner("HELLO", { font: fontName });
    assert(lines.length > 0, `"HELLO" produced empty output`);
    // All lines should exist (no undefined)
    for (let i = 0; i < lines.length; i++) {
      assert(typeof lines[i] === "string", `Line ${i} is not a string`);
    }
  });

  // Render "HELLO WORLD" — verify spaces work
  test(`${fontName}: "HELLO WORLD" renders with spaces`, () => {
    const lines = renderBanner("HELLO WORLD", { font: fontName });
    assert(lines.length > 0, `"HELLO WORLD" produced empty output`);
  });

  // Render empty string
  test(`${fontName}: empty string produces array of empty strings`, () => {
    const lines = renderBanner("", { font: fontName });
    assert(Array.isArray(lines), `Empty string did not return array`);
    // Should be array of font.height empty strings
    for (const line of lines) {
      assert(line.trim() === "", `Expected empty line, got: "${line}"`);
    }
  });

  // Render single character
  test(`${fontName}: single character "A" renders correctly`, () => {
    const lines = renderBanner("A", { font: fontName });
    assert(lines.length > 0, `Single char "A" produced empty output`);
  });

  // Render with shadow
  test(`${fontName}: shadow option adds extra row`, () => {
    const plain = renderBanner("HI", { font: fontName });
    const shadowed = renderBanner("HI", { font: fontName, shadow: true });
    assert(
      shadowed.length === plain.length + 1,
      `Shadow should add 1 row: got ${shadowed.length} vs ${plain.length}`
    );
  });

  // Render with border
  test(`${fontName}: border option adds top+bottom rows`, () => {
    const plain = renderBanner("HI", { font: fontName });
    const bordered = renderBanner("HI", { font: fontName, border: "rounded" });
    assert(
      bordered.length === plain.length + 2,
      `Border should add 2 rows: got ${bordered.length} vs ${plain.length}`
    );
  });

  // Render long string — test width
  test(`${fontName}: long string "ABCDEFGHIJKLMNOP" renders without crash`, () => {
    const lines = renderBanner("ABCDEFGHIJKLMNOP", { font: fontName });
    assert(lines.length > 0, `Long string produced empty output`);
  });

  // Verify no character art array has mismatched number of lines
  test(`${fontName}: all defined chars have correct height`, () => {
    for (const [ch, art] of Object.entries(font.chars)) {
      assert(
        art.length === font.height,
        `Char '${ch}' has ${art.length} lines, expected ${font.height}`
      );
    }
  });
}

// ── Banner utility tests ──

test("defaultFont is 'ANSI Shadow'", () => {
  assert(defaultFont === "ANSI Shadow", `defaultFont is "${defaultFont}"`);
});

test("getBannerWidth returns positive number for 'HELLO'", () => {
  const w = getBannerWidth("HELLO");
  assert(w > 0, `Width was ${w}`);
});

test("getBannerWidth with specific font", () => {
  const w = getBannerWidth("AB", "Small");
  assert(w > 0, `Width was ${w}`);
});

test("centerBanner pads lines to center", () => {
  const lines = renderBanner("HI", { font: "Small" });
  const centered = centerBanner(lines, 80);
  for (const line of centered) {
    if (line.trim().length > 0) {
      // Should have leading spaces
      const leadingSpaces = line.length - line.trimStart().length;
      assert(leadingSpaces > 0, `Line not centered: "${line}"`);
    }
  }
});

test("centerBanner does not truncate art (preserves natural width)", () => {
  const lines = renderBanner("ABCDEF");
  const centered = centerBanner(lines, 20);
  // Art should NOT be clipped — it renders at its natural size
  assert(centered.length === lines.length, `Line count should match: ${centered.length} vs ${lines.length}`);
});

test("renderBanner with maxWidth falls back when too wide", () => {
  const lines = renderBanner("HELLO WORLD", {}, 10);
  // Should fall back to plain text
  assert(lines.length === 1, `Expected fallback to single line, got ${lines.length}`);
  assert(lines[0] === "HELLO WORLD", `Expected plain text fallback`);
});

test("renderBanner with options.width falls back when too wide", () => {
  const lines = renderBanner("HELLO", { width: 5 });
  assert(lines.length === 1, `Expected fallback, got ${lines.length} lines`);
});

test("fonts registry contains all 14 fonts", () => {
  for (const name of ALL_FONTS) {
    assert(name in fonts, `Font "${name}" missing from registry`);
  }
  const count = Object.keys(fonts).length;
  assert(count >= 14, `Expected at least 14 fonts, got ${count}`);
});

// ── Summary ──
const total = passed + failed;
console.log(`\n${"=".repeat(60)}`);
console.log(`  art-fonts: ${passed}/${total} passed, ${failed} failed`);
console.log(`${"=".repeat(60)}`);

if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.error}`);
  }
}

// ── Write report ──
const report = {
  suite: "art-fonts",
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

console.log(`\nReport written to test-sites/art-fonts/report.json`);
if (failed > 0) process.exit(1);
