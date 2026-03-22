/**
 * Wait utilities — poll screen state with timeout.
 */

import type { VirtualTerminal } from "./vterm.js";
import type { ScreenReader } from "./screen-reader.js";
import type { WaitOptions } from "./types.js";

const DEFAULT_TIMEOUT = 10000;
const DEFAULT_INTERVAL = 50;

export class Waiter {
  private vterm: VirtualTerminal;
  private screen: ScreenReader;

  constructor(vterm: VirtualTerminal, screen: ScreenReader) {
    this.vterm = vterm;
    this.screen = screen;
  }

  /** Wait until screen contains the given text. */
  async waitForText(text: string, opts?: WaitOptions): Promise<void> {
    await this.waitFor(
      () => this.screen.contains(text),
      `Text "${text}" not found on screen`,
      opts,
    );
  }

  /** Wait until screen no longer contains the given text. */
  async waitForTextGone(text: string, opts?: WaitOptions): Promise<void> {
    await this.waitFor(
      () => !this.screen.contains(text),
      `Text "${text}" still visible on screen`,
      opts,
    );
  }

  /**
   * Wait until the screen has been stable (no changes) for the given duration.
   * Good for waiting for animations to finish.
   */
  async waitForIdle(stableDuration: number = 500, opts?: WaitOptions): Promise<void> {
    const timeout = opts?.timeout ?? DEFAULT_TIMEOUT;
    const interval = opts?.interval ?? DEFAULT_INTERVAL;
    const deadline = Date.now() + timeout;

    let lastText = this.screen.text();
    let stableSince = Date.now();

    while (Date.now() < deadline) {
      const currentText = this.screen.text();
      if (currentText !== lastText) {
        lastText = currentText;
        stableSince = Date.now();
      }

      if (Date.now() - stableSince >= stableDuration) {
        return;
      }

      await sleep(interval);
    }

    // Final check
    if (Date.now() - stableSince >= stableDuration) {
      return;
    }

    throw new Error(`Screen did not stabilize within ${timeout}ms`);
  }

  /**
   * Wait for the boot animation to complete.
   * Detects stability after initial burst of screen changes.
   */
  async waitForBoot(opts?: WaitOptions): Promise<void> {
    const timeout = opts?.timeout ?? 15000;
    const interval = opts?.interval ?? DEFAULT_INTERVAL;
    const deadline = Date.now() + timeout;

    // First wait for any content to appear
    await this.waitFor(
      () => this.screen.text().trim().length > 0,
      "No content appeared after launch",
      { timeout, interval },
    );

    // Then wait for screen to stabilize (boot animation done)
    // Use a longer stable duration since animations are ~1s at 30fps
    await this.waitForIdle(1200, { timeout: Math.max(1000, deadline - Date.now()), interval });
  }

  /**
   * Wait for a custom condition to become true.
   */
  async waitFor(
    condition: () => boolean | Promise<boolean>,
    errorMessage?: string,
    opts?: WaitOptions,
  ): Promise<void> {
    const timeout = opts?.timeout ?? DEFAULT_TIMEOUT;
    const interval = opts?.interval ?? DEFAULT_INTERVAL;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const result = await condition();
      if (result) return;
      await sleep(interval);
    }

    // Final check
    const finalResult = await condition();
    if (finalResult) return;

    throw new Error(errorMessage ?? `Condition not met within ${timeout}ms`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
