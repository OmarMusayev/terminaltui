/**
 * Prompt builder for `terminaltui create`.
 *
 * Extracted from create.ts — builds the AI prompt from questionnaire answers.
 */

export interface Answers {
  name: string;
  slugName: string;
  description: string;
  pages: string[];
  content: string | null;
  theme: string;
  style: string;
  art: string;
  interactive: string;
  customFormFields?: string;
  animations: "full" | "subtle" | "none";
  extra: string | null;
}

export function mapStyle(style: string, description: string): string {
  if (style.toLowerCase() === "auto") {
    return `Choose a visual style that matches: ${description}`;
  }

  const parts = style
    .split(",")
    .map((s) => s.trim().toLowerCase());

  const mappings: Record<string, string> = {
    bold: "Use double-line borders, large ASCII banner with shadow and gradient, dramatic slide or wipe transitions",
    minimal:
      "Use single-line or no borders, small compact banner font like Calvin S or Small Slant, instant transitions, generous whitespace",
    retro: "Use ASCII art heavily, DOS Rebel or Electronic font, dashed or ascii borders, circuit or static patterns, hacker or monokai theme works well",
    playful:
      "Use rainbow gradients on the banner, rounded borders, icons everywhere, stagger animations, confetti or stars patterns",
    professional:
      "Use single-line borders, ANSI Shadow or Slant font, fade transitions, clean structured layout",
  };

  const descriptions = parts
    .map((p) => mappings[p] || p)
    .join(". ");

  return descriptions;
}

export function buildPrompt(answers: Answers): string {
  const lines: string[] = [];

  lines.push(`# Build: ${answers.name}`);
  lines.push("");

  // API reference
  lines.push("## API Reference");
  lines.push("Read TERMINALTUI_SKILL.md in this directory for the complete framework API.");
  lines.push("");

  // What to build
  lines.push("## What to Build");
  lines.push(answers.description);
  lines.push("");

  // Pages
  lines.push("## Pages");
  lines.push("Create these pages:");
  for (const page of answers.pages) {
    lines.push(`- ${page}`);
  }
  lines.push("");

  // Content
  lines.push("## Content");
  if (answers.content) {
    lines.push("Use this content verbatim:");
    lines.push("```");
    lines.push(answers.content);
    lines.push("```");
    lines.push("For pages not covered above, generate realistic content matching this tone.");
  } else {
    lines.push(
      "Generate all content from scratch. Make it realistic and detailed — not placeholder text."
    );
  }
  lines.push("");

  // Theme
  lines.push("## Theme");
  if (answers.theme === "auto") {
    lines.push(`Choose the best theme for: ${answers.description}`);
  } else {
    lines.push(answers.theme);
  }
  lines.push("");

  // Visual style
  lines.push("## Visual Style");
  lines.push(mapStyle(answers.style, answers.description));
  lines.push("");

  // ASCII art
  lines.push("## ASCII Art");
  if (answers.art.toLowerCase() === "none") {
    lines.push("No ASCII art — keep it clean.");
  } else if (answers.art.toLowerCase() === "auto") {
    lines.push(`Add ASCII art that fits: ${answers.description}`);
  } else {
    lines.push(answers.art);
  }
  lines.push("");

  // Interactive features
  lines.push("## Interactive Features");
  if (answers.interactive.toLowerCase() === "none") {
    lines.push("No interactive features needed.");
  } else if (answers.interactive.toLowerCase() === "auto") {
    lines.push("Add interactive features that make sense for this project.");
  } else {
    lines.push(answers.interactive);
    if (answers.customFormFields) {
      lines.push("");
      lines.push("Custom form details:");
      lines.push(answers.customFormFields);
    }
  }
  lines.push("");

  // Animations
  lines.push("## Animations");
  switch (answers.animations) {
    case "full":
      lines.push(
        "Full animations — boot sequence with dramatic reveal, page transitions (slide/wipe/fade), typing effects where appropriate, and a styled exit message."
      );
      break;
    case "subtle":
      lines.push(
        "Subtle animations — gentle fade transitions between pages. No boot sequence or exit message."
      );
      break;
    case "none":
      lines.push("No animations — instant page transitions, no boot sequence, no exit message.");
      break;
  }
  lines.push("");

  // Extra instructions
  if (answers.extra) {
    lines.push("## Additional Instructions");
    lines.push(answers.extra);
    lines.push("");
  }

  // Output
  lines.push("## Output");
  lines.push(
    `- Generate \`site.config.ts\` using the terminaltui API`
  );
  lines.push(
    `- Create \`package.json\`: name "${answers.slugName}", scripts dev/build, dependency terminaltui`
  );
  lines.push(
    `- Create \`README.md\` with project name and \`npx ${answers.slugName}\` command`
  );
  lines.push("- Run `terminaltui dev` and verify it works");
  lines.push(
    "- Test with the TUI emulator — navigate every page, verify content, check noOverflow"
  );
  lines.push("- Fix any issues");
  lines.push("- Show me a summary of what was built");
  lines.push("");

  return lines.join("\n");
}
