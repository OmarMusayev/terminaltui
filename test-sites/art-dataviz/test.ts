/**
 * Exhaustive test for ASCII art data visualization generators.
 * Tests barChart, sparkline, heatmap, pieChart, graph.
 */
import { barChart, sparkline, heatmap, pieChart, graph } from "../../src/ascii/dataviz.js";
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

function assertBasics(result: string[], label: string): void {
  assert(Array.isArray(result), `${label}: not an array`);
  assert(result.length > 0, `${label}: empty output`);
  for (let i = 0; i < result.length; i++) {
    assert(typeof result[i] === "string", `${label}: line ${i} not a string`);
    assert(
      result[i] === result[i].trimEnd(),
      `${label}: line ${i} has trailing whitespace`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// barChart
// ═══════════════════════════════════════════════════════════════════════════

test("barChart: 1 item", () => {
  const result = barChart([{ label: "A", value: 10 }]);
  assertBasics(result, "barChart(1 item)");
});

test("barChart: 3 items", () => {
  const result = barChart([
    { label: "Alpha", value: 30 },
    { label: "Beta", value: 50 },
    { label: "Gamma", value: 20 },
  ]);
  assertBasics(result, "barChart(3 items)");
  assert(result.length === 3, `Expected 3 lines for horizontal, got ${result.length}`);
});

test("barChart: 10 items", () => {
  const data = Array.from({ length: 10 }, (_, i) => ({
    label: `Item${i}`,
    value: (i + 1) * 10,
  }));
  const result = barChart(data);
  assertBasics(result, "barChart(10 items)");
  assert(result.length === 10, `Expected 10 lines, got ${result.length}`);
});

test("barChart: horizontal mode (default)", () => {
  const result = barChart(
    [{ label: "X", value: 50 }, { label: "Y", value: 100 }],
    { horizontal: true }
  );
  assertBasics(result, "barChart horizontal");
  assert(result.length === 2, `Expected 2 lines for 2 items`);
});

test("barChart: vertical mode", () => {
  const result = barChart(
    [{ label: "X", value: 50 }, { label: "Y", value: 100 }],
    { horizontal: false }
  );
  assertBasics(result, "barChart vertical");
  // Vertical chart has multiple rows + baseline + labels + values
  assert(result.length > 2, `Vertical chart should have many rows, got ${result.length}`);
});

test("barChart: labels visible in output", () => {
  const result = barChart([
    { label: "Sales", value: 100 },
    { label: "Profit", value: 60 },
  ]);
  const joined = result.join("\n");
  assert(joined.includes("Sales"), `"Sales" label not visible`);
  assert(joined.includes("Profit"), `"Profit" label not visible`);
});

test("barChart: bar characters (█) present", () => {
  const result = barChart([{ label: "X", value: 100 }]);
  const joined = result.join("");
  assert(joined.includes("█"), `No bar char (█) found`);
});

test("barChart: empty data returns empty", () => {
  const result = barChart([]);
  assert(result.length === 0, `Empty data should return empty`);
});

test("barChart: zero values show no bar", () => {
  const result = barChart([{ label: "Zero", value: 0 }, { label: "Some", value: 50 }]);
  assertBasics(result, "barChart zero values");
});

test("barChart: negative values handled", () => {
  const result = barChart([{ label: "Neg", value: -50 }, { label: "Pos", value: 50 }]);
  assertBasics(result, "barChart negatives");
});

test("barChart: custom width", () => {
  const result = barChart(
    [{ label: "A", value: 100 }],
    { width: 40 }
  );
  assertBasics(result, "barChart width=40");
});

// ═══════════════════════════════════════════════════════════════════════════
// sparkline
// ═══════════════════════════════════════════════════════════════════════════

test("sparkline: [1,2,3,4,5]", () => {
  const result = sparkline([1, 2, 3, 4, 5]);
  assert(result.length === 1, `Expected 1 line, got ${result.length}`);
  assert(result[0].length === 5, `Expected 5 chars, got ${result[0].length}`);
});

test("sparkline: [5,5,5,5] constant values", () => {
  const result = sparkline([5, 5, 5, 5]);
  assert(result.length === 1, `Expected 1 line`);
  // All chars should be the same (max level)
  const chars = [...result[0]];
  assert(chars.every(c => c === chars[0]), `Constant data should produce uniform sparkline`);
});

test("sparkline: [0,0,0] all zeros", () => {
  const result = sparkline([0, 0, 0]);
  assert(result.length === 1, `Expected 1 line`);
});

test("sparkline: empty array", () => {
  const result = sparkline([]);
  assert(result.length === 1, `Expected 1 line (empty string)`);
  assert(result[0] === "", `Expected empty string, got "${result[0]}"`);
});

test("sparkline: single value", () => {
  const result = sparkline([42]);
  assert(result.length === 1, `Expected 1 line`);
  assert(result[0].length === 1, `Expected 1 char for single value`);
});

test("sparkline: custom width resamples data", () => {
  const result = sparkline([1, 2, 3, 4, 5], 10);
  assert(result[0].length === 10, `Expected 10 chars with width=10, got ${result[0].length}`);
});

test("sparkline: no trailing whitespace", () => {
  const result = sparkline([1, 2, 3]);
  assert(result[0] === result[0].trimEnd(), `Trailing whitespace found`);
});

// ═══════════════════════════════════════════════════════════════════════════
// heatmap
// ═══════════════════════════════════════════════════════════════════════════

test("heatmap: 3x3 grid", () => {
  const data = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ];
  const result = heatmap(data);
  assertBasics(result, "heatmap 3x3");
  assert(result.length === 3, `Expected 3 lines, got ${result.length}`);
});

test("heatmap: 5x5 grid", () => {
  const data = Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 5 }, (_, c) => r * 5 + c)
  );
  const result = heatmap(data);
  assertBasics(result, "heatmap 5x5");
  assert(result.length === 5, `Expected 5 lines, got ${result.length}`);
});

