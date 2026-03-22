/**
 * Unit tests for the TUI emulator — vterm, screen-reader, input-sender.
 */

import { VirtualTerminal } from "../src/emulator/vterm.js";
import { ScreenReader } from "../src/emulator/screen-reader.js";
import { InputSender, resolveKey } from "../src/emulator/input-sender.js";
import { Assertions, AssertionError } from "../src/emulator/assertions.js";
import { Reporter } from "../src/emulator/reporter.js";

// ─── Test Harness ─────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m\u2714\x1b[0m ${name}`);
  } catch (err: any) {
    failed++;
    console.log(`  \x1b[31m\u2718\x1b[0m ${name}`);
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

// ═════════════════════════════════════════════════════════════
// VIRTUAL TERMINAL TESTS
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Virtual Terminal (vterm)\x1b[0m\n");

test("Creates empty buffer with correct dimensions", () => {
  const vt = new VirtualTerminal(80, 24);
  assertEqual(vt.cols, 80, "cols");
  assertEqual(vt.rows, 24, "rows");
  const cells = vt.cells();
  assertEqual(cells.length, 24, "buffer rows");
  assertEqual(cells[0].length, 80, "buffer cols");
});

test("Writes plain text to buffer", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("Hello, World!");
  assert(vt.text().startsWith("Hello, World!"), "text should contain 'Hello, World!'");
  assertEqual(vt.cursorCol, 13, "cursor col after write");
  assertEqual(vt.cursorRow, 0, "cursor row");
});

test("Handles newlines", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("Line 1\nLine 2\nLine 3");
  const lines = vt.text().split("\n");
  assertEqual(lines[0].trim(), "Line 1", "line 1");
  assertEqual(lines[1].trim(), "Line 2", "line 2");
  assertEqual(lines[2].trim(), "Line 3", "line 3");
  assertEqual(vt.cursorRow, 2, "cursor row");
});

test("Handles carriage return", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("AAAA\rBB");
  const line = vt.text().split("\n")[0];
  assertEqual(line.trim(), "BBAA", "CR should move cursor to col 0, overwriting");
});

test("Handles backspace", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("ABC\bX");
  const line = vt.text().split("\n")[0];
  assertEqual(line.trim(), "ABX", "backspace moves cursor back, then X overwrites C");
});

test("Handles tab stops", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("A\tB");
  const line = vt.text().split("\n")[0];
  // Tab should move to col 8
  assert(line.indexOf("B") === 8, "tab should move to next 8-col stop");
});

test("Line wrapping at right edge", () => {
  const vt = new VirtualTerminal(10, 5);
  vt.write("ABCDEFGHIJX");
  // 10 chars fills row 0, 'X' wraps to row 1
  const cells = vt.cells();
  assertEqual(cells[0][9].char, "J", "last char of first row");
  assertEqual(cells[1][0].char, "X", "first char of second row (wrapped)");
});

test("Scrolling at bottom of screen", () => {
  const vt = new VirtualTerminal(20, 3);
  vt.write("Line1\nLine2\nLine3\nLine4");
  // With 3 rows, Line1 should have scrolled off
  const text = vt.text();
  assert(!text.includes("Line1"), "Line1 should have scrolled off");
  assert(text.includes("Line2"), "Line2 should be visible");
  assert(text.includes("Line3"), "Line3 should be visible");
  assert(text.includes("Line4"), "Line4 should be visible");
});

// ── Cursor Movement ──

test("CSI A — cursor up", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("Hello\n\n\n");
  assertEqual(vt.cursorRow, 3, "at row 3");
  vt.write("\x1b[2A"); // up 2
  assertEqual(vt.cursorRow, 1, "at row 1 after up 2");
});

test("CSI B — cursor down", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\x1b[3B"); // down 3
  assertEqual(vt.cursorRow, 3, "cursor down 3");
});

test("CSI C — cursor forward", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\x1b[5C"); // forward 5
  assertEqual(vt.cursorCol, 5, "cursor forward 5");
});

test("CSI D — cursor back", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("ABCDE\x1b[3D"); // back 3
  assertEqual(vt.cursorCol, 2, "cursor back 3 from col 5");
});

test("CSI H — cursor position (absolute)", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\x1b[5;10H"); // row 5, col 10 (1-indexed)
  assertEqual(vt.cursorRow, 4, "row 4 (0-indexed)");
  assertEqual(vt.cursorCol, 9, "col 9 (0-indexed)");
});

