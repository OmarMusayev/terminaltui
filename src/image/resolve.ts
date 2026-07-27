/**
 * Turning a page author's `image("./photo.png")` into bytes the decoder can read.
 *
 * This is deliberately the ONLY place that knows how a source string maps to a
 * location. `renderBlock()` is synchronous and runs every frame, so everything
 * here is sync, allocation-light and memoised — a resolution is pure string
 * arithmetic plus, at most, one `realpathSync` that is answered from a memo on
 * every subsequent frame.
 *
 * Why not `process.cwd()`: `terminaltui dev demos/x/config.ts` runs from the
 * repo root while the page lives in `demos/x/`, and `terminaltui demo <name>`
 * runs a project that lives inside `node_modules`. In both cases cwd is the
 * wrong root, which is why `projectDir` is threaded down from the runtime and
 * cwd is only ever the fallback.
 *
 * No imports from src/core — this module must stay loadable from the cache and
 * the component renderer without creating a cycle.
 */

import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, relative, resolve as resolvePath, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { IMAGE_LIMITS } from "./types.js";

/**
 * Why a resolution failed. Every value maps to a distinct alt-text wording, so
 * do not collapse them.
 * - `empty`              — blank source string.
 * - `remote`             — http(s); needs the async path, see the module notes.
 * - `outside-project`    — a relative path escaped `projectDir`.
 * - `bad-data-uri`       — malformed or empty `data:` payload.
 * - `too-large`          — inline payload over `IMAGE_LIMITS.maxSourceBytes`.
 * - `unsupported-scheme` — a URI scheme we have no reader for.
 */
export type ResolveFailureReason =
  | "empty"
  | "remote"
  | "outside-project"
  | "bad-data-uri"
  | "too-large"
  | "unsupported-scheme";

export interface ResolvedImageOk {
  ok: true;
  /**
   * For `kind: "file"`, an absolute filesystem path.
   * For `kind: "data"`, a synthetic content identity of the form
   * `data:sha1-<hex>`. It is deliberately NOT an absolute path so the cache can
   * tell content-addressed sources from files with `path.isAbsolute()` and skip
   * the `statSync` that would otherwise key the entry.
   */
  path: string;
  kind: "file" | "data";
  /** Decoded bytes. Present if and only if `kind === "data"`. */
  buffer?: Buffer;
}

export interface ResolvedImageErr {
  ok: false;
  reason: ResolveFailureReason;
  detail: string;
}

export type ResolvedImage = ResolvedImageOk | ResolvedImageErr;

export interface ResolveOptions {
  /**
   * Reject a path that stays inside `projectDir` lexically but whose real
   * target escapes it through a symlink. Defaults to true whenever
   * `projectDir` is supplied; ignored otherwise, because without a project
   * root there is nothing to escape from.
   */
  symlinkGuard?: boolean;
}

// ─── Memo ─────────────────────────────────────────────────

/**
 * Resolution is deterministic in (source, projectDir, guard), so it memoises
 * cleanly. This matters for two reasons: `data:` URIs cost a base64 decode plus
 * a SHA-1 over the payload (~3 ms for 1 MB, per frame, without this), and the
 * symlink guard costs a `realpathSync` per frame per image.
 *
 * Bounded on BOTH entry count and bytes, because a memo that holds decoded
 * `data:` buffers is a memory leak the moment a page generates URIs
 * dynamically. Entries are evicted oldest-first.
 */
const MEMO_MAX_ENTRIES = 64;
const MEMO_MAX_BYTES = 8 * 1024 * 1024;

interface MemoEntry {
  value: ResolvedImage;
  bytes: number;
}

const memo = new Map<string, MemoEntry>();
let memoBytes = 0;

function memoGet(key: string): ResolvedImage | undefined {
  const hit = memo.get(key);
  if (hit === undefined) return undefined;
  // Map preserves insertion order, so re-inserting is the LRU touch.
  memo.delete(key);
  memo.set(key, hit);
  return hit.value;
}

function memoSet(key: string, value: ResolvedImage): ResolvedImage {
  const bytes = value.ok && value.buffer ? value.buffer.byteLength : 0;
  const prev = memo.get(key);
  if (prev !== undefined) {
    memoBytes -= prev.bytes;
    memo.delete(key);
  }
  memo.set(key, { value, bytes });
  memoBytes += bytes;
  while ((memo.size > MEMO_MAX_ENTRIES || memoBytes > MEMO_MAX_BYTES) && memo.size > 0) {
    const oldest = memo.keys().next().value;
    if (oldest === undefined) break;
    const dropped = memo.get(oldest);
    memo.delete(oldest);
    if (dropped !== undefined) memoBytes -= dropped.bytes;
  }
  return value;
}

