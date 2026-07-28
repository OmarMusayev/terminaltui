/**
 * Playback state and the frame clock.
 *
 * A terminal framework has no render loop. `rt.render()` is a synchronous
 * function called by whatever just changed — a keypress, a state write, a
 * fetcher resolving — and between those calls nothing happens at all. Video is
 * the first thing in this codebase that needs the screen to change because
 * TIME passed, so this module owns the only clock, and its whole job is to
 * decide which frame index is current and to ask for a repaint when that
 * answer changes.
 *
 * THE TARGET FRAME IS ARITHMETIC, NOT A COUNTER.
 *
 *     frame = floor((now - epoch - pausedFor) / frameDelay) mod frameCount
 *
 * A counter incremented once per tick drifts, and worse, it rubber-bands: if
 * the process stalls for 300 ms — a synchronous decode elsewhere, a resize
 * storm, the user holding a key — a counter replays those frames in a burst to
 * catch up, so the picture speeds up exactly when the machine is least able to
 * keep up. Deriving the index from the wall clock instead means a stall DROPS
 * frames, which is what every video player does and what looks correct.
 *
 * ONE TIMER FOR ALL PLAYERS. Each runtime gets a single `setTimeout` armed to
 * the earliest due time across every playing video, which fires one
 * `rt.render()` for all of them. The runtime has 55 call sites that trigger a
 * render and no coalescer anywhere; adding one timer per video block would let
 * a page with three loops repaint three times per tick for one screen's worth
 * of change. The timer disarms itself when nothing is playing, so a paused
 * page costs nothing.
 *
 * ROWS ARE MEMOISED BY IDENTITY, NOT JUST BY VALUE. `frameRows()` returns the
 * SAME array instance for repeated calls on the same (frame, geometry, tier,
 * colour mode). That matters because repaints are not rate-limited: a keypress
 * between two video ticks re-composes the whole page, and if the video handed
 * back an equal-but-distinct array the row differ would still compare strings.
 * Same instance means the comparison is a pointer check and the frame costs
 * literally zero bytes on the wire.
 */

import type { ImageTier } from "../image/types.js";
import { decodePack, frameAt, frameDelayMs, openPack, type TvfPack } from "./pack.js";

/** How a player is currently behaving. Drives what the renderer draws. */
export type PlaybackState = "idle" | "playing" | "paused" | "error";

/**
 * A kitty image the memoised rows point at.
 *
 * Carried through the memo so a cache hit can re-declare the placement. The
 * transmit thunk is kept alongside the id because the runtime may not have
 * written the image yet on the frame the memo was filled.
 */
export interface PixelPlacement {
  id: number;
  transmit: () => string;
}

export interface VideoPlayerOptions {
  /** Presentation rate cap. Clamped to the pack's own rate. */
  fps?: number;
  loop?: boolean;
  autoplay?: boolean;
  /** Frame shown while idle or paused. */
  poster?: number;
  /**
   * This player will never move, whatever anyone asks of it.
   *
   * Set from `TERMINALTUI_VIDEO=off`, and it has to be enforced HERE rather
   * than only at the autoplay decision: the switch exists so a test harness or
   * a screenshot tool can guarantee a still screen, and a guarantee that a
   * keypress can revoke is not one. The env is read by the caller, not here, so
   * this module stays pure and a test can freeze a player without touching
   * process.env.
   */
  frozen?: boolean;
}

/**
 * Injectable clock.
 *
 * Tests drive playback by advancing a number instead of sleeping, which is the
 * only way to assert "a 90 ms stall drops two frames" without a 90 ms test.
 */
export type NowFn = () => number;

let nowFn: NowFn = () => Date.now();

/** Swap the clock. Returns the previous one so a test can restore it. */
export function setNowFn(fn: NowFn): NowFn {
  const prev = nowFn;
  nowFn = fn;
  return prev;
}

export function now(): number {
  return nowFn();
}

// ─── Player ───────────────────────────────────────────────

export class VideoPlayer {
  readonly pack: TvfPack | null;
  readonly loadError: string | null;

  state: PlaybackState;
  /** Wall-clock time the current play run started from frame `epochFrame`. */
  private epoch = 0;
  private epochFrame = 0;
  /** Frame held while idle/paused. */
  private held: number;

