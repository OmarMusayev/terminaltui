/**
 * Test 08 — Conference/Event Site
 * Theme: cyberpunk
 * Tests: hero, schedule timeline, speaker cards, venue markdown,
 *        sponsors table, registration hero, banner, animations
 */
import {
  testSiteConfig,
  formatReport,
  createTestContext,
  renderBlock,
  assertNoThrow,
  assertLines,
  assertLinesNonEmpty,
  assertNoOverflow,
  assert,
  defineSite,
  page,
  card,
  timeline,
  table,
  list,
  quote,
  hero,
  markdown,
  divider,
  spacer,
  link,
  themes,
  type TestResult,
  type BugReport,
} from "../harness.js";

import { renderTimeline } from "../../src/components/Timeline.js";
import { renderCard } from "../../src/components/Card.js";
import { renderTable } from "../../src/components/Table.js";
import { renderHero } from "../../src/components/Hero.js";
import { renderLink } from "../../src/components/Link.js";
import { stripAnsi } from "../../src/components/base.js";
import type { TimelineItem } from "../../src/config/types.js";

// ─── Conference Site Config ───────────────────────────────

const conferenceConfig = {
  name: "DevConf 2026",
  tagline: "The Future of Developer Tooling",
  banner: {
    text: "DEVCONF",
    font: "ANSI Shadow",
    gradient: ["#ff2a6d", "#05d9e8"],
  },
  theme: "cyberpunk" as const,
  animations: {
    boot: true,
    
  },
  pages: [
    page("home", {
      title: "Home",
      icon: "\u2302",
      content: [
        hero({
          title: "DevConf 2026",
          subtitle: "March 21-23, 2026 \u00b7 Neo Tokyo Convention Center",
          cta: { label: "Register Now", url: "https://devconf2026.io/register" },
        }),
        divider("label", "What to Expect"),
        list([
          "3 days of cutting-edge talks",
          "50+ speakers from across the globe",
          "Hands-on workshops and hackathons",
          "Networking with 2000+ developers",
          "After-party at the Neon Arcade",
        ], "arrow"),
      ],
    }),

    page("schedule", {
      title: "Schedule",
      icon: "\ud83d\udcc5",
      content: [
        divider("label", "Day 1 \u2014 March 21"),
        timeline([
          { title: "Opening Keynote", subtitle: "Dr. Ada Lovelace", period: "09:00 - 10:00", description: "Welcome to DevConf 2026. A look at what the future holds for developer tooling, AI-assisted coding, and the next generation of programming languages." },
          { title: "Rust in Production", subtitle: "Kai Nakamura", period: "10:30 - 11:15", description: "How we migrated our 2M line C++ codebase to Rust and lived to tell the tale. Performance benchmarks, safety improvements, and lessons learned." },
          { title: "The WebAssembly Revolution", subtitle: "Maria Chen", period: "11:30 - 12:15", description: "WASM is eating the world. From browsers to edge computing to blockchain, we explore the expanding frontier of WebAssembly." },
          { title: "Lunch Break", period: "12:15 - 13:30", description: "Catered lunch in the Exhibition Hall. Visit sponsor booths and demos." },
          { title: "TUI Frameworks: Terminal Renaissance", subtitle: "Omar Jandali", period: "13:30 - 14:15", description: "The terminal is making a comeback. Modern TUI frameworks are bringing rich, interactive experiences to the command line." },
        ]),
        divider("label", "Day 2 \u2014 March 22"),
        timeline([
          { title: "AI-Powered IDEs", subtitle: "Sarah Kim", period: "09:00 - 09:45", description: "How large language models are transforming the way developers write, review, and debug code." },
          { title: "Zero-Trust Architecture", subtitle: "James Webb", period: "10:00 - 10:45", description: "Building secure systems in an era where the network perimeter no longer exists. Practical patterns for zero-trust." },
          { title: "Serverless at Scale", subtitle: "Priya Sharma", period: "11:00 - 11:45", description: "Running 10 billion serverless invocations per day: architecture, monitoring, and cost optimization strategies." },
          { title: "Workshop: Building TUIs", subtitle: "Omar Jandali", period: "13:00 - 16:00", description: "Hands-on workshop where you build your own terminal user interface from scratch using modern frameworks." },
          { title: "Lightning Talks", period: "16:30 - 18:00", description: "10 rapid-fire talks covering emerging technologies, open source projects, and developer culture." },
        ]),
        divider("label", "Day 3 \u2014 March 23"),
        timeline([
          { title: "Quantum Computing for Devs", subtitle: "Dr. Riku Tanaka", period: "09:00 - 09:45", description: "A practical introduction to quantum computing concepts that every developer should understand." },
          { title: "DevOps is Dead, Long Live Platform Engineering", subtitle: "Alex Rivera", period: "10:00 - 10:45", description: "The evolution from DevOps to Platform Engineering: internal developer platforms, golden paths, and self-service infrastructure." },
          { title: "The Ethics of AI Code Generation", subtitle: "Prof. Maya Johnson", period: "11:00 - 11:45", description: "Examining the ethical implications of AI-generated code: licensing, attribution, bias, and developer responsibility." },
          { title: "Closing Keynote: Developer Experience in 2030", subtitle: "Panel Discussion", period: "14:00 - 15:30", description: "A panel of industry leaders discuss what development will look like in 2030. Audience Q&A included." },
          { title: "After-Party at Neon Arcade", period: "19:00 - Late", description: "Celebrate with fellow developers at the Neon Arcade. Retro games, neon lights, cyberpunk vibes, and open bar." },
        ]),
      ],
    }),

    page("speakers", {
      title: "Speakers",
      icon: "\ud83c\udf99\ufe0f",
      content: [
        divider("label", "Featured Speakers"),
        card({ title: "Dr. Ada Lovelace", subtitle: "Chief Scientist, NeuroCode", body: "Pioneer in AI-assisted development tools. Previously led research at DeepMind and Google Brain. Author of 'The Algorithmic Mind'.", tags: ["AI", "Developer Tools", "Keynote"] }),
        card({ title: "Kai Nakamura", subtitle: "Staff Engineer, CyberForge", body: "Rust evangelist and systems programmer with 15 years of experience in high-performance computing. Core contributor to the Tokio async runtime.", tags: ["Rust", "Systems Programming"] }),
        card({ title: "Maria Chen", subtitle: "WebAssembly Lead, Cloudflare", body: "Leading the charge on WebAssembly adoption at the edge. Co-author of the WASI specification and contributor to the Wasmtime runtime.", tags: ["WebAssembly", "Edge Computing"] }),
        card({ title: "Omar Jandali", subtitle: "Creator, terminaltui", body: "Building the future of terminal interfaces. Full-stack developer with a passion for developer experience and beautiful command-line tools.", tags: ["TUI", "Developer Experience", "Open Source"] }),
        card({ title: "Sarah Kim", subtitle: "VP Engineering, CodePilot AI", body: "Former Google engineer now leading the team building next-generation AI coding assistants. Expert in LLM fine-tuning for code.", tags: ["AI", "LLM", "IDEs"] }),
        card({ title: "James Webb", subtitle: "Security Architect, CipherShield", body: "20 years in cybersecurity. Designed zero-trust architectures for Fortune 500 companies. Regular speaker at DEF CON and Black Hat.", tags: ["Security", "Zero Trust"] }),
        card({ title: "Priya Sharma", subtitle: "Principal Engineer, HyperScale", body: "Architect of one of the world's largest serverless platforms. Expert in distributed systems, event-driven architecture, and cloud cost optimization.", tags: ["Serverless", "Cloud", "Scale"] }),
        card({ title: "Dr. Riku Tanaka", subtitle: "Quantum Research Lead, IBM Q", body: "Leading IBM's efforts to make quantum computing accessible to mainstream developers. Created the Qiskit developer education program.", tags: ["Quantum Computing", "Education"] }),
        card({ title: "Alex Rivera", subtitle: "Head of Platform, Spotify", body: "Built Spotify's internal developer platform serving 5000+ engineers. Advocate for golden paths and self-service infrastructure.", tags: ["Platform Engineering", "DevOps"] }),
        card({ title: "Prof. Maya Johnson", subtitle: "CS Department, MIT", body: "Researching the intersection of AI, ethics, and software engineering. Leading the AI Code Ethics Initiative at MIT.", tags: ["Ethics", "AI", "Academia"] }),
      ],
    }),

    page("venue", {
      title: "Venue",
      icon: "\ud83c\udfe2",
      content: [
        hero({
          title: "Neo Tokyo Convention Center",
          subtitle: "The most futuristic venue in Asia",
        }),
        markdown(`
## About the Venue

The Neo Tokyo Convention Center is a state-of-the-art facility located in the heart of Neo Tokyo's tech district. With its iconic cyberpunk architecture and cutting-edge AV systems, it's the perfect home for DevConf 2026.

### Facilities
- **Main Hall**: 3000-seat auditorium with holographic displays
- **Workshop Rooms**: 10 fully-equipped labs with high-speed networking
- **Exhibition Hall**: 5000 sq meters of sponsor and demo space
- **Lounge Areas**: Quiet zones for networking and hacking

### Getting There
The venue is a 5-minute walk from Neo Tokyo Station (Neon Line). Airport shuttle service runs every 30 minutes from Narita and Haneda airports.
        `),
        spacer(),
        link("View on Google Maps", "https://maps.google.com/neo-tokyo-convention", { icon: "\ud83d\uddfa\ufe0f" }),
      ],
    }),

    page("sponsors", {
      title: "Sponsors",
      icon: "\ud83c\udfc6",
      content: [
        divider("label", "Our Sponsors"),
        table(
          ["Sponsor", "Tier", "Website"],
          [
            ["CyberForge Inc.", "Platinum", "cyberforge.io"],
            ["NeuroCode AI", "Platinum", "neurocode.ai"],
            ["HyperScale Cloud", "Gold", "hyperscale.cloud"],
            ["Cloudflare", "Gold", "cloudflare.com"],
            ["CipherShield", "Silver", "ciphershield.io"],
            ["Qiskit by IBM", "Silver", "qiskit.org"],
            ["NeonDB", "Bronze", "neondb.dev"],
            ["TerminalCraft", "Bronze", "terminalcraft.io"],
          ]
        ),
        spacer(),
        quote("Sponsoring DevConf is the best investment we make all year. The quality of attendees and the energy of the event is unmatched.", "CyberForge CEO"),
      ],
    }),

    page("register", {
      title: "Register",
      icon: "\ud83c\udf9f\ufe0f",
      content: [
        hero({
          title: "Join Us at DevConf 2026",
          subtitle: "Early bird pricing ends February 28, 2026",
          cta: { label: "Get Your Ticket", url: "https://devconf2026.io/register" },
        }),
        divider("label", "What's Included"),
        list([
          "Full 3-day conference access",
          "All keynotes and breakout sessions",
          "Hands-on workshop participation",
          "Lunch and refreshments daily",
          "Conference swag bag",
          "Access to the after-party",
          "30-day replay access to all recorded sessions",
          "Exclusive Discord community access",
        ], "check"),
        spacer(),
        divider("label", "Pricing"),
        list([
          "Early Bird: $299 (until Feb 28)",
          "Regular: $499",
          "VIP: $999 (front row + speaker dinner)",
          "Student: $99 (with valid ID)",
        ], "arrow"),
      ],
    }),
  ],
};

