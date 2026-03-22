import {
  runSiteTests, page, card, link, markdown, divider, spacer,
  section, hero, quote, timeline, progressBar, themes,
} from "../emulator-harness.js";
import { writeFileSync } from "node:fs";

const config = {
  name: "Sam Rivera",
  handle: "@samrivera",
  tagline: "Design engineer crafting pixel-perfect interfaces",
  theme: "cyberpunk" as const,
  borders: "rounded" as const,
  banner: {
    text: "Sam Rivera",
    gradient: ["#ff00ff", "#00ffff"] as [string, string],
  },
  pages: [
    page("about", {
      title: "About",
      icon: "👤",
      content: [
        markdown(
          "## Hello, I'm Sam\n\n" +
          "I'm a design engineer with over a decade of experience bridging the gap between " +
          "design and development. I believe great software starts with empathy — understanding " +
          "the people who will use it every day.\n\n" +
          "My work spans **design systems**, **frontend architecture**, and **creative tooling**. " +
          "I've shipped products used by millions at companies like Figma, Stripe, and Vercel.\n\n" +
          "When I'm not writing code, you'll find me sketching typefaces, brewing pour-over coffee, " +
          "or hiking the trails around the Pacific Northwest."
        ),
        spacer(1),
        quote(
          "Design is not just what it looks like and feels like. Design is how it works.",
          "Steve Jobs"
        ),
      ],
    }),
    page("projects", {
      title: "Projects",
      icon: "🚀",
      content: [
        section("Open Source", [
          card({ title: "Lumina UI", body: "A themeable component library for React with first-class accessibility support and automatic dark mode. Over 12k stars on GitHub.", tags: ["React", "TypeScript", "A11y"] }),
          card({ title: "Chromatic", body: "Color palette generator that uses perceptual color models to produce harmonious and accessible color schemes.", tags: ["Color Science", "Rust", "WASM"] }),
          card({ title: "Motion Kit", body: "Declarative animation primitives for the web. Spring physics, gesture-driven transitions, and layout animations.", tags: ["Animation", "TypeScript", "WebGL"] }),
        ]),
        spacer(1),
        section("Client Work", [
          card({ title: "Finova Dashboard", body: "Real-time financial analytics dashboard for institutional traders. Handles 50k data points per second with sub-frame rendering.", subtitle: "Finova Capital", tags: ["D3.js", "WebSocket", "Canvas"] }),
          card({ title: "MedConnect", body: "Telemedicine platform connecting rural patients with specialists. Features real-time video, shared medical imaging, and EHR integration.", subtitle: "HealthBridge Inc.", tags: ["WebRTC", "HIPAA", "React"] }),
          card({ title: "Aura Home", body: "Smart home control interface designed for accessibility. Voice-first interaction model with adaptive UI for motor impairments.", subtitle: "Aura Technologies", tags: ["IoT", "Voice UI", "A11y"] }),
        ]),
      ],
    }),
    page("experience", {
      title: "Experience",
      icon: "💼",
      content: [
        timeline([
          { date: "2022 — Present", title: "Staff Design Engineer", description: "Vercel — Leading the design systems team. Built the component architecture behind the Vercel dashboard redesign. Managing a team of 6 engineers." },
          { date: "2019 — 2022", title: "Senior Frontend Engineer", description: "Stripe — Built the Stripe Dashboard component library used across all Stripe products. Reduced bundle size by 40% through tree-shaking improvements." },
          { date: "2016 — 2019", title: "Design Engineer", description: "Figma — Early team member who helped build the inspector panel and plugin API. Contributed to the auto-layout algorithm." },
          { date: "2014 — 2016", title: "Frontend Developer", description: "Freelance — Built marketing sites and web apps for startups. Focused on animation, interaction design, and performance optimization." },
        ]),
      ],
    }),
    page("skills", {
      title: "Skills",
      icon: "⚡",
      content: [
        section("Languages & Frameworks", [
          progressBar("TypeScript", 95),
          progressBar("React / Next.js", 92),
          progressBar("Rust", 70),
          progressBar("CSS / Tailwind", 98),
        ]),
        spacer(1),
        section("Design & Tooling", [
          progressBar("Figma", 90),
          progressBar("Motion Design", 85),
          progressBar("Design Systems", 95),
          progressBar("Accessibility", 88),
        ]),
      ],
    }),
    page("blog", {
      title: "Blog",
      icon: "📝",
      content: [
        card({ title: "The Case for Semantic Tokens", body: "Why your design system needs a semantic layer between primitive values and component styles. A deep dive into token architecture.", subtitle: "March 2026" }),
        card({ title: "Animating Layout Changes", body: "How to build smooth layout animations using the View Transitions API and FLIP technique without JavaScript overhead.", subtitle: "January 2026" }),
        card({ title: "Rust for Frontend Developers", body: "A gentle introduction to Rust for engineers coming from TypeScript. Ownership, borrowing, and why the compiler is your best friend.", subtitle: "November 2025" }),
        card({ title: "Accessible Color Systems", body: "Building color palettes that meet WCAG 3.0 APCA contrast requirements while maintaining brand consistency.", subtitle: "September 2025" }),
        card({ title: "Design Engineering is Real Engineering", body: "Why the industry needs to stop treating design engineering as a lesser discipline and start recognizing the unique skills it demands.", subtitle: "July 2025" }),
      ],
    }),
    page("links", {
      title: "Links",
      icon: "🔗",
      content: [
        link("GitHub", "https://github.com/samrivera"),
        link("Twitter / X", "https://x.com/samrivera"),
        link("LinkedIn", "https://linkedin.com/in/samrivera"),
        link("Dribbble", "https://dribbble.com/samrivera"),
        link("Blog RSS", "https://samrivera.dev/rss.xml"),
        link("Email", "mailto:sam@samrivera.dev"),
      ],
    }),
  ],
};

const report = runSiteTests(config, "agent-1-maxed-portfolio");
writeFileSync("test-sites/maxed-portfolio/report.json", JSON.stringify(report, null, 2));

const p = report.tests_passed;
const f = report.tests_failed;
const b = report.bugs.length;
console.log(`\nAgent 1 — Maxed Portfolio (Sam Rivera): ${p} passed, ${f} failed, ${b} bugs`);
if (report.bugs.length > 0) {
  for (const bug of report.bugs) console.log(`  [${bug.severity}] ${bug.title}`);
}
if (f > 0) {
  console.log("\nFailed tests:");
  console.log(report.notes);
}
