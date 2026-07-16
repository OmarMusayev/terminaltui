/**
 * Unit tests for `terminaltui art create` / `art validate` (src/cli/art-helpers.ts).
 *
 * These helpers operate on process.cwd()/art and call process.exit(1) on bad
 * input, so the suite runs inside a throwaway os.tmpdir() directory with
 * process.exit trapped (it throws a sentinel instead of killing the suite)
 * and console output captured for assertions.
 */
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { artCreate, artValidate } from "../src/cli/art-helpers.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { passed++; } else { failed++; console.error(`  FAIL: ${name}`); }
}
function assertIncludes(haystack: string, needle: string, name: string) {
  if (haystack.includes(needle)) { passed++; } else { failed++; console.error(`  FAIL: ${name} — output does not contain ${JSON.stringify(needle)}`); }
}

// ─── Harness: trap process.exit, capture console ──────────

class ExitSignal extends Error {
  constructor(public code: number) { super(`process.exit(${code})`); }
}

interface RunResult { out: string; err: string; exitCode: number | null; }

function run(fn: () => void): RunResult {
  const origExit = process.exit;
  const origLog = console.log;
  const origError = console.error;
  let out = "";
  let err = "";
  let exitCode: number | null = null;
  (process as { exit: (code?: number) => never }).exit = ((code?: number) => {
    exitCode = code ?? 0;
    throw new ExitSignal(exitCode);
  }) as (code?: number) => never;
  console.log = (...a: unknown[]) => { out += a.map(String).join(" ") + "\n"; };
  console.error = (...a: unknown[]) => { err += a.map(String).join(" ") + "\n"; };
  try {
    fn();
  } catch (e) {
    if (!(e instanceof ExitSignal)) throw e;
  } finally {
    process.exit = origExit;
    console.log = origLog;
    console.error = origError;
  }
  return { out, err, exitCode };
}

const origCwd = process.cwd();
const tmp = realpathSync(mkdtempSync(join(tmpdir(), "tui-art-test-")));
process.chdir(tmp);

try {
  // ─── artValidate with no art/ directory ─────────────────

  console.log("\x1b[1m  artValidate — no art/ directory\x1b[0m");
  {
    const r = run(() => artValidate());
    assert(r.exitCode === null, "does not exit when art/ is missing");
    assertIncludes(r.out, "No art/ directory found", "explains that art/ is missing");
  }

  // ─── artCreate — argument validation ────────────────────

  console.log("\x1b[1m  artCreate — argument validation\x1b[0m");
  {
    const r = run(() => artCreate([]));
    assert(r.exitCode === 1, "missing args exits 1");
    assertIncludes(r.err, "Usage: terminaltui art create", "missing args prints usage");
  }
  {
    const r = run(() => artCreate(["banner", "x"]));
    assert(r.exitCode === 1, "invalid type exits 1");
    assertIncludes(r.err, 'Invalid type: "banner"', "invalid type is named in the error");
  }
  {
    const r = run(() => artCreate(["scene", "bad name"]));
    assert(r.exitCode === 1, "name with a space exits 1");
    assertIncludes(r.err, "Invalid name", "name with a space is rejected");
  }
  {
    const r = run(() => artCreate(["scene", "-leading-dash"]));
    assert(r.exitCode === 1, "name starting with '-' exits 1");
  }
  {
    const r = run(() => artCreate(["icon", "My_Icon-2"]));
    assert(r.exitCode === null, "mixed-case name with _ and - is accepted");
    assert(existsSync(join(tmp, "art", "icons", "My_Icon-2.txt")), "accepted name creates the file");
  }

  // ─── artCreate — templates ──────────────────────────────

  console.log("\x1b[1m  artCreate — templates\x1b[0m");
  {
    const r = run(() => artCreate(["scene", "my-scene"]));
    assert(r.exitCode === null, "scene create succeeds");
    assertIncludes(r.out, "Created scene template", "scene create reports the file");
    const file = join(tmp, "art", "scenes", "my-scene.txt");
    assert(existsSync(file), "scene file written to art/scenes/");
    const content = readFileSync(file, "utf-8");
    assertIncludes(content, "# my-scene", "scene template embeds the name as a comment");
    assert(
      content.split("\n").some(l => !l.startsWith("#") && l.trim().length > 0),
      "scene template has non-comment art content",
    );
  }
  {
    run(() => artCreate(["icon", "rocket"]));
    const content = readFileSync(join(tmp, "art", "icons", "rocket.txt"), "utf-8");
    assertIncludes(content, "R", "icon template uses the uppercased first letter");
  }
  {
    run(() => artCreate(["pattern", "my-pattern"]));
    const content = readFileSync(join(tmp, "art", "patterns", "my-pattern.txt"), "utf-8");
    assert(content.split("\n")[0] === "# tile: 4x2", "pattern template starts with tile metadata");
  }
  {
    const r = run(() => artCreate(["scene", "my-scene"]));
    assert(r.exitCode === 1, "duplicate create exits 1");
    assertIncludes(r.err, "already exists", "duplicate create names the conflict");
  }

  // ─── artValidate — mixed asset quality ──────────────────

  console.log("\x1b[1m  artValidate — mixed asset quality\x1b[0m");
  {
    // Alongside the 4 valid files created above, plant known-bad assets.
    mkdirSync(join(tmp, "art", "fonts"), { recursive: true });
    writeFileSync(join(tmp, "art", "fonts", "bad.flf"), "not a figlet font\n");
    writeFileSync(join(tmp, "art", "fonts", "good.flf"), "flf2a$ 6 5 20 15 3\nfont data here\n");
    writeFileSync(join(tmp, "art", "scenes", "wrong.md"), "art\n");
    writeFileSync(join(tmp, "art", "icons", "empty.txt"), "");
    writeFileSync(join(tmp, "art", "icons", "comments.txt"), "# only\n# comments\n");
    writeFileSync(join(tmp, "art", "patterns", "notile.txt"), "+-\n-+\n");
    writeFileSync(join(tmp, "art", "scenes", "_draft.txt"), "should be skipped\n");
    writeFileSync(join(tmp, "art", "scenes", ".hidden.txt"), "should be skipped\n");

    const r = run(() => artValidate());
    assert(r.exitCode === null, "validate never exits");
    assertIncludes(r.out, "[ok] scenes/my-scene.txt", "valid scene passes");
    assertIncludes(r.out, "[ok] fonts/good.flf", "font with flf2 header passes");
    assertIncludes(r.out, "[!] fonts/bad.flf - invalid FLF header", "font without flf2 header flagged");
    assertIncludes(r.out, '[!] scenes/wrong.md - unexpected extension ".md"', "wrong extension flagged");
    assertIncludes(r.out, "[!] icons/empty.txt - file is empty", "empty file flagged");
    assertIncludes(r.out, "[!] icons/comments.txt - no art content", "comments-only file flagged");
    assertIncludes(r.out, "[~] patterns/notile.txt - no tile size metadata", "missing tile metadata is a note, not an issue");
    assert(!r.out.includes("_draft"), "underscore-prefixed files are skipped");
    assert(!r.out.includes(".hidden"), "dot-prefixed files are skipped");
    // 6 valid: my-scene, My_Icon-2, rocket, my-pattern, good.flf, notile
    // 4 issues: bad.flf, wrong.md, empty.txt, comments.txt — 10 files total
    assertIncludes(r.out, "Results: 6 valid, 4 issues, 10 total files", "summary counts valid/issues/total correctly");
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
