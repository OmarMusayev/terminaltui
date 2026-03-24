import { createInterface } from "node:readline";
import { join, resolve, dirname } from "node:path";
import { existsSync, mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildPrompt, mapStyle, type Answers } from "./create-prompt.js";

// Re-export everything from the split file
export { buildPrompt, mapStyle, type Answers } from "./create-prompt.js";

const THEMES = [
  { name: "cyberpunk", desc: "neon pinks, cyans, deep purple" },
  { name: "dracula", desc: "classic dark, purple accents" },
  { name: "nord", desc: "cool arctic blues" },
  { name: "monokai", desc: "warm syntax colors" },
  { name: "solarized", desc: "ethan schoonover's classic" },
  { name: "gruvbox", desc: "earthy retro tones" },
  { name: "catppuccin", desc: "soft pastels" },
  { name: "tokyoNight", desc: "deep blues and purples" },
  { name: "rosePine", desc: "muted rose and pine" },
  { name: "hacker", desc: "green on black" },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function findPackageRoot(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));

  // From dist/cli/ → root (normal install) or dist/ → root (chunk hoisted by bundler)
  for (const ups of [
    resolve(thisDir, "..", ".."),     // dist/cli/index.js → root
    resolve(thisDir, ".."),           // dist/create-XXXX.js → root
  ]) {
    if (existsSync(join(ups, "claude", "SKILL.md"))) return ups;
  }

  // Try node_modules resolution
  const candidate2 = resolve("node_modules", "terminaltui");
  if (existsSync(join(candidate2, "claude", "SKILL.md"))) return candidate2;

  return process.cwd();
}

function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function askMultiline(rl: ReturnType<typeof createInterface>, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    console.log(prompt);
    const lines: string[] = [];
    let lastWasEmpty = false;

    const onLine = (line: string) => {
      if (line === "" && (lastWasEmpty || lines.length === 0)) {
        rl.removeListener("line", onLine);
        resolve(lines.join("\n").trim());
        return;
      }
      lastWasEmpty = line === "";
      if (!lastWasEmpty) {
        lines.push(line);
      } else {
        lines.push(""); // preserve blank lines within content
      }
    };

    rl.on("line", onLine);
  });
}

