/**
 * Unit tests for CLI project-shape guards:
 *   - buildProject (src/cli/build.ts) — rejects non-file-based projects
 *   - buildAndRun  (src/cli/dev.ts)   — rejects projects without pages/
 *
 * Only the cheap validation paths are exercised (no esbuild, no runtime
 * boot) — each guard fires before any heavy dynamic import happens.
 */
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "../src/cli/build.js";
import { buildAndRun } from "../src/cli/dev.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { passed++; } else { failed++; console.error(`  FAIL: ${name}`); }
}
function assertIncludes(haystack: string, needle: string, name: string) {
  if (haystack.includes(needle)) { passed++; } else { failed++; console.error(`  FAIL: ${name} — message does not contain ${JSON.stringify(needle)}: ${JSON.stringify(haystack)}`); }
}

async function expectRejection(promise: Promise<unknown>, name: string): Promise<string> {
  try {
    await promise;
    failed++;
    console.error(`  FAIL: ${name} — expected a rejection, but it resolved`);
    return "";
  } catch (err) {
    passed++;
    return err instanceof Error ? err.message : String(err);
  }
}

const origCwd = process.cwd();
const tmp = realpathSync(mkdtempSync(join(tmpdir(), "tui-guards-test-")));

try {
  // ─── buildProject — config filename must be config.ts/js ──

  console.log("\x1b[1m  buildProject — rejects legacy single-file configs\x1b[0m");
  {
    const dir = join(tmp, "single-file");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "site.config.ts"), "export default {};\n");
    // pages/ exists, but the config filename is wrong — still not file-based.
    mkdirSync(join(dir, "pages"), { recursive: true });

    const msg = await expectRejection(
      buildProject(join(dir, "site.config.ts")),
      "site.config.ts is rejected",
    );
    assertIncludes(msg, "requires a file-based project", "error explains the required project shape");
    assertIncludes(msg, "site.config.ts", "error names the offending config file");
    assertIncludes(msg, dir, "error names the project directory");
  }

  // ─── buildProject — pages/ directory is required ─────────

  console.log("\x1b[1m  buildProject — rejects config.ts without pages/\x1b[0m");
  {
    const dir = join(tmp, "no-pages-build");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "config.ts"), "export default {};\n");

    const msg = await expectRejection(
      buildProject(join(dir, "config.ts")),
      "config.ts without pages/ is rejected",
    );
    assertIncludes(msg, "requires a file-based project", "error explains the required project shape");
    assertIncludes(msg, "config.ts", "error names the config file");
  }

  // ─── buildAndRun — pages/ directory is required ──────────

  console.log("\x1b[1m  buildAndRun — rejects projects without pages/\x1b[0m");
  {
    const dir = join(tmp, "no-pages-dev");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "config.ts"), "export default {};\n");

    const msg = await expectRejection(
      buildAndRun(join(dir, "config.ts")),
      "dev on a project without pages/ is rejected",
    );
    assertIncludes(msg, "no pages/ directory", "error explains pages/ is missing");
    assertIncludes(msg, dir, "error names the project directory");
  }

  // ─── buildAndRun — relative paths resolve against cwd ────

  console.log("\x1b[1m  buildAndRun — relative config path resolves against cwd\x1b[0m");
  {
    const dir = join(tmp, "relative-dev");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "config.ts"), "export default {};\n");

    process.chdir(tmp);
    const msg = await expectRejection(
      buildAndRun(join("relative-dev", "config.ts")),
      "relative path without pages/ is rejected",
    );
    process.chdir(origCwd);
    assertIncludes(msg, dir, "error names the absolute project directory resolved from cwd");
  }
} finally {
  process.chdir(origCwd);
  rmSync(tmp, { recursive: true, force: true });
}

// ─── Results ──────────────────────────────────────────────
console.log("");
if (failed > 0) {
  console.log(`  \x1b[31m${passed} passed, ${failed} failed\x1b[0m`);
  process.exit(1);
} else {
  console.log(`  \x1b[32m${passed} passed\x1b[0m, 0 failed`);
}
