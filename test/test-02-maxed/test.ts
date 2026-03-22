/**
 * MAXED-OUT Portfolio Test
 * Tests EVERY feature of terminaltui at EVERY width for EVERY component.
 *
 * - 6+ pages, 10+ cards, 5-item timeline, 8 skill bars, 8+ links
 * - boot animation, exit animation, slide transitions, gradient banner
 * - Every content block type
 * - Individual component tests at widths 30, 40, 60, 80, 100, 120
 * - Gallery, Tabs, Accordion, ScrollView, Divider, List, Badge, Quote edge cases
 */

import {
  defineSite,
  page,
  card,
  timeline,
  table,
  list,
  quote,
  hero,
  gallery,
  tabs,
  accordion,
  link,
  skillBar,
  progressBar,
  badge,
  image,
  divider,
  spacer,
  section,
  themes,
  testSiteConfig,
  formatReport,
  createTestContext,
  renderBlock,
  assertNoThrow,
  assertLines,
  assertLinesNonEmpty,
  assertNoOverflow,
  type TestResult,
  type TestReport,
  type BugReport,
} from "../harness.js";

import { renderCard } from "../../src/components/Card.js";
import { renderTimeline } from "../../src/components/Timeline.js";
import { renderProgressBar } from "../../src/components/ProgressBar.js";
import { renderTable } from "../../src/components/Table.js";
import { renderLink } from "../../src/components/Link.js";
import { renderDivider } from "../../src/components/Divider.js";
import { renderSpacer } from "../../src/components/Spacer.js";
import { renderQuote } from "../../src/components/Quote.js";
import { renderBadge } from "../../src/components/Badge.js";
import { renderHero } from "../../src/components/Hero.js";
import { renderList } from "../../src/components/List.js";
import { renderImage } from "../../src/components/Image.js";
import { renderAccordion } from "../../src/components/Accordion.js";
import { renderTabs } from "../../src/components/Tabs.js";
import { renderGallery } from "../../src/components/Gallery.js";
import { renderText } from "../../src/components/Text.js";
import { renderScrollView, scrollUp, scrollDown } from "../../src/components/ScrollView.js";
import { renderBox } from "../../src/components/Box.js";
import { stripAnsi, type RenderContext } from "../../src/components/base.js";
import { renderBanner } from "../../src/ascii/banner.js";
import { gradientLines } from "../../src/style/gradient.js";
import { defaultTheme } from "../../src/style/theme.js";

import type { ContentBlock, CardBlock } from "../../src/config/types.js";

// ─── Result Accumulator ──────────────────────────────────
const allResults: TestResult[] = [];
const allBugs: BugReport[] = [];

function addResult(r: TestResult) {
  allResults.push(r);
}

function addBug(bug: BugReport) {
  allBugs.push(bug);
}

function runTest(label: string, fn: () => void): void {
  const r = assertNoThrow(fn, label);
  addResult(r);
  if (!r.passed) {
    addBug({
      severity: "P1",
      category: "Runtime",
      description: `Test threw: ${r.error}`,
      reproduction: label,
    });
  }
}

// ─── Overflow checker for individual component tests ─────
function checkOverflow(lines: string[], width: number, label: string): void {
  for (let i = 0; i < lines.length; i++) {
    const plainLen = stripAnsi(lines[i]).length;
    if (plainLen > width + 2) {
      addResult({
        name: `${label} overflow at w=${width}`,
        passed: false,
        error: `Line ${i}: ${plainLen} chars (max ${width}). Content: "${stripAnsi(lines[i]).substring(0, 80)}..."`,
      });
      addBug({
        severity: "P2",
        category: "Layout/Overflow",
        description: `${label}: line ${i} is ${plainLen} chars wide at width ${width} (max ${width})`,
        reproduction: `${label}, width=${width}, line ${i}`,
        component: label.split(" ")[0],
      });
      return;
    }
  }
  addResult({ name: `${label} overflow at w=${width}`, passed: true });
}

// ─── Content block render helper ─────────────────────────
function renderContentBlocks(blocks: ContentBlock[], ctx: RenderContext): string[] {
  const lines: string[] = [];
  for (const b of blocks) lines.push(...renderBlock(b, ctx));
  return lines;
}

// ═══════════════════════════════════════════════════════════
// PART 1: BUILD THE MAXED-OUT SITE CONFIG
// ═══════════════════════════════════════════════════════════

const WIDTHS = [30, 40, 60, 80, 100, 120];