  private readonly loop: boolean;
  private readonly fpsCap: number | undefined;
  /** See {@link VideoPlayerOptions.frozen}. */
  readonly frozen: boolean;

  /** Bumped by the renderer every time it draws this player; drives GC. */
  renderSeq = 0;
  /** Page this player belongs to, so navigation can pause it. */
  pageId: string | null = null;
  /**
   * Identity of the pack this player was built from.
   *
   * The renderer compares it before reusing a player, so editing a config to
   * point at a different clip — or replacing the source file under a dev
   * server — swaps the player instead of playing yesterday's video from
   * today's playhead.
   */
  sourceKey = "";

  /** One-entry row memo. See the file docblock on identity. */
  private memoKey = "";
  private memoRows: string[] | null = null;
  /**
   * The graphics placement those rows depend on, when they are placeholder
   * cells rather than glyphs.
   *
   * Memoised rows are not self-contained on the pixel path: they REFERENCE an
   * image the terminal holds, and the runtime deletes any image that stops
   * being placed. So the memo has to carry enough to re-declare the placement
   * on every hit, or a repaint between clock ticks silently frees the pixels
   * the rows on screen are pointing at.
   */
  private memoPlacement: PixelPlacement | null = null;
  /** Last successfully rendered rows, re-emitted when a frame fails to decode. */
  lastGoodRows: string[] | null = null;

  constructor(source: string | Uint8Array, opts: VideoPlayerOptions = {}) {
    const opened = typeof source === "string"
      ? openPack(source)
      : decodePack(source);

    this.pack = opened.ok ? opened.pack : null;
    this.loadError = opened.ok ? null : opened.reason;
    this.loop = opts.loop !== false;
    this.fpsCap = opts.fps;
    this.frozen = opts.frozen === true;

    const count = this.frameCount;
    this.held = clampIndex(opts.poster ?? 0, count);

    if (!opened.ok) {
      this.state = "error";
    } else if (opts.autoplay === true && count > 1 && !this.frozen) {
      this.state = "playing";
      this.epoch = now();
      this.epochFrame = this.held;
    } else {
      this.state = "idle";
    }
  }

  get frameCount(): number {
    return this.pack?.header.frameCount ?? 0;
  }

  get durationMs(): number {
    return this.pack?.header.durationMs ?? 0;
  }

  /** Source pixel dimensions, for geometry. Null when the pack failed to open. */
  get size(): { width: number; height: number } | null {
    if (!this.pack) return null;
    return { width: this.pack.header.width, height: this.pack.header.height };
  }

  get playing(): boolean {
    return this.state === "playing";
  }

  /**
   * Delay before the frame after `i`, honouring both the pack's per-frame
   * table and the block's `fps` cap.
   *
   * The cap can only ever SLOW playback down: a 12 fps pack asked for 60 fps
   * has no frames to show in between, and presenting each one five times is
   * five times the bandwidth for the same picture.
   */
  private delayAfter(i: number): number {
    if (!this.pack) return 1000;
    const packDelay = frameDelayMs(this.pack, i);
    if (this.fpsCap === undefined || this.fpsCap <= 0) return packDelay;
    return Math.max(packDelay, 1000 / this.fpsCap);
  }

  /**
   * The frame that should be on screen right now.
   *
   * Walks the per-frame delay table from the epoch rather than dividing by a
   * constant, because a GIF's frames do not all last the same time. The walk
   * is bounded by one pass over the table: elapsed time is first reduced
   * modulo the loop duration, so a video left playing for an hour costs the
   * same as one playing for a second.
   */
  currentFrame(): number {
    const count = this.frameCount;
    if (count === 0) return 0;
    if (this.state !== "playing") return clampIndex(this.held, count);

    let elapsed = now() - this.epoch;
    if (elapsed <= 0) return this.epochFrame;

    const total = this.loopDurationMs();
    if (total <= 0) return this.epochFrame;

    if (elapsed >= total) {
      if (!this.loop) {
        // Park on the last frame and stop, so a non-looping video that ran to
        // the end stops asking for repaints.
        this.state = "paused";
        this.held = count - 1;
        return this.held;
      }
      elapsed %= total;
    }

    let i = this.epochFrame;
    let remaining = elapsed;
    // Bounded: each step consumes at least the (positive) delay of one frame,
    // and `elapsed` is already less than one full loop.
    for (let guard = 0; guard <= count; guard++) {
      const d = this.delayAfter(i);
      if (remaining < d) return i;
      remaining -= d;
      i = i + 1 >= count ? (this.loop ? 0 : count - 1) : i + 1;
    }
    return i;
  }

