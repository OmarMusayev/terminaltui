#!/usr/bin/env npx tsx
/**
 * Line-diff renderer test (Wave 5 Stage A).
 *
 * Unit level — drives writeToTerminal directly with mock runtimes:
 *   1. first frame is a full redraw (every row cursor-positioned),
 *   2. identical frame emits zero bytes,
 *   3. single-row change emits only that row (+ cursor park),
 *   4. resize / invalidateFrame force full redraws,
 *   5. per-runtime frame buffers do not cross-contaminate (SSH scoping),
 *   6. overlays (feedback, command mode) compose into the bottom row,
 *   7. cursor DECTCEM is edge-triggered and wraps painting when visible,
 *   8. GRID IDENTITY: replaying a frame sequence through the legacy
 *      full-frame writer and the diff writer into two VirtualTerminals
 *      yields identical text AND identical styled (ansi) grids.
 *
 * Intended deltas vs legacy (pinned explicitly, NOT via the legacy oracle):
 *   - overlay text with row-crossing control chars is sanitized (legacy
 *      emitted a raw LF that scrolled the alt screen),
 *   - over-wide overlays truncate to the terminal width (legacy wrapped
 *      and scrolled),
 *   - out-of-band bytes + invalidateFrame must heal on the next render.
 *
 * E2E level — launches the startup demo once through TUIEmulator:
 *   9. a no-op keypress (left on home) transmits ~zero bytes,
 *  10. a menu move transmits a small fraction of a full frame and the
 *      grid updates correctly; page enter/exit still renders correctly.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { writeToTerminal, truncateLine, createRenderContext } from "../src/core/runtime-terminal.js";
import type { RuntimeInternal, FrameState } from "../src/core/runtime-internal.js";
import { defaultTheme } from "../src/style/theme.js";
import { fgColor, reset } from "../src/style/colors.js";
import { renderInput } from "../src/components/Input.js";
import { stringWidth } from "../src/components/base.js";
import { TUIEmulator, VirtualTerminal, ScreenReader } from "../src/emulator/index.js";

// ─── Harness ─────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(cond: boolean, message: string): void {
  if (cond) {
    passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${message}`);
  } else {
    failed++;
    console.error(`  \x1b[31m✘\x1b[0m ${message}`);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual === expected) {
    passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${message}`);
  } else {
    failed++;
    console.error(`  \x1b[31m✘\x1b[0m ${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ─── Mock runtime ────────────────────────────────────────────

interface MockRt {
  commandMode: boolean;
  commandBuffer: string;
  feedbackMessage: string;
  theme: typeof defaultTheme;
  borderStyle: string;
  notifications: { current: { type: string; message: string } | null };
  inputMode: { isEditing: boolean };
  frameState: FrameState;
  writes: string[];
  writeOutput(data: string): void;
  invalidateFrame(): void;
  /** Kitty placements are settled against the composed frame; nothing to settle here. */
  graphicsCommit(frameRows: readonly string[]): void;
}

function makeRt(): MockRt {
  const rt: MockRt = {
    commandMode: false,
    commandBuffer: "",
    feedbackMessage: "",
    theme: defaultTheme,
    borderStyle: "rounded",
    notifications: { current: null },
    inputMode: { isEditing: false },
    frameState: { rows: [], columns: 0, rowCount: 0, cursorShown: false, valid: false },
    writes: [],
    writeOutput(data: string) { this.writes.push(data); },
    invalidateFrame() { this.frameState.valid = false; },
    graphicsCommit() { /* this mock never places an image */ },
  };
  return rt;
}

function write(rt: MockRt, lines: string[], columns: number, rows: number): string {
  const before = rt.writes.length;
  writeToTerminal(rt as unknown as RuntimeInternal, lines, columns, rows);
  return rt.writes.slice(before).join("");
}

/**
 * Count row EMISSIONS for the given 1-based row: an emitted row is always
 * `CUP row;1` + reset + EL, which distinguishes it from the cursor park
 * (a bare CUP that can also land on column 1 of the bottom row).
 */
function cupCount(out: string, row: number): number {
  return out.split(`\x1b[${row};1H\x1b[0m\x1b[2K`).length - 1;
}

