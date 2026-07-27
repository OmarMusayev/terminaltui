/**
 * Two-level memoisation for the image pipeline.
 *
 * `renderBlock()` is synchronous and runs on EVERY frame — every keystroke,
 * every scroll, every focus move. A 1600x1000 PNG decodes in 27 ms and
 * resamples in 5 ms, so an uncached pipeline turns a 60 fps UI into a 30 fps
 * one with a single image on screen. Both levels exist to make the steady state
 * a single `Map.get`.
 *
 * | Layer | Key                                    | Value           |
 * |-------|----------------------------------------|-----------------|
 * | L1    | file identity + geometry + compositing  | `SubCellGrid`   |
 * | L2    | L1 key + tier + colorMode + dither      | `string[]`      |
 * | KG    | L1 key (tier `"kitty"`)                 | `KittyImage`    |
 *
 * `tier` is part of BOTH keys, which is what keeps the kitty pixel path and the
 * cell tiers from colliding: the same image at the same cell size resolves to
 * one key ending `:kitty` and another ending `:quadrant`, so a terminal that
 * gets pixels and a terminal that gets glyphs can share this process without
 * either one reading the other's rows.
 *
 * `colorMode` is deliberately ABSENT from the L1 key. It is a module-level
 * `let` in style/colors.ts that `runtime.ts` swaps per frame per SSH session,
 * so a truecolor client and a 256-colour client share one process. Keying
 * pixels by colour mode would let those clients evict each other's decodes;
 * keying serialised rows by it is what stops one poisoning the other.
 *
 * There is no invalidation logic anywhere in this file, only eviction. `mtimeMs`
 * and `size` are part of the identity, so an edited file misses naturally.
 *
 * No imports from src/core — this module is loaded by the component renderer
 * and must not create a cycle.
 */

import { statSync } from "node:fs";
import { isAbsolute } from "node:path";
import type {
  ImageCapabilities,
  ImageDither,
  RGB,
  SubCellGrid,
} from "./types.js";
// Type-only, so this stays free of runtime dependencies: tier.ts is where the
// cell tiers and the kitty pixel path are unified into one name.
import type { RenderTier } from "./tier.js";

/**
 * The colour modes the cache keys on. Structurally identical to `ColorMode` in
 * style/colors.ts, but taken from types.ts so loading the cache never pulls in
 * that module's load-time terminal detection.
 */
export type CacheColorMode = ImageCapabilities["colorMode"];

/** Default byte budget, shared across both levels. */
const DEFAULT_CACHE_BYTES = 32 * 1024 * 1024;

/**
 * L1 holds one large typed array per entry, L2 holds many small strings. The
 * split favours pixels because re-deriving an L1 entry costs a decode plus a
 * resample, while re-deriving an L2 entry is only glyph fitting and string
 * building.
 */
const PIXEL_BUDGET_SHARE = 0.6;

/**
 * Share of the NON-pixel remainder that the kitty registry may hold.
 *
 * Small because a kitty entry is small: it holds the image id, the placement
 * rows (~5 chars per cell) and a THUNK for the transmission, never the
 * transmission itself. That is a deliberate design decision and it is what this
 * number depends on — a 99x60-cell image is ~32 KB here and ~4.8 MB if the
 * base64 were retained, and at the larger size two such images would exceed any
 * sane budget, evict each other on insert, and re-derive a NEW id every single
 * frame. Megabytes per frame is not a cache miss, it is a hang. See
 * `KittyImage.transmit`.
 */
const KITTY_BUDGET_SHARE = 0.15;

/**
 * Floor under the kitty budget, applied even when the total budget is 0.
 *
 * `TERMINALTUI_IMAGE_CACHE_BYTES=0` is documented above as a legal way to
 * disable caching, and for L1 and L2 that is merely slow — a decode and a glyph
 * pass per frame. For the kitty registry it is not slow, it is broken: an entry
 * evicted on insert takes its IMAGE ID with it, so the next frame allocates a
 * new one, and a new id means a new multi-megabyte transmission on every single
 * frame. The floor holds roughly 16 worst-case entries (or hundreds of ordinary
 * ones) and is the difference between "images are uncached" and "the terminal
 * receives 4.8 MB at 60 Hz". It can push total residency over the requested
 * budget by at most this much, which is the trade being made knowingly.
 */
