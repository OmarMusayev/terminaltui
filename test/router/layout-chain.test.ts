/**
 * Layout chain unit tests — resolution and nesting logic
 * Note: actual layout application requires esbuild compilation,
 * so we test the resolution logic only.
 */
import { resolveLayoutChain } from "../../src/router/route-table.js";

let passed = 0;
let failed = 0;

function assertEqual(actual: any, expected: any, name: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; } else { failed++; console.error(`  FAIL: ${name} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

// ─── Layout chain resolution ──────────────────────────────

console.log("\x1b[1m  Layout chain resolution\x1b[0m");

{
  // No layouts
  assertEqual(resolveLayoutChain("", new Map()), [], "no layouts → empty");
  assertEqual(resolveLayoutChain("dashboard", new Map()), [], "no layouts for nested → empty");
}

{
  // Root layout only
  const layouts = new Map<string, string>();
  layouts.set("", "/pages/layout.ts");

  assertEqual(resolveLayoutChain("", layouts), ["/pages/layout.ts"], "root dir → root layout");
  assertEqual(resolveLayoutChain("dashboard", layouts), ["/pages/layout.ts"], "nested dir → root layout");
  assertEqual(resolveLayoutChain("dashboard/settings", layouts), ["/pages/layout.ts"], "deeply nested → root layout only");
}

{
  // Root + one nested layout
  const layouts = new Map<string, string>();
  layouts.set("", "/pages/layout.ts");
  layouts.set("dashboard", "/pages/dashboard/layout.ts");

  assertEqual(
    resolveLayoutChain("dashboard", layouts),
    ["/pages/layout.ts", "/pages/dashboard/layout.ts"],
    "dashboard → root + dashboard layout"
  );

  assertEqual(
    resolveLayoutChain("", layouts),
    ["/pages/layout.ts"],
    "root → root layout only"
  );
}

{
  // Three levels of nesting
  const layouts = new Map<string, string>();
  layouts.set("", "/root.ts");
  layouts.set("admin", "/admin.ts");
  layouts.set("admin/users", "/admin-users.ts");

  assertEqual(
    resolveLayoutChain("admin/users", layouts),
    ["/root.ts", "/admin.ts", "/admin-users.ts"],
    "3 levels deep → 3 layouts in chain"
  );

  assertEqual(
    resolveLayoutChain("admin", layouts),
    ["/root.ts", "/admin.ts"],
    "2 levels → 2 layouts"
  );
}

{
  // Gap in layout chain (root + deep, but no middle)
  const layouts = new Map<string, string>();
  layouts.set("", "/root.ts");
  layouts.set("admin/users", "/admin-users.ts");

  assertEqual(
    resolveLayoutChain("admin/users", layouts),
    ["/root.ts", "/admin-users.ts"],
    "gap in chain: root + admin/users (skips admin)"
  );

  assertEqual(
    resolveLayoutChain("admin", layouts),
    ["/root.ts"],
    "admin with no own layout → root only"
  );
}

{
  // Nested layout without root
  const layouts = new Map<string, string>();
  layouts.set("dashboard", "/dash-layout.ts");

  assertEqual(
    resolveLayoutChain("dashboard", layouts),
    ["/dash-layout.ts"],
    "nested layout without root → just nested"
  );

  assertEqual(
    resolveLayoutChain("", layouts),
    [],
    "root page with no root layout → empty"
  );
}

// ─── Results ──────────────────────────────────────────────
console.log("");
if (failed > 0) {
  console.log(`  \x1b[31m${passed} passed, ${failed} failed\x1b[0m`);
  process.exit(1);
} else {
  console.log(`  \x1b[32m${passed} passed\x1b[0m, 0 failed`);
}
