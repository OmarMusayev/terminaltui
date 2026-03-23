import { request } from "../src/data/request.js";
import { DataCache } from "../src/data/cache.js";
import { loadEnv } from "../src/config/env-loader.js";
import { defineConfig } from "../src/config/define-config.js";
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;

function pass(name: string): void {
  passed++;
  console.log(`  \x1b[32mPASS\x1b[0m  ${name}`);
}

function fail(name: string, reason?: string): void {
  failed++;
  console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${reason ? ` — ${reason}` : ""}`);
}

function skip(name: string, reason?: string): void {
  skipped++;
  console.log(`  \x1b[33mSKIP\x1b[0m  ${name}${reason ? ` — ${reason}` : ""}`);
}

function assert(condition: boolean, name: string, reason?: string): void {
  if (condition) pass(name);
  else fail(name, reason);
}

// ── DataCache tests ──────────────────────────────────────────────────────────

function testDataCache(): void {
  console.log("\n\x1b[1m--- DataCache ---\x1b[0m");

  // 1. set() and get() store and retrieve values
  {
    const cache = new DataCache();
    cache.set("key1", { name: "hello" }, 5000);
    const val = cache.get<{ name: string }>("key1");
    assert(val !== undefined && val.name === "hello", "set() and get() store and retrieve values");
  }

  // 2. get() returns undefined for missing keys
  {
    const cache = new DataCache();
    const val = cache.get("nonexistent");
    assert(val === undefined, "get() returns undefined for missing keys");
  }

  // 3. Expired entries (TTL) return undefined
  {
    const cache = new DataCache();
    // Use a TTL of 1ms, then set timestamp in the past by inserting directly
    cache.set("expiring", "data", 1);
    // We need to wait just enough for it to expire
    const start = Date.now();
    while (Date.now() - start < 5) {
      // busy-wait a few ms
    }
    const val = cache.get("expiring");
    assert(val === undefined, "expired entries (TTL) return undefined");
  }

  // 4. delete() removes entries
  {
    const cache = new DataCache();
    cache.set("toDelete", 42, 5000);
    cache.delete("toDelete");
    assert(cache.get("toDelete") === undefined, "delete() removes entries");
  }

  // 5. clear() removes all entries
  {
    const cache = new DataCache();
    cache.set("a", 1, 5000);
    cache.set("b", 2, 5000);
    cache.set("c", 3, 5000);
    cache.clear();
    assert(
      cache.get("a") === undefined && cache.get("b") === undefined && cache.get("c") === undefined,
      "clear() removes all entries"
    );
  }

  // 6. has() returns correct boolean
  {
    const cache = new DataCache();
    cache.set("present", "yes", 5000);
    assert(
      cache.has("present") === true && cache.has("absent") === false,
      "has() returns correct boolean"
    );
  }
}

// ── request() tests ──────────────────────────────────────────────────────────

async function testRequest(): Promise<void> {
  console.log("\n\x1b[1m--- request() ---\x1b[0m");

  // Helper: check if a public API is reachable
  async function isReachable(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  const jsonPlaceholderBase = "https://jsonplaceholder.typicode.com";
  const httpbinBase = "https://httpbin.org";

  // Try jsonplaceholder first, then httpbin
  let getUrl = "";
  let postUrl = "";
  let apiAvailable = false;

  const jpReachable = await isReachable(`${jsonPlaceholderBase}/posts/1`);
  if (jpReachable) {
    getUrl = `${jsonPlaceholderBase}/posts/1`;
    postUrl = `${jsonPlaceholderBase}/posts`;
    apiAvailable = true;
  } else {
    const hbReachable = await isReachable(`${httpbinBase}/get`);
    if (hbReachable) {
      getUrl = `${httpbinBase}/get`;
      postUrl = `${httpbinBase}/post`;
      apiAvailable = true;
    }
  }

  // 1. request.get() against a known public API
  if (apiAvailable) {
    const result = await request.get(getUrl);
    assert(result.ok === true && result.data !== null, "request.get() against public API works");
  } else {
    skip("request.get() against public API works", "no public API reachable");
  }

  // 2. Returns { data, error: null, ok: true } on success
  if (apiAvailable) {
    const result = await request.get(getUrl);
    assert(
      result.error === null && result.ok === true && result.data !== null && result.status === 200,
      "returns { data, error: null, ok: true } on success"
    );
  } else {
    skip("returns { data, error: null, ok: true } on success", "no public API reachable");
  }

  // 3. Returns { error, ok: false } on invalid URL
  {
    const result = await request.get("https://this-domain-does-not-exist-xyz.invalid/nope");
    assert(
      result.ok === false && result.error !== null,
      "returns { error, ok: false } on invalid URL"
    );
  }

  // 4. request.post() sends body correctly
  if (apiAvailable) {
    const body = { title: "test post", body: "hello world", userId: 1 };
    const result = await request.post(postUrl, body);
    assert(
      result.ok === true && result.data !== null,
      "request.post() sends body correctly"
    );
  } else {
    skip("request.post() sends body correctly", "no public API reachable");
  }
}

// ── loadEnv() tests ──────────────────────────────────────────────────────────

function testLoadEnv(): void {
  console.log("\n\x1b[1m--- loadEnv() ---\x1b[0m");

  // Create a unique temp directory for our .env file
  const tempDir = join(tmpdir(), `tui-test-env-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });
  const envPath = join(tempDir, ".env");

  // We use unique key names to avoid collisions with real env vars
  const uniquePrefix = `TUI_TEST_${Date.now()}`;

  const envContent = [
    `# This is a comment`,
    ``,
    `${uniquePrefix}_SIMPLE=hello`,
    `${uniquePrefix}_QUOTED="value with spaces"`,
    `${uniquePrefix}_SINGLE_QUOTED='single quoted value'`,
    `${uniquePrefix}_INLINE=somevalue # inline comment`,
    `${uniquePrefix}_EMPTY=`,
  ].join("\n");

  // Clean up any prior values just in case
  delete process.env[`${uniquePrefix}_SIMPLE`];
  delete process.env[`${uniquePrefix}_QUOTED`];
  delete process.env[`${uniquePrefix}_SINGLE_QUOTED`];
  delete process.env[`${uniquePrefix}_INLINE`];
  delete process.env[`${uniquePrefix}_EMPTY`];

  try {
    writeFileSync(envPath, envContent, "utf-8");

    // 1. Create temp .env and call loadEnv()
    loadEnv(tempDir);
    assert(
      process.env[`${uniquePrefix}_SIMPLE`] === "hello",
      "loadEnv() loads KEY=VALUE pairs"
    );

    // 2. Verify existing env vars are NOT overridden
    {
      // Set a value before loading, then re-load
      const overrideKey = `${uniquePrefix}_OVERRIDE`;
      process.env[overrideKey] = "original";

      // Write a new .env with this key
      const envContent2 = `${overrideKey}=overwritten\n`;
      const tempDir2 = join(tmpdir(), `tui-test-env-override-${Date.now()}`);
      mkdirSync(tempDir2, { recursive: true });
      writeFileSync(join(tempDir2, ".env"), envContent2, "utf-8");

      loadEnv(tempDir2);
      assert(
        process.env[overrideKey] === "original",
        "existing env vars are NOT overridden"
      );

      // Clean up
      delete process.env[overrideKey];
      unlinkSync(join(tempDir2, ".env"));
      rmdirSync(tempDir2);
    }

    // 3. Test quoted values
    assert(
      process.env[`${uniquePrefix}_QUOTED`] === "value with spaces",
      "quoted values: KEY=\"value with spaces\""
    );

    // 4. Test single-quoted values
    assert(
      process.env[`${uniquePrefix}_SINGLE_QUOTED`] === "single quoted value",
      "single-quoted values preserved"
    );

    // 5. Test comments are ignored (the comment line should not create an env var)
    // The comment line starts with #, so it should be skipped.
    // Also verify inline comments are stripped.
    assert(
      process.env[`${uniquePrefix}_INLINE`] === "somevalue",
      "inline comments are stripped"
    );

  } finally {
    // 6. Clean up temp files
    delete process.env[`${uniquePrefix}_SIMPLE`];
    delete process.env[`${uniquePrefix}_QUOTED`];
    delete process.env[`${uniquePrefix}_SINGLE_QUOTED`];
    delete process.env[`${uniquePrefix}_INLINE`];
    delete process.env[`${uniquePrefix}_EMPTY`];

    if (existsSync(envPath)) unlinkSync(envPath);
    if (existsSync(tempDir)) rmdirSync(tempDir);
    pass("temp files cleaned up");
  }
}

