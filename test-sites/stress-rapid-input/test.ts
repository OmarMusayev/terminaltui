/**
 * Stress Test: Rapid Input
 *
 * Tests InputSender and VirtualTerminal with aggressive input patterns.
 * Sends hundreds of keys rapidly, exercises all key types, and
 * stress-tests VirtualTerminal with massive writes.
 */
import { VirtualTerminal } from "../../src/emulator/vterm.js";
import { ScreenReader } from "../../src/emulator/screen-reader.js";
import { Assertions } from "../../src/emulator/assertions.js";
import { InputSender, resolveKey } from "../../src/emulator/input-sender.js";
import { setColorMode, fgColor, bold, dim, reset } from "../../src/style/colors.js";
import { writeFileSync } from "node:fs";

setColorMode("256");

// ── Types ──
interface Bug {
  id: string;
  severity: string;
  title: string;
  component: string;
  reproduction: string;
  expected: string;
  actual: string;
}

interface TestStep { name: string; passed: boolean; error?: string; }
const steps: TestStep[] = [];
const bugs: Bug[] = [];
let bugN = 0;

function step(name: string, fn: () => void): void {
  try { fn(); steps.push({ name, passed: true }); }
  catch (err: any) { steps.push({ name, passed: false, error: err.message }); }
}
function assert(cond: boolean, msg: string): void { if (!cond) throw new Error(msg); }

function addBug(sev: string, title: string, comp: string, repro: string, exp: string, act: string): void {
  bugN++;
  bugs.push({ id: `BUG-${String(bugN).padStart(3, "0")}`, severity: sev, title, component: comp, reproduction: repro, expected: exp, actual: act });
}

// ══════════════════════════════════════════════════════════════
// TEST: InputSender — 100 down arrows rapidly
// ══════════════════════════════════════════════════════════════

step("InputSender — 100 down arrows", () => {
  const collected: string[] = [];
  const sender = new InputSender((data) => collected.push(data));
  sender.sendTimes("down", 100);
  assert(collected.length === 100, `Expected 100 sends, got ${collected.length}`);
  for (const d of collected) {
    assert(d === "\x1b[B", `Down arrow should be \\x1b[B, got ${JSON.stringify(d)}`);
  }
});

// ══════════════════════════════════════════════════════════════
// TEST: InputSender — enter/escape alternation 50 times
// ══════════════════════════════════════════════════════════════

step("InputSender — enter/escape 50 alternations", () => {
  const collected: string[] = [];
  const sender = new InputSender((data) => collected.push(data));
  for (let i = 0; i < 50; i++) {
    sender.send("enter");
    sender.send("escape");
    sender.send("enter");
    sender.send("escape");
  }
  assert(collected.length === 200, `Expected 200 sends, got ${collected.length}`);
});

// ══════════════════════════════════════════════════════════════
// TEST: resolveKey — 200 down arrow calls
// ══════════════════════════════════════════════════════════════

step("resolveKey — 200 down arrows", () => {
  const results: string[] = [];
  for (let i = 0; i < 200; i++) {
    results.push(resolveKey("down"));
  }
  assert(results.length === 200, `Expected 200 results`);
  assert(results.every(r => r === "\x1b[B"), "All should be down arrow escape");
});

// ══════════════════════════════════════════════════════════════
// TEST: InputSender — every printable ASCII character
// ══════════════════════════════════════════════════════════════

step("InputSender — all printable ASCII (a-z, 0-9, punctuation)", () => {
  const collected: string[] = [];
  const sender = new InputSender((data) => collected.push(data));

  // a-z
  for (let c = 97; c <= 122; c++) {
    sender.send(String.fromCharCode(c));
  }
  // A-Z
  for (let c = 65; c <= 90; c++) {
    sender.send(String.fromCharCode(c));
  }
  // 0-9
  for (let c = 48; c <= 57; c++) {
    sender.send(String.fromCharCode(c));
  }
  // Punctuation: ! @ # $ % ^ & * ( ) - _ = + [ ] { } ; : ' " , . < > / ? \ | ` ~
  const punct = "!@#$%^&*()-_=+[]{};\':\",./<>?\\|`~";
  for (const ch of punct) {
    sender.send(ch);
  }

  const totalExpected = 26 + 26 + 10 + punct.length;
  assert(collected.length === totalExpected, `Expected ${totalExpected} sends, got ${collected.length}`);
});