const MIN_KITTY_BUDGET = 512 * 1024;

/**
 * `statSync` is cheap but not free, and a 60 fps render loop would issue one per
 * image per frame. 1000 ms is the report's recommended throttle: fast enough
 * that editing an image feels live, slow enough that the syscall disappears
 * from a profile.
 */
const STAT_TTL_MS = 1000;

/** Bound on the stat memo. One entry per distinct image path in a session. */
const STAT_MEMO_CAP = 512;

/** Bump when the store's SHAPE changes, so a stale bundle's store is rebuilt. */
const STORE_VERSION = 3;

// ─── Byte-budgeted LRU ────────────────────────────────────

interface LruEntry<V> {
  value: V;
  bytes: number;
}

/**
 * An LRU bounded by BYTES, not by entry count.
 *
 * An entry-count bound is what makes the existing width cache in base.ts
 * dangerous: its documented budget is "8k entries x ~200 chars = 3 MB", but a
 * truecolor image row is ~2.7 KB, so 8192 of them measured 60 MB of heap —
 * 20x over, shared process-wide across every SSH session. Image entries vary
 * by three orders of magnitude in size, so only a byte budget bounds them.
 */
class ByteLru<V> {
  private map = new Map<string, LruEntry<V>>();
  private used = 0;
  /**
   * The most recently touched key. Re-inserting on every read costs a delete
   * plus a set; skipping that when the key is already newest makes the steady
   * state — the same image, frame after frame — exactly one `Map.get`.
   */
  private newest: string | null = null;

  /**
   * @param budget Byte ceiling.
   * @param sizeOf Charge for one entry.
   * @param onEvict Called with each value dropped to stay under budget. NOT
   *   called by `clear()` or by an overwrite — only by pressure, because the
   *   one consumer (kitty) needs "the terminal is still holding pixels nobody
   *   will ever reference again", and an overwrite means the caller is about to
   *   reference the replacement.
   */
  constructor(
    private budget: number,
    private readonly sizeOf: (value: V, key: string) => number,
    private readonly onEvict?: (value: V) => void,
  ) {}

  get(key: string): V | undefined {
    const entry = this.map.get(key);
    if (entry === undefined) return undefined;
    if (this.newest !== key) {
      this.map.delete(key);
      this.map.set(key, entry);
      this.newest = key;
    }
    return entry.value;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  /**
   * Drop one entry. Deliberately does NOT fire `onEvict`: the caller is
   * removing an entry it has decided is unusable, and for the kitty store that
   * means the terminal must NOT be told to delete the id — the runtime is
   * already tracking it and the sweep will free it a frame later.
   */
  delete(key: string): boolean {
    const entry = this.map.get(key);
    if (entry === undefined) return false;
    this.map.delete(key);
    this.used -= entry.bytes;
    if (this.newest === key) this.newest = null;
    return true;
  }

  set(key: string, value: V): void {
    const prev = this.map.get(key);
    if (prev !== undefined) {
      this.used -= prev.bytes;
      this.map.delete(key);
    }
    const bytes = this.sizeOf(value, key);
    this.map.set(key, { value, bytes });
    this.used += bytes;
    this.newest = key;
    this.evict();
  }

  /**
   * Evicts oldest-first until the budget holds. An entry larger than the whole
   * budget is inserted and then immediately dropped — the caller still gets the
   * value it just computed, it simply never becomes a hit.
   */
  private evict(): void {
    while (this.used > this.budget && this.map.size > 0) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      const entry = this.map.get(oldest);
      this.map.delete(oldest);
      if (entry !== undefined) this.used -= entry.bytes;
      if (this.newest === oldest) this.newest = null;
      // After the bookkeeping, never during it: the listener writes to a
      // terminal queue and must not be able to observe a half-updated LRU.
      if (entry !== undefined && this.onEvict !== undefined) {
        try {
          this.onEvict(entry.value);
        } catch {
          // A listener is a courtesy (freeing terminal memory); it must never
          // be able to fail the render that happened to trip the budget.
        }
      }
    }
  }

