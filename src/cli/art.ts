/**
 * CLI subcommand: terminaltui art
 *
 * Manages art assets — list, preview, create templates, and validate.
 */

import { loadArtDirectory } from "../art-registry/loader.js";
import { registerArtPack, listArt } from "../art-registry/index.js";
import type { AssetType } from "../art-registry/types.js";
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

// ── Built-in asset names (for counting) ─────────────────────────────────────

import { fonts } from "../ascii/fonts.js";
import { icons, getIcon } from "../ascii/art.js";
import { renderBanner } from "../ascii/banner.js";
import { scene } from "../ascii/scenes.js";
import { pattern } from "../ascii/patterns.js";

const BUILT_IN_SCENE_NAMES = [
  "mountains", "cityscape", "forest", "ocean", "space", "clouds",
  "coffee-cup", "rocket", "cat", "robot", "terminal",
  "vinyl-record", "cassette", "floppy-disk", "gameboy",
];

const BUILT_IN_PATTERN_NAMES = [
  "dots", "crosshatch", "diagonal", "waves", "bricks", "circuit",
  "rain", "stars", "confetti", "static", "braille-dots", "grid",
];

// ── Auto-discover art directory ─────────────────────────────────────────────

function autoDiscoverArt(): void {
  const artDir = resolve(process.cwd(), "art");
  if (existsSync(artDir)) {
    try {
      const pack = loadArtDirectory(artDir);
      registerArtPack(pack);
    } catch {
      // silently skip if art dir has issues
    }
  }
}

// ── Entry point ─────────────────────────────────────────────────────────────

export async function runArt(args: string[]): Promise<void> {
  const subcommand = args[0]; // "list" | "preview" | "create" | "validate"

  // Before anything, auto-discover art from ./art/ directory
  autoDiscoverArt();

  switch (subcommand) {
    case "list":
      return artList();
    case "preview":
      return artPreview(args.slice(1));
    case "create":
      return artCreate(args.slice(1));
    case "validate":
      return artValidate();
    default:
      console.log(`
  terminaltui art - Manage art assets

  Usage:
    terminaltui art <command> [options]

  Commands:
    list                              List all available art assets
    preview scene:<name>              Preview a scene
    preview font:"<name>" [TEXT]      Preview a font (default text: ABCDEF)
    preview icon:<name>               Preview an icon
    preview pattern:<name> [WxH]      Preview a pattern (default: 40x10)
    create scene <name>               Create a scene template file
    create icon <name>                Create an icon template file
    create pattern <name>             Create a pattern template file
    validate                          Validate art assets in ./art/

  Examples:
    terminaltui art list
    terminaltui art preview scene:cityscape
    terminaltui art preview font:"ANSI Shadow" HELLO
    terminaltui art preview icon:rocket
    terminaltui art preview pattern:circuit 40x10
    terminaltui art create scene my-scene
    terminaltui art create icon my-icon
    terminaltui art create pattern my-pattern
    terminaltui art validate
`);
  }
}

// ── artList ─────────────────────────────────────────────────────────────────

function artList(): void {
  const registered = listArt();

  // Built-in font names
  const builtInFontNames = Object.keys(fonts);
  const builtInIconNames = Object.keys(icons);

  // Merge built-in + registered (deduplicate)
  const allFonts = new Set([...builtInFontNames.map(n => n.toLowerCase().replace(/[\s_]+/g, "-")), ...registered.fonts]);
  const allScenes = new Set([...BUILT_IN_SCENE_NAMES, ...registered.scenes]);
  const allIcons = new Set([...builtInIconNames, ...registered.icons]);
  const allPatterns = new Set([...BUILT_IN_PATTERN_NAMES, ...registered.patterns]);

  // Count custom assets (registered but not built-in)
  const customFonts = registered.fonts.filter(n => !builtInFontNames.some(b => b.toLowerCase().replace(/[\s_]+/g, "-") === n));
  const customScenes = registered.scenes.filter(n => !BUILT_IN_SCENE_NAMES.includes(n));
  const customIcons = registered.icons.filter(n => !builtInIconNames.includes(n));
  const customPatterns = registered.patterns.filter(n => !BUILT_IN_PATTERN_NAMES.includes(n));

  console.log("\n  Art Assets\n");

  // Fonts
  console.log(`  Fonts (${builtInFontNames.length} built-in${customFonts.length ? `, ${customFonts.length} custom` : ""}):`);
  for (const name of Array.from(allFonts).sort()) {
    const isCustom = customFonts.includes(name);
    console.log(`    ${isCustom ? "*" : " "} ${name}`);
  }

  // Scenes
  console.log(`\n  Scenes (${BUILT_IN_SCENE_NAMES.length} built-in${customScenes.length ? `, ${customScenes.length} custom` : ""}):`);
  for (const name of Array.from(allScenes).sort()) {
    const isCustom = customScenes.includes(name);
    console.log(`    ${isCustom ? "*" : " "} ${name}`);
  }

  // Icons
  console.log(`\n  Icons (${builtInIconNames.length} built-in${customIcons.length ? `, ${customIcons.length} custom` : ""}):`);
  for (const name of Array.from(allIcons).sort()) {
    const isCustom = customIcons.includes(name);
    console.log(`    ${isCustom ? "*" : " "} ${name}`);
  }

  // Patterns
  console.log(`\n  Patterns (${BUILT_IN_PATTERN_NAMES.length} built-in${customPatterns.length ? `, ${customPatterns.length} custom` : ""}):`);
  for (const name of Array.from(allPatterns).sort()) {
    const isCustom = customPatterns.includes(name);
    console.log(`    ${isCustom ? "*" : " "} ${name}`);
  }

  console.log(`\n  Total: ${allFonts.size + allScenes.size + allIcons.size + allPatterns.size} assets`);
  if (customFonts.length + customScenes.length + customIcons.length + customPatterns.length > 0) {
    console.log("  (* = custom asset from ./art/ directory)");
  }
  console.log();
}

