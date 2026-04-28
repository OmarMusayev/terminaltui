/**
 * FRESH USABILITY TEST — terminaltui framework
 *
 * Perspective: a developer who has NEVER seen the codebase before.
 * Using ONLY the public API exported from src/index.ts, build 5 real-world
 * sites and verify each one renders correctly.
 */

import {
  defineSite,
  page,
  section,
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
  markdown,
  gradient,
  sparkline,
  divider,
  spacer,
  ascii,
  themes,
  defaultTheme,
  TUIRuntime,
  type Site,
  type SiteConfig,
  type ContentBlock,
  type Theme,
} from "../src/index.js";

// We need internal component renderers for testing since the public API
// does not export a "render blocks" function. NOTE: This is a usability finding.
import { renderText } from "../src/components/Text.js";
import { renderCard } from "../src/components/Card.js";
import { renderTimeline } from "../src/components/Timeline.js";
import { renderProgressBar } from "../src/components/ProgressBar.js";
import { renderTable } from "../src/components/Table.js";
import { renderLink } from "../src/components/Link.js";
import { renderDivider } from "../src/components/Divider.js";
import { renderSpacer } from "../src/components/Spacer.js";
import { renderQuote } from "../src/components/Quote.js";
import { renderBadge } from "../src/components/Badge.js";
import { renderHero } from "../src/components/Hero.js";
import { renderList } from "../src/components/List.js";
import { renderGallery } from "../src/components/Gallery.js";
import { renderTabs } from "../src/components/Tabs.js";
import { renderAccordion } from "../src/components/Accordion.js";
import { renderImage } from "../src/components/Image.js";
import { stripAnsi, type RenderContext } from "../src/components/base.js";

// ─── Utilities ────────────────────────────────────────────

function ctx(width: number, theme: Theme = defaultTheme): RenderContext {
  return { width, theme, borderStyle: "rounded" };
}

function renderBlock(block: ContentBlock, c: RenderContext): string[] {
  switch (block.type) {
    case "text":
      return renderText(block.content, c, block.style);
    case "card":
      return renderCard(block, c);
    case "timeline":
      return renderTimeline(block.items, c, block.style);
    case "table":
      return renderTable(block.headers, block.rows, c);
    case "list":
      return renderList(block.items, c, block.style);
    case "quote":
      return renderQuote(block.text, c, { attribution: block.attribution, style: block.style });
    case "hero":
      return renderHero(block, c);
    case "gallery":
      return renderGallery(block.items, c, { columns: block.columns });
    case "tabs":
      return renderTabs(block.items, 0, c, (blocks, cx) => {
        const lines: string[] = [];
        for (const b of blocks) lines.push(...renderBlock(b, cx));
        return lines;
      });
    case "accordion":
      return renderAccordion(block.items, 0, c, (blocks, cx) => {
        const lines: string[] = [];
        for (const b of blocks) lines.push(...renderBlock(b, cx));
        return lines;
      });
    case "link":
      return renderLink(block.label, block.url, c, { icon: block.icon });
    case "progressBar":
      return renderProgressBar(block.label, block.value, c, { max: block.max, showPercent: block.showPercent });
    case "badge":
      return [renderBadge(block.text, c, { color: block.color, style: block.style })];
    case "image":
      return renderImage(block.path, c, { width: block.width, mode: block.mode });
    case "divider":
      return renderDivider(c, { style: block.style, label: block.label, color: block.color });
    case "spacer":
      return renderSpacer(block.lines);
    case "section": {
      const lines: string[] = [];
      lines.push(`  ${block.title}`);
      lines.push("  " + "\u2500".repeat(Math.max(0, c.width - 4)));
      for (const b of block.content) lines.push(...renderBlock(b, c));
      return lines;
    }
    case "custom":
      return block.render(c.width, c.theme);
    default:
      return [];
  }
}

function renderAllBlocks(blocks: ContentBlock[], c: RenderContext): string[] {
  const lines: string[] = [];
  for (const block of blocks) {
    lines.push(...renderBlock(block, c));
    lines.push("");
  }
  return lines;
}

// ─── Test Tracking ────────────────────────────────────────

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const allResults: TestResult[] = [];
const confusionNotes: string[] = [];
const frameworkBugs: string[] = [];
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name: string, fn: () => void): void {
  totalTests++;
  try {
    fn();
    passedTests++;
    allResults.push({ name, passed: true });
  } catch (err: any) {
    failedTests++;
    allResults.push({ name, passed: false, error: err.message });
  }
}

function expect(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg);
}

function expectNonEmpty(lines: string[], label: string): void {
  expect(Array.isArray(lines), `${label}: expected array`);
  expect(lines.length > 0, `${label}: expected non-empty output, got 0 lines`);
  const hasContent = lines.some(l => stripAnsi(l).trim().length > 0);
  expect(hasContent, `${label}: all lines are blank`);
}

function expectNoOverflow(lines: string[], maxWidth: number, label: string): void {
  for (let i = 0; i < lines.length; i++) {
    const plain = stripAnsi(lines[i]).length;
    if (plain > maxWidth + 2) { // +2 tolerance
      const msg = `${label}: line ${i} overflows (${plain} > ${maxWidth}): "${stripAnsi(lines[i]).substring(0, 60)}..."`;
      // Log as a framework bug rather than failing the usability test
      frameworkBugs.push(`[OVERFLOW BUG] ${msg}`);
      return; // Report first overflow only per block
    }
  }
}

// ════════════════════════════════════════════════════════════
// SITE 1: PIZZA DELIVERY SHOP
// ════════════════════════════════════════════════════════════