/**
 * Drop every memoised resolution. Tests that create a fixture, resolve it, then
 * replace it with a symlink need this — the guard result is memoised and the
 * filesystem is not re-consulted otherwise.
 *
 * Note this is separate from `clearImageCache()` in cache.ts; a full reset in a
 * test calls both.
 */
export function clearResolveCache(): void {
  memo.clear();
  memoBytes = 0;
}

// ─── Scheme handling ──────────────────────────────────────

/**
 * A URI scheme is at least TWO characters, which is what keeps a Windows drive
 * letter (`C:/pics/a.png`) from being read as a scheme.
 */
const SCHEME_RE = /^([a-zA-Z][a-zA-Z0-9+.-]+):/;

function fail(reason: ResolveFailureReason, detail: string): ResolvedImageErr {
  return { ok: false, reason, detail };
}

/**
 * Resolve an image source string to an absolute path or to inline bytes.
 *
 * Resolution order:
 *   1. `data:` URI          -> decoded to a Buffer with a content identity
 *   2. `http(s):` URL       -> rejected as "remote" (see module notes)
 *   3. `file:` URL          -> converted to a path, then treated as absolute
 *   4. any other scheme     -> rejected as "unsupported-scheme"
 *   5. `~/...`              -> expanded against the home directory
 *   6. absolute path        -> used as-is
 *   7. relative path        -> resolved against `projectDir`, else `process.cwd()`
 *
 * The traversal guard only applies to case 7 and only when `projectDir` is
 * supplied. Absolute paths from a page author are TRUSTED on purpose: the page
 * is the author's own executable TypeScript, so a path guard there protects
 * nothing that `readFileSync` in the same file would not defeat. The guard
 * exists for the case that is genuinely untrusted — a relative path assembled
 * from input during a `terminaltui serve` session, where the project root is a
 * real boundary.
 *
 * Never throws. Existence is not checked here; a missing file surfaces as the
 * decoder's `not-found`, which keeps one failure taxonomy instead of two.
 */
export function resolveImagePath(
  source: string,
  projectDir?: string,
  opts: ResolveOptions = {},
): ResolvedImage {
  const raw = source.trim();
  if (raw === "") return fail("empty", "image source is empty");

  const guard = opts.symlinkGuard ?? true;
  const memoKey = `${projectDir ?? ""}\u0000${guard ? 1 : 0}\u0000${raw}`;
  const cached = memoGet(memoKey);
  if (cached !== undefined) return cached;

  const scheme = SCHEME_RE.exec(raw)?.[1]?.toLowerCase();
  if (scheme !== undefined) {
    switch (scheme) {
      case "data":
        return memoSet(memoKey, decodeDataUri(raw));
      case "http":
      case "https":
        return memoSet(
          memoKey,
          fail("remote", `remote images are not decodable synchronously: ${raw}`),
        );
      case "file": {
        let filePath: string;
        try {
          filePath = fileURLToPath(raw);
        } catch (err) {
          return memoSet(
            memoKey,
            fail("unsupported-scheme", `malformed file: URL: ${describe(err)}`),
          );
        }
        // A file: URL is an explicit absolute location, so it inherits the
        // same "author's own code is trusted" rule as a bare absolute path.
        return memoSet(memoKey, { ok: true, kind: "file", path: resolvePath(filePath) });
      }
      default:
        return memoSet(
          memoKey,
          fail("unsupported-scheme", `no reader for "${scheme}:" sources`),
        );
    }
  }

  const expanded = expandHome(raw);

  if (isAbsolute(expanded)) {
    // resolvePath normalises away any embedded "..", so the cache key for two
    // spellings of the same file is one key.
    return memoSet(memoKey, { ok: true, kind: "file", path: resolvePath(expanded) });
  }

  if (projectDir === undefined) {
    // cwd can change under us via process.chdir(), so this branch is NOT
    // memoised. It is pure string arithmetic and costs nothing to redo.
    return { ok: true, kind: "file", path: resolvePath(process.cwd(), expanded) };
  }

  const root = resolvePath(projectDir);
  const abs = resolvePath(root, expanded);
  if (!contains(root, abs)) {
    return memoSet(
      memoKey,
      fail("outside-project", `"${raw}" resolves outside the project root`),
    );
  }

  if (guard && !realContains(root, abs)) {
    return memoSet(
      memoKey,
      fail("outside-project", `"${raw}" is a link whose target escapes the project root`),
    );
  }

  return memoSet(memoKey, { ok: true, kind: "file", path: abs });
}

