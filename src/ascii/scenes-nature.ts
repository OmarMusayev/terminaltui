/**
 * Nature-themed scene generators: ocean, space, clouds.
 * Split from scenes.ts to keep files under 400 lines.
 */

function createRng(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function trimLines(lines: string[]): string[] {
  return lines.map(l => l.replace(/\s+$/, ""));
}

export function sceneOcean(width: number): string[] {
  const height = 6;
  const lines: string[] = [];
  const waveChars = ["\u223f", "~", "\u2248", "~", "\u223f", "\u2248"];
  const deepChars = ["\u2591", "\u2248", "\u2591", "~"];

  for (let r = 0; r < height; r++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      const phase = (x + r * 3) % 8;
      if (r === 0) {
        line += phase < 4 ? "~" : " ";
      } else if (r === 1) {
        line += waveChars[(x + 1) % waveChars.length];
      } else if (r === 2) {
        line += (x + 2) % 6 < 3 ? "\u2248" : "~";
      } else if (r === 3) {
        line += (x + r) % 5 < 2 ? "\u2591" : "\u2248";
      } else {
        line += deepChars[(x + r) % deepChars.length];
      }
    }
    lines.push(line);
  }
  return trimLines(lines);
}

export function sceneSpace(width: number): string[] {
  const height = 8;
  const rng = createRng(42);
  const grid: string[][] = [];
  for (let r = 0; r < height; r++) grid.push(new Array(width).fill(" "));

  const starChars = ["\u00b7", "*", "\u2726", "\u2605", "\u00b7", "\u00b7", "*", "\u00b7"];
  const starCount = Math.floor(width * height * 0.08);
  for (let i = 0; i < starCount; i++) {
    const x = Math.floor(rng() * width);
    const y = Math.floor(rng() * height);
    grid[y][x] = starChars[Math.floor(rng() * starChars.length)];
  }

  const moonCx = Math.min(Math.floor(width * 0.75), width - 6);
  const moonCy = 1;
  const moonPattern = ["  \u256d\u2500\u2500\u256e", " \u2571    \u2502", "\u2502     \u2502", " \u2572   \u2571", "  \u2570\u2500\u256f"];
  for (let mr = 0; mr < moonPattern.length; mr++) {
    const row = moonCy + mr;
    if (row >= height) break;
    for (let mc = 0; mc < moonPattern[mr].length; mc++) {
      const col = moonCx + mc;
      if (col >= width) break;
      if (moonPattern[mr][mc] !== " ") grid[row][col] = moonPattern[mr][mc];
    }
  }
  return trimLines(grid.map(row => row.join("")));
}

export function sceneClouds(width: number): string[] {
  const height = 6;
  const grid: string[][] = [];
  for (let r = 0; r < height; r++) grid.push(new Array(width).fill(" "));

  const cloudPositions = [
    { x: Math.floor(width * 0.05), y: 0 },
    { x: Math.floor(width * 0.4), y: 1 },
    { x: Math.floor(width * 0.7), y: 0 },
    { x: Math.floor(width * 0.2), y: 3 },
    { x: Math.floor(width * 0.6), y: 3 },
  ];

  const cloudTemplate = [
    "   \u256d\u2500\u2500\u2500\u256e",
    " \u256d\u2500\u2524\u2591\u2591\u2591\u251c\u2500\u2500\u256e",
    "\u256d\u2524\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u251c\u256e",
    "\u2570\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u256f",
  ];

  for (const cp of cloudPositions) {
    for (let cr = 0; cr < cloudTemplate.length; cr++) {
      const row = cp.y + cr;
      if (row >= height) break;
      for (let cc = 0; cc < cloudTemplate[cr].length; cc++) {
        const col = cp.x + cc;
        if (col >= width) break;
        if (cloudTemplate[cr][cc] !== " ") grid[row][col] = cloudTemplate[cr][cc];
      }
    }
  }
  return trimLines(grid.map(row => row.join("")));
}