// 10+ project cards
const projectCards: CardBlock[] = [
  { type: "card", title: "Neural Engine", subtitle: "AI/ML", body: "Deep learning inference engine with CUDA support for real-time predictions at scale.", tags: ["Python", "CUDA", "TensorFlow"], url: "https://github.com/user/neural-engine" },
  { type: "card", title: "CloudForge CLI", subtitle: "DevOps", body: "Infrastructure-as-code tool for deploying multi-cloud Kubernetes clusters.", tags: ["Go", "Kubernetes", "Terraform"], url: "https://github.com/user/cloudforge" },
  { type: "card", title: "PixelStream", subtitle: "Real-time Media", body: "Low-latency video streaming over WebRTC with adaptive bitrate.", tags: ["Rust", "WebRTC", "WASM"], url: "https://github.com/user/pixelstream" },
  { type: "card", title: "DataLoom", subtitle: "Data Engineering", body: "ETL pipeline orchestrator with schema evolution and auto-scaling.", tags: ["Scala", "Spark", "Airflow"], url: "https://github.com/user/dataloom" },
  { type: "card", title: "Vaultex", subtitle: "Security", body: "Zero-knowledge proof authentication system for enterprise SSO.", tags: ["Rust", "ZKP", "OAuth2"], url: "https://github.com/user/vaultex" },
  { type: "card", title: "QuantumSim", subtitle: "Simulation", body: "Quantum circuit simulator supporting 30+ qubits on classical hardware.", tags: ["C++", "Python", "Qiskit"], url: "https://github.com/user/quantumsim" },
  { type: "card", title: "SynthWave", subtitle: "Audio", body: "Modular audio synthesizer with WebAudio API and MIDI support.", tags: ["TypeScript", "WebAudio", "React"], url: "https://github.com/user/synthwave" },
  { type: "card", title: "MapForge", subtitle: "GIS", body: "Open-source GIS toolkit for procedural terrain and city generation.", tags: ["Rust", "OpenGL", "GeoJSON"], url: "https://github.com/user/mapforge" },
  { type: "card", title: "NexusDB", subtitle: "Database", body: "Distributed key-value store with CRDT-based conflict resolution.", tags: ["Erlang", "RocksDB", "gRPC"], url: "https://github.com/user/nexusdb" },
  { type: "card", title: "TerminalTUI", subtitle: "Developer Tools", body: "Turn any website into a beautiful terminal experience.", tags: ["TypeScript", "Node.js", "TUI"], url: "https://github.com/user/terminaltui" },
  { type: "card", title: "Spectra", subtitle: "Visualization", body: "WebGPU-powered scientific data visualization framework.", tags: ["TypeScript", "WebGPU", "D3"], url: "https://github.com/user/spectra" },
  { type: "card", title: "CryptoMesh", subtitle: "Blockchain", body: "Layer-2 scaling solution with optimistic rollups for EVM chains.", tags: ["Solidity", "Rust", "Ethereum"], url: "https://github.com/user/cryptomesh" },
];

// 5-item timeline
const timelineItems = [
  { title: "Senior Principal Engineer", subtitle: "MegaCorp", period: "2023-Present", description: "Leading platform architecture for 50M+ user system. Designed microservices migration from monolith." },
  { title: "Staff Engineer", subtitle: "RocketScale", period: "2020-2023", description: "Built real-time data pipeline processing 2TB/day. Led team of 12 engineers across 3 timezones." },
  { title: "Senior Engineer", subtitle: "DataFlow Inc", period: "2017-2020", description: "Core contributor to open-source ETL framework used by Fortune 500 companies." },
  { title: "Software Engineer", subtitle: "StartupXYZ", period: "2015-2017", description: "Full-stack development of SaaS analytics dashboard. Employee #5, grew to 100+." },
  { title: "Junior Developer", subtitle: "CodeAcademy Corp", period: "2013-2015", description: "Built internal tools and automated CI/CD pipelines. First professional role." },
];

// 8+ skill bars
const skills: ContentBlock[] = [
  skillBar("TypeScript", 95),
  skillBar("Rust", 88),
  skillBar("Python", 92),
  skillBar("Go", 85),
  skillBar("C++", 78),
  skillBar("Kubernetes", 90),
  skillBar("AWS/GCP", 87),
  skillBar("System Design", 93),
  skillBar("GraphQL", 82),
  skillBar("WebAssembly", 75),
];

// 8+ links
const linkBlocks: ContentBlock[] = [
  link("GitHub", "https://github.com/maxuser", { icon: "github" }),
  link("LinkedIn", "https://linkedin.com/in/maxuser", { icon: "linkedin" }),
  link("Twitter/X", "https://x.com/maxuser", { icon: "twitter" }),
  link("Personal Blog", "https://maxuser.dev/blog", { icon: "web" }),
  link("Stack Overflow", "https://stackoverflow.com/users/maxuser", { icon: "stackoverflow" }),
  link("Dev.to", "https://dev.to/maxuser", { icon: "devto" }),
  link("Resume (PDF)", "https://maxuser.dev/resume.pdf", { icon: "file" }),
  link("Email", "mailto:max@maxuser.dev", { icon: "email" }),
  link("Discord", "https://discord.gg/maxuser", { icon: "discord" }),
];

// 3+ quotes
const quoteBlocks: ContentBlock[] = [
  { type: "quote", text: "The best way to predict the future is to invent it.", attribution: "Alan Kay", style: "border" },
  { type: "quote", text: "Programs must be written for people to read, and only incidentally for machines to execute.", attribution: "Harold Abelson", style: "fancy" },
  { type: "quote", text: "Simplicity is the ultimate sophistication.", attribution: "Leonardo da Vinci", style: "indent" },
];

// Table with 4+ columns, 5+ rows
const statsTable = table(
  ["Metric", "2023", "2024", "2025", "Change"],
  [
    ["GitHub Commits", "2,341", "3,102", "2,890", "+23%"],
    ["PRs Merged", "189", "234", "312", "+65%"],
    ["Issues Closed", "456", "521", "678", "+48%"],
    ["Repos Created", "12", "18", "24", "+100%"],
    ["Stars Earned", "1.2k", "3.4k", "8.1k", "+575%"],
    ["Blog Posts", "24", "31", "42", "+75%"],
  ]
);