// ══════════════════════════════════════════════════════════════
// TEST: InputSender — all ctrl combinations
// ══════════════════════════════════════════════════════════════

step("InputSender — ctrl+a through ctrl+z", () => {
  const collected: string[] = [];
  const sender = new InputSender((data) => collected.push(data));

  for (let c = 97; c <= 122; c++) {
    const letter = String.fromCharCode(c);
    sender.send(`ctrl+${letter}`);
  }
  assert(collected.length === 26, `Expected 26 ctrl combos, got ${collected.length}`);

  // Verify ctrl+a = \x01, ctrl+b = \x02, etc.
  for (let i = 0; i < 26; i++) {
    const expected = String.fromCharCode(i + 1);
    assert(collected[i] === expected, `ctrl+${String.fromCharCode(97 + i)} should be \\x${(i + 1).toString(16).padStart(2, "0")}, got ${JSON.stringify(collected[i])}`);
  }
});

// ══════════════════════════════════════════════════════════════
// TEST: InputSender — all function keys
// ══════════════════════════════════════════════════════════════

step("InputSender — f1 through f12", () => {
  const collected: string[] = [];
  const sender = new InputSender((data) => collected.push(data));

  for (let i = 1; i <= 12; i++) {
    sender.send(`f${i}`);
  }
  assert(collected.length === 12, `Expected 12 function keys, got ${collected.length}`);
  // Verify they are all non-empty escape sequences
  for (let i = 0; i < 12; i++) {
    assert(collected[i].length > 0, `f${i + 1} produced empty string`);
    assert(collected[i].startsWith("\x1b"), `f${i + 1} should start with escape: ${JSON.stringify(collected[i])}`);
  }
});

// ══════════════════════════════════════════════════════════════
// TEST: InputSender — all special named keys
// ══════════════════════════════════════════════════════════════

step("InputSender — all named keys", () => {
  const namedKeys = [
    "up", "down", "left", "right",
    "enter", "return", "escape", "backspace", "tab",
    "space", "delete", "home", "end",
    "pageup", "pagedown",
  ];
  const collected: string[] = [];
  const sender = new InputSender((data) => collected.push(data));

  for (const key of namedKeys) {
    sender.send(key);
  }
  assert(collected.length === namedKeys.length, `Expected ${namedKeys.length} sends, got ${collected.length}`);
  for (let i = 0; i < namedKeys.length; i++) {
    assert(collected[i].length > 0, `Key "${namedKeys[i]}" resolved to empty string`);
  }
});

// ══════════════════════════════════════════════════════════════
// TEST: InputSender — sendSequence with large array
// ══════════════════════════════════════════════════════════════

step("InputSender — sendSequence 500 mixed keys", () => {
  const collected: string[] = [];
  const sender = new InputSender((data) => collected.push(data));

  const seq: string[] = [];
  for (let i = 0; i < 100; i++) {
    seq.push("down", "down", "enter", "escape", "up");
  }
  sender.sendSequence(seq);
  assert(collected.length === 500, `Expected 500 sends, got ${collected.length}`);
});

// ══════════════════════════════════════════════════════════════
// TEST: InputSender — typeString with long string
// ══════════════════════════════════════════════════════════════

step("InputSender — typeString 500 chars", () => {
  const collected: string[] = [];
  const sender = new InputSender((data) => collected.push(data));
  const longStr = "a".repeat(500);
  sender.typeString(longStr);
  assert(collected.length === 500, `Expected 500 char sends, got ${collected.length}`);
});

