/**
 * API loader unit tests — route building from scanned files
 */
import { buildApiRoutes } from "../../src/router/api-loader.js";
import type { ScannedFile } from "../../src/router/scanner.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { passed++; } else { failed++; console.error(`  FAIL: ${name}`); }
}
function assertEqual(actual: any, expected: any, name: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; } else { failed++; console.error(`  FAIL: ${name} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

// ─── buildApiRoutes ───────────────────────────────────────

console.log("\x1b[1m  buildApiRoutes\x1b[0m");

{
  const files: ScannedFile[] = [
    { absolutePath: "/api/stats.ts", relativePath: "stats.ts", name: "stats", isLayout: false, isIndex: false, isDynamic: false, depth: 0, parentDir: "" },
    { absolutePath: "/api/contact.ts", relativePath: "contact.ts", name: "contact", isLayout: false, isIndex: false, isDynamic: false, depth: 0, parentDir: "" },
    { absolutePath: "/api/projects/[id].ts", relativePath: "projects/[id].ts", name: "[id]", isLayout: false, isIndex: false, isDynamic: true, paramName: "id", depth: 1, parentDir: "projects" },
  ];

  const routes = buildApiRoutes(files);

  assertEqual(routes.length, 3, "3 API routes");

  const stats = routes.find(r => r.endpoint === "/api/stats");
  assert(!!stats, "stats route exists");
  assertEqual(stats?.paramNames.length, 0, "stats has no params");

  const contact = routes.find(r => r.endpoint === "/api/contact");
  assert(!!contact, "contact route exists");

  const projects = routes.find(r => r.endpoint.includes("projects"));
  assert(!!projects, "projects route exists");
  assertEqual(projects?.endpoint, "/api/projects/:id", "projects endpoint has :id param");
  assertEqual(projects?.paramNames, ["id"], "projects paramNames = [id]");
}

// ─── Index files ──────────────────────────────────────────

console.log("\x1b[1m  Index files\x1b[0m");
{
  const files: ScannedFile[] = [
    { absolutePath: "/api/index.ts", relativePath: "index.ts", name: "index", isLayout: false, isIndex: true, isDynamic: false, depth: 0, parentDir: "" },
    { absolutePath: "/api/users/index.ts", relativePath: "users/index.ts", name: "index", isLayout: false, isIndex: true, isDynamic: false, depth: 1, parentDir: "users" },
  ];

  const routes = buildApiRoutes(files);
  assertEqual(routes.length, 2, "2 routes");

  const root = routes.find(r => r.endpoint === "/api/");
  assert(!!root || routes.some(r => r.endpoint === "/api"), "root index route");

  const users = routes.find(r => r.endpoint === "/api/users");
  assert(!!users, "users index route = /api/users");
}

// ─── Nested dynamic routes ────────────────────────────────

console.log("\x1b[1m  Nested dynamic routes\x1b[0m");
{
  const files: ScannedFile[] = [
    { absolutePath: "/api/teams/[teamId]/members/[memberId].ts", relativePath: "teams/[teamId]/members/[memberId].ts", name: "[memberId]", isLayout: false, isIndex: false, isDynamic: true, paramName: "memberId", depth: 3, parentDir: "teams/[teamId]/members" },
  ];

  const routes = buildApiRoutes(files);
  assertEqual(routes.length, 1, "1 route");
  assertEqual(routes[0].endpoint, "/api/teams/:teamId/members/:memberId", "nested dynamic endpoint");
  assertEqual(routes[0].paramNames, ["teamId", "memberId"], "both params extracted");
}

// ─── Empty ────────────────────────────────────────────────

console.log("\x1b[1m  Empty api directory\x1b[0m");
{
  const routes = buildApiRoutes([]);
  assertEqual(routes.length, 0, "no routes from empty input");
}

// ─── Results ──────────────────────────────────────────────
console.log("");
if (failed > 0) {
  console.log(`  \x1b[31m${passed} passed, ${failed} failed\x1b[0m`);
  process.exit(1);
} else {
  console.log(`  \x1b[32m${passed} passed\x1b[0m, 0 failed`);
}
