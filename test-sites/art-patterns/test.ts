/**
 * Exhaustive test for ASCII art pattern generators.
 * Tests all 12 pattern types, dimensions, density, seed, and edge cases.
 */
import { pattern, type PatternType } from "../../src/ascii/patterns.js";
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

// ── All pattern types ──
const ALL_PATTERNS: PatternType[] = [
  "dots", "crosshatch", "diagonal", "waves", "bricks", "circuit",
  "rain", "stars", "confetti", "static", "braille-dots", "grid",
];

// ═══════════════════════════════════════════════════════════════════════════
// Test each pattern at 3 sizes
// ═══════════════════════════════════════════════════════════════════════════

for (const pType of ALL_PATTERNS) {
  for (const [w, h] of [[10, 5], [40, 10], [80, 20]]) {
    test(`${pType} ${w}x${h}: correct dimensions`, () => {
      const result = pattern(w, h, pType);
      assert(Array.isArray(result), `Not an array`);
      assert(result.length === h, `Expected ${h} lines, got ${result.length}`);
      for (let i = 0; i < result.length; i++) {
        assert(typeof result[i] === "string", `Line ${i} not a string`);
      }
    });

    test(`${pType} ${w}x${h}: no trailing whitespace`, () => {
      const result = pattern(w, h, pType);
      for (let i = 0; i < result.length; i++) {
        assert(
          result[i] === result[i].trimEnd(),
          `Line ${i} has trailing whitespace`
        );
      }
    });

    test(`${pType} ${w}x${h}: non-empty output`, () => {
      const result = pattern(w, h, pType);
      assert(result.length > 0, `Empty output`);
      // At least one line should have content
      const hasContent = result.some(l => l.length > 0);
      assert(hasContent, `All lines are empty`);
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Seed parameter: same seed produces same output
// ═══════════════════════════════════════════════════════════════════════════

const RANDOM_PATTERNS: PatternType[] = ["circuit", "rain", "stars", "confetti", "static", "braille-dots"];

for (const pType of RANDOM_PATTERNS) {
  test(`${pType}: same seed produces identical output`, () => {
    const a = pattern(20, 5, pType, { seed: 12345 });
    const b = pattern(20, 5, pType, { seed: 12345 });
    assert(a.length === b.length, `Different line counts`);
    for (let i = 0; i < a.length; i++) {
      assert(a[i] === b[i], `Line ${i} differs with same seed`);
    }
  });

  test(`${pType}: different seeds produce different output`, () => {
    const a = pattern(20, 5, pType, { seed: 11111 });
    const b = pattern(20, 5, pType, { seed: 99999 });
    // At least one line should differ
    let allSame = true;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) { allSame = false; break; }
    }
    assert(!allSame, `Different seeds produced identical output`);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Density parameter for rain/stars/confetti
// ═══════════════════════════════════════════════════════════════════════════

const DENSITY_PATTERNS: PatternType[] = ["rain", "stars", "confetti"];

for (const pType of DENSITY_PATTERNS) {
  for (const density of [0.1, 0.5, 1.0]) {
    test(`${pType} density=${density}: renders without crash`, () => {
      const result = pattern(30, 10, pType, { density, seed: 42 });
      assert(result.length === 10, `Expected 10 lines, got ${result.length}`);
    });
  }

  test(`${pType}: higher density produces more non-space chars`, () => {
    const low = pattern(40, 10, pType, { density: 0.1, seed: 42 });
    const high = pattern(40, 10, pType, { density: 1.0, seed: 42 });
    const countNonSpace = (lines: string[]) =>
      lines.reduce((c, l) => c + [...l].filter(ch => ch !== " ").length, 0);
    const lowCount = countNonSpace(low);
    const highCount = countNonSpace(high);
    assert(
      highCount >= lowCount,
      `density=1.0 (${highCount}) should have >= chars than density=0.1 (${lowCount})`
    );
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════════════════════════════

for (const pType of ALL_PATTERNS) {
  test(`${pType}: width=0 returns empty`, () => {
    const result = pattern(0, 5, pType);
    assert(result.length === 0, `width=0 should return empty, got ${result.length} lines`);
  });

  test(`${pType}: height=0 returns empty`, () => {
    const result = pattern(5, 0, pType);
    assert(result.length === 0, `height=0 should return empty, got ${result.length} lines`);
  });

  test(`${pType}: width=1 height=1 renders without crash`, () => {
    const result = pattern(1, 1, pType);
    assert(result.length === 1, `1x1 should have 1 line, got ${result.length}`);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Verify deterministic patterns produce exact dimensions
// ═══════════════════════════════════════════════════════════════════════════

const DETERMINISTIC: PatternType[] = ["dots", "crosshatch", "diagonal", "waves", "bricks", "grid"];

for (const pType of DETERMINISTIC) {
  test(`${pType}: default seed is consistent`, () => {
    const a = pattern(15, 5, pType);
    const b = pattern(15, 5, pType);
    assert(a.length === b.length, `Line counts differ`);
    for (let i = 0; i < a.length; i++) {
      assert(a[i] === b[i], `Line ${i} differs between identical calls`);
    }
  });
}

// ── Summary ──
const total = passed + failed;
console.log(`\n${"=".repeat(60)}`);
console.log(`  art-patterns: ${passed}/${total} passed, ${failed} failed`);
console.log(`${"=".repeat(60)}`);

if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.error}`);
  }
}

// ── Write report ──
const report = {
  suite: "art-patterns",
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

console.log(`\nReport written to test-sites/art-patterns/report.json`);
if (failed > 0) process.exit(1);