/**
 * The argument to hand `decodeImage()` — inline bytes when we have them, the
 * absolute path otherwise. Exists so callers never have to remember which
 * `kind` carries a buffer.
 */
export function imageSourceOf(resolved: ResolvedImageOk): string | Buffer {
  return resolved.buffer ?? resolved.path;
}

// ─── Containment ──────────────────────────────────────────

/**
 * True when `target` is `root` or lives beneath it.
 *
 * The naive `rel.startsWith("..")` test is wrong: `relative("/a", "/a/..cache")`
 * is `"..cache"`, a legitimate child that the naive test rejects. Only a `..`
 * that is a whole path segment means "escaped".
 */
function contains(root: string, target: string): boolean {
  const rel = relative(root, target);
  if (rel === "") return true;
  if (isAbsolute(rel)) return false; // different drive on Windows
  return rel !== ".." && !rel.startsWith(`..${sep}`);
}

/**
 * The same test after resolving symlinks on BOTH sides.
 *
 * Both sides matter: on macOS `/tmp` is itself a symlink to `/private/tmp`, so
 * comparing a real target against a lexical root would reject every file in a
 * project under `/tmp`.
 *
 * A target that does not exist yet cannot be checked, so we fall through to the
 * lexical verdict and let the decoder report `not-found`.
 */
function realContains(root: string, target: string): boolean {
  let realRoot: string;
  try {
    realRoot = realpathSync(root);
  } catch {
    realRoot = root;
  }
  let realTarget: string;
  try {
    realTarget = realpathSync(target);
  } catch {
    return true;
  }
  return contains(realRoot, realTarget);
}

// ─── Home expansion ───────────────────────────────────────

function expandHome(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) return resolvePath(homedir(), p.slice(2));
  return p;
}

// ─── data: URIs ───────────────────────────────────────────

const DATA_PREFIX = "data:".length;

/**
 * Decode `data:[<mediatype>][;base64],<payload>`.
 *
 * The size budget is checked against the ENCODED length before allocating, so a
 * 200 MB inline payload is refused without ever materialising a Buffer.
 */
function decodeDataUri(raw: string): ResolvedImage {
  const comma = raw.indexOf(",");
  if (comma < 0) return fail("bad-data-uri", "data: URI has no comma separator");

  const meta = raw.slice(DATA_PREFIX, comma);
  const payload = raw.slice(comma + 1);
  if (payload === "") return fail("bad-data-uri", "data: URI has an empty payload");

  const isBase64 = meta
    .split(";")
    .some((token) => token.trim().toLowerCase() === "base64");

  // 4 base64 characters carry 3 bytes; percent-escapes only ever shrink.
  const approxBytes = isBase64 ? Math.floor((payload.length * 3) / 4) : payload.length;
  if (approxBytes > IMAGE_LIMITS.maxSourceBytes) {
    return fail(
      "too-large",
      `inline payload is ~${approxBytes} bytes, over the ${IMAGE_LIMITS.maxSourceBytes} byte budget`,
    );
  }

  let buffer: Buffer;
  try {
    buffer = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "latin1");
  } catch (err) {
    return fail("bad-data-uri", `could not decode payload: ${describe(err)}`);
  }

  // Buffer.from(..., "base64") silently ignores invalid characters, so an
  // entirely bogus payload comes back empty rather than throwing.
  if (buffer.byteLength === 0) {
    return fail("bad-data-uri", "payload decoded to zero bytes");
  }
  if (buffer.byteLength > IMAGE_LIMITS.maxSourceBytes) {
    return fail(
      "too-large",
      `inline payload is ${buffer.byteLength} bytes, over the ${IMAGE_LIMITS.maxSourceBytes} byte budget`,
    );
  }

  // Content addressing gives inline sources the same stable cache identity a
  // file gets from (path, mtimeMs, size), with no filesystem to consult.
  const digest = createHash("sha1").update(buffer).digest("hex");
  return { ok: true, kind: "data", path: `data:sha1-${digest}`, buffer };
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
