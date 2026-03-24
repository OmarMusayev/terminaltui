/**
 * Integration test: API server + fetcher + resolveUrl working end-to-end.
 *
 * Verifies that fetcher() calls to relative URLs actually reach the API server,
 * that data arrives via the globalThis render callback, and that the fetcher
 * registry prevents duplicate instances.
 */
import { ApiServer } from "../src/api/server.js";
import { setApiBaseUrl } from "../src/api/resolve.js";
import { fetcher, destroyAllFetchers } from "../src/data/fetcher.js";
import { request } from "../src/data/request.js";

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.log(`  FAIL  ${label}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function cleanup() {
  destroyAllFetchers();
  delete (globalThis as any).__terminaltui_render_callback__;
  setApiBaseUrl(null);
}

// ─── Test: fetcher + API server via globalThis callback ───

async function testFetcherWithApiServer() {
  console.log("\n--- fetcher() + ApiServer integration ---");
  cleanup();

  const server = new ApiServer();
  server.registerRoutes({
    "GET /hello": async () => ({ message: "Hello from the API!" }),
  });

  const port = await server.start();
  setApiBaseUrl(server.getBaseUrl());

  let renderCount = 0;
  (globalThis as any).__terminaltui_render_callback__ = () => { renderCount++; };

  const result = fetcher({ url: "/hello", cache: false });

  check("fetcher starts loading", result.loading === true);
  check("fetcher data is null initially", result.data === null);

  await delay(500);

  check("fetcher finished loading", result.loading === false);
  check("fetcher has data", result.data !== null);
  check("fetcher data is correct", (result.data as any)?.message === "Hello from the API!");
  check("fetcher triggered render callback", renderCount > 0);
  check("fetcher has no error", result.error === null);

  cleanup();
  await server.stop();
}

// ─── Test: fetcher registry reuses instances ──────────────

async function testFetcherRegistry() {
  console.log("\n--- fetcher() registry reuses instances ---");
  cleanup();

  const server = new ApiServer();
  let callCount = 0;
  server.registerRoutes({
    "GET /counted": async () => ({ count: ++callCount }),
  });

  const port = await server.start();
  setApiBaseUrl(server.getBaseUrl());
  (globalThis as any).__terminaltui_render_callback__ = () => {};

  const f1 = fetcher({ url: "/counted", cache: false });
  const f2 = fetcher({ url: "/counted", cache: false });

  check("same URL returns same instance", f1 === f2);

  await delay(300);
  check("only one fetch was made", callCount === 1);
  check("both refs see same data", f1.data === f2.data);

  cleanup();
  await server.stop();
}

// ─── Test: fetcher with params ────────────────────────────

async function testFetcherWithParams() {
  console.log("\n--- fetcher() with URL params ---");
  cleanup();

  const server = new ApiServer();
  server.registerRoutes({
    "GET /items/:id": async (req) => ({ id: req.params.id }),
  });

  const port = await server.start();
  setApiBaseUrl(server.getBaseUrl());
  (globalThis as any).__terminaltui_render_callback__ = () => {};

  const result = fetcher({ url: "/items/42", cache: false });
  await delay(500);

  check("param route resolves", result.data !== null);
  check("param value correct", (result.data as any)?.id === "42");

  cleanup();
  await server.stop();
}

// ─── Test: request.post + API server ──────────────────────

async function testRequestWithApiServer() {
  console.log("\n--- request.post() + ApiServer integration ---");
  cleanup();

  const server = new ApiServer();
  server.registerRoutes({
    "POST /echo": async (req) => ({ echoed: req.body }),
  });

  const port = await server.start();
  setApiBaseUrl(server.getBaseUrl());

  const res = await request.post("/echo", { name: "test", value: 99 });

  check("request.post returns ok", res.ok);
  check("request.post data correct", (res.data as any)?.echoed?.name === "test");
  check("request.post status 200", res.status === 200);

  cleanup();
  await server.stop();
}

// ─── Test: fetcher auto-refresh ───────────────────────────

async function testFetcherAutoRefresh() {
  console.log("\n--- fetcher() auto-refresh ---");
  cleanup();

  let counter = 0;
  const server = new ApiServer();
  server.registerRoutes({
    "GET /counter": async () => ({ count: ++counter }),
  });

  const port = await server.start();
  setApiBaseUrl(server.getBaseUrl());

  let renderCount = 0;
  (globalThis as any).__terminaltui_render_callback__ = () => { renderCount++; };

  const result = fetcher({ url: "/counter", refreshInterval: 200, cache: false });

  await delay(300);
  const firstCount = (result.data as any)?.count;
  check("initial fetch works", typeof firstCount === "number" && firstCount >= 1);

  await delay(600);
  const secondCount = (result.data as any)?.count;
  check("auto-refresh fetched new data", secondCount > firstCount);
  check("render callback fired multiple times", renderCount >= 2);

  cleanup();
  await server.stop();
}

// ─── Test: fetcher error handling ─────────────────────────

async function testFetcherError() {
  console.log("\n--- fetcher() error handling ---");
  cleanup();

  const server = new ApiServer();
  server.registerRoutes({
    "GET /fail": async () => { throw new Error("Intentional failure"); },
  });

  const port = await server.start();
  setApiBaseUrl(server.getBaseUrl());

  let rendered = false;
  (globalThis as any).__terminaltui_render_callback__ = () => { rendered = true; };

  const result = fetcher({ url: "/fail", cache: false });
  await delay(500);

  check("fetcher has error", result.error !== null);
  check("fetcher not loading", result.loading === false);
  check("fetcher data is null", result.data === null);
  check("render was triggered", rendered);

  cleanup();
  await server.stop();
}

// ─── Test: multiple concurrent fetchers ───────────────────

async function testMultipleFetchers() {
  console.log("\n--- multiple concurrent fetchers ---");
  cleanup();

  const server = new ApiServer();
  server.registerRoutes({
    "GET /a": async () => ({ value: "alpha" }),
    "GET /b": async () => ({ value: "beta" }),
    "GET /c": async () => ({ value: "gamma" }),
  });

  const port = await server.start();
  setApiBaseUrl(server.getBaseUrl());
  (globalThis as any).__terminaltui_render_callback__ = () => {};

  const a = fetcher({ url: "/a", cache: false });
  const b = fetcher({ url: "/b", cache: false });
  const c = fetcher({ url: "/c", cache: false });

  await delay(500);

  check("fetcher /a resolved", (a.data as any)?.value === "alpha");
  check("fetcher /b resolved", (b.data as any)?.value === "beta");
  check("fetcher /c resolved", (c.data as any)?.value === "gamma");

  cleanup();
  await server.stop();
}

// ─── Test: destroyAllFetchers stops timers ────────────────

async function testDestroyAllFetchers() {
  console.log("\n--- destroyAllFetchers() ---");
  cleanup();

  let counter = 0;
  const server = new ApiServer();
  server.registerRoutes({
    "GET /tick": async () => ({ count: ++counter }),
  });

  const port = await server.start();
  setApiBaseUrl(server.getBaseUrl());
  (globalThis as any).__terminaltui_render_callback__ = () => {};

  const result = fetcher({ url: "/tick", refreshInterval: 100, cache: false });
  await delay(400);
  const countBefore = counter;
  check("fetcher was actively refreshing", countBefore >= 2);

  destroyAllFetchers();
  await delay(400);
  const countAfter = counter;
  check("no more fetches after destroy", countAfter === countBefore);

  // Verify registry is empty — a new fetcher() should create a fresh instance
  const fresh = fetcher({ url: "/tick", cache: false });
  check("fresh instance created after destroy", fresh !== result);

  cleanup();
  await server.stop();
}

// ─── Run ──────────────────────────────────────────────────

async function main() {
  console.log("=== API Integration Tests ===");

  await testFetcherWithApiServer();
  await testFetcherRegistry();
  await testFetcherWithParams();
  await testRequestWithApiServer();
  await testFetcherAutoRefresh();
  await testFetcherError();
  await testMultipleFetchers();
  await testDestroyAllFetchers();

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