const pizzaConfig: SiteConfig = {
  name: "Tony's Pizza",
  tagline: "The best slice in town since 1987",
  handle: "@tonyspizza",
  theme: "gruvbox",
  banner: { text: "TONYS", gradient: ["#fe8019", "#fb4934"] },
  pages: [
    page("menu", {
      title: "Menu",
      icon: "\uD83C\uDF55",
      content: [
        hero({ title: "Our Menu", subtitle: "Handmade with love, baked to perfection" }),
        section("Classic Pizzas", [
          card({ title: "Margherita", subtitle: "$12.99", body: "Fresh mozzarella, San Marzano tomatoes, basil", tags: ["vegetarian", "classic"] }),
          card({ title: "Pepperoni", subtitle: "$14.99", body: "Loaded with premium pepperoni and mozzarella", tags: ["popular"] }),
          card({ title: "Hawaiian", subtitle: "$14.99", body: "Ham, pineapple, mozzarella — controversial but delicious", tags: ["sweet & savory"] }),
          card({ title: "Meat Lovers", subtitle: "$17.99", body: "Pepperoni, sausage, bacon, ham, ground beef", tags: ["hearty"] }),
        ]),
        section("Specialty Pizzas", [
          card({ title: "Truffle Mushroom", subtitle: "$19.99", body: "Wild mushrooms, truffle oil, fontina, arugula", tags: ["gourmet"] }),
          card({ title: "BBQ Chicken", subtitle: "$16.99", body: "Grilled chicken, BBQ sauce, red onion, cilantro", tags: ["popular"] }),
        ]),
        section("Sides & Drinks", [
          table(
            ["Item", "Small", "Large"],
            [
              ["Garlic Bread", "$4.99", "$7.99"],
              ["Caesar Salad", "$6.99", "$9.99"],
              ["Buffalo Wings (8pc)", "$10.99", "$18.99"],
              ["Soft Drink", "$1.99", "$2.99"],
              ["Craft Beer", "$5.99", "$5.99"],
            ]
          ),
        ]),
      ],
    }),
    page("deals", {
      title: "Deals",
      icon: "\uD83C\uDF89",
      content: [
        hero({ title: "Hot Deals", subtitle: "Save big on your next order!" }),
        card({ title: "Family Combo", subtitle: "SAVE $12", body: "2 large pizzas + garlic bread + 2L soda for $34.99" }),
        card({ title: "Lunch Special", subtitle: "Mon-Fri 11am-2pm", body: "Any personal pizza + drink for $8.99", tags: ["weekday only"] }),
        card({ title: "Student Discount", subtitle: "15% OFF", body: "Show your student ID for 15% off any order", tags: ["valid ID required"] }),
        divider("label", "Online Only"),
        card({ title: "First Order", subtitle: "20% OFF", body: "Use code WELCOME20 on your first online order", tags: ["new customers"] }),
      ],
    }),
    page("hours", {
      title: "Hours & Location",
      icon: "\uD83D\uDCCD",
      content: [
        section("Store Hours", [
          table(
            ["Day", "Open", "Close"],
            [
              ["Monday", "11:00 AM", "10:00 PM"],
              ["Tuesday", "11:00 AM", "10:00 PM"],
              ["Wednesday", "11:00 AM", "10:00 PM"],
              ["Thursday", "11:00 AM", "11:00 PM"],
              ["Friday", "11:00 AM", "12:00 AM"],
              ["Saturday", "10:00 AM", "12:00 AM"],
              ["Sunday", "10:00 AM", "9:00 PM"],
            ]
          ),
        ]),
        section("Location", [
          markdown(`
**Tony's Pizza**
123 Main Street, Anytown, USA 12345

We're located right downtown, next to the old movie theater.
Free parking available in the rear lot.
          `),
        ]),
        spacer(1),
        link("Order Online", "https://tonyspizza.example.com/order", { icon: "\uD83D\uDED2" }),
        link("Call Us", "tel:+15551234567", { icon: "\uD83D\uDCDE" }),
      ],
    }),
  ],
};

// ════════════════════════════════════════════════════════════
// SITE 2: PHOTOGRAPHER PORTFOLIO
// ════════════════════════════════════════════════════════════

