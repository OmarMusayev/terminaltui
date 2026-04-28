import { resolve, dirname, join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

export async function buildAndRun(configPath: string): Promise<void> {
  const absPath = resolve(configPath);
  const projectDir = dirname(absPath);

  const pagesDir = join(projectDir, "pages");
  if (!existsSync(pagesDir)) {
    throw new Error(
      `Project at ${projectDir} has no pages/ directory. ` +
      `terminaltui only supports file-based projects (config.ts + pages/).`
    );
  }

  const outDir = join(projectDir, ".terminaltui");
  mkdirSync(outDir, { recursive: true });

  const apiDir = join(projectDir, "api");

  const { loadFileBasedConfig } = await import("../router/page-loader.js");
  const config = await loadFileBasedConfig(absPath, outDir);

  const { runFileBasedSite } = await import("../core/runtime.js");
  await runFileBasedSite({
    config,
    pagesDir,
    apiDir: existsSync(apiDir) ? apiDir : undefined,
    outDir,
  });
}
