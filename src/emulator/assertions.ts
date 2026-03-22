/**
 * Assertion library for screen state validation.
 * Each method throws with a descriptive message on failure.
 */

import type { VirtualTerminal } from "./vterm.js";
import type { ScreenReader } from "./screen-reader.js";
import type { Cell } from "./types.js";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

export class Assertions {
  private vterm: VirtualTerminal;
  private screen: ScreenReader;
  private snapshotDir: string;

  constructor(vterm: VirtualTerminal, screen: ScreenReader, snapshotDir: string = ".snapshots") {
    this.vterm = vterm;
    this.screen = screen;
    this.snapshotDir = snapshotDir;
  }

  /** Assert that the given text is visible on screen. */
  textVisible(text: string): void {
    if (!this.screen.contains(text)) {
      throw new AssertionError(
        `Expected text "${text}" to be visible on screen`,
        this.screen.text(),
      );
    }
  }

  /** Assert that the given text is NOT visible on screen. */
  textNotVisible(text: string): void {
    if (this.screen.contains(text)) {
      throw new AssertionError(
        `Expected text "${text}" to NOT be visible on screen`,
        this.screen.text(),
      );
    }
  }

  /** Assert the current page matches. */
  currentPage(expected: string): void {
    const actual = this.screen.currentPage();
    if (!actual || !actual.toLowerCase().includes(expected.toLowerCase())) {
      throw new AssertionError(
        `Expected current page to be "${expected}", got "${actual}"`,
        this.screen.text(),
      );
    }
  }

  /** Assert the number of menu items. */
  menuItemCount(expected: number): void {
    const menu = this.screen.menu();
    if (menu.items.length !== expected) {
      throw new AssertionError(
        `Expected ${expected} menu items, found ${menu.items.length}: [${menu.items.join(", ")}]`,
        this.screen.text(),
      );
    }
  }

  /** Assert the currently selected menu item. */
  menuItemSelected(expected: string): void {
    const menu = this.screen.menu();
    if (menu.selectedIndex < 0) {
      throw new AssertionError(
        `No menu item is selected (expected "${expected}")`,
        this.screen.text(),
      );
    }
    const actual = menu.items[menu.selectedIndex];
    if (!actual.toLowerCase().includes(expected.toLowerCase())) {
      throw new AssertionError(
        `Expected selected menu item to be "${expected}", got "${actual}"`,
        this.screen.text(),
      );
    }
  }

  /**
   * Assert that text at a location has a specific foreground color.
   * Color matching is approximate — compares hex values.
   */
  textHasColor(text: string, expectedHex: string): void {
    const pos = this.vterm.find(text);
    if (!pos) {
      throw new AssertionError(
        `Text "${text}" not found on screen`,
        this.screen.text(),
      );
    }

    const normalizedExpected = expectedHex.toLowerCase().replace(/^#/, "");
    const cell = this.vterm.cellAt(pos.row, pos.col);
    if (!cell || !cell.fg) {
      throw new AssertionError(
        `Text "${text}" has no foreground color (expected #${normalizedExpected})`,
        this.screen.text(),
      );
    }

    const normalizedActual = cell.fg.toLowerCase().replace(/^#/, "");
    if (normalizedActual !== normalizedExpected) {
      throw new AssertionError(
        `Text "${text}" has color #${normalizedActual}, expected #${normalizedExpected}`,
        this.screen.text(),
      );
    }
  }

  /** Assert that text is rendered bold. */
  textIsBold(text: string): void {
    const pos = this.vterm.find(text);
    if (!pos) {
      throw new AssertionError(
        `Text "${text}" not found on screen`,
        this.screen.text(),
      );
    }

    const cell = this.vterm.cellAt(pos.row, pos.col);
    if (!cell || !cell.bold) {
      throw new AssertionError(
        `Text "${text}" is not bold`,
        this.screen.text(),
      );
    }
  }

  /** Assert that a border is visible on screen (box-drawing characters). */
  borderVisible(): void {
    const text = this.screen.text();
    const borderChars = [
      "\u256d", "\u256e", "\u2570", "\u256f", // rounded
      "\u250c", "\u2510", "\u2514", "\u2518", // single
      "\u2554", "\u2557", "\u255a", "\u255d", // double
      "\u250f", "\u2513", "\u2517", "\u251b", // heavy
    ];

    const hasBorder = borderChars.some(ch => text.includes(ch));
    if (!hasBorder) {
      throw new AssertionError(
        "No border (box-drawing characters) visible on screen",
        text,
      );
    }
  }

  /** Assert no text overflows past terminal width. */
  noOverflow(): void {
    const cells = this.vterm.cells();
    const cols = this.vterm.cols;

    for (let r = 0; r < cells.length; r++) {
      // Check that row length matches terminal width
      if (cells[r].length > cols) {
        throw new AssertionError(
          `Row ${r} has ${cells[r].length} cells, exceeding terminal width of ${cols}`,
          this.screen.text(),
        );
      }
    }
  }

  /**
   * Compare current screen to a stored snapshot.
   * On first run, creates the snapshot. On subsequent runs, compares.
   */
  matchesSnapshot(name: string): void {
    const snapshotPath = join(this.snapshotDir, `${name}.txt`);
    const currentText = this.screen.text();

    if (!existsSync(snapshotPath)) {
      // Create snapshot
      mkdirSync(dirname(snapshotPath), { recursive: true });
      writeFileSync(snapshotPath, currentText, "utf-8");
      return; // First run — always passes
    }

    const savedText = readFileSync(snapshotPath, "utf-8");
    if (currentText !== savedText) {
      // Find first difference
      const currentLines = currentText.split("\n");
      const savedLines = savedText.split("\n");
      let diffLine = -1;
      for (let i = 0; i < Math.max(currentLines.length, savedLines.length); i++) {
        if (currentLines[i] !== savedLines[i]) {
          diffLine = i;
          break;
        }
      }

      throw new AssertionError(
        `Snapshot "${name}" does not match (first diff at line ${diffLine + 1}).\n` +
        `  Expected: ${JSON.stringify(savedLines[diffLine] ?? "<missing>")}\n` +
        `  Actual:   ${JSON.stringify(currentLines[diffLine] ?? "<missing>")}`,
        currentText,
      );
    }
  }
}

export class AssertionError extends Error {
  screenContent: string;

  constructor(message: string, screenContent: string) {
    super(message);
    this.name = "AssertionError";
    this.screenContent = screenContent;
  }
}