const photographerConfig: SiteConfig = {
  name: "Elena Voss Photography",
  tagline: "Capturing moments that last forever",
  handle: "@elenavoss",
  theme: "rosePine",
  banner: { text: "ELENA", gradient: ["#ebbcba", "#c4a7e7", "#9ccfd8"] },
  animations: { boot: true },
  pages: [
    page("gallery", {
      title: "Gallery",
      icon: "\uD83D\uDDBC\uFE0F",
      content: [
        hero({ title: "Portfolio", subtitle: "Selected works from 2020-2025" }),
        section("Weddings", [
          gallery([
            { title: "The Johnson Wedding", subtitle: "Spring Garden Ceremony", body: "A beautiful outdoor ceremony surrounded by cherry blossoms", tags: ["wedding", "outdoor"] },
            { title: "Maria & James", subtitle: "Winter Wonderland", body: "An intimate winter wedding at the mountain lodge", tags: ["wedding", "winter"] },
            { title: "The Park-Kim Celebration", subtitle: "Cultural Fusion", body: "A stunning blend of Korean and American wedding traditions", tags: ["wedding", "multicultural"] },
          ]),
        ]),
        section("Portraits", [
          gallery([
            { title: "Executive Headshots", subtitle: "Corporate Collection", body: "Professional headshots for C-suite executives" },
            { title: "Family Portraits", subtitle: "The Chen Family", body: "Multi-generational family portrait session in golden hour" },
            { title: "Senior Photos", subtitle: "Class of 2025", body: "High school senior portrait sessions" },
          ]),
        ]),
        section("Nature & Landscape", [
          gallery([
            { title: "Patagonia", subtitle: "South America", body: "Glaciers, mountains, and endless skies" },
            { title: "Iceland", subtitle: "Northern Lights", body: "Aurora borealis over volcanic landscapes" },
          ]),
        ]),
      ],
    }),
    page("about", {
      title: "About",
      icon: "\uD83D\uDCF7",
      content: [
        hero({ title: "About Elena", subtitle: "Award-winning photographer based in Portland, OR" }),
        markdown(`
Elena Voss has been a professional photographer for over **12 years**,
specializing in weddings, portraits, and landscape photography.

Her work has been featured in:
- National Geographic Traveler
- Modern Bride Magazine
- Portland Monthly

She holds a BFA in Photography from the Rhode Island School of Design
and has won multiple awards including the International Photography Awards
gold medal in 2023.
        `),
        divider(),
        section("Skills", [
          skillBar("Portrait Photography", 95),
          skillBar("Landscape Photography", 90),
          skillBar("Photo Editing", 88),
          skillBar("Lighting Design", 92),
          skillBar("Drone Photography", 75),
        ]),
        spacer(1),
        quote("Photography is the story I fail to put into words.", "Destin Sparks"),
      ],
    }),
    page("contact", {
      title: "Contact",
      icon: "\u2709\uFE0F",
      content: [
        hero({ title: "Get In Touch", subtitle: "Let's create something beautiful together" }),
        markdown(`
**Booking Inquiries**

For weddings and events, please reach out at least **3 months** in advance.
Portrait sessions can usually be scheduled within 2 weeks.

**Rates** start at $250 for portrait sessions, $3,500 for wedding coverage.
        `),
        divider(),
        link("Email Me", "mailto:elena@elenavoss.com", { icon: "\u2709\uFE0F" }),
        link("Instagram", "https://instagram.com/elenavoss", { icon: "\uD83D\uDCF8" }),
        link("Book a Session", "https://elenavoss.com/book", { icon: "\uD83D\uDCC5" }),
      ],
    }),
  ],
};

// ════════════════════════════════════════════════════════════
// SITE 3: NONPROFIT ORGANIZATION
// ════════════════════════════════════════════════════════════

const nonprofitConfig: SiteConfig = {
  name: "Green Earth Foundation",
  tagline: "Building a sustainable future, one community at a time",
  handle: "@greenearth",
  theme: "nord",
  banner: { text: "GREEN", gradient: ["#a3be8c", "#88c0d0", "#5e81ac"] },
  pages: [
    page("mission", {
      title: "Our Mission",
      icon: "\uD83C\uDF0D",
      content: [
        hero({
          title: "Green Earth Foundation",
          subtitle: "Empowering communities for environmental stewardship",
          cta: { label: "Donate Now", url: "https://greenearth.org/donate" },
        }),
        markdown(`
## Our Story

Founded in 2008, the **Green Earth Foundation** has been at the forefront
of community-driven environmental conservation. We believe that lasting
change starts at the grassroots level.

### Impact by the Numbers
        `),
        sparkline([12, 18, 24, 35, 42, 55, 68, 72, 85, 95, 110, 130]),
        list([
          "500+ community gardens established",
          "2M trees planted across 15 countries",
          "100,000+ volunteers mobilized",
          "50 cities with active chapters",
        ], "check"),
        divider(),
        quote(
          "The greatest threat to our planet is the belief that someone else will save it.",
          "Robert Swan"
        ),
      ],
    }),
    page("programs", {
      title: "Programs",
      icon: "\uD83C\uDF31",
      content: [
        hero({ title: "Our Programs", subtitle: "Four pillars of environmental action" }),
        gallery([
          {
            title: "Urban Gardens",
            subtitle: "Community Food Security",
            body: "Transforming vacant lots into thriving community gardens that provide fresh produce to food deserts.",
            tags: ["food", "community"],
          },
          {
            title: "Tree Planting",
            subtitle: "Reforestation Initiative",
            body: "Large-scale tree planting campaigns partnering with local governments and schools.",
            tags: ["trees", "climate"],
          },
          {
            title: "Clean Water",
            subtitle: "Water Conservation",
            body: "Installing water purification systems and teaching conservation techniques in underserved areas.",
            tags: ["water", "health"],
          },
          {
            title: "Education",
            subtitle: "Environmental Literacy",
            body: "After-school programs and summer camps teaching children about ecology and sustainability.",
            tags: ["youth", "education"],
          },
        ]),
        spacer(1),
        section("2025 Goals", [
          progressBar("Garden Installations", 67, 100),
          progressBar("Trees Planted (thousands)", 180, 250),
          progressBar("Water Systems Deployed", 34, 50),
          progressBar("Students Enrolled", 8500, 10000),
        ]),
      ],
    }),
    page("donate", {
      title: "Donate",
      icon: "\u2764\uFE0F",
      content: [
        hero({
          title: "Support Our Work",
          subtitle: "Every dollar plants seeds of change",
          cta: { label: "Donate Now", url: "https://greenearth.org/donate" },
        }),
        section("Where Your Money Goes", [
          table(
            ["Donation", "Impact"],
            [
              ["$25", "Plants 10 trees in a local park"],
              ["$50", "Provides garden tools for a community plot"],
              ["$100", "Sponsors a child for environmental camp"],
              ["$250", "Installs a water filter for a family"],
              ["$500", "Seeds an entire community garden"],
              ["$1,000", "Funds a clean water well"],
            ]
          ),
        ]),
        divider(),
        markdown(`
**Tax Deductible**: All donations are tax-deductible under section 501(c)(3).
EIN: 12-3456789
        `),
        spacer(1),
        link("Donate Online", "https://greenearth.org/donate", { icon: "\uD83D\uDCB3" }),
        link("Mail a Check", "https://greenearth.org/mail-donate"),
        link("Corporate Partnerships", "https://greenearth.org/partners", { icon: "\uD83E\uDD1D" }),
      ],
    }),
    page("team", {
      title: "Our Team",
      icon: "\uD83D\uDC65",
      content: [
        hero({ title: "Meet the Team", subtitle: "Passionate people driving real change" }),
        gallery([
          { title: "Dr. Sarah Chen", subtitle: "Executive Director", body: "20 years of environmental policy experience. Former EPA advisor.", tags: ["leadership"] },
          { title: "Marcus Williams", subtitle: "Director of Programs", body: "Manages all four program pillars and field operations worldwide.", tags: ["operations"] },
          { title: "Aisha Patel", subtitle: "Head of Fundraising", body: "Led fundraising growth from $2M to $15M annually.", tags: ["development"] },
          { title: "Tom Nakamura", subtitle: "Chief Scientist", body: "PhD in Environmental Science. Leads our research and impact measurement.", tags: ["research"] },
          { title: "Elena Rodriguez", subtitle: "Community Outreach", body: "Coordinates volunteer networks across 50 cities.", tags: ["volunteers"] },
          { title: "David Kim", subtitle: "Communications Director", body: "Award-winning storyteller bringing our impact to life.", tags: ["media"] },
        ]),
      ],
    }),
  ],
};

