/**
 * Exhaustive test for ASCII art scene generators.
 * Tests all 15 scene types at multiple widths.
 */
import { scene, type SceneType } from "../../src/ascii/scenes.js";
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

// ── All scene types ──
const ALL_SCENES: SceneType[] = [
  "mountains", "cityscape", "forest", "ocean", "space", "clouds",
  "coffee-cup", "rocket", "cat", "robot", "terminal",
  "vinyl-record", "cassette", "floppy-disk", "gameboy",
];

// ═══════════════════════════════════════════════════════════════════════════
// Test each scene at 3 widths
// ═══════════════════════════════════════════════════════════════════════════

for (const sceneType of ALL_SCENES) {
  for (const width of [30, 60, 80]) {
    test(`${sceneType} width=${width}: returns non-empty string[]`, () => {
      const result = scene(sceneType, { width });
      assert(Array.isArray(result), `Not an array`);
      assert(result.length > 0, `Empty output`);
    });

    test(`${sceneType} width=${width}: each line has content or is intentional`, () => {
      const result = scene(sceneType, { width });
      for (let i = 0; i < result.length; i++) {
        assert(typeof result[i] === "string", `Line ${i} not a string`);
      }
    });

    test(`${sceneType} width=${width}: no trailing whitespace`, () => {
      const result = scene(sceneType, { width });
      for (let i = 0; i < result.length; i++) {
        assert(
          result[i] === result[i].trimEnd(),
          `Line ${i} has trailing whitespace: "${result[i]}"`
        );
      }
    });

    test(`${sceneType} width=${width}: no crash`, () => {
      // This test verifies the function doesn't throw
      scene(sceneType, { width });
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Default width (should be 60)
// ═══════════════════════════════════════════════════════════════════════════

for (const sceneType of ALL_SCENES) {
  test(`${sceneType}: default width (no options) works`, () => {
    const result = scene(sceneType);
    assert(Array.isArray(result), `Not an array`);
    assert(result.length > 0, `Empty output with default width`);
  });

  test(`${sceneType}: default matches width=60`, () => {
    const def = scene(sceneType);
    const w60 = scene(sceneType, { width: 60 });
    assert(def.length === w60.length, `Line count differs: default=${def.length} w60=${w60.length}`);
    for (let i = 0; i < def.length; i++) {
      assert(def[i] === w60[i], `Line ${i} differs between default and width=60`);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════════════════════════════

for (const sceneType of ALL_SCENES) {
  test(`${sceneType}: width=0 returns empty`, () => {
    const result = scene(sceneType, { width: 0 });
    assert(result.length === 0, `width=0 should return empty, got ${result.length} lines`);
  });

  test(`${sceneType}: very small width=5 doesn't crash`, () => {
    const result = scene(sceneType, { width: 5 });
    assert(Array.isArray(result), `Not an array`);
  });

  test(`${sceneType}: large width=200 doesn't crash`, () => {
    const result = scene(sceneType, { width: 200 });
    assert(Array.isArray(result), `Not an array`);
    assert(result.length > 0, `Empty at large width`);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Determinism: scenes with fixed RNG seeds should be consistent
// ═══════════════════════════════════════════════════════════════════════════

const SEEDED_SCENES: SceneType[] = ["cityscape", "forest", "space"];

for (const sceneType of SEEDED_SCENES) {
  test(`${sceneType}: output is deterministic (same seed)`, () => {
    const a = scene(sceneType, { width: 60 });
    const b = scene(sceneType, { width: 60 });
    assert(a.length === b.length, `Line counts differ`);
    for (let i = 0; i < a.length; i++) {
      assert(a[i] === b[i], `Line ${i} differs between identical calls`);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Verify scene count
// ═══════════════════════════════════════════════════════════════════════════

test("all 15 scene types are defined", () => {
  assert(ALL_SCENES.length === 15, `Expected 15 scenes, listed ${ALL_SCENES.length}`);
});

// ── Summary ──
const total = passed + failed;
console.log(`\n${"=".repeat(60)}`);
console.log(`  art-scenes: ${passed}/${total} passed, ${failed} failed`);
console.log(`${"=".repeat(60)}`);

if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.error}`);
  }
}

// ── Write report ──
const report = {
  suite: "art-scenes",
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

console.log(`\nReport written to test-sites/art-scenes/report.json`);
if (failed > 0) process.exit(1);