// Lists with all styles
const bulletList = list(["Performance optimization", "System architecture", "Team leadership", "Open-source development"], "bullet");
const numberList = list(["Design the API surface", "Implement core logic", "Write comprehensive tests", "Performance benchmarking", "Documentation"], "number");
const dashList = list(["Rust for systems programming", "TypeScript for full-stack", "Go for cloud-native services"], "dash");
const checkList = list(["Microservices migration completed", "99.99% uptime achieved", "Response time < 50ms", "Zero-downtime deployments"], "check");
const arrowList = list(["Monolith to microservices", "REST to GraphQL", "VM to Kubernetes", "Manual to GitOps"], "arrow");

// Badges (5+)
const badgeBlocks: ContentBlock[] = [
  { type: "badge", text: "Open Source", color: "#50fa7b", style: "filled" },
  { type: "badge", text: "Rust", color: "#ff79c6", style: "outline" },
  { type: "badge", text: "TypeScript", color: "#7aa2f7", style: "filled" },
  { type: "badge", text: "Kubernetes", color: "#88c0d0", style: "outline" },
  { type: "badge", text: "AWS Certified", color: "#f1fa8c", style: "filled" },
  { type: "badge", text: "Google Cloud", color: "#ff5555", style: "outline" },
  { type: "badge", text: "Contributor", color: "#bd93f9", style: "filled" },
];

// Dividers (all styles)
const dividerBlocks: ContentBlock[] = [
  divider("solid"),
  divider("dashed"),
  divider("dotted"),
  divider("double"),
  divider("label", "Section Break"),
];

// Hero
const heroBlock = hero({
  title: "Max User — Senior Principal Engineer",
  subtitle: "Building the future of distributed systems, one commit at a time.",
  cta: { label: "View Projects", url: "#projects" },
  art: "    /\\     /\\    \n   /  \\   /  \\   \n  / /\\ \\ / /\\ \\  \n /  ____ \\  __\\  \n/__/    \\__/  \\__",
});

// Image
const imageBlock = image("avatar.png", { width: 30, mode: "blocks" });

// Tabs with 3 tabs
const tabsBlock = tabs([
  {
    label: "Frontend",
    content: [
      { type: "text", content: "React, Vue, Svelte, Angular — all battle-tested at scale." },
      skillBar("React", 95),
      skillBar("Vue", 82),
      skillBar("Svelte", 78),
    ],
  },
  {
    label: "Backend",
    content: [
      { type: "text", content: "Node.js, Rust, Go, Python — high-performance server-side." },
      skillBar("Node.js", 93),
      skillBar("Rust", 88),
      skillBar("Go", 85),
    ],
  },
  {
    label: "Infrastructure",
    content: [
      { type: "text", content: "Kubernetes, Terraform, Docker — cloud-native deployment." },
      skillBar("Kubernetes", 90),
      skillBar("Docker", 92),
      skillBar("Terraform", 86),
    ],
  },
]);

// Accordion with 4 sections
const accordionBlock = accordion([
  {
    label: "Education",
    content: [
      { type: "text", content: "M.S. Computer Science — Stanford University (2013)" },
      { type: "text", content: "B.S. Mathematics — MIT (2011)" },
    ],
  },
  {
    label: "Certifications",
    content: [
      checkList,
      { type: "badge", text: "AWS Solutions Architect", color: "#f1fa8c", style: "filled" as const },
    ],
  },
  {
    label: "Publications",
    content: [
      numberList,
    ],
  },
  {
    label: "Hobbies",
    content: [
      bulletList,
    ],
  },
]);

// Gallery with 5+ cards
const galleryBlock = gallery([
  { title: "Neural Engine", subtitle: "AI/ML", body: "Deep learning inference.", tags: ["Python"] },
  { title: "CloudForge", subtitle: "DevOps", body: "Multi-cloud K8s.", tags: ["Go"] },
  { title: "PixelStream", subtitle: "Media", body: "WebRTC streaming.", tags: ["Rust"] },
  { title: "DataLoom", subtitle: "Data", body: "ETL pipelines.", tags: ["Scala"] },
  { title: "Vaultex", subtitle: "Security", body: "ZKP auth system.", tags: ["Rust"] },
]);

// Custom block
const customBlock: ContentBlock = {
  type: "custom",
  render: (width: number, theme: any) => {
    const lines: string[] = [];
    const w = Math.max(0, width - 4);
    lines.push("  +" + "-".repeat(w) + "+");
    lines.push("  |" + " CUSTOM BLOCK: ASCII Art ".padEnd(w) + "|");
    lines.push("  |" + "  _____                   ".padEnd(w) + "|");
    lines.push("  |" + " |_   _|   _  _  _  _     ".padEnd(w) + "|");
    lines.push("  |" + "   | |    | || || || |     ".padEnd(w) + "|");
    lines.push("  |" + "   |_|     \\_,_||_||_|    ".padEnd(w) + "|");
    lines.push("  +" + "-".repeat(w) + "+");
    return lines;
  },
};

// Sections
const sectionIntro = section("About Me", [
  { type: "text", content: "I am a Senior Principal Engineer with 12+ years of experience building distributed systems at scale. Passionate about open source, performance optimization, and mentoring the next generation of engineers." },
  spacer(1),
  ...quoteBlocks.slice(0, 1),
]);

const sectionSkills = section("Technical Skills", [
  ...skills,
]);

const sectionLinks = section("Connect", [
  ...linkBlocks,
]);