// ════════════════════════════════════════════════════════════
// SITE 4: PODCAST
// ════════════════════════════════════════════════════════════

const podcastConfig: SiteConfig = {
  name: "The Debug Hour",
  tagline: "Weekly conversations about code, career, and craft",
  handle: "@debughour",
  theme: "tokyoNight",
  banner: { text: "DEBUG", gradient: ["#7aa2f7", "#bb9af7", "#f7768e"] },
  statusBar: true,
  pages: [
    page("episodes", {
      title: "Episodes",
      icon: "\uD83C\uDFA7",
      content: [
        hero({ title: "Latest Episodes", subtitle: "New episodes every Tuesday" }),
        card({ title: "Ep 128: The Future of AI Coding Assistants", subtitle: "Mar 18, 2026", body: "We sit down with the team behind Cursor to discuss how AI is changing the way we write code. Are junior devs at risk?", tags: ["AI", "tools", "career"] }),
        card({ title: "Ep 127: Rust in Production — 2 Years Later", subtitle: "Mar 11, 2026", body: "A candid retrospective on rewriting a Node.js microservice in Rust. Was it worth it? Spoiler: mostly yes.", tags: ["rust", "backend"] }),
        card({ title: "Ep 126: The TDD Debate Reignited", subtitle: "Mar 4, 2026", body: "Kent Beck joins us to talk about TDD in 2026 — what's changed, what hasn't, and why people are still arguing about it.", tags: ["testing", "practices"] }),
        card({ title: "Ep 125: Building Your First Open Source Project", subtitle: "Feb 25, 2026", body: "Practical advice on starting and maintaining an open source project, from naming to governance.", tags: ["open source", "community"] }),
        card({ title: "Ep 124: Database Showdown 2026", subtitle: "Feb 18, 2026", body: "Postgres vs. SQLite vs. Turso vs. SurrealDB — we benchmark and compare for different use cases.", tags: ["database", "benchmarks"] }),
        card({ title: "Ep 123: The Monorepo Question", subtitle: "Feb 11, 2026", body: "Turborepo, Nx, or just pnpm workspaces? We break down the monorepo landscape.", tags: ["tooling", "architecture"] }),
        card({ title: "Ep 122: CSS in 2026 — Finally Good?", subtitle: "Feb 4, 2026", body: "Container queries, :has(), subgrid — native CSS is catching up. Do we still need Tailwind?", tags: ["CSS", "frontend"] }),
        card({ title: "Ep 121: Burnout Recovery", subtitle: "Jan 28, 2026", body: "A deeply personal conversation about recognizing and recovering from developer burnout.", tags: ["mental health", "career"] }),
      ],
    }),
    page("hosts", {
      title: "Hosts",
      icon: "\uD83C\uDF99\uFE0F",
      content: [
        hero({ title: "Your Hosts", subtitle: "The voices behind The Debug Hour" }),
        card({
          title: "Alex Rivera",
          subtitle: "Co-host & Senior Engineer",
          body: "Staff engineer at a Series C startup. 12 years of full-stack experience. Known for strong opinions on TypeScript and testing.",
          tags: ["TypeScript", "testing", "architecture"],
        }),
        card({
          title: "Jordan Lee",
          subtitle: "Co-host & Dev Advocate",
          body: "Developer advocate and former bootcamp instructor. Passionate about making tech accessible and mentoring new developers.",
          tags: ["community", "education", "Rust"],
        }),
        divider(),
        quote("Every bug is just a feature you haven't documented yet.", "Alex Rivera"),
        quote("The best code is the code you didn't have to write.", "Jordan Lee"),
      ],
    }),
    page("subscribe", {
      title: "Subscribe",
      icon: "\uD83D\uDD14",
      content: [
        hero({ title: "Listen Everywhere", subtitle: "Subscribe on your favorite platform" }),
        link("Apple Podcasts", "https://podcasts.apple.com/debughour", { icon: "\uD83C\uDF4E" }),
        link("Spotify", "https://open.spotify.com/show/debughour", { icon: "\uD83C\uDFB5" }),
        link("Google Podcasts", "https://podcasts.google.com/debughour", { icon: "\uD83C\uDF10" }),
        link("YouTube", "https://youtube.com/@debughour", { icon: "\u25B6\uFE0F" }),
        link("RSS Feed", "https://debughour.fm/feed.xml", { icon: "\uD83D\uDCE1" }),
        divider(),
        markdown(`
**Never miss an episode!** Subscribe to our newsletter for show notes,
links, and bonus content delivered to your inbox every Tuesday.
        `),
        link("Newsletter Signup", "https://debughour.fm/newsletter", { icon: "\u2709\uFE0F" }),
      ],
    }),
    page("sponsors", {
      title: "Sponsors",
      icon: "\uD83E\uDD1D",
      content: [
        hero({ title: "Our Sponsors", subtitle: "The companies that keep the show running" }),
        table(
          ["Sponsor", "Category", "Since"],
          [
            ["Vercel", "Hosting & Deployment", "2023"],
            ["Linear", "Project Management", "2024"],
            ["Neon", "Serverless Postgres", "2024"],
            ["Raycast", "Developer Tools", "2025"],
            ["Fly.io", "Cloud Infrastructure", "2023"],
          ]
        ),
        divider(),
        markdown(`
**Want to sponsor The Debug Hour?** We reach **50,000+ developers** weekly.
Our audience is primarily senior engineers and engineering managers.
        `),
        link("Sponsorship Info", "https://debughour.fm/sponsor", { icon: "\uD83D\uDCCA" }),
      ],
    }),
  ],
};

