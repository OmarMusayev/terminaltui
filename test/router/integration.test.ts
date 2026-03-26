/**
 * Integration test — loads a real file-based demo and verifies the full pipeline.
 */
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { loadFileBasedConfig } from "../../src/router/page-loader.js";
import { FileRouter } from "../../src/router/resolver.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { passed++; } else { failed++; console.error(`  FAIL: ${name}`); }
}
function assertEqual(actual: any, expected: any, name: string) {
  if (actual === expected) { passed++; } else { failed++; console.error(`  FAIL: ${name} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

const projectDir = "demos/developer-portfolio";
const outDir = join(projectDir, ".terminaltui");
mkdirSync(outDir, { recursive: true });

// ─── Load config ──────────────────────────────────────────

console.log("\x1b[1m  Load file-based config\x1b[0m");

const config = await loadFileBasedConfig(join(projectDir, "config.ts"), outDir);
assert(config.name !== undefined, "config has name");
console.log(`    Config: ${config.name} (${config.theme})`);

// ─── Initialize router ───────────────────────────────────

console.log("\x1b[1m  Initialize FileRouter\x1b[0m");

const router = new FileRouter({
  config,
  pagesDir: join(projectDir, "pages"),
  outDir,
});
await router.initialize();

const names = router.getAllRouteNames();
assert(names.length > 0, "found routes");
console.log(`    Routes: ${names.join(", ")}`);

// ─── Menu generation ──────────────────────────────────────

console.log("\x1b[1m  Menu generation\x1b[0m");

const menu = router.getMenuItems();
assert(menu.length > 0, "menu has items");
console.log(`    Menu: ${menu.map(m => m.label).join(", ")}`);

// Verify all menu items map to valid routes
for (const item of menu) {
  assert(names.includes(item.page), `menu item "${item.label}" maps to route "${item.page}"`);
}

// ─── Build pages array ───────────────────────────────────

console.log("\x1b[1m  Build pages array\x1b[0m");

const pages = await router.buildPagesArray();
assert(pages.length > 0, "pages array has entries");
assertEqual(pages.length, names.length, "pages count matches routes count");

for (const p of pages) {
  assert(typeof p.id === "string", `page ${p.id} has string id`);
  assert(typeof p.title === "string", `page ${p.id} has string title`);
  assert(typeof p.content === "function", `page ${p.id} has async content loader`);
}

// ─── Execute a page function ─────────────────────────────

console.log("\x1b[1m  Execute page function\x1b[0m");

const firstPage = pages[0];
const content = await (firstPage.content as () => Promise<any[]>)();
assert(Array.isArray(content), `page "${firstPage.id}" returns array`);
assert(content.length > 0, `page "${firstPage.id}" returns content blocks`);
console.log(`    Page "${firstPage.id}": ${content.length} blocks`);

// Check all pages render
for (const p of pages) {
  try {
    const c = await (p.content as () => Promise<any[]>)();
    assert(Array.isArray(c), `page "${p.id}" renders to array`);
    assert(c.length > 0, `page "${p.id}" has content`);
  } catch (e: any) {
    failed++;
    console.error(`  FAIL: page "${p.id}" threw: ${e.message}`);
  }
}

// ─── Results ──────────────────────────────────────────────
console.log("");
if (failed > 0) {
  console.log(`  \x1b[31m${passed} passed, ${failed} failed\x1b[0m`);
  process.exit(1);
} else {
  console.log(`  \x1b[32m${passed} passed\x1b[0m, 0 failed`);
}
