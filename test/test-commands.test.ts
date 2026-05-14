#!/usr/bin/env npx tsx
/**
 * Unit tests for `:command` parsing.
 *
 * The executeCommand helper used to lowercase the entire trimmed command
 * before dispatching, which broke `:theme tokyoNight` and `:theme rosePine`
 * — the theme registry keys are camelCase, so the lowercased "tokyonight"
 * never matched. The fix splits verb from argument and only lowercases
 * the verb. These tests pin that behavior so it can't silently re-break.
 */

import { executeCommand } from "../src/core/runtime-pages.js";
import { themes } from "../src/style/theme.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string): void {
  if (condition) { passed++; } else { failed++; console.error(`  FAIL: ${name}`); }
}

/**
 * Build the minimum runtime shape executeCommand reads from. We capture
 * theme writes + feedback messages so we can assert on them.
 */
function makeStubRuntime() {
  const stub = {
    theme: themes.dracula,
    feedbackMessage: "",
    stopped: false,
    site: { easterEggs: undefined as { commands?: Record<string, string | (() => void)> } | undefined },
    isServeMode: false,
    stop() { this.stopped = true; },
    render() { /* no-op */ },
  };
  return stub;
}

console.log("\x1b[1m  :theme — camelCase argument is preserved\x1b[0m");
{
  const rt = makeStubRuntime();
  executeCommand(rt as any, "theme tokyoNight");
  assert(rt.theme === themes.tokyoNight, "tokyoNight applied verbatim");
  assert(rt.feedbackMessage === "Theme: tokyoNight", "feedback message preserves case");
}
{
  const rt = makeStubRuntime();
  executeCommand(rt as any, "theme rosePine");
  assert(rt.theme === themes.rosePine, "rosePine applied verbatim");
}

console.log("\x1b[1m  :theme — verb is case-insensitive\x1b[0m");
{
  const rt = makeStubRuntime();
  executeCommand(rt as any, "THEME nord");
  assert(rt.theme === themes.nord, "uppercase verb still dispatches to theme handler");
}
{
  const rt = makeStubRuntime();
  executeCommand(rt as any, "  Theme   dracula  ");
  assert(rt.theme === themes.dracula, "leading/trailing whitespace + mixed-case verb both handled");
}

console.log("\x1b[1m  :theme — unknown name falls through to feedback\x1b[0m");
{
  const rt = makeStubRuntime();
  executeCommand(rt as any, "theme notARealTheme");
  assert(rt.theme === themes.dracula, "theme unchanged on unknown name");
  assert(rt.feedbackMessage === "Unknown theme: notARealTheme", "feedback identifies the bad arg verbatim");
}

console.log("\x1b[1m  :quit / :q — both stop the runtime\x1b[0m");
{
  const rt = makeStubRuntime();
  executeCommand(rt as any, "quit");
  assert(rt.stopped, ":quit stops runtime");
}
{
  const rt = makeStubRuntime();
  executeCommand(rt as any, "Q");
  assert(rt.stopped, ":Q (uppercase) also stops runtime");
}

console.log("\x1b[1m  Easter eggs — lowercase key lookup preserved\x1b[0m");
{
  let fired = "";
  const rt = makeStubRuntime();
  rt.site.easterEggs = {
    commands: {
      "dance": "🕺 you can dance if you want to",
    },
  };
  executeCommand(rt as any, "DANCE");
  assert(rt.feedbackMessage.includes("dance if you want to"), "easter egg matches case-insensitively against lowercase key");
}

console.log("\x1b[1m  Unknown command — fallback feedback\x1b[0m");
{
  const rt = makeStubRuntime();
  executeCommand(rt as any, "notarealcommand");
  assert(rt.feedbackMessage === "Unknown command: notarealcommand", "unknown verbs surface a feedback line");
}

console.log("");
if (failed > 0) {
  console.log(`  \x1b[31m${passed} passed, ${failed} failed\x1b[0m`);
  process.exit(1);
} else {
  console.log(`  \x1b[32m${passed} passed\x1b[0m, 0 failed`);
}
