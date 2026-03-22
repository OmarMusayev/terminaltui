import { setColorMode } from "../src/style/colors.js";
setColorMode("256");

const sites = [
  "developer-portfolio", "restaurant", "startup-landing", "band", "coffee-shop",
  "conference", "freelancer", "podcast", "docs-site", "art-gallery",
];

function countFocusable(blocks: any[]): number {
  let count = 0;
  for (const b of blocks) {
    if (b.type === "card" || b.type === "link" || b.type === "hero") count++;
    else if (b.type === "accordion") count += b.items.length;
    else if (b.type === "timeline") count += b.items.length;
    else if (b.type === "tabs") count++;
    else if (b.type === "section") count += countFocusable(b.content);
  }
  return count;
}

async function main() {
  let issues = 0;
  for (const site of sites) {
    const mod = await import(`./${site}/site.config.ts`);
    const config = mod.default?.config ?? mod.default;
    for (const page of config.pages) {
      const f = countFocusable(page.content);
      const flag = f === 0 ? " ← NONE!" : "";
      if (f === 0) issues++;
      console.log(`  ${site.padEnd(22)} ${page.title.padEnd(16)} ${String(f).padStart(3)} focusable${flag}`);
    }
  }
  console.log();
  console.log(issues === 0 ? "  ALL PAGES HAVE FOCUSABLE ITEMS ✓" : `  ${issues} pages need fixing`);
}
main();
