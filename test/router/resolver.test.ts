/**
 * Resolver unit tests — route resolution, static and dynamic matching
 */
import { findRoute, matchDynamicRoute, buildRouteTable } from "../../src/router/route-table.js";
import type { ScannedFile } from "../../src/router/scanner.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { passed++; } else { failed++; console.error(`  FAIL: ${name}`); }
}
function assertEqual(actual: any, expected: any, name: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; } else { failed++; console.error(`  FAIL: ${name} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

// ─── Static route resolution ──────────────────────────────

console.log("\x1b[1m  Static route resolution\x1b[0m");

{
  const pages: ScannedFile[] = [
    { absolutePath: "/pages/home.ts", relativePath: "home.ts", name: "home", isLayout: false, isIndex: false, isDynamic: false, depth: 0, parentDir: "" },
    { absolutePath: "/pages/about.ts", relativePath: "about.ts", name: "about", isLayout: false, isIndex: false, isDynamic: false, depth: 0, parentDir: "" },
    { absolutePath: "/pages/projects/index.ts", relativePath: "projects/index.ts", name: "index", isLayout: false, isIndex: true, isDynamic: false, depth: 1, parentDir: "projects" },
    { absolutePath: "/pages/dashboard/analytics.ts", relativePath: "dashboard/analytics.ts", name: "analytics", isLayout: false, isIndex: false, isDynamic: false, depth: 1, parentDir: "dashboard" },
  ];

  const table = buildRouteTable(pages, [], "/pages");

  const home = findRoute(table, "home");
  assert(!!home, "finds home route");
  assertEqual(home?.filePath, "/pages/home.ts", "home filePath");

  const about = findRoute(table, "about");
  assert(!!about, "finds about route");

  const projects = findRoute(table, "projects");
  assert(!!projects, "finds projects index route");
  assertEqual(projects?.isIndex, true, "projects isIndex");

  const analytics = findRoute(table, "dashboard/analytics");
  assert(!!analytics, "finds nested analytics route");

  const notFound = findRoute(table, "nonexistent");
  assert(!notFound, "returns undefined for nonexistent");
}

// ─── Dynamic route matching ───────────────────────────────

console.log("\x1b[1m  Dynamic route matching\x1b[0m");

{
  const pages: ScannedFile[] = [
    { absolutePath: "/pages/blog/[slug].ts", relativePath: "blog/[slug].ts", name: "[slug]", isLayout: false, isIndex: false, isDynamic: true, paramName: "slug", depth: 1, parentDir: "blog" },
    { absolutePath: "/pages/users/[id].ts", relativePath: "users/[id].ts", name: "[id]", isLayout: false, isIndex: false, isDynamic: true, paramName: "id", depth: 1, parentDir: "users" },
  ];

  const table = buildRouteTable(pages, [], "/pages");

  // Match blog/hello-world
  const blogMatch = matchDynamicRoute(table, "blog/hello-world");
  assert(!!blogMatch, "matches blog/hello-world");
  assertEqual(blogMatch?.params.slug, "hello-world", "extracts slug");
  assertEqual(blogMatch?.route.name, "blog/[slug]", "matched route name");

  // Match users/42
  const userMatch = matchDynamicRoute(table, "users/42");
  assert(!!userMatch, "matches users/42");
  assertEqual(userMatch?.params.id, "42", "extracts id");

  // No match — wrong prefix
  const noMatch1 = matchDynamicRoute(table, "posts/hello");
  assert(!noMatch1, "no match for posts/hello");

  // No match — too many segments
  const noMatch2 = matchDynamicRoute(table, "blog/a/b");
  assert(!noMatch2, "no match for blog/a/b");

  // No match — static part mismatch
  const noMatch3 = matchDynamicRoute(table, "blogx/hello");
  assert(!noMatch3, "no match for blogx/hello");
}

// ─── Mixed static + dynamic ──────────────────────────────

console.log("\x1b[1m  Mixed static + dynamic\x1b[0m");

{
  const pages: ScannedFile[] = [
    { absolutePath: "/pages/projects/index.ts", relativePath: "projects/index.ts", name: "index", isLayout: false, isIndex: true, isDynamic: false, depth: 1, parentDir: "projects" },
    { absolutePath: "/pages/projects/[slug].ts", relativePath: "projects/[slug].ts", name: "[slug]", isLayout: false, isIndex: false, isDynamic: true, paramName: "slug", depth: 1, parentDir: "projects" },
    { absolutePath: "/pages/about.ts", relativePath: "about.ts", name: "about", isLayout: false, isIndex: false, isDynamic: false, depth: 0, parentDir: "" },
  ];

  const table = buildRouteTable(pages, [], "/pages");

  // Static takes precedence
  const staticRoute = findRoute(table, "projects");
  assert(!!staticRoute, "static projects route found");

  // Dynamic only matches unknown values
  const dynMatch = matchDynamicRoute(table, "projects/my-awesome-project");
  assert(!!dynMatch, "dynamic match for projects/my-awesome-project");
  assertEqual(dynMatch?.params.slug, "my-awesome-project", "extracted slug");
}

// ─── Results ──────────────────────────────────────────────
console.log("");
if (failed > 0) {
  console.log(`  \x1b[31m${passed} passed, ${failed} failed\x1b[0m`);
  process.exit(1);
} else {
  console.log(`  \x1b[32m${passed} passed\x1b[0m, 0 failed`);
}
