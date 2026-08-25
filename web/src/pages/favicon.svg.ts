/**
 * The browser icon is generated directly from the selected logo grid. Keeping
 * it on the same source as Nav and Footer prevents a second drawing drifting.
 */
import { MARK } from "@/data/logo";

export const prerender = true;

type Run = { x: number; y: number; width: number; channel: "ink" | "accent" };

function runs(rows: readonly string[]): Run[] {
  const output: Run[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const cell = row[x];
      if (cell !== "#" && cell !== "+") {
        x += 1;
        continue;
      }
      let width = 1;
      while (row[x + width] === cell) width += 1;
      output.push({ x, y, width, channel: cell === "+" ? "accent" : "ink" });
      x += width;
    }
  });
  return output;
}

export function GET() {
  const cells = runs(MARK)
    .map(({ x, y, width, channel }) =>
      `<rect class="${channel}" x="${x}" y="${y}" width="${width}" height="1"/>`,
    )
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><style>.ink{fill:#14140f}.accent{fill:#cc3700}@media(prefers-color-scheme:dark){.ink{fill:#f2f1ec}.accent{fill:#ff6b3d}}</style>${cells}</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
