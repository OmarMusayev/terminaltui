/**
 * Exhaustive test for ASCII art shape generators.
 * Tests all shape functions: box, circle, diamond, triangle, heart, star, arrow, hexagon, line.
 */
import {
  box, circle, diamond, triangle, heart, star, arrow, hexagon, line,
} from "../../src/ascii/shapes.js";
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
      `${label}: line ${i} has trailing whitespace: "${result[i]}"`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BOX
// ═══════════════════════════════════════════════════════════════════════════

const BOX_STYLES = ["single", "double", "rounded", "heavy", "ascii"] as const;

for (const style of BOX_STYLES) {
  for (const [w, h] of [[3, 3], [5, 5], [10, 10], [20, 10]]) {
    test(`box ${w}x${h} style=${style}: renders correctly`, () => {
      const result = box(w, h, style);
      assertBasics(result, `box(${w},${h},${style})`);
      assert(result.length === h, `Expected ${h} lines, got ${result.length}`);
    });
  }
}

test("box: 0 or negative returns empty", () => {
  assert(box(0, 5).length === 0, "box(0,5) not empty");
  assert(box(5, 0).length === 0, "box(5,0) not empty");
  assert(box(-1, 5).length === 0, "box(-1,5) not empty");
});

test("box: 1x1 returns single char", () => {
  const result = box(1, 1);
  assert(result.length === 1, "box(1,1) should have 1 line");
});

test("box: height=1 returns single horizontal line", () => {
  const result = box(5, 1);
  assert(result.length === 1, "box(5,1) should have 1 line");
});

// ═══════════════════════════════════════════════════════════════════════════
// CIRCLE
// ═══════════════════════════════════════════════════════════════════════════

for (const r of [2, 3, 5, 8, 10]) {
  test(`circle radius=${r}: renders non-empty`, () => {
    const result = circle(r);
    assertBasics(result, `circle(${r})`);
  });
}

test("circle: radius=0 returns empty", () => {
  assert(circle(0).length === 0, "circle(0) not empty");
});

test("circle: radius=1 returns special case", () => {
  const result = circle(1);
  assert(result.length > 0, "circle(1) empty");
});

test("circle: with fill char", () => {
  const result = circle(3, "#");
  assertBasics(result, "circle(3, '#')");
});

// ═══════════════════════════════════════════════════════════════════════════
// DIAMOND
// ═══════════════════════════════════════════════════════════════════════════

for (const size of [2, 3, 5, 8]) {
  test(`diamond size=${size}: renders correctly`, () => {
    const result = diamond(size);
    assertBasics(result, `diamond(${size})`);
    assert(result.length === size * 2, `Expected ${size * 2} lines, got ${result.length}`);
  });
}

test("diamond: size=0 returns empty", () => {
  assert(diamond(0).length === 0, "diamond(0) not empty");
});

test("diamond: size=1 special case", () => {
  const result = diamond(1);
  assert(result.length > 0, "diamond(1) empty");
  assert(result.length === 2, "diamond(1) should have 2 lines");
});

test("diamond: with fill char", () => {
  const result = diamond(3, "*");
  assertBasics(result, "diamond(3, '*')");
});

// ═══════════════════════════════════════════════════════════════════════════
// TRIANGLE
// ═══════════════════════════════════════════════════════════════════════════

const TRI_DIRS: Array<"up" | "down" | "left" | "right"> = ["up", "down", "left", "right"];

for (const dir of TRI_DIRS) {
  for (const size of [3, 5, 8]) {
    test(`triangle size=${size} dir=${dir}: renders correctly`, () => {
      const result = triangle(size, dir);
      assertBasics(result, `triangle(${size}, ${dir})`);
    });
  }
}

test("triangle: size=0 returns empty", () => {
  assert(triangle(0).length === 0, "triangle(0) not empty");
});

test("triangle: size=1 returns single char", () => {
  const result = triangle(1);
  assert(result.length === 1, `Expected 1 line, got ${result.length}`);
});

