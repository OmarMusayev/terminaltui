import { resolve, dirname, basename, join, relative } from "node:path";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";

export async function buildProject(configPath: string): Promise<void> {
  const absPath = resolve(configPath);
  const projectDir = dirname(absPath);
  const distDir = join(projectDir, "dist");

  mkdirSync(distDir, { recursive: true });

  const outFile = join(distDir, "cli.js");

  const pkgPath = join(projectDir, "package.json");
  let pkgName = "my-tui-site";
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    pkgName = pkg.name || pkgName;
  }

  // terminaltui is file-based only — verify the project shape
  const configName = basename(absPath);
  const pagesDir = join(projectDir, "pages");
  const isFileBased = (configName === "config.ts" || configName === "config.js") && existsSync(pagesDir);

  if (!isFileBased) {
    throw new Error(
      `terminaltui build requires a file-based project (config.ts + pages/). ` +
      `Got: ${configName} in ${projectDir}`
    );
  }

  const entryFile = await createFileBasedEntryPoint(projectDir, absPath, distDir);

  try {
    const { build } = await import("esbuild");
    await build({
      entryPoints: [entryFile],
      outfile: outFile,
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node18",
      banner: { js: "#!/usr/bin/env node" },
      minify: true,
    });

    const { chmodSync } = await import("node:fs");
    chmodSync(outFile, "755");

    cleanupBuildArtifacts(distDir);
    validateBundle(outFile);
    printBuildSummary(projectDir);

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
 * Generate a self-contained entry point that bundles config.ts + every page +
 * every api/ handler into one file. The output instantiates TUIRuntime
 * directly — no public defineSite/page/runSite helpers needed.
 */
async function createFileBasedEntryPoint(
  projectDir: string,
  configPath: string,
  outDir: string,
): Promise<string> {
  const pagesDir = join(projectDir, "pages");
  const apiDir = join(projectDir, "api");
  const pageFiles = collectTsFiles(pagesDir);
  const apiFiles = existsSync(apiDir) ? collectTsFiles(apiDir) : [];

  const lines: string[] = [];
  lines.push(`// Auto-generated build entry point — inlines all pages + API routes`);
  const relConfigPath = relative(outDir, configPath).replace(/\\/g, "/");
  lines.push(`import siteConfig from "${relConfigPath}";`);
  lines.push(`import { TUIRuntime } from "terminaltui";`);
  lines.push(``);

  // Import all page modules (skip layout files)
  const pageImports: { varName: string; routeName: string; isHidden: boolean }[] = [];
  for (let i = 0; i < pageFiles.length; i++) {
    const file = pageFiles[i];
    if (basename(file, ".ts") === "layout" || basename(file, ".js") === "layout") continue;

    const relPath = file.replace(pagesDir + "/", "");
    const nameNoExt = relPath.replace(/\.(ts|js)$/, "");

    const varName = `_p${i}`;
    const relFilePath = relative(outDir, file).replace(/\\/g, "/");
    lines.push(`import ${varName}, { metadata as ${varName}_meta } from "${relFilePath}";`);

    let routeName = nameNoExt;
    if (routeName === "index") routeName = "home";
    else if (routeName.endsWith("/index")) routeName = routeName.replace(/\/index$/, "");
    routeName = routeName.replace(/\\/g, "/");

    const source = readFileSync(file, "utf-8");
    const isHidden = source.includes("hidden: true") || source.includes("hidden:true");

    pageImports.push({ varName, routeName, isHidden });
  }

  // Import all API modules
  const apiImports: { varName: string; endpoint: string }[] = [];
  for (let i = 0; i < apiFiles.length; i++) {
    const file = apiFiles[i];
    const relPath = file.replace(apiDir + "/", "");
    const nameNoExt = relPath.replace(/\.(ts|js)$/, "");
    const varName = `_a${i}`;
    const relApiPath = relative(outDir, file).replace(/\\/g, "/");
    lines.push(`import * as ${varName} from "${relApiPath}";`);

    let endpoint = "/api/" + nameNoExt.replace(/\\/g, "/");
    endpoint = endpoint.replace(/\/index$/, "");
    endpoint = endpoint.replace(/\[(\w+)\]/g, ":$1");

    apiImports.push({ varName, endpoint });
  }

  lines.push(``);

  // Build API routes object
  lines.push(`const apiRoutes = {};`);
  for (const api of apiImports) {
    for (const method of ["GET", "POST", "PUT", "DELETE", "PATCH"]) {
      lines.push(`if (typeof ${api.varName}.${method} === "function") apiRoutes["${method} ${api.endpoint}"] = ${api.varName}.${method};`);
    }
  }

  lines.push(``);

  // Build pages array as plain PageConfig objects (no page() helper)
  lines.push(`const pages = [`);
  for (const p of pageImports) {
    const metaRef = `(${p.varName}_meta || {})`;
    lines.push(`  {`);
    lines.push(`    id: "${p.routeName}",`);
    lines.push(`    title: ${metaRef}.label || ${JSON.stringify(titleCase(p.routeName))},`);
    lines.push(`    icon: ${metaRef}.icon,`);
    lines.push(`    _hidden: ${p.isHidden},`);
    lines.push(`    content: async () => ${p.varName}(),`);
    lines.push(`  },`);
  }
  lines.push(`];`);

  lines.push(``);
  lines.push(`const site = { config: { ...siteConfig, pages, api: apiRoutes } };`);
  lines.push(`await new TUIRuntime(site).start();`);

  const entryPath = join(outDir, "_entry.ts");
  writeFileSync(entryPath, lines.join("\n"), "utf-8");
  return entryPath;
}

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

function printBuildSummary(projectDir: string): void {
  const pagesDir = join(projectDir, "pages");
  const pageFiles = collectTsFiles(pagesDir);

  const menuPages: string[] = [];
  const hiddenPages: string[] = [];

  for (const file of pageFiles) {
    const name = basename(file, ".ts").replace(/\.js$/, "");
    if (name === "layout") continue;

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

  console.log(`\n  Pages included: ${[...menuPages, ...hiddenPages].join(", ")}`);
  if (menuPages.length > 0) console.log(`  Menu pages: ${menuPages.join(", ")}`);
  if (hiddenPages.length > 0) console.log(`  Hidden pages: ${hiddenPages.join(", ")} (included but not in menu)`);
}

function titleCase(str: string): string {
  return str
    .replace(/[-_\/]/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function cleanupBuildArtifacts(distDir: string): void {
  const artifacts = ["_entry.ts", "_single-entry.ts"];
  for (const name of artifacts) {
    const filePath = join(distDir, name);
    try { unlinkSync(filePath); } catch {}
  }
}

/**
 * Validate the output bundle to catch common build problems early.
 */
function validateBundle(outFile: string): void {
  const content = readFileSync(outFile, "utf-8");

  if (!content.includes("TUIRuntime") && !content.includes("runtime")) {
    console.warn(
      `\n  ⚠ WARNING: Bundle may not be functional — no runtime entry detected.` +
      `\n  The built file may define config but never start the TUI.\n`
    );
  }

  const absPathMatch = content.match(/\/Users\/[^\s"'`]+|\/home\/[^\s"'`]+/);
  if (absPathMatch) {
    console.warn(
      `\n  ⚠ WARNING: Bundle contains absolute path: ${absPathMatch[0]}` +
      `\n  This will break on other machines.\n`
    );
  }
}
