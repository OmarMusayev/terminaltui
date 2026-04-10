/**
 * Bundle demo site configs into dist/demos/ as standalone ES modules.
 * Each demo imports from "terminaltui" (the package), not relative paths.
 * Run after the main build so dist/index.js exists.
 */

import { build } from "esbuild";
import { readdirSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DEMOS_DIR = join(ROOT, "demos");
const OUT_DIR = join(ROOT, "dist", "demos");

mkdirSync(OUT_DIR, { recursive: true });

// Skip mac-monitor — it's a standalone npm package with local lib imports,
// not a built-in demo bundled with terminaltui.
const SKIP_DEMOS = ["mac-monitor"];

const demos = readdirSync(DEMOS_DIR).filter(d => {
  const configPath = join(DEMOS_DIR, d, "site.config.ts");
  return existsSync(configPath) && !d.includes(" ") && !SKIP_DEMOS.includes(d);
});

console.log(`Bundling ${demos.length} demos...`);

for (const demo of demos) {
  const configPath = join(DEMOS_DIR, demo, "site.config.ts");
  const outFile = join(OUT_DIR, `${demo}.js`);

  // Read the source and rewrite imports from relative to "terminaltui"
  let source = readFileSync(configPath, "utf-8");
  source = source.replace(
    /from\s+["']\.\.\/\.\.\/src\/index\.js["']/g,
    'from "terminaltui"'
  );
  source = source.replace(
    /from\s+["']\.\.\/\.\.\/src\/index["']/g,
    'from "terminaltui"'
  );

  // Write temp file with corrected imports
  const tmpFile = join(OUT_DIR, `_tmp_${demo}.ts`);
  writeFileSync(tmpFile, source);

  try {
    await build({
      entryPoints: [tmpFile],
      outfile: outFile,
      bundle: true,
      format: "esm",
      platform: "node",
      external: ["terminaltui"],
      target: "node18",
    });
    console.log(`  ✓ ${demo}`);
  } catch (err: any) {
    console.error(`  ✗ ${demo}: ${err.message}`);
  }

  // Clean up temp file
  const { unlinkSync } = await import("node:fs");
  try { unlinkSync(tmpFile); } catch {}
}

console.log("Done.");
