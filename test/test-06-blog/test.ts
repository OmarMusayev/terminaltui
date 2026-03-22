/**
 * Test 06 — Blog/Writing Site
 *
 * 10 post cards, long About page, Archive with 20 cards, Links page.
 * Theme: dracula. Tests ScrollView, word wrapping, and many-card rendering.
 */
import {
  defineSite,
  page,
  card,
  link,
  markdown,
  divider,
  spacer,
  ascii,
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
  type BugReport,
} from "../harness.js";

import { renderCard } from "../../src/components/Card.js";
import { renderText } from "../../src/components/Text.js";
import { renderScrollView, scrollUp, scrollDown, type ScrollState } from "../../src/components/ScrollView.js";
import { renderBanner } from "../../src/ascii/banner.js";
import { stripAnsi } from "../../src/components/base.js";
import type { SiteConfig, ContentBlock } from "../../src/config/types.js";
import type { RenderContext } from "../../src/components/base.js";

// ─── Blog Post Data ──────────────────────────────────────────

const blogPosts = [
  { title: "Getting Started with Rust", date: "2026-03-15", excerpt: "A beginner-friendly introduction to Rust programming, covering ownership and borrowing." },
  { title: "Why I Switched to Neovim", date: "2026-03-10", excerpt: "After years of VS Code, I finally made the leap to Neovim. Here is what changed." },
  { title: "Building a TUI Framework", date: "2026-03-05", excerpt: "The journey of creating terminaltui from scratch, including design decisions." },
  { title: "Functional Programming in TypeScript", date: "2026-02-28", excerpt: "Exploring monads, functors, and practical FP patterns in everyday TypeScript code." },
  { title: "The Art of CLI Design", date: "2026-02-20", excerpt: "What makes a great command-line tool? Lessons from ripgrep, fd, and bat." },
  { title: "Understanding Linux Signals", date: "2026-02-14", excerpt: "Deep dive into SIGTERM, SIGINT, SIGHUP and how your programs should handle them." },
  { title: "Docker Without the Bloat", date: "2026-02-07", excerpt: "Slim images, multi-stage builds, and distroless containers for production." },
  { title: "My Terminal Setup 2026", date: "2026-01-30", excerpt: "Alacritty, tmux, zsh, and the plugins that make my workflow fast and enjoyable." },
  { title: "Writing a Markdown Parser", date: "2026-01-22", excerpt: "Building a CommonMark-compliant parser from scratch using recursive descent." },
  { title: "Reflections on a Year of Blogging", date: "2026-01-15", excerpt: "What I learned from publishing 50 posts in 12 months. Stats and takeaways." },
];

// ─── Long About Page Content ──────────────────────────────────

const aboutText = `
## About This Blog

Welcome to my corner of the internet. I have been writing about technology, programming, and the command line for over five years now. This blog is a place where I share my thoughts, experiments, and discoveries with the world.

## Who Am I

I am a software engineer who is passionate about developer tools, terminal interfaces, and the Unix philosophy. I believe that the best tools are the ones that get out of your way and let you focus on what matters. I have worked at startups and large companies, building everything from web applications to distributed systems.

## What I Write About

My writing covers a broad range of topics in the technology space. I am particularly interested in **systems programming**, **command-line tools**, and **developer experience**. You will find posts about Rust, TypeScript, Go, and occasionally Python. I also write about the tools I use every day, from text editors to terminal emulators.

## My Philosophy

I believe that software should be fast, reliable, and simple. I prefer composition over inheritance, plain text over proprietary formats, and the terminal over graphical interfaces. I think the Unix philosophy of small, composable tools is more relevant today than ever before.

## The Technical Stack

This blog is built with a custom static site generator written in TypeScript. The content is authored in Markdown and rendered to a terminal user interface using the terminaltui framework. The source code is available on GitHub for anyone who wants to explore or contribute.

## Writing Process

Every post starts as a rough idea in my notes app. I let ideas marinate for a few days before sitting down to write. I usually draft the entire post in one sitting, then revise it over the next few days. I aim for clarity and conciseness, cutting anything that does not add value to the reader.

## Community and Feedback

I love hearing from readers. Whether you have a question, a correction, or just want to say hello, feel free to reach out. You can find me on Twitter, GitHub, or via email. I read every message and try to respond within a day or two.

## Future Plans

I have big plans for this blog in the coming year. I want to start a newsletter, create more interactive tutorials, and possibly launch a podcast about developer tools. I am also working on a book about building terminal user interfaces, which I hope to publish by the end of the year.

## Colophon

This site is designed to be read in a terminal. It uses the Dracula color theme because I find it easy on the eyes during late-night reading sessions. The ASCII art banner is generated using a custom figlet-style renderer. Every element you see on screen is rendered character by character.

## Thank You

If you have made it this far, thank you for reading. I appreciate every visitor, every comment, and every share. Your support keeps me motivated to keep writing and building. Here is to another year of blogging, coding, and exploring the endless frontier of software.

## Additional Thoughts on Writing

Writing is a craft that improves with practice. Every post I publish teaches me something new about communication, structure, and clarity. I have learned that the best writing is rewriting. The first draft is just getting ideas on paper. The real work happens in revision, where you shape raw thoughts into something coherent and useful.

## On Open Source

Open source software is the backbone of modern development. I try to contribute to the projects I use and to open source my own tools whenever possible. The collaborative nature of open source has taught me more than any book or course. I encourage every developer to find a project they care about and start contributing, even if it is just fixing typos in documentation.

## The Importance of Documentation

Good documentation is as important as good code. I spend significant time documenting my projects because I know that code without documentation is code that nobody will use. I write READMEs, API docs, and inline comments. I also believe in the power of examples, so I always include working code samples in my documentation.

## Closing Words

Technology moves fast, but the fundamentals remain the same. Learn the basics deeply, stay curious, and never stop building. The terminal is not going away, and the command line will always be the most powerful interface available to a developer. Keep hacking, keep writing, and keep sharing what you learn.
`;