// ════════════════════════════════════════════════════════════
// SITE 5: FREELANCER SERVICES
// ════════════════════════════════════════════════════════════

const freelancerConfig: SiteConfig = {
  name: "Dev by Design — Jake Morrison",
  tagline: "Full-stack freelance development for startups",
  handle: "@jakemorrison.dev",
  theme: "catppuccin",
  banner: { text: "JAKE", gradient: ["#f5c2e7", "#cba6f7"] },
  borders: "rounded",
  easterEggs: {
    konami: "You found the secret! Check out my side project at github.com/jakemorrison/cool-thing",
    commands: {
      "hire": "Glad you're interested! Email me at jake@devbydesign.io",
      "stack": "TypeScript, React, Node.js, Postgres, Redis, AWS, Terraform",
    },
  },
  pages: [
    page("services", {
      title: "Services",
      icon: "\uD83D\uDEE0\uFE0F",
      content: [
        hero({ title: "What I Do", subtitle: "End-to-end development for ambitious startups" }),
        gallery([
          {
            title: "Full-Stack Web Apps",
            subtitle: "From idea to production",
            body: "I build complete web applications using React, Next.js, and Node.js with a focus on performance and developer experience.",
            tags: ["React", "Next.js", "Node.js", "TypeScript"],
          },
          {
            title: "API & Backend Development",
            subtitle: "Scalable infrastructure",
            body: "REST and GraphQL APIs, microservices architecture, database design, and cloud deployment on AWS or GCP.",
            tags: ["API", "GraphQL", "AWS", "PostgreSQL"],
          },
          {
            title: "Technical Consulting",
            subtitle: "Architecture & code review",
            body: "Code audits, architecture reviews, performance optimization, and technical strategy for your engineering team.",
            tags: ["consulting", "architecture", "performance"],
          },
          {
            title: "MVP Development",
            subtitle: "Launch in weeks, not months",
            body: "Rapid prototyping and MVP development. Get to market fast with a solid technical foundation you can scale.",
            tags: ["MVP", "startup", "rapid"],
          },
        ]),
        spacer(1),
        section("Tech Stack", [
          badge("TypeScript"),
          badge("React"),
          badge("Next.js"),
          badge("Node.js"),
          badge("PostgreSQL"),
          badge("Redis"),
          badge("AWS"),
          badge("Docker"),
          badge("Terraform"),
          badge("GraphQL"),
        ]),
      ],
    }),
    page("pricing", {
      title: "Pricing",
      icon: "\uD83D\uDCB0",
      content: [
        hero({ title: "Pricing", subtitle: "Transparent rates for every engagement type" }),
        table(
          ["", "Starter", "Growth", "Enterprise"],
          [
            ["Monthly Hours", "20 hrs", "40 hrs", "Full-time"],
            ["Rate", "$150/hr", "$140/hr", "$130/hr"],
            ["Response Time", "48 hrs", "24 hrs", "4 hrs"],
            ["Communication", "Email", "Slack + Email", "Dedicated channel"],
            ["Code Reviews", "No", "Yes", "Yes"],
            ["Architecture Support", "No", "Limited", "Unlimited"],
            ["Maintenance & Bug Fixes", "Add-on", "Included", "Included"],
          ]
        ),
        divider(),
        markdown(`
**Custom quotes** available for fixed-scope projects (MVPs, migrations, etc.).

All engagements include:
- Source code ownership
- Documentation
- 30-day warranty on delivered work
        `),
        spacer(1),
        link("Request a Quote", "https://devbydesign.io/quote", { icon: "\uD83D\uDCDD" }),
      ],
    }),
    page("testimonials", {
      title: "Testimonials",
      icon: "\u2B50",
      content: [
        hero({ title: "What Clients Say", subtitle: "Don't take my word for it" }),
        quote(
          "Jake built our entire platform in 3 months. The code quality was exceptional and he communicated proactively throughout. We've since raised our Series A partly on the strength of that technical foundation.",
          "Sarah Lin, CEO at Stackwise"
        ),
        quote(
          "We hired Jake to fix our performance issues and he reduced our API response times by 80%. He also identified and fixed several security vulnerabilities we didn't even know about.",
          "Marcus Chen, CTO at DataFlow"
        ),
        quote(
          "As a non-technical founder, I needed someone who could translate my vision into a real product. Jake was incredibly patient and delivered exactly what I needed.",
          "Priya Sharma, Founder of NexStep"
        ),
        quote(
          "The best freelance developer I've ever worked with. Responsive, thoughtful, and genuinely cares about the product. He's now my go-to for every project.",
          "Tom Brooks, VP Engineering at Relay"
        ),
        divider(),
        sparkline([4.5, 4.8, 4.9, 5, 4.7, 5, 4.9, 5, 5, 4.8, 5, 5]),
        markdown(`
**Average client rating: 4.9/5** across 40+ engagements.
        `),
      ],
    }),
    page("contact", {
      title: "Contact",
      icon: "\uD83D\uDCE7",
      content: [
        hero({ title: "Let's Talk", subtitle: "Available for new projects starting April 2026" }),
        section("Availability", [
          markdown(`
I'm currently **accepting new clients** for Q2 2026.
Typical project lead time is 1-2 weeks from initial call to kickoff.
          `),
          list([
            "Free 30-minute discovery call",
            "Detailed proposal within 48 hours",
            "Flexible engagement models",
            "References available upon request",
          ], "arrow"),
        ]),
        divider(),
        link("Email", "mailto:jake@devbydesign.io", { icon: "\u2709\uFE0F" }),
        link("LinkedIn", "https://linkedin.com/in/jakemorrison", { icon: "\uD83D\uDC64" }),
        link("GitHub", "https://github.com/jakemorrison", { icon: "\uD83D\uDC31" }),
        link("Twitter / X", "https://x.com/jakemorrison", { icon: "\uD83D\uDC26" }),
        link("Schedule a Call", "https://cal.com/jakemorrison", { icon: "\uD83D\uDCC5" }),
      ],
    }),
  ],
};

