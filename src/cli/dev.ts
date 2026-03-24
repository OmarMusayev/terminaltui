import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";

export async function buildAndRun(configPath: string): Promise<void> {
  const absPath = resolve(configPath);
  const projectDir = dirname(absPath);

  // Compile into the project directory so Node's normal module resolution
  // finds node_modules/terminaltui without symlink hacks.
  const outDir = join(projectDir, ".terminaltui");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "compiled.mjs");

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
          `Cannot compile ${configPath}. Install esbuild:\n` +
          `  npm install esbuild\n\n` +
          `Original error: ${e.message}`
        );
      }
    }
  }

  // Import the compiled config — it lives inside the project directory
  // so `import "terminaltui"` resolves via the project's node_modules.
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