// ─── Legacy full-frame writer (pre-Wave-5 replica, grid oracle) ──

function legacyWrite(rt: MockRt, lines: string[], columns: number, rows: number): string {
  let output = "\x1b[H";
  for (let i = 0; i < rows; i++) {
    output += "\x1b[0m\x1b[2K";
    if (i < lines.length) {
      const line = lines[i];
      if (stringWidth(line) > columns) output += truncateLine(line, columns);
      else output += line;
    }
    if (i < rows - 1) output += "\r\n";
  }
  if (rt.commandMode) {
    output += `\x1b[${rows};1H\x1b[2K`;
    output += renderInput(":", rt.commandBuffer, createRenderContext(rt as unknown as RuntimeInternal, columns)).join("");
  } else {
    const notification = rt.notifications.current;
    if (notification) {
      let color: string, icon: string;
      switch (notification.type) {
        case "success": color = rt.theme.success; icon = "✓"; break;
        case "error": color = rt.theme.error; icon = "✗"; break;
        default: color = rt.theme.accent; icon = "ℹ"; break;
      }
      output += `\x1b[${rows};1H\x1b[2K`;
      output += fgColor(color) + "  " + icon + " " + notification.message + reset;
    } else if (rt.feedbackMessage) {
      output += `\x1b[${rows};1H\x1b[2K`;
      output += fgColor(rt.theme.success) + "  " + rt.feedbackMessage + reset;
    }
  }
  output += rt.inputMode.isEditing ? "\x1b[?25h" : "\x1b[?25l";
  return output;
}

// ─── Unit tests ──────────────────────────────────────────────

function testFullRedrawFirstFrame(): void {
  console.log("\n\x1b[1m  first frame = full redraw\x1b[0m");
  const rt = makeRt();
  const out = write(rt, ["alpha", "beta"], 20, 4);
  for (let r = 1; r <= 4; r++) {
    assertEqual(cupCount(out, r), 1, `row ${r} emitted exactly once`);
  }
  assert(out.includes("\x1b[1;1H\x1b[0m\x1b[2Kalpha"), "row 1 carries reset+EL+content payload");
  assert(out.includes("\x1b[2;1H\x1b[0m\x1b[2Kbeta"), "row 2 carries reset+EL+content payload");
  assert(out.endsWith("\x1b[?25l"), "frame ends hiding the cursor (not editing)");
  assert(!out.includes("\r\n"), "no CR-LF is ever emitted");
}

function testZeroChangeFrame(): void {
  console.log("\n\x1b[1m  identical frame = zero bytes\x1b[0m");
  const rt = makeRt();
  write(rt, ["alpha", "beta"], 20, 4);
  const out = write(rt, ["alpha", "beta"], 20, 4);
  assertEqual(out, "", "second identical frame writes nothing");
  assertEqual(rt.writes.length, 1, "writeOutput not even called for a no-op frame");
}

function testSingleRowChange(): void {
  console.log("\n\x1b[1m  single-row change emits only that row\x1b[0m");
  const rt = makeRt();
  write(rt, ["alpha", "beta", "gamma"], 20, 5);
  const out = write(rt, ["alpha", "BETA!", "gamma"], 20, 5);
  assertEqual(cupCount(out, 2), 1, "changed row 2 emitted");
  assertEqual(cupCount(out, 1), 0, "row 1 not emitted");
  assertEqual(cupCount(out, 3), 0, "row 3 not emitted");
  assertEqual(cupCount(out, 4), 0, "row 4 not emitted");
  assert(out.includes("\x1b[2;1H\x1b[0m\x1b[2KBETA!"), "row 2 payload correct");
  assert(out.includes("\x1b[5;1H"), "cursor parked on the bottom row");
  assert(!out.includes("\x1b[?25"), "no DECTCEM toggle when state unchanged and hidden");
}