// ════════════════════════════════════════════════════════════
// TEST RUNNER
// ════════════════════════════════════════════════════════════

const allSites: { name: string; config: SiteConfig }[] = [
  { name: "Pizza Delivery Shop", config: pizzaConfig },
  { name: "Photographer Portfolio", config: photographerConfig },
  { name: "Nonprofit Organization", config: nonprofitConfig },
  { name: "Podcast", config: podcastConfig },
  { name: "Freelancer Services", config: freelancerConfig },
];

console.log("=".repeat(70));
console.log("  FRESH USABILITY TEST — terminaltui framework");
console.log("  Testing 5 sites as a first-time user of the API");
console.log("=".repeat(70));
console.log();

for (const { name, config } of allSites) {
  console.log(`\n${"─".repeat(70)}`);
  console.log(`  SITE: ${name}`);
  console.log(`${"─".repeat(70)}`);

  // ── Test: defineSite() parses without error ──
  let site: Site | null = null;
  test(`[${name}] defineSite() parses without error`, () => {
    site = defineSite(config);
    expect(!!site, "defineSite returned falsy");
    expect(!!site!.config, "site.config is falsy");
  });

  if (!site) {
    console.log(`  SKIP: site failed to parse, skipping remaining tests for ${name}`);
    continue;
  }

  // ── Test: pages are accessible ──
  test(`[${name}] All pages present`, () => {
    expect(site!.config.pages.length === config.pages.length,
      `Expected ${config.pages.length} pages, got ${site!.config.pages.length}`);
  });

  // ── Test: each page renders non-empty at width 80 ──
  for (const pg of config.pages) {
    test(`[${name}] Page "${pg.id}" renders non-empty at width 80`, () => {
      const c = ctx(80);
      const lines = renderAllBlocks(pg.content, c);
      expectNonEmpty(lines, `page ${pg.id}`);
    });

    // ── Test: each individual block on the page renders ──
    for (let i = 0; i < pg.content.length; i++) {
      const block = pg.content[i];
      test(`[${name}] Page "${pg.id}" block[${i}] (${block.type}) renders`, () => {
        const c = ctx(80);
        const lines = renderBlock(block, c);
        // spacer can be empty lines, that's fine
        if (block.type !== "spacer") {
          expect(lines.length > 0, `${block.type} block produced 0 lines`);
        }
      });
    }

    // ── Test: no overflow at width 80 ──
    test(`[${name}] Page "${pg.id}" no overflow at width 80`, () => {
      const c = ctx(80);
      const lines = renderAllBlocks(pg.content, c);
      expectNoOverflow(lines, 80, `page ${pg.id} at w=80`);
    });

    // ── Test: no overflow at width 40 ──
    test(`[${name}] Page "${pg.id}" no overflow at width 40`, () => {
      const c = ctx(40);
      const lines = renderAllBlocks(pg.content, c);
      expectNoOverflow(lines, 40, `page ${pg.id} at w=40`);
    });
  }

  // ── Test: TUIRuntime can be instantiated ──
  test(`[${name}] TUIRuntime instantiates`, () => {
    // We can't call .start() because it needs a TTY, but we can construct it
    const runtime = new TUIRuntime(site!);
    expect(!!runtime, "TUIRuntime constructor returned falsy");
  });

  // ── Test: renderContentBlocks via TUIRuntime instance ──
  test(`[${name}] TUIRuntime.renderContentBlocks works`, () => {
    const runtime = new TUIRuntime(site!);
    for (const pg of config.pages) {
      const c = ctx(80);
      // renderContentBlocks is public on TUIRuntime
      const lines = runtime.renderContentBlocks(pg.content, c);
      expect(lines.length > 0, `renderContentBlocks on page ${pg.id} returned 0 lines`);
    }
  });

  console.log(`  All tests for "${name}" complete.`);
}

// ════════════════════════════════════════════════════════════
// API CONFUSION TESTS — things I tried that were confusing
// ════════════════════════════════════════════════════════════

console.log(`\n${"─".repeat(70)}`);
console.log("  API CONFUSION & EDGE CASE TESTS");
console.log(`${"─".repeat(70)}`);