// ─── Run Standard Site Tests ──────────────────────────────

const report = testSiteConfig(conferenceConfig, "DevConf 2026 — Conference Site");
const extraResults: TestResult[] = [];
const extraBugs: BugReport[] = [];

const cyberpunkTheme = themes.cyberpunk;

// ─── Extra Test: Timeline at Various Widths ───────────────

const scheduleItems: TimelineItem[] = [
  { title: "Opening Keynote", subtitle: "Dr. Ada Lovelace", period: "09:00 - 10:00", description: "Welcome to DevConf 2026." },
  { title: "Rust in Production", subtitle: "Kai Nakamura", period: "10:30 - 11:15", description: "How we migrated our codebase to Rust." },
  { title: "The WebAssembly Revolution", subtitle: "Maria Chen", period: "11:30 - 12:15", description: "WASM is eating the world." },
  { title: "Lunch Break", period: "12:15 - 13:30", description: "Catered lunch." },
  { title: "TUI Frameworks", subtitle: "Omar Jandali", period: "13:30 - 14:15", description: "The terminal is making a comeback." },
  { title: "AI-Powered IDEs", subtitle: "Sarah Kim", period: "09:00 - 09:45", description: "LLMs transforming code." },
  { title: "Zero-Trust Architecture", subtitle: "James Webb", period: "10:00 - 10:45", description: "Building secure systems." },
  { title: "Serverless at Scale", subtitle: "Priya Sharma", period: "11:00 - 11:45", description: "10 billion invocations per day." },
  { title: "Workshop: Building TUIs", subtitle: "Omar Jandali", period: "13:00 - 16:00", description: "Hands-on workshop." },
  { title: "Lightning Talks", period: "16:30 - 18:00", description: "10 rapid-fire talks." },
  { title: "Quantum Computing for Devs", subtitle: "Dr. Riku Tanaka", period: "09:00 - 09:45", description: "Practical intro to quantum." },
  { title: "Platform Engineering", subtitle: "Alex Rivera", period: "10:00 - 10:45", description: "The evolution from DevOps." },
  { title: "Ethics of AI Code Gen", subtitle: "Prof. Maya Johnson", period: "11:00 - 11:45", description: "Ethical implications." },
  { title: "Closing Keynote", subtitle: "Panel Discussion", period: "14:00 - 15:30", description: "Developer Experience in 2030." },
  { title: "After-Party", period: "19:00 - Late", description: "Neon Arcade celebration." },
];

