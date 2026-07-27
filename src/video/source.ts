/**
 * Turning a `path` on a video block into bytes the player can open.
 *
 * Three cases, and the interesting one is the third:
 *
 *   *.tvf          already a pack — read it, done.
 *   *.gif          packed here and now, in pure TypeScript. A 36-frame GIF
 *                  packs in a few milliseconds, which is inside a frame budget,
 *                  so there is no reason to make the user run a build step.
 *   *.mp4 etc.     needs ffmpeg, which takes seconds. Packed IN THE BACKGROUND.
 *
 * THE RENDER PASS IS SYNCHRONOUS AND MUST NOT BLOCK. Spending two seconds in
 * ffmpeg inside `renderVideo` would freeze the whole terminal — not just the
 * video, but the menu, the keyboard, everything — on the frame where a page
 * containing a video is first opened. So a heavyweight source is packed by an
 * ffmpeg child process running off the event loop; meanwhile the block renders
 * its alt box, and when the pack lands the runtime is asked to repaint. The
 * first second of a video page looks like a placeholder, and then it plays.
 *
 * Packs are cached in `.terminaltui/video/<sha1-of-source>.tvf` next to the
 * project, keyed by the SOURCE's hash. Replacing the source file changes the
 * hash and therefore the pack, so a stale pack cannot outlive its input — and
 * a pack that is already there is just a file read.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { isAbsolute, join, resolve, extname } from "node:path";

import {
  DEFAULT_PACK_FPS, DEFAULT_PACK_QUALITY, DEFAULT_PACK_WIDTH,
  buildPack, ffmpegBinary, jpegDimensions, packFrames, splitMjpeg,
} from "./pack-build.js";
import { MAX_PACK_BYTES, decodePack } from "./pack.js";
import { probeMp4 } from "./mp4-probe.js";

export interface VideoSourceOk {
  ok: true;
  /** Identity of the resolved pack — changes when the pack changes. */
  key: string;
  /** Pack bytes, when they are already in hand. */
  bytes?: Uint8Array;
  /** Pack path, when it is on disk. */
  packPath?: string;
  /** Frame dimensions, for geometry before any decode. */
  size?: { width: number; height: number };
}

export interface VideoSourcePending {
  ok: false;
  reason: string;
  /** True while a background pack is running — the caller should keep the alt box. */
  packing: boolean;
  /** Known source dimensions, so the block can be sized before its pack exists. */
  size?: { width: number; height: number };
  hint?: string;
}

export type VideoSource = VideoSourceOk | VideoSourcePending;

/** What the runtime needs to be told when a background pack finishes. */
export type RepaintHook = () => void;

let repaintHook: RepaintHook | null = null;

/**
 * Register the callback fired when a background pack completes.
 *
 * Set by the runtime at startup. Without it a video whose pack was still
 * building would sit on its alt box until some other event happened to trigger
 * a repaint.
 */
export function setVideoRepaintHook(hook: RepaintHook | null): void {
  repaintHook = hook;
}

// ─── Pack cache ───────────────────────────────────────────

type PackState =
  | { status: "ready"; packPath: string; key: string; size?: { width: number; height: number } }
  | { status: "packing"; since: number }
  | { status: "failed"; reason: string; hint?: string };

/** Keyed by absolute source path. Module-level: packs are process-wide. */
const PACKS = new Map<string, PackState>();

/** Dimensions read from a raw source, so geometry works before the pack exists. */
const SOURCE_SIZES = new Map<string, { width: number; height: number } | null>();

/** Reset everything. Tests only. */
export function clearVideoSourceCache(): void {
  PACKS.clear();
  SOURCE_SIZES.clear();
  OPENED.clear();
}

// ─── Resolution ───────────────────────────────────────────

const PACKABLE = new Set([".gif", ".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"]);

export function resolveSource(path: string, projectDir?: string): VideoSource {
  const trimmed = path.trim();
  if (trimmed.length === 0) return { ok: false, reason: "empty path", packing: false };

  // Remote sources cannot be opened synchronously, exactly as for images.
  if (/^https?:/i.test(trimmed)) {
    return {
      ok: false, packing: false,
      reason: "remote video sources cannot be opened synchronously",
      hint: "pack it ahead of time: terminaltui video pack <url-downloaded-file>",
    };
  }

  const root = projectDir ?? process.cwd();
  const abs = isAbsolute(trimmed) ? trimmed : resolve(root, trimmed);
  if (!existsSync(abs)) {
    return { ok: false, reason: `no such file: ${trimmed}`, packing: false };
  }

  const ext = extname(abs).toLowerCase();
  if (ext === ".tvf") return openTvf(abs);
  if (!PACKABLE.has(ext)) {
    return {
      ok: false, packing: false,
      reason: `unsupported video source "${ext}"`,
      hint: "use .tvf, .gif, or a source ffmpeg can read (.mp4/.mov/.webm)",
    };
  }
  return packed(abs, root);
}

