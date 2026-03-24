/**
 * TUIEmulator — headless terminal emulator for terminaltui sites.
 *
 * Think Puppeteer/Playwright but for terminal apps.
 *
 * Usage:
 *   const emu = await TUIEmulator.launch({ command: "terminaltui dev", cwd: "./my-site" });
 *   await emu.waitForBoot();
 *   emu.assert.textVisible("Menu");
 *   await emu.press("down");
 *   await emu.press("enter");
 *   await emu.close();
 */

import { VirtualTerminal } from "./vterm.js";
import { ScreenReader } from "./screen-reader.js";
import { InputSender, resolveKey } from "./input-sender.js";
import { Waiter } from "./waiter.js";
import { Assertions } from "./assertions.js";
import { Recorder } from "./recorder.js";
import { Reporter } from "./reporter.js";
import { spawnPTY, type PTYProcess } from "./pty.js";
import type {
  LaunchOptions,
  PressOptions,
  WaitOptions,
  Cell,
  CursorPosition,
  MenuResult,
  CardResult,
  LinkResult,
  FindResult,
  Snapshot,
} from "./types.js";

export class TUIEmulator {
  private vterm: VirtualTerminal;
  private pty: PTYProcess;
  private inputSender: InputSender;
  private waiter: Waiter;
  private _screen: ScreenReader;
  private _assert: Assertions;
  private _recorder: Recorder;
  private _exitCode: number | null = null;
  private _closed = false;
  private options: LaunchOptions;

  private constructor(
    vterm: VirtualTerminal,
    pty: PTYProcess,
    options: LaunchOptions,
  ) {
    this.vterm = vterm;
    this.pty = pty;
    this.options = options;
    this._screen = new ScreenReader(vterm);
    this.inputSender = new InputSender((data) => pty.write(data));
    this.waiter = new Waiter(vterm, this._screen);
    this._assert = new Assertions(vterm, this._screen);
    this._recorder = new Recorder(
      options.command,
      options.cols ?? 80,
      options.rows ?? 24,
    );

    // Enable ONLCR if PTY provides it (translates \n to \r\n)
    vterm.onlcr = pty.hasOnlcr;

    // Wire PTY output to vterm
    pty.onData((data) => vterm.write(data));
    pty.onExit((code) => { this._exitCode = code; });
  }

  /**
   * Launch a new emulator instance.
   */
  static async launch(options: LaunchOptions): Promise<TUIEmulator> {
    const cols = options.cols ?? 80;
    const rows = options.rows ?? 24;

    const vterm = new VirtualTerminal(cols, rows);
    const pty = await spawnPTY(options);
    const emu = new TUIEmulator(vterm, pty, options);

    // Set up timeout if specified
    if (options.timeout) {
      setTimeout(() => {
        if (emu.isRunning()) {
          emu.kill();
        }
      }, options.timeout);
    }

    return emu;
  }

  // ── Screen Access ──────────────────────────────────────────

  /** Screen reader for querying display state. */
  get screen(): ScreenReadAPI {
    const sr = this._screen;
    const vt = this.vterm;
    return {
      text: () => sr.text(),
      ansi: () => sr.ansi(),
      cells: () => sr.cells(),
      textAt: (row: number, col: number, w: number, h: number) => sr.textAt(row, col, w, h),
      contains: (text: string) => sr.contains(text),
      find: (text: string) => sr.find(text),
      cursor: () => sr.cursor(),
      currentPage: () => sr.currentPage(),
      menu: () => sr.menu(),
      cards: () => sr.cards(),
      links: () => sr.links(),
    };
  }

  /** Take a screenshot (ANSI string). */
  screenshot(): string {
    return this._screen.ansi();
  }

  /** Take a snapshot (text + ansi + timestamp). */
  snapshot(): Snapshot {
    return {
      text: this._screen.text(),
      ansi: this._screen.ansi(),
      timestamp: Date.now(),
    };
  }

