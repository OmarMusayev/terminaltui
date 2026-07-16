/**
 * CLI dispatch tests for src/cli/index.ts — exit codes, error messages, and
 * the version/help/demo-listing output. Each case is a short-lived tsx
 * subprocess (no PTY, no TUI boot): every command under test bails out
 * before any heavy dynamic import runs.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { passed++; } else { failed++; console.error(`  FAIL: ${name}`); }
}
function assertIncludes(haystack: string, needle: string, name: string) {
  if (haystack.includes(needle)) { passed++; } else { failed++; console.error(`  FAIL: ${name} — output does not contain ${JSON.stringify(needle)}`); }
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TSX = join(REPO_ROOT, "node_modules", ".bin", "tsx");
const CLI = join(REPO_ROOT, "src", "cli", "index.ts");

interface CliResult { status: number | null; stdout: string; stderr: string; }

function cli(args: string[], cwd: string = REPO_ROOT): CliResult {
  const r = spawnSync(TSX, [CLI, ...args], {
    cwd,
    encoding: "utf-8",
    timeout: 30000,
    env: process.env,
  });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

const emptyDir = realpathSync(mkdtempSync(join(tmpdir(), "tui-dispatch-test-")));

try {
  // ─── version / help ──────────────────────────────────────

  console.log("\x1b[1m  version and help\x1b[0m");
  {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf-8"));
    const r = cli(["--version"]);
    assert(r.status === 0, "--version exits 0");
    assertIncludes(r.stdout, `terminaltui v${pkg.version}`, "--version prints the package.json version");

    const alias = cli(["-v"]);
    assert(alias.status === 0 && alias.stdout === r.stdout, "-v is an alias for --version");
  }
  {
    const r = cli(["help"]);
    assert(r.status === 0, "help exits 0");
    assertIncludes(r.stdout, "Commands:", "help lists commands");
    assertIncludes(r.stdout, "serve", "help mentions serve");
    assertIncludes(r.stdout, "--cols=N", "help documents test options");
  }

  // ─── unknown command ─────────────────────────────────────

  console.log("\x1b[1m  unknown command\x1b[0m");
  {
    const r = cli(["blorp"]);
    assert(r.status === 1, "unknown command exits 1");
    assertIncludes(r.stderr, "Unknown command: blorp", "unknown command is named on stderr");
    assertIncludes(r.stdout, "Usage:", "help is printed after an unknown command");
  }

  // ─── demo listing and validation ─────────────────────────

  console.log("\x1b[1m  demo listing and validation\x1b[0m");
  {
    const r = cli(["demo"]);
    assert(r.status === 0, "bare demo exits 0");
    assertIncludes(r.stdout, "Available demos:", "bare demo lists demos");
    assertIncludes(r.stdout, "welcome", "demo list includes welcome");
    assertIncludes(r.stdout, "server-dashboard", "demo list includes server-dashboard");
  }
  {
    const r = cli(["demo", "nope"]);
    assert(r.status === 1, "unknown demo exits 1");
    assertIncludes(r.stderr, "Unknown demo: nope", "unknown demo is named on stderr");
    assertIncludes(r.stderr, "restaurant", "unknown demo error lists available names");
  }

  // ─── config resolution failures ──────────────────────────

  console.log("\x1b[1m  config resolution failures\x1b[0m");
  {
    const missing = join(emptyDir, "definitely", "missing", "config.ts");
    const r = cli(["dev", missing]);
    assert(r.status === 1, "dev with a missing explicit path exits 1");
    assertIncludes(r.stderr, `Config file not found: ${missing}`, "dev names the missing config path");
  }
  {
    const r = cli(["build"], emptyDir);
    assert(r.status === 1, "build in an empty directory exits 1");
    assertIncludes(r.stderr, "No config.ts found alongside a pages/ directory.", "build explains what was expected");
  }
  {
    const r = cli([], emptyDir);
    assert(r.status === 1, "bare invocation in an empty directory exits 1 (implicit dev)");
    assertIncludes(r.stderr, "No config.ts found alongside a pages/ directory.", "implicit dev explains what was expected");
    assertIncludes(r.stderr, "terminaltui init", "implicit dev suggests init");
  }
} finally {
  rmSync(emptyDir, { recursive: true, force: true });
}

// ─── Results ──────────────────────────────────────────────
console.log("");
if (failed > 0) {
  console.log(`  \x1b[31m${passed} passed, ${failed} failed\x1b[0m`);
  process.exit(1);
} else {
  console.log(`  \x1b[32m${passed} passed\x1b[0m, 0 failed`);
}
