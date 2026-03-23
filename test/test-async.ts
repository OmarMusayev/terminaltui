/**
 * Tests for the async content system:
 *   - AsyncContentManager state transitions, callbacks, needsLoad, reload, setupRefresh, cleanup
 *   - asyncContent() parser helper
 */
import { AsyncContentManager } from "../src/data/async-content.js";
import { createInputState, type AsyncState } from "../src/data/types.js";
import { asyncContent } from "../src/config/parser.js";
import type { ContentBlock } from "../src/config/types.js";

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

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fakeBlocks(): ContentBlock[] {
  return [{ type: "text", content: "hello", style: "plain" }];
}

// ─── Tests ─────────────────────────────────────────────────

async function testLoadSuccess() {
  console.log("\n--- load() success path ---");
  const mgr = new AsyncContentManager();
  const blocks = fakeBlocks();

  let callbackCalled = false;

  const done = new Promise<void>(resolve => {
    mgr.load(
      "key1",
      () => Promise.resolve(blocks),
      () => { callbackCalled = true; resolve(); },
    );
  });

  // Immediately after calling load(), the state should be "loading"
  const stateWhileLoading = mgr.getState("key1");
  check("state is loading immediately after load()", stateWhileLoading?.status === "loading");

  await done;

  check("callback was called after load completes", callbackCalled);

  const stateAfter = mgr.getState("key1");
  check("state transitions to loaded", stateAfter?.status === "loaded");
  check("loaded content is stored correctly", stateAfter?.content === blocks);
  check("lastLoadTime is set", typeof stateAfter?.lastLoadTime === "number" && stateAfter.lastLoadTime > 0);
}

async function testLoadError() {
  console.log("\n--- load() error path ---");
  const mgr = new AsyncContentManager();

  let callbackCalled = false;

  const done = new Promise<void>(resolve => {
    mgr.load(
      "errKey",
      () => Promise.reject(new Error("boom")),
      () => { callbackCalled = true; resolve(); },
    );
  });

  // Should be loading right away
  check("state is loading before rejection", mgr.getState("errKey")?.status === "loading");

  await done;

  check("callback was called after error", callbackCalled);

  const state = mgr.getState("errKey");
  check("state transitions to error", state?.status === "error");
  check("error is stored correctly", state?.error instanceof Error && state.error.message === "boom");
}

async function testNeedsLoad() {
  console.log("\n--- needsLoad() ---");
  const mgr = new AsyncContentManager();

  check("needsLoad returns true for unknown key", mgr.needsLoad("nope") === true);

  const done = new Promise<void>(resolve => {
    mgr.load("nl", () => Promise.resolve(fakeBlocks()), () => resolve());
  });

  // While loading, needsLoad should still be true (status is "loading")
  check("needsLoad returns true while loading", mgr.needsLoad("nl") === true);

  await done;

  check("needsLoad returns false after loaded", mgr.needsLoad("nl") === false);
}

async function testAsyncContentParser() {
  console.log("\n--- asyncContent() parser helper ---");
  const loader = () => Promise.resolve(fakeBlocks());
  const block = asyncContent({ load: loader, loading: "please wait..." });

  check("block type is asyncContent", block.type === "asyncContent");
  check("block has _asyncId string", typeof block._asyncId === "string" && block._asyncId.startsWith("async-"));
  check("block.load is the provided loader", block.load === loader);
  check("block.loading text is preserved", block.loading === "please wait...");

  // A second call should get a different id
  const block2 = asyncContent({ load: loader });
  check("subsequent calls produce unique _asyncId", block2._asyncId !== block._asyncId);
}

async function testSetupRefresh() {
  console.log("\n--- setupRefresh() ---");
  const mgr = new AsyncContentManager();
  let loadCount = 0;

  const loader = (): Promise<ContentBlock[]> => {
    loadCount++;
    return Promise.resolve(fakeBlocks());
  };

  // Do an initial load so state exists
  await new Promise<void>(resolve => {
    mgr.load("refresh", loader, () => resolve());
  });

  const initialCount = loadCount; // should be 1

  // Set up refresh with a short interval
  mgr.setupRefresh("refresh", 50, loader, () => {});

  // Wait long enough for ~3 intervals
  await delay(175);

  mgr.cleanup(); // stop timers before asserting

  check("setupRefresh triggers periodic reloads", loadCount >= initialCount + 2,
    `loadCount=${loadCount}, expected >= ${initialCount + 2}`);

  const state = mgr.getState("refresh");
  check("state is still loaded after refresh", state?.status === "loaded");
}

async function testCleanup() {
  console.log("\n--- cleanup() ---");
  const mgr = new AsyncContentManager();
  let loadCount = 0;

  const loader = (): Promise<ContentBlock[]> => {
    loadCount++;
    return Promise.resolve(fakeBlocks());
  };

  // Initial load
  await new Promise<void>(resolve => {
    mgr.load("clean", loader, () => resolve());
  });

  mgr.setupRefresh("clean", 50, loader, () => {});

  // Let one tick happen
  await delay(75);

  const countBefore = loadCount;
  mgr.cleanup();

  // After cleanup, wait and verify no more loads happen
  await delay(150);

  check("cleanup clears all timers (no further loads)", loadCount === countBefore,
    `loadCount=${loadCount}, expected=${countBefore}`);
}

async function testReload() {
  console.log("\n--- reload() ---");
  const mgr = new AsyncContentManager();

  const blocks1 = fakeBlocks();
  const blocks2: ContentBlock[] = [{ type: "text", content: "reloaded", style: "plain" }];

  let callNum = 0;

  // First load
  await new Promise<void>(resolve => {
    mgr.load("rl", () => {
      callNum++;
      return Promise.resolve(blocks1);
    }, () => resolve());
  });

  check("initial load completes", mgr.getState("rl")?.status === "loaded");

  // Force reload with different content
  await new Promise<void>(resolve => {
    mgr.reload("rl", () => {
      callNum++;
      return Promise.resolve(blocks2);
    }, () => resolve());
  });

  const state = mgr.getState("rl");
  check("reload replaces content", state?.status === "loaded" && state.content === blocks2);
  check("reload called the loader again", callNum === 2);
}

// ─── Run ───────────────────────────────────────────────────

async function main() {
  console.log("=== Async Content System Tests ===");

  await testLoadSuccess();
  await testLoadError();
  await testNeedsLoad();
  await testAsyncContentParser();
  await testSetupRefresh();
  await testCleanup();
  await testReload();

  console.log(`\n${"─".repeat(40)}`);
  console.log(`Total: ${passed + failed}  Passed: ${passed}  Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