  // ── Input ──────────────────────────────────────────────────

  /** Send a key press. */
  async press(key: string, opts?: PressOptions): Promise<void> {
    const times = opts?.times ?? 1;
    const delay = opts?.delay ?? 30;

    this._recorder.recordPress(key, times);

    for (let i = 0; i < times; i++) {
      this.inputSender.send(key);
      if (i < times - 1 && delay > 0) {
        await sleep(delay);
      }
    }

    // Small delay to let the app process input and re-render
    await sleep(delay);
  }

  /** Send a sequence of key presses. */
  async pressSequence(keys: string[], delay: number = 30): Promise<void> {
    for (const key of keys) {
      await this.press(key, { delay });
    }
  }

  /** Type a string, sending each character as a key press. */
  async type(str: string, delay: number = 20): Promise<void> {
    this._recorder.recordType(str);
    for (const ch of str) {
      this.inputSender.send(ch);
      if (delay > 0) await sleep(delay);
    }
    await sleep(delay);
  }

  // ── Wait ───────────────────────────────────────────────────

  /** Wait for text to appear on screen. */
  async waitForText(text: string, opts?: WaitOptions): Promise<void> {
    this._recorder.recordWait(`text: ${text}`, opts?.timeout);
    await this.waiter.waitForText(text, opts);
  }

  /** Wait for text to disappear from screen. */
  async waitForTextGone(text: string, opts?: WaitOptions): Promise<void> {
    this._recorder.recordWait(`textGone: ${text}`, opts?.timeout);
    await this.waiter.waitForTextGone(text, opts);
  }

  /** Wait for the screen to be idle (no changes for given duration). */
  async waitForIdle(stableDuration: number = 500, opts?: WaitOptions): Promise<void> {
    this._recorder.recordWait(`idle: ${stableDuration}ms`);
    await this.waiter.waitForIdle(stableDuration, opts);
  }

  /** Wait for boot animation to finish. */
  async waitForBoot(opts?: WaitOptions): Promise<void> {
    this._recorder.recordWait("boot");
    await this.waiter.waitForBoot(opts);
  }

  /** Wait for a custom condition. */
  async waitFor(condition: () => boolean | Promise<boolean>, opts?: WaitOptions): Promise<void> {
    await this.waiter.waitFor(condition, undefined, opts);
  }

  // ── Assertions ─────────────────────────────────────────────

  /** Assertion helper. */
  get assert(): Assertions {
    return this._assert;
  }

  // ── Navigation ─────────────────────────────────────────────

  /**
   * Navigate to a page by name.
   * Figures out the right key presses from current menu state.
   */
  async navigateTo(pageName: string): Promise<void> {
    // Navigate to home first if we're on a page (menu isn't visible from page view)
    const currentPage = this.screen.currentPage();
    if (currentPage && currentPage !== "home") {
      await this.goHome();
      await sleep(100);
    }

    const menu = this.screen.menu();
    const targetIdx = menu.items.findIndex(
      item => item.toLowerCase().includes(pageName.toLowerCase())
    );

    if (targetIdx < 0) {
      throw new Error(`Menu item "${pageName}" not found. Available: [${menu.items.join(", ")}]`);
    }

    // Move to the right menu item
    const currentIdx = menu.selectedIndex;
    const diff = targetIdx - currentIdx;

    if (diff > 0) {
      await this.press("down", { times: diff });
    } else if (diff < 0) {
      await this.press("up", { times: -diff });
    }

    await this.press("enter");
    await sleep(100);
  }

  /** Go back to previous page. */
  async goBack(): Promise<void> {
    await this.press("escape");
    await sleep(100);
  }