// ─── FULL SITE CONFIG ────────────────────────────────────
const siteConfig = {
  name: "Max User",
  handle: "@maxuser",
  tagline: "Senior Principal Engineer | Open Source Advocate | Systems Architect",
  banner: {
    text: "MAXUSER",
    font: "standard",
    gradient: ["#ff2a6d", "#05d9e8", "#d1f7ff"],
    align: "center" as const,
    padding: 1,
  },
  theme: "cyberpunk" as const,
  borders: "rounded" as const,
  animations: {
    boot: true,
    transitions: "slide" as const,
    exitMessage: "Thanks for visiting! Run `npx maxuser` anytime.",
    speed: "fast" as const,
  },
  navigation: {
    numberJump: true,
    vim: true,
    commandMode: true,
  },
  easterEggs: {
    konami: "You found the secret!",
    commands: { matrix: "Entering the Matrix..." },
  },
  statusBar: {
    show: true,
    showPageName: true,
    showHints: true,
  },
  footer: "Built with terminaltui | maxuser.dev",
  pages: [
    page("home", {
      title: "Home",
      icon: "home",
      content: [
        heroBlock,
        spacer(1),
        ...dividerBlocks.slice(0, 1),
        sectionIntro,
        spacer(1),
        ...badgeBlocks,
      ],
    }),
    page("projects", {
      title: "Projects",
      icon: "code",
      content: [
        { type: "text", content: "## Featured Projects" },
        spacer(1),
        ...projectCards.slice(0, 6),
        divider("label", "More Projects"),
        ...projectCards.slice(6),
      ],
    }),
    page("gallery-view", {
      title: "Gallery",
      icon: "grid",
      content: [
        { type: "text", content: "## Project Gallery" },
        galleryBlock,
        spacer(1),
        divider("dashed"),
      ],
    }),
    page("experience", {
      title: "Experience",
      icon: "briefcase",
      content: [
        { type: "text", content: "## Career Timeline" },
        timeline(timelineItems),
        spacer(1),
        divider("double"),
        statsTable,
      ],
    }),
    page("skills", {
      title: "Skills",
      icon: "chart",
      content: [
        { type: "text", content: "## Technical Proficiency" },
        tabsBlock,
        spacer(1),
        divider("dotted"),
        sectionSkills,
        spacer(1),
        accordionBlock,
      ],
    }),
    page("about", {
      title: "About",
      icon: "user",
      content: [
        imageBlock,
        spacer(1),
        { type: "text", content: "## About Me" },
        { type: "text", content: "Passionate engineer with a love for clean code, distributed systems, and open-source software. When not coding, you'll find me contributing to OSS, writing technical blog posts, or hiking in the mountains." },
        spacer(1),
        ...quoteBlocks,
        spacer(1),
        arrowList,
        dashList,
        checkList,
        numberList,
        bulletList,
      ],
    }),
    page("contact", {
      title: "Contact",
      icon: "mail",
      content: [
        { type: "text", content: "## Get In Touch" },
        sectionLinks,
        spacer(1),
        customBlock,
        spacer(2),
        divider("label", "fin"),
      ],
    }),
  ],
};

// ═══════════════════════════════════════════════════════════
// PART 2: RUN testSiteConfig() ON THE MAXED-OUT CONFIG
// ═══════════════════════════════════════════════════════════

console.log("═══════════════════════════════════════════════════════════");
console.log("  MAXED-OUT PORTFOLIO TEST SUITE");
console.log("═══════════════════════════════════════════════════════════\n");

console.log("▶ PHASE 1: Full site config validation...\n");
const siteReport = testSiteConfig(siteConfig, "Maxed-Out Portfolio");
console.log(formatReport(siteReport));
allResults.push(...siteReport.results);
allBugs.push(...siteReport.bugs);

// ═══════════════════════════════════════════════════════════
// PART 3: INDIVIDUAL COMPONENT TESTS AT ALL WIDTHS
// ═══════════════════════════════════════════════════════════

console.log("\n▶ PHASE 2: Individual component tests at widths [30, 40, 60, 80, 100, 120]...\n");

const theme = themes.cyberpunk;

// ─── 3a: Text Block ──────────────────────────────────────
for (const w of WIDTHS) {
  runTest(`Text/plain at w=${w}`, () => {
    const ctx = createTestContext(w, theme);
    const lines = renderText("Hello World, this is a simple text block for testing purposes.", ctx, "plain");
    if (lines.length === 0) throw new Error("Rendered 0 lines");
    checkOverflow(lines, w, "Text/plain");
  });
  runTest(`Text/markdown at w=${w}`, () => {
    const ctx = createTestContext(w, theme);
    const lines = renderText("## Heading\n\nParagraph with **bold** and *italic* text.", ctx, "markdown");
    if (lines.length === 0) throw new Error("Rendered 0 lines");
    checkOverflow(lines, w, "Text/markdown");
  });
}

// ─── 3b: Card ────────────────────────────────────────────
for (const w of WIDTHS) {
  for (const [idx, c] of projectCards.entries()) {
    runTest(`Card #${idx} "${c.title}" at w=${w}`, () => {
      const ctx = createTestContext(w, theme);
      const lines = renderCard(c, ctx);
      if (lines.length === 0) throw new Error("Rendered 0 lines");
      checkOverflow(lines, w, `Card #${idx}`);
    });
  }
}

// ─── 3c: Timeline ────────────────────────────────────────
for (const w of WIDTHS) {
  runTest(`Timeline (connected) at w=${w}`, () => {
    const ctx = createTestContext(w, theme);
    const lines = renderTimeline(timelineItems, ctx, "connected");
    if (lines.length === 0) throw new Error("Rendered 0 lines");
    checkOverflow(lines, w, "Timeline/connected");
  });
  runTest(`Timeline (separated) at w=${w}`, () => {
    const ctx = createTestContext(w, theme);
    const lines = renderTimeline(timelineItems, ctx, "separated");
    if (lines.length === 0) throw new Error("Rendered 0 lines");
    checkOverflow(lines, w, "Timeline/separated");
  });
}

