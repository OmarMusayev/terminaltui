import { resolve, dirname, basename, join } from "node:path";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";

export async function buildProject(configPath: string): Promise<void> {
  const absPath = resolve(configPath);
  const projectDir = dirname(absPath);
  const distDir = join(projectDir, "dist");

  mkdirSync(distDir, { recursive: true });

  const outFile = join(distDir, "cli.js");

  // Read the project's package.json to get the name
  const pkgPath = join(projectDir, "package.json");
  let pkgName = "my-tui-site";
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    pkgName = pkg.name || pkgName;
  }

  // Detect project type
  const configName = basename(absPath);
  const pagesDir = join(projectDir, "pages");
  const isFileBased = (configName === "config.ts" || configName === "config.js") && existsSync(pagesDir);

  let entryFile = absPath;

  if (isFileBased) {
    // For file-based projects, create a synthetic entry point that imports all pages
    entryFile = await createFileBasedEntryPoint(projectDir, absPath, distDir);
  }

  try {
    const { build } = await import("esbuild");
    await build({
      entryPoints: [entryFile],
      outfile: outFile,
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node18",
      banner: {
        js: "#!/usr/bin/env node",
      },
      minify: true,
    });

    const { chmodSync } = await import("node:fs");
    chmodSync(outFile, "755");

    // Print build summary
    if (isFileBased) {
      printBuildSummary(projectDir);
    }

    console.log(`\n  Built successfully!`);
    console.log(`  Output: dist/cli.js`);
    console.log(`\n  To publish:`);
    console.log(`    npm publish`);
    console.log(`\n  Users can then run:`);
    console.log(`    npx ${pkgName}\n`);
  } catch (err: any) {
    try {
      execSync(
        `npx tsup "${entryFile}" --format esm --outDir "${distDir}" --no-dts --minify`,
        { cwd: projectDir, stdio: "inherit" }
      );
      console.log("\n  Built successfully with tsup!");
    } catch {
      throw new Error(
        `Build failed. Install esbuild:\n  npm install --save-dev esbuild\n\nError: ${err.message}`
      );
    }
  }
}

/**
 * Create a synthetic entry point for file-based routing projects.
 * This imports config.ts and ALL page files, then runs the site.
 */
async function createFileBasedEntryPoint(
  projectDir: string,
  configPath: string,
  outDir: string,
): Promise<string> {
  const pagesDir = join(projectDir, "pages");
  const apiDir = join(projectDir, "api");

  // Collect all page files
  const pageFiles = collectTsFiles(pagesDir);
  const apiFiles = existsSync(apiDir) ? collectTsFiles(apiDir) : [];

  // Generate entry point that statically imports everything
  const lines: string[] = [];
  lines.push(`// Auto-generated entry point for file-based routing build`);
  lines.push(`import config from "${configPath}";`);
  lines.push(`import { runFileBasedSite } from "terminaltui";`);
  lines.push(``);
  lines.push(`// Pre-import all page files so they're included in the bundle`);

  for (let i = 0; i < pageFiles.length; i++) {
    lines.push(`import * as _page${i} from "${pageFiles[i]}";`);
  }
  for (let i = 0; i < apiFiles.length; i++) {
    lines.push(`import * as _api${i} from "${apiFiles[i]}";`);
  }

  lines.push(``);
  lines.push(`await runFileBasedSite({`);
  lines.push(`  config,`);
  lines.push(`  pagesDir: "${pagesDir}",`);
  if (existsSync(apiDir)) {
    lines.push(`  apiDir: "${apiDir}",`);
  }
  lines.push(`  outDir: "${join(projectDir, ".terminaltui")}",`);
  lines.push(`});`);

  const entryPath = join(outDir, "_entry.ts");
  writeFileSync(entryPath, lines.join("\n"), "utf-8");
  return entryPath;
}

/**
 * Collect all .ts files recursively from a directory.
 */
function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...collectTsFiles(fullPath));
    } else if (entry.endsWith(".ts") || entry.endsWith(".js")) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Print a summary of what was included in the build.
 */
function printBuildSummary(projectDir: string): void {
  const pagesDir = join(projectDir, "pages");
  const pageFiles = collectTsFiles(pagesDir);

  const allPages: string[] = [];
  const menuPages: string[] = [];
  const hiddenPages: string[] = [];

  for (const file of pageFiles) {
    const name = basename(file, ".ts").replace(/\.js$/, "");
    if (name === "layout") continue;

    allPages.push(name);

    // Quick check if the file has hidden: true
    try {
      const content = readFileSync(file, "utf-8");
      if (content.includes("hidden: true") || content.includes("hidden:true")) {
        hiddenPages.push(name);
      } else {
        menuPages.push(name);
      }
    } catch {
      menuPages.push(name);
    }
  }

  console.log(`\n  Pages included: ${allPages.join(", ")}`);
  if (menuPages.length > 0) {
    console.log(`  Menu pages: ${menuPages.join(", ")}`);
  }
  if (hiddenPages.length > 0) {
    console.log(`  Hidden pages: ${hiddenPages.join(", ")} (included but not in menu)`);
  }
}
