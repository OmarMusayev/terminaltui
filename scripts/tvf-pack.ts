#!/usr/bin/env node
/**
 * Pack a video into a `.tvf` frame pack.
 *
 * The same work `terminaltui video pack` does, available standalone so the
 * demos can regenerate their assets without going through the CLI.
 *
 *   npx tsx scripts/tvf-pack.ts <source> [out.tvf] [--width 400] [--fps 12]
 *                                        [--quality 5] [--start S] [--duration S]
 */
import { basename, extname, resolve } from "node:path";
import { statSync } from "node:fs";
import { buildPack, writePack, DEFAULT_PACK_FPS, DEFAULT_PACK_QUALITY, DEFAULT_PACK_WIDTH } from "../src/video/pack-build.js";

function flag(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) ? v : fallback;
}

const positional = process.argv.slice(2).filter((a, i, all) =>
  !a.startsWith("--") && !(i > 0 && all[i - 1].startsWith("--")));

const src = positional[0];
if (!src) {
  console.error("usage: tvf-pack <source> [out.tvf] [--width N] [--fps N] [--quality N] [--start S] [--duration S]");
  process.exit(2);
}

const out = positional[1] ?? src.replace(new RegExp(`${extname(src)}$`), ".tvf");
const startFlag = process.argv.indexOf("--start");
const durFlag = process.argv.indexOf("--duration");

const t0 = Date.now();
const built = buildPack(resolve(src), {
  width: flag("width", DEFAULT_PACK_WIDTH),
  fps: flag("fps", DEFAULT_PACK_FPS),
  quality: flag("quality", DEFAULT_PACK_QUALITY),
  start: startFlag === -1 ? undefined : Number(process.argv[startFlag + 1]),
  duration: durFlag === -1 ? undefined : Number(process.argv[durFlag + 1]),
});

if (!built.ok) {
  console.error(`pack failed: ${built.reason}`);
  if (built.hint) console.error(`  ${built.hint}`);
  process.exit(1);
}

writePack(resolve(out), built.bytes);
const h = built.header;
const size = statSync(resolve(out)).size;
console.log(
  `${basename(src)} -> ${out}\n` +
  `  ${h.width}x${h.height}  ${h.frameCount} frames  ${h.fps.toFixed(2)} fps  ` +
  `${(h.durationMs / 1000).toFixed(2)}s  via ${built.via}\n` +
  `  ${(size / 1024).toFixed(0)} KB total, ${(size / h.frameCount / 1024).toFixed(1)} KB/frame, ` +
  `packed in ${((Date.now() - t0) / 1000).toFixed(2)}s`,
);
