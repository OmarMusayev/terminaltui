import { join, resolve } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const TEMPLATES = ["minimal", "portfolio", "landing", "restaurant", "blog", "creative"] as const;
type Template = typeof TEMPLATES[number];

const THEMES = [
  "cyberpunk", "dracula", "nord", "monokai", "solarized",
  "gruvbox", "catppuccin", "tokyoNight", "rosePine", "hacker",
] as const;

export async function scaffoldProject(templateArg?: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> => new Promise(res => rl.question(q, res));

  console.log("\n  \x1b[1m\x1b[36mterminaltui\x1b[0m — create a new TUI website\n");

  let name: string;
  let tagline: string;
  let template: Template;
  let theme: string;

  try {
    name = (await ask("  Site name: ")).trim();
    if (!name) name = "My TUI Site";

    tagline = await ask("  Tagline: ");

    if (templateArg && (TEMPLATES as readonly string[]).includes(templateArg)) {
      template = templateArg as Template;
      console.log(`  Template: ${template}`);
    } else {
      console.log(`\n  Templates: ${TEMPLATES.join(", ")}`);
      const tpl = (await ask("  Choose template (default: minimal): ")).trim();
      if (!tpl) {
        template = "minimal";
      } else if ((TEMPLATES as readonly string[]).includes(tpl)) {
        template = tpl as Template;
      } else {
        console.log(`  \x1b[33m'${tpl}' is not a known template — using 'minimal'\x1b[0m`);
        template = "minimal";
      }
    }

    console.log(`\n  Themes: ${THEMES.join(", ")}`);
    const themeAnswer = (await ask("  Choose theme (default: dracula): ")).trim();
    if (!themeAnswer) {
      theme = "dracula";
    } else if ((THEMES as readonly string[]).includes(themeAnswer)) {
      theme = themeAnswer;
    } else {
      console.log(`  \x1b[33m'${themeAnswer}' is not a known theme — using 'dracula'\x1b[0m`);
      theme = "dracula";
    }
  } finally {
    rl.close();
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  }

  const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  const projectDir = resolve(safeName);

  if (existsSync(projectDir)) {
    console.error(`\n  Error: Directory '${safeName}' already exists.`);
    process.exit(1);
  }

  mkdirSync(projectDir, { recursive: true });
  const pagesDir = join(projectDir, "pages");
  mkdirSync(pagesDir, { recursive: true });

  const { config, pages } = generateTemplate(template, name, tagline, theme);
  writeFileSync(join(projectDir, "config.ts"), config);
  for (const page of pages) {
    writeFileSync(join(pagesDir, page.filename), page.content);
  }

  const pkg = JSON.stringify({
    name: safeName,
    version: "1.0.0",
    description: `${name} — run \`npx ${safeName}\` to view in your terminal`,
    type: "module",
    bin: { [safeName]: "./dist/cli.js" },
    files: ["dist"],
    scripts: {
      dev: "terminaltui dev",
      build: "terminaltui build",
      prepublishOnly: "npm run build",
    },
    dependencies: {
      terminaltui: "^1.6.0",
    },
    engines: { node: ">=18" },
  }, null, 2);
  writeFileSync(join(projectDir, "package.json"), pkg);

  const tsConfig = JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ["config.ts", "pages/**/*.ts"],
  }, null, 2);
  writeFileSync(join(projectDir, "tsconfig.json"), tsConfig);

  console.log(`\n  \x1b[32m✓\x1b[0m Created project in \x1b[1m${safeName}/\x1b[0m`);
  console.log(`\n  Next steps:`);
  console.log(`    cd ${safeName}`);
  console.log(`    npm install`);
  console.log(`    npm run dev`);
  console.log("");
}

// ─── Template scaffolding ──────────────────────────────────

interface PageFileOutput {
  filename: string;
  content: string;
}

interface TemplateOutput {
  config: string;
  pages: PageFileOutput[];
}

interface BannerSpec {
  text: string;
  font: string;
  gradient?: string[];
}

interface PageSpec {
  filename: string;
  fnName: string;
  imports: string[];
  metadata: { label: string; icon: string; order: number };
  body: string;
}

const j = (v: unknown): string => JSON.stringify(v);