// ── defineConfig() tests ─────────────────────────────────────────────────────

function testDefineConfig(): void {
  console.log("\n\x1b[1m--- defineConfig() ---\x1b[0m");

  const uniquePrefix = `TUI_DCFG_${Date.now()}`;

  // 1. Reads from process.env
  {
    const envKey = `${uniquePrefix}_URL`;
    process.env[envKey] = "https://example.com";

    const config = defineConfig({
      apiUrl: { env: envKey },
    });

    assert(config.get("apiUrl") === "https://example.com", "reads from process.env");
    delete process.env[envKey];
  }

  // 2. Uses default values when env var missing
  {
    const envKey = `${uniquePrefix}_MISSING`;
    delete process.env[envKey]; // ensure it does not exist

    const config = defineConfig({
      port: { env: envKey, default: "3000" },
    });

    assert(config.get("port") === "3000", "uses default values when env var missing");
  }

  // 3. Throws on required missing env var
  {
    const envKey = `${uniquePrefix}_REQUIRED`;
    delete process.env[envKey];

    let threw = false;
    try {
      defineConfig({
        secret: { env: envKey, required: true },
      });
    } catch (e: any) {
      threw = true;
      assert(
        e.message.includes(envKey),
        "error message mentions the missing env var name"
      );
    }
    assert(threw, "throws on required missing env var");
  }

  // 4. Transform function works (string to boolean)
  {
    const envKey = `${uniquePrefix}_DEBUG`;
    process.env[envKey] = "true";

    const config = defineConfig({
      debug: { env: envKey, default: false, transform: (v: string) => v === "true" },
    });

    const val = config.get("debug");
    assert(val === true && typeof val === "boolean", "transform function works (string to boolean)");
    delete process.env[envKey];
  }

  // 5. getAll() returns all resolved values
  {
    const envKey1 = `${uniquePrefix}_ALL_A`;
    const envKey2 = `${uniquePrefix}_ALL_B`;
    process.env[envKey1] = "alpha";
    delete process.env[envKey2];

    const config = defineConfig({
      a: { env: envKey1 },
      b: { env: envKey2, default: "beta" },
    });

    const all = config.getAll();
    assert(
      all.a === "alpha" && all.b === "beta",
      "getAll() returns all resolved values"
    );

    delete process.env[envKey1];
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\x1b[1m=== test-data-config.ts ===\x1b[0m");

  testDataCache();
  await testRequest();
  testLoadEnv();
  testDefineConfig();

  console.log("\n\x1b[1m--- Summary ---\x1b[0m");
  console.log(`  Passed:  ${passed}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log();

  if (failed > 0) {
    console.log("\x1b[31mSome tests failed.\x1b[0m");
    process.exit(1);
  } else {
    console.log("\x1b[32mAll tests passed.\x1b[0m");
    process.exit(0);
  }
}

main();
