#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "site.config.ts");

// Dynamic import of the dev runner
const { buildAndRun } = await import("../../src/cli/dev.js");
await buildAndRun(configPath);
