/**
 * Tests for the API routes system:
 *   - Route parsing (method + path + params)
 *   - ApiServer HTTP handling (GET, POST, params, query, body, errors, 404)
 *   - resolveUrl integration
 *   - Clean server shutdown
 */
import { ApiServer } from "../src/api/server.js";
import { parseRouteKey, parseRoutes, matchRoute } from "../src/api/router.js";
import { setApiBaseUrl, getApiBaseUrl, resolveUrl } from "../src/api/resolve.js";
import type { ApiRequest } from "../src/api/types.js";

// ─── Helpers ───────────────────────────────────────────────

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

// ─── Router Tests ─────────────────────────────────────────

function testParseRouteKey() {
  console.log("\n--- parseRouteKey ---");

  const r1 = parseRouteKey("GET /hello");
  check("simple GET method", r1.method === "GET");
  check("simple GET pattern matches /hello", r1.pattern.test("/hello"));
  check("simple GET no params", r1.paramNames.length === 0);

  const r2 = parseRouteKey("POST /containers/:id/restart");
  check("POST method", r2.method === "POST");
  check("POST pattern matches /containers/abc123/restart", r2.pattern.test("/containers/abc123/restart"));
  check("POST pattern rejects /containers/restart", !r2.pattern.test("/containers/restart"));
  check("POST extracts :id param name", r2.paramNames.length === 1 && r2.paramNames[0] === "id");

  const r3 = parseRouteKey("GET /users/:userId/posts/:postId");
  check("multi-param extracts both", r3.paramNames.length === 2);
  check("multi-param names correct", r3.paramNames[0] === "userId" && r3.paramNames[1] === "postId");
  const m3 = "/users/42/posts/99".match(r3.pattern);
  check("multi-param match extracts values", m3 !== null && m3[1] === "42" && m3[2] === "99");
}

function testMatchRoute() {
  console.log("\n--- matchRoute ---");

  const routes = parseRoutes({
    "GET /hello": async () => ({ msg: "hi" }),
    "POST /echo": async (req) => req.body,
    "GET /items/:id": async (req) => ({ id: req.params.id }),
    "DELETE /items/:id": async (req) => ({ deleted: req.params.id }),
  });

  const m1 = matchRoute(routes, "GET", "/hello");
  check("matches GET /hello", m1 !== null);

  const m2 = matchRoute(routes, "POST", "/hello");
  check("rejects POST /hello", m2 === null);

  const m3 = matchRoute(routes, "GET", "/items/42");
  check("matches GET /items/42", m3 !== null);
  check("extracts id=42", m3?.params.id === "42");

  const m4 = matchRoute(routes, "DELETE", "/items/42");
  check("matches DELETE /items/42", m4 !== null);

  const m5 = matchRoute(routes, "GET", "/notfound");
  check("returns null for unmatched path", m5 === null);
}

// ─── resolveUrl Tests ─────────────────────────────────────

function testResolveUrl() {
  console.log("\n--- resolveUrl ---");

  // No base URL set
  setApiBaseUrl(null);
  check("relative URL without base passes through", resolveUrl("/hello") === "/hello");
  check("absolute URL passes through", resolveUrl("https://example.com/api") === "https://example.com/api");

  // With base URL set
  setApiBaseUrl("http://127.0.0.1:12345");
  check("relative URL resolves", resolveUrl("/hello") === "http://127.0.0.1:12345/hello");
  check("absolute URL still passes through", resolveUrl("https://example.com/api") === "https://example.com/api");
  check("getApiBaseUrl returns the URL", getApiBaseUrl() === "http://127.0.0.1:12345");

  // Clean up
  setApiBaseUrl(null);
}

// ─── Server Tests ─────────────────────────────────────────

