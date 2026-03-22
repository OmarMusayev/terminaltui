/**
 * Test 10 — Artistic / Experimental Site
 * Pushes the limits: custom theme, heavy ASCII art, decorative patterns,
 * custom blocks, easter eggs, matrix rain, glitch text, multiple gradients.
 */
import {
  testSiteConfig,
  formatReport,
  createTestContext,
  assert,
  assertNoThrow,
  assertLines,
  assertLinesNonEmpty,
  assertNoOverflow,
  renderBlock,
  defineSite,
  page,
  card,
  gallery,
  quote,
  link,
  markdown,
  divider,
  spacer,
  section,
  themes,
  type TestResult,
  type TestReport,
} from "../harness.js";

import { renderBanner } from "../../src/ascii/banner.js";
import { gradientLines, gradientText } from "../../src/style/gradient.js";
import { matrixRainFrame, glitchText, sparkleText } from "../../src/animation/effects.js";
import { createTypingAnimation } from "../../src/animation/typing.js";
import { createStaggerAnimation } from "../../src/animation/stagger.js";
import { getSpinnerFrame } from "../../src/animation/spinner.js";
import { sparkline, braillePattern } from "../../src/ascii/braille.js";
import { frame } from "../../src/ascii/box-drawing.js";
import { icons } from "../../src/ascii/art.js";
import { fonts } from "../../src/ascii/fonts.js";
import { stripAnsi } from "../../src/components/base.js";
import { getBorderChars } from "../../src/style/borders.js";
import type { Theme } from "../../src/style/theme.js";
import type { ContentBlock } from "../../src/config/types.js";

// ─── Custom Cyberpunk Theme ────────────────────────────────────
const customTheme: Theme = {
  accent: "#ff00ff",
  accentDim: "#aa00aa",
  text: "#00ffff",
  muted: "#008888",
  subtle: "#004444",
  success: "#00ff00",
  warning: "#ffff00",
  error: "#ff0000",
  border: "#ff00ff",
  bg: "#000000",
};

// ─── Raw ASCII Art Custom Block ────────────────────────────────
const skullArt: ContentBlock = {
  type: "custom",
  render: (_width: number, _theme: Theme) => {
    return [
      "        .-\"\"\"\"-.       ",
      "       /        \\      ",
      "      |  O    O  |     ",
      "      |  .----.  |     ",
      "       \\  ''''  /      ",
      "        '------'       ",
      "     /  |      |  \\    ",
      "    /   |      |   \\   ",
      "   '----'      '----'  ",
    ];
  },
};

const decorativeBorder: ContentBlock = {
  type: "custom",
  render: (width: number, _theme: Theme) => {
    const w = Math.min(width, 60);
    const pattern1 = "\u2591\u2592\u2593\u2588\u2593\u2592\u2591";
    let line = "";
    while (line.length < w) line += pattern1;
    line = line.slice(0, w);
    return [line, line];
  },
};

const matrixBlock: ContentBlock = {
  type: "custom",
  render: (width: number, _theme: Theme) => {
    return matrixRainFrame(Math.min(width, 60), 5, 42);
  },
};

