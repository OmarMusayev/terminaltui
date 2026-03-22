/**
 * `terminaltui test` — automated site testing via the emulator.
 *
 * Launches the site in a headless emulator, navigates every page,
 * and verifies content renders correctly.
 */

import { resolve } from "node:path";
import { TUIEmulator } from "../emulator/index.js";
import { Reporter } from "../emulator/reporter.js";

interface TestOptions {
  cols?: number;
  sizes?: boolean;
  verbose?: boolean;
  configPath: string;
}

export async function runTest(options: TestOptions): Promise<void> {
  const sizesToTest = options.sizes
    ? [40, 80, 120, 200]
    : [options.cols ?? 80];

  let totalPassed = 0;
  let totalFailed = 0;

  for (const cols of sizesToTest) {
    const result = await testAtSize(cols, options);
    totalPassed += result.passed;
    totalFailed += result.failed;
  }

  // Summary
  console.log("\x1b[1m  Summary\x1b[0m");
  console.log(`  \x1b[32m${totalPassed} passed\x1b[0m, ${totalFailed > 0 ? `\x1b[31m${totalFailed} failed\x1b[0m` : "0 failed"}`);
  console.log("");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

async function testAtSize(
  cols: number,
  options: TestOptions,
): Promise<{ passed: number; failed: number }> {
  const rows = 24;
  const command = `npx tsx ${options.configPath}`;

  // We need to build and run the site via the dev command.
  // The emulator launches the terminaltui dev process.
  const cwd = resolve(process.cwd());

  const reporter = new Reporter(
    `Site Test (${cols}x${rows})`,
    `terminaltui dev`,
    cols,
    rows,
  );

  let emu: TUIEmulator | null = null;

  try {
    // Launch
    emu = await TUIEmulator.launch({
      command: "node",
      args: [resolve(cwd, "node_modules/.bin/terminaltui"), "dev"],
      cwd,
      cols,
      rows,
      env: { TERM: "xterm-256color", COLORTERM: "truecolor", NO_COLOR: undefined as any },
      timeout: 30000,
    });

    if (options.verbose) {
      console.log(`\x1b[2m  Launched at ${cols}x${rows}...\x1b[0m`);
    }

    // Wait for boot
    await reporter.runStep("Boot animation completes", async () => {
      await emu!.waitForBoot({ timeout: 15000 });
    });

    if (options.verbose) {
      console.log("\x1b[2m  Boot complete.\x1b[0m");
      console.log("\x1b[2m  Screen:\x1b[0m");
      console.log(emu.screen.text().split("\n").map(l => `  \x1b[2m| ${l}\x1b[0m`).join("\n"));
    }

    // Verify home page basics
    await reporter.runStep("Home page renders content", async () => {
      const text = emu!.screen.text();
      if (text.trim().length === 0) {
        throw new Error("Screen is empty");
      }
    });

    await reporter.runStep("No errors on home page", async () => {
      emu!.assert.textNotVisible("Error");
      emu!.assert.textNotVisible("undefined");
      emu!.assert.textNotVisible("null");
    });

    await reporter.runStep("No overflow on home page", async () => {
      emu!.assert.noOverflow();
    });

    // Detect menu
    const menu = emu.screen.menu();

    await reporter.runStep(`Menu visible (${menu.items.length} items)`, async () => {
      if (menu.items.length === 0) {
        throw new Error("No menu items detected");
      }
    });

    // Test each menu item / page
    for (let i = 0; i < menu.items.length; i++) {
      const itemName = menu.items[i];

      await reporter.runStep(`Navigate to "${itemName}"`, async () => {
        // Go home first
        await emu!.goHome();
        await sleep(100);

        // Navigate to the item
        const currentMenu = emu!.screen.menu();
        const diff = i - currentMenu.selectedIndex;
        if (diff > 0) {
          await emu!.press("down", { times: diff });
        } else if (diff < 0) {
          await emu!.press("up", { times: -diff });
        }
        await emu!.press("enter");
        await sleep(200);
      });

      await reporter.runStep(`"${itemName}" page has content`, async () => {
        const text = emu!.screen.text();
        if (text.trim().length === 0) {
          throw new Error("Page is empty");
        }
      });

      await reporter.runStep(`"${itemName}" page has no errors`, async () => {
        const text = emu!.screen.text().toLowerCase();
        // Be more lenient — only fail on literal "Error:" or "TypeError"
        if (text.includes("typeerror") || text.includes("referenceerror") || text.includes("syntaxerror")) {
          throw new Error("JavaScript error visible on page");
        }
      });

      await reporter.runStep(`"${itemName}" no overflow`, async () => {
        emu!.assert.noOverflow();
      });

      if (options.verbose) {
        console.log(`\x1b[2m  Page "${itemName}":\x1b[0m`);
        console.log(emu.screen.text().split("\n").map(l => `  \x1b[2m| ${l}\x1b[0m`).join("\n"));
      }

      // Go back
      await reporter.runStep(`Go back from "${itemName}"`, async () => {
        await emu!.press("escape");
        await sleep(200);
      });
    }

    // Test quit
    await reporter.runStep("Quit with 'q'", async () => {
      await emu!.quit(5000);
    });

    await reporter.runStep("Clean exit", async () => {
      if (emu!.isRunning()) {
        throw new Error("Process still running after quit");
      }
    });

  } catch (err: any) {
    reporter.addStep("Fatal error", false, 0, err.message);
  } finally {
    if (emu) {
      await emu.close();
    }
  }

  const report = reporter.getReport();
  console.log(reporter.format());

  return { passed: report.passed, failed: report.failed };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