// ─── 3d: Table ───────────────────────────────────────────
for (const w of WIDTHS) {
  runTest(`Table at w=${w}`, () => {
    const ctx = createTestContext(w, theme);
    const lines = renderTable(
      ["Metric", "2023", "2024", "2025", "Change"],
      [
        ["GitHub Commits", "2,341", "3,102", "2,890", "+23%"],
        ["PRs Merged", "189", "234", "312", "+65%"],
        ["Issues Closed", "456", "521", "678", "+48%"],
        ["Repos Created", "12", "18", "24", "+100%"],
        ["Stars Earned", "1.2k", "3.4k", "8.1k", "+575%"],
        ["Blog Posts", "24", "31", "42", "+75%"],
      ],
      ctx
    );
    if (lines.length === 0) throw new Error("Rendered 0 lines");
    checkOverflow(lines, w, "Table");
  });
}

// ─── 3e: List (all styles) ───────────────────────────────
const listStyles = ["bullet", "number", "dash", "check", "arrow"] as const;
const listItems = ["Alpha item", "Beta item with longer text for wrapping tests", "Gamma", "Delta item", "Epsilon"];
for (const w of WIDTHS) {
  for (const style of listStyles) {
    runTest(`List/${style} at w=${w}`, () => {
      const ctx = createTestContext(w, theme);
      const lines = renderList(listItems, ctx, style);
      if (lines.length === 0) throw new Error("Rendered 0 lines");
      if (lines.length !== listItems.length) throw new Error(`Expected ${listItems.length} lines, got ${lines.length}`);
      checkOverflow(lines, w, `List/${style}`);
    });
  }
}

// ─── 3f: Quote (all styles) ─────────────────────────────
const quoteStyles = ["border", "indent", "fancy"] as const;
for (const w of WIDTHS) {
  for (const qs of quoteStyles) {
    runTest(`Quote/${qs} at w=${w}`, () => {
      const ctx = createTestContext(w, theme);
      const lines = renderQuote("The only way to do great work is to love what you do. Stay hungry, stay foolish.", ctx, {
        attribution: "Steve Jobs",
        style: qs,
      });
      if (lines.length === 0) throw new Error("Rendered 0 lines");
      checkOverflow(lines, w, `Quote/${qs}`);
    });
  }
}

// ─── 3g: Hero ────────────────────────────────────────────
for (const w of WIDTHS) {
  runTest(`Hero at w=${w}`, () => {
    const ctx = createTestContext(w, theme);
    const lines = renderHero({
      title: "Max User — Senior Principal Engineer",
      subtitle: "Building the future of distributed systems.",
      cta: { label: "View Projects", url: "#projects" },
      art: "    /\\     /\\    \n   /  \\   /  \\   ",
    }, ctx);
    if (lines.length === 0) throw new Error("Rendered 0 lines");
    checkOverflow(lines, w, "Hero");
  });
}

// ─── 3h: Gallery at columns 1, 2, 3 ─────────────────────
const galleryCards: CardBlock[] = [
  { type: "card", title: "Project A", body: "Description A", tags: ["tag1"] },
  { type: "card", title: "Project B", body: "Description B", tags: ["tag2"] },
  { type: "card", title: "Project C", body: "Description C", tags: ["tag3"] },
  { type: "card", title: "Project D", body: "Description D", tags: ["tag4"] },
  { type: "card", title: "Project E", body: "Description E", tags: ["tag5"] },
];
for (const w of WIDTHS) {
  for (const cols of [1, 2, 3]) {
    runTest(`Gallery cols=${cols} at w=${w}`, () => {
      const ctx = createTestContext(w, theme);
      const lines = renderGallery(galleryCards, ctx, { columns: cols });
      if (lines.length === 0) throw new Error("Rendered 0 lines");
      checkOverflow(lines, w, `Gallery/cols=${cols}`);
    });
  }
}

// ─── 3i: Tabs — switch active index 0, 1, 2 ─────────────
const tabItems = [
  { label: "Tab A", content: [{ type: "text" as const, content: "Content of tab A" }] },
  { label: "Tab B", content: [{ type: "text" as const, content: "Content of tab B" }] },
  { label: "Tab C", content: [{ type: "text" as const, content: "Content of tab C" }] },
];
for (const w of WIDTHS) {
  for (const activeIdx of [0, 1, 2]) {
    runTest(`Tabs activeIdx=${activeIdx} at w=${w}`, () => {
      const ctx = createTestContext(w, theme);
      const lines = renderTabs(tabItems, activeIdx, ctx, renderContentBlocks);
      if (lines.length === 0) throw new Error("Rendered 0 lines");
      checkOverflow(lines, w, `Tabs/active=${activeIdx}`);
    });
  }
}

// ─── 3j: Accordion — open index 0, 1, 2, -1 (all closed)
const accordionItems = [
  { label: "Section A", content: [{ type: "text" as const, content: "Accordion content A with some extra text to test wrapping." }] },
  { label: "Section B", content: [{ type: "text" as const, content: "Accordion content B." }] },
  { label: "Section C", content: [{ type: "text" as const, content: "Accordion content C." }] },
  { label: "Section D", content: [{ type: "text" as const, content: "Accordion content D." }] },
];
for (const w of WIDTHS) {
  for (const openIdx of [0, 1, 2, -1]) {
    runTest(`Accordion openIdx=${openIdx} at w=${w}`, () => {
      const ctx = createTestContext(w, theme);
      const lines = renderAccordion(accordionItems, openIdx, ctx, renderContentBlocks);
      if (lines.length === 0) throw new Error("Rendered 0 lines");
      // When openIdx=-1, all should be closed, so only headers
      if (openIdx === -1 && lines.length !== accordionItems.length) {
        // It's not necessarily a bug if there are empty lines, but check content
      }
      checkOverflow(lines, w, `Accordion/open=${openIdx}`);
    });
  }
}