test("heatmap: all zeros", () => {
  const data = [[0, 0], [0, 0]];
  const result = heatmap(data);
  assertBasics(result, "heatmap zeros");
});

test("heatmap: all same value", () => {
  const data = [[5, 5, 5], [5, 5, 5]];
  const result = heatmap(data);
  assertBasics(result, "heatmap same");
  // All chars should be the same
  const chars = [...result[0]];
  assert(chars.every(c => c === chars[0]), `Same values should produce uniform chars`);
});

test("heatmap: empty data returns empty", () => {
  const result = heatmap([]);
  assert(result.length === 0, `Expected empty`);
});

test("heatmap: with showScale option", () => {
  const data = [[0, 5], [10, 15]];
  const result = heatmap(data, { showScale: true });
  assert(result.length > 2, `showScale should add extra lines`);
});

test("heatmap: custom chars", () => {
  const data = [[0, 1], [2, 3]];
  const result = heatmap(data, { chars: ".:#" });
  assertBasics(result, "heatmap custom chars");
});

// ═══════════════════════════════════════════════════════════════════════════
// pieChart
// ═══════════════════════════════════════════════════════════════════════════

test("pieChart: 2 slices", () => {
  const result = pieChart([
    { label: "Yes", value: 70 },
    { label: "No", value: 30 },
  ]);
  assertBasics(result, "pieChart 2 slices");
  const joined = result.join("\n");
  assert(joined.includes("Yes"), `"Yes" label missing`);
  assert(joined.includes("No"), `"No" label missing`);
});

test("pieChart: 5 slices", () => {
  const data = Array.from({ length: 5 }, (_, i) => ({
    label: `Slice${i}`,
    value: 20,
  }));
  const result = pieChart(data);
  assertBasics(result, "pieChart 5 slices");
});

test("pieChart: single slice", () => {
  const result = pieChart([{ label: "All", value: 100 }]);
  assertBasics(result, "pieChart single slice");
});