function testResizeAndInvalidate(): void {
  console.log("\n\x1b[1m  resize / invalidate force full redraw\x1b[0m");
  const rt = makeRt();
  write(rt, ["a", "b"], 20, 4);
  const resized = write(rt, ["a", "b"], 30, 4);
  for (let r = 1; r <= 4; r++) assertEqual(cupCount(resized, r), 1, `resize: row ${r} re-emitted`);
  const noop = write(rt, ["a", "b"], 30, 4);
  assertEqual(noop, "", "post-resize identical frame writes nothing");
  rt.invalidateFrame();
  const invalidated = write(rt, ["a", "b"], 30, 4);
  for (let r = 1; r <= 4; r++) assertEqual(cupCount(invalidated, r), 1, `invalidateFrame: row ${r} re-emitted`);
}

function testTruncation(): void {
  console.log("\n\x1b[1m  overwide rows truncate exactly like legacy\x1b[0m");
  const rt = makeRt();
  const wide = "x".repeat(30);
  const out = write(rt, [wide], 10, 2);
  assert(out.includes("\x1b[1;1H\x1b[0m\x1b[2K" + truncateLine(wide, 10)), "row 1 truncated via truncateLine");
  assert(!out.includes(wide), "untruncated content never emitted");
}

function testOverlays(): void {
  console.log("\n\x1b[1m  bottom-row overlays\x1b[0m");
  const rt = makeRt();
  write(rt, ["top"], 40, 3);
  rt.feedbackMessage = "Saved!";
  const out = write(rt, ["top"], 40, 3);
  assertEqual(cupCount(out, 3), 1, "feedback re-emits only the bottom row");
  assertEqual(cupCount(out, 1), 0, "top row untouched by feedback");
  assert(out.includes("Saved!"), "feedback text present");
  rt.feedbackMessage = "";
  const cleared = write(rt, ["top"], 40, 3);
  assertEqual(cupCount(cleared, 3), 1, "clearing feedback re-emits the bottom row");
  assert(!cleared.includes("Saved!"), "cleared frame no longer carries feedback text");

  rt.commandMode = true;
  rt.commandBuffer = "theme";
  const cmd = write(rt, ["top"], 40, 3);
  assertEqual(cupCount(cmd, 3), 1, "command mode re-emits only the bottom row");
  assert(cmd.includes("theme"), "command buffer visible in overlay");
}

function testCursorToggles(): void {
  console.log("\n\x1b[1m  cursor visibility is edge-triggered\x1b[0m");
  const rt = makeRt();
  write(rt, ["a"], 20, 2);
  rt.inputMode.isEditing = true;
  const editOn = write(rt, ["a (editing)"], 20, 2);
  assert(editOn.startsWith("\x1b[?25l"), "visible-cursor frame hides while painting");
  assert(editOn.endsWith("\x1b[?25h"), "visible-cursor frame shows cursor at the end");
  const editNoop = write(rt, ["a (editing)"], 20, 2);
  assertEqual(editNoop, "", "identical editing frame writes nothing");
  rt.inputMode.isEditing = false;
  const editOff = write(rt, ["a (editing)"], 20, 2);
  assertEqual(editOff, "\x1b[?25l", "pure visibility flip emits only DECTCEM");
}

function testTwoRuntimeIsolation(): void {
  console.log("\n\x1b[1m  per-runtime scoping (two SSH sessions, one module)\x1b[0m");
  const rtA = makeRt();
  const rtB = makeRt();
  const frameA = ["session A row 1", "session A row 2"];
  const frameB = ["session B row 1", "session B row 2", "session B row 3"];
  write(rtA, frameA, 80, 24);
  write(rtB, frameB, 100, 30); // different dims AND content, interleaved
  assertEqual(write(rtA, frameA, 80, 24), "", "A's repeat frame is a no-op despite B rendering in between");
  assertEqual(write(rtB, frameB, 100, 30), "", "B's repeat frame is a no-op despite A rendering in between");
  const outA = write(rtA, ["session A row 1", "CHANGED"], 80, 24);
  assertEqual(cupCount(outA, 2), 1, "A diffs against A's own buffer (row 2 only)");
  assertEqual(cupCount(outA, 1), 0, "A row 1 not re-emitted");
  assertEqual(write(rtB, frameB, 100, 30), "", "B's buffer unaffected by A's update");
}

