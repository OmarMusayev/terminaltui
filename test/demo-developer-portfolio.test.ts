#!/usr/bin/env npx tsx
import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { TUIEmulator } from "../src/emulator/index.js";

const PROJECT_ROOT = join(import.meta.dirname, "..");
const DEMO_DIR = join(PROJECT_ROOT, "demos", "developer-portfolio");

function createRunDir(): string {
  const dir = join(tmpdir(), `tui-portfolio-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "run.ts"), `
import config from "${DEMO_DIR}/config.js";
import { runFileBasedSite } from "${PROJECT_ROOT}/src/index.js";
runFileBasedSite({
  config,
  pagesDir: "${DEMO_DIR}/pages",
  outDir: "${DEMO_DIR}/.terminaltui",
});
`);
  return dir;
}

async function main() {
  let passed = 0, failed = 0;
  const failures: string[] = [];
  function assert(c: boolean, n: string) { if (c) passed++; else { failed++; failures.push(n); } }

  const runDir = createRunDir();
  let emu: TUIEmulator | null = null;

  try {
    emu = await TUIEmulator.launch({
      command: "npx tsx run.ts",
      cwd: runDir,
      cols: 120,
      rows: 40,
      timeout: 30000,
    });

    await emu.waitForBoot();
    assert(emu.screen.text().length > 0, "Boot: screen has content");
    const menu = emu.screen.menu();
    assert(menu.items.length >= 4, "Boot: menu items visible");

    for (let i = 0; i < menu.items.length; i++) {
      await emu.goHome(); await emu.waitForIdle();
      for (let j = 0; j < i; j++) { await emu.press("down"); await emu.waitForIdle(); }
      await emu.press("enter"); await emu.waitForIdle();
      assert(emu.isRunning(), `Page ${i} (${menu.items[i]}): running`);
      assert(emu.screen.text().length > 0, `Page ${i}: has content`);
      await emu.press("down"); await emu.waitForIdle();
      await emu.press("down"); await emu.waitForIdle();
      await emu.press("up"); await emu.waitForIdle();
      assert(emu.isRunning(), `Page ${i}: vertical nav OK`);
      await emu.press("escape"); await emu.waitForIdle();
    }
  } catch (err) { failed++; failures.push(`Exception: ${err}`); }
  finally {
    if (emu) await emu.close();
    try { rmSync(runDir, { recursive: true, force: true }); } catch {}
  }

  console.log(`\ndeveloper-portfolio: ${passed} passed, ${failed} failed`);
  if (failures.length) failures.forEach(f => console.log(`  - ${f}`));
  process.exit(failed > 0 ? 1 : 0);
}

main();
