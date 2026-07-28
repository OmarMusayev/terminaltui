#!/usr/bin/env node

import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";

const args = process.argv.slice(2);
const command = args[0];

/**
 * Best-effort terminal restore for errors that surface after the runtime
 * entered alt-screen/raw mode. A startup crash (e.g. a throw inside the
 * user's config during the first render) rejects runtime.start(), so the
 * runtime's own cleanup never runs — without this the shell is left in the
 * alternate buffer with a hidden cursor. Safe to call when nothing was set
 * up: showing the cursor / leaving the alt screen are no-ops then.
 */
function restoreTerminal(): void {
  const stdin = process.stdin;
  try {
    if (stdin.isTTY && stdin.isRaw) stdin.setRawMode(false);
  } catch { /* stdin may already be closed */ }
  if (process.stdout.isTTY) {
    process.stdout.write("\x1b[?25h\x1b[?1049l\x1b[0m");
  }
}

/**
 * Restore the terminal, then print the error message followed by its dimmed
 * stack frames — user-config failures need file:line to be actionable.
 */
function printCliError(prefix: string, err: any): void {
  restoreTerminal();
  const message = err instanceof Error ? err.message : String(err);
  console.error(`${prefix}: ${message}`);
  if (err instanceof Error && err.stack) {
    // Slice from the first "at ..." frame — messages can span multiple lines.
    const firstFrame = err.stack.search(/^\s+at /m);
    if (firstFrame !== -1) {
      console.error(`\x1b[2m${err.stack.slice(firstFrame)}\x1b[0m`);
    }
  }
}

async function main() {
  // `<cmd> --help` / `<cmd> -h` must never be forwarded as a config path or
  // (worse) boot a live SSH listener — route it to help before dispatch.
  // `demo` shows its own listing; `art` and `video` print their own usage in
  // their dispatchers, because their subcommands each take different flags and
  // a single global help page cannot say anything useful about them.
  if (command && command !== "art" && command !== "video" &&
      args.slice(1).some(a => a === "--help" || a === "-h")) {
    if (command === "demo") {
      await runDemo(undefined);
    } else {
      printHelp();
    }
    return;
  }

  switch (command) {
    case "dev":
      await runDev();
      break;
    case "init":
      await runInit(args[1]);
      break;
    case "build":
      await runBuild();
      break;
    case "test":
      await runTestCommand();
      break;
    case "art":
      await runArtCommand();
      break;
    case "convert":
      await runConvert();
      break;
    case "video":
      await runVideoCommand();
      break;
    case "create":
      await runCreateCommand();
      break;
    case "demo":
      await runDemo(args[1]);
      break;
    case "try":
      await runDemo("welcome");
      break;
    case "validate":
      await runValidate();
      break;
    case "serve":
      await runServeCommand();
      break;
    case "help":

    case "--help":
    case "-h":
      printHelp();
      break;
    case "version":
    case "--version":
    case "-v":
      printVersion();
      break;
    default:
      if (!command) {
        // No command = try to run dev
        await runDev();
      } else {
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
      }
  }
}

async function runDev() {
  // Accept an explicit path as argument: `terminaltui dev path/to/config.ts`
  const explicit = args[1];
  let configPath: string | null;
  if (explicit) {
    const resolved = resolve(explicit);
    configPath = existsSync(resolved) ? resolved : null;
  } else {
    configPath = findConfig();
  }
  if (!configPath) {
    console.error(explicit
      ? `Error: Config file not found: ${explicit}`
      : "Error: No config.ts found alongside a pages/ directory.");
    console.error("Run 'terminaltui init' to create one, or pass a path: terminaltui dev path/to/config.ts");
    process.exit(1);
  }

  // We need to compile and run the config
  // Use dynamic import with tsx or ts-node, or compile with esbuild
  try {
    const { buildAndRun } = await import("./dev.js");
    await buildAndRun(configPath);
  } catch (err: any) {
    printCliError("Error starting dev server", err);
    process.exit(1);
  }
}