function testGridIdentity(): void {
  console.log("\n\x1b[1m  grid identity vs legacy full-frame writer\x1b[0m");
  const COLS = 40;
  const ROWS = 8;
  const vtLegacy = new VirtualTerminal(COLS, ROWS);
  const vtDiff = new VirtualTerminal(COLS, ROWS);
  const srLegacy = new ScreenReader(vtLegacy);
  const srDiff = new ScreenReader(vtDiff);
  const rtLegacy = makeRt();
  const rtDiff = makeRt();

  const RED = "\x1b[31m";
  const BOLD = "\x1b[1m";
  const frames: { name: string; lines: string[]; mutate?: (rt: MockRt) => void }[] = [
    { name: "initial frame", lines: ["Header", "  item one", "  item two", "Footer"] },
    { name: "one-row change", lines: ["Header", `  ${BOLD}item one${reset}`, "  item two", "Footer"] },
    { name: "styled rewrite", lines: [`${RED}Header${reset}`, "  item one", `  ${RED}item two${reset}`, "Footer", "extra row"] },
    { name: "overwide row", lines: ["Header", "y".repeat(COLS + 15), "  item two"] },
    { name: "feedback overlay", lines: ["Header", "  item one"], mutate: rt => { rt.feedbackMessage = "Done"; } },
    { name: "notification overlay", lines: ["Header", "  item one"], mutate: rt => { rt.feedbackMessage = ""; rt.notifications.current = { type: "error", message: "boom" }; } },
    { name: "overlay cleared + shrink", lines: ["Header"], mutate: rt => { rt.notifications.current = null; } },
    { name: "command mode", lines: ["Header", "body"], mutate: rt => { rt.commandMode = true; rt.commandBuffer = "help"; } },
    { name: "command exit", lines: ["Header", "body"], mutate: rt => { rt.commandMode = false; rt.commandBuffer = ""; } },
  ];

  for (const frame of frames) {
    frame.mutate?.(rtLegacy);
    frame.mutate?.(rtDiff);
    vtLegacy.write(legacyWrite(rtLegacy, frame.lines, COLS, ROWS));
    vtDiff.write(write(rtDiff, frame.lines, COLS, ROWS));
    assert(srDiff.text() === srLegacy.text(), `${frame.name}: text grid identical`);
    assert(srDiff.ansi() === srLegacy.ansi(), `${frame.name}: styled (ansi) grid identical`);
  }

  // Resize both terminals, then render again — dims change forces a full
  // redraw on the diff side; grids must still match.
  vtLegacy.resize(COLS + 10, ROWS + 2);
  vtDiff.resize(COLS + 10, ROWS + 2);
  const lines = ["After resize", "  second row"];
  vtLegacy.write(legacyWrite(rtLegacy, lines, COLS + 10, ROWS + 2));
  vtDiff.write(write(rtDiff, lines, COLS + 10, ROWS + 2));
  assert(srDiff.text() === srLegacy.text(), "post-resize: text grid identical");
  assert(srDiff.ansi() === srLegacy.ansi(), "post-resize: styled (ansi) grid identical");
}

// ─── Overlay sanitization + intended deltas vs legacy ────────

/**
 * A raw \n in overlay text (e.g. a thrown Error's multi-line message routed
 * to rt.notifications.error) must never reach the terminal: an LF on the
 * bottom row scrolls the alt screen and permanently desyncs the diff buffer.
 * The composer flattens row-crossing controls to spaces; emission strips
 * remaining C0 controls (except ESC) as defense in depth.
 */
function testOverlayControlSanitization(): void {
  console.log("\n\x1b[1m  overlay control chars sanitized (no alt-screen scroll)\x1b[0m");
  const COLS = 40;
  const ROWS = 8;
  const vt = new VirtualTerminal(COLS, ROWS);
  const sr = new ScreenReader(vt);
  const rt = makeRt();
  const base = ["Header", "  item one", "  item two", "Footer"];

  vt.write(write(rt, base, COLS, ROWS));
  const cleanGrid = sr.text();

  rt.notifications.current = { type: "error", message: "Request failed:\n  ECONNREFUSED 127.0.0.1" };
  const out = write(rt, base, COLS, ROWS);
  assert(!/[\r\n\v\f]/.test(out), "emitted bytes contain no row-crossing control characters");
  vt.write(out);
  const rows = sr.text().split("\n");
  assertEqual(rows[0], "Header", "top row intact while notification shown (no scroll)");
  assert(rows[ROWS - 1].includes("✗ Request failed:"), "notification visible on the bottom row");
  assert(rows[ROWS - 1].includes("ECONNREFUSED"), "second line of the message flattened onto the same row");

  rt.notifications.current = null;
  vt.write(write(rt, base, COLS, ROWS));
  assertEqual(sr.text(), cleanGrid, "grid fully restored after notification expiry");
}