// ─── Site Configuration ────────────────────────────────────────
const artisticConfig = {
  name: "VOID//TERMINAL",
  handle: "@void_artist",
  tagline: "Digital art in the terminal dimension",
  theme: customTheme,
  borders: "heavy" as const,

  banner: {
    text: "VOID",
    font: "Slant",
    gradient: ["#ff00ff", "#00ffff", "#ffff00"],
  },

  animations: {
    boot: true,
    transitions: "wipe" as const,
    exitMessage: "[ CONNECTION TERMINATED ]",
    speed: "normal" as const,
  },

  easterEggs: {
    konami: "You found the void within the void.",
    commands: {
      "glitch": "REALITY.EXE HAS CRASHED",
      "matrix": "Wake up, Neo...",
    },
  },

  pages: [
    page("manifesto", {
      title: "Manifesto",
      icon: "\u2620",
      content: [
        spacer(2),
        markdown(`# THE VOID MANIFESTO

We are the signal in the noise.
We are the **glitch** in the matrix.
We carve art from raw terminal output.

## Principles

1. Code is the canvas
2. ANSI is the palette
3. The terminal is the gallery
4. Constraints breed creativity

> _"In the void, we found everything."_`),
        divider("double"),
        quote("The terminal is not a limitation — it is a liberation.", "VOID Collective", ),
        quote("Every pixel is a choice, every character a brushstroke.", "Digital Monk"),
        quote("Between 0 and 1, there is infinity.", "Binary Poet"),
        spacer(1),
        divider("dashed"),
        skullArt,
        spacer(1),
        decorativeBorder,
      ],
    }),

    page("gallery", {
      title: "Gallery",
      icon: "\u{1F3A8}",
      content: [
        spacer(1),
        gallery([
          { title: "SIGNAL//NOISE", subtitle: "Generative ASCII", body: "Patterns born from pseudorandom seeds and mathematical harmony.", tags: ["generative", "ascii"] },
          { title: "VOID//ECHO", subtitle: "Terminal Animation", body: "Ephemeral art that exists only in the moment of rendering.", tags: ["animation", "ephemeral"] },
          { title: "GLITCH//CORE", subtitle: "Data Corruption Art", body: "Beauty found in broken data streams and corrupted signals.", tags: ["glitch", "data-art"] },
          { title: "MATRIX//RAIN", subtitle: "Falling Characters", body: "The iconic rain, reimagined with braille and Unicode blocks.", tags: ["matrix", "unicode"] },
          { title: "NEON//GLOW", subtitle: "Color Gradient Art", body: "Luminous text that pulses with multi-stop color gradients.", tags: ["gradient", "color"] },
          { title: "SKULL//PORT", subtitle: "ASCII Portraiture", body: "Faces and forms sculpted from box-drawing characters.", tags: ["portrait", "box-drawing"] },
        ]),
      ],
    }),

    page("signal", {
      title: "Signal",
      icon: "\u{1F4E1}",
      content: [
        spacer(1),
        markdown("## Transmission Links"),
        link("Source Code", "https://github.com/void/terminal-art", { icon: "\u{1F4BB}" }),
        link("Live Feed", "https://void.art/live", { icon: "\u{1F4E1}" }),
        link("Discord Rift", "https://discord.gg/void", { icon: "\u{1F30A}" }),
        link("Manifesto PDF", "https://void.art/manifesto.pdf", { icon: "\u{1F4DC}" }),
        link("Art Archive", "https://archive.void.art", { icon: "\u{1F5C4}" }),
        spacer(1),
        matrixBlock,
        spacer(1),
      ],
    }),
  ],
};

// ═══════════════════════════════════════════════════════════════
//  MAIN TEST EXECUTION
// ═══════════════════════════════════════════════════════════════

console.log("\n" + "=".repeat(70));
console.log("  TEST 10: ARTISTIC / EXPERIMENTAL SITE");
console.log("  Pushing the limits of terminaltui");
console.log("=".repeat(70) + "\n");

// ─── Part 1: Site Config Tests ─────────────────────────────────
const siteReport = testSiteConfig(artisticConfig, "VOID//TERMINAL Artistic Site");
console.log(formatReport(siteReport));

// ─── Part 2: Extended Module-Level Tests ───────────────────────
const extraResults: TestResult[] = [];
const extraBugs: { severity: string; desc: string }[] = [];

function addResult(result: TestResult) {
  extraResults.push(result);
}

// ──────────────────────────────────────────────────────────────
// TEST: All 5 Fonts — render "HELLO" with each
// ──────────────────────────────────────────────────────────────
console.log("\n--- Font Rendering Tests ---");
const fontNames = ["ANSI Shadow", "Slant", "Calvin S", "Small", "Ogre"];
for (const fontName of fontNames) {
  addResult(assertNoThrow(() => {
    const font = fonts[fontName];
    assert(!!font, `Font "${fontName}" exists in fonts registry`);
    assert(font.height > 0, `Font "${fontName}" has positive height`);

    const banner = renderBanner("HELLO", { font: fontName });
    assert(banner.length > 0, `renderBanner with "${fontName}" produces output`);
    assert(banner.length === font.height, `renderBanner with "${fontName}" has correct height (${banner.length} === ${font.height})`);

    const hasContent = banner.some(l => l.trim().length > 0);
    assert(hasContent, `renderBanner with "${fontName}" has non-empty content`);
    console.log(`  Font "${fontName}" (height=${font.height}): ${banner.length} lines, max width=${Math.max(...banner.map(l => l.length))}`);
  }, `Font "${fontName}" renders "HELLO"`));
}

