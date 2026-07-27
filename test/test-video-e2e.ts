/**
 * Video, end to end, through a real terminal.
 *
 * Two things can only be asserted here and nowhere else:
 *
 *   1. THE PICTURE ACTUALLY MOVES. Every other suite tests a function that
 *      decides which frame is current; this one boots an app, presses Space,
 *      and checks that the CELLS CHANGE — which is the whole feature.
 *   2. `TERMINALTUI_VIDEO=off` really does freeze it. That switch is what the
 *      emulator injects by default, and if it ever stopped working every demo
 *      suite would start hanging in `waitForIdle` instead of failing here.
 *
 * `waitForIdle` is deliberately NEVER called against a playing video: it
 * settles by observing that the screen stopped changing, so a playing video
 * makes it throw after its full timeout. Motion is detected with an explicit
 * poll instead.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import jpeg from "jpeg-js";

import { TUIEmulator } from "../src/emulator/index.js";
import { encodePack } from "../src/video/pack.js";

const PROJECT_ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

const COLS = 80;
const ROWS = 24;

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed++; return; }
  failed++;
  console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? `: ${detail}` : ""}`);
}

const DIR = join(tmpdir(), `tui-video-e2e-${process.pid}`);

/**
 * A pack whose frames are FLAT, SATURATED and very different from each other.
 *
 * Deliberately not a real clip: the assertion is "the cells changed", and a
 * dark cinematic frame differs from the next one by a handful of cells at the
 * quadrant tier, which is indistinguishable from noise. Solid colour steps
 * make motion unambiguous.
 */
function buildFixture(): void {
  mkdirSync(join(DIR, "pages"), { recursive: true });
  mkdirSync(join(DIR, "assets"), { recursive: true });
  // tsx compiles a .ts file with no package.json above it as CJS, which cannot
  // hold the top-level await the generated entry point needs.
  writeFileSync(join(DIR, "package.json"), `{"type":"module"}\n`);

  const W = 64, H = 32, N = 8;
  const frames: Uint8Array[] = [];
  for (let i = 0; i < N; i++) {
    const data = Buffer.alloc(W * H * 4);
    // Hue-stepped flat fields: frame i is a completely different colour to i+1.
    const r = (i * 32) % 256, g = (255 - i * 32) % 256, b = (i * 64) % 256;
    for (let p = 0; p < W * H; p++) {
      data[p * 4] = r; data[p * 4 + 1] = g; data[p * 4 + 2] = b; data[p * 4 + 3] = 255;
    }
    frames.push(new Uint8Array(jpeg.encode({ data, width: W, height: H }, 90).data));
  }
  writeFileSync(join(DIR, "assets", "clip.tvf"), encodePack({
    width: W, height: H, fps: 10, frameCount: N,
    durationMs: (N / 10) * 1000, sourceSha1: "0".repeat(40),
  }, frames));

  writeFileSync(join(DIR, "pages", "clip.ts"), `
import { markdown, video } from "${PROJECT_ROOT}/src/index.js";
export const metadata = { label: "Clip", order: 1 };
export default function Clip() {
  return [
    markdown("PLAYERPAGE"),
    video("./assets/clip.tvf", { width: 30, controls: true, autoplay: false, loop: true, alt: "CLIPALT" }),
  ];
}
`);
  // Same environment pinning as test-image-rendering.ts, and for the same
  // reason: node-pty is not installed, so the child's stdout is a pipe and the
  // tier ladder would degrade to "ascii" — which has no colour and therefore
  // far fewer distinguishable cells to detect motion with.
  writeFileSync(join(DIR, "run.ts"), `
process.env.LANG = "en_US.UTF-8";
process.env.TERM = "xterm-256color";
delete process.env.NO_COLOR;
delete process.env.COLORTERM;
delete process.env.TERM_PROGRAM;
delete process.env.TMUX;
delete process.env.STY;
delete process.env.WT_SESSION;
(process.stdout as any).isTTY = true;
const { runFileBasedSite, defineConfig } = await import("${PROJECT_ROOT}/src/index.js");
await runFileBasedSite({
  config: defineConfig({
    name: "VIDEOE2E",
    tagline: "video engine",
    theme: "nord",
    animations: { boot: false },
  }),
  pagesDir: "${DIR}/pages",
  outDir: "${DIR}/.terminaltui",
});
`);
}