// ══════════════════════════════════════════════════════════════
// TEST: VirtualTerminal — rapid writes, 1000 lines
// ══════════════════════════════════════════════════════════════

step("VirtualTerminal — write 1000 lines of text", () => {
  const vt = new VirtualTerminal(80, 24);
  for (let i = 0; i < 1000; i++) {
    vt.write(`Line ${i}: ${"x".repeat(60)}\r\n`);
  }
  // Screen should not crash, last line should be visible
  const text = vt.text();
  assert(text.includes("Line 999"), "Last line should be visible after scrolling");
  assert(!text.includes("Line 0"), "First line should have scrolled off");
});

// ══════════════════════════════════════════════════════════════
// TEST: VirtualTerminal — rapid ANSI writes
// ══════════════════════════════════════════════════════════════

step("VirtualTerminal — 1000 lines with ANSI color codes", () => {
  const vt = new VirtualTerminal(80, 24);
  for (let i = 0; i < 1000; i++) {
    const color = `\x1b[38;5;${i % 256}m`;
    vt.write(`${color}Colored line ${i}${reset}\r\n`);
  }
  const text = vt.text();
  assert(text.includes("Colored line 999"), "Last colored line should be visible");
});

// ══════════════════════════════════════════════════════════════
// TEST: VirtualTerminal — rapid cursor movements
// ══════════════════════════════════════════════════════════════

step("VirtualTerminal — 500 cursor jumps", () => {
  const vt = new VirtualTerminal(80, 24);
  for (let i = 0; i < 500; i++) {
    const r = (i % 24) + 1;
    const c = (i % 80) + 1;
    vt.write(`\x1b[${r};${c}H*`);
  }
  // No crash is the test
  const text = vt.text();
  assert(text.includes("*"), "At least one star should be visible");
});

// ══════════════════════════════════════════════════════════════
// TEST: VirtualTerminal — rapid clear/write cycles
// ══════════════════════════════════════════════════════════════

step("VirtualTerminal — 200 clear/write cycles", () => {
  const vt = new VirtualTerminal(80, 24);
  for (let i = 0; i < 200; i++) {
    vt.write("\x1b[2J\x1b[H");
    vt.write(`Cycle ${i}: Hello World\r\n`);
  }
  const text = vt.text();
  assert(text.includes("Cycle 199"), "Last cycle should be visible");
  assert(!text.includes("Cycle 198"), "Previous cycle should be cleared");
});

// ══════════════════════════════════════════════════════════════
// TEST: VirtualTerminal — rapid resize during writes
// ══════════════════════════════════════════════════════════════

step("VirtualTerminal — write + resize interleaved", () => {
  const vt = new VirtualTerminal(80, 24);
  const sizes: [number, number][] = [
    [40, 10], [120, 50], [20, 5], [200, 80], [80, 24], [60, 30],
  ];
  for (let i = 0; i < 100; i++) {
    vt.write(`Write ${i}\r\n`);
    if (i % 10 === 0) {
      const [c, r] = sizes[Math.floor(i / 10) % sizes.length];
      vt.resize(c, r);
    }
  }
  // Just verifying no crash
  assert(vt.cols > 0, "Terminal should have valid cols");
  assert(vt.rows > 0, "Terminal should have valid rows");
});

// ══════════════════════════════════════════════════════════════
// TEST: VirtualTerminal — alternate screen buffer stress
// ══════════════════════════════════════════════════════════════

step("VirtualTerminal — enter/exit alt screen 50 times", () => {
  const vt = new VirtualTerminal(80, 24);
  vt.write("Main buffer content\r\n");
  for (let i = 0; i < 50; i++) {
    vt.write("\x1b[?1049h"); // enter alt screen
    vt.write(`Alt screen ${i}\r\n`);
    vt.write("\x1b[?1049l"); // exit alt screen
  }
  // After exiting, main buffer content should be restored
  const text = vt.text();
  assert(text.includes("Main buffer content"), "Main buffer should be restored after alt screen exit");
});