  private loopDurationMs(): number {
    const count = this.frameCount;
    let total = 0;
    for (let i = 0; i < count; i++) total += this.delayAfter(i);
    return total;
  }

  /** Wall-clock time the next frame is due, or null when nothing is playing. */
  nextDueAt(): number | null {
    if (this.state !== "playing" || this.frameCount === 0) return null;
    const frame = this.currentFrame();
    if (this.state !== "playing") return null; // currentFrame may have ended it
    let consumed = 0;
    let i = this.epochFrame;
    const count = this.frameCount;
    for (let guard = 0; guard <= count && i !== frame; guard++) {
      consumed += this.delayAfter(i);
      i = i + 1 >= count ? 0 : i + 1;
    }
    const elapsed = now() - this.epoch;
    const total = this.loopDurationMs();
    const cycles = total > 0 ? Math.floor(elapsed / total) : 0;
    return this.epoch + cycles * total + consumed + this.delayAfter(frame);
  }

  // ─── Transport ──────────────────────────────────────────

  play(): void {
    if (this.frozen) return;
    if (this.state === "error" || this.frameCount === 0) return;
    if (this.state === "playing") return;
    this.epochFrame = clampIndex(this.held, this.frameCount);
    this.epoch = now();
    this.state = "playing";
  }

  pause(): void {
    if (this.state !== "playing") return;
    this.held = this.currentFrame();
    this.state = "paused";
  }

  toggle(): void {
    if (this.state === "playing") this.pause();
    else this.play();
  }

  /** Move by `delta` frames, pausing. Wraps when looping, clamps otherwise. */
  seekBy(delta: number): void {
    const count = this.frameCount;
    if (count === 0) return;
    const from = this.currentFrame();
    let to = from + delta;
    if (this.loop) {
      to = ((to % count) + count) % count;
    } else {
      to = clampIndex(to, count);
    }
    this.held = to;
    if (this.state === "playing") {
      this.epoch = now();
      this.epochFrame = to;
    } else {
      this.state = this.state === "error" ? "error" : "paused";
    }
  }

  // ─── Frame bytes ────────────────────────────────────────

  /** Encoded JPEG for a frame index, or null. Zero-copy view into the pack. */
  frameBytes(i: number): Uint8Array | null {
    return this.pack ? frameAt(this.pack, i) : null;
  }

  /**
   * Rows for this frame, or null when the caller must render them.
   *
   * The memo holds exactly one entry: video is watched forwards, so a second
   * entry would never be hit, and holding N frames of composed ANSI is how the
   * still-image cache gets evicted out from under other blocks on the page.
   */
  cachedRows(key: string): string[] | null {
    return this.memoKey === key ? this.memoRows : null;
  }

  /** The placement memoised rows depend on, or null when they are glyphs. */
  cachedPlacement(key: string): PixelPlacement | null {
    return this.memoKey === key ? this.memoPlacement : null;
  }

  putRows(key: string, rows: string[], placement: PixelPlacement | null = null): string[] {
    this.memoKey = key;
    this.memoRows = rows;
    this.memoPlacement = placement;
    this.lastGoodRows = rows;
    return rows;
  }

  /** Drop the memo, so the next render rebuilds from scratch. */
  invalidateRows(): void {
    this.memoKey = "";
    this.memoRows = null;
    this.memoPlacement = null;
  }
}

function clampIndex(i: number, count: number): number {
  if (count <= 0) return 0;
  if (!Number.isFinite(i)) return 0;
  return Math.min(count - 1, Math.max(0, Math.floor(i)));
}

// ─── The scheduler ────────────────────────────────────────

/**
 * Anything the scheduler needs from a runtime.
 *
 * Structural rather than a `TUIRuntime` import: `src/core/runtime.ts` already
 * imports half the framework, and a cycle through it would drag the whole
 * runtime into anything that touches a pack.
 */
export interface Repaintable {
  render(): void;
}