for (const width of [40, 60, 80]) {
  const ctx = createTestContext(width, cyberpunkTheme);
  extraResults.push(assertNoThrow(() => {
    const lines = renderTimeline(scheduleItems, ctx);
    assert(lines.length > 0, `Timeline with 15 items should produce output at width ${width}`);

    // Check connector lines align: every line starting with connector (│) should have it at position 2
    for (let i = 0; i < lines.length; i++) {
      const plain = stripAnsi(lines[i]);
      // Connector lines should have │ at consistent position
      if (plain.trimStart().startsWith("\u2502")) {
        const pipeIdx = plain.indexOf("\u2502");
        assert(pipeIdx <= 3, `Connector at line ${i} should be within first 3 chars, got position ${pipeIdx}`);
      }
    }
  }, `Timeline 15 items — connector alignment at width ${width}`));
}

// ─── Extra Test: Timeline Long Description (200+ chars) ───

{
  const longDesc = "This is a deliberately long description that exceeds two hundred characters to test word wrapping behavior in the timeline component. It contains multiple sentences and should be properly wrapped to fit within the available width without any overflow or truncation issues occurring during rendering.";
  const longItem: TimelineItem[] = [
    { title: "Long Talk", subtitle: "Speaker", period: "10:00 - 11:00", description: longDesc },
  ];

  for (const width of [40, 60, 80]) {
    const ctx = createTestContext(width, cyberpunkTheme);
    extraResults.push(assertNoThrow(() => {
      const lines = renderTimeline(longItem, ctx);
      assert(lines.length > 0, "Long description timeline should produce output");

      // Verify word wrapping happened: description should span multiple lines
      const descLines = lines.filter(l => {
        const plain = stripAnsi(l);
        return plain.includes("\u2502") && !plain.includes("Long Talk") && !plain.includes("10:00");
      });
      assert(descLines.length > 1, `Description (${longDesc.length} chars) should wrap into multiple lines at width ${width}, got ${descLines.length} lines`);

      // Verify no overflow
      for (const line of lines) {
        const plainLen = stripAnsi(line).length;
        assert(plainLen <= width + 2, `Line overflows at width ${width}: ${plainLen} chars`);
      }
    }, `Timeline long description (${longDesc.length} chars) wrapping at width ${width}`));
  }
}

