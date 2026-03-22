#!/usr/bin/env node

import { resolve, join } from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";

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
  const configPath = findConfig();
  if (!configPath) {
    console.error("Error: No site.config.ts found in current directory.");
    console.error("Run 'terminaltui init' to create one.");
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
    dev          Start development preview (default)
    init [tpl]   Scaffold a new project (templates: minimal, portfolio, landing, restaurant, blog, creative)
    build        Bundle for npm publish
    test         Run automated tests on site in current directory
    preview      Render a single frame to stdout
    art          Manage art assets (list, preview, create, validate)
    help         Show this help message

  Test options:
    --cols=N     Test at specific terminal width (default: 80)
    --sizes      Test at multiple widths: 40, 80, 120, 200
    --verbose    Show screen output during tests

  Examples:
    terminaltui init portfolio
    terminaltui dev
    terminaltui build
    terminaltui test
    terminaltui test --sizes --verbose
`);
}

function printVersion() {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf-8"));
    console.log(`terminaltui v${pkg.version}`);
  } catch {
    console.log("terminaltui v1.0.0");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