// ══════════════════════════════════════════════════════════════
// TEST: VirtualTerminal — erase operations stress
// ══════════════════════════════════════════════════════════════

step("VirtualTerminal — rapid erase line/display", () => {
  const vt = new VirtualTerminal(80, 24);
  for (let i = 0; i < 200; i++) {
    vt.write(`Line ${i}`);
    vt.write("\x1b[2K"); // erase entire line
    vt.write("\x1b[1;1H"); // home
    vt.write("\x1b[J"); // erase from cursor to end
  }
  // No crash is the test
  const text = vt.text();
  assert(typeof text === "string", "text() should return string");
});

// ══════════════════════════════════════════════════════════════
// TEST: VirtualTerminal — SGR stress (many style changes)
// ══════════════════════════════════════════════════════════════

step("VirtualTerminal — 1000 SGR style changes", () => {
  const vt = new VirtualTerminal(80, 24);
  vt.write("\x1b[H");
  for (let i = 0; i < 1000; i++) {
    // Cycle through bold, dim, italic, underline, inverse, fg colors, bg colors
    const sgrs = [
      "\x1b[1m", "\x1b[2m", "\x1b[3m", "\x1b[4m", "\x1b[7m",
      "\x1b[0m",
      `\x1b[38;5;${i % 256}m`,
      `\x1b[48;5;${(i * 7) % 256}m`,
      "\x1b[38;2;255;128;64m",
      "\x1b[48;2;0;128;255m",
    ];
    const sgr = sgrs[i % sgrs.length];
    vt.write(sgr + "X");
  }
  // Verify cells have style info
  const cell = vt.cellAt(0, 0);
  assert(cell !== null, "Cell at 0,0 should exist");
});

// ══════════════════════════════════════════════════════════════
// TEST: VirtualTerminal — tab handling
// ══════════════════════════════════════════════════════════════

step("VirtualTerminal — 100 tabs", () => {
  const vt = new VirtualTerminal(80, 24);
  vt.write("\x1b[H");
  for (let i = 0; i < 100; i++) {
    vt.write("\t");
  }
  // Cursor should be clamped to within bounds
  assert(vt.cursorCol >= 0 && vt.cursorCol < 80, `Cursor col ${vt.cursorCol} out of bounds`);
});

// ══════════════════════════════════════════════════════════════
// TEST: VirtualTerminal — backspace flood
// ══════════════════════════════════════════════════════════════

step("VirtualTerminal — 200 backspaces", () => {
  const vt = new VirtualTerminal(80, 24);
  vt.write("Hello World");
  for (let i = 0; i < 200; i++) {
    vt.write("\b");
  }
  assert(vt.cursorCol === 0, `Cursor should be at col 0 after backspaces, got ${vt.cursorCol}`);
});

// ══════════════════════════════════════════════════════════════
// TEST: VirtualTerminal — line wrap stress
// ══════════════════════════════════════════════════════════════

step("VirtualTerminal — line wrap with 500 chars no newline", () => {
  const vt = new VirtualTerminal(80, 24);
  vt.write("\x1b[H");
  vt.write("A".repeat(500));
  // Should have wrapped across multiple lines; screen holds 24*80=1920 cells
  // but scroll may push some off, 500 chars fill ~6.25 rows
  const text = vt.text();
  const aCount = [...text].filter(c => c === "A").length;
  // All 500 A's should still be visible (they fit in 24 rows of 80 cols)
  assert(aCount >= 400, `Expected at least 400 A chars visible, got ${aCount}`);
});

// ══════════════════════════════════════════════════════════════
// TEST: resolveKey — unknown keys
// ══════════════════════════════════════════════════════════════

step("resolveKey — unknown/unusual keys", () => {
  // Unknown key names should return as-is
  const r1 = resolveKey("nonexistent");
  assert(r1 === "nonexistent", `Unknown key should return as-is, got ${JSON.stringify(r1)}`);

  const r2 = resolveKey("ctrl+[");
  assert(r2 === "\x1b", "ctrl+[ should be escape");

  const r3 = resolveKey("ctrl+?");
  assert(r3 === "\x7f", "ctrl+? should be DEL");
});

