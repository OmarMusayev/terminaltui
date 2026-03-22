import { resolve, dirname } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";

export async function buildAndRun(configPath: string): Promise<void> {
  const absPath = resolve(configPath);

  // Compile the TypeScript config to JavaScript using esbuild or tsup
  const outDir = join(tmpdir(), "terminaltui-dev-" + Date.now());
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "site.config.mjs");

  try {
    // Try using esbuild directly
    const { build } = await import("esbuild");
    await build({
      entryPoints: [absPath],
      outfile: outFile,
      bundle: true,
      format: "esm",
      platform: "node",
      external: ["terminaltui"],
      target: "node18",
    });
  } catch {
    // Fallback: try tsup via CLI
    try {
      execSync(`npx tsup "${absPath}" --format esm --outDir "${outDir}" --no-dts`, {
        stdio: "pipe",
      });
    } catch {
      // Last resort: try to import directly (works if tsx or ts-node is available)
      try {
        const module = await import(pathToFileURL(absPath).href);
        const site = module.default;
        const { runSite } = await import("../core/runtime.js");
        await runSite(site);
        return;
      } catch (e: any) {
        throw new Error(
          `Cannot compile ${configPath}. Install esbuild as a dev dependency:\n` +
          `  npm install --save-dev esbuild\n\n` +
          `Original error: ${e.message}`
        );
      }
    }
  }

  // Import the compiled config
  const fileUrl = pathToFileURL(outFile).href;
  const module = await import(fileUrl);
  const site = module.default;

  if (!site || !site.config) {
    throw new Error("site.config.ts must export a default value created with defineSite()");
  }

  // Run the TUI
  const { runSite } = await import("../core/runtime.js");
  await runSite(site);
}
