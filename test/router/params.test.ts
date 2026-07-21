/**
 * Route-param threading tests — the content loaders built by buildPagesArray
 * must hand the runtime's navigation params to page default exports as a
 * PageContext, and metadata label/loading functions must survive the trip
 * into the PageConfig. Regression coverage for the dynamic-route bug where
 * loaders were always called with `undefined` and function labels rendered
 * as raw source.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileRouter } from "../../src/router/resolver.js";
import type { FileBasedConfig } from "../../src/router/types.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { passed++; } else { failed++; console.error(`  FAIL: ${name}`); }
}
function assertEqual(actual: any, expected: any, name: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; } else { failed++; console.error(`  FAIL: ${name} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

// ─── Fixture project ──────────────────────────────────────
// Pages return a single "probe" block that records the context they were
// called with, so tests can inspect exactly what the loader passed.

const projectDir = realpathSync(mkdtempSync(join(tmpdir(), "tui-params-test-")));
const pagesDir = join(projectDir, "pages");
const outDir = join(projectDir, ".terminaltui");
mkdirSync(join(pagesDir, "blog"), { recursive: true });
mkdirSync(outDir, { recursive: true });

writeFileSync(join(pagesDir, "home.ts"), `
export const metadata = { label: "Home" };
export default function Home(ctx?: unknown) {
  return [{ type: "probe", ctx }];
}
`);

writeFileSync(join(pagesDir, "post.ts"), `
export const metadata = {
  hidden: true,
  label: (p: { id: string }) => \`Post #\${p.id}\`,
  loading: (p: { id: string }) => \`Loading post #\${p.id}...\`,
};
export default function Post(ctx?: unknown) {
  return [{ type: "probe", ctx }];
}
`);

writeFileSync(join(pagesDir, "blog", "[slug].ts"), `
export const metadata = { hidden: true };
export default function BlogPost(ctx?: unknown) {
  return [{ type: "probe", ctx }];
}
`);

try {
  const router = new FileRouter({
    config: { name: "Params Fixture" } as FileBasedConfig,
    pagesDir,
    outDir,
  });
  await router.initialize();

  const pages = await router.buildPagesArray();
  const byId = new Map(pages.map(p => [p.id, p]));
  type Loader = (params?: Record<string, string>) => Promise<any[]>;
  const probe = async (id: string, params?: Record<string, string>) =>
    (await (byId.get(id)!.content as Loader)(params))[0].ctx;

  // ─── Loader context threading ─────────────────────────────

  console.log("\x1b[1m  Loader context threading\x1b[0m");

  assert(byId.has("home") && byId.has("post") && byId.has("blog/[slug]"), "fixture routes discovered");

  assertEqual(await probe("home"), undefined, "static page without params gets no context");
  assertEqual(await probe("home", {}), undefined, "static page with empty params gets no context");
  assertEqual(await probe("post", { id: "7" }), { params: { id: "7" } }, "static page navigated with params gets { params }");
  assertEqual(await probe("blog/[slug]", { slug: "hello" }), { params: { slug: "hello" } }, "dynamic route gets { params }");
  assertEqual(await probe("blog/[slug]"), { params: {} }, "dynamic route without params still gets a context");

  // ─── resolvePage dynamic matching ─────────────────────────

  console.log("\x1b[1m  resolvePage dynamic matching\x1b[0m");

  const resolved = await router.resolvePage("blog/from-url");
  assertEqual(resolved[0].ctx, { params: { slug: "from-url" } }, "resolvePage extracts params from the path");

  // ─── Metadata passthrough to PageConfig ───────────────────

  console.log("\x1b[1m  Metadata passthrough\x1b[0m");

  const post = byId.get("post")!;
  assert(typeof post.title === "function", "function label lands on PageConfig.title");
  assertEqual((post.title as (p: any) => string)({ id: "3" }), "Post #3", "title function resolves with params");
  assert(typeof post.loading === "function", "function loading message lands on PageConfig.loading");
  assertEqual((post.loading as (p: any) => string)({ id: "3" }), "Loading post #3...", "loading function resolves with params");
  assert((post as any)._hidden === true, "hidden metadata respected");

  const home = byId.get("home")!;
  assertEqual(home.title, "Home", "string labels pass through unchanged");

  // ─── Navigation Router param history ──────────────────────

  console.log("\x1b[1m  Navigation Router param history\x1b[0m");

  const { Router } = await import("../../src/navigation/router.js");
  const nav = new Router();
  nav.registerPages(["home", "post"]);

  nav.navigate("post", { id: "5" });
  assertEqual(nav.currentParams, { id: "5" }, "navigate stores params");
  nav.navigate("home");
  assertEqual(nav.currentParams, {}, "param-less navigate clears params");
  nav.back();
  assertEqual(nav.currentPage, "post", "back restores the page");
  assertEqual(nav.currentParams, { id: "5" }, "back restores that page's params");
  nav.home();
  assertEqual(nav.currentParams, {}, "home clears params");

  // ─── Build entry codegen threads params ───────────────────

  console.log("\x1b[1m  Build entry codegen\x1b[0m");

  const { createFileBasedEntryPoint } = await import("../../src/cli/build.js");
  writeFileSync(join(projectDir, "config.ts"), `export default { name: "Params Fixture" };\n`);
  const buildOut = join(projectDir, ".build-out");
  mkdirSync(buildOut, { recursive: true });
  const entryPath = await createFileBasedEntryPoint(projectDir, join(projectDir, "config.ts"), buildOut);
  const entry = (await import("node:fs")).readFileSync(entryPath, "utf-8");

  assert(entry.includes("const _ctx = (isDynamic, params)"), "entry defines the context helper");
  assert(/content: async \(params\) => \w+\(_ctx\(true, params\)\)/.test(entry), "dynamic route loader threads params with isDynamic=true");
  assert(/content: async \(params\) => \w+\(_ctx\(false, params\)\)/.test(entry), "static page loader threads params with isDynamic=false");
  assert(entry.includes(".loading,"), "entry passes metadata.loading through");
  assert(!entry.includes("content: async () =>"), "no loader is generated without a params argument");
} finally {
  rmSync(projectDir, { recursive: true, force: true });
}

// ─── Results ──────────────────────────────────────────────
console.log("");
if (failed > 0) {
  console.log(`  \x1b[31m${passed} passed, ${failed} failed\x1b[0m`);
  process.exit(1);
} else {
  console.log(`  \x1b[32m${passed} passed\x1b[0m, 0 failed`);
}