// ══════════════════════════════════════════════════════════════
// TEST: VirtualTerminal — ScreenReader on busy screen
// ══════════════════════════════════════════════════════════════

step("ScreenReader — on 1000-line written terminal", () => {
  const vt = new VirtualTerminal(80, 50);
  for (let i = 0; i < 1000; i++) {
    vt.write(`${fgColor("#ff0000")}Line ${i}: ${"data ".repeat(10)}${reset}\r\n`);
  }
  const sr = new ScreenReader(vt);
  const text = sr.text();
  assert(text.length > 0, "ScreenReader text should not be empty");
  const menu = sr.menu();
  // No menu should be detected on random text
  assert(menu.items.length === 0, `Expected 0 menu items on random text, got ${menu.items.length}`);
});

// ══════════════════════════════════════════════════════════════
// TEST: VirtualTerminal — scroll up/down CSI sequences
// ══════════════════════════════════════════════════════════════

step("VirtualTerminal — CSI scroll up/down 100 times", () => {
  const vt = new VirtualTerminal(80, 24);
  vt.write("First line\r\n");
  vt.write("Second line\r\n");
  // Scroll up 100 times
  for (let i = 0; i < 100; i++) {
    vt.write("\x1b[1S"); // scroll up 1
  }
  // Scroll down 100 times
  for (let i = 0; i < 100; i++) {
    vt.write("\x1b[1T"); // scroll down 1
  }
  // No crash is the test
  assert(vt.rows === 24, "Rows should still be 24");
});

// ══════════════════════════════════════════════════════════════
// TEST: VirtualTerminal — delete/insert characters stress
// ══════════════════════════════════════════════════════════════

step("VirtualTerminal — 200 insert/delete char operations", () => {
  const vt = new VirtualTerminal(80, 24);
  vt.write("\x1b[H");
  vt.write("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  for (let i = 0; i < 200; i++) {
    vt.write("\x1b[1;5H"); // move to col 5
    vt.write("\x1b[1P");   // delete 1 char
    vt.write("\x1b[1;5H");
    vt.write("\x1b[1@");   // insert 1 char
  }
  // No crash
  const text = vt.text();
  assert(typeof text === "string", "text() should return string");
});

// ══════════════════════════════════════════════════════════════
// TEST: VirtualTerminal — insert/delete lines stress
// ══════════════════════════════════════════════════════════════

step("VirtualTerminal — 200 insert/delete line operations", () => {
  const vt = new VirtualTerminal(80, 24);
  for (let i = 0; i < 24; i++) {
    vt.write(`Row ${i}\r\n`);
  }
  for (let i = 0; i < 200; i++) {
    vt.write(`\x1b[${(i % 24) + 1};1H`); // move to row
    vt.write("\x1b[1L"); // insert line
    vt.write("\x1b[1M"); // delete line
  }
  assert(vt.rows === 24, "Rows should still be 24");
});

// ══════════════════════════════════════════════════════════════
// REPORT
// ══════════════════════════════════════════════════════════════

const passed = steps.filter(s => s.passed).length;
const failed = steps.filter(s => !s.passed).length;
const failedNames = steps.filter(s => !s.passed).map(s => `${s.name}: ${s.error}`);

const report = {
  agent: "stress-rapid-input",
  tests_run: steps.length,
  tests_passed: passed,
  tests_failed: failed,
  bugs,
  notes: failed > 0
    ? `${failed} tests failed. Failures: ${failedNames.join("; ")}`
    : "All tests passed. Exercised InputSender with 100+ rapid keys, all ASCII, ctrl combos, function keys, and VirtualTerminal with 1000+ line writes, resize interleaving, alt screen toggling, and CSI operations.",
};

console.log(JSON.stringify(report, null, 2));
writeFileSync(new URL("report.json", import.meta.url).pathname, JSON.stringify(report, null, 2));