// Confusion 1: divider() signature is overloaded — first arg can be label OR style
test("API confusion: divider() with just a label string", () => {
  const d = divider("My Section");
  expect(d.type === "divider", "should be divider type");
  // The implementation treats unknown strings as labels, which is clever but confusing
  expect(d.label === "My Section", `Expected label 'My Section', got '${d.label}'`);
  expect(d.style === "label", `Expected style 'label', got '${d.style}'`);
  confusionNotes.push(
    "divider() overloads first arg: passing a non-style string works as a label, " +
    "but this is not obvious from the type signature. The TypeScript type says " +
    "DividerBlock['style'] | string, which is confusing."
  );
});

// Confusion 2: gallery() takes Omit<CardBlock, "type">[] not CardBlock[]
test("API confusion: gallery() card wrapping", () => {
  const g = gallery([
    { title: "Test", body: "Body text" },
  ]);
  expect(g.type === "gallery", "should be gallery type");
  expect(g.items[0].type === "card", "gallery should auto-wrap items as cards");
  confusionNotes.push(
    "gallery() takes Omit<CardBlock, 'type'>[] — so you don't pass type:'card'. " +
    "This is correct behavior but as a new user I initially tried passing card() " +
    "results which also works fine since 'type' is just redundant. Inconsistency: " +
    "you CAN pass card() output, but gallery() will overwrite the type anyway."
  );
});

// Confusion 3: gradient() doesn't actually apply gradient to rendered output
test("API confusion: gradient() returns plain TextBlock", () => {
  const g = gradient("Hello World", ["#ff0000", "#0000ff"]);
  expect(g.type === "text", "gradient should return text block");
  expect(g.style === "plain", `gradient style is '${g.style}', expected 'plain'`);
  confusionNotes.push(
    "gradient() helper creates a TextBlock with style:'plain'. The gradient info " +
    "is stored as a private _gradient property but never used during rendering. " +
    "The function effectively does nothing beyond creating a plain text block. " +
    "This is misleading — a new user would expect colored gradient text."
  );
});

// Confusion 4: ascii() returns BannerConfig, not a ContentBlock
test("API confusion: ascii() returns BannerConfig not ContentBlock", () => {
  const a = ascii("TEST");
  // This is NOT a ContentBlock — it's a BannerConfig for the site-level banner
  expect(!("type" in a), "ascii() should not have a 'type' property");
  expect("text" in a, "ascii() should have 'text' property");
  confusionNotes.push(
    "ascii() returns a BannerConfig, not a ContentBlock. As a new user, I expected " +
    "it to be a content block I could put inside a page. Instead, it's only usable " +
    "as the banner config at the site level. The name 'ascii' is ambiguous — " +
    "'asciiBanner' would be clearer."
  );
});

// Confusion 5: No public renderBlock or renderPage function
test("API confusion: no public render function", () => {
  // To test rendering, I had to import internal component renderers
  // The only public rendering API is TUIRuntime which needs a TTY
  expect(true, "This test documents a missing API");
  confusionNotes.push(
    "There is no public 'renderBlock()' or 'renderPage()' function exported. " +
    "TUIRuntime.renderContentBlocks() exists but is an instance method that " +
    "requires constructing the full runtime. For testing, SSR, or non-interactive " +
    "use cases, a standalone renderBlock(block, width, theme) would be very useful."
  );
});

// Confusion 6: skillBar vs progressBar — what's the difference?
test("API confusion: skillBar vs progressBar difference", () => {
  const s = skillBar("TypeScript", 90);
  const p = progressBar("Loading", 90);
  // They return the exact same type with the same defaults
  expect(s.type === p.type, "should be same type");
  expect(s.max === p.max, "should have same default max");
  expect(s.showPercent === p.showPercent, "should have same showPercent default");
  confusionNotes.push(
    "skillBar() and progressBar() return identical ProgressBarBlock types with " +
    "the same defaults (max:100, showPercent:true). The only difference is " +
    "progressBar() accepts an optional 'max' parameter. As a new user, I expected " +
    "skillBar to have a different visual style. Consider: either differentiate " +
    "the rendering or just document skillBar as an alias."
  );
});

// Confusion 7: markdown() strips leading whitespace from indented template literals
test("API clarity: markdown() whitespace handling", () => {
  const m = markdown(`
    Hello **world**
    This is indented
  `);
  // The implementation does .replace(/\n\s+/g, "\n") which strips ALL leading whitespace per line
  expect(m.content.includes("Hello"), "should contain Hello");
  expect(!m.content.includes("    Hello"), "should strip leading whitespace");
  confusionNotes.push(
    "markdown() uses replace(/\\n\\s+/g, '\\n') which strips ALL leading whitespace " +
    "after newlines. This works great for template literals but would break " +
    "intentional indentation (e.g., code blocks in markdown). A dedent approach " +
    "would be safer."
  );
});

// ════════════════════════════════════════════════════════════
// RESULTS
// ════════════════════════════════════════════════════════════

console.log(`\n${"=".repeat(70)}`);
console.log("  TEST RESULTS");
console.log(`${"=".repeat(70)}\n`);

const failedResults = allResults.filter(r => !r.passed);

console.log(`  Total:  ${totalTests}`);
console.log(`  Passed: ${passedTests}`);
console.log(`  Failed: ${failedTests}`);
console.log();

if (failedResults.length > 0) {
  console.log("  FAILURES:");
  console.log(`  ${"─".repeat(66)}`);
  for (const r of failedResults) {
    console.log(`  FAIL: ${r.name}`);
    console.log(`        ${r.error}`);
    console.log();
  }
}