/**
 * Opened packs, keyed by (path, mtime, size).
 *
 * THIS CACHE IS NOT AN OPTIMISATION, IT IS LOAD-BEARING. `resolveSource` runs
 * inside the render pass and is called TWICE per frame — once by
 * `videoCellSize` to fix the geometry and once by `renderVideo` to get the
 * player — so an uncached `readFileSync` of a 445 KB pack costs about 10 MB/s
 * of file reads at 12 fps, for bytes that never change.
 *
 * Keyed on mtime and size rather than path alone so a pack replaced under a
 * running dev server is picked up. Unlike the still-image path there is no
 * stat throttle here: a `.tvf` is a build artifact, not a rotating frame file,
 * so a stat per call is both cheap and correct.
 */
const OPENED = new Map<string, { key: string; bytes: Uint8Array; size: { width: number; height: number } }>();

/**
 * Bound on the pack cache.
 *
 * Small because entries are whole packs: a handful of megabytes each. Video is
 * watched one clip at a time, so anything past a few entries is a page nobody
 * is looking at.
 */
const OPENED_MAX = 4;

function openTvf(abs: string): VideoSource {
  try {
    const st = statSync(abs);
    if (!st.isFile()) return { ok: false, reason: `not a regular file: ${abs}`, packing: false };
    const key = `${abs}:${st.mtimeMs}:${st.size}`;

    const hit = OPENED.get(abs);
    if (hit && hit.key === key) return { ok: true, key, bytes: hit.bytes, size: hit.size };

    // The same ceiling `openPack` enforces, applied BEFORE the read rather
    // than after it. A file that loads through this door and is refused at
    // another is exactly the asymmetry the shared constant exists to prevent —
    // and checking the stat costs nothing, where reading half a gigabyte to
    // then reject it does not.
    if (st.size > MAX_PACK_BYTES) {
      return { ok: false, reason: `${st.size} bytes exceeds the ${MAX_PACK_BYTES}-byte pack ceiling`, packing: false };
    }

    // Cache the WHOLE FILE, not the payload: the player is handed these bytes
    // and runs `decodePack` on them, so the header has to still be attached.
    const bytes = new Uint8Array(readFileSync(abs));
    const decoded = decodePack(bytes);
    if (!decoded.ok) return { ok: false, reason: decoded.reason, packing: false };

    const size = { width: decoded.pack.header.width, height: decoded.pack.header.height };
    if (OPENED.size >= OPENED_MAX) {
      const oldest = OPENED.keys().next();
      if (!oldest.done) OPENED.delete(oldest.value);
    }
    OPENED.set(abs, { key, bytes, size });
    return { ok: true, key, bytes, size };
  } catch (e) {
    return { ok: false, reason: (e as Error).message, packing: false };
  }
}

/**
 * A raw source, packed on demand.
 *
 * GIF packs inline because it is pure TypeScript and fast. Everything else is
 * handed to a background ffmpeg, and the caller gets `packing: true` until it
 * lands — with the source's real dimensions attached, so the block reserves
 * the right number of rows from the very first frame and does not jump when
 * the picture appears.
 */
function packed(abs: string, root: string): VideoSource {
  const state = PACKS.get(abs);

  if (state?.status === "ready") {
    return { ok: true, key: state.key, packPath: state.packPath, size: state.size };
  }
  if (state?.status === "packing") {
    return { ok: false, reason: "packing…", packing: true, size: sourceSize(abs) ?? undefined };
  }
  if (state?.status === "failed") {
    return { ok: false, reason: state.reason, hint: state.hint, packing: false, size: sourceSize(abs) ?? undefined };
  }

  // Not seen before. Is a cached pack already on disk?
  const cachePath = cachePathFor(abs, root);
  if (existsSync(cachePath)) {
    const opened = openTvf(cachePath);
    if (opened.ok) {
      PACKS.set(abs, { status: "ready", packPath: cachePath, key: opened.key, size: opened.size });
      return { ok: true, key: opened.key, packPath: cachePath, size: opened.size };
    }
    // A corrupt cache entry is not fatal — fall through and rebuild it.
  }

  if (extname(abs).toLowerCase() === ".gif") {
    const built = buildPack(abs, { width: DEFAULT_PACK_WIDTH });
    if (!built.ok) {
      PACKS.set(abs, { status: "failed", reason: built.reason, hint: built.hint });
      return { ok: false, reason: built.reason, hint: built.hint, packing: false };
    }
    writeAtomic(cachePath, built.bytes);
    const size = { width: built.header.width, height: built.header.height };
    const key = `${cachePath}:${built.header.sourceSha1}`;
    PACKS.set(abs, { status: "ready", packPath: cachePath, key, size });
    return { ok: true, key, packPath: cachePath, size, bytes: built.bytes };
  }

  startBackgroundPack(abs, cachePath);
  return { ok: false, reason: "packing…", packing: true, size: sourceSize(abs) ?? undefined };
}

// ─── Background packing ───────────────────────────────────

/**
 * Run ffmpeg off the event loop and assemble the pack when it exits.
 *
 * `spawn` rather than `spawnSync` is the entire point: the render pass returns
 * immediately with an alt box, ffmpeg works in another process, and the
 * repaint hook brings the picture in when it is ready.
 */
