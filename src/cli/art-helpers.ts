/**
 * Art create and validate commands.
 * Split from art.ts to keep files under 400 lines.
 */
import { resolve, join } from "node:path";
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";

export function artCreate(args: string[]): void {
  const type = args[0] as "scene" | "icon" | "pattern";
  const name = args[1];

  if (!type || !name) {
    console.error("Usage: terminaltui art create <scene|icon|pattern> <name>");
    process.exit(1);
  }

  if (!["scene", "icon", "pattern"].includes(type)) {
    console.error(`Invalid type: "${type}". Use: scene, icon, or pattern`);
    process.exit(1);
  }

  const artDir = resolve(process.cwd(), "art");
  const typeDir = join(artDir, type + "s");
  const filePath = join(typeDir, `${name}.txt`);

  if (existsSync(filePath)) {
    console.error(`File already exists: ${filePath}`);
    process.exit(1);
  }

  mkdirSync(typeDir, { recursive: true });

  const template = getTemplate(type, name);
  writeFileSync(filePath, template, "utf-8");

  console.log(`\n  Created ${type} template: ${filePath}`);
  console.log(`  Edit the file to add your custom ${type} art.\n`);
}

function getTemplate(type: "scene" | "icon" | "pattern", name: string): string {
  switch (type) {
    case "scene":
      return `# ${name}
# Lines starting with # are comments and will be stripped.
# Add your ASCII art scene below.
#
# Tips:
#   - Use box-drawing characters for clean lines
#   - Keep width under 80 characters for compatibility
#   - Trailing whitespace is automatically trimmed

         .  *  .    *    .   *
    *  .    _____     .     *
   .      /     \\      .
     *   /       \\   *     .
  .     /  ${name}  \\     *
\u2500\u2500\u2500\u2500\u2500\u2500\u2500/\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\\\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
`;

    case "icon":
      return `# ${name}
# Lines starting with # are comments and will be stripped.
# Add your ASCII art icon below.
#
# Tips:
#   - Small icons: 3-4 lines
#   - Medium icons: 5-6 lines
#   - Large icons: 7+ lines
#   - Size is auto-detected

\u250c\u2500\u2500\u2500\u2500\u2500\u2510
\u2502  ${name.charAt(0).toUpperCase()}  \u2502
\u2502     \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2518
`;

    case "pattern":
      return `# tile: 4x2
# ${name}
# Lines starting with # are comments and will be stripped.
# The first comment "# tile: WxH" sets the tile dimensions.
# The pattern below will be tiled to fill any area.

+-+-
-+-+
`;
  }
}

export function artValidate(): void {
  const artDir = resolve(process.cwd(), "art");

  if (!existsSync(artDir)) {
    console.log("\n  No art/ directory found in the current directory.\n");
    console.log("  Run 'terminaltui art create <type> <name>' to create art templates.\n");
    return;
  }

  console.log("\n  Validating art assets in ./art/\n");

  let totalFiles = 0;
  let validFiles = 0;
  let issues = 0;

  const typeDirs: { dir: string; type: string; extensions: string[] }[] = [
    { dir: "fonts", type: "font", extensions: [".flf"] },
    { dir: "scenes", type: "scene", extensions: [".txt", ".ans"] },
    { dir: "icons", type: "icon", extensions: [".txt"] },
    { dir: "patterns", type: "pattern", extensions: [".txt"] },
  ];

  for (const { dir, type, extensions } of typeDirs) {
    const fullDir = join(artDir, dir);
    if (!existsSync(fullDir)) continue;

    let files: string[];
    try {
      files = readdirSync(fullDir).filter(f => {
        if (f.startsWith(".") || f.startsWith("_")) return false;
        try { return statSync(join(fullDir, f)).isFile(); } catch { return false; }
      });
    } catch {
      console.log(`  [!] Cannot read directory: ${dir}/`);
      issues++;
      continue;
    }

    for (const file of files) {
      totalFiles++;
      const ext = file.slice(file.lastIndexOf("."));

      if (!extensions.includes(ext)) {
        console.log(`  [!] ${dir}/${file} - unexpected extension "${ext}" (expected: ${extensions.join(", ")})`);
        issues++;
        continue;
      }

      try {
        const content = readFileSync(join(fullDir, file), "utf-8");
        if (content.trim().length === 0) {
          console.log(`  [!] ${dir}/${file} - file is empty`);
          issues++;
          continue;
        }

        if (type === "font" && !content.startsWith("flf2")) {
          console.log(`  [!] ${dir}/${file} - invalid FLF header`);
          issues++;
          continue;
        }

        if (type === "pattern") {
          const firstLine = content.split("\n")[0];
          if (!firstLine?.match(/^#\s*tile:\s*\d+\s*x\s*\d+/i)) {
            console.log(`  [~] ${dir}/${file} - no tile size metadata`);
          }
        }

        const artLines = content.split("\n").filter(l => !l.startsWith("#"));
        const nonEmptyArt = artLines.filter(l => l.trim().length > 0);
        if (nonEmptyArt.length === 0) {
          console.log(`  [!] ${dir}/${file} - no art content (only comments)`);
          issues++;
          continue;
        }

        console.log(`  [ok] ${dir}/${file}`);
        validFiles++;
      } catch (err: any) {
        console.log(`  [!] ${dir}/${file} - read error: ${err.message}`);
        issues++;
      }
    }
  }

  console.log();
  if (totalFiles === 0) {
    console.log("  No art files found. Run 'terminaltui art create <type> <name>' to get started.\n");
  } else {
    console.log(`  Results: ${validFiles} valid, ${issues} issue${issues !== 1 ? "s" : ""}, ${totalFiles} total files\n`);
  }
}