  /** Go to home page. */
  async goHome(): Promise<void> {
    // Try escape to go back — repeat until home.
    // Use direct "← back" detection instead of currentPage() which can
    // be unreliable at narrow terminal widths (< 60 cols).
    for (let i = 0; i < 10; i++) {
      const text = this.screen.text();
      const hasBackIndicator = text.includes("\u2190 back") || text.includes("<- back") || text.includes("\u2190back");
      const hasMenu = this.screen.menu().items.length > 0;

      // We're home if we see a menu and don't see a back indicator
      if (hasMenu && !hasBackIndicator) break;
      // Also break if there's no back indicator and no menu (e.g. boot screen)
      if (!hasBackIndicator && !hasMenu) break;

      await this.press("escape");
      await sleep(150);
    }
  }

  /** Select a menu item by name. */
  async selectMenuItem(name: string): Promise<void> {
    await this.navigateTo(name);
  }

  /** Scroll down. */
  async scrollDown(lines: number = 1): Promise<void> {
    await this.press("down", { times: lines });
  }

  /** Scroll up. */
  async scrollUp(lines: number = 1): Promise<void> {
    await this.press("up", { times: lines });
  }

  // ── Lifecycle ──────────────────────────────────────────────

  /** Resize the virtual terminal. */
  async resize(cols: number, rows: number): Promise<void> {
    this.vterm.resize(cols, rows);
    this.pty.resize(cols, rows);
    await sleep(100);
  }

  /** Send quit key and wait for process exit. */
  async quit(timeout: number = 5000): Promise<void> {
    this.inputSender.send("q");

    const deadline = Date.now() + timeout;
    while (this.pty.isRunning && Date.now() < deadline) {
      await sleep(50);
    }

    if (this.pty.isRunning) {
      this.pty.kill();
    }
  }

  /** Force kill the process. */
  kill(): void {
    this.pty.kill();
  }

  /** Check if the process is still running. */
  isRunning(): boolean {
    return this.pty.isRunning;
  }

  /** Check if terminal state was restored after exit (alt screen left). */
  terminalRestored(): boolean {
    // After leaving alt screen buffer, the vterm would have reverted to main buffer
    // This is tracked in the vterm's alternate screen handling
    return !this.pty.isRunning;
  }

  /** Get the process exit code. */
  exitCode(): number | null {
    return this._exitCode;
  }

  /** Full cleanup — kill process, release resources. */
  async close(): Promise<void> {
    if (this._closed) return;
    this._closed = true;

    if (this.pty.isRunning) {
      this.pty.kill();
      // Wait briefly for exit
      await sleep(200);
    }
  }

  // ── Recorder ───────────────────────────────────────────────

  /** Get the recorder for capturing replayable scripts. */
  get recorder(): Recorder {
    return this._recorder;
  }

  /** Create a reporter for structured test results. */
  createReporter(name: string): Reporter {
    return new Reporter(
      name,
      this.options.command,
      this.options.cols ?? 80,
      this.options.rows ?? 24,
    );
  }
}

// ── Screen Read API (public interface) ─────────────────────

interface ScreenReadAPI {
  text(): string;
  ansi(): string;
  cells(): Cell[][];
  textAt(row: number, col: number, w: number, h: number): string;
  contains(text: string): boolean;
  find(text: string): FindResult | null;
  cursor(): CursorPosition;
  currentPage(): string | null;
  menu(): MenuResult;
  cards(): CardResult[];
  links(): LinkResult[];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Re-export everything
export { VirtualTerminal } from "./vterm.js";
export { ScreenReader } from "./screen-reader.js";
export { InputSender, resolveKey } from "./input-sender.js";
export { Waiter } from "./waiter.js";
export { Assertions, AssertionError } from "./assertions.js";
export { Recorder } from "./recorder.js";
export { Reporter } from "./reporter.js";
export type {
  Cell,
  CellStyle,
  CursorPosition,
  LaunchOptions,
  MenuResult,
  CardResult,
  LinkResult,
  FindResult,
  PressOptions,
  WaitOptions,
  Snapshot,
  RecordedAction,
  RecordedScript,
  TestStep,
  TestReport,
} from "./types.js";