/**
 * INTENDED delta vs legacy (pinned explicitly, not via the legacy oracle):
 * over-wide bottom-row overlays are truncated to the terminal width. The
 * legacy writer appended overlay text raw after CUP+EL, so an over-wide
 * notification wrapped at the right margin and scrolled the whole alt
 * screen — corruption, not behavior to preserve.
 */
function testOverwideOverlayTruncation(): void {
  console.log("\n\x1b[1m  over-wide overlay truncates (intended delta vs legacy)\x1b[0m");
  const COLS = 40;
  const ROWS = 8;
  const vt = new VirtualTerminal(COLS, ROWS);
  const sr = new ScreenReader(vt);
  const rt = makeRt();
  const base = ["Header", "  item one"];

  vt.write(write(rt, base, COLS, ROWS));
  rt.notifications.current = { type: "success", message: "N".repeat(120) };
  vt.write(write(rt, base, COLS, ROWS));

  const rows = sr.text().split("\n");
  assertEqual(rows[0], "Header", "top row intact (legacy scrolled the alt screen here)");
  assertEqual(rows[1], "  item one", "second row intact");
  assertEqual(rows[ROWS - 1], "  ✓ " + "N".repeat(COLS - 4), "overlay truncated to exactly the terminal width");

  rt.notifications.current = null;
  rt.feedbackMessage = "F".repeat(120);
  vt.write(write(rt, base, COLS, ROWS));
  assertEqual(sr.text().split("\n")[ROWS - 1], "  " + "F".repeat(COLS - 2), "over-wide feedback truncated the same way");
}

/**
 * Out-of-band bytes (stderr warning, console.error) desync the diff buffer;
 * the contract is that the writer calls rt.invalidateFrame() so the next
 * render — even of an identical frame — is a healing full redraw.
 */
function testOutOfBandDesyncHeals(): void {
  console.log("\n\x1b[1m  out-of-band bytes + invalidateFrame heal the grid\x1b[0m");
  const COLS = 40;
  const ROWS = 6;
  const vt = new VirtualTerminal(COLS, ROWS);
  const sr = new ScreenReader(vt);
  const rt = makeRt();
  const base = ["Header", "  body row", "Footer"];

  vt.write(write(rt, base, COLS, ROWS));
  const cleanGrid = sr.text();

  // Simulate the navigate-to-missing-page stderr warning hitting the TTY:
  // the trailing \n at the parked (bottom-row) cursor scrolls the alt screen.
  vt.write("[terminaltui] navigate: page 'x' not found\n");
  assert(sr.text() !== cleanGrid, "stray stderr bytes corrupt the grid");

  assertEqual(write(rt, base, COLS, ROWS), "", "identical frame without invalidation emits nothing (stays corrupted)");

  rt.invalidateFrame();
  vt.write(write(rt, base, COLS, ROWS));
  assertEqual(sr.text(), cleanGrid, "invalidateFrame + identical frame restores the grid");
}

// ─── E2E: startup demo byte counts + grid correctness ────────

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEMO_DIR = join(PROJECT_ROOT, "demos", "startup");