// ──────────────────────────────────────────────────────────────
// TEST: renderBanner with every font
// ──────────────────────────────────────────────────────────────
console.log("\n--- renderBanner with Every Font ---");
for (const fontName of fontNames) {
  addResult(assertNoThrow(() => {
    const result = renderBanner("TEST", { font: fontName });
    assert(result.length > 0, `renderBanner("TEST", font="${fontName}") produced lines`);
    const anyVisible = result.some(l => l.trim().length > 0);
    assert(anyVisible, `renderBanner with "${fontName}" has visible content`);
    console.log(`  renderBanner("TEST", "${fontName}"): ${result.length} lines OK`);
  }, `renderBanner with font "${fontName}"`));
}

// ──────────────────────────────────────────────────────────────
// TEST: Gradient with 2, 3, 4, 5 color stops
// ──────────────────────────────────────────────────────────────
console.log("\n--- Gradient Color Stop Tests ---");
const gradientConfigs = [
  { stops: ["#ff0000", "#0000ff"], label: "2-stop" },
  { stops: ["#ff0000", "#00ff00", "#0000ff"], label: "3-stop" },
  { stops: ["#ff0000", "#ffff00", "#00ff00", "#0000ff"], label: "4-stop" },
  { stops: ["#ff0000", "#ff8800", "#ffff00", "#00ff00", "#0000ff"], label: "5-stop" },
];

for (const gc of gradientConfigs) {
  addResult(assertNoThrow(() => {
    const result = gradientText("Hello, colorful world!", gc.stops);
    assert(result.length > 0, `gradientText with ${gc.label} produces output`);
    const stripped = stripAnsi(result);
    assert(stripped === "Hello, colorful world!", `gradientText with ${gc.label} preserves text content`);
    console.log(`  gradientText ${gc.label}: ${result.length} chars (raw), "${stripped}" (stripped)`);
  }, `gradientText with ${gc.label} gradient`));
}

// ──────────────────────────────────────────────────────────────
// TEST: gradientLines across multi-line banner
// ──────────────────────────────────────────────────────────────
console.log("\n--- gradientLines on Multi-Line Banner ---");
addResult(assertNoThrow(() => {
  const banner = renderBanner("ART", { font: "Slant" });
  assert(banner.length > 0, "Banner for gradient test renders");

  const colored = gradientLines(banner, ["#ff00ff", "#00ffff", "#ffff00"]);
  assert(colored.length === banner.length, "gradientLines preserves line count");

  for (let i = 0; i < colored.length; i++) {
    const originalPlain = banner[i].replace(/\s/g, "");
    const coloredPlain = stripAnsi(colored[i]).replace(/\s/g, "");
    assert(originalPlain === coloredPlain, `gradientLines preserves text on line ${i}`);
  }
  console.log(`  gradientLines on ${banner.length}-line banner: OK, text preserved`);
}, "gradientLines across multi-line banner"));

// ──────────────────────────────────────────────────────────────
// TEST: matrixRainFrame at various widths and heights
// ──────────────────────────────────────────────────────────────
console.log("\n--- matrixRainFrame Dimension Tests ---");
const matrixWidths = [40, 80, 120];
const matrixHeights = [10, 20, 30];

for (const w of matrixWidths) {
  for (const h of matrixHeights) {
    addResult(assertNoThrow(() => {
      const rain = matrixRainFrame(w, h, 0);
      assert(rain.length === h, `matrixRainFrame(${w}, ${h}) has correct height`);
      for (let i = 0; i < rain.length; i++) {
        const plainLen = stripAnsi(rain[i]).length;
        assert(plainLen === w, `matrixRainFrame(${w}, ${h}) line ${i} has correct width (got ${plainLen})`);
      }
      console.log(`  matrixRainFrame(${w}x${h}): ${rain.length} lines, all width=${w} OK`);
    }, `matrixRainFrame at ${w}x${h}`));
  }
}