function configFile(
  name: string,
  tagline: string,
  theme: string,
  banner: BannerSpec,
  extras: string[] = [],
): string {
  const grad = banner.gradient ? `, gradient: ${j(banner.gradient)}` : "";
  const extraLines = extras.length ? "\n  " + extras.join(",\n  ") + "," : "";
  return `import { defineConfig } from "terminaltui";

export default defineConfig({
  name: ${j(name)},
  tagline: ${j(tagline)},
  banner: { text: ${j(banner.text)}, font: ${j(banner.font)}${grad} },
  theme: ${j(theme)},${extraLines}
});
`;
}

function pageFile(spec: PageSpec): PageFileOutput {
  const imports = `import { ${spec.imports.join(", ")} } from "terminaltui";`;
  const meta = `export const metadata = { label: ${j(spec.metadata.label)}, icon: ${j(spec.metadata.icon)}, order: ${spec.metadata.order} };`;
  const fn = `export default function ${spec.fnName}() {
  return [
${spec.body}
  ];
}
`;
  return {
    filename: spec.filename,
    content: `${imports}\n\n${meta}\n\n${fn}`,
  };
}

function generateTemplate(
  template: Template,
  name: string,
  tagline: string,
  theme: string,
): TemplateOutput {
  switch (template) {
    case "portfolio": return portfolioTemplate(name, tagline, theme);
    case "landing": return landingTemplate(name, tagline, theme);
    case "restaurant": return restaurantTemplate(name, tagline, theme);
    case "blog": return blogTemplate(name, tagline, theme);
    case "creative": return creativeTemplate(name, tagline, theme);
    default: return minimalTemplate(name, tagline, theme);
  }
}

// ─── minimal ───────────────────────────────────────────────

function minimalTemplate(name: string, tagline: string, theme: string): TemplateOutput {
  const config = configFile(
    name,
    tagline || "welcome to my terminal",
    theme,
    { text: name, font: "ANSI Shadow" },
  );

  const pages: PageFileOutput[] = [
    pageFile({
      filename: "about.ts",
      fnName: "About",
      imports: ["markdown"],
      metadata: { label: "About", icon: "◆", order: 1 },
      body: `    markdown("Hello! Edit pages/about.ts to customize this page."),`,
    }),
    pageFile({
      filename: "links.ts",
      fnName: "Links",
      imports: ["link"],
      metadata: { label: "Links", icon: "◉", order: 2 },
      body: [
        `    link("GitHub", "https://github.com"),`,
        `    link("Website", "https://example.com"),`,
      ].join("\n"),
    }),
  ];

  return { config, pages };
}

// ─── portfolio ─────────────────────────────────────────────

function portfolioTemplate(name: string, tagline: string, theme: string): TemplateOutput {
  const config = configFile(
    name,
    tagline || "software engineer",
    theme,
    { text: name, font: "ANSI Shadow", gradient: ["#ff6b6b", "#4ecdc4"] },
    [`animations: { boot: true }`],
  );

  const pages: PageFileOutput[] = [
    pageFile({
      filename: "about.ts",
      fnName: "About",
      imports: ["markdown"],
      metadata: { label: "About", icon: "◆", order: 1 },
      body: `    markdown("Hey! I build things. Edit pages/about.ts to tell your story."),`,
    }),
    pageFile({
      filename: "projects.ts",
      fnName: "Projects",
      imports: ["card"],
      metadata: { label: "Projects", icon: "◈", order: 2 },
      body: [
        `    card({ title: "Project One", subtitle: "★ 100", body: "A cool project", tags: ["TypeScript"], url: "https://github.com" }),`,
        `    card({ title: "Project Two", subtitle: "★ 50", body: "Another project", tags: ["Rust"], url: "https://github.com" }),`,
      ].join("\n"),
    }),
    pageFile({
      filename: "experience.ts",
      fnName: "Experience",
      imports: ["timeline"],
      metadata: { label: "Experience", icon: "▣", order: 3 },
      body: [
        `    timeline([`,
        `      { title: "Senior Engineer", subtitle: "Company", period: "2023 — present", description: "Leading projects" },`,
        `      { title: "Software Engineer", subtitle: "Startup", period: "2021 — 2023", description: "Full-stack development" },`,
        `    ]),`,
      ].join("\n"),
    }),
    pageFile({
      filename: "skills.ts",
      fnName: "Skills",
      imports: ["skillBar"],
      metadata: { label: "Skills", icon: "▤", order: 4 },
      body: [
        `    skillBar("TypeScript", 90),`,
        `    skillBar("Rust", 75),`,
        `    skillBar("Python", 80),`,
        `    skillBar("Go", 65),`,
      ].join("\n"),
    }),
    pageFile({
      filename: "links.ts",
      fnName: "Links",
      imports: ["link"],
      metadata: { label: "Links", icon: "◉", order: 5 },
      body: [
        `    link("GitHub", "https://github.com"),`,
        `    link("LinkedIn", "https://linkedin.com"),`,
        `    link("Email", "mailto:hello@example.com"),`,
      ].join("\n"),
    }),
  ];

  return { config, pages };
}

