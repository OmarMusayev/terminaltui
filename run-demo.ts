#!/usr/bin/env npx tsx
/**
 * Quick demo launcher — run any demo from the local source.
 *
 * Usage:
 *   npx tsx run-demo.ts                  # list all demos
 *   npx tsx run-demo.ts dashboard        # run a specific demo
 */
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const demosDir = join(import.meta.dirname, "demos");
const name = process.argv[2];

// List all available demos
const demos = readdirSync(demosDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(join(demosDir, d.name, "site.config.ts")))
  .map(d => d.name);

if (!name) {
  console.log("\n  Available demos:\n");
  for (const d of demos) {
    console.log(`    npx tsx run-demo.ts ${d}`);
  }
  console.log("");
  process.exit(0);
}

if (!demos.includes(name)) {
  console.error(`\n  Unknown demo: "${name}"\n`);
  console.log("  Available demos:\n");
  for (const d of demos) console.log(`    ${d}`);
  console.log("");
  process.exit(1);
}

// Import and run
const configPath = join(demosDir, name, "site.config.ts");
const module = await import(configPath);
const site = module.default;
const { runSite } = await import("./src/core/runtime.js");
await runSite(site);