// ─── Archive Posts (20 cards) ─────────────────────────────────

const archivePosts: ContentBlock[] = [];
for (let i = 0; i < 20; i++) {
  const month = String(Math.floor(i / 2) + 1).padStart(2, "0");
  const day = String((i % 28) + 1).padStart(2, "0");
  archivePosts.push(
    card({
      title: `Archive Post #${i + 1}: ${["Deep Dives", "Quick Tips", "Tutorials", "Reviews", "Opinions"][i % 5]}`,
      subtitle: `2025-${month}-${day}`,
      body: `This is archive post number ${i + 1}. It covers ${["systems programming", "web development", "DevOps practices", "language design", "tool reviews"][i % 5]} in depth.`,
    })
  );
  if (i < 19) {
    archivePosts.push(spacer(1));
  }
}

// ─── Site Config ──────────────────────────────────────────────

const blogConfig: SiteConfig = {
  name: "Terminal Blog",
  handle: "@termwriter",
  tagline: "Thoughts on code, tools, and the command line",
  banner: ascii("BLOG", { font: "Small" }),
  theme: "dracula" as any,
  pages: [
    page("posts", {
      title: "Posts",
      icon: "pencil",
      content: [
        ...blogPosts.flatMap((post, i) => [
          card({
            title: post.title,
            subtitle: post.date,
            body: post.excerpt,
            tags: ["blog", ["rust", "neovim", "tui", "typescript", "cli", "linux", "docker", "terminal", "markdown", "blogging"][i]],
          }),
          ...(i < blogPosts.length - 1 ? [spacer(1)] : []),
        ]),
      ],
    }),
    page("about", {
      title: "About",
      icon: "user",
      content: [
        markdown(aboutText),
      ],
    }),
    page("archive", {
      title: "Archive",
      icon: "archive",
      content: archivePosts,
    }),
    page("links", {
      title: "Links",
      icon: "link",
      content: [
        link("RSS Feed", "https://blog.example.com/rss.xml", { icon: "rss" }),
        spacer(1),
        link("Twitter", "https://twitter.com/termwriter", { icon: "twitter" }),
        spacer(1),
        link("GitHub", "https://github.com/termwriter", { icon: "github" }),
        spacer(1),
        link("Newsletter", "https://newsletter.example.com", { icon: "mail" }),
        spacer(1),
        link("Email", "mailto:hello@termwriter.dev", { icon: "mail" }),
      ],
    }),
  ],
};

// ─── Run Standard Site Tests ──────────────────────────────────

const report = testSiteConfig(blogConfig, "Blog/Writing Site");

// ─── Extra Tests ──────────────────────────────────────────────

const extraResults: TestResult[] = [];
const extraBugs: BugReport[] = [];

const draculaTheme = (themes as any).dracula;

// ─── Test: Render 10 blog post cards at width 60 ──────────────

