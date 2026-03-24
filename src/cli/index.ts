#!/usr/bin/env node

import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";

const args = process.argv.slice(2);
const command = args[0];

async function main() {
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
    case "preview":
      await runPreview();
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
    case "create":
      await runCreateCommand();
      break;
    case "demo":
      await runDemo(args[1]);
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
  // Accept an explicit path as argument: `terminaltui dev path/to/site.config.ts`
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
      : "Error: No site.config.ts found in current directory.");
    console.error("Run 'terminaltui init' to create one, or pass a path: terminaltui dev path/to/site.config.ts");
    process.exit(1);
  }

  // We need to compile and run the config
  // Use dynamic import with tsx or ts-node, or compile with esbuild
  try {
    const { buildAndRun } = await import("./dev.js");
    await buildAndRun(configPath);
  } catch (err: any) {
    console.error("Error starting dev server:", err.message);
    process.exit(1);
  }
}

async function runInit(template?: string) {
  const { scaffoldProject } = await import("./init.js");
  await scaffoldProject(template);
}

async function runBuild() {
  const configPath = findConfig();
  if (!configPath) {
    console.error("Error: No site.config.ts found.");
    process.exit(1);
  }

  try {
    const { buildProject } = await import("./build.js");
    await buildProject(configPath);
  } catch (err: any) {
    console.error("Build error:", err.message);
    process.exit(1);
  }
}

async function runPreview() {
  console.log("Preview mode - rendering single frame...");
  // TODO: render one frame to stdout
}

async function runTestCommand() {
  const configPath = findConfig();
  if (!configPath) {
    console.error("Error: No site.config.ts found in current directory.");
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
    console.error("Test error:", err.message);
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
  "restaurant",
  "dashboard",
  "band",
  "coffee-shop",
  "conference",
  "developer-portfolio",
  "freelancer",
  "startup",
] as const;

async function runDemo(name?: string) {
  if (!name) {
    console.log(`
  \x1b[1mterminaltui demo\x1b[0m — run a built-in demo site

  Usage:  terminaltui demo <name>

  Available demos:
    \x1b[36mrestaurant\x1b[0m            Fine dining menu, wine list, reservations
    \x1b[36mdashboard\x1b[0m             Monitoring dashboard with live data
    \x1b[36mband\x1b[0m                  Band site with music, shows, merch
    \x1b[36mcoffee-shop\x1b[0m           Cozy coffee shop with menu and story
    \x1b[36mconference\x1b[0m            Tech conference with schedule and speakers
    \x1b[36mdeveloper-portfolio\x1b[0m   Developer portfolio with projects
    \x1b[36mfreelancer\x1b[0m            Freelancer landing page
    \x1b[36mstartup\x1b[0m              Startup landing page

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

  // Look for pre-compiled demo in dist/demos/
  const pkgRoot = findPackageRoot();
  const compiledPath = join(pkgRoot, "dist", "demos", `${name}.js`);

  if (existsSync(compiledPath)) {
    const { pathToFileURL } = await import("node:url");
    const module = await import(pathToFileURL(compiledPath).href);
    const site = module.default;
    const { runSite } = await import("../core/runtime.js");
    await runSite(site);
    return;
  }

  // Fallback: try source demos/ directory (for development)
  const srcPath = join(pkgRoot, "demos", name, "site.config.ts");
  if (existsSync(srcPath)) {
    try {
      const { buildAndRun } = await import("./dev.js");
      await buildAndRun(srcPath);
    } catch (err: any) {
      console.error("Error running demo:", err.message);
      process.exit(1);
    }
    return;
  }

  console.error(`Demo files not found for: ${name}`);
  console.error("This may be a packaging issue. Try reinstalling terminaltui.");
  process.exit(1);
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
  const candidates = ["site.config.ts", "site.config.js", "site.config.mjs"];
  for (const c of candidates) {
    const p = join(cwd, c);
    if (existsSync(p)) return p;
  }
  return null;
}

function printHelp() {
  console.log(`
  terminaltui - Turn any website into a beautiful terminal experience

  Usage:
    terminaltui <command> [options]

  Commands:
    init [tpl]   Scaffold a new project (templates: minimal, portfolio, landing, restaurant, blog, creative)
    create       Interactive prompt builder — describe what you want, AI builds it
    convert      Drop terminaltui docs into your project for AI-assisted conversion
    dev          Start development preview (auto-starts API server if routes defined)
    demo [name]  Run a built-in demo (restaurant, dashboard, band, coffee-shop, conference, etc.)
    build        Bundle for npm publish (includes API routes)
    test         Run automated tests on site in current directory
    art          Manage art assets (list, preview, create, validate)
    help         Show this help message

  Test options:
    --cols=N     Test at specific terminal width (default: 80)
    --sizes      Test at multiple widths: 40, 80, 120, 200
    --verbose    Show screen output during tests

  Examples:
    terminaltui init portfolio
    terminaltui dev
    terminaltui create
    terminaltui convert
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
  console.error(err);
  process.exit(1);
});
