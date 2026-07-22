/**
 * Panel focus-follow scrolling — renderPanel must slide its clip window so
 * the focused block stays visible instead of hard-clipping overflow away
 * (dashboard demo: comment cards below the fold were unreachable).
 */
import { renderPanel } from "../src/components/layout/Panel.js";
import type { RenderContext } from "../src/components/base.js";
import { defaultTheme } from "../src/style/theme.js";

let passed = 0;
let failed = 0;

function assert(cond: boolean, name: string): void {
  if (cond) {
    passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } else {
    failed++;
    console.log(`  \x1b[31m✘\x1b[0m ${name}`);
  }
}

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

/**
 * Fake content renderer: emits `total` numbered lines and, when the ctx has a
 * focusTrack, records the given focus range — mimicking renderContentBlocks.
 */
function fakeContent(total: number, focusStart: number, focusEnd: number) {
  return (_blocks: unknown, ctx: RenderContext): string[] => {
    if (ctx.focusTrack) {
      ctx.focusTrack.start = focusStart;
      ctx.focusTrack.end = focusEnd;
    }
    return Array.from({ length: total }, (_, i) => `line-${i}`);
  };
}

const baseCtx: RenderContext = { width: 30, theme: defaultTheme };
const panel = { content: [] } as any;

function renderLines(opts: {
  total: number; focusStart?: number; focusEnd?: number;
  height?: number; active?: boolean;
}): string[] {
  const { total, focusStart = -1, focusEnd = -1, height = 10, active = true } = opts;
  return renderPanel(panel, baseCtx, {
    width: 30,
    height,
    active,
    renderContent: fakeContent(total, focusStart, focusEnd) as any,
  }).map(strip);
}

console.log("\n\x1b[1m  Panel scroll window\x1b[0m");

{
  // Content fits — no scrolling, no markers.
  const lines = renderLines({ total: 5, focusStart: 0, focusEnd: 2 });
  assert(lines.some(l => l.includes("line-0")), "fitting content starts at line 0");
  assert(!lines.some(l => l.includes("more")), "fitting content has no overflow markers");
  assert(lines.length === 10, "panel pads to exact height");
}

{
  // Focus near the top of overflowing content — window stays at the top.
  const lines = renderLines({ total: 30, focusStart: 0, focusEnd: 3 });
  assert(lines.some(l => l.includes("line-0")), "top focus keeps window at top");
  assert(lines.some(l => l.includes("↓ more")), "overflow below shows ↓ more marker");
  assert(!lines.some(l => l.includes("↑ more")), "no ↑ marker when at top");
}

{
  // Focus below the fold — window slides down to keep it visible.
  const lines = renderLines({ total: 30, focusStart: 18, focusEnd: 22 });
  assert(lines.some(l => l.includes("line-21")), "focused block end is visible");
  assert(lines.some(l => l.includes("line-18")), "focused block start is visible");
  assert(lines.some(l => l.includes("↑ more")), "overflow above shows ↑ more marker");
  assert(lines.some(l => l.includes("↓ more")), "overflow below shows ↓ more marker");
}

{
  // Focus at the very end — window bottom-aligns, no ↓ marker.
  const lines = renderLines({ total: 30, focusStart: 27, focusEnd: 30 });
  assert(lines.some(l => l.includes("line-29")), "last line visible when focus at end");
  assert(!lines.some(l => l.includes("↓ more")), "no ↓ marker at bottom");
  assert(lines.some(l => l.includes("↑ more")), "↑ marker shown at bottom");
}

{
  // Focused block taller than the window — anchor to its start.
  const lines = renderLines({ total: 40, focusStart: 10, focusEnd: 30 });
  assert(lines.some(l => l.includes("line-10")), "oversized focus block anchors to its start");
  assert(!lines.some(l => l.includes("↑ more")), "marker suppressed when it would cover the focused block");
}

{
  // No focus info (inactive panel) — clips from the top, still hints overflow.
  const lines = renderLines({ total: 30, active: false });
  assert(lines.some(l => l.includes("line-0")), "inactive panel clips from top");
  assert(lines.some(l => l.includes("↓ more")), "inactive overflowing panel shows ↓ more");
}

{
  // Focus range covering the whole window suppresses both markers.
  const lines = renderLines({ total: 30, focusStart: 5, focusEnd: 15 });
  assert(lines.some(l => l.includes("line-5")) && lines.some(l => l.includes("line-14")),
    "window-filling focus block fully visible");
  assert(!lines.some(l => l.includes("more")), "markers suppressed when focus fills the window");
}

{
  // Narrow bordered panel — the marker must clamp to innerWidth so the
  // final width clip never eats the right border (review finding).
  const lines = renderPanel({ content: [], border: true } as any, baseCtx, {
    width: 9,
    height: 10,
    active: true,
    renderContent: fakeContent(30, 0, 3) as any,
  }).map(strip);
  const markerLine = lines.find(l => l.includes("↓"));
  assert(markerLine !== undefined, "narrow bordered panel still shows a ↓ marker");
  assert(markerLine !== undefined && markerLine.endsWith("│"),
    `marker line keeps the right border (got: ${JSON.stringify(markerLine)})`);
  assert(lines.every(l => [...l].length <= 9 || l.includes("…") === false),
    "no marker line exceeds the panel width");
}

console.log(`\n  Total: ${passed + failed}  Passed: ${passed}  Failed: ${failed}\n`);
if (failed > 0) process.exit(1);