// ── artPreview ──────────────────────────────────────────────────────────────

function artPreview(args: string[]): void {
  if (!args[0]) {
    console.error("Usage: terminaltui art preview <type:name> [options]");
    console.error("  Examples:");
    console.error('    terminaltui art preview font:"ANSI Shadow" HELLO');
    console.error("    terminaltui art preview scene:cityscape");
    console.error("    terminaltui art preview icon:rocket");
    console.error("    terminaltui art preview pattern:circuit 40x10");
    process.exit(1);
  }

  // Parse type:name — handle quoted names like font:"ANSI Shadow"
  const spec = args[0];
  const colonIdx = spec.indexOf(":");
  if (colonIdx === -1) {
    console.error(`Invalid format: "${spec}". Use type:name (e.g. scene:cityscape)`);
    process.exit(1);
  }

  const type = spec.slice(0, colonIdx) as AssetType;
  let name = spec.slice(colonIdx + 1);

  // Strip surrounding quotes if present
  if ((name.startsWith('"') && name.endsWith('"')) || (name.startsWith("'") && name.endsWith("'"))) {
    name = name.slice(1, -1);
  }

  switch (type) {
    case "font":
      previewFont(name, args[1]);
      break;
    case "scene":
      previewScene(name);
      break;
    case "icon":
      previewIcon(name);
      break;
    case "pattern":
      previewPattern(name, args[1]);
      break;
    default:
      console.error(`Unknown asset type: "${type}". Use: font, scene, icon, or pattern`);
      process.exit(1);
  }
}

function previewFont(name: string, text?: string): void {
  const displayText = text ?? "ABCDEF";

  const lines = renderBanner(displayText, { font: name });
  console.log();
  console.log(`  Font: ${name}`);
  console.log(`  Text: ${displayText}`);
  console.log();
  for (const line of lines) {
    console.log(`  ${line}`);
  }
  console.log();
}

function previewScene(name: string): void {
  const lines = scene(name, { width: 60 });
  if (lines.length === 0) {
    console.error(`Scene not found: "${name}"`);
    process.exit(1);
  }

  console.log();
  console.log(`  Scene: ${name}`);
  console.log();
  for (const line of lines) {
    console.log(`  ${line}`);
  }
  console.log();
}

function previewIcon(name: string): void {
  const lines = getIcon(name);
  if (!lines) {
    console.error(`Icon not found: "${name}"`);
    process.exit(1);
  }

  console.log();
  console.log(`  Icon: ${name}`);
  console.log();
  for (const line of lines) {
    console.log(`  ${line}`);
  }
  console.log();
}

function previewPattern(name: string, sizeArg?: string): void {
  let width = 40;
  let height = 10;
  if (sizeArg) {
    const match = sizeArg.match(/^(\d+)x(\d+)$/);
    if (match) {
      width = parseInt(match[1], 10);
      height = parseInt(match[2], 10);
    }
  }

  const lines = pattern(width, height, name);
  if (lines.length === 0) {
    console.error(`Pattern not found or empty: "${name}"`);
    process.exit(1);
  }

  console.log();
  console.log(`  Pattern: ${name} (${width}x${height})`);
  console.log();
  for (const line of lines) {
    console.log(`  ${line}`);
  }
  console.log();
}

// ── artCreate ───────────────────────────────────────────────────────────────

function artCreate(args: string[]): void {
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

  // Create directories
  mkdirSync(typeDir, { recursive: true });

  // Write template
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
───────/───────────\\──────────
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

┌─────┐
│  ${name.charAt(0).toUpperCase()}  │
│     │
└─────┘
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

// ── artValidate ─────────────────────────────────────────────────────────────

function artValidate(): void {
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
        const fullPath = join(fullDir, f);
        try {
          return statSync(fullPath).isFile();
        } catch {
          return false;
        }
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

        // Type-specific validation
        if (type === "font") {
          if (!content.startsWith("flf2")) {
            console.log(`  [!] ${dir}/${file} - invalid FLF header (must start with "flf2")`);
            issues++;
            continue;
          }
        }

        if (type === "pattern") {
          // Check for tile metadata
          const firstLine = content.split("\n")[0];
          if (!firstLine?.match(/^#\s*tile:\s*\d+\s*x\s*\d+/i)) {
            console.log(`  [~] ${dir}/${file} - no tile size metadata (# tile: WxH), dimensions will be auto-detected`);
          }
        }

        // Strip comment lines and check remaining content
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