async function runQuestionnaire(): Promise<Answers> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("");
  console.log("\x1b[1m\x1b[35m  terminaltui create\x1b[0m");
  console.log("\x1b[2m  Build something new — answer a few questions, get a tailored AI prompt.\x1b[0m");
  console.log("");

  // 1. Project name
  const name = await ask(rl, "  What should the project be called? (this becomes the npx command)\n  \x1b[2m>\x1b[0m ");
  const slugName = slugify(name);
  console.log(`  \x1b[2m  → ${slugName}\x1b[0m`);
  console.log("");

  // 2. Description
  const description = await askMultiline(
    rl,
    "  Describe what you're building. Be as detailed as you want — the more you write,\n  the better the result.\n  \x1b[2m(Press Enter twice to finish)\x1b[0m"
  );
  console.log("");

  // 3. Pages
  const pagesRaw = await askMultiline(
    rl,
    "  What pages should it have? \x1b[2m(one per line, Enter twice to finish)\x1b[0m"
  );
  const pages = pagesRaw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  console.log("");

  // 4. Content
  const contentRaw = await askMultiline(
    rl,
    '  Got any content to include? Paste menu items, bios, descriptions, prices,\n  quotes — anything you have.\n  \x1b[2m(Enter twice to finish, or type "skip" to let AI generate everything)\x1b[0m'
  );
  const content = contentRaw.toLowerCase() === "skip" ? null : contentRaw || null;
  console.log("");

  // 5. Theme
  console.log("  Pick a theme \x1b[2m(or type \"auto\")\x1b[0m:");
  for (let i = 0; i < THEMES.length; i++) {
    const t = THEMES[i];
    console.log(`    \x1b[36m${String(i + 1).padStart(2)}.\x1b[0m ${t.name.padEnd(14)} \x1b[2m— ${t.desc}\x1b[0m`);
  }
  const themeInput = await ask(rl, "  \x1b[2m>\x1b[0m ");
  let theme: string;
  if (themeInput.toLowerCase() === "auto") {
    theme = "auto";
  } else {
    const num = parseInt(themeInput);
    if (num >= 1 && num <= THEMES.length) {
      theme = THEMES[num - 1].name;
    } else {
      const match = THEMES.find((t) => t.name.toLowerCase() === themeInput.toLowerCase());
      theme = match ? match.name : themeInput;
    }
  }
  console.log("");

  // 6. Visual style
  console.log('  What visual style? \x1b[2m(comma-separated, or "auto")\x1b[0m');
  console.log("    \x1b[36mbold\x1b[0m          \x1b[2m— heavy borders, big banner, dramatic animations\x1b[0m");
  console.log("    \x1b[36mminimal\x1b[0m       \x1b[2m— clean, whitespace, subtle\x1b[0m");
  console.log("    \x1b[36mretro\x1b[0m         \x1b[2m— ASCII-heavy, old-school terminal\x1b[0m");
  console.log("    \x1b[36mplayful\x1b[0m       \x1b[2m— fun icons, colorful, animated\x1b[0m");
  console.log("    \x1b[36mprofessional\x1b[0m  \x1b[2m— clean borders, structured, no frills\x1b[0m");
  const style = await ask(rl, "  \x1b[2m>\x1b[0m ");
  console.log("");

  // 7. ASCII art
  console.log('  What ASCII art do you want? \x1b[2m(comma-separated, "auto", or "none")\x1b[0m');
  console.log("");
  console.log("  \x1b[2mScenes:\x1b[0m mountains, cityscape, forest, ocean, space, clouds, coffee-cup,");
  console.log("          rocket, cat, robot, terminal, vinyl-record, cassette, floppy-disk, gameboy");
  console.log("");
  console.log("  \x1b[2mExtras:\x1b[0m icons next to headers, decorative patterns, data charts");
  console.log("");
  const art = await ask(rl, "  \x1b[2m>\x1b[0m ");
  console.log("");

  // 8. Interactive features
  console.log('  Interactive features? \x1b[2m(comma-separated, "auto", or "none")\x1b[0m');
  console.log("    \x1b[2m- contact form\x1b[0m");
  console.log("    \x1b[2m- reservation/booking form\x1b[0m");
  console.log("    \x1b[2m- signup form\x1b[0m");
  console.log("    \x1b[2m- search\x1b[0m");
  console.log("    \x1b[2m- newsletter subscribe\x1b[0m");
  console.log("    \x1b[2m- custom (describe below)\x1b[0m");
  const interactiveInput = await ask(rl, "  \x1b[2m>\x1b[0m ");
  let interactive = interactiveInput.trim() || "none";
  let customFormFields: string | undefined;

  if (interactive.toLowerCase().includes("custom")) {
    // Check if they typed "custom: description..." inline
    const colonMatch = interactive.match(/custom\s*:\s*(.+)/i);
    if (colonMatch && colonMatch[1].trim().length > 0) {
      customFormFields = colonMatch[1].trim();
    } else {
      console.log("");
      customFormFields = await askMultiline(
        rl,
        "  Describe the form:\n  \x1b[2m(Enter twice to finish)\x1b[0m"
      );
    }
  }
  console.log("");

  // 9. Animations
  console.log("  Animation level?");
  console.log("    \x1b[36m1.\x1b[0m full    \x1b[2m— boot sequence, transitions, exit message\x1b[0m");
  console.log("    \x1b[36m2.\x1b[0m subtle  \x1b[2m— gentle transitions only\x1b[0m");
  console.log("    \x1b[36m3.\x1b[0m none    \x1b[2m— instant everything\x1b[0m");
  const animInput = await ask(rl, "  \x1b[2m>\x1b[0m ");
  let animations: "full" | "subtle" | "none";
  switch (animInput.trim().toLowerCase()) {
    case "1":
    case "full":
      animations = "full";
      break;
    case "2":
    case "subtle":
      animations = "subtle";
      break;
    case "3":
    case "none":
      animations = "none";
      break;
    default:
      animations = "full";
  }
  console.log("");

  // 10. Anything else
  const extra = await askMultiline(
    rl,
    '  Any other instructions? Special requests, things to avoid, specific details.\n  \x1b[2m(Enter twice to finish, or type "done")\x1b[0m'
  );
  const extraClean = extra.toLowerCase() === "done" ? null : extra || null;

  rl.close();

  return {
    name,
    slugName,
    description,
    pages,
    content,
    theme,
    style: style.trim() || "auto",
    art: art.trim() || "auto",
    interactive,
    customFormFields,
    animations,
    extra: extraClean,
  };
}