async function testServerBasicGet() {
  console.log("\n--- ApiServer: basic GET ---");
  const server = new ApiServer();
  server.registerRoutes({
    "GET /hello": async () => ({ message: "Hello from the API!" }),
    "GET /time": async () => ({ time: "2024-01-01T00:00:00Z" }),
  });

  const port = await server.start();
  check("starts on random port", port > 0);
  check("getPort returns same port", server.getPort() === port);
  check("getBaseUrl is correct", server.getBaseUrl() === `http://127.0.0.1:${port}`);

  const res = await fetch(`http://127.0.0.1:${port}/hello`);
  check("GET /hello returns 200", res.status === 200);
  const data = await res.json();
  check("GET /hello returns correct body", data.message === "Hello from the API!");

  const res2 = await fetch(`http://127.0.0.1:${port}/time`);
  const data2 = await res2.json();
  check("GET /time returns correct body", data2.time === "2024-01-01T00:00:00Z");

  await server.stop();
}

async function testServerPost() {
  console.log("\n--- ApiServer: POST with body ---");
  const server = new ApiServer();
  server.registerRoutes({
    "POST /echo": async (req) => ({ echoed: req.body }),
  });

  const port = await server.start();

  const res = await fetch(`http://127.0.0.1:${port}/echo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "test", value: 42 }),
  });
  check("POST /echo returns 200", res.status === 200);
  const data = await res.json();
  check("POST /echo echoes body", data.echoed.name === "test" && data.echoed.value === 42);

  await server.stop();
}

async function testServerParams() {
  console.log("\n--- ApiServer: URL params ---");
  const server = new ApiServer();
  server.registerRoutes({
    "GET /items/:id": async (req) => ({ id: req.params.id, name: `Item ${req.params.id}` }),
    "GET /users/:userId/posts/:postId": async (req) => ({
      userId: req.params.userId,
      postId: req.params.postId,
    }),
  });

  const port = await server.start();

  const res = await fetch(`http://127.0.0.1:${port}/items/42`);
  const data = await res.json();
  check("extracts single param", data.id === "42" && data.name === "Item 42");

  const res2 = await fetch(`http://127.0.0.1:${port}/users/alice/posts/7`);
  const data2 = await res2.json();
  check("extracts multiple params", data2.userId === "alice" && data2.postId === "7");

  await server.stop();
}

async function testServerQuery() {
  console.log("\n--- ApiServer: query strings ---");
  const server = new ApiServer();
  server.registerRoutes({
    "GET /search": async (req) => ({ q: req.query.q, page: req.query.page }),
  });

  const port = await server.start();

  const res = await fetch(`http://127.0.0.1:${port}/search?q=hello&page=2`);
  const data = await res.json();
  check("extracts query params", data.q === "hello" && data.page === "2");

  await server.stop();
}

async function testServer404() {
  console.log("\n--- ApiServer: 404 ---");
  const server = new ApiServer();
  server.registerRoutes({
    "GET /exists": async () => ({ ok: true }),
  });

  const port = await server.start();

  const res = await fetch(`http://127.0.0.1:${port}/nope`);
  check("returns 404 for unknown route", res.status === 404);
  const data = await res.json();
  check("404 body has error field", data.error === "Not found");

  await server.stop();
}

async function testServerError() {
  console.log("\n--- ApiServer: handler error → 500 ---");
  const server = new ApiServer();
  server.registerRoutes({
    "GET /fail": async () => {
      throw new Error("Something broke");
    },
  });

  const port = await server.start();

  const res = await fetch(`http://127.0.0.1:${port}/fail`);
  check("returns 500 for handler error", res.status === 500);
  const data = await res.json();
  check("500 body has error message", data.error === "Something broke");

  await server.stop();
}

async function testServerCors() {
  console.log("\n--- ApiServer: CORS preflight ---");
  const server = new ApiServer();
  server.registerRoutes({
    "GET /data": async () => ({ ok: true }),
  });

  const port = await server.start();

  const res = await fetch(`http://127.0.0.1:${port}/data`, { method: "OPTIONS" });
  check("OPTIONS returns 204", res.status === 204);
  check("has CORS allow-origin header", res.headers.get("access-control-allow-origin") === "*");

  await server.stop();
}

async function testServerAllMethods() {
  console.log("\n--- ApiServer: PUT, DELETE, PATCH ---");
  const server = new ApiServer();
  server.registerRoutes({
    "PUT /items/:id": async (req) => ({ method: "PUT", id: req.params.id, body: req.body }),
    "DELETE /items/:id": async (req) => ({ method: "DELETE", id: req.params.id }),
    "PATCH /items/:id": async (req) => ({ method: "PATCH", id: req.params.id, body: req.body }),
  });

  const port = await server.start();

  const put = await fetch(`http://127.0.0.1:${port}/items/1`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "updated" }),
  });
  const putData = await put.json();
  check("PUT works", putData.method === "PUT" && putData.body.name === "updated");

  const del = await fetch(`http://127.0.0.1:${port}/items/1`, { method: "DELETE" });
  const delData = await del.json();
  check("DELETE works", delData.method === "DELETE" && delData.id === "1");

  const patch = await fetch(`http://127.0.0.1:${port}/items/1`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "patched" }),
  });
  const patchData = await patch.json();
  check("PATCH works", patchData.method === "PATCH" && patchData.body.name === "patched");

  await server.stop();
}