// ──────────────────────────────────────────────────────────────
// TEST: glitchText with various intensities
// ──────────────────────────────────────────────────────────────
console.log("\n--- glitchText Intensity Tests ---");
const intensities = [0, 0.1, 0.5, 1.0];
for (const intensity of intensities) {
  addResult(assertNoThrow(() => {
    const original = "HELLO VOID TERMINAL";
    const glitched = glitchText(original, intensity);
    assert(glitched.length === original.length, `glitchText(intensity=${intensity}) preserves length`);

    if (intensity === 0) {
      assert(glitched === original, `glitchText(intensity=0) should return original text exactly`);
    }

    // Spaces should always be preserved
    for (let i = 0; i < original.length; i++) {
      if (original[i] === " ") {
        assert(glitched[i] === " ", `glitchText(intensity=${intensity}) preserves spaces at position ${i}`);
      }
    }
    console.log(`  glitchText(intensity=${intensity}): "${glitched}" (len=${glitched.length})`);
  }, `glitchText with intensity ${intensity}`));
}

// ──────────────────────────────────────────────────────────────
// TEST: sparkleText at frames 0–4
// ──────────────────────────────────────────────────────────────
console.log("\n--- sparkleText Frame Tests ---");
for (let f = 0; f <= 4; f++) {
  addResult(assertNoThrow(() => {
    const original = "HELLO VOID WORLD";
    const sparkled = sparkleText(original, f, "#ff00ff");
    const stripped = stripAnsi(sparkled);
    // sparkleText may replace spaces with sparkle chars, but should keep overall structure
    assert(stripped.length >= original.length, `sparkleText(frame=${f}) output length >= original`);
    console.log(`  sparkleText(frame=${f}): raw len=${sparkled.length}, stripped len=${stripped.length}`);
  }, `sparkleText at frame ${f}`));
}

// ──────────────────────────────────────────────────────────────
// TEST: createTypingAnimation
// ──────────────────────────────────────────────────────────────
console.log("\n--- Typing Animation Tests ---");
addResult(assertNoThrow(() => {
  const text = "VOID_TERMINAL_ART!!!";  // 20 chars
  assert(text.length === 20, "Test string is 20 chars");
  const typing = createTypingAnimation(text, 1);  // speed=1 char per advance

  // Initially should show nothing
  assert(typing.getText() === "", "Typing starts with empty text");
  assert(!typing.state.complete, "Typing starts incomplete");

  // Advance and check progressive reveal
  const snapshots: string[] = [];
  for (let i = 0; i < 25; i++) {
    typing.advance();
    const current = typing.getText();
    snapshots.push(current);
  }

  // After 1 advance, should show 1 char
  assert(snapshots[0] === text.slice(0, 1), `After 1 advance: "${snapshots[0]}" === "${text.slice(0, 1)}"`);
  // After 10 advances, should show 10 chars
  assert(snapshots[9] === text.slice(0, 10), `After 10 advances: "${snapshots[9]}" === "${text.slice(0, 10)}"`);
  // After 20 advances, should be complete
  assert(snapshots[19] === text, `After 20 advances: full text`);
  assert(typing.state.complete, "Typing is complete after full text revealed");

  console.log(`  Typing animation: 20-char string, progressive reveal verified`);
  console.log(`    Step 1: "${snapshots[0]}"`);
  console.log(`    Step 10: "${snapshots[9]}"`);
  console.log(`    Step 20: "${snapshots[19]}"`);
}, "createTypingAnimation progressive reveal"));

// ──────────────────────────────────────────────────────────────
// TEST: createStaggerAnimation
// ──────────────────────────────────────────────────────────────
console.log("\n--- Stagger Animation Tests ---");
addResult(assertNoThrow(() => {
  const items = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];
  const stagger = createStaggerAnimation(items, 1);  // delayFrames=1 -> 1 item per advance

  // Initially should show nothing
  assert(stagger.getVisibleItems().length === 0, "Stagger starts with 0 visible items");
  assert(!stagger.state.complete, "Stagger starts incomplete");

  // Advance and verify growing visibility
  for (let i = 1; i <= 5; i++) {
    stagger.advance();
    const visible = stagger.getVisibleItems();
    assert(visible.length === i, `After ${i} advances: ${visible.length} items visible (expected ${i})`);
    assert(visible[visible.length - 1] === items[i - 1], `Item ${i} is correct: "${visible[visible.length - 1]}"`);
    console.log(`  Stagger advance ${i}: [${visible.join(", ")}]`);
  }

  assert(stagger.state.complete, "Stagger is complete after all items revealed");
}, "createStaggerAnimation progressive reveal"));