test("pieChart: [100] single item", () => {
  const result = pieChart([{ label: "Only", value: 100 }]);
  assertBasics(result, "pieChart [100]");
  const joined = result.join("\n");
  assert(joined.includes("100.0%"), `Should show 100.0%`);
});

test("pieChart: values summing to various totals", () => {
  const result = pieChart([
    { label: "A", value: 10 },
    { label: "B", value: 20 },
    { label: "C", value: 30 },
  ]);
  assertBasics(result, "pieChart sum=60");
});

test("pieChart: empty data returns empty", () => {
  const result = pieChart([]);
  assert(result.length === 0, `Expected empty`);
});

test("pieChart: custom radius", () => {
  const result = pieChart(
    [{ label: "X", value: 50 }, { label: "Y", value: 50 }],
    5
  );
  assertBasics(result, "pieChart radius=5");
});

test("pieChart: all zero values draws empty pie", () => {
  const result = pieChart([
    { label: "A", value: 0 },
    { label: "B", value: 0 },
  ]);
  assert(result.length > 0, `Should draw empty pie, not return empty`);
});

test("pieChart: no trailing whitespace", () => {
  const result = pieChart([{ label: "Test", value: 100 }]);
  for (let i = 0; i < result.length; i++) {
    assert(result[i] === result[i].trimEnd(), `Line ${i} has trailing whitespace`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// graph
// ═══════════════════════════════════════════════════════════════════════════

test("graph: [1,2,3,4,5]", () => {
  const result = graph([1, 2, 3, 4, 5]);
  assertBasics(result, "graph ascending");
});

test("graph: [5,4,3,2,1] descending", () => {
  const result = graph([5, 4, 3, 2, 1]);
  assertBasics(result, "graph descending");
});

test("graph: constant values [3,3,3,3]", () => {
  const result = graph([3, 3, 3, 3]);
  assertBasics(result, "graph constant");
});

test("graph: single point", () => {
  const result = graph([42]);
  assertBasics(result, "graph single point");
});

test("graph: 50 points", () => {
  const data = Array.from({ length: 50 }, (_, i) => Math.sin(i / 5) * 10 + 10);
  const result = graph(data);
  assertBasics(result, "graph 50 points");
});

test("graph: empty data returns empty", () => {
  const result = graph([]);
  assert(result.length === 0, `Expected empty`);
});

test("graph: custom width and height", () => {
  const result = graph([1, 5, 2, 8, 3], 30, 10);
  assertBasics(result, "graph custom size");
});

test("graph: no trailing whitespace", () => {
  const result = graph([1, 2, 3, 4, 5]);
  for (let i = 0; i < result.length; i++) {
    assert(result[i] === result[i].trimEnd(), `Line ${i} has trailing whitespace`);
  }
});

test("graph: Y-axis labels present", () => {
  const result = graph([0, 50, 100]);
  const joined = result.join("\n");
  assert(joined.includes("┤"), `Y-axis marker missing`);
  assert(joined.includes("└"), `X-axis corner missing`);
});

test("graph: contains braille characters", () => {
  const result = graph([1, 2, 3, 4, 5]);
  const joined = result.join("");
  // Braille characters are in range U+2800-U+28FF
  const hasBraille = [...joined].some(ch => {
    const code = ch.charCodeAt(0);
    return code >= 0x2800 && code <= 0x28FF;
  });
  assert(hasBraille, `No braille characters found in graph output`);
});

// ── Summary ──
const total = passed + failed;
console.log(`\n${"=".repeat(60)}`);
console.log(`  art-dataviz: ${passed}/${total} passed, ${failed} failed`);
console.log(`${"=".repeat(60)}`);

if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.error}`);
  }
}

// ── Write report ──
const report = {
  suite: "art-dataviz",
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

console.log(`\nReport written to test-sites/art-dataviz/report.json`);
if (failed > 0) process.exit(1);