test("triangle: default direction is up", () => {
  const def = triangle(5);
  const up = triangle(5, "up");
  assert(def.length === up.length, "Default should be same as 'up'");
  for (let i = 0; i < def.length; i++) {
    assert(def[i] === up[i], `Line ${i} differs`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// HEART
// ═══════════════════════════════════════════════════════════════════════════

for (const size of [3, 5, 7]) {
  test(`heart size=${size}: renders non-empty`, () => {
    const result = heart(size);
    assertBasics(result, `heart(${size})`);
  });
}

test("heart: size=0 returns empty", () => {
  assert(heart(0).length === 0, "heart(0) not empty");
});

test("heart: size<3 clamps to 3", () => {
  const result = heart(1);
  const result3 = heart(3);
  assert(result.length === result3.length, "heart(1) should clamp to heart(3)");
});

test("heart: size>10 clamps to 10", () => {
  const result = heart(15);
  const result10 = heart(10);
  assert(result.length === result10.length, "heart(15) should clamp to heart(10)");
});

// ═══════════════════════════════════════════════════════════════════════════
// STAR
// ═══════════════════════════════════════════════════════════════════════════

test("star: 5 points, r=3", () => {
  const result = star(5, 3);
  assertBasics(result, "star(5, 3)");
});

test("star: 5 points, r=5", () => {
  const result = star(5, 5);
  assertBasics(result, "star(5, 5)");
});

test("star: 6 points, r=5", () => {
  const result = star(6, 5);
  assertBasics(result, "star(6, 5)");
});

test("star: r=1 returns single char", () => {
  const result = star(5, 1);
  assert(result.length === 1, "star(5,1) should be single char");
});

test("star: r=0 returns empty", () => {
  assert(star(5, 0).length === 0, "star(5,0) not empty");
});

test("star: points<2 returns empty", () => {
  assert(star(1, 5).length === 0, "star(1,5) not empty");
});

test("star: custom inner radius", () => {
  const result = star(5, 5, 2);
  assertBasics(result, "star(5, 5, 2)");
});

// ═══════════════════════════════════════════════════════════════════════════
// ARROW
// ═══════════════════════════════════════════════════════════════════════════

const ARROW_DIRS: Array<"up" | "down" | "left" | "right"> = ["up", "down", "left", "right"];
const ARROW_STYLES: Array<"thin" | "thick" | "double"> = ["thin", "thick", "double"];

for (const dir of ARROW_DIRS) {
  for (const len of [3, 5, 10]) {
    for (const style of ARROW_STYLES) {
      test(`arrow dir=${dir} len=${len} style=${style}`, () => {
        const result = arrow(dir, len, style);
        assertBasics(result, `arrow(${dir}, ${len}, ${style})`);
        if (dir === "right" || dir === "left") {
          assert(result.length === 1, `Horizontal arrow should be 1 line, got ${result.length}`);
        } else {
          assert(result.length === len, `Vertical arrow should be ${len} lines, got ${result.length}`);
        }
      });
    }
  }
}

test("arrow: length=0 returns empty", () => {
  assert(arrow("right", 0).length === 0, "arrow len=0 not empty");
});

test("arrow: length=1 returns single char", () => {
  for (const dir of ARROW_DIRS) {
    const result = arrow(dir, 1);
    assert(result.length === 1, `arrow(${dir}, 1) should have 1 line`);
    assert(result[0].length === 1, `arrow(${dir}, 1) should be 1 char`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// HEXAGON
// ═══════════════════════════════════════════════════════════════════════════

for (const size of [3, 5]) {
  test(`hexagon size=${size}: renders non-empty`, () => {
    const result = hexagon(size);
    assertBasics(result, `hexagon(${size})`);
  });
}

test("hexagon: size=0 returns empty", () => {
  assert(hexagon(0).length === 0, "hexagon(0) not empty");
});

test("hexagon: size=1 returns special case", () => {
  const result = hexagon(1);
  assert(result.length > 0, "hexagon(1) empty");
});

// ═══════════════════════════════════════════════════════════════════════════
// LINE
// ═══════════════════════════════════════════════════════════════════════════

const LINE_STYLES: Array<"solid" | "dashed" | "dotted" | "double" | "wave" | "zigzag"> =
  ["solid", "dashed", "dotted", "double", "wave", "zigzag"];

for (const style of LINE_STYLES) {
  for (const len of [10, 20, 40]) {
    test(`line len=${len} style=${style}: renders correctly`, () => {
      const result = line(len, style);
      assertBasics(result, `line(${len}, ${style})`);
      assert(result.length === 1, `Line should be 1 row, got ${result.length}`);
    });
  }
}

test("line: length=0 returns empty", () => {
  assert(line(0).length === 0, "line(0) not empty");
});

test("line: default style is solid", () => {
  const def = line(10);
  const solid = line(10, "solid");
  assert(def[0] === solid[0], "Default should match solid");
});

// ── Summary ──
const total = passed + failed;
console.log(`\n${"=".repeat(60)}`);
console.log(`  art-shapes: ${passed}/${total} passed, ${failed} failed`);
console.log(`${"=".repeat(60)}`);

if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.error}`);
  }
}

// ── Write report ──
const report = {
  suite: "art-shapes",
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

console.log(`\nReport written to test-sites/art-shapes/report.json`);
if (failed > 0) process.exit(1);