// ─── landing ───────────────────────────────────────────────

function landingTemplate(name: string, tagline: string, theme: string): TemplateOutput {
  const heroSubtitle = tagline || "Build something amazing.";
  const config = configFile(
    name,
    tagline || "the future is here",
    theme,
    { text: name, font: "ANSI Shadow", gradient: ["#7c3aed", "#06b6d4"] },
    [`animations: { boot: true }`],
  );

  const pages: PageFileOutput[] = [
    pageFile({
      filename: "home.ts",
      fnName: "Home",
      imports: ["hero"],
      metadata: { label: "Home", icon: "◆", order: 1 },
      body: `    hero({ title: ${j(`Welcome to ${name}`)}, subtitle: ${j(heroSubtitle)}, cta: { label: "Get Started →", url: "https://example.com" } }),`,
    }),
    pageFile({
      filename: "features.ts",
      fnName: "Features",
      imports: ["card"],
      metadata: { label: "Features", icon: "◈", order: 2 },
      body: [
        `    card({ title: "Feature One", body: "Description of your first feature", tags: ["Core"] }),`,
        `    card({ title: "Feature Two", body: "Description of your second feature", tags: ["Pro"] }),`,
        `    card({ title: "Feature Three", body: "Description of your third feature", tags: ["Enterprise"] }),`,
      ].join("\n"),
    }),
    pageFile({
      filename: "pricing.ts",
      fnName: "Pricing",
      imports: ["table"],
      metadata: { label: "Pricing", icon: "▣", order: 3 },
      body: [
        `    table(["Plan", "Price", "Features"], [`,
        `      ["Free", "$0/mo", "Basic features"],`,
        `      ["Pro", "$10/mo", "Everything in Free + more"],`,
        `      ["Enterprise", "Custom", "Unlimited everything"],`,
        `    ]),`,
      ].join("\n"),
    }),
    pageFile({
      filename: "docs.ts",
      fnName: "Docs",
      imports: ["list", "link"],
      metadata: { label: "Quick Start", icon: "▸", order: 4 },
      body: [
        `    list(["Install the package", "Configure your settings", "Deploy to production"], "number"),`,
        `    link("Full Documentation →", "https://docs.example.com"),`,
      ].join("\n"),
    }),
  ];

  return { config, pages };
}

// ─── restaurant ────────────────────────────────────────────