interface Schedule {
  players: Set<VideoPlayer>;
  timer: ReturnType<typeof setTimeout> | null;
}

const SCHEDULES = new WeakMap<Repaintable, Schedule>();

/**
 * Floor on how soon the clock will re-arm.
 *
 * At 12 fps frames are 83 ms apart, so this never binds in practice; it exists
 * so a malformed pack claiming 1000 fps cannot spin the event loop.
 */
const MIN_TICK_MS = 8;

function scheduleFor(rt: Repaintable): Schedule {
  let s = SCHEDULES.get(rt);
  if (!s) {
    s = { players: new Set(), timer: null };
    SCHEDULES.set(rt, s);
  }
  return s;
}

/** Register a player and (re-)arm the runtime's clock. */
export function registerPlayer(rt: Repaintable, player: VideoPlayer): void {
  scheduleFor(rt).players.add(player);
  rearm(rt);
}

export function unregisterPlayer(rt: Repaintable, player: VideoPlayer): void {
  const s = SCHEDULES.get(rt);
  if (!s) return;
  s.players.delete(player);
  rearm(rt);
}

/** True when at least one registered player is playing. */
export function videoActive(rt: Repaintable): boolean {
  const s = SCHEDULES.get(rt);
  if (!s) return false;
  for (const p of s.players) if (p.playing) return true;
  return false;
}

/**
 * Arm the single timer to the earliest due frame across all players.
 *
 * Called after every transport change and after every tick. Idempotent: it
 * always clears before it sets, so the invariant "at most one timer per
 * runtime" holds no matter how many times it is called in one pass.
 */
export function rearm(rt: Repaintable): void {
  const s = SCHEDULES.get(rt);
  if (!s) return;

  if (s.timer) {
    clearTimeout(s.timer);
    s.timer = null;
  }

  let soonest = Infinity;
  for (const p of s.players) {
    const due = p.nextDueAt();
    if (due !== null && due < soonest) soonest = due;
  }
  if (!Number.isFinite(soonest)) return; // nothing playing: stay disarmed

  const delay = Math.max(MIN_TICK_MS, soonest - now());
  s.timer = setTimeout(() => {
    s.timer = null;
    // One repaint for every player that came due, then re-arm from the new
    // positions. If render() throws, the clock must still re-arm or playback
    // dies silently for the rest of the session.
    try {
      rt.render();
    } finally {
      rearm(rt);
    }
  }, delay);

  // A frame clock must never hold the process open on its own — a site whose
  // last page has a looping video should still exit on its own terms.
  s.timer.unref?.();
}

/** Pause every player that does not belong to `pageId`. Called on navigation. */
export function pauseOtherPages(rt: Repaintable, pageId: string | null): void {
  const s = SCHEDULES.get(rt);
  if (!s) return;
  for (const p of s.players) {
    if (p.pageId !== null && p.pageId !== pageId) p.pause();
  }
  rearm(rt);
}

/** Stop everything and disarm. Called from the runtime's cleanup. */
export function stopAllVideo(rt: Repaintable): void {
  const s = SCHEDULES.get(rt);
  if (!s) return;
  for (const p of s.players) p.pause();
  if (s.timer) {
    clearTimeout(s.timer);
    s.timer = null;
  }
  s.players.clear();
}

/**
 * Drop players the renderer stopped drawing.
 *
 * There is no per-block teardown hook anywhere in the framework, so departure
 * is inferred: the renderer stamps `renderSeq` on every player it draws, and a
 * player that misses two consecutive passes is gone from the tree — a block
 * removed from a `dynamic()` page, a tab switched away from. Two rather than
 * one because a single missed pass can just mean the block scrolled out of a
 * clipped panel.
 */
export function sweepPlayers(rt: Repaintable, seq: number): void {
  const s = SCHEDULES.get(rt);
  if (!s) return;
  let changed = false;
  for (const p of s.players) {
    if (seq - p.renderSeq >= 2) {
      p.pause();
      s.players.delete(p);
      changed = true;
    }
  }
  if (changed) rearm(rt);
}

/** Players currently registered against a runtime. Test/introspection use. */
export function playersOf(rt: Repaintable): VideoPlayer[] {
  return [...(SCHEDULES.get(rt)?.players ?? [])];
}