async function runInit(template?: string) {
  const { scaffoldProject } = await import("./init.js");
  await scaffoldProject(template);
}

async function runBuild() {
  const explicit = args[1];
  let configPath: string | null;
  if (explicit) {
    const resolved = resolve(explicit);
    configPath = existsSync(resolved) ? resolved : null;
  } else {
    configPath = findConfig();
  }
  if (!configPath) {
    console.error(explicit
      ? `Error: Config file not found: ${explicit}`
      : "Error: No config.ts found alongside a pages/ directory.");
    process.exit(1);
  }

  try {
    const { buildProject } = await import("./build.js");
    await buildProject(configPath);
  } catch (err: any) {
    printCliError("Build error", err);
    process.exit(1);
  }
}

async function runTestCommand() {
  const configPath = findConfig();
  if (!configPath) {
    console.error("Error: No config.ts + pages/ found in current directory.");
    console.error("Run 'terminaltui init' to create one.");
    process.exit(1);
  }

  const colsFlag = args.find(a => a.startsWith("--cols="));
  const cols = colsFlag ? parseInt(colsFlag.split("=")[1]) : undefined;
  const sizes = args.includes("--sizes");
  const verbose = args.includes("--verbose") || args.includes("-v");

  try {
    const { runTest } = await import("./test.js");
    await runTest({ configPath, cols, sizes, verbose });
  } catch (err: any) {
    printCliError("Test error", err);
    process.exit(1);
  }
}

async function runArtCommand() {
  const { runArt } = await import("./art.js");
  await runArt(args.slice(1));
}

async function runCreateCommand() {
  const { runCreate } = await import("./create.js");
  await runCreate();
}

const DEMO_NAMES = [
  "welcome",
  "restaurant",
  "dashboard",
  "band",
  "coffee-shop",
  "conference",
  "developer-portfolio",
  "freelancer",
  "startup",
  "server-dashboard",
  "mac-monitor",
] as const;

async function runDemo(name?: string) {
  if (!name) {
    console.log(`
  \x1b[1mterminaltui demo\x1b[0m — run a built-in demo site

  Usage:  terminaltui demo <name>

  Available demos:
    \x1b[1m\x1b[36mwelcome\x1b[0m               5-page guided tour of the framework (also: \x1b[1mterminaltui try\x1b[0m)
    \x1b[36mrestaurant\x1b[0m            Fine dining menu, wine list, reservations
    \x1b[36mdashboard\x1b[0m             Monitoring dashboard with live data
    \x1b[36mband\x1b[0m                  Band site with music, shows, merch
    \x1b[36mcoffee-shop\x1b[0m           Cozy coffee shop with menu and story
    \x1b[36mconference\x1b[0m            Tech conference with schedule and speakers
    \x1b[36mdeveloper-portfolio\x1b[0m   Developer portfolio with projects
    \x1b[36mfreelancer\x1b[0m            Freelancer landing page
    \x1b[36mstartup\x1b[0m               Startup landing page
    \x1b[36mserver-dashboard\x1b[0m      System metrics, container table, log stream
    \x1b[36mmac-monitor\x1b[0m           Live macOS Activity Monitor (CPU/mem/GPU/disk/net/battery) — darwin only

  Example:
    npx terminaltui demo restaurant
`);
    return;
  }

  if (!DEMO_NAMES.includes(name as any)) {
    console.error(`Unknown demo: ${name}`);
    console.error(`Available: ${DEMO_NAMES.join(", ")}`);
    process.exit(1);
  }

  const pkgRoot = findPackageRoot();
  const srcPath = join(pkgRoot, "demos", name, "config.ts");
  if (!existsSync(srcPath)) {
    console.error(`Demo files not found for: ${name}`);
    console.error("This may be a packaging issue. Try reinstalling terminaltui.");
    process.exit(1);
  }

  try {
    const { buildAndRun } = await import("./dev.js");
    await buildAndRun(srcPath);
  } catch (err: any) {
    printCliError("Error running demo", err);
    process.exit(1);
  }
}