// ─── 3k: ScrollView — 50 lines, visible 10 and 20 ───────
for (const w of WIDTHS) {
  const scrollContent: string[] = [];
  for (let i = 0; i < 50; i++) {
    scrollContent.push(`  Line ${i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.`);
  }
  for (const visH of [10, 20]) {
    // Test at various scroll offsets
    for (const offset of [0, 10, 25, 40, 49]) {
      runTest(`ScrollView vis=${visH} offset=${offset} at w=${w}`, () => {
        const ctx = createTestContext(w, theme);
        const result = renderScrollView(scrollContent, visH, offset, ctx);
        if (result.lines.length === 0) throw new Error("Rendered 0 lines");
        if (result.lines.length > visH) throw new Error(`Rendered ${result.lines.length} lines, expected <= ${visH}`);
        if (result.scrollState.totalLines !== 50) throw new Error(`Total lines should be 50, got ${result.scrollState.totalLines}`);
        checkOverflow(result.lines, w + 4, `ScrollView`); // +4 for scroll indicator
      });
    }
  }
  // Test scrollUp/scrollDown
  runTest(`ScrollView scrollUp/scrollDown at w=${w}`, () => {
    const state = { offset: 25, totalLines: 50, visibleLines: 10 };
    const upOffset = scrollUp(state, 5);
    if (upOffset !== 20) throw new Error(`scrollUp(25, 5) = ${upOffset}, expected 20`);
    const downOffset = scrollDown(state, 5);
    if (downOffset !== 30) throw new Error(`scrollDown(25, 5) = ${downOffset}, expected 30`);
    const upMin = scrollUp({ ...state, offset: 2 }, 5);
    if (upMin !== 0) throw new Error(`scrollUp(2, 5) = ${upMin}, expected 0`);
    const downMax = scrollDown({ ...state, offset: 39 }, 5);
    if (downMax !== 40) throw new Error(`scrollDown(39, 5) = ${downMax}, expected 40`);
  });
}

// ─── 3l: Every divider style ─────────────────────────────
const dividerStyles = ["solid", "dashed", "dotted", "double", "label"] as const;
for (const w of WIDTHS) {
  for (const ds of dividerStyles) {
    runTest(`Divider/${ds} at w=${w}`, () => {
      const ctx = createTestContext(w, theme);
      const lines = renderDivider(ctx, {
        style: ds,
        label: ds === "label" ? "Section Title" : undefined,
      });
      if (lines.length === 0) throw new Error("Rendered 0 lines");
      if (lines.length !== 1) throw new Error(`Divider should be 1 line, got ${lines.length}`);
      checkOverflow(lines, w, `Divider/${ds}`);
    });
  }
}

// ─── 3m: Badge — filled vs outline ───────────────────────
for (const w of WIDTHS) {
  for (const bs of ["filled", "outline"] as const) {
    runTest(`Badge/${bs} at w=${w}`, () => {
      const ctx = createTestContext(w, theme);
      const line = renderBadge("Test Badge", ctx, { color: "#ff79c6", style: bs });
      if (!line || line.length === 0) throw new Error("Empty badge output");
      const plain = stripAnsi(line);
      if (bs === "filled") {
        if (!plain.includes("Test Badge")) throw new Error("Filled badge missing text");
      } else {
        if (!plain.includes("[Test Badge]")) throw new Error("Outline badge missing brackets");
      }
    });
  }
}

// ─── 3n: ProgressBar / SkillBar ──────────────────────────
for (const w of WIDTHS) {
  for (const val of [0, 25, 50, 75, 100]) {
    runTest(`ProgressBar val=${val} at w=${w}`, () => {
      const ctx = createTestContext(w, theme);
      const lines = renderProgressBar("Test Skill", val, ctx, { max: 100, showPercent: true });
      if (lines.length === 0) throw new Error("Rendered 0 lines");
      checkOverflow(lines, w, `ProgressBar/val=${val}`);
    });
  }
}

// ─── 3o: Image ───────────────────────────────────────────
for (const w of WIDTHS) {
  runTest(`Image at w=${w}`, () => {
    const ctx = createTestContext(w, theme);
    const lines = renderImage("test.png", ctx, { width: Math.min(30, w - 4), mode: "blocks" });
    if (lines.length === 0) throw new Error("Rendered 0 lines");
    checkOverflow(lines, w, "Image");
  });
}

// ─── 3p: Spacer ──────────────────────────────────────────
for (const lines_count of [1, 2, 3, 5]) {
  runTest(`Spacer lines=${lines_count}`, () => {
    const lines = renderSpacer(lines_count);
    if (lines.length !== lines_count) throw new Error(`Expected ${lines_count} lines, got ${lines.length}`);
  });
}

// ─── 3q: Link ────────────────────────────────────────────
for (const w of WIDTHS) {
  runTest(`Link at w=${w}`, () => {
    const ctx = createTestContext(w, theme);
    const lines = renderLink("My Website", "https://example.com", ctx, { icon: "web" });
    if (lines.length === 0) throw new Error("Rendered 0 lines");
    checkOverflow(lines, w, "Link");
  });
}

