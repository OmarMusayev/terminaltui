/**
 * Tests for parameterized routes, middleware, and navigation.
 *
 * Run: npx tsx test/test-routing-middleware.ts
 */

import { route } from "../src/routing/route.js";
import { navigate, setNavigateHandler } from "../src/routing/navigate.js";
import { middleware, redirect, runMiddleware } from "../src/middleware/index.js";
import { requireEnv } from "../src/middleware/built-in.js";
import { defineSite, page, card, markdown } from "../src/config/parser.js";
import type { RouteConfig } from "../src/routing/types.js";

// ─── Test Harness ─────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m\u2714\x1b[0m ${name}`);
  } catch (err: any) {
    failed++;
    console.log(`  \x1b[31m\u2718\x1b[0m ${name}`);
    console.log(`    \x1b[31m${err.message}\x1b[0m`);
  }
}

async function testAsync(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  \x1b[32m\u2714\x1b[0m ${name}`);
  } catch (err: any) {
    failed++;
    console.log(`  \x1b[31m\u2718\x1b[0m ${name}`);
    console.log(`    \x1b[31m${err.message}\x1b[0m`);
  }
}

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg);
}

function assertEqual(actual: any, expected: any, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual: any, expected: any, label: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${label}: expected ${e}, got ${a}`);
  }
}

// ─── route() Tests ────────────────────────────────────────

console.log("\nroute()");

test("Creates a RouteConfig with the correct id", () => {
  const r = route("detail", {
    title: "Detail",
    content: (params) => [{ type: "text", content: `ID: ${params.id}`, style: "plain" }],
  });
  assertEqual(r.id, "detail", "id");
});

test("Title can be a function that receives params", () => {
  const r = route("user-profile", {
    title: (params) => `User: ${params.name}`,
    content: (params) => [{ type: "text", content: params.name, style: "plain" }],
  });
  assert(typeof r.title === "function", "title should be a function");
  const titleFn = r.title as (params: Record<string, string>) => string;
  assertEqual(titleFn({ name: "Omar" }), "User: Omar", "title function result");
});

test("Content can be a function that receives params", () => {
  const r = route("item", {
    title: "Item",
    content: (params) => [{ type: "text", content: `Item ${params.id}`, style: "plain" }],
  });
  assert(typeof r.content === "function", "content should be a function");
  const blocks = (r.content as Function)({ id: "42" });
  assertEqual(blocks[0].content, "Item 42", "content function result");
});

test("Loading can be a function that receives params", () => {
  const r = route("product", {
    title: "Product",
    content: (params) => [{ type: "text", content: params.slug, style: "plain" }],
    loading: (params) => `Loading product ${params.slug}...`,
  });
  assert(typeof r.loading === "function", "loading should be a function");
  const loadingFn = r.loading as (params: Record<string, string>) => string;
  assertEqual(loadingFn({ slug: "widget" }), "Loading product widget...", "loading function result");
});

// ─── navigate() Tests ─────────────────────────────────────

console.log("\nnavigate()");

test("navigate() before setNavigateHandler throws", () => {
  // Reset handler to null first
  setNavigateHandler(null);
  let threw = false;
  try {
    navigate("some-page");
  } catch (err: any) {
    threw = true;
    assert(
      err.message.includes("before runtime initialization"),
      `Expected error about runtime initialization, got: ${err.message}`,
    );
  }
  assert(threw, "navigate() should have thrown");
});

test("setNavigateHandler sets the handler", () => {
  let called = false;
  setNavigateHandler((pageId) => {
    called = true;
  });
  navigate("test-page");
  assert(called, "handler should have been called");
  // Clean up
  setNavigateHandler(null);
});

test("navigate('page') calls the handler with correct args", () => {
  let capturedPage: string | undefined;
  let capturedParams: Record<string, string> | undefined;
  setNavigateHandler((pageId, params) => {
    capturedPage = pageId;
    capturedParams = params;
  });
  navigate("home");
  assertEqual(capturedPage, "home", "pageId");
  assertEqual(capturedParams, undefined, "params should be undefined");
  // Clean up
  setNavigateHandler(null);
});

test("navigate('page', { id: 'foo' }) passes params", () => {
  let capturedPage: string | undefined;
  let capturedParams: Record<string, string> | undefined;
  setNavigateHandler((pageId, params) => {
    capturedPage = pageId;
    capturedParams = params;
  });
  navigate("page", { id: "foo" });
  assertEqual(capturedPage, "page", "pageId");
  assertDeepEqual(capturedParams, { id: "foo" }, "params");
  // Clean up
  setNavigateHandler(null);
});

// ─── middleware() Tests ───────────────────────────────────

console.log("\nmiddleware()");

test("middleware(fn) wraps a function", () => {
  const mw = middleware((ctx) => undefined);
  assert(typeof mw === "function", "middleware should return a function");
});

test("The function receives context with page, params, state", () => {
  let receivedCtx: any = null;
  const mw = middleware((ctx) => {
    receivedCtx = ctx;
    return undefined;
  });
  const ctx = { page: "dashboard", params: { id: "123" }, state: { count: 0 } };
  mw(ctx);
  assertEqual(receivedCtx.page, "dashboard", "ctx.page");
  assertDeepEqual(receivedCtx.params, { id: "123" }, "ctx.params");
  assertDeepEqual(receivedCtx.state, { count: 0 }, "ctx.state");
});

// ─── redirect() Tests ─────────────────────────────────────

console.log("\nredirect()");

test("Returns { redirect: pageId }", () => {
  const result = redirect("login");
  assertEqual(result.redirect, "login", "redirect target");
  assertEqual(result.params, undefined, "params should be undefined");
});

test("Returns { redirect: pageId, params } when params provided", () => {
  const result = redirect("user", { id: "abc" });
  assertEqual(result.redirect, "user", "redirect target");
  assertDeepEqual(result.params, { id: "abc" }, "redirect params");
});

// ─── runMiddleware() Tests ────────────────────────────────

console.log("\nrunMiddleware()");

await testAsync("Runs middleware chain in order", async () => {
  const order: number[] = [];
  const chain = [
    middleware(() => { order.push(1); return undefined; }),
    middleware(() => { order.push(2); return undefined; }),
    middleware(() => { order.push(3); return undefined; }),
  ];
  await runMiddleware(chain, { page: "test", params: {}, state: {} });
  assertDeepEqual(order, [1, 2, 3], "execution order");
});

await testAsync("Returns undefined when all middleware pass", async () => {
  const chain = [
    middleware(() => undefined),
    middleware(() => undefined),
  ];
  const result = await runMiddleware(chain, { page: "test", params: {}, state: {} });
  assertEqual(result, undefined, "result");
});

await testAsync("Returns redirect when middleware redirects", async () => {
  const chain = [
    middleware(() => redirect("login")),
  ];
  const result = await runMiddleware(chain, { page: "admin", params: {}, state: {} });
  assert(result !== undefined && result !== null, "result should not be undefined");
  assertEqual((result as any).redirect, "login", "redirect target");
});

await testAsync("Stops chain after first redirect", async () => {
  const order: number[] = [];
  const chain = [
    middleware(() => { order.push(1); return undefined; }),
    middleware(() => { order.push(2); return redirect("login"); }),
    middleware(() => { order.push(3); return undefined; }),
  ];
  const result = await runMiddleware(chain, { page: "admin", params: {}, state: {} });
  assertDeepEqual(order, [1, 2], "should stop after redirect");
  assertEqual((result as any).redirect, "login", "redirect target");
});

await testAsync("Async middleware works", async () => {
  const chain = [
    middleware(async (ctx) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return undefined;
    }),
    middleware(async (ctx) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return redirect("done");
    }),
  ];
  const result = await runMiddleware(chain, { page: "slow", params: {}, state: {} });
  assert(result !== undefined && result !== null, "result should not be undefined");
  assertEqual((result as any).redirect, "done", "async redirect target");
});

// ─── Integration Tests ────────────────────────────────────

console.log("\nIntegration");

test("defineSite accepts pages with RouteConfig entries", () => {
  const homeRoute = route("home", {
    title: "Home",
    content: () => [markdown("Welcome")],
  });
  const detailRoute = route("detail", {
    title: (params) => `Detail: ${params.id}`,
    content: (params) => [markdown(`Showing ${params.id}`)],
  });
  const site = defineSite({
    name: "Test Site",
    pages: [homeRoute, detailRoute],
  });
  assert(site.config.pages.length === 2, "should have 2 pages");
  assertEqual(site.config.pages[0].id, "home", "first page id");
  assertEqual(site.config.pages[1].id, "detail", "second page id");
});

test("Route pages have function titles", () => {
  const r = route("profile", {
    title: (params) => `Profile: ${params.username}`,
    content: (params) => [markdown(`Hello ${params.username}`)],
  });
  const site = defineSite({
    name: "App",
    pages: [r],
  });
  const routePage = site.config.pages[0] as RouteConfig;
  assert(typeof routePage.title === "function", "title should be a function");
  const titleFn = routePage.title as (params: Record<string, string>) => string;
  assertEqual(titleFn({ username: "omar" }), "Profile: omar", "title with params");
});

test("Card with navigate action has the correct structure", () => {
  const c = card({
    title: "View Detail",
    body: "Click to see more",
    action: { navigate: "detail", params: { id: "test" } },
  });
  assertEqual(c.type, "card", "block type");
  assert(c.action !== undefined, "action should exist");
  assertEqual(c.action!.navigate, "detail", "action.navigate");
  assertDeepEqual(c.action!.params, { id: "test" }, "action.params");
});

// ─── Summary ──────────────────────────────────────────────

console.log(`\n\x1b[1mResults: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
