import { resolve, dirname, basename, join } from "node:path";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
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

  try {
    // Bundle with esbuild
    const { build } = await import("esbuild");
    await build({
      entryPoints: [absPath],
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

    // Make executable
    const { chmodSync } = await import("node:fs");
    chmodSync(outFile, "755");

    console.log(`\n  Built successfully!`);
    console.log(`  Output: dist/cli.js`);
    console.log(`\n  To publish:`);
    console.log(`    npm publish`);
    console.log(`\n  Users can then run:`);
    console.log(`    npx ${pkgName}\n`);
  } catch (err: any) {
    // Fallback to tsup
    try {
      execSync(
        `npx tsup "${absPath}" --format esm --outDir "${distDir}" --no-dts --minify`,
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