// ──────────────────────────────────────────────────────────────
// TEST: getSpinnerFrame for ALL spinner styles
// ──────────────────────────────────────────────────────────────
console.log("\n--- Spinner Frame Tests ---");
const spinnerStyles = ["dots", "bars", "braille", "circle", "bounce", "line"] as const;

for (const style of spinnerStyles) {
  addResult(assertNoThrow(() => {
    const frames: string[] = [];
    for (let f = 0; f < 20; f++) {
      const spinFrame = getSpinnerFrame(style, f);
      assert(typeof spinFrame === "string", `getSpinnerFrame("${style}", ${f}) returns a string`);
      assert(spinFrame.length > 0, `getSpinnerFrame("${style}", ${f}) is non-empty`);
      frames.push(spinFrame);
    }

    // Verify cycling: frames should repeat
    const uniqueFrames = new Set(frames);
    assert(uniqueFrames.size > 1 || style === "line", `Spinner "${style}" has multiple unique frames: ${uniqueFrames.size}`);

    console.log(`  Spinner "${style}": ${uniqueFrames.size} unique frames across 20 iterations [${[...uniqueFrames].join(" ")}]`);
  }, `getSpinnerFrame for style "${style}"`));
}

// ──────────────────────────────────────────────────────────────
// TEST: sparkline with data
// ──────────────────────────────────────────────────────────────
console.log("\n--- Sparkline Tests ---");
addResult(assertNoThrow(() => {
  const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const result = sparkline(data);
  assert(typeof result === "string", "sparkline returns a string");
  assert(result.length === data.length, `sparkline length matches data length: ${result.length} === ${data.length}`);

  // Each char should be one of the block chars
  const blockChars = "\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588";
  for (let i = 0; i < result.length; i++) {
    assert(blockChars.includes(result[i]), `sparkline char ${i} ("${result[i]}") is a valid block char`);
  }

  // Should be monotonically non-decreasing (since data is sorted ascending)
  for (let i = 1; i < result.length; i++) {
    assert(blockChars.indexOf(result[i]) >= blockChars.indexOf(result[i - 1]),
      `sparkline is non-decreasing at position ${i}`);
  }

  console.log(`  sparkline([1..10]): "${result}" (${result.length} chars)`);
}, "sparkline with ascending data"));

// ──────────────────────────────────────────────────────────────
// TEST: braillePattern for all types
// ──────────────────────────────────────────────────────────────
console.log("\n--- Braille Pattern Tests ---");
const patternTypes = ["dots", "diagonal", "wave", "crosshatch"] as const;

for (const pType of patternTypes) {
  addResult(assertNoThrow(() => {
    const pattern = braillePattern(pType, 20, 5);
    assert(pattern.length === 5, `braillePattern("${pType}") has correct height`);
    for (let i = 0; i < pattern.length; i++) {
      assert(pattern[i].length === 20, `braillePattern("${pType}") line ${i} has correct width (got ${pattern[i].length})`);
    }

    // Verify all characters are in the braille Unicode range
    for (const line of pattern) {
      for (const ch of line) {
        const code = ch.charCodeAt(0);
        assert(code >= 0x2800 && code <= 0x28ff, `braillePattern("${pType}") uses braille chars (got U+${code.toString(16)})`);
      }
    }

    console.log(`  braillePattern("${pType}", 20, 5): ${pattern.length} lines, all braille chars OK`);
    console.log(`    Sample: ${pattern[0]}`);
  }, `braillePattern type "${pType}"`));
}

// ──────────────────────────────────────────────────────────────
// TEST: frame() box-drawing with all border styles
// ──────────────────────────────────────────────────────────────
console.log("\n--- Box-Drawing frame() Tests ---");
const borderStyles = ["single", "double", "rounded", "heavy", "dashed", "ascii", "none"] as const;