export async function runCreate() {
  const answers = await runQuestionnaire();

  const cwd = process.cwd();
  const projectDir = join(cwd, answers.slugName);

  // Create project directory
  if (existsSync(projectDir)) {
    console.log(`\n  \x1b[33m!\x1b[0m Directory ./${answers.slugName}/ already exists — writing into it.\n`);
  } else {
    mkdirSync(projectDir, { recursive: true });
  }

  // Copy SKILL.md
  const pkgRoot = findPackageRoot();
  const skillSrc = join(pkgRoot, "claude", "SKILL.md");

  if (!existsSync(skillSrc)) {
    console.error("\n  \x1b[31mError:\x1b[0m Could not find claude/SKILL.md");
    console.error("  Looked in:", pkgRoot);
    process.exit(1);
  }

  copyFileSync(skillSrc, join(projectDir, "TERMINALTUI_SKILL.md"));

  // Write prompt
  const prompt = buildPrompt(answers);
  writeFileSync(join(projectDir, "TERMINALTUI_CREATE_PROMPT.md"), prompt, "utf-8");

  // Print success box
  const slug = answers.slugName;

  const contentLines = [
    "",
    `  \x1b[32m✓\x1b[0m Project ready in \x1b[1m./${slug}/\x1b[0m`,
    "",
    "  \x1b[1mNext:\x1b[0m",
    `    \x1b[36mcd ${slug}\x1b[0m`,
    "    \x1b[36mclaude\x1b[0m",
    "",
    "  Paste this into Claude Code:",
    "",
    "    Read TERMINALTUI_SKILL.md for the API,",
    "    then follow TERMINALTUI_CREATE_PROMPT.md",
    "",
    "  When it's done:",
    "    \x1b[36mterminaltui dev\x1b[0m       \x1b[2m# preview\x1b[0m",
    "    \x1b[36mterminaltui build\x1b[0m     \x1b[2m# bundle\x1b[0m",
    "    \x1b[36mnpm publish\x1b[0m           \x1b[2m# share\x1b[0m",
    "",
  ];

  const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

  const title = " terminaltui create ";
  const innerWidth = Math.max(48, ...contentLines.map((l) => strip(l).length + 2));

  const topBar = "─".repeat(innerWidth - title.length - 1);
  console.log("");
  console.log(`\x1b[2m  ╭─\x1b[0m\x1b[1m\x1b[35m${title}\x1b[0m\x1b[2m${topBar}╮\x1b[0m`);
  for (const line of contentLines) {
    const visible = strip(line);
    const pad = " ".repeat(Math.max(0, innerWidth - visible.length));
    console.log(`\x1b[2m  │\x1b[0m${line}${pad}\x1b[2m│\x1b[0m`);
  }
  console.log(`\x1b[2m  ╰${"─".repeat(innerWidth)}╯\x1b[0m`);
  console.log("");
}