test("CSI G — cursor horizontal absolute", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("ABCDEF\x1b[3G"); // col 3 (1-indexed)
  assertEqual(vt.cursorCol, 2, "col 2 (0-indexed)");
});

// ── SGR (Styling) ──

test("SGR bold", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\x1b[1mBold\x1b[0m");
  const cell = vt.cellAt(0, 0)!;
  assertEqual(cell.char, "B", "char");
  assertEqual(cell.bold, true, "bold");
});

test("SGR dim", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\x1b[2mDim\x1b[0m");
  const cell = vt.cellAt(0, 0)!;
  assertEqual(cell.dim, true, "dim");
});

test("SGR italic", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\x1b[3mItalic\x1b[0m");
  assertEqual(vt.cellAt(0, 0)!.italic, true, "italic");
});

test("SGR underline", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\x1b[4mUnderline\x1b[0m");
  assertEqual(vt.cellAt(0, 0)!.underline, true, "underline");
});

test("SGR inverse", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\x1b[7mInverse\x1b[0m");
  assertEqual(vt.cellAt(0, 0)!.inverse, true, "inverse");
});

test("SGR reset clears all attributes", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\x1b[1;3;4;7m\x1b[0mA");
  const cell = vt.cellAt(0, 0)!;
  assertEqual(cell.bold, false, "not bold after reset");
  assertEqual(cell.italic, false, "not italic after reset");
  assertEqual(cell.underline, false, "not underline after reset");
  assertEqual(cell.inverse, false, "not inverse after reset");
});

test("SGR 22 resets bold and dim", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\x1b[1;2m\x1b[22mA");
  const cell = vt.cellAt(0, 0)!;
  assertEqual(cell.bold, false, "bold off");
  assertEqual(cell.dim, false, "dim off");
});

// ── Colors ──

test("SGR basic fg colors (30-37)", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\x1b[31mR\x1b[0m"); // red
  const cell = vt.cellAt(0, 0)!;
  assertEqual(cell.fg, "#aa0000", "red fg");
});

test("SGR bright fg colors (90-97)", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\x1b[91mR\x1b[0m"); // bright red
  assertEqual(vt.cellAt(0, 0)!.fg, "#ff5555", "bright red fg");
});

test("SGR 256-color fg", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\x1b[38;5;196mR\x1b[0m"); // color 196 = bright red in 256 palette
  const cell = vt.cellAt(0, 0)!;
  assert(cell.fg !== null, "should have fg color");
});

test("SGR truecolor fg", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\x1b[38;2;255;100;50mR\x1b[0m");
  assertEqual(vt.cellAt(0, 0)!.fg, "#ff6432", "truecolor fg");
});

test("SGR basic bg colors (40-47)", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\x1b[44mB\x1b[0m"); // blue bg
  assertEqual(vt.cellAt(0, 0)!.bg, "#0000aa", "blue bg");
});

test("SGR 256-color bg", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\x1b[48;5;21mB\x1b[0m"); // color 21
  assert(vt.cellAt(0, 0)!.bg !== null, "should have bg color");
});

test("SGR truecolor bg", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\x1b[48;2;10;20;30mB\x1b[0m");
  assertEqual(vt.cellAt(0, 0)!.bg, "#0a141e", "truecolor bg");
});

test("SGR default fg (39) resets fg", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\x1b[31m\x1b[39mA");
  assertEqual(vt.cellAt(0, 0)!.fg, null, "fg should be null after reset");
});

test("SGR default bg (49) resets bg", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\x1b[41m\x1b[49mA");
  assertEqual(vt.cellAt(0, 0)!.bg, null, "bg should be null after reset");
});

// ── Screen Operations ──

test("CSI J (0) — erase from cursor to end", () => {
  const vt = new VirtualTerminal(10, 3);
  vt.write("AAAAAAAAAA");
  vt.write("\x1b[2;1H"); // move to row 2 col 1
  vt.write("BBBBBBBBBB");
  vt.write("\x1b[3;1H"); // move to row 3 col 1
  vt.write("CCCCCCCCCC");
  vt.write("\x1b[2;5H"); // row 2, col 5 (1-indexed)
  vt.write("\x1b[J"); // erase from cursor to end
  const line1 = vt.cells()[1].map(c => c.char).join("");
  const line2 = vt.cells()[2].map(c => c.char).join("");
  assertEqual(line1, "BBBB      ", "row 1 partially cleared");
  assertEqual(line2, "          ", "row 2 fully cleared");
});

test("CSI 2J — clear entire screen", () => {
  const vt = new VirtualTerminal(10, 3);
  vt.write("AAAAAAAAAA\nBBBBBBBBBB\nCCCCCCCCCC");
  vt.write("\x1b[2J");
  const text = vt.text();
  assertEqual(text.trim(), "", "screen should be empty");
});

test("CSI K (0) — erase to end of line", () => {
  const vt = new VirtualTerminal(10, 3);
  vt.write("ABCDEFGHIJ");
  vt.write("\x1b[1;5H"); // col 5
  vt.write("\x1b[K"); // erase to end
  const line = vt.cells()[0].map(c => c.char).join("");
  assertEqual(line, "ABCD      ", "line cleared from col 4");
});

test("CSI 1K — erase to start of line", () => {
  const vt = new VirtualTerminal(10, 3);
  vt.write("ABCDEFGHIJ");
  vt.write("\x1b[1;5H"); // col 5
  vt.write("\x1b[1K"); // erase to start
  const line = vt.cells()[0].map(c => c.char).join("");
  assertEqual(line, "     FGHIJ", "line cleared from start to cursor");
});

test("CSI 2K — erase entire line", () => {
  const vt = new VirtualTerminal(10, 3);
  vt.write("ABCDEFGHIJ");
  vt.write("\x1b[1;5H");
  vt.write("\x1b[2K");
  const line = vt.cells()[0].map(c => c.char).join("");
  assertEqual(line, "          ", "entire line cleared");
});

// ── Cursor Visibility ──

test("CSI ?25l hides cursor", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\x1b[?25l");
  assertEqual(vt.cursorVisible, false, "cursor hidden");
});

test("CSI ?25h shows cursor", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\x1b[?25l\x1b[?25h");
  assertEqual(vt.cursorVisible, true, "cursor visible");
});

// ── Alternate Screen Buffer ──

test("Alternate screen buffer", () => {
  const vt = new VirtualTerminal(20, 5);
  vt.write("Main buffer content");

  // Enter alt screen
  vt.write("\x1b[?1049h");
  assert(!vt.text().includes("Main buffer"), "alt screen should be clear");

  vt.write("Alt buffer content");
  assert(vt.text().includes("Alt buffer"), "alt screen has new content");

  // Leave alt screen
  vt.write("\x1b[?1049l");
  assert(vt.text().includes("Main buffer"), "main buffer restored");
});

// ── Resize ──

test("Resize preserves visible content", () => {
  const vt = new VirtualTerminal(20, 5);
  vt.write("Hello");
  vt.resize(40, 10);
  assertEqual(vt.cols, 40, "new cols");
  assertEqual(vt.rows, 10, "new rows");
  assert(vt.text().includes("Hello"), "content preserved");
});

// ── Find / Contains ──

test("find() locates text", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\n\n     Target");
  const result = vt.find("Target");
  assert(result !== null, "should find text");
  assertEqual(result!.row, 2, "row");
  assertEqual(result!.col, 5, "col");
});

test("contains() checks for text presence", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("Hello World");
  assertEqual(vt.contains("Hello"), true, "contains Hello");
  assertEqual(vt.contains("Goodbye"), false, "does not contain Goodbye");
});

test("textAt() extracts region", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("AAABBBCCC");
  const text = vt.textAt(0, 3, 3, 1);
  assertEqual(text, "BBB", "extracted region");
});

// ── Combined SGR parameters ──

test("Multiple SGR in one sequence", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\x1b[1;3;31mX\x1b[0m"); // bold + italic + red
  const cell = vt.cellAt(0, 0)!;
  assertEqual(cell.bold, true, "bold");
  assertEqual(cell.italic, true, "italic");
  assertEqual(cell.fg, "#aa0000", "red fg");
});

// ═════════════════════════════════════════════════════════════
// INPUT SENDER TESTS
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Input Sender\x1b[0m\n");

test("resolveKey maps arrow keys", () => {
  assertEqual(resolveKey("up"), "\x1b[A", "up");
  assertEqual(resolveKey("down"), "\x1b[B", "down");
  assertEqual(resolveKey("left"), "\x1b[D", "left");
  assertEqual(resolveKey("right"), "\x1b[C", "right");
});

test("resolveKey maps control keys", () => {
  assertEqual(resolveKey("enter"), "\r", "enter");
  assertEqual(resolveKey("escape"), "\x1b", "escape");
  assertEqual(resolveKey("backspace"), "\x7f", "backspace");
  assertEqual(resolveKey("tab"), "\t", "tab");
  assertEqual(resolveKey("space"), " ", "space");
});

test("resolveKey maps ctrl+letter combos", () => {
  assertEqual(resolveKey("ctrl+c"), "\x03", "ctrl+c");
  assertEqual(resolveKey("ctrl+d"), "\x04", "ctrl+d");
  assertEqual(resolveKey("ctrl+l"), "\x0c", "ctrl+l");
  assertEqual(resolveKey("ctrl+a"), "\x01", "ctrl+a");
  assertEqual(resolveKey("ctrl+z"), "\x1a", "ctrl+z");
});

test("resolveKey passes single chars through", () => {
  assertEqual(resolveKey("q"), "q", "q");
  assertEqual(resolveKey("a"), "a", "a");
  assertEqual(resolveKey("1"), "1", "1");
  assertEqual(resolveKey(":"), ":", "colon");
});

test("resolveKey is case-insensitive for named keys", () => {
  assertEqual(resolveKey("UP"), "\x1b[A", "UP");
  assertEqual(resolveKey("Enter"), "\r", "Enter");
  assertEqual(resolveKey("ESCAPE"), "\x1b", "ESCAPE");
});

test("InputSender sends resolved keys", () => {
  const sent: string[] = [];
  const sender = new InputSender((data) => sent.push(data));
  sender.send("up");
  sender.send("q");
  sender.send("ctrl+c");
  assertEqual(sent[0], "\x1b[A", "up sent");
  assertEqual(sent[1], "q", "q sent");
  assertEqual(sent[2], "\x03", "ctrl+c sent");
});

test("InputSender.typeString sends each char", () => {
  const sent: string[] = [];
  const sender = new InputSender((data) => sent.push(data));
  sender.typeString("abc");
  assertEqual(sent.length, 3, "3 chars sent");
  assertEqual(sent[0], "a", "first char");
  assertEqual(sent[1], "b", "second char");
  assertEqual(sent[2], "c", "third char");
});

// ═════════════════════════════════════════════════════════════
// SCREEN READER TESTS
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Screen Reader\x1b[0m\n");

test("Menu detection — basic menu with cursor", () => {
  const vt = new VirtualTerminal(80, 24);
  // Simulate menu rendering:
  // "  ❯ ◆ Menu [1]"       — selected
  // "     ◆ About [2]"     — unselected
  // "     ◆ Contact [3]"   — unselected
  vt.write("  \u276f \u25c6 Menu [1]\n");
  vt.write("     \u25c6 About [2]\n");
  vt.write("     \u25c6 Contact [3]\n");

  const sr = new ScreenReader(vt);
  const menu = sr.menu();
  assertEqual(menu.items.length, 3, "3 menu items");
  assertEqual(menu.items[0], "Menu", "first item");
  assertEqual(menu.items[1], "About", "second item");
  assertEqual(menu.items[2], "Contact", "third item");
  assertEqual(menu.selectedIndex, 0, "first item selected");
});

test("Menu detection — second item selected", () => {
  const vt = new VirtualTerminal(80, 24);
  vt.write("     \u25c6 Menu [1]\n");
  vt.write("  \u276f \u25c6 About [2]\n");
  vt.write("     \u25c6 Contact [3]\n");

  const sr = new ScreenReader(vt);
  const menu = sr.menu();
  assertEqual(menu.selectedIndex, 1, "second item selected");
});

test("Card detection — rounded border card", () => {
  const vt = new VirtualTerminal(80, 24);
  // Render a card with rounded borders
  vt.write("\u256d\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256e\n");
  vt.write("\u2502 \u25c6 My Card Title  \u2502\n");
  vt.write("\u2502 Card body text.   \u2502\n");
  vt.write("\u2502 [Tag1] [Tag2]      \u2502\n");
  vt.write("\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256f\n");

  const sr = new ScreenReader(vt);
  const cards = sr.cards();
  assertEqual(cards.length, 1, "1 card found");
  assert(cards[0].title.includes("My Card Title"), `title: ${cards[0].title}`);
  assert(cards[0].body !== undefined && cards[0].body.includes("Card body"), `body: ${cards[0].body}`);
  assertEqual(cards[0].tags.length, 2, "2 tags");
  assertEqual(cards[0].tags[0], "Tag1", "first tag");
  assertEqual(cards[0].tags[1], "Tag2", "second tag");
});

test("Link detection — arrow icon link", () => {
  const vt = new VirtualTerminal(80, 24);
  vt.write("    \u2192 GitHub  https://github.com/user\n");
  vt.write("    \u2192 Docs  https://docs.example.com\n");

  const sr = new ScreenReader(vt);
  const links = sr.links();
  assertEqual(links.length, 2, "2 links");
  assertEqual(links[0].label, "GitHub", "first link label");
  assertEqual(links[0].url, "https://github.com/user", "first link url");
});

test("Page detection — back header", () => {
  const vt = new VirtualTerminal(80, 24);
  vt.write("\n\u2190 back  Menu\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\nContent here\n");

  const sr = new ScreenReader(vt);
  const page = sr.currentPage();
  assert(page !== null && page.includes("Menu"), `page should be Menu, got ${page}`);
});

test("contains and find work with screen reader", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("Hello World\r\nSecond Line");

  const sr = new ScreenReader(vt);
  assertEqual(sr.contains("Hello"), true, "contains Hello");
  assertEqual(sr.contains("Missing"), false, "does not contain Missing");

  const pos = sr.find("Second");
  assert(pos !== null, "find Second");
  assertEqual(pos!.row, 1, "row");
  assertEqual(pos!.col, 0, "col");
});

// ═════════════════════════════════════════════════════════════
// ASSERTIONS TESTS
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Assertions\x1b[0m\n");

test("textVisible passes when text present", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("Hello World");
  const sr = new ScreenReader(vt);
  const asserts = new Assertions(vt, sr);
  asserts.textVisible("Hello"); // should not throw
});

test("textVisible throws when text absent", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("Hello World");
  const sr = new ScreenReader(vt);
  const asserts = new Assertions(vt, sr);
  let threw = false;
  try {
    asserts.textVisible("Missing");
  } catch (e) {
    threw = true;
    assert(e instanceof AssertionError, "should be AssertionError");
  }
  assert(threw, "should have thrown");
});

test("textNotVisible passes when text absent", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("Hello World");
  const sr = new ScreenReader(vt);
  const asserts = new Assertions(vt, sr);
  asserts.textNotVisible("Missing"); // should not throw
});

test("textNotVisible throws when text present", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("Hello World");
  const sr = new ScreenReader(vt);
  const asserts = new Assertions(vt, sr);
  let threw = false;
  try {
    asserts.textNotVisible("Hello");
  } catch {
    threw = true;
  }
  assert(threw, "should have thrown");
});

test("textIsBold passes when text is bold", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("\x1b[1mBoldText\x1b[0m");
  const sr = new ScreenReader(vt);
  const asserts = new Assertions(vt, sr);
  asserts.textIsBold("BoldText"); // should not throw
});

test("textIsBold throws when text is not bold", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("NormalText");
  const sr = new ScreenReader(vt);
  const asserts = new Assertions(vt, sr);
  let threw = false;
  try {
    asserts.textIsBold("NormalText");
  } catch {
    threw = true;
  }
  assert(threw, "should have thrown");
});

test("noOverflow passes with correct buffer", () => {
  const vt = new VirtualTerminal(40, 10);
  vt.write("Hello");
  const sr = new ScreenReader(vt);
  const asserts = new Assertions(vt, sr);
  asserts.noOverflow(); // should not throw
});

test("menuItemCount passes with correct count", () => {
  const vt = new VirtualTerminal(80, 24);
  vt.write("  \u276f \u25c6 Item1 [1]\n");
  vt.write("     \u25c6 Item2 [2]\n");
  const sr = new ScreenReader(vt);
  const asserts = new Assertions(vt, sr);
  asserts.menuItemCount(2); // should not throw
});

test("menuItemSelected passes with correct selection", () => {
  const vt = new VirtualTerminal(80, 24);
  vt.write("  \u276f \u25c6 First [1]\n");
  vt.write("     \u25c6 Second [2]\n");
  const sr = new ScreenReader(vt);
  const asserts = new Assertions(vt, sr);
  asserts.menuItemSelected("First"); // should not throw
});

// ═════════════════════════════════════════════════════════════
// REPORTER TESTS
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Reporter\x1b[0m\n");

test("Reporter tracks pass/fail steps", () => {
  const reporter = new Reporter("Test", "cmd", 80, 24);
  reporter.addStep("step1", true, 10);
  reporter.addStep("step2", false, 20, "failed");
  reporter.addStep("step3", true, 5);
  const report = reporter.getReport();
  assertEqual(report.passed, 2, "2 passed");
  assertEqual(report.failed, 1, "1 failed");
  assertEqual(report.steps.length, 3, "3 steps");
});

test("Reporter.format produces output", () => {
  const reporter = new Reporter("Test", "cmd", 80, 24);
  reporter.addStep("step1", true, 10);
  const output = reporter.format();
  assert(output.includes("Test"), "includes test name");
  assert(output.includes("\u2714"), "includes checkmark");
});

// ═════════════════════════════════════════════════════════════
// COMPLEX ANSI SEQUENCES (real framework output simulation)
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Complex ANSI Parsing\x1b[0m\n");

test("Full terminal rendering cycle — home then clear then content", () => {
  const vt = new VirtualTerminal(80, 24);
  // Simulate what runtime.ts does:
  // 1. Enter alt screen
  vt.write("\x1b[?1049h");
  // 2. Hide cursor
  vt.write("\x1b[?25l");
  // 3. Clear screen
  vt.write("\x1b[2J");
  // 4. Move to top
  vt.write("\x1b[H");
  // 5. Write content with colors
  vt.write("\x1b[2K"); // clear line
  vt.write("\x1b[38;5;141mWelcome\x1b[0m");
  vt.write("\n\x1b[2K");
  vt.write("\x1b[1;38;5;141m  \u276f \u25c6 Menu\x1b[0m \x1b[2;38;5;60m[1]\x1b[0m");

  assert(vt.contains("Welcome"), "Welcome visible");
  assert(vt.contains("Menu"), "Menu visible");

  const welcomeCell = vt.cellAt(0, 0)!;
  assert(welcomeCell.fg !== null, "Welcome has color");
});

test("Multiple writes build up screen correctly", () => {
  const vt = new VirtualTerminal(80, 24);
  vt.write("\x1b[?1049h\x1b[?25l\x1b[2J\x1b[H");

  // Write multiple frames like the boot animation
  for (let i = 0; i < 5; i++) {
    vt.write("\x1b[H"); // move to top
    vt.write(`\x1b[2KFrame ${i}\n`);
  }

  assert(vt.contains("Frame 4"), "last frame visible");
});

test("OSC sequences are consumed without crashing", () => {
  const vt = new VirtualTerminal(80, 24);
  // OSC to set window title
  vt.write("\x1b]0;My Terminal Title\x07");
  vt.write("Normal text after OSC");
  assert(vt.contains("Normal text after OSC"), "text after OSC");
});

test("Insert/Delete lines", () => {
  const vt = new VirtualTerminal(20, 5);
  vt.write("Line0\nLine1\nLine2\nLine3\nLine4");
  vt.write("\x1b[2;1H"); // row 2 (1-indexed = row 1 0-indexed)
  vt.write("\x1b[1L"); // insert 1 line at row 1
  const line1 = vt.cells()[1].map(c => c.char).join("").trim();
  assertEqual(line1, "", "inserted blank line");
});

test("Delete characters", () => {
  const vt = new VirtualTerminal(20, 5);
  vt.write("ABCDEFGHIJ");
  vt.write("\x1b[1;3H"); // col 3 (1-indexed)
  vt.write("\x1b[2P"); // delete 2 chars
  const line = vt.cells()[0].map(c => c.char).join("").trim();
  assertEqual(line, "ABEFGHIJ", "2 chars deleted at position");
});

test("Erase characters (X)", () => {
  const vt = new VirtualTerminal(20, 5);
  vt.write("ABCDEFGHIJ");
  vt.write("\x1b[1;3H"); // col 3
  vt.write("\x1b[3X"); // erase 3 chars (replace with spaces)
  const line = vt.cells()[0].map(c => c.char).join("");
  assertEqual(line.substring(0, 10), "AB   FGHIJ", "3 chars erased");
});

// ═════════════════════════════════════════════════════════════
// SUMMARY
// ═════════════════════════════════════════════════════════════

console.log(`\n\x1b[2m  ${"─".repeat(50)}\x1b[0m`);
console.log(`  \x1b[32m${passed} passed\x1b[0m, ${failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : "0 failed"}`);
console.log("");

if (failed > 0) {
  process.exit(1);
}