async function runValidate() {
  const cwd = process.cwd();
  const configTs = join(cwd, "config.ts");
  const pagesDir = join(cwd, "pages");

  if (!existsSync(configTs) || !existsSync(pagesDir)) {
    console.error("Error: No config.ts + pages/ found. Validate only works with file-based routing projects.");
    process.exit(1);
  }

  try {
    const { mkdirSync } = await import("node:fs");
    const outDir = join(cwd, ".terminaltui");
    mkdirSync(outDir, { recursive: true });

    const { loadFileBasedConfig } = await import("../router/page-loader.js");
    const { FileRouter } = await import("../router/resolver.js");

    const config = await loadFileBasedConfig(configTs, outDir);
    const router = new FileRouter({
      config,
      pagesDir,
      apiDir: existsSync(join(cwd, "api")) ? join(cwd, "api") : undefined,
      outDir,
    });

    await router.initialize();
    const warnings = router.validate();

    if (warnings.length === 0) {
      console.log("\n  \x1b[32m✓\x1b[0m No issues found.\n");
      process.exit(0);
    } else {
      const { printValidationWarnings } = await import("../router/validate.js");
      printValidationWarnings(warnings);
      const hasErrors = warnings.some(w => w.level === "error");
      process.exit(hasErrors ? 1 : 0);
    }
  } catch (err: any) {
    printCliError("Validation error", err);
    process.exit(1);
  }
}

async function runServeCommand() {
  try {
    const { runServe } = await import("./serve.js");
    await runServe(args);
  } catch (err: any) {
    printCliError("Serve error", err);
    process.exit(1);
  }
}

/**
 * `terminaltui video pack|info` — build and inspect `.tvf` frame packs.
 *
 * Packing is a BUILD-time step by design. `video()` will auto-pack a source it
 * has not seen, but doing it here means the pack is a reviewable artifact next
 * to the rest of the project rather than a surprise in a cache directory, and
 * it is the only way to choose a width or a frame rate other than the default.
 */