function restaurantTemplate(name: string, tagline: string, theme: string): TemplateOutput {
  const config = configFile(
    name,
    tagline || "fine dining experience",
    theme,
    { text: name, font: "Ogre", gradient: ["#d4a373", "#e63946"] },
    [
      `borders: "rounded"`,
      `animations: { boot: true, exitMessage: "Thanks for visiting! See you at the table." }`,
    ],
  );

  const pages: PageFileOutput[] = [
    pageFile({
      filename: "menu.ts",
      fnName: "Menu",
      imports: ["section", "card", "divider"],
      metadata: { label: "Menu", icon: "◆", order: 1 },
      body: [
        `    section("Starters", [`,
        `      card({ title: "Appetizer One", subtitle: "$12", body: "Description of this dish" }),`,
        `      card({ title: "Appetizer Two", subtitle: "$14", body: "Description of this dish" }),`,
        `    ]),`,
        `    divider(),`,
        `    section("Mains", [`,
        `      card({ title: "Main Course One", subtitle: "$28", body: "Description of this dish" }),`,
        `      card({ title: "Main Course Two", subtitle: "$32", body: "Description of this dish" }),`,
        `    ]),`,
      ].join("\n"),
    }),
    pageFile({
      filename: "about.ts",
      fnName: "About",
      imports: ["markdown", "divider", "quote"],
      metadata: { label: "Our Story", icon: "◈", order: 2 },
      body: [
        `    markdown("Tell the story of your restaurant here."),`,
        `    divider(),`,
        `    quote("A wonderful dining experience.", "— Food Critic"),`,
      ].join("\n"),
    }),
    pageFile({
      filename: "hours.ts",
      fnName: "Hours",
      imports: ["table", "divider", "markdown", "link"],
      metadata: { label: "Hours & Location", icon: "▣", order: 3 },
      body: [
        `    table(["Day", "Hours"], [`,
        `      ["Mon — Fri", "11:00 AM — 10:00 PM"],`,
        `      ["Sat — Sun", "10:00 AM — 11:00 PM"],`,
        `    ]),`,
        `    divider(),`,
        `    markdown("**Address:** 123 Main Street, Your City"),`,
        `    link("Google Maps", "https://maps.google.com"),`,
        `    link("Reservations", "https://opentable.com"),`,
      ].join("\n"),
    }),
    pageFile({
      filename: "contact.ts",
      fnName: "Contact",
      imports: ["link"],
      metadata: { label: "Contact", icon: "◉", order: 4 },
      body: [
        `    link("Instagram", "https://instagram.com"),`,
        `    link("Phone", "tel:+15551234567"),`,
        `    link("Email", "mailto:hello@restaurant.com"),`,
      ].join("\n"),
    }),
  ];

  return { config, pages };
}

// ─── blog ──────────────────────────────────────────────────

function blogTemplate(name: string, tagline: string, theme: string): TemplateOutput {
  const config = configFile(
    name,
    tagline || "thoughts and writing",
    theme,
    { text: name, font: "Small", gradient: ["#ebbcba", "#c4a7e7"] },
  );

  const pages: PageFileOutput[] = [
    pageFile({
      filename: "posts.ts",
      fnName: "Posts",
      imports: ["card"],
      metadata: { label: "Posts", icon: "◆", order: 1 },
      body: [
        `    card({ title: "My First Post", subtitle: "Mar 2026", body: "A brief summary of what this post is about..." }),`,
        `    card({ title: "Another Post", subtitle: "Feb 2026", body: "More interesting thoughts..." }),`,
      ].join("\n"),
    }),
    pageFile({
      filename: "about.ts",
      fnName: "About",
      imports: ["markdown"],
      metadata: { label: "About", icon: "◈", order: 2 },
      body: `    markdown("Write about yourself and your blog here."),`,
    }),
    pageFile({
      filename: "links.ts",
      fnName: "Links",
      imports: ["link"],
      metadata: { label: "Links", icon: "◉", order: 3 },
      body: [
        `    link("RSS Feed", "https://example.com/feed"),`,
        `    link("Twitter", "https://twitter.com"),`,
        `    link("GitHub", "https://github.com"),`,
      ].join("\n"),
    }),
  ];

  return { config, pages };
}

// ─── creative ──────────────────────────────────────────────

function creativeTemplate(name: string, tagline: string, theme: string): TemplateOutput {
  const config = configFile(
    name,
    tagline || "experiment · create · explore",
    theme,
    { text: name, font: "Slant", gradient: ["#ff2a6d", "#05d9e8", "#ff2a6d"] },
    [`animations: { boot: true, exitMessage: "[ end of transmission ]" }`],
  );

  const pages: PageFileOutput[] = [
    pageFile({
      filename: "enter.ts",
      fnName: "Enter",
      imports: ["spacer", "markdown", "divider"],
      metadata: { label: "Enter", icon: "✦", order: 1 },
      body: [
        `    spacer(2),`,
        `    markdown("Welcome to the void. This is your creative space."),`,
        `    spacer(),`,
        `    divider("dotted"),`,
        `    spacer(),`,
        `    markdown("Edit **pages/enter.ts** to make it yours."),`,
      ].join("\n"),
    }),
    pageFile({
      filename: "links.ts",
      fnName: "Links",
      imports: ["link"],
      metadata: { label: "Links", icon: "◉", order: 2 },
      body: `    link("The Source", "https://github.com"),`,
    }),
  ];

  return { config, pages };
}
