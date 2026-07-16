/**
 * Unit tests for the `terminaltui create` prompt builder (src/cli/create-prompt.ts).
 *
 * mapStyle() and buildPrompt() are pure functions that turn questionnaire
 * answers into the AI build prompt. This pins the mapping table, the
 * auto/none/custom branches, and the verbatim-content fencing.
 */
import { mapStyle, buildPrompt, type Answers } from "../src/cli/create-prompt.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { passed++; } else { failed++; console.error(`  FAIL: ${name}`); }
}
function assertIncludes(haystack: string, needle: string, name: string) {
  if (haystack.includes(needle)) { passed++; } else { failed++; console.error(`  FAIL: ${name} — output does not contain ${JSON.stringify(needle)}`); }
}

// ─── mapStyle ─────────────────────────────────────────────

console.log("\x1b[1m  mapStyle\x1b[0m");
{
  const desc = "a cozy coffee shop";
  assert(
    mapStyle("auto", desc) === `Choose a visual style that matches: ${desc}`,
    "auto defers to the description",
  );
  assert(
    mapStyle("AUTO", desc) === `Choose a visual style that matches: ${desc}`,
    "auto is case-insensitive",
  );
  assertIncludes(mapStyle("bold", desc), "double-line borders", "bold maps to its expanded description");
  assertIncludes(mapStyle("professional", desc), "single-line borders", "professional maps to its expanded description");
  assert(mapStyle("Professional", desc) === mapStyle("professional", desc), "style keys are lowercased before lookup");
}
{
  const out = mapStyle("minimal, retro", "d");
  assertIncludes(out, "Calvin S", "comma list: first style mapped");
  assertIncludes(out, "DOS Rebel", "comma list: second style mapped");
  assert(out.indexOf("Calvin S") < out.indexOf("DOS Rebel"), "comma list preserves order");
  assertIncludes(out, ". ", "comma list joined with '. '");
}
{
  assert(mapStyle("vaporwave", "d") === "vaporwave", "unknown style passes through verbatim (lowercased)");
  const mixed = mapStyle("bold, neon glow", "d");
  assertIncludes(mixed, "double-line borders", "mixed list: known style mapped");
  assertIncludes(mixed, "neon glow", "mixed list: unknown style kept as-is");
}

// ─── buildPrompt ──────────────────────────────────────────

function baseAnswers(overrides: Partial<Answers> = {}): Answers {
  return {
    name: "Test Site",
    slugName: "test-site",
    description: "a portfolio for a designer",
    pages: ["home", "about", "contact"],
    content: null,
    theme: "dracula",
    style: "minimal",
    art: "auto",
    interactive: "none",
    animations: "subtle",
    extra: null,
    ...overrides,
  };
}

console.log("\x1b[1m  buildPrompt — structure\x1b[0m");
{
  const out = buildPrompt(baseAnswers());
  assert(out.startsWith("# Build: Test Site"), "prompt opens with the site name heading");
  assertIncludes(out, "Read TERMINALTUI_SKILL.md", "points at the API reference");
  assertIncludes(out, "## What to Build", "has a What to Build section");
  assertIncludes(out, "a portfolio for a designer", "description is included");
  assertIncludes(out, "- home", "lists page: home");
  assertIncludes(out, "- about", "lists page: about");
  assertIncludes(out, "- contact", "lists page: contact");
}

console.log("\x1b[1m  buildPrompt — content branch\x1b[0m");
{
  const generated = buildPrompt(baseAnswers({ content: null }));
  assertIncludes(generated, "Generate all content from scratch", "null content asks for generated content");
  assert(!generated.includes("verbatim"), "null content has no verbatim block");

  const verbatim = buildPrompt(baseAnswers({ content: "Espresso — $3\nLatte — $4" }));
  assertIncludes(verbatim, "Use this content verbatim:", "provided content is marked verbatim");
  assertIncludes(verbatim, "```\nEspresso — $3\nLatte — $4\n```", "provided content is fenced exactly");
}

console.log("\x1b[1m  buildPrompt — theme branch\x1b[0m");
{
  const auto = buildPrompt(baseAnswers({ theme: "auto" }));
  assertIncludes(auto, "Choose the best theme for: a portfolio for a designer", "auto theme defers to description");
  const explicit = buildPrompt(baseAnswers({ theme: "nord" }));
  assertIncludes(explicit, "## Theme\nnord", "explicit theme is emitted verbatim");
}

console.log("\x1b[1m  buildPrompt — art branch\x1b[0m");
{
  assertIncludes(buildPrompt(baseAnswers({ art: "none" })), "No ASCII art — keep it clean.", "art none");
  assertIncludes(buildPrompt(baseAnswers({ art: "NONE" })), "No ASCII art — keep it clean.", "art none is case-insensitive");
  assertIncludes(buildPrompt(baseAnswers({ art: "auto" })), "Add ASCII art that fits:", "art auto");
  assertIncludes(buildPrompt(baseAnswers({ art: "coffee cups everywhere" })), "coffee cups everywhere", "custom art passes through");
}

console.log("\x1b[1m  buildPrompt — interactive branch\x1b[0m");
{
  assertIncludes(buildPrompt(baseAnswers({ interactive: "none" })), "No interactive features needed.", "interactive none");
  assertIncludes(buildPrompt(baseAnswers({ interactive: "auto" })), "Add interactive features that make sense", "interactive auto");

  const custom = buildPrompt(baseAnswers({ interactive: "contact form", customFormFields: "name, email, message" }));
  assertIncludes(custom, "contact form", "custom interactive passes through");
  assertIncludes(custom, "Custom form details:", "custom form fields get a subsection");
  assertIncludes(custom, "name, email, message", "custom form fields are included");

  const noFields = buildPrompt(baseAnswers({ interactive: "contact form" }));
  assert(!noFields.includes("Custom form details:"), "no form-details subsection without customFormFields");

  const noneWithFields = buildPrompt(baseAnswers({ interactive: "none", customFormFields: "name" }));
  assert(!noneWithFields.includes("Custom form details:"), "interactive none ignores customFormFields");
}

console.log("\x1b[1m  buildPrompt — animations branch\x1b[0m");
{
  assertIncludes(buildPrompt(baseAnswers({ animations: "full" })), "boot sequence with dramatic reveal", "animations full");
  assertIncludes(buildPrompt(baseAnswers({ animations: "subtle" })), "exit message only. No boot sequence.", "animations subtle");
  assertIncludes(buildPrompt(baseAnswers({ animations: "none" })), "render immediately", "animations none");
}

console.log("\x1b[1m  buildPrompt — extra + output\x1b[0m");
{
  const withExtra = buildPrompt(baseAnswers({ extra: "make the footer say hi" }));
  assertIncludes(withExtra, "## Additional Instructions", "extra gets its own section");
  assertIncludes(withExtra, "make the footer say hi", "extra text included");
  assert(!buildPrompt(baseAnswers({ extra: null })).includes("## Additional Instructions"), "no extra section when extra is null");

  const out = buildPrompt(baseAnswers());
  assertIncludes(out, `name "test-site"`, "package.json instructions use the slug");
  assertIncludes(out, "npx test-site", "README instructions use the slug");
  assertIncludes(out, "site.config.ts", "asks for site.config.ts output");
}

// ─── Results ──────────────────────────────────────────────
console.log("");
if (failed > 0) {
  console.log(`  \x1b[31m${passed} passed, ${failed} failed\x1b[0m`);
  process.exit(1);
} else {
  console.log(`  \x1b[32m${passed} passed\x1b[0m, 0 failed`);
}