async function runVideoCommand() {
  const sub = args[1];
  if (!sub || sub === "--help" || sub === "-h") {
    console.log(`
  terminaltui video pack <source> [options]   build a .tvf frame pack
  terminaltui video info <pack.tvf>           describe an existing pack

  Sources: .gif (no tooling required) | .mp4 .mov .webm .mkv (needs ffmpeg)

  Options for pack:
    -o, --out <path>     output path (default: alongside the source)
    --width <px>         max frame width; height follows the aspect (default 960)
    --fps <n>            frames per second (default 12)
    --quality <2-31>     JPEG quality, lower is better (default 5)
    --start <seconds>    seek into the source before packing
    --duration <seconds> how much of the source to take
`);
    return;
  }

  const { buildPack, writePack, DEFAULT_PACK_FPS, DEFAULT_PACK_QUALITY, DEFAULT_PACK_WIDTH } =
    await import("../video/pack-build.js");
  const { openPack } = await import("../video/pack.js");

  const num = (name: string, fallback: number): number => {
    const i = args.indexOf(`--${name}`);
    if (i === -1) return fallback;
    const v = Number(args[i + 1]);
    return Number.isFinite(v) ? v : fallback;
  };
  const str = (...names: string[]): string | undefined => {
    for (const n of names) {
      const i = args.indexOf(n);
      if (i !== -1 && args[i + 1]) return args[i + 1];
    }
    return undefined;
  };

  if (sub === "info") {
    const target = args[2];
    if (!target) { console.error("  usage: terminaltui video info <pack.tvf>"); process.exitCode = 2; return; }
    const opened = openPack(resolve(target));
    if (!opened.ok) { console.error(`  cannot read pack: ${opened.reason}`); process.exitCode = 1; return; }
    const h = opened.pack.header;
    const bytes = opened.pack.payload.length;
    console.log(`
  ${target}
    ${h.width}x${h.height}  ${h.frameCount} frames  ${h.fps.toFixed(2)} fps  ${(h.durationMs / 1000).toFixed(2)}s
    ${(bytes / 1024).toFixed(0)} KB of frames, ${(bytes / h.frameCount / 1024).toFixed(1)} KB/frame
    variable frame rate: ${h.delaysMs ? "yes" : "no"}
    source sha1: ${h.sourceSha1}
`);
    return;
  }

  if (sub !== "pack") {
    console.error(`  unknown subcommand "${sub}" — try: terminaltui video --help`);
    process.exitCode = 2;
    return;
  }

  const src = args[2];
  if (!src || src.startsWith("-")) {
    console.error("  usage: terminaltui video pack <source> [-o out.tvf]");
    process.exitCode = 2;
    return;
  }

  const out = str("-o", "--out") ?? src.replace(/\.[^.]+$/, ".tvf");
  const startFlag = args.indexOf("--start");
  const durFlag = args.indexOf("--duration");

  console.log(`  packing ${src}...`);
  const t0 = Date.now();
  const built = buildPack(resolve(src), {
    width: num("width", DEFAULT_PACK_WIDTH),
    fps: num("fps", DEFAULT_PACK_FPS),
    quality: num("quality", DEFAULT_PACK_QUALITY),
    start: startFlag === -1 ? undefined : Number(args[startFlag + 1]),
    duration: durFlag === -1 ? undefined : Number(args[durFlag + 1]),
  });

  if (!built.ok) {
    console.error(`  pack failed: ${built.reason}`);
    if (built.hint) console.error(`  ${built.hint}`);
    process.exitCode = 1;
    return;
  }

  writePack(resolve(out), built.bytes);
  const h = built.header;
  console.log(
    `  ${out}\n` +
    `    ${h.width}x${h.height}  ${h.frameCount} frames  ${h.fps.toFixed(2)} fps  ` +
    `${(h.durationMs / 1000).toFixed(2)}s  via ${built.via}\n` +
    `    ${(built.bytes.length / 1024).toFixed(0)} KB, ` +
    `${(built.bytes.length / h.frameCount / 1024).toFixed(1)} KB/frame, ` +
    `${((Date.now() - t0) / 1000).toFixed(2)}s`,
  );
}

async function runConvert() {
  const { copyFileSync } = await import("node:fs");

  // 1. Find the docs from the package
  const pkgRoot = findPackageRoot();
  const skillSrc = join(pkgRoot, "claude", "SKILL.md");
  const promptSrc = join(pkgRoot, "claude", "prompt.md");

  if (!existsSync(skillSrc) || !existsSync(promptSrc)) {
    console.error("\x1b[31mError:\x1b[0m Could not find claude/SKILL.md and claude/prompt.md");
    console.error("Looked in:", pkgRoot);
    process.exit(1);
  }

  // 2. Copy the docs into the project directory, replacing __TERMINALTUI_PATH__
  const cwd = process.cwd();
  const skillDest = join(cwd, "TERMINALTUI_SKILL.md");
  const promptDest = join(cwd, "TERMINALTUI_PROMPT.md");

  copyFileSync(skillSrc, skillDest);

  // Replace the placeholder path in prompt.md with the actual TUI project path
  let promptContent = readFileSync(promptSrc, "utf-8");
  promptContent = promptContent.replace(/__TERMINALTUI_PATH__/g, pkgRoot);
  writeFileSync(promptDest, promptContent, "utf-8");

  // 3. Tell the user what to do
  console.log("");
  console.log("\x1b[1m\x1b[35m  terminaltui convert\x1b[0m");
  console.log("");
  console.log("  \x1b[32m\u2713\x1b[0m Dropped into your project:");
  console.log("    \x1b[36mTERMINALTUI_SKILL.md\x1b[0m  \u2014 full framework API reference");
  console.log("    \x1b[36mTERMINALTUI_PROMPT.md\x1b[0m \u2014 conversion guide (paths pre-filled)");
  console.log("");
  console.log("  \x1b[36mFramework path:\x1b[0m " + pkgRoot);
  console.log("");
  console.log("  \x1b[1mNext:\x1b[0m Run \x1b[1mclaude\x1b[0m and paste this prompt:");
  console.log("");
  console.log("  \x1b[2m\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\x1b[0m");
  console.log("");
  console.log("  Read TERMINALTUI_SKILL.md for the terminaltui API, then");
  console.log("  read TERMINALTUI_PROMPT.md for conversion steps. Convert");
  console.log("  this website into a TUI in a tui/ subdirectory. Don't touch");
  console.log("  existing files. Test it with: cd tui && npm run dev");
  console.log("");
  console.log("  \x1b[2m(add your preferences: theme, pages to skip, extra features, etc.)\x1b[0m");
  console.log("");
  console.log("  \x1b[2m\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\x1b[0m");
  console.log("");
  console.log("  When done: \x1b[2mrm TERMINALTUI_SKILL.md TERMINALTUI_PROMPT.md\x1b[0m");
  console.log("");
}