/**
 * The picture's own cells, as one string.
 *
 * `ansi()` rather than `text()`: the picture is drawn with SPACE and quadrant
 * glyphs whose identity is carried almost entirely by their COLOUR, so two
 * completely different frames have nearly identical plain text. Comparing the
 * styled output is what makes "the picture changed" mean anything.
 */
function pictureText(emu: TUIEmulator): string {
  return emu.screen.ansi();
}

/**
 * Poll for N DISTINCT pictures inside a window.
 *
 * Never calls waitForIdle — see the file docblock.
 */
async function countDistinctFrames(emu: TUIEmulator, ms: number): Promise<number> {
  const seen = new Set<string>();
  const until = Date.now() + ms;
  while (Date.now() < until) {
    seen.add(pictureText(emu));
    await new Promise(r => setTimeout(r, 40));
  }
  return seen.size;
}

async function main(): Promise<void> {
  console.log("\n  Video End-to-End Tests\n");

  if (process.platform === "win32") {
    console.log("  skipped on win32 (the piped-stdio fallback cannot drive live apps)\n");
    console.log("  0 passed, 0 failed\n");
    return;
  }

  buildFixture();

  // ── Playing ────────────────────────────────────────────
  {
    const emu = await TUIEmulator.launch({
      command: `tsx ${join(DIR, "run.ts")}`,
      cwd: DIR, cols: COLS, rows: ROWS, timeout: 45000,
      // Opt back INTO video: the emulator injects TERMINALTUI_VIDEO=off, which
      // is exactly what the second block below verifies.
      env: { TERMINALTUI_VIDEO: "on", TERMINALTUI_IMAGE: "quadrant" },
    });
    try {
      await emu.waitForBoot();
      await emu.press("enter");
      await emu.waitForIdle();

      check("the page opened", emu.screen.text().includes("PLAYERPAGE"),
        emu.screen.text().split("\n").filter(l => l.trim()).slice(0, 8).join(" | "));

      // Paused on the poster: the screen must be able to settle at all.
      const still = pictureText(emu);
      const stillAgain = await (async () => {
        await new Promise(r => setTimeout(r, 500));
        return pictureText(emu);
      })();
      check("a paused video lets the screen settle", still === stillAgain,
        "the picture changed while paused");

      // Space plays it.
      await emu.press("space");
      const distinct = await countDistinctFrames(emu, 1500);
      check("the picture MOVES once played", distinct >= 4,
        `only ${distinct} distinct frames in 1.5s (expected >= 4)`);

      // Space again pauses it, and it stays paused.
      await emu.press("space");
      await new Promise(r => setTimeout(r, 250));
      const paused = pictureText(emu);
      await new Promise(r => setTimeout(r, 600));
      check("Space pauses it again", pictureText(emu) === paused,
        "the picture kept moving after pause");

      // The transport row reports a position.
      check("the transport row shows a position", /\d+\/8/.test(emu.screen.text()),
        emu.screen.text().split("\n").slice(-6).join(" | "));
    } finally {
      await emu.kill();
    }
  }

  // ── Frozen by the env switch ───────────────────────────
  {
    const emu = await TUIEmulator.launch({
      command: `tsx ${join(DIR, "run.ts")}`,
      cwd: DIR, cols: COLS, rows: ROWS, timeout: 45000,
      // No env override: the emulator's default TERMINALTUI_VIDEO=off applies.
      env: { TERMINALTUI_IMAGE: "quadrant" },
    });
    try {
      await emu.waitForBoot();
      await emu.press("enter");
      await emu.waitForIdle();
      await emu.press("space");
      // waitForIdle would THROW here if the switch were broken — which is the
      // real point of the switch, so assert it directly.
      let settled = true;
      try {
        await emu.waitForIdle(400, { timeout: 3000 });
      } catch {
        settled = false;
      }
      check("TERMINALTUI_VIDEO=off keeps the screen settleable", settled,
        "waitForIdle threw, so the demo suites would hang");

      const before = pictureText(emu);
      await new Promise(r => setTimeout(r, 800));
      check("and the picture genuinely does not move", pictureText(emu) === before);
    } finally {
      await emu.kill();
    }
  }

  if (failed === 0 || process.env.KEEP_DIR !== "1") rmSync(DIR, { recursive: true, force: true });
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

void main();