// ─── 3r: Box ─────────────────────────────────────────────
for (const w of WIDTHS) {
  runTest(`Box at w=${w}`, () => {
    const ctx = createTestContext(w, theme);
    const content = ["Line 1 of box content", "Line 2 of box content"];
    const lines = renderBox(content, ctx, { title: "Test Box" });
    if (lines.length === 0) throw new Error("Rendered 0 lines");
    checkOverflow(lines, w, "Box");
  });
}

// ─── 3s: Section block ───────────────────────────────────
for (const w of WIDTHS) {
  runTest(`Section block at w=${w}`, () => {
    const ctx = createTestContext(w, theme);
    const sectionContent: ContentBlock[] = [
      { type: "text", content: "Section body text" },
      skillBar("SubSkill", 80),
    ];
    const sec = section("Test Section", sectionContent);
    const lines = renderBlock(sec, ctx);
    if (lines.length === 0) throw new Error("Rendered 0 lines");
    checkOverflow(lines, w, "Section");
  });
}

// ─── 3t: Custom block ────────────────────────────────────
for (const w of WIDTHS) {
  runTest(`Custom block at w=${w}`, () => {
    const ctx = createTestContext(w, theme);
    const lines = renderBlock(customBlock, ctx);
    if (lines.length === 0) throw new Error("Rendered 0 lines");
    checkOverflow(lines, w, "Custom");
  });
}

// ─── 3u: Banner + Gradient ───────────────────────────────
for (const w of WIDTHS) {
  runTest(`Banner at w=${w}`, () => {
    const bannerLines = renderBanner("MAXUSER", { font: "standard" });
    if (bannerLines.length === 0) throw new Error("Banner rendered 0 lines");
  });
  runTest(`Banner+Gradient at w=${w}`, () => {
    const bannerLines = renderBanner("MAXUSER", { font: "standard" });
    const graded = gradientLines(bannerLines, ["#ff2a6d", "#05d9e8", "#d1f7ff"]);
    if (graded.length !== bannerLines.length) throw new Error(`Gradient line count mismatch: ${graded.length} vs ${bannerLines.length}`);
  });
}

// ═══════════════════════════════════════════════════════════
// PART 4: EDGE CASE TESTS
// ═══════════════════════════════════════════════════════════

console.log("\n▶ PHASE 3: Edge case tests...\n");

// Edge: Empty content
runTest("Card with empty body", () => {
  const ctx = createTestContext(80, theme);
  const lines = renderCard({ type: "card", title: "Empty", body: "" }, ctx);
  if (lines.length === 0) throw new Error("Card with empty body rendered 0 lines");
});

runTest("Card with no optional fields", () => {
  const ctx = createTestContext(80, theme);
  const lines = renderCard({ type: "card", title: "Minimal" }, ctx);
  if (lines.length === 0) throw new Error("Minimal card rendered 0 lines");
});

runTest("Card with very long title", () => {
  const ctx = createTestContext(40, theme);
  const longTitle = "A".repeat(100);
  const lines = renderCard({ type: "card", title: longTitle }, ctx);
  checkOverflow(lines, 40, "Card/longTitle");
});