/** Find the terminaltui package root (where claude/ lives). */
function findPackageRoot(): string {
  // Try relative to this file (works from src/cli/ and dist/cli/)
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const candidate1 = resolve(thisDir, "..", ".."); // cli -> src/dist -> root
  if (existsSync(join(candidate1, "claude", "SKILL.md"))) return candidate1;

  // Try node_modules resolution
  const candidate2 = resolve("node_modules", "terminaltui");
  if (existsSync(join(candidate2, "claude", "SKILL.md"))) return candidate2;

  // Fallback: current working directory
  return process.cwd();
}

function findConfig(): string | null {
  const cwd = process.cwd();
  const configTs = join(cwd, "config.ts");
  if (existsSync(configTs) && existsSync(join(cwd, "pages"))) {
    return configTs;
  }
  return null;
}

function printHelp() {
  console.log(`
  terminaltui - Next.js for the terminal. Interactive TUI websites and apps in TypeScript.

  Usage:
    terminaltui <command> [options]

  Commands:
    try          Run a 5-page guided tour of the framework — zero install, zero config
    init [arg]   Scaffold a new project (arg: a template — minimal, portfolio, landing, restaurant, blog, creative — or your site name)
    create       Interactive prompt builder — describe what you want, AI builds it
    convert      Drop terminaltui docs into your project for AI-assisted conversion
    validate     Check file-based routing project for common issues
    dev          Start development preview (auto-starts API server if routes defined)
    serve        Host your TUI over SSH (anyone can connect with ssh)
    demo [name]  Run a built-in demo (welcome, restaurant, dashboard, mac-monitor, etc.)
    build        Bundle for npm publish (includes API routes)
    test         Run automated tests on site in current directory
    art          Manage art assets (list, preview, create, validate)
    video        Build .tvf frame packs for video() blocks (pack, info)
    help         Show this help message

  Test options:
    --cols=N     Test at specific terminal width (default: 80)
    --sizes      Test at multiple widths: 40, 80, 120, 200
    --verbose    Show screen output during tests

  Serve options:
    --port <N>              SSH port (default: 2222)
    --host-key <path>       Host key path (default: .terminaltui/host_key)
    --max-connections <N>   Max simultaneous connections (default: 100)

  Examples:
    npx terminaltui try            # 5-page guided tour
    terminaltui init portfolio
    terminaltui dev
    terminaltui serve --port 2222
    terminaltui create
    terminaltui build
    terminaltui test --sizes --verbose
`);
}

function printVersion() {
  try {
    const pkgPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    console.log(`terminaltui v${pkg.version}`);
  } catch {
    console.log("terminaltui v1.0.0");
  }
}

main().catch((err) => {
  printCliError("Error", err);
  process.exit(1);
});