extraResults.push(assertNoThrow(() => {
  const ctx = createTestContext(60, draculaTheme);
  for (let i = 0; i < blogPosts.length; i++) {
    const c = card({
      title: blogPosts[i].title,
      subtitle: blogPosts[i].date,
      body: blogPosts[i].excerpt,
    });
    const lines = renderCard(c, ctx);
    if (lines.length === 0) {
      throw new Error(`Card ${i} ("${blogPosts[i].title}") rendered 0 lines`);
    }
    const hasTitle = lines.some(l => stripAnsi(l).includes(blogPosts[i].title.substring(0, 20)));
    if (!hasTitle) {
      throw new Error(`Card ${i} does not contain expected title text`);
    }
  }
}, "10 blog post cards render at width 60 with content"));

// ─── Test: Long markdown at widths 40, 60, 80 ────────────────

for (const width of [40, 60, 80]) {
  extraResults.push(assertNoThrow(() => {
    const ctx = createTestContext(width, draculaTheme);
    const lines = renderText(aboutText, ctx, "markdown");
    if (lines.length < 20) {
      throw new Error(`Markdown rendered only ${lines.length} lines at width ${width} — expected 20+`);
    }
    // Check word wrapping: no non-empty line should exceed width (with tolerance for ANSI codes)
    let overflowCount = 0;
    for (let i = 0; i < lines.length; i++) {
      const plainLen = stripAnsi(lines[i]).length;
      if (plainLen > width + 2) {
        overflowCount++;
      }
    }
    if (overflowCount > 0) {
      extraBugs.push({
        severity: "P2",
        category: "Layout",
        description: `Markdown text has ${overflowCount} lines overflowing at width ${width}`,
        reproduction: `renderText(aboutText, ctx, "markdown") with width=${width}`,
        component: "Text",
      });
    }
  }, `Long markdown renders at width ${width} with word wrapping`));
}

// ─── Test: renderScrollView with 50 lines, visibleHeight=10 ──

extraResults.push(assertNoThrow(() => {
  const ctx = createTestContext(80, draculaTheme);
  const content = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}: This is content for the scroll view test.`);
  const result = renderScrollView(content, 10, 0, ctx);

  if (result.lines.length !== 10) {
    throw new Error(`Expected 10 visible lines, got ${result.lines.length}`);
  }
  if (result.scrollState.totalLines !== 50) {
    throw new Error(`Expected totalLines=50, got ${result.scrollState.totalLines}`);
  }
  if (result.scrollState.visibleLines !== 10) {
    throw new Error(`Expected visibleLines=10, got ${result.scrollState.visibleLines}`);
  }
  if (result.scrollState.offset !== 0) {
    throw new Error(`Expected offset=0, got ${result.scrollState.offset}`);
  }
}, "ScrollView: 50 lines, visibleHeight=10, offset=0"));

// ─── Test: renderScrollView with 100 lines, visibleHeight=20, various offsets ─

for (const offset of [0, 10, 50, 80]) {
  extraResults.push(assertNoThrow(() => {
    const ctx = createTestContext(80, draculaTheme);
    const content = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}: Scroll test content for stress testing the scroll view component.`);
    const result = renderScrollView(content, 20, offset, ctx);

    if (result.lines.length !== 20) {
      throw new Error(`Expected 20 visible lines at offset=${offset}, got ${result.lines.length}`);
    }
    if (result.scrollState.totalLines !== 100) {
      throw new Error(`Expected totalLines=100, got ${result.scrollState.totalLines}`);
    }
    // The effective offset should be clamped: max offset = 100 - 20 = 80
    const expectedOffset = Math.min(offset, 80);
    if (result.scrollState.offset !== expectedOffset) {
      throw new Error(`Expected clamped offset=${expectedOffset}, got ${result.scrollState.offset}`);
    }
    // Verify first visible line matches expected offset
    const firstLinePlain = stripAnsi(result.lines[0]);
    if (!firstLinePlain.includes(`Line ${expectedOffset + 1}:`)) {
      throw new Error(`First visible line should contain "Line ${expectedOffset + 1}:", got "${firstLinePlain.substring(0, 40)}"`);
    }
  }, `ScrollView: 100 lines, visibleHeight=20, offset=${offset}`));
}

// ─── Test: scrollUp / scrollDown functions ─────────────────────