async function testE2EByteBehavior(): Promise<void> {
  console.log("\n\x1b[1m  E2E: startup demo — bytes per keypress\x1b[0m");
  const runDir = join(tmpdir(), `tui-render-diff-test-${Date.now()}`);
  mkdirSync(runDir, { recursive: true });
  writeFileSync(join(runDir, "run.ts"), `
import config from "${DEMO_DIR}/config.js";
import { runFileBasedSite } from "${PROJECT_ROOT}/src/index.js";
runFileBasedSite({
  config,
  pagesDir: "${DEMO_DIR}/pages",
  outDir: "${DEMO_DIR}/.terminaltui",
});
`);

  let emu: TUIEmulator | null = null;
  try {
    // Invoke the repo's tsx entry directly: `npx tsx` from the tmpdir would
    // hit the registry on a cold cache (CI), and its download output fools
    // waitForBoot into sampling a still-booting screen.
    const tsxCli = join(PROJECT_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
    emu = await TUIEmulator.launch({
      command: `node "${tsxCli}" run.ts`,
      cwd: runDir,
      cols: 120,
      rows: 40,
      timeout: 30000,
    });
    await emu.waitForBoot({ timeout: 20000 });
    await emu.waitForIdle(600, { timeout: 10000 });

    // Slow runners can still be mid-boot here: poll until the menu exists.
    let menuBefore = emu.screen.menu();
    for (let i = 0; i < 40 && menuBefore.items.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 500));
      menuBefore = emu.screen.menu();
    }
    assert(menuBefore.items.length > 0, "home menu visible after boot");

    // No-op keypress: left on home renders an identical frame → ~0 bytes.
    emu.resetBytesReceived();
    await emu.press("left", { delay: 30 });
    await emu.waitForIdle(200, { timeout: 3000 });
    const noopBytes = emu.bytesReceived;
    assert(noopBytes < 16, `no-op keypress transmits ~zero bytes (got ${noopBytes})`);

    // Menu move: a couple of rows change, not the whole 40-row frame.
    emu.resetBytesReceived();
    await emu.press("down", { delay: 30 });
    await emu.waitForIdle(200, { timeout: 3000 });
    const moveBytes = emu.bytesReceived;
    assert(moveBytes > 0, `menu move transmits bytes (got ${moveBytes})`);
    assert(moveBytes < 4000, `menu move transmits far less than a full frame (got ${moveBytes})`);
    assertEqual(emu.screen.menu().selectedIndex, menuBefore.selectedIndex + 1, "menu selection moved down on the grid");

    // Page enter still produces a correct grid.
    await emu.press("enter", { delay: 30 });
    await emu.waitForIdle(300, { timeout: 5000 });
    const pageText = emu.screen.text();
    assert(pageText.includes("← back") || pageText.includes("<- back"), "page view rendered (back indicator visible)");

    // And back home again.
    await emu.press("escape", { delay: 30 });
    await emu.waitForIdle(300, { timeout: 5000 });
    const menuAfter = emu.screen.menu();
    assertEqual(menuAfter.items.join("|"), menuBefore.items.join("|"), "home menu restored after escape");
  } finally {
    try { if (emu) await emu.close(); } catch { /* ignore */ }
    try { rmSync(runDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ─── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n\x1b[1;36m═══════════════════════════════════════════════════\x1b[0m");
  console.log("\x1b[1;36m  Line-Diff Renderer Test (Wave 5 Stage A)\x1b[0m");
  console.log("\x1b[1;36m═══════════════════════════════════════════════════\x1b[0m");

  testFullRedrawFirstFrame();
  testZeroChangeFrame();
  testSingleRowChange();
  testResizeAndInvalidate();
  testTruncation();
  testOverlays();
  testCursorToggles();
  testTwoRuntimeIsolation();
  testGridIdentity();
  testOverlayControlSanitization();
  testOverwideOverlayTruncation();
  testOutOfBandDesyncHeals();

  // The E2E section drives a real app through TUIEmulator. node-pty is an
  // optional peer dep that is never installed in CI, so the emulator uses its
  // piped-stdio fallback — which boots and drives apps fine on POSIX but not
  // on Windows (the app never reaches its home menu, no bytes flow). The 79
  // deterministic grid/byte tests above still run there; only the live-app
  // section is POSIX-only.
  if (process.platform === "win32") {
    console.log("\n\x1b[1m  E2E: startup demo — bytes per keypress\x1b[0m");
    console.log("  \x1b[2mskipped on Windows: PTY emulator cannot drive live apps (see comment)\x1b[0m");
  } else {
    await testE2EByteBehavior();
  }

  console.log(`\n  Total: ${passed + failed}  Passed: ${passed}  Failed: ${failed}\n`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