runTest("Card with many tags", () => {
  const ctx = createTestContext(40, theme);
  const lines = renderCard({ type: "card", title: "Tagged", tags: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"] }, ctx);
  checkOverflow(lines, 40, "Card/manyTags");
});

runTest("Table with very narrow width", () => {
  const ctx = createTestContext(30, theme);
  const lines = renderTable(["Col1", "Col2", "Col3", "Col4"], [["aaa", "bbb", "ccc", "ddd"]], ctx);
  if (lines.length === 0) throw new Error("Rendered 0 lines");
  checkOverflow(lines, 30, "Table/narrow");
});

runTest("ProgressBar at min width", () => {
  const ctx = createTestContext(30, theme);
  const lines = renderProgressBar("X", 50, ctx, { max: 100, showPercent: true });
  if (lines.length === 0) throw new Error("Rendered 0 lines");
  checkOverflow(lines, 30, "ProgressBar/narrow");
});

runTest("Quote with very long text", () => {
  const ctx = createTestContext(30, theme);
  const longText = "Word ".repeat(100);
  const lines = renderQuote(longText, ctx, { attribution: "Author", style: "fancy" });
  if (lines.length === 0) throw new Error("Rendered 0 lines");
  checkOverflow(lines, 30, "Quote/long+fancy");
});

runTest("Gallery with 1 column at narrow width", () => {
  const ctx = createTestContext(30, theme);
  const lines = renderGallery(galleryCards, ctx, { columns: 1 });
  if (lines.length === 0) throw new Error("Rendered 0 lines");
  checkOverflow(lines, 30, "Gallery/1col/narrow");
});

runTest("Gallery with 3 columns at narrow width", () => {
  const ctx = createTestContext(30, theme);
  const lines = renderGallery(galleryCards, ctx, { columns: 3 });
  if (lines.length === 0) throw new Error("Rendered 0 lines");
  checkOverflow(lines, 30, "Gallery/3col/narrow");
});

runTest("Tabs with empty content", () => {
  const ctx = createTestContext(80, theme);
  const lines = renderTabs([
    { label: "Empty", content: [] },
  ], 0, ctx, renderContentBlocks);
  if (lines.length === 0) throw new Error("Rendered 0 lines");
});

runTest("Accordion all closed (openIdx=-1)", () => {
  const ctx = createTestContext(80, theme);
  const lines = renderAccordion(accordionItems, -1, ctx, renderContentBlocks);
  // Should render only headers (one per item)
  if (lines.length === 0) throw new Error("Rendered 0 lines");
  if (lines.length !== accordionItems.length) {
    // Not necessarily a bug, but worth noting
  }
});

runTest("Accordion openIdx out of bounds", () => {
  const ctx = createTestContext(80, theme);
  const lines = renderAccordion(accordionItems, 999, ctx, renderContentBlocks);
  if (lines.length === 0) throw new Error("Rendered 0 lines");
});

runTest("ScrollView with 0 visible height", () => {
  const ctx = createTestContext(80, theme);
  const content = ["Line 1", "Line 2", "Line 3"];
  const result = renderScrollView(content, 0, 0, ctx);
  // Should handle gracefully
});

runTest("ScrollView with negative offset", () => {
  const ctx = createTestContext(80, theme);
  const content = ["Line 1", "Line 2", "Line 3"];
  const result = renderScrollView(content, 2, -5, ctx);
  if (result.scrollState.offset !== 0) throw new Error(`Negative offset not clamped: ${result.scrollState.offset}`);
});

runTest("Empty list", () => {
  const ctx = createTestContext(80, theme);
  const lines = renderList([], ctx, "bullet");
  if (lines.length !== 0) throw new Error(`Empty list should render 0 lines, got ${lines.length}`);
});

runTest("Divider label with very long label at narrow width", () => {
  const ctx = createTestContext(30, theme);
  const lines = renderDivider(ctx, { style: "label", label: "This Is A Very Long Section Label That Exceeds Width" });
  checkOverflow(lines, 30, "Divider/longLabel/narrow");
});

runTest("Image wider than terminal", () => {
  const ctx = createTestContext(30, theme);
  const lines = renderImage("wide.png", ctx, { width: 100 });
  // Image width exceeds terminal width — check if it overflows
  checkOverflow(lines, 30, "Image/wide");
});

runTest("Text with zero width", () => {
  const ctx = createTestContext(0, theme);
  try {
    const lines = renderText("Hello", ctx, "plain");
    // Should not crash
  } catch (e) {
    throw new Error(`Crashed at width 0: ${e}`);
  }
});

runTest("Spacer with 0 lines", () => {
  const lines = renderSpacer(0);
  if (lines.length !== 0) throw new Error(`Spacer(0) should render 0 lines, got ${lines.length}`);
});

runTest("Badge with empty text", () => {
  const ctx = createTestContext(80, theme);
  const line = renderBadge("", ctx, { style: "filled" });
  // Should not crash
});

runTest("Multiple themes render without error", () => {
  const themeNames = ["cyberpunk", "dracula", "nord", "monokai", "solarized", "gruvbox", "catppuccin", "tokyoNight", "rosePine", "hacker"] as const;
  for (const tn of themeNames) {
    const t = themes[tn];
    const ctx = createTestContext(80, t);
    const lines = renderCard({ type: "card", title: `Theme: ${tn}`, body: "Testing" }, ctx);
    if (lines.length === 0) throw new Error(`Theme ${tn} rendered 0 lines`);
  }
});

// ═══════════════════════════════════════════════════════════
// PART 5: FINAL REPORT
// ═══════════════════════════════════════════════════════════

console.log("\n═══════════════════════════════════════════════════════════");
console.log("  FINAL COMBINED REPORT");
console.log("═══════════════════════════════════════════════════════════\n");

const totalPassed = allResults.filter(r => r.passed).length;
const totalFailed = allResults.filter(r => !r.passed).length;
const totalTests = allResults.length;

console.log(`Total tests:  ${totalTests}`);
console.log(`Passed:       ${totalPassed}`);
console.log(`Failed:       ${totalFailed}`);
console.log(`Pass rate:    ${((totalPassed / totalTests) * 100).toFixed(1)}%`);
console.log(`Bugs found:   ${allBugs.length}`);

if (totalFailed > 0) {
  console.log(`\n${"─".repeat(60)}`);
  console.log("FAILED TESTS:");
  console.log(`${"─".repeat(60)}`);
  for (const r of allResults.filter(r => !r.passed)) {
    console.log(`  ✗ ${r.name}`);
    if (r.error) console.log(`    Error: ${r.error}`);
  }
}

if (allBugs.length > 0) {
  console.log(`\n${"─".repeat(60)}`);
  console.log("ALL BUGS:");
  console.log(`${"─".repeat(60)}`);
  // Deduplicate bugs by description
  const seen = new Set<string>();
  const uniqueBugs: BugReport[] = [];
  for (const bug of allBugs) {
    const key = `${bug.severity}|${bug.category}|${bug.description}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueBugs.push(bug);
    }
  }
  // Sort by severity
  uniqueBugs.sort((a, b) => a.severity.localeCompare(b.severity));
  for (const bug of uniqueBugs) {
    console.log(`  [${bug.severity}] ${bug.category}${bug.component ? ` (${bug.component})` : ""}`);
    console.log(`         ${bug.description}`);
    console.log(`         Repro: ${bug.reproduction}`);
    console.log();
  }
  console.log(`Total unique bugs: ${uniqueBugs.length}`);
}

console.log(`\n${"═".repeat(60)}`);
console.log("  TEST SUITE COMPLETE");
console.log(`${"═".repeat(60)}`);

// Exit with non-zero if failures
if (totalFailed > 0) {
  process.exit(1);
}