  setBudget(bytes: number): void {
    this.budget = bytes;
    this.evict();
  }

  clear(): void {
    this.map.clear();
    this.used = 0;
    this.newest = null;
  }

  get size(): number {
    return this.map.size;
  }

  get bytes(): number {
    return this.used;
  }
}

// ─── Store ────────────────────────────────────────────────

interface StatEntry {
  mtimeMs: number;
  size: number;
  checkedAt: number;
}

/**
 * One transmitted kitty image: everything the renderer and the runtime need to
 * put it on screen, derived once and reused for as long as the entry lives.
 *
 * `transmit` and `placement` are kept TOGETHER on purpose. The placement rows
 * carry the image id in a literal 24-bit foreground colour, so a stale row set
 * paired with a fresh id would address an image the terminal never received —
 * caching them under separate keys made that an eviction-ordering bug waiting
 * to happen. One entry, one id, both derived from it.
 */
export interface KittyImage {
  /** Client-chosen image id, 1..0xFFFFFF. Carried in the placeholder's fg colour. */
  id: number;
  /** Cell footprint the placement occupies. */
  cols: number;
  rows: number;
  /**
   * Builds the full (chunked) APC transmission on demand. Its result goes out
   * through the runtime's UNFILTERED pipe, never inside `lines: string[]` —
   * `cutToWidth` shreds base64 at the first `m`.
   *
   * A THUNK, not a string, and this is the single most important shape decision
   * in this file. The payload is 4/3 of the raw pixels — 4.8 MB for the largest
   * image the renderer will build — while everything else about an image is
   * kilobytes. Retaining it would mean either a cache big enough to hold
   * several of them or an eviction that fires on insert, and the latter is
   * catastrophic rather than merely slow: a dropped entry means a fresh id next
   * frame, which means a fresh transmission next frame, forever.
   *
   * Called at most once per terminal per id, by the runtime, only when that
   * terminal has not already received the image. On a steady-state frame it is
   * never called at all, so the bytes are not merely uncached — they are never
   * built. Re-deriving costs a decode, a resample and a base64 pass; that is
   * paid on a retransmit (a navigate-back, an out-of-band repaint, a second SSH
   * session), which is exactly when the terminal genuinely needs the bytes.
   *
   * Must be idempotent and must not throw for a caller that has already
   * validated the source; the runtime guards it anyway.
   */
  transmit: () => string;
  /** `rows` placeholder strings, each exactly `cols` display columns. Frame payload. */
  placement: string[];
}

interface ImageCacheStore {
  version: number;
  budget: number;
  pixels: ByteLru<SubCellGrid>;
  serial: ByteLru<string[]>;
  kitty: ByteLru<KittyImage>;
  statMemo: Map<string, StatEntry>;
  counters: { pixelHits: number; pixelMisses: number; serialHits: number; serialMisses: number };
}

/**
 * Listeners notified when a kitty entry is evicted under memory pressure.
 *
 * The alternative — having the cache write the delete itself — is impossible
 * here and would be wrong anyway: this module must not import from src/core
 * (see the file header), and an image lives in a specific TERMINAL, so only the
 * runtime that transmitted it knows whether the delete is owed. Each runtime
 * registers one listener and ignores ids it never sent, which is what keeps two
 * concurrent SSH sessions from deleting each other's pixels.
 *
 * A Set, so a double-registration is idempotent and unsubscribing is exact.
 */
const kittyEvictionListeners = new Set<(id: number) => void>();