for (const bs of borderStyles) {
  addResult(assertNoThrow(() => {
    const content = ["Hello, World!", "Line 2 here.", "Third line."];
    const framed = frame(content, bs);
    assert(framed.length === content.length + 2, `frame("${bs}") adds top+bottom borders: ${framed.length} lines`);

    const chars = getBorderChars(bs);

    // Top border should start with topLeft
    assert(framed[0].startsWith(chars.topLeft), `frame("${bs}") top starts with correct corner`);
    assert(framed[0].endsWith(chars.topRight), `frame("${bs}") top ends with correct corner`);

    // Bottom border
    assert(framed[framed.length - 1].startsWith(chars.bottomLeft), `frame("${bs}") bottom starts with correct corner`);
    assert(framed[framed.length - 1].endsWith(chars.bottomRight), `frame("${bs}") bottom ends with correct corner`);

    // Content lines should be wrapped with vertical chars
    for (let i = 1; i <= content.length; i++) {
      assert(framed[i].startsWith(chars.vertical), `frame("${bs}") content line ${i} starts with vertical`);
      assert(framed[i].endsWith(chars.vertical), `frame("${bs}") content line ${i} ends with vertical`);
    }

    console.log(`  frame("${bs}"): ${framed.length} lines, borders correct`);
    for (const l of framed) console.log(`    ${l}`);
  }, `frame() with border style "${bs}"`));
}

// ──────────────────────────────────────────────────────────────
// TEST: frame() with title
// ──────────────────────────────────────────────────────────────
addResult(assertNoThrow(() => {
  const content = ["Content here"];
  const framed = frame(content, "heavy", "TITLE");
  assert(framed.length === 3, "frame with title has 3 lines");
  assert(framed[0].includes("TITLE"), "frame with title contains title text in top border");
  console.log(`  frame("heavy", title="TITLE"): ${framed[0]}`);
}, "frame() with title"));

// ──────────────────────────────────────────────────────────────
// TEST: All icons from the art module
// ──────────────────────────────────────────────────────────────
console.log("\n--- ASCII Art Icons Tests ---");
const iconNames = Object.keys(icons);
console.log(`  Found ${iconNames.length} icons: ${iconNames.join(", ")}`);

for (const name of iconNames) {
  addResult(assertNoThrow(() => {
    const icon = icons[name];
    assert(Array.isArray(icon), `icons["${name}"] is an array`);
    assert(icon.length > 0, `icons["${name}"] is non-empty`);
    for (let i = 0; i < icon.length; i++) {
      assert(typeof icon[i] === "string", `icons["${name}"][${i}] is a string`);
    }
    console.log(`  Icon "${name}": ${icon.length} lines, max width=${Math.max(...icon.map(l => l.length))}`);
  }, `Icon "${name}" is valid`));
}

// ──────────────────────────────────────────────────────────────
// TEST: Custom block rendering
// ──────────────────────────────────────────────────────────────
console.log("\n--- Custom Block Rendering Tests ---");
addResult(assertNoThrow(() => {
  const ctx = createTestContext(80, customTheme);
  const lines = renderBlock(skullArt, ctx);
  assert(lines.length === 9, `Skull art custom block renders 9 lines (got ${lines.length})`);
  const hasContent = lines.some(l => l.trim().length > 0);
  assert(hasContent, "Skull art has visible content");
  console.log("  Skull art custom block:");
  for (const l of lines) console.log(`    ${l}`);
}, "Custom block: skull art"));

addResult(assertNoThrow(() => {
  const ctx = createTestContext(80, customTheme);
  const lines = renderBlock(decorativeBorder, ctx);
  assert(lines.length === 2, `Decorative border renders 2 lines (got ${lines.length})`);
  assert(lines[0].length > 0, "Decorative border has content");
  console.log(`  Decorative border: "${lines[0].slice(0, 40)}..."`);
}, "Custom block: decorative border"));

addResult(assertNoThrow(() => {
  const ctx = createTestContext(80, customTheme);
  const lines = renderBlock(matrixBlock, ctx);
  assert(lines.length === 5, `Matrix custom block renders 5 lines (got ${lines.length})`);
  console.log("  Matrix block:");
  for (const l of lines) console.log(`    ${stripAnsi(l)}`);
}, "Custom block: matrix rain"));

