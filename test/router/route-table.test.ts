/**
 * Route table unit tests — route name resolution, layout chains, matching
 */
import { buildRouteTable, resolveRouteName, resolveLayoutChain, findRoute, matchDynamicRoute } from "../../src/router/route-table.js";
import type { ScannedFile } from "../../src/router/scanner.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { passed++; } else { failed++; console.error(`  FAIL: ${name}`); }
}
function assertEqual(actual: any, expected: any, name: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; } else { failed++; console.error(`  FAIL: ${name} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

// ─── resolveRouteName ─────────────────────────────────────

console.log("\x1b[1m  resolveRouteName\x1b[0m");

{
  // Regular files
  assertEqual(resolveRouteName({ name: "home", parentDir: "", isIndex: false, isDynamic: false, depth: 0 } as ScannedFile), "home", "home.ts → home");
  assertEqual(resolveRouteName({ name: "about", parentDir: "", isIndex: false, isDynamic: false, depth: 0 } as ScannedFile), "about", "about.ts → about");

  // Index files
  assertEqual(resolveRouteName({ name: "index", parentDir: "", isIndex: true, isDynamic: false, depth: 0 } as ScannedFile), "home", "root index.ts → home");
  assertEqual(resolveRouteName({ name: "index", parentDir: "projects", isIndex: true, isDynamic: false, depth: 1 } as ScannedFile), "projects", "projects/index.ts → projects");
  assertEqual(resolveRouteName({ name: "index", parentDir: "dashboard", isIndex: true, isDynamic: false, depth: 1 } as ScannedFile), "dashboard", "dashboard/index.ts → dashboard");

  // Nested files
  assertEqual(resolveRouteName({ name: "analytics", parentDir: "dashboard", isIndex: false, isDynamic: false, depth: 1 } as ScannedFile), "dashboard/analytics", "dashboard/analytics.ts → dashboard/analytics");
  assertEqual(resolveRouteName({ name: "settings", parentDir: "dashboard", isIndex: false, isDynamic: false, depth: 1 } as ScannedFile), "dashboard/settings", "dashboard/settings.ts → dashboard/settings");

  // Dynamic routes
  assertEqual(resolveRouteName({ name: "[slug]", parentDir: "projects", isIndex: false, isDynamic: true, paramName: "slug", depth: 1 } as ScannedFile), "projects/[slug]", "[slug].ts → projects/[slug]");
  assertEqual(resolveRouteName({ name: "[id]", parentDir: "", isIndex: false, isDynamic: true, paramName: "id", depth: 0 } as ScannedFile), "[id]", "root [id].ts → [id]");
}

// ─── resolveLayoutChain ───────────────────────────────────

console.log("\x1b[1m  resolveLayoutChain\x1b[0m");

{
  const layouts = new Map<string, string>();
  layouts.set("", "/pages/layout.ts");
  layouts.set("dashboard", "/pages/dashboard/layout.ts");

  // Root page — only root layout
  assertEqual(resolveLayoutChain("", layouts), ["/pages/layout.ts"], "root page gets root layout");

  // Dashboard page — root + dashboard layouts
  assertEqual(resolveLayoutChain("dashboard", layouts), ["/pages/layout.ts", "/pages/dashboard/layout.ts"], "dashboard gets both layouts");

  // No layouts
  assertEqual(resolveLayoutChain("", new Map()), [], "no layouts → empty chain");

  // Nested without own layout
  assertEqual(resolveLayoutChain("settings", layouts), ["/pages/layout.ts"], "settings gets root layout only");
}

// ─── buildRouteTable ──────────────────────────────────────

console.log("\x1b[1m  buildRouteTable\x1b[0m");

{
  const pages: ScannedFile[] = [
    { absolutePath: "/p/pages/home.ts", relativePath: "home.ts", name: "home", isLayout: false, isIndex: false, isDynamic: false, depth: 0, parentDir: "" },
    { absolutePath: "/p/pages/about.ts", relativePath: "about.ts", name: "about", isLayout: false, isIndex: false, isDynamic: false, depth: 0, parentDir: "" },
    { absolutePath: "/p/pages/projects/index.ts", relativePath: "projects/index.ts", name: "index", isLayout: false, isIndex: true, isDynamic: false, depth: 1, parentDir: "projects" },
    { absolutePath: "/p/pages/projects/[slug].ts", relativePath: "projects/[slug].ts", name: "[slug]", isLayout: false, isIndex: false, isDynamic: true, paramName: "slug", depth: 1, parentDir: "projects" },
  ];

  const layouts: ScannedFile[] = [
    { absolutePath: "/p/pages/layout.ts", relativePath: "layout.ts", name: "layout", isLayout: true, isIndex: false, isDynamic: false, depth: 0, parentDir: "" },
  ];

  const table = buildRouteTable(pages, layouts, "/p/pages");

  assertEqual(table.routes.length, 4, "4 routes in table");
  assertEqual(table.layouts.size, 1, "1 layout in table");

  const homeRoute = findRoute(table, "home");
  assert(!!homeRoute, "finds home route");
  assertEqual(homeRoute?.layoutChain.length, 1, "home has 1 layout");

  const projectsRoute = findRoute(table, "projects");
  assert(!!projectsRoute, "finds projects route");
  assertEqual(projectsRoute?.isIndex, true, "projects isIndex");

  const slugRoute = findRoute(table, "projects/[slug]");
  assert(!!slugRoute, "finds dynamic slug route");
  assertEqual(slugRoute?.isDynamic, true, "slug isDynamic");
  assertEqual(slugRoute?.paramName, "slug", "slug paramName");
}

// ─── matchDynamicRoute ────────────────────────────────────

console.log("\x1b[1m  matchDynamicRoute\x1b[0m");

{
  const pages: ScannedFile[] = [
    { absolutePath: "/p/pages/projects/index.ts", relativePath: "projects/index.ts", name: "index", isLayout: false, isIndex: true, isDynamic: false, depth: 1, parentDir: "projects" },
    { absolutePath: "/p/pages/projects/[slug].ts", relativePath: "projects/[slug].ts", name: "[slug]", isLayout: false, isIndex: false, isDynamic: true, paramName: "slug", depth: 1, parentDir: "projects" },
  ];

  const table = buildRouteTable(pages, [], "/p/pages");

  const match = matchDynamicRoute(table, "projects/my-project");
  assert(!!match, "matches projects/my-project");
  assertEqual(match?.params.slug, "my-project", "extracts slug param");

  const noMatch = matchDynamicRoute(table, "unknown/path");
  assert(!noMatch, "no match for unknown/path");

  const noMatch2 = matchDynamicRoute(table, "projects/a/b");
  assert(!noMatch2, "no match for too-deep path");
}

// ─── Results ──────────────────────────────────────────────
console.log("");
if (failed > 0) {
  console.log(`  \x1b[31m${passed} passed, ${failed} failed\x1b[0m`);
  process.exit(1);
} else {
  console.log(`  \x1b[32m${passed} passed\x1b[0m, 0 failed`);
}