/**
 * Subscribe to kitty eviction. Returns the unsubscribe function; call it from
 * the runtime's cleanup or a stopped session keeps receiving notifications for
 * the life of the process.
 */
export function onKittyEvicted(listener: (id: number) => void): () => void {
  kittyEvictionListeners.add(listener);
  return () => {
    kittyEvictionListeners.delete(listener);
  };
}

function notifyKittyEviction(image: KittyImage): void {
  for (const listener of kittyEvictionListeners) listener(image.id);
}

// Survive esbuild re-bundling the framework, the same way src/core/screen.ts
// keeps one Screen: a second copy of this module in the same process must share
// the decode results rather than double the memory.
const IMAGE_CACHE_KEY = "__terminaltui_image_cache__";

/** Bytes charged per cached string, covering V8's string header. ANSI rows are ASCII, so one byte per char. */
const STRING_OVERHEAD = 24;

/** Bytes charged per cache entry for the key, the wrapper object and the Map slot. */
const ENTRY_OVERHEAD = 96;

/** Bytes charged for a retained closure and the context it captures. */
const CLOSURE_OVERHEAD = 256;

function pixelBytes(grid: SubCellGrid, key: string): number {
  return grid.data.byteLength + key.length + ENTRY_OVERHEAD;
}

function serialBytes(rows: string[], key: string): number {
  let total = key.length + ENTRY_OVERHEAD;
  for (const row of rows) total += row.length + STRING_OVERHEAD;
  return total;
}

/**
 * Charge for one kitty entry: the placement rows plus the closure that can
 * rebuild the transmission. The payload itself is never resident (see
 * `KittyImage.transmit`), so it is not — and must not be — charged for.
 */
function kittyBytes(image: KittyImage, key: string): number {
  let total = key.length + ENTRY_OVERHEAD + CLOSURE_OVERHEAD;
  for (const row of image.placement) total += row.length + STRING_OVERHEAD;
  return total;
}

function readBudget(): number {
  const raw = process.env.TERMINALTUI_IMAGE_CACHE_BYTES;
  if (raw === undefined || raw.trim() === "") return DEFAULT_CACHE_BYTES;
  const parsed = Number(raw);
  // A budget of 0 is legal and disables caching, which is useful in tests.
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_CACHE_BYTES;
  return Math.floor(parsed);
}

/**
 * The three byte budgets.
 *
 * `pixel + serial + kitty` equals the requested total EXCEPT when the kitty
 * floor binds (see `MIN_KITTY_BUDGET`); the floor is taken from neither of the
 * other two, so a small total budget still shrinks L1 and L2 as asked.
 */
function splitBudget(budget: number): { pixel: number; serial: number; kitty: number } {
  const pixel = Math.floor(budget * PIXEL_BUDGET_SHARE);
  const kitty = Math.floor((budget - pixel) * KITTY_BUDGET_SHARE);
  return {
    pixel,
    serial: budget - pixel - kitty,
    kitty: Math.max(kitty, MIN_KITTY_BUDGET),
  };
}

function createStore(): ImageCacheStore {
  const budget = readBudget();
  const share = splitBudget(budget);
  return {
    version: STORE_VERSION,
    budget,
    pixels: new ByteLru<SubCellGrid>(share.pixel, pixelBytes),
    serial: new ByteLru<string[]>(share.serial, serialBytes),
    kitty: new ByteLru<KittyImage>(share.kitty, kittyBytes, notifyKittyEviction),
    statMemo: new Map(),
    counters: { pixelHits: 0, pixelMisses: 0, serialHits: 0, serialMisses: 0 },
  };
}

const globalRef = globalThis as unknown as Record<string, unknown>;
const existing = globalRef[IMAGE_CACHE_KEY];
// The version check is not ceremony: a stale bundle of an older release could
// have parked a differently shaped store under this key, and adopting it would
// fail on a missing field rather than simply losing the cache.
const adoptable =
  typeof existing === "object" &&
  existing !== null &&
  (existing as ImageCacheStore).version === STORE_VERSION;