// ─── Extra Test: Timeline with Missing Fields ─────────────

{
  const sparseItems: TimelineItem[] = [
    { title: "Title Only" },
    { title: "Title and Subtitle", subtitle: "Some Subtitle" },
    { title: "Title and Period", period: "10:00 - 11:00" },
    { title: "Title and Description", description: "Just a description with no other fields." },
    { title: "Full Item", subtitle: "Speaker", period: "12:00 - 13:00", description: "Everything is present." },
  ];

  const ctx = createTestContext(80, cyberpunkTheme);
  extraResults.push(assertNoThrow(() => {
    const lines = renderTimeline(sparseItems, ctx);
    assert(lines.length > 0, "Sparse timeline should produce output");

    // Verify title-only item produces at least one line
    const titleOnlyLines = lines.filter(l => stripAnsi(l).includes("Title Only"));
    assert(titleOnlyLines.length >= 1, "Title-only item should appear in output");

    // Verify no crashes
  }, "Timeline with missing fields (no subtitle, no period, no description)"));
}

// ─── Extra Test: 10 Speaker Cards in Sequence ─────────────

{
  const speakerCards = [
    { title: "Dr. Ada Lovelace", subtitle: "Chief Scientist, NeuroCode", body: "Pioneer in AI-assisted development.", tags: ["AI", "Keynote"] },
    { title: "Kai Nakamura", subtitle: "Staff Engineer, CyberForge", body: "Rust evangelist and systems programmer.", tags: ["Rust"] },
    { title: "Maria Chen", subtitle: "WebAssembly Lead, Cloudflare", body: "Leading WASM adoption at the edge.", tags: ["WebAssembly"] },
    { title: "Omar Jandali", subtitle: "Creator, terminaltui", body: "Building the future of terminal interfaces.", tags: ["TUI", "Open Source"] },
    { title: "Sarah Kim", subtitle: "VP Engineering, CodePilot AI", body: "Building next-gen AI coding assistants.", tags: ["AI", "LLM"] },
    { title: "James Webb", subtitle: "Security Architect, CipherShield", body: "20 years in cybersecurity.", tags: ["Security"] },
    { title: "Priya Sharma", subtitle: "Principal Engineer, HyperScale", body: "Architect of the largest serverless platform.", tags: ["Serverless", "Cloud"] },
    { title: "Dr. Riku Tanaka", subtitle: "Quantum Research Lead, IBM Q", body: "Making quantum computing accessible.", tags: ["Quantum Computing"] },
    { title: "Alex Rivera", subtitle: "Head of Platform, Spotify", body: "Built Spotify's internal developer platform.", tags: ["Platform Engineering"] },
    { title: "Prof. Maya Johnson", subtitle: "CS Department, MIT", body: "AI, ethics, and software engineering.", tags: ["Ethics", "AI"] },
  ];

  const ctx = createTestContext(80, cyberpunkTheme);
  let totalCardLines = 0;

  for (let i = 0; i < speakerCards.length; i++) {
    const sp = speakerCards[i];
    extraResults.push(assertNoThrow(() => {
      const lines = renderCard({ type: "card", ...sp }, ctx);
      assert(lines.length > 0, `Speaker card ${i + 1} should produce output`);
      totalCardLines += lines.length;

      // Verify card contains the speaker name
      const hasName = lines.some(l => stripAnsi(l).includes(sp.title));
      assert(hasName, `Speaker card should contain name "${sp.title}"`);

      // Verify tags are rendered
      if (sp.tags) {
        const hasTag = lines.some(l => stripAnsi(l).includes(sp.tags![0]));
        assert(hasTag, `Speaker card should contain tag "${sp.tags[0]}"`);
      }
    }, `Speaker card ${i + 1}: ${sp.title}`));
  }
}