// ──────────────────────────────────────────────────────────────
// TEST: Heavy border style renders correctly
// ──────────────────────────────────────────────────────────────
console.log("\n--- Heavy Border Style Tests ---");
addResult(assertNoThrow(() => {
  const heavyChars = getBorderChars("heavy");
  assert(heavyChars.topLeft === "\u250f", `Heavy topLeft is \u250f`);
  assert(heavyChars.topRight === "\u2513", `Heavy topRight is \u2513`);
  assert(heavyChars.bottomLeft === "\u2517", `Heavy bottomLeft is \u2517`);
  assert(heavyChars.bottomRight === "\u251b", `Heavy bottomRight is \u251b`);
  assert(heavyChars.horizontal === "\u2501", `Heavy horizontal is \u2501`);
  assert(heavyChars.vertical === "\u2503", `Heavy vertical is \u2503`);

  // Test that heavy style is used in the site config
  assert(artisticConfig.borders === "heavy", "Site config uses heavy borders");

  // Render a frame with heavy borders
  const heavyFrame = frame(["HEAVY BORDER TEST"], "heavy");
  assert(heavyFrame[0].startsWith("\u250f"), "Heavy frame starts with correct corner");
  assert(heavyFrame[0].includes("\u2501"), "Heavy frame uses correct horizontal char");
  assert(heavyFrame[1].startsWith("\u2503"), "Heavy frame content uses correct vertical char");

  console.log("  Heavy border characters verified:");
  for (const l of heavyFrame) console.log(`    ${l}`);
}, "Heavy border style characters and rendering"));

// ──────────────────────────────────────────────────────────────
// TEST: Site config with custom theme renders in all contexts
// ──────────────────────────────────────────────────────────────
addResult(assertNoThrow(() => {
  const ctx = createTestContext(80, customTheme);
  assert(ctx.theme.accent === "#ff00ff", "Custom theme accent applied");
  assert(ctx.theme.text === "#00ffff", "Custom theme text applied");
  assert(ctx.theme.border === "#ff00ff", "Custom theme border applied");
  assert(ctx.theme.bg === "#000000", "Custom theme bg applied");
  console.log("  Custom theme fully applied to render context");
}, "Custom theme in render context"));

// ══════════════════════════════════════════════════════════════
//  FINAL REPORT
// ══════════════════════════════════════════════════════════════

console.log("\n" + "=".repeat(70));
console.log("  EXTENDED MODULE TEST RESULTS");
console.log("=".repeat(70));

const passed = extraResults.filter(r => r.passed).length;
const failed = extraResults.filter(r => !r.passed).length;
const total = extraResults.length;

console.log(`  Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
console.log("-".repeat(70));

for (const r of extraResults) {
  const icon = r.passed ? "\u2713" : "\u2717";
  let line = `  ${icon} ${r.name}`;
  if (r.error) line += ` -- ${r.error}`;
  if (r.details && r.passed) line += ` (${r.details})`;
  console.log(line);
}

// ─── Combined Summary ──────────────────────────────────────────
console.log("\n" + "=".repeat(70));
console.log("  COMBINED SUMMARY");
console.log("=".repeat(70));

const combinedTotal = siteReport.total + total;
const combinedPassed = siteReport.passed + passed;
const combinedFailed = siteReport.failed + failed;

console.log(`  Site Config Tests:    ${siteReport.passed}/${siteReport.total} passed`);
console.log(`  Extended Module Tests: ${passed}/${total} passed`);
console.log(`  COMBINED:             ${combinedPassed}/${combinedTotal} passed, ${combinedFailed} failed`);

if (siteReport.bugs.length > 0) {
  console.log(`\n  Bugs Found: ${siteReport.bugs.length}`);
  for (const bug of siteReport.bugs) {
    console.log(`    [${bug.severity}] ${bug.category}: ${bug.description}`);
  }
}

if (combinedFailed > 0) {
  console.log(`\n  !! ${combinedFailed} TESTS FAILED -- see details above !!`);
} else {
  console.log(`\n  ALL ${combinedPassed} TESTS PASSED`);
}

console.log("\n" + "=".repeat(70));
console.log("  [ CONNECTION TERMINATED ]");
console.log("=".repeat(70) + "\n");