const store: ImageCacheStore = adoptable ? (existing as ImageCacheStore) : createStore();
globalRef[IMAGE_CACHE_KEY] = store;

// ─── Source identity ──────────────────────────────────────

export interface ImageIdentity {
  path: string;
  /** `-1` when the file could not be stat'd, and `0` for content-addressed sources. */
  mtimeMs: number;
  /** `-1` when the file could not be stat'd, and `0` for content-addressed sources. */
  size: number;
}

/**
 * True when `path` already names its own content rather than a filesystem
 * location — the `data:sha1-...` identities that resolve.ts hands back for
 * inline sources. Those need no stat: the identity IS the hash.
 */
export function isContentIdentity(path: string): boolean {
  return !isAbsolute(path);
}

/**
 * `(path, mtimeMs, size)` for an image source, memoised for `STAT_TTL_MS`.
 *
 * A stat failure is recorded as `(-1, -1)` rather than thrown: the key stays
 * stable, the decoder reports `not-found`, and the alt-text tier renders. That
 * negative result also expires after the TTL, so a file that appears later is
 * picked up without any explicit invalidation.
 */
export function imageIdentity(path: string): ImageIdentity {
  if (isContentIdentity(path)) return { path, mtimeMs: 0, size: 0 };

  const now = Date.now();
  const hit = store.statMemo.get(path);
  if (hit !== undefined && now - hit.checkedAt < STAT_TTL_MS) {
    return { path, mtimeMs: hit.mtimeMs, size: hit.size };
  }

  let mtimeMs = -1;
  let size = -1;
  try {
    const st = statSync(path);
    mtimeMs = st.mtimeMs;
    size = st.size;
  } catch {
    // Left at (-1, -1); decodeImage() owns the error taxonomy.
  }

  if (store.statMemo.size >= STAT_MEMO_CAP) {
    const oldest = store.statMemo.keys().next().value;
    if (oldest !== undefined) store.statMemo.delete(oldest);
  }
  store.statMemo.set(path, { mtimeMs, size, checkedAt: now });
  return { path, mtimeMs, size };
}

// ─── Keys ─────────────────────────────────────────────────

export interface PixelKeyParts {
  /** Absolute path, or a `data:sha1-...` identity from resolve.ts. */
  path: string;
  /** Output geometry in cells. */
  cols: number;
  rows: number;
  /**
   * Sub-cell grid geometry, i.e. cols/rows multiplied by the tier's sub-cell
   * factor — or, for `tier: "kitty"`, the SOURCE PIXEL dimensions the image is
   * resampled to. Both are "how many samples were taken", which is exactly what
   * the key needs to distinguish.
   */
  subW: number;
  subH: number;
  /** The tier the grid was sampled for. Part of `SubCellGrid`, so part of the key. */
  tier: RenderTier;
  /**
   * Source-pixel rectangle the resampler will actually sample, or `undefined`
   * for the whole frame.
   *
   * `fit: "cover"` samples a centred sub-rect while every other fit samples the
   * full frame, so the crop — not `fit` — is what selects the pixels. Omitting
   * it made a `fit: "cover"` block and a `fit: "fill"` block of the same source
   * at the same cell size collide, and whichever painted first won for both.
   */
  crop?: { sx: number; sy: number; sw: number; sh: number };
  /** Colour composited under alpha. */
  background: RGB | string;
  invert?: boolean;
}

/**
 * Key for the L1 pixel cache: everything that changes the resampled grid, and
 * nothing that does not.
 *
 * Contains no `colorMode`, no dither and no charset — resampling is colour-mode
 * independent, which is exactly what lets a per-session mode swap avoid
 * evicting a decode.
 *
 * Three additions over the sketch in the design report, all required for
 * correctness rather than taste: `cols x rows`, because `subW x subH` alone
 * does not determine them; `tier`, because it is a field of the value and a key
 * must determine every field of its value; and `crop`, because the sampled
 * source rect is what the grid is computed from. Including `tier` costs the
 * sharing that solid, shading and ascii could have had (all three sample 1x1),
 * a case that only arises if one image renders at two of those tiers at once.
 */
