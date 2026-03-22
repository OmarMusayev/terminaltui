/**
 * terminaltui ASCII Art Showcase
 * Run with: npx tsx demo-showcase.ts
 */

import { renderBanner, centerBanner } from "./src/ascii/banner.js";
import { gradientLines } from "./src/style/gradient.js";
import { scene } from "./src/ascii/scenes.js";
import { icons } from "./src/ascii/art.js";
import { heart, diamond, star } from "./src/ascii/shapes.js";
import { pattern } from "./src/ascii/patterns.js";
import { barChart, sparkline, graph, pieChart } from "./src/ascii/dataviz.js";
import {
  sideBySide,
  rainbow,
  colorize,
  shadow,
  center,
} from "./src/ascii/compose.js";
import { fgColor, reset, detectColorSupport, setColorMode } from "./src/style/colors.js";
import { stringWidth } from "./src/components/base.js";

setColorMode(detectColorSupport());

const W = Math.min(process.stdout.columns || 80, 90);
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function label(text: string): void {
  console.log();
  const ruleLen = Math.max(0, W - stringWidth(text) - 6);
  console.log(
    fgColor("#888888") +
      "  ── " +
      reset +
      fgColor("#c0c0c0") +
      text +
      reset +
      fgColor("#888888") +
      " " +
      "─".repeat(ruleLen) +
      reset,
  );
  console.log();
}

function print(lines: string[]): void {
  for (const l of lines) console.log("  " + l);
}

async function main(): Promise<void> {
  console.log();

  // ── 1. Big banner ────────────────────────────────────────
  label("ANSI Shadow banner with gradient + shadow");
  let banner = renderBanner("TERM TUI", { font: "ANSI Shadow", shadow: true, width: W - 4 });
  banner = gradientLines(banner, ["#ff0080", "#7928ca"]);
  banner = centerBanner(banner, W);
  print(banner);
  await sleep(1200);

  // ── 2. Cityscape ─────────────────────────────────────────
  label("Cityscape scene (width 70)");
  print(colorize(scene("cityscape", { width: 70 }), "#4a9eff"));
  await sleep(1000);

  // ── 3. Rocket + Coffee side by side ──────────────────────
  label("Rocket + coffee cup side by side");
  const rocket = colorize(scene("rocket", { width: 25 }), "#ff6b6b");
  const coffee = colorize(scene("coffee-cup", { width: 25 }), "#d4a373");
  print(sideBySide(rocket, coffee, 4));
  await sleep(1000);

  // ── 4. Rainbow heart ─────────────────────────────────────
  label("Rainbow heart (size 8)");
  const h = heart(8);
  print(center(rainbow(h), W));
  await sleep(800);

  // ── 5. Bar chart ─────────────────────────────────────────
  label("Bar chart with gradient bars");
  const chart = barChart(
    [
      { label: "TypeScript", value: 95 },
      { label: "Rust", value: 80 },
      { label: "Go", value: 70 },
      { label: "Python", value: 65 },
      { label: "Zig", value: 40 },
    ],
    { width: 55, showValues: true },
  );
  print(chart);
  await sleep(800);

  // ── 6. Sparkline ─────────────────────────────────────────
  label("Sparkline (20 random values)");
  const spark = sparkline(
    Array.from({ length: 20 }, () => Math.floor(Math.random() * 100)),
    50,
  );
  print(spark);
  await sleep(600);

  // ── 7. Braille line graph ────────────────────────────────
  label("Braille-mode sine wave graph (30 points)");
  const sineData = Array.from({ length: 30 }, (_, i) =>
    Math.sin((i / 30) * Math.PI * 4) * 50 + 50,
  );
  const g = graph(sineData, 55, 12);
  print(g);
  await sleep(1000);

  // ── 8. Pie chart ─────────────────────────────────────────
  label("Pie chart (4 slices)");
  const pie = pieChart(
    [
      { label: "Frontend", value: 40 },
      { label: "Backend", value: 30 },
      { label: "DevOps", value: 20 },
      { label: "Design", value: 10 },
    ],
    7,
  );
  print(pie);
  await sleep(800);

  // ── 9. Circuit pattern ───────────────────────────────────
  label("Circuit board pattern (60x8)");
  const circ = pattern(60, 8, "circuit", { seed: 42 });
  print(colorize(circ, "#2dcc70"));
  await sleep(800);

  // ── 10. Icons in a row ───────────────────────────────────
  label("Icons: star, code, music, heart, terminal");
  const iconNames = ["star" as const, "code", "music", "heart", "terminal"];
  let row = icons[iconNames[0]] ?? ["?"];
  for (let i = 1; i < iconNames.length; i++) {
    row = sideBySide(row, icons[iconNames[i]] ?? ["?"], 2);
  }
  print(row);
  await sleep(800);

  // ── 11. Diamond + Star ───────────────────────────────────
  label("Diamond (size 10) + Star (5 points, radius 8)");
  const d = colorize(diamond(10), "#00d4ff");
  const s = colorize(star(5, 5), "#ffd700");
  print(sideBySide(d, s, 4));
  await sleep(600);

  // ── Finale ───────────────────────────────────────────────
  console.log();
  let outro = renderBanner("THAT'S ALL!", { font: "Calvin S" });
  outro = gradientLines(outro, ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff"]);
  outro = centerBanner(outro, W);
  print(outro);

  console.log();
  const tag = "  ✦ That's terminaltui's ASCII art system ✦  ";
  const pad = Math.max(0, Math.floor((W - tag.length) / 2));
  console.log(
    " ".repeat(pad) +
      fgColor("#7928ca") +
      tag +
      reset,
  );
  console.log();
}

main().catch(console.error);
