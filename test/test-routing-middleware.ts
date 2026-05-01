/**
 * Tests for navigation handler and middleware chains.
 *
 * Run: npx tsx test/test-routing-middleware.ts
 */

import { navigate, setNavigateHandler } from "../src/router/navigate.js";
import { middleware, redirect, runMiddleware } from "../src/middleware/index.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } catch (err: any) {
    failed++;
    console.log(`  \x1b[31m✘\x1b[0m ${name}`);
    console.log(`    \x1b[31m${err.message}\x1b[0m`);
  }
}

async function testAsync(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } catch (err: any) {
    failed++;
    console.log(`  \x1b[31m✘\x1b[0m ${name}`);
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

// ─── navigate() Tests ─────────────────────────────────────

console.log("\nnavigate()");

test("navigate() before setNavigateHandler throws", () => {
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
  setNavigateHandler(() => {
    called = true;
  });
  navigate("test-page");
  assert(called, "handler should have been called");
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
  setNavigateHandler(null);
});

// ─── middleware() Tests ───────────────────────────────────

console.log("\nmiddleware()");

test("middleware(fn) wraps a function", () => {
  const mw = middleware(() => undefined);
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
    middleware(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return undefined;
    }),
    middleware(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return redirect("done");
    }),
  ];
  const result = await runMiddleware(chain, { page: "slow", params: {}, state: {} });
  assert(result !== undefined && result !== null, "result should not be undefined");
  assertEqual((result as any).redirect, "done", "async redirect target");
});

await testAsync("Throwing middleware rejects the chain promise", async () => {
  const chain = [
    middleware(() => undefined),
    middleware(() => { throw new Error("blocked"); }),
  ];
  let caught: Error | null = null;
  try {
    await runMiddleware(chain, { page: "x", params: {}, state: {} });
  } catch (err) {
    caught = err as Error;
  }
  assert(caught !== null, "should reject");
  assertEqual(caught!.message, "blocked", "error message preserved");
});

console.log(`\n\x1b[1mResults: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
