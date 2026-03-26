/**
 * Scanner unit tests — file discovery, project detection
 */
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { scanDirectory, scanPages, scanApiDirectory, detectProject } from "../../src/router/scanner.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { passed++; } else { failed++; console.error(`  FAIL: ${name}`); }
}
function assertEqual(actual: any, expected: any, name: string) {
  if (actual === expected) { passed++; } else { failed++; console.error(`  FAIL: ${name} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

// Setup temp directory
const tmpDir = join(process.cwd(), ".test-scanner-tmp");
function setup() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
}
function cleanup() {
  rmSync(tmpDir, { recursive: true, force: true });
}

// ─── scanDirectory ────────────────────────────────────────

console.log("\x1b[1m  scanDirectory\x1b[0m");

setup();
{
  // Create test file structure
  mkdirSync(join(tmpDir, "pages"), { recursive: true });
  mkdirSync(join(tmpDir, "pages", "dashboard"), { recursive: true });
  writeFileSync(join(tmpDir, "pages", "home.ts"), "export default function Home() { return []; }");
  writeFileSync(join(tmpDir, "pages", "about.ts"), "export default function About() { return []; }");
  writeFileSync(join(tmpDir, "pages", "layout.ts"), "export default function Layout({ children }) { return children; }");
  writeFileSync(join(tmpDir, "pages", "dashboard", "index.ts"), "export default function Dashboard() { return []; }");
  writeFileSync(join(tmpDir, "pages", "dashboard", "layout.ts"), "export default function DashLayout({ children }) { return children; }");
  writeFileSync(join(tmpDir, "pages", "dashboard", "[id].ts"), "export default function Detail({ params }) { return []; }");

  const files = scanDirectory(join(tmpDir, "pages"));
  assertEqual(files.length, 6, "finds all 6 .ts files");

  const homeFile = files.find(f => f.name === "home");
  assert(!!homeFile, "finds home.ts");
  assertEqual(homeFile?.isLayout, false, "home.ts is not a layout");
  assertEqual(homeFile?.isIndex, false, "home.ts is not an index");
  assertEqual(homeFile?.depth, 0, "home.ts is at depth 0");

  const layoutFile = files.find(f => f.name === "layout" && f.parentDir === "");
  assert(!!layoutFile, "finds root layout.ts");
  assertEqual(layoutFile?.isLayout, true, "layout.ts isLayout = true");

  const indexFile = files.find(f => f.name === "index");
  assert(!!indexFile, "finds dashboard/index.ts");
  assertEqual(indexFile?.isIndex, true, "index.ts isIndex = true");
  assertEqual(indexFile?.depth, 1, "dashboard/index.ts at depth 1");
  assertEqual(indexFile?.parentDir, "dashboard", "dashboard/index.ts parent = dashboard");

  const dynamicFile = files.find(f => f.name === "[id]");
  assert(!!dynamicFile, "finds [id].ts");
  assertEqual(dynamicFile?.isDynamic, true, "[id].ts isDynamic = true");
  assertEqual(dynamicFile?.paramName, "id", "[id].ts paramName = id");
}

// ─── scanPages ────────────────────────────────────────────

console.log("\x1b[1m  scanPages\x1b[0m");
{
  const { pages, layouts } = scanPages(join(tmpDir, "pages"));
  assertEqual(layouts.length, 2, "finds 2 layout files");
  assertEqual(pages.length, 4, "finds 4 page files (excluding layouts)");

  const pageNames = pages.map(p => p.name).sort();
  assert(pageNames.includes("home"), "pages includes home");
  assert(pageNames.includes("about"), "pages includes about");
  assert(pageNames.includes("index"), "pages includes index");
  assert(pageNames.includes("[id]"), "pages includes [id]");
}

// ─── scanDirectory ignores hidden dirs ────────────────────

console.log("\x1b[1m  Ignores hidden directories\x1b[0m");
{
  mkdirSync(join(tmpDir, "pages", ".hidden"), { recursive: true });
  writeFileSync(join(tmpDir, "pages", ".hidden", "secret.ts"), "");
  mkdirSync(join(tmpDir, "pages", "node_modules"), { recursive: true });
  writeFileSync(join(tmpDir, "pages", "node_modules", "pkg.ts"), "");

  const files = scanDirectory(join(tmpDir, "pages"));
  const names = files.map(f => f.name);
  assert(!names.includes("secret"), "ignores .hidden/secret.ts");
  assert(!names.includes("pkg"), "ignores node_modules/pkg.ts");
}

// ─── scanApiDirectory ─────────────────────────────────────

console.log("\x1b[1m  scanApiDirectory\x1b[0m");
{
  mkdirSync(join(tmpDir, "api", "projects"), { recursive: true });
  writeFileSync(join(tmpDir, "api", "stats.ts"), "export async function GET() { return {}; }");
  writeFileSync(join(tmpDir, "api", "contact.ts"), "export async function POST() { return {}; }");
  writeFileSync(join(tmpDir, "api", "projects", "[id].ts"), "export async function GET() { return {}; }");

  const files = scanApiDirectory(join(tmpDir, "api"));
  assertEqual(files.length, 3, "finds 3 API route files");

  const dynamic = files.find(f => f.isDynamic);
  assert(!!dynamic, "finds dynamic API route");
  assertEqual(dynamic?.paramName, "id", "API dynamic param = id");
}

// ─── detectProject ────────────────────────────────────────

console.log("\x1b[1m  detectProject\x1b[0m");
{
  // File-based project
  const fbDir = join(tmpDir, "file-based");
  mkdirSync(join(fbDir, "pages"), { recursive: true });
  writeFileSync(join(fbDir, "config.ts"), "export default { name: 'test' };");
  writeFileSync(join(fbDir, "pages", "home.ts"), "export default function() { return []; }");

  const fb = detectProject(fbDir);
  assertEqual(fb.type, "file-based", "detects file-based project");
  assert(fb.pagesDir !== undefined, "has pagesDir");

  // Single-file project
  const sfDir = join(tmpDir, "single-file");
  mkdirSync(sfDir, { recursive: true });
  writeFileSync(join(sfDir, "site.config.ts"), "export default defineSite({});");

  const sf = detectProject(sfDir);
  assertEqual(sf.type, "single-file", "detects single-file project");
}

// ─── Empty directory ──────────────────────────────────────

console.log("\x1b[1m  Empty / missing directory\x1b[0m");
{
  const empty = scanDirectory(join(tmpDir, "nonexistent"));
  assertEqual(empty.length, 0, "empty for nonexistent dir");
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
