/**
 * Migration unit tests — tests the terminaltui migrate command logic
 */
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { migrateProject } from "../../src/cli/migrate.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { passed++; } else { failed++; console.error(`  FAIL: ${name}`); }
}
function assertEqual(actual: any, expected: any, name: string) {
  if (actual === expected) { passed++; } else { failed++; console.error(`  FAIL: ${name} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

const tmpDir = join(process.cwd(), ".test-migrate-tmp");

function setup() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
}

function cleanup() {
  rmSync(tmpDir, { recursive: true, force: true });
}

// ─── Basic migration ──────────────────────────────────────

console.log("\x1b[1m  Basic migration\x1b[0m");

setup();
{
  // Create a minimal site.config.ts
  writeFileSync(join(tmpDir, "site.config.ts"), `
import { defineSite, page, card, text, hero } from "terminaltui";

export default defineSite({
  name: "Test Site",
  tagline: "A test site",
  theme: "cyberpunk",
  banner: {
    text: "TEST",
    font: "Ghost",
  },
  animations: {
    boot: true,
    transitions: "fade",
  },
  pages: [
    page("about", {
      title: "About",
      icon: "?",
      content: [
        card({ title: "About Us", body: "We are a test site" }),
      ],
    }),
    page("contact", {
      title: "Contact",
      content: [
        text("Email us"),
      ],
    }),
  ],
});
`);

  try {
    const result = await migrateProject(tmpDir);

    // Check config.ts was generated
    assert(existsSync(result.configFile), "config.ts created");
    const configContent = readFileSync(result.configFile, "utf-8");
    assert(configContent.includes('name: "Test Site"'), "config has name");
    assert(configContent.includes('theme: "cyberpunk"'), "config has theme");
    assert(configContent.includes("defineConfig"), "config uses defineConfig");

    // Check pages were generated
    assertEqual(result.pageFiles.length, 2, "2 page files created");

    const pagesDir = join(tmpDir, "pages");
    assert(existsSync(pagesDir), "pages/ directory created");
    assert(existsSync(join(pagesDir, "about.ts")), "about.ts created");
    assert(existsSync(join(pagesDir, "contact.ts")), "contact.ts created");

    // Check page content
    const aboutContent = readFileSync(join(pagesDir, "about.ts"), "utf-8");
    assert(aboutContent.includes("export default function"), "about has default export");
    assert(aboutContent.includes("metadata"), "about has metadata");
    assert(aboutContent.includes('label: "About"'), "about metadata has label");
    assert(aboutContent.includes('icon: "?"'), "about metadata has icon");
  } catch (e: any) {
    failed++;
    console.error(`  FAIL: migration threw: ${e.message}`);
  }
}

// ─── Migration without site.config.ts ─────────────────────

console.log("\x1b[1m  Error without site.config.ts\x1b[0m");
{
  const emptyDir = join(tmpDir, "empty");
  mkdirSync(emptyDir, { recursive: true });

  try {
    await migrateProject(emptyDir);
    failed++;
    console.error("  FAIL: should throw for missing site.config.ts");
  } catch (e: any) {
    assert(e.message.includes("No site.config.ts"), "throws correct error");
  }
}

cleanup();

// ─── Results ──────────────────────────────────────────────
console.log("");
if (failed > 0) {
  console.log(`  \x1b[31m${passed} passed, ${failed} failed\x1b[0m`);
  process.exit(1);
} else {
  console.log(`  \x1b[32m${passed} passed\x1b[0m, 0 failed`);
}