extraResults.push(assertNoThrow(() => {
  const state: ScrollState = { offset: 25, totalLines: 100, visibleLines: 20 };

  // scrollUp by 1
  const up1 = scrollUp(state, 1);
  if (up1 !== 24) throw new Error(`scrollUp(25, 1) expected 24, got ${up1}`);

  // scrollUp by 10
  const up10 = scrollUp(state, 10);
  if (up10 !== 15) throw new Error(`scrollUp(25, 10) expected 15, got ${up10}`);

  // scrollUp past 0 should clamp to 0
  const upPast = scrollUp({ ...state, offset: 3 }, 10);
  if (upPast !== 0) throw new Error(`scrollUp(3, 10) expected 0, got ${upPast}`);

  // scrollDown by 1
  const down1 = scrollDown(state, 1);
  if (down1 !== 26) throw new Error(`scrollDown(25, 1) expected 26, got ${down1}`);

  // scrollDown by 10
  const down10 = scrollDown(state, 10);
  if (down10 !== 35) throw new Error(`scrollDown(25, 10) expected 35, got ${down10}`);

  // scrollDown past max should clamp to totalLines - visibleLines
  const maxOffset = state.totalLines - state.visibleLines; // 80
  const downPast = scrollDown({ ...state, offset: 78 }, 5);
  if (downPast !== maxOffset) throw new Error(`scrollDown(78, 5) expected ${maxOffset}, got ${downPast}`);
}, "scrollUp/scrollDown return correct clamped offsets"));

// ─── Test: Render 20 archive cards ────────────────────────────

extraResults.push(assertNoThrow(() => {
  const ctx = createTestContext(80, draculaTheme);
  let totalLines = 0;
  let cardCount = 0;

  for (const block of archivePosts) {
    const lines = renderBlock(block, ctx);
    totalLines += lines.length;
    if (block.type === "card") {
      cardCount++;
      if (lines.length === 0) {
        throw new Error(`Archive card "${(block as any).title}" rendered 0 lines`);
      }
    }
  }

  if (cardCount !== 20) {
    throw new Error(`Expected 20 archive cards, found ${cardCount}`);
  }
  if (totalLines < 100) {
    throw new Error(`20 cards produced only ${totalLines} total lines — seems too few`);
  }
}, "20 archive cards render without issues"));

// ─── Test: "Small" font banner renders correctly ──────────────

extraResults.push(assertNoThrow(() => {
  const bannerLines = renderBanner("BLOG", { font: "Small" });
  if (bannerLines.length === 0) {
    throw new Error("Banner rendered 0 lines with Small font");
  }
  // Small font should produce multiple lines (not just a fallback single line)
  if (bannerLines.length < 2) {
    throw new Error(`Banner only produced ${bannerLines.length} line(s) — font may not be loading`);
  }
  // Check that the banner has visible characters (not all empty)
  const hasContent = bannerLines.some(l => l.trim().length > 0);
  if (!hasContent) {
    throw new Error("Banner lines are all empty");
  }
  // Check that B, L, O, G characters are represented (at least some visual content)
  const totalChars = bannerLines.reduce((acc, l) => acc + l.replace(/\s/g, "").length, 0);
  if (totalChars < 10) {
    throw new Error(`Banner has only ${totalChars} non-space characters — seems too sparse`);
  }
}, `"Small" font banner renders "BLOG" correctly`));

// ─── Test: Word wrapping comparison across widths ─────────────

extraResults.push(assertNoThrow(() => {
  const widths = [40, 60, 80];
  const lineCounts: number[] = [];

  for (const width of widths) {
    const ctx = createTestContext(width, draculaTheme);
    const lines = renderText(aboutText, ctx, "markdown");
    lineCounts.push(lines.length);
  }

  // Narrower widths should produce more lines (more wrapping)
  if (lineCounts[0] <= lineCounts[2]) {
    throw new Error(`Width 40 produced ${lineCounts[0]} lines but width 80 produced ${lineCounts[2]} — narrower should have more`);
  }
}, "Word wrapping: narrower widths produce more lines"));

// ─── Merge Extra Results into Report ──────────────────────────

report.results.push(...extraResults);
report.bugs.push(...extraBugs);
report.total += extraResults.length;
report.passed += extraResults.filter(r => r.passed).length;
report.failed += extraResults.filter(r => !r.passed).length;

// ─── Print Report ─────────────────────────────────────────────

console.log(formatReport(report));

// ─── Summary ──────────────────────────────────────────────────

if (report.failed > 0) {
  console.log(`\n*** ${report.failed} test(s) FAILED ***\n`);
  for (const r of report.results.filter(r => !r.passed)) {
    console.log(`  FAIL: ${r.name}`);
    if (r.error) console.log(`        ${r.error}`);
  }
  process.exit(1);
} else {
  console.log(`\n*** All ${report.passed} tests PASSED ***\n`);
}
