/**
 * Reads art-templates.txt and updates the shape/scene source files.
 * Run: npx tsx import-art.ts
 *
 * How it works:
 *   1. Parses every === [TAG] === / START / END block from art-templates.txt
 *   2. Maps each tag to the right function in the right source file
 *   3. Replaces the art arrays in-place, preserving all other code
 *   4. Shows you a preview of each piece before writing
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const TEMPLATE_FILE = resolve(import.meta.dirname ?? ".", "art-templates.txt");
const SHAPES_FILE = resolve(import.meta.dirname ?? ".", "src/ascii/shapes.ts");
const SCENES_FILE = resolve(import.meta.dirname ?? ".", "src/ascii/scenes.ts");

// ─── Parse the template file ─────────────────────────────

interface ArtBlock {
  tag: string;
  lines: string[];
}

function parseTemplates(text: string): ArtBlock[] {
  const blocks: ArtBlock[] = [];
  const regex = /===\s*\[(\w+)\]\s*===/g;
  let match: RegExpExecArray | null;
  const markers: { tag: string; index: number }[] = [];

  while ((match = regex.exec(text)) !== null) {
    markers.push({ tag: match[1], index: match.index });
  }

  for (let i = 0; i < markers.length; i++) {
    const { tag } = markers[i];
    const start = text.indexOf("START", markers[i].index);
    const end = text.indexOf("END", start);
    if (start < 0 || end < 0) continue;

    const body = text.slice(start + "START".length, end);
    const lines = body.split("\n");

    // Remove first line if empty (the newline after START)
    if (lines.length > 0 && lines[0].trim() === "") lines.shift();
    // Remove last line if empty (the newline before END)
    if (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();

    // Skip placeholder entries
    if (lines.length === 0 || (lines.length === 1 && lines[0].includes("paste your art here"))) {
      continue;
    }

    blocks.push({ tag, lines });
  }

  return blocks;
}

// ─── Map tags to code locations ───────────────────────────

// Tags that map to heart() templates in shapes.ts
const HEART_MAP: Record<string, string> = {
  HEART_SMALL: "3",
  HEART_MEDIUM: "5",
  HEART_LARGE: "7",
  HEART_XL: "10",
};

// Tags that map to star() templates in shapes.ts
const STAR_MAP: Record<string, string> = {
  STAR_SMALL: "5-3",
  STAR_MEDIUM: "5-5",
  STAR_LARGE: "5-8",
};

// Tags that map to circle() templates in shapes.ts
const CIRCLE_MAP: Record<string, string> = {
  CIRCLE_SMALL: "3",
  CIRCLE_MEDIUM: "5",
  CIRCLE_LARGE: "7",
};

// Tags that map to scene functions in scenes.ts
const SCENE_MAP: Record<string, string> = {
  ROCKET: "sceneRocket",
  COFFEE_CUP: "sceneCoffeeCup",
  CAT: "sceneCat",
  ROBOT: "sceneRobot",
  MOUNTAINS: "sceneMountains",
  VINYL_RECORD: "sceneVinylRecord",
  CASSETTE: "sceneCassette",
  FLOPPY_DISK: "sceneFloppyDisk",
  GAMEBOY: "sceneGameboy",
};

// ─── Update a template-based function (heart, star, circle) ──

function updateTemplate(
  source: string,
  templateKey: string,
  newLines: string[],
  functionName: string,
): string {
  // Find the template key in the source, e.g.: 3: [\n  "line1",\n  ...]
  // We need to find `KEY: [` and replace everything until the matching `],`
  const keyPattern = new RegExp(
    `(${templateKey.replace(/[-]/g, "\\$&")}:\\s*\\[)([\\s\\S]*?)(\\],?)`,
    "m",
  );

  // Try to match inside the function
  const funcStart = source.indexOf(`function ${functionName}`);
  if (funcStart < 0) {
    // Try matching the key globally (for templates stored as const objects)
    const match = source.match(new RegExp(`"${templateKey}":\\s*\\[([\\s\\S]*?)\\]`, "m"));
    if (!match) return source;

    const arrayContent = newLines.map(l => `      "${l.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",\n");
    return source.replace(
      `"${templateKey}": [${match[1]}]`,
      `"${templateKey}": [\n${arrayContent},\n    ]`,
    );
  }

  // Find the key within the function scope (try quoted "key" and unquoted key:)
  let searchFrom = source.indexOf(`"${templateKey}"`, funcStart);
  if (searchFrom < 0) searchFrom = source.indexOf(`${templateKey}:`, funcStart);
  if (searchFrom < 0) return source;

  // Find the opening [ after the key
  const bracketOpen = source.indexOf("[", searchFrom);
  if (bracketOpen < 0) return source;

  // Find the matching ]
  let depth = 1;
  let bracketClose = bracketOpen + 1;
  while (bracketClose < source.length && depth > 0) {
    if (source[bracketClose] === "[") depth++;
    if (source[bracketClose] === "]") depth--;
    bracketClose++;
  }
  bracketClose--; // point at the ]

  const arrayContent = newLines.map(l => `      "${l.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",\n");
  return source.slice(0, bracketOpen) + "[\n" + arrayContent + ",\n    ]" + source.slice(bracketClose + 1);
}

// ─── Update a scene function's art array ──────────────────

function updateSceneArt(source: string, funcName: string, newLines: string[]): string {
  const funcIdx = source.indexOf(`function ${funcName}(`);
  if (funcIdx < 0) {
    console.log(`  [skip] function ${funcName} not found`);
    return source;
  }

  // Find the NEXT function boundary so we don't match art arrays in other functions
  const nextFuncIdx = source.indexOf("\nfunction ", funcIdx + 1);
  const searchEnd = nextFuncIdx > 0 ? nextFuncIdx : source.length;
  const funcBody = source.slice(funcIdx, searchEnd);

  // Find `const art = [` within THIS function only
  const artOffset = funcBody.indexOf("const art = [");
  if (artOffset < 0) {
    console.log(`  [skip] no 'const art = [' in ${funcName}`);
    return source;
  }

  const absArtIdx = funcIdx + artOffset;
  const bracketOpen = source.indexOf("[", absArtIdx);
  if (bracketOpen < 0 || bracketOpen >= searchEnd) return source;

  // Find the matching ] — only count brackets, skip string contents
  let depth = 1;
  let bracketClose = bracketOpen + 1;
  let inString = false;
  let escapeNext = false;
  while (bracketClose < source.length && depth > 0) {
    const ch = source[bracketClose];
    if (escapeNext) { escapeNext = false; bracketClose++; continue; }
    if (ch === "\\") { escapeNext = true; bracketClose++; continue; }
    if (ch === '"' && !inString) { inString = true; bracketClose++; continue; }
    if (ch === '"' && inString) { inString = false; bracketClose++; continue; }
    if (!inString) {
      if (ch === "[") depth++;
      if (ch === "]") depth--;
    }
    bracketClose++;
  }
  bracketClose--; // point at the ]

  const arrayContent = newLines.map(l => `    "${l.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",\n");
  return source.slice(0, bracketOpen) + "[\n" + arrayContent + ",\n  ]" + source.slice(bracketClose + 1);
}

// ─── Main ─────────────────────────────────────────────────

const templateText = readFileSync(TEMPLATE_FILE, "utf-8");
const blocks = parseTemplates(templateText);

console.log(`\nParsed ${blocks.length} art blocks from art-templates.txt\n`);

let shapesSource = readFileSync(SHAPES_FILE, "utf-8");
let scenesSource = readFileSync(SCENES_FILE, "utf-8");
let shapesChanged = false;
let scenesChanged = false;

for (const block of blocks) {
  console.log(`[${block.tag}] ${block.lines.length} lines`);

  // Preview first 3 lines
  for (let i = 0; i < Math.min(3, block.lines.length); i++) {
    console.log(`  ${block.lines[i]}`);
  }
  if (block.lines.length > 3) console.log(`  ... (${block.lines.length - 3} more)`);

  // Hearts
  if (HEART_MAP[block.tag]) {
    shapesSource = updateTemplate(shapesSource, HEART_MAP[block.tag], block.lines, "heart");
    shapesChanged = true;
    console.log(`  -> updated heart template "${HEART_MAP[block.tag]}"\n`);
    continue;
  }

  // Stars
  if (STAR_MAP[block.tag]) {
    shapesSource = updateTemplate(shapesSource, STAR_MAP[block.tag], block.lines, "star");
    shapesChanged = true;
    console.log(`  -> updated star template "${STAR_MAP[block.tag]}"\n`);
    continue;
  }

  // Circles
  if (CIRCLE_MAP[block.tag]) {
    shapesSource = updateTemplate(shapesSource, CIRCLE_MAP[block.tag], block.lines, "circle");
    shapesChanged = true;
    console.log(`  -> updated circle template "${CIRCLE_MAP[block.tag]}"\n`);
    continue;
  }

  // Scenes
  if (SCENE_MAP[block.tag]) {
    scenesSource = updateSceneArt(scenesSource, SCENE_MAP[block.tag], block.lines);
    scenesChanged = true;
    console.log(`  -> updated scene "${SCENE_MAP[block.tag]}"\n`);
    continue;
  }

  // Custom art — just report it
  console.log(`  -> custom tag, not mapped to any function (add mapping in import-art.ts)\n`);
}

if (shapesChanged) {
  writeFileSync(SHAPES_FILE, shapesSource);
  console.log(`Wrote ${SHAPES_FILE}`);
}
if (scenesChanged) {
  writeFileSync(SCENES_FILE, scenesSource);
  console.log(`Wrote ${SCENES_FILE}`);
}

if (!shapesChanged && !scenesChanged) {
  console.log("No changes to write.");
} else {
  console.log("\nDone! Run 'npx tsx demo-showcase.ts' to see the results.");
}
console.log();