// ─── Extra Test: Sponsors Table at Width 40 ───────────────

{
  const headers = ["Sponsor", "Tier", "Website"];
  const rows = [
    ["CyberForge Inc.", "Platinum", "cyberforge.io"],
    ["NeuroCode AI", "Platinum", "neurocode.ai"],
    ["HyperScale Cloud", "Gold", "hyperscale.cloud"],
    ["Cloudflare", "Gold", "cloudflare.com"],
    ["CipherShield", "Silver", "ciphershield.io"],
    ["Qiskit by IBM", "Silver", "qiskit.org"],
    ["NeonDB", "Bronze", "neondb.dev"],
    ["TerminalCraft", "Bronze", "terminalcraft.io"],
  ];

  const ctx = createTestContext(40, cyberpunkTheme);
  extraResults.push(assertNoThrow(() => {
    const lines = renderTable(headers, rows, ctx);
    assert(lines.length > 0, "Table should produce output at width 40");

    // 8 data rows + 1 header row + 3 border lines (top, header-sep, bottom) = 12
    assert(lines.length >= 12, `Table should have at least 12 lines (got ${lines.length}): 8 data + 1 header + 3 borders`);

    // Verify all 3 column headers appear
    const headerLine = lines[1]; // first data line after top border
    for (const h of headers) {
      assert(stripAnsi(headerLine).includes(h), `Header "${h}" should appear in header row`);
    }

    // Verify 8 data rows
    let dataRowCount = 0;
    for (const line of lines) {
      const plain = stripAnsi(line);
      // Data rows contain sponsor names
      if (rows.some(r => plain.includes(r[0]))) {
        dataRowCount++;
      }
    }
    assert(dataRowCount === 8, `Should have 8 data rows, got ${dataRowCount}`);
  }, "Sponsors table: 8 rows x 3 columns at width 40"));
}