async function testServerDynamicState() {
  console.log("\n--- ApiServer: stateful counter ---");
  let counter = 0;
  const server = new ApiServer();
  server.registerRoutes({
    "GET /counter": async () => ({ count: ++counter }),
    "POST /reset": async () => { counter = 0; return { count: 0 }; },
  });

  const port = await server.start();

  const r1 = await fetch(`http://127.0.0.1:${port}/counter`);
  const d1 = await r1.json();
  check("counter starts at 1", d1.count === 1);

  const r2 = await fetch(`http://127.0.0.1:${port}/counter`);
  const d2 = await r2.json();
  check("counter increments to 2", d2.count === 2);

  await fetch(`http://127.0.0.1:${port}/reset`, { method: "POST" });
  const r3 = await fetch(`http://127.0.0.1:${port}/counter`);
  const d3 = await r3.json();
  check("counter resets and increments to 1", d3.count === 1);

  await server.stop();
}

async function testServerCleanShutdown() {
  console.log("\n--- ApiServer: clean shutdown ---");
  const server = new ApiServer();
  server.registerRoutes({
    "GET /ping": async () => ({ pong: true }),
  });

  const port = await server.start();

  // Verify it works
  const res = await fetch(`http://127.0.0.1:${port}/ping`);
  check("server responds before stop", res.status === 200);

  await server.stop();

  // Verify it's stopped
  try {
    await fetch(`http://127.0.0.1:${port}/ping`);
    check("server rejects after stop", false, "connection should have failed");
  } catch {
    check("server rejects after stop", true);
  }
}

async function testResolveUrlIntegration() {
  console.log("\n--- resolveUrl + ApiServer integration ---");
  const server = new ApiServer();
  server.registerRoutes({
    "GET /data": async () => ({ source: "local-api" }),
  });

  const port = await server.start();
  setApiBaseUrl(server.getBaseUrl());

  const resolved = resolveUrl("/data");
  check("resolveUrl produces correct URL", resolved === `http://127.0.0.1:${port}/data`);

  const res = await fetch(resolved);
  const data = await res.json();
  check("fetch via resolved URL works", data.source === "local-api");

  await server.stop();
  setApiBaseUrl(null);
}

// ─── Run ──────────────────────────────────────────────────

async function main() {
  console.log("=== API Routes Tests ===");

  // Router tests (synchronous)
  testParseRouteKey();
  testMatchRoute();
  testResolveUrl();

  // Server tests (async)
  await testServerBasicGet();
  await testServerPost();
  await testServerParams();
  await testServerQuery();
  await testServer404();
  await testServerError();
  await testServerCors();
  await testServerAllMethods();
  await testServerDynamicState();
  await testServerCleanShutdown();
  await testResolveUrlIntegration();

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