function startBackgroundPack(abs: string, cachePath: string): void {
  PACKS.set(abs, { status: "packing", since: Date.now() });

  const width = DEFAULT_PACK_WIDTH;
  const child = spawn(ffmpegBinary(), [
    "-v", "error", "-i", abs, "-an", "-sn", "-dn",
    "-vf", `fps=${DEFAULT_PACK_FPS},scale=${width}:-2:flags=lanczos`,
    "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", String(DEFAULT_PACK_QUALITY), "-",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  const chunks: Buffer[] = [];
  let stderr = "";
  child.stdout.on("data", (c: Buffer) => chunks.push(c));
  child.stderr.on("data", (c: Buffer) => { stderr += c.toString(); });

  child.on("error", (err: NodeJS.ErrnoException) => {
    const missing = err.code === "ENOENT";
    PACKS.set(abs, {
      status: "failed",
      reason: missing ? "ffmpeg not found" : `ffmpeg failed: ${err.message}`,
      hint: missing
        ? "brew install ffmpeg — needed only to PACK video, never to play it. GIF sources need no tooling."
        : undefined,
    });
    repaintHook?.();
  });

  child.on("close", (code) => {
    if (code !== 0) {
      PACKS.set(abs, {
        status: "failed",
        reason: `ffmpeg exited ${code}: ${stderr.trim().split("\n").slice(-1)[0] ?? ""}`,
      });
      repaintHook?.();
      return;
    }
    try {
      const assembled = assemble(Buffer.concat(chunks), abs);
      if (!assembled) {
        PACKS.set(abs, { status: "failed", reason: "ffmpeg produced no frames" });
      } else {
        writeAtomic(cachePath, assembled.bytes);
        PACKS.set(abs, {
          status: "ready", packPath: cachePath, key: `${cachePath}:${assembled.sha1}`,
          size: assembled.size,
        });
      }
    } catch (e) {
      PACKS.set(abs, { status: "failed", reason: `pack assembly failed: ${(e as Error).message}` });
    }
    repaintHook?.();
  });

  child.unref?.();
}

/** Split the MJPEG stream and wrap it in a pack. Shares `pack-build`'s helpers. */
function assemble(
  stdout: Buffer,
  src: string,
): { bytes: Uint8Array; sha1: string; size: { width: number; height: number } } | null {
  const frames = splitMjpeg(new Uint8Array(stdout));
  if (frames.length === 0) return null;
  const dims = jpegDimensions(frames[0]);
  if (!dims) return null;
  const sha1 = sha1Of(src);
  return {
    bytes: packFrames(frames, {
      width: dims.width, height: dims.height, fps: DEFAULT_PACK_FPS,
      frameCount: frames.length,
      durationMs: Math.round((frames.length / DEFAULT_PACK_FPS) * 1000),
      sourceSha1: sha1,
    }),
    sha1,
    size: dims,
  };
}

// ─── Sizing before the pack exists ────────────────────────

/**
 * Dimensions of a raw source, so `videoCellSize` can fix the row count on the
 * very first pass — before ffmpeg has produced anything.
 *
 * This is invariant #2 doing real work: without it a video page would render
 * a default-sized alt box, then jump to the true aspect a second later, moving
 * every focus rect below it.
 */
function sourceSize(abs: string): { width: number; height: number } | null {
  if (SOURCE_SIZES.has(abs)) return SOURCE_SIZES.get(abs) ?? null;
  let size: { width: number; height: number } | null = null;
  try {
    const ext = extname(abs).toLowerCase();
    if (ext === ".gif") {
      // Logical screen descriptor: width and height are LE u16 at offset 6.
      const head = readFileSync(abs).subarray(0, 10);
      if (head.length >= 10 && head.toString("ascii", 0, 3) === "GIF") {
        size = { width: head.readUInt16LE(6), height: head.readUInt16LE(8) };
      }
    } else {
      size = probeMp4(abs);
    }
  } catch {
    size = null;
  }
  SOURCE_SIZES.set(abs, size);
  return size;
}

// ─── Paths ────────────────────────────────────────────────

export function cachePathFor(abs: string, root: string): string {
  return join(root, ".terminaltui", "video", `${sha1Of(abs).slice(0, 16)}.tvf`);
}

function sha1Of(abs: string): string {
  // Hash the source's PATH plus its mtime and size rather than its contents:
  // hashing a 4 MB file on every page render is a cost the cache exists to
  // avoid, and (path, mtime, size) changes whenever the file is replaced.
  try {
    const st = statSync(abs);
    return createHash("sha1").update(`${abs}:${st.mtimeMs}:${st.size}`).digest("hex");
  } catch {
    return createHash("sha1").update(abs).digest("hex");
  }
}

/**
 * Write through a temp file and rename.
 *
 * A pack half-written when the process is killed would be indistinguishable
 * from a valid cache entry on the next run, and `decodePack` would reject it
 * forever. Rename is atomic within a filesystem, so the cache only ever
 * contains complete packs.
 */
function writeAtomic(path: string, bytes: Uint8Array): void {
  mkdirSync(join(path, ".."), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, bytes);
  renameSync(tmp, path);
}