// ─── Extra Test: Hero CTA Link Rendering ──────────────────

{
  const ctx = createTestContext(80, cyberpunkTheme);
  extraResults.push(assertNoThrow(() => {
    const lines = renderHero(
      {
        title: "DevConf 2026",
        subtitle: "March 21-23, 2026",
        cta: { label: "Register Now", url: "https://devconf2026.io/register" },
      },
      ctx
    );
    assert(lines.length > 0, "Hero with CTA should produce output");

    // CTA label should appear in output
    const hasCTA = lines.some(l => stripAnsi(l).includes("Register Now"));
    assert(hasCTA, "Hero should render CTA label 'Register Now'");

    // Title should appear
    const hasTitle = lines.some(l => stripAnsi(l).includes("DevConf 2026"));
    assert(hasTitle, "Hero should render title");

    // Subtitle should appear
    const hasSub = lines.some(l => stripAnsi(l).includes("March 21-23, 2026"));
    assert(hasSub, "Hero should render subtitle");
  }, "Hero CTA link rendering"));
}

// ─── Extra Test: Cyberpunk Theme Colors ───────────────────

{
  extraResults.push(assertNoThrow(() => {
    const theme = themes.cyberpunk;
    assert(theme.accent === "#ff2a6d", `Cyberpunk accent should be #ff2a6d, got ${theme.accent}`);
    assert(theme.text === "#05d9e8", `Cyberpunk text should be #05d9e8, got ${theme.text}`);
    assert(theme.bg === "#01012b", `Cyberpunk bg should be #01012b, got ${theme.bg}`);
    assert(theme.border === "#01579b", `Cyberpunk border should be #01579b, got ${theme.border}`);
    assert(theme.error === "#ff2a6d", `Cyberpunk error should be #ff2a6d, got ${theme.error}`);
    assert(theme.success === "#05d9e8", `Cyberpunk success should be #05d9e8, got ${theme.success}`);
    assert(theme.muted === "#0abdc6", `Cyberpunk muted should be #0abdc6, got ${theme.muted}`);
    assert(theme.subtle === "#01579b", `Cyberpunk subtle should be #01579b, got ${theme.subtle}`);
    assert(theme.warning === "#d1f7ff", `Cyberpunk warning should be #d1f7ff, got ${theme.warning}`);
    assert(theme.accentDim === "#b91d4f", `Cyberpunk accentDim should be #b91d4f, got ${theme.accentDim}`);
  }, "Cyberpunk theme color verification"));
}

// ─── Merge Extra Results & Print Report ───────────────────

report.results.push(...extraResults);
report.bugs.push(...extraBugs);
report.total += extraResults.length;
report.passed += extraResults.filter(r => r.passed).length;
report.failed += extraResults.filter(r => !r.passed).length;

console.log(formatReport(report));

// Summary line
const status = report.failed === 0 ? "ALL TESTS PASSED" : `${report.failed} TESTS FAILED`;
console.log(`\n${"=".repeat(60)}`);
console.log(`  ${status} (${report.passed}/${report.total})`);
if (report.bugs.length > 0) {
  console.log(`  ${report.bugs.length} bug(s) detected`);
}
console.log(`${"=".repeat(60)}\n`);
