/**
 * Menu builder unit tests — auto-generation, ordering, labels, manual override
 */
import { buildMenu, titleCase } from "../../src/router/menu-builder.js";
import type { RouteTable, Route, PageMetadata, MenuConfig } from "../../src/router/types.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { passed++; } else { failed++; console.error(`  FAIL: ${name}`); }
}
function assertEqual(actual: any, expected: any, name: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; } else { failed++; console.error(`  FAIL: ${name} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

function makeRoute(overrides: Partial<Route>): Route {
  return {
    name: "test",
    filePath: "/test.ts",
    isIndex: false,
    isDynamic: false,
    parentDir: "",
    depth: 0,
    layoutChain: [],
    ...overrides,
  };
}

function makeTable(routes: Route[]): RouteTable {
  return { routes, layouts: new Map() };
}

// ─── titleCase ────────────────────────────────────────────

console.log("\x1b[1m  titleCase\x1b[0m");
{
  assertEqual(titleCase("about"), "About", "about → About");
  assertEqual(titleCase("our-team"), "Our Team", "our-team → Our Team");
  assertEqual(titleCase("coffeeShop"), "Coffee Shop", "coffeeShop → Coffee Shop");
  assertEqual(titleCase("dashboard"), "Dashboard", "dashboard → Dashboard");
}

// ─── Auto-generation rules ────────────────────────────────

console.log("\x1b[1m  Auto-generation rules\x1b[0m");
{
  const table = makeTable([
    makeRoute({ name: "home", depth: 0 }),
    makeRoute({ name: "about", depth: 0 }),
    makeRoute({ name: "projects", isIndex: true, depth: 1, parentDir: "projects" }),
    makeRoute({ name: "projects/[slug]", isDynamic: true, depth: 1, parentDir: "projects" }),
    makeRoute({ name: "dashboard/analytics", depth: 1, parentDir: "dashboard" }),
  ]);

  const meta = new Map<string, PageMetadata>();
  const menu = buildMenu(table, meta);

  // home, about, projects should be in menu (top-level)
  assert(menu.some(m => m.page === "home"), "home in menu");
  assert(menu.some(m => m.page === "about"), "about in menu");
  assert(menu.some(m => m.page === "projects"), "projects (index) in menu");

  // Dynamic routes excluded
  assert(!menu.some(m => m.page === "projects/[slug]"), "[slug] excluded from menu");

  // Sub-pages excluded
  assert(!menu.some(m => m.page === "dashboard/analytics"), "dashboard/analytics excluded from menu");
}

// ─── Home always first ────────────────────────────────────

console.log("\x1b[1m  Home always first\x1b[0m");
{
  const table = makeTable([
    makeRoute({ name: "contact", depth: 0 }),
    makeRoute({ name: "about", depth: 0 }),
    makeRoute({ name: "home", depth: 0 }),
  ]);

  const menu = buildMenu(table, new Map());
  assertEqual(menu[0].page, "home", "home is first item");
}

// ─── Metadata ordering ───────────────────────────────────

console.log("\x1b[1m  Metadata ordering\x1b[0m");
{
  const table = makeTable([
    makeRoute({ name: "home", depth: 0 }),
    makeRoute({ name: "about", depth: 0 }),
    makeRoute({ name: "projects", isIndex: true, depth: 1, parentDir: "projects" }),
    makeRoute({ name: "contact", depth: 0 }),
  ]);

  const meta = new Map<string, PageMetadata>([
    ["projects", { label: "Our Work", order: 2 }],
    ["contact", { order: 10 }],
  ]);

  const menu = buildMenu(table, meta);
  assertEqual(menu[0].page, "home", "home first");
  assertEqual(menu[1].page, "projects", "projects second (order: 2)");
  assertEqual(menu[1].label, "Our Work", "projects label = Our Work");
  assertEqual(menu[2].page, "contact", "contact third (order: 10)");
  assertEqual(menu[3].page, "about", "about last (no order → alphabetical)");
}

// ─── Hidden pages ─────────────────────────────────────────

console.log("\x1b[1m  Hidden pages\x1b[0m");
{
  const table = makeTable([
    makeRoute({ name: "home", depth: 0 }),
    makeRoute({ name: "secret", depth: 0 }),
  ]);

  const meta = new Map<string, PageMetadata>([
    ["secret", { hidden: true }],
  ]);

  const menu = buildMenu(table, meta);
  assertEqual(menu.length, 1, "only 1 item (secret hidden)");
  assertEqual(menu[0].page, "home", "only home visible");
}

// ─── Icons ────────────────────────────────────────────────

console.log("\x1b[1m  Icons from metadata\x1b[0m");
{
  const table = makeTable([
    makeRoute({ name: "home", depth: 0 }),
    makeRoute({ name: "projects", depth: 0 }),
  ]);

  const meta = new Map<string, PageMetadata>([
    ["projects", { icon: ">" }],
  ]);

  const menu = buildMenu(table, meta);
  const projects = menu.find(m => m.page === "projects");
  assertEqual(projects?.icon, ">", "projects icon from metadata");
}

// ─── Manual menu override ─────────────────────────────────

console.log("\x1b[1m  Manual menu override\x1b[0m");
{
  const table = makeTable([
    makeRoute({ name: "home", depth: 0 }),
    makeRoute({ name: "about", depth: 0 }),
    makeRoute({ name: "contact", depth: 0 }),
  ]);

  const menuConfig: MenuConfig = {
    items: [
      { label: "Home", page: "home", icon: "~" },
      { label: "Get in Touch", page: "contact" },
    ],
  };

  const menu = buildMenu(table, new Map(), menuConfig);
  assertEqual(menu.length, 2, "manual menu: 2 items");
  assertEqual(menu[0].label, "Home", "first = Home");
  assertEqual(menu[0].icon, "~", "Home icon = ~");
  assertEqual(menu[1].label, "Get in Touch", "second = Get in Touch");
}

// ─── Menu exclude list ────────────────────────────────────

console.log("\x1b[1m  Menu exclude list\x1b[0m");
{
  const table = makeTable([
    makeRoute({ name: "home", depth: 0 }),
    makeRoute({ name: "about", depth: 0 }),
    makeRoute({ name: "secret-page", depth: 0 }),
  ]);

  const menuConfig: MenuConfig = {
    exclude: ["secret-page"],
  };

  const menu = buildMenu(table, new Map(), menuConfig);
  assertEqual(menu.length, 2, "2 items after exclude");
  assert(!menu.some(m => m.page === "secret-page"), "secret-page excluded");
}

// ─── Menu label/icon overrides ────────────────────────────

console.log("\x1b[1m  Menu label/icon overrides\x1b[0m");
{
  const table = makeTable([
    makeRoute({ name: "home", depth: 0 }),
    makeRoute({ name: "about", depth: 0 }),
  ]);

  const menuConfig: MenuConfig = {
    labels: { about: "About Us" },
    icons: { about: "?" },
  };

  const menu = buildMenu(table, new Map(), menuConfig);
  const about = menu.find(m => m.page === "about");
  assertEqual(about?.label, "About Us", "label override works");
  assertEqual(about?.icon, "?", "icon override works");
}

// ─── Manual order ─────────────────────────────────────────

console.log("\x1b[1m  Manual order\x1b[0m");
{
  const table = makeTable([
    makeRoute({ name: "home", depth: 0 }),
    makeRoute({ name: "about", depth: 0 }),
    makeRoute({ name: "contact", depth: 0 }),
    makeRoute({ name: "projects", depth: 0 }),
  ]);

  const menuConfig: MenuConfig = {
    order: ["home", "projects", "about", "contact"],
  };

  const menu = buildMenu(table, new Map(), menuConfig);
  assertEqual(menu[0].page, "home", "manual order: home first");
  assertEqual(menu[1].page, "projects", "manual order: projects second");
  assertEqual(menu[2].page, "about", "manual order: about third");
  assertEqual(menu[3].page, "contact", "manual order: contact fourth");
}

// ─── Results ──────────────────────────────────────────────
console.log("");
if (failed > 0) {
  console.log(`  \x1b[31m${passed} passed, ${failed} failed\x1b[0m`);
  process.exit(1);
} else {
  console.log(`  \x1b[32m${passed} passed\x1b[0m, 0 failed`);
}