export function pixelCacheKey(parts: PixelKeyParts): string {
  const id = imageIdentity(parts.path);
  const bg = typeof parts.background === "string"
    ? parts.background
    : `${parts.background.r},${parts.background.g},${parts.background.b}`;
  const c = parts.crop;
  const crop = c === undefined ? "full" : `${c.sx},${c.sy},${c.sw},${c.sh}`;
  return (
    `${id.path}:${id.mtimeMs}:${id.size}` +
    `:${parts.cols}x${parts.rows}:${parts.subW}x${parts.subH}:${parts.tier}` +
    `:${crop}:${parts.invert ? 1 : 0}:${bg}`
  );
}

export interface SerialKeyParts {
  /** The L1 key this render derives from. */
  pixelKey: string;
  tier: RenderTier;
  colorMode: CacheColorMode;
  dither: ImageDither;
  /** Ramp for the ascii tier. Author-supplied, so it must key. */
  charset?: string;
  /** Any further renderer-owned variation — framing, alignment padding, focus gutter. */
  variant?: string;
}

/**
 * Key for the L2 serialised cache: the finished `string[]` exactly as it was
 * handed to the renderer last frame.
 *
 * `tier` appears on both sides on purpose. It shapes the grid (via the sub-cell
 * factor) AND the glyph choice, so it belongs to both keys.
 */
export function serialCacheKey(parts: SerialKeyParts): string {
  return (
    `${parts.pixelKey}:${parts.tier}:${parts.colorMode}:${parts.dither}` +
    `:${parts.charset ?? ""}:${parts.variant ?? ""}`
  );
}

// ─── L1: resampled pixels ─────────────────────────────────

/**
 * The cached sub-cell grid, or `undefined`.
 *
 * The returned grid is SHARED and must be treated as immutable. `ditherGrid()`
 * mutates its argument in place and its result depends on the colour mode,
 * which is not part of this key — dithering a cached grid directly would let a
 * 256-colour session poison a truecolor one. Dither a `cloneGrid()` instead.
 */
export function getPixelGrid(key: string): SubCellGrid | undefined {
  const hit = store.pixels.get(key);
  if (hit === undefined) store.counters.pixelMisses++;
  else store.counters.pixelHits++;
  return hit;
}

export function setPixelGrid(key: string, grid: SubCellGrid): void {
  store.pixels.set(key, grid);
}

/** Deep copy, so the caller may dither or otherwise mutate without touching L1. */
export function cloneGrid(grid: SubCellGrid): SubCellGrid {
  return { ...grid, data: new Uint8ClampedArray(grid.data) };
}

// There is deliberately no `getOrComputePixelGrid` read-through helper. A
// read-through hands back the SHARED instance, and the only safe way to consume
// it is get / miss / compute / set with a `cloneGrid()` before any dither — two
// APIs for one operation is how that hazard gets tripped.

// ─── L2: serialised rows ──────────────────────────────────

/**
 * The finished rows, or `undefined`. This is the hot path: a hit is one
 * `Map.get` and returns the EXACT array instance the previous frame used, so
 * the per-row diff in runtime-terminal.ts sees identical strings and writes
 * nothing.
 *
 * The array is shared. Callers must not mutate it or its strings — pad, frame
 * and centre by building a new array around it.
 */
export function getSerialRows(key: string): string[] | undefined {
  const hit = store.serial.get(key);
  if (hit === undefined) store.counters.serialMisses++;
  else store.counters.serialHits++;
  return hit;
}

export function setSerialRows(key: string, rows: string[]): void {
  store.serial.set(key, rows);
}

// ─── KG: transmitted kitty images ─────────────────────────