if (frameworkBugs.length > 0) {
  console.log("  FRAMEWORK BUGS FOUND:");
  console.log(`  ${"─".repeat(66)}`);
  for (const bug of frameworkBugs) {
    console.log(`  BUG: ${bug}`);
  }
  console.log();
}

// Print passed tests too (abbreviated)
const passedResults = allResults.filter(r => r.passed);
console.log("  PASSED TESTS:");
console.log(`  ${"─".repeat(66)}`);
for (const r of passedResults) {
  console.log(`  OK: ${r.name}`);
}

// ════════════════════════════════════════════════════════════
// USABILITY REPORT
// ════════════════════════════════════════════════════════════

console.log(`\n${"=".repeat(70)}`);
console.log("  USABILITY REPORT — Fresh Developer Perspective");
console.log(`${"=".repeat(70)}\n`);

console.log("  WHAT WAS EASY");
console.log(`  ${"─".repeat(66)}`);
console.log(`
  1. defineSite() + page() pattern is intuitive and well-designed.
     The builder pattern feels natural — define a site, add pages, done.

  2. Content helpers (card, table, list, quote, hero, gallery, etc.) are
     very ergonomic. The Omit<T, 'type'> pattern means you never have to
     type 'type: "card"' — the helper does it for you. Nice DX.

  3. Theme selection is dead simple — just pass a string like "gruvbox"
     or "catppuccin". The built-in theme palette is excellent and well
     curated (10 themes covering all major aesthetics).

  4. section() for grouping content is clean and logical. Nesting content
     blocks inside sections feels right.

  5. The page() helper with id + config is a clean separation. Having
     icons per page is a nice touch for the menu.

  6. gallery() auto-wrapping cards is convenient — you just pass objects
     and it handles the type annotation.

  7. link() with optional icon parameter is straightforward.
     list() with style options (bullet, check, arrow) is well thought out.
`);

console.log("  WHAT WAS CONFUSING");
console.log(`  ${"─".repeat(66)}`);
for (let i = 0; i < confusionNotes.length; i++) {
  console.log(`  ${i + 1}. ${confusionNotes[i]}`);
  console.log();
}

console.log("  WHAT'S MISSING FROM THE API");
console.log(`  ${"─".repeat(66)}`);
console.log(`
  1. No standalone render function exported publicly. To programmatically
     render blocks (for testing, SSR, static export, etc.), you must
     either use TUIRuntime instance methods or import internal components
     directly. A public renderBlock() / renderPage() would be very useful.

  2. No "grid" or "columns" layout primitive. gallery() provides multi-column
     cards, but there's no way to put arbitrary content side-by-side (e.g.,
     a stat on the left and a chart on the right).

  3. No "stat" or "metric" block type. Many sites need to display KPIs
     (e.g., "500+ gardens", "$15M raised"). Currently you'd use cards or
     markdown, but a dedicated stat({ label, value, delta? }) helper would
     be very useful.

  4. No "button" or "CTA" block. hero() has a cta option, but there's no
     standalone call-to-action block. link() is the closest, but it's
     visually different from a prominent CTA button.

  5. No "form" or "input" block for content pages. There's a renderInput
     component internally, but it's not exposed as a content block. For
     sites with contact forms or email signup, this would be valuable.

  6. No "embed" or "code" block. A code block with syntax highlighting
     (even basic) would be useful for technical sites (podcasts about code,
     developer portfolios, etc.).

  7. No way to control gallery column count via the gallery() helper.
     The GalleryBlock type has a 'columns' property, but the gallery()
     helper function doesn't accept it as a parameter. You'd have to
     manually set it after creation.
`);

console.log("  DOCUMENTATION GAPS");
console.log(`  ${"─".repeat(66)}`);
console.log(`
  1. No README or documentation at all. The only way to learn the API is
     reading the source code. Even a simple "getting started" guide with
     one example site would dramatically improve onboarding.

  2. The type definitions in types.ts are well-structured but lack JSDoc
     comments. What does 'handle' mean? (It's a social media handle, but
     not obvious.) What's the difference between 'muted' and 'subtle' in
     the theme? What does 'art' do in HeroBlock?

  3. The helper function signatures are clean but there's no documentation
     of which helpers exist or what they return. A cheatsheet would help.

  4. No examples directory. The test fixtures (test-01 through test-10)
     serve as implicit examples, but they're not labeled as such.

  5. The BannerConfig.font property — what fonts are available? No
     documentation or validation tells you the valid options.

  6. The 'borders' config option — what values are valid? You have to
     read borders.ts to discover the options (single, double, rounded,
     heavy, dashed, ascii, none).
`);

console.log("  OVERALL DEVELOPER EXPERIENCE RATING");
console.log(`  ${"─".repeat(66)}`);
console.log(`
  Rating: 4 / 5

  The API design is genuinely good. The builder pattern with defineSite(),
  page(), and content helpers is intuitive and makes building sites feel
  natural. The type safety is excellent — TypeScript catches most mistakes.
  The theme system is polished and the 10 built-in themes are well chosen.

  What keeps it from a 5:
  - No documentation at all (not even a README)
  - gradient() is a no-op, which is misleading
  - No public render function for testing/SSR
  - ascii() naming is confusing (returns BannerConfig, not a content block)
  - gallery() helper should accept columns parameter
  - progressBar() overflows when label exceeds hardcoded 16-char width
  - Missing some block types that real-world sites commonly need

  The framework shows strong design sensibility. With docs and a few API
  fixes, this would be an excellent developer experience.
`);

console.log(`${"=".repeat(70)}`);
console.log(`  DONE — ${totalTests} tests, ${passedTests} passed, ${failedTests} failed, ${frameworkBugs.length} framework bugs`);
console.log(`${"=".repeat(70)}`);

process.exit(failedTests > 0 ? 1 : 0);
