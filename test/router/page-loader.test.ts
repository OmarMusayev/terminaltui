/**
 * Page loader unit tests — module compilation and loading
 */
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { loadPageModule, loadLayoutModule, loadApiModule, loadFileBasedConfig, clearModuleCache } from "../../src/router/page-loader.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { passed++; } else { failed++; console.error(`  FAIL: ${name}`); }
}
function assertEqual(actual: any, expected: any, name: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; } else { failed++; console.error(`  FAIL: ${name} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

const tmpDir = join(process.cwd(), ".test-loader-tmp");
const outDir = join(tmpDir, ".terminaltui");

function setup() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });
  clearModuleCache();
}

function cleanup() {
  rmSync(tmpDir, { recursive: true, force: true });
}

// ─── loadPageModule ───────────────────────────────────────

console.log("\x1b[1m  loadPageModule\x1b[0m");

setup();
{
  // Create a simple page file
  const pagePath = join(tmpDir, "about.ts");
  writeFileSync(pagePath, `
    export const metadata = { label: "About", order: 2, icon: "?" };
    export default function About() {
      return [{ type: "text", content: "Hello from about" }];
    }
  `);

  try {
    const mod = await loadPageModule(pagePath, outDir);
    assert(typeof mod.default === "function", "default export is a function");
    assert(mod.metadata !== undefined, "metadata exported");
    assertEqual(mod.metadata?.label, "About", "metadata label = About");
    assertEqual(mod.metadata?.order, 2, "metadata order = 2");
    assertEqual(mod.metadata?.icon, "?", "metadata icon = ?");

    // Execute the page function
    const content = mod.default();
    assert(Array.isArray(content), "page function returns array");
    assertEqual(content.length, 1, "returns 1 block");
    assertEqual((content[0] as any).type, "text", "block type = text");
  } catch (e: any) {
    failed++;
    console.error(`  FAIL: loadPageModule threw: ${e.message}`);
  }
}

// ─── loadPageModule async ─────────────────────────────────

console.log("\x1b[1m  loadPageModule async\x1b[0m");
clearModuleCache();
{
  const pagePath = join(tmpDir, "async-page.ts");
  writeFileSync(pagePath, `
    export default async function AsyncPage() {
      return [{ type: "text", content: "async content" }];
    }
  `);

  try {
    const mod = await loadPageModule(pagePath, outDir);
    const content = await mod.default();
    assert(Array.isArray(content), "async page returns array");
    assertEqual((content[0] as any).content, "async content", "async content matches");
  } catch (e: any) {
    failed++;
    console.error(`  FAIL: async loadPageModule threw: ${e.message}`);
  }
}

// ─── loadPageModule with params ───────────────────────────

console.log("\x1b[1m  loadPageModule with params\x1b[0m");
clearModuleCache();
{
  const pagePath = join(tmpDir, "dynamic.ts");
  writeFileSync(pagePath, `
    export const metadata = { hidden: true };
    export default function Detail({ params }) {
      return [{ type: "text", content: "Item: " + params.id }];
    }
  `);

  try {
    const mod = await loadPageModule(pagePath, outDir);
    const content = mod.default({ params: { id: "42" } });
    assertEqual((content[0] as any).content, "Item: 42", "params passed correctly");
    assertEqual(mod.metadata?.hidden, true, "metadata hidden = true");
  } catch (e: any) {
    failed++;
    console.error(`  FAIL: params loadPageModule threw: ${e.message}`);
  }
}

// ─── loadLayoutModule ─────────────────────────────────────

console.log("\x1b[1m  loadLayoutModule\x1b[0m");
clearModuleCache();
{
  const layoutPath = join(tmpDir, "layout.ts");
  writeFileSync(layoutPath, `
    export default function RootLayout({ children }) {
      return [
        { type: "text", content: "HEADER" },
        ...children,
        { type: "text", content: "FOOTER" },
      ];
    }
  `);

  try {
    const mod = await loadLayoutModule(layoutPath, outDir);
    assert(typeof mod.default === "function", "layout default is function");

    const result = mod.default({ children: [{ type: "text", content: "PAGE" } as any] });
    assertEqual(result.length, 3, "layout wraps children (3 blocks)");
    assertEqual((result[0] as any).content, "HEADER", "first block is header");
    assertEqual((result[1] as any).content, "PAGE", "middle block is page content");
    assertEqual((result[2] as any).content, "FOOTER", "last block is footer");
  } catch (e: any) {
    failed++;
    console.error(`  FAIL: loadLayoutModule threw: ${e.message}`);
  }
}

// ─── loadApiModule ────────────────────────────────────────

console.log("\x1b[1m  loadApiModule\x1b[0m");
clearModuleCache();
{
  const apiPath = join(tmpDir, "stats.ts");
  writeFileSync(apiPath, `
    export async function GET() {
      return { users: 100, revenue: "$1M" };
    }
    export async function POST(req) {
      return { success: true };
    }
  `);

  try {
    const mod = await loadApiModule(apiPath, outDir);
    assert(typeof mod.GET === "function", "GET handler exported");
    assert(typeof mod.POST === "function", "POST handler exported");
    assert(mod.PUT === undefined, "PUT not exported");
    assert(mod.DELETE === undefined, "DELETE not exported");

    const getResult = await mod.GET!({} as any);
    assertEqual((getResult as any).users, 100, "GET returns correct data");
  } catch (e: any) {
    failed++;
    console.error(`  FAIL: loadApiModule threw: ${e.message}`);
  }
}

// ─── loadFileBasedConfig ──────────────────────────────────

console.log("\x1b[1m  loadFileBasedConfig\x1b[0m");
clearModuleCache();
{
  const configPath = join(tmpDir, "config.ts");
  writeFileSync(configPath, `
    export default {
      name: "Test Site",
      theme: "cyberpunk",
      banner: { text: "TEST", font: "Ghost" },
    };
  `);

  try {
    const config = await loadFileBasedConfig(configPath, outDir);
    assertEqual(config.name, "Test Site", "config name = Test Site");
    assertEqual(config.theme, "cyberpunk", "config theme = cyberpunk");
    assert(config.banner !== undefined, "config has banner");
  } catch (e: any) {
    failed++;
    console.error(`  FAIL: loadFileBasedConfig threw: ${e.message}`);
  }
}

// ─── Error handling ───────────────────────────────────────

console.log("\x1b[1m  Error handling\x1b[0m");
clearModuleCache();
{
  // Non-function default export
  const badPath = join(tmpDir, "bad-page.ts");
  writeFileSync(badPath, `export default "not a function";`);

  try {
    await loadPageModule(badPath, outDir);
    failed++;
    console.error("  FAIL: should throw for non-function default");
  } catch (e: any) {
    assert(e.message.includes("must have a default export"), "throws for non-function default");
  }
}

cleanup();

// ─── Results ──────────────────────────────────────────────
console.log("");
if (failed > 0) {
  console.log(`  \x1b[31m${passed} passed, ${failed} failed\x1b[0m`);
  process.exit(1);
} else {
  console.log(`  \x1b[32m${passed} passed\x1b[0m, 0 failed`);
}