/**
 * The kitty image for this pixel key, or `undefined`.
 *
 * Keyed by the SAME `pixelCacheKey()` the cell tiers use, with `tier: "kitty"`
 * and the source pixel dimensions in `subW`/`subH` — so an image that changes
 * size, crop, background or file mtime misses here exactly when it misses
 * there, and a new id is allocated for the new pixels rather than a live id
 * being re-transmitted (which kitty and Ghostty disagree about: kitty issue
 * #8701).
 *
 * Deliberately does NOT bump the L1/L2 counters: those pin decode behaviour in
 * tests, and a hit here is a different event from a pixel-grid hit.
 */
export function getKittyImage(key: string): KittyImage | undefined {
  return store.kitty.get(key);
}

/**
 * Record a transmitted kitty image.
 *
 * May synchronously evict older entries and fire every `onKittyEvicted`
 * listener — that is the point, and it is why the runtime registers one: an
 * image dropped here is still occupying the terminal's graphics store (kitty
 * and Ghostty default to a 320 MB per-buffer quota with their own LRU) until
 * someone sends `a=d,d=I`.
 */
export function setKittyImage(key: string, image: KittyImage): void {
  store.kitty.set(key, image);
}

/**
 * Forget a kitty image whose transmission failed.
 *
 * An entry whose `pending` buffer was consumed and whose source has stopped
 * decoding can never produce a payload again, so keeping it means every later
 * frame re-derives the same failure. Dropping it makes the next frame rebuild
 * from scratch — which either succeeds (the file came back) or fails at
 * `kittyPixels()`, where the demotion to cells is clean and costs no
 * placement rows.
 *
 * Fires no eviction listener: the runtime owns the id's lifetime and its
 * per-frame sweep frees the terminal's copy once the id stops being placed.
 */
export function deleteKittyImage(key: string): boolean {
  return store.kitty.delete(key);
}

// ─── Maintenance ──────────────────────────────────────────

export interface ImageCacheStats {
  pixelEntries: number;
  pixelBytes: number;
  serialEntries: number;
  serialBytes: number;
  /** Transmitted kitty images held for retransmission. */
  kittyEntries: number;
  kittyBytes: number;
  /** Combined budget across all levels. */
  budgetBytes: number;
  statEntries: number;
  pixelHits: number;
  pixelMisses: number;
  serialHits: number;
  serialMisses: number;
}

/** Observability for tests and for anyone chasing a memory regression. */
export function imageCacheStats(): ImageCacheStats {
  return {
    pixelEntries: store.pixels.size,
    pixelBytes: store.pixels.bytes,
    serialEntries: store.serial.size,
    serialBytes: store.serial.bytes,
    kittyEntries: store.kitty.size,
    kittyBytes: store.kitty.bytes,
    budgetBytes: store.budget,
    statEntries: store.statMemo.size,
    ...store.counters,
  };
}

/**
 * Drop everything: all three levels, the stat memo and the counters. Also
 * re-reads `TERMINALTUI_IMAGE_CACHE_BYTES`, so a test can set the env var and
 * call this to reshape the budget.
 *
 * Fires NO kitty eviction listeners, deliberately. A clear is a caller saying
 * "forget what you derived", not "the terminal has thrown these away" — and the
 * runtime deletes an image the moment it stops being placed on screen, which is
 * the event that actually reclaims the terminal's memory.
 *
 * Does not touch resolve.ts's memo — call `clearResolveCache()` as well for a
 * full reset.
 */
export function clearImageCache(): void {
  const budget = readBudget();
  const share = splitBudget(budget);
  store.budget = budget;
  store.pixels.clear();
  store.pixels.setBudget(share.pixel);
  store.serial.clear();
  store.serial.setBudget(share.serial);
  store.kitty.clear();
  store.kitty.setBudget(share.kitty);
  store.statMemo.clear();
  store.counters.pixelHits = 0;
  store.counters.pixelMisses = 0;
  store.counters.serialHits = 0;
  store.counters.serialMisses = 0;
}
