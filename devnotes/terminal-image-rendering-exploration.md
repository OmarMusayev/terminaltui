# Terminal image rendering in terminaltui — exploration report

Status: **exploration / design**. No production code changed.
Date: 2026-07-24
Scope: how to render real images in terminaltui, on as many terminals as possible, for both `terminaltui dev` (local TTY) and `terminaltui serve` (SSH).

Everything in this document that is stated as fact was verified against the source tree or measured by running code during the investigation. Where the initial survey was wrong, the correction is called out explicitly and marked **CORRECTED**.

---

## 1. Executive summary

Ship a **cell-based image renderer first, and completely**. Half-blocks and quadrants — `▀` with an independent foreground and background colour per cell — are ordinary styled text. They pass through `stringWidth`, `cutToWidth`, the C0 strip, the per-row diff, `Panel`, `Columns` and the PTY emulator with **zero changes to the write path**, and they are the *only* technique that works on Apple Terminal, GNOME/VTE, Alacritty, PuTTY, every SSH client and the test harness. Every graphics protocol is a strict subset of that reach.

Decode synchronously. `pngjs` and `jpeg-js` both expose synchronous APIs, and a from-scratch sync PNG decode of a 1600×1000 image measured **27 ms** using only `node:zlib`. Back it with a module-scope, byte-budgeted cache keyed on `(path, mtime, size, cols, rows, mode)`. This removes the async/sync problem entirely for local files and means `renderBlock` keeps its exact signature.

Defer kitty/sixel/iTerm2. They need a second emission plane, a capability probe, an emulator parser change and an input-parser change, and they buy nothing on the primary targets. Bank the design (Unicode placeholders + an SGR-shaped sentinel + an epilogue emitted after the row loop) so the option stays cheap.

Highest-value first commit: add `bgColorRgb()` and rewrite `renderBlocks` to emit `fg(top) + bg(bottom) + "▀"`. That single change doubles achievable fidelity on the framework author's own terminal.

---

## 2. Where the rendering engine stands today

### 2.1 The frame contract

A frame is a plain `string[]` — one entry per terminal row — composed **synchronously**, start to finish, in one call stack.

```
config + pages
  └─ FileRouter ──> block tree
        └─ renderMain(rt)                       [src/core/runtime-render.ts:32]  SYNC
             ├─ collectFocusItems / registerForms / computeFocusLayout
             ├─ renderHomePage | renderContentPage
             │    └─ renderBlocksRecursive
             │         └─ renderBlock(rt, block, ctx): string[]
             │                                  [src/core/runtime-block-render.ts:166]  SYNC
             │         ├─ prefix EVERY line with 1 col: "▌" (focused) or " "   [:279/:281]
             │         └─ push "" separator after every block                   [:285]
             ├─ slice by pageScrollOffset into a (rows-7) viewport              [:336]
             └─ left-pad each line with padStr for centering                    [:337]
        └─ writeToTerminal(rt, lines, columns, rows)
                                                [src/core/runtime-terminal.ts:68]  SYNC
             ├─ Phase 1  pad/truncate to exactly `rows` entries        [:74-75]
             ├─         bottom-row overlay (command / notification / feedback)  [:82-102]
             ├─ Phase 2  for each row i:
             │             if (!fullRedraw && frameRows[i] === fs.rows[i]) continue;  [:113]
             │             line = frameRows[i].replace(C0_EXCEPT_ESC, "");            [:117]
             │             body += `\x1b[${i+1};1H\x1b[0m\x1b[2K`;                    [:120]
             │             body += stringWidth(line) > columns
             │                       ? truncateLine(line, columns) : line;             [:121]
             ├─ cursor park + DECTCEM toggle                            [:124-146]
             └─ ONE write:  rt.writeOutput(out)                          [:155]
                  └─ runtime.ts:141 ──> TerminalIO.write(data)
                       ├─ ProcessTerminalIO ──> process.stdout.write   [terminal-io.ts:48]
                       └─ SSHTerminalIO     ──> channel.write          [ssh-server.ts:373]
```

Properties that matter for images:

- **Absolute row addressing.** Every emitted row starts with `\x1b[<row>;1H`, so a payload always lands at a known `(row, col=1)` anchor.
- **Per-row diff.** An unchanged row costs literally zero bytes. Measured: a static full-viewport half-block image emits **0 bytes** on every idle frame.
- **One atomic write per frame.** All rows concatenate into one string handed to one `write()`. Over SSH that is one `channel.write`.
- **Every content line is prefixed by one column** and then left-padded by `padStr`. An image's true screen column exists only *after* composition.
- **`CONTENT_MAX_WIDTH = 100`** (`layout-constants.ts:9`). `blockRenderWidth = min(columns, 100) - 1`, so **no content-page image can exceed 99 cells wide**, regardless of terminal size. Vertical budget is `viewportHeight = rows - 7`.

### 2.2 The truth about existing image support

**Verdict CLAIM 2: CONFIRMED.** There is no working image support. But the initial framing ("sharp is missing, therefore images are broken") is misleading — installing `sharp` today would change nothing user-visible. There are **three independent breaks**:

| # | Break | Evidence |
|---|---|---|
| 1 | **Dependency.** `sharp` is declared nowhere. | `package.json` `dependencies: {esbuild}`, `peerDependencies: {node-pty, ssh2}`, **no** `optionalDependencies`. `grep -n sharp package.json` → no match. `npm ls sharp` → empty. Zero entries in `package-lock.json`. Not in `node_modules` anywhere on the machine, globally, or in any parent dir. `createRequire().resolve('sharp')` from `src/ascii/image.ts`, `dist/index.js` and `package.json` → all `MODULE_NOT_FOUND`. |
| 2 | **Wiring.** Even with `sharp` installed, the `image` block never reaches `asciiImage()`. | `runtime-block-render.ts:203-204` → `renderImage()` in `src/components/Image.ts`, whose own header comment says it is "a basic placeholder that renders a bordered frame". It prints the literal `[Image: ${path}]` at `Image.ts:19`, never reads the file, never `stat()`s it. `grep -rn asciiImage src/` returns exactly two hits: the definition and a re-export at `index.ts:148`. |
| 3 | **Synchrony.** `asciiImage()` is `async` (`image.ts:215`); every renderer is sync. | `renderBlock` is `export function ... : string[]`. `grep -n "async \|await " src/core/runtime-render.ts src/core/runtime-block-render.ts src/core/runtime-terminal.ts` returns exactly one hit, and it is a comment. |

Executed against the real source with a genuine 64×64 PNG (validated by `file` and `sips`), every call to `asciiImage()` — every mode, plus a `Buffer` source — returned:

```
["[Image: install sharp for image support]", "  npm install sharp"]
```

Also: the sharp guard runs **before** any file access, so a nonexistent path returns the same install hint instead of the intended error. The `could not load image` branch at `image.ts:267` is unreachable dead code.

Three further defects in the disconnected pipeline, all confirmed by reading:

- **`renderBlocks` throws away half its output.** `image-renderers.ts:98` picks `█`/`▀`/`▄`/` ` from a binary luma threshold and then `:22` paints the whole cell with the **average** of both half-pixels as a *foreground* colour. `grep -rn bgColor src/ascii/` → empty. So the glyph carries no information: a fg-only half-block is informationally identical to a solid one-colour cell. Roughly half of all cells (both halves below threshold → a space) discard their colour entirely and let the theme background show through.
- **Aspect is applied twice for sub-cell modes.** `image.ts:243-254` multiplies the pixel target by the mode factor, then `image.ts:140` applies `× 0.5` for cell aspect, and then `image-renderers.ts:93` steps `y += 2` (blocks) or `:67` steps `by += 4` (braille). Both render 2× vertically squashed. `ascii` and `shading` are correct.
- **Dither/quantizer mismatch.** `image.ts:279` computes 5 dither levels for `blocks`, whose consumer at `image-renderers.ts:96-97` is binary. Error is diffused against the wrong quantizer. Dithering also operates on the greyscale array only, so it cannot correct hue or saturation error at all.

### 2.3 Other pre-existing defects in the image path

| Defect | Location | Impact |
|---|---|---|
| `renderImage` overflows its own box | `Image.ts:20-26` pads the label but never truncates it | Measured: `ctx.width=20` emits rows 25–66 cells wide |
| Layout estimator disagrees with the renderer | `flex-engine.ts:315` `case "image": return 10;` vs 15 rows actually emitted at `ctx.width=99` | Callers do `cursorY += h + 1`, so every `FocusRect` below an image is 5 rows too high; `spatial.ts:69-88` scores by rect centres, so arrow keys misroute |
| `mode` is dead | Declared at `Image.ts:9`, never read | `mode: "braille"` and `mode: "ascii"` produce byte-identical output |
| No path anchor | `SiteConfig` built at `runtime.ts:548-574` carries no `projectDir`; `RenderContext` has none | `image("./x.png")` can only resolve against `process.cwd()`, which is wrong for `terminaltui dev demos/x/config.ts` and for `terminaltui demo <name>` (project lives inside `node_modules`) |
| `serve` config is dropped entirely | `FileBasedConfig` in `router/types.ts` has **no** `serve` field (verified: `grep -n serve src/router/types.ts` → nothing); `cli/serve.ts:86-107` builds `siteConfig` without one | `runtime.ts:204` `this.site.serve?.colorMode` is **always undefined** under `terminaltui serve`. Any future `serve.images` knob is dead on arrival until this is fixed. |
| Zero test coverage | `grep -rl 'renderImage\|type: "image"\|asciiImage' test/` → nothing; no demo calls `image()` | `Image.ts` can be rewritten wholesale without touching any of the 2485 assertions |

---

## 3. The five hard problems

### 3.1 Sync renderers vs async decode

**Problem.** `renderBlock` returns `string[]` synchronously; there is no `await` anywhere in the render pass, and `runtime.ts:407-419`'s per-frame `setColorMode` / `finally setColorMode(prev)` wrapper is race-free *only* because of that.

**CORRECTED — the survey claimed this "REQUIRES" an async pass. That is refuted.** A third option exists and was measured. Using node built-ins only (`fs.readFileSync` + `zlib.inflateSync` + PNG un-filter, zero dependencies, zero `await`):

```
SYNC decode OK: 1600x1000 rgba bytes=6400000 in 27.167 ms
total wall time (decode + render), fully synchronous: 27.50 ms
```

`sharp`'s asynchrony is `sharp`'s, not the format's. And both recommended decoders expose synchronous entry points: `pngjs`'s `PNG.sync.read()` and `jpeg-js`'s `decode()`.

**Also CORRECTED — `asyncContent` does NOT provide a reusable pattern.** Four independent failures, all measured:

| Failure | Evidence |
|---|---|
| It is not in `renderBlock` at all | `runtime-block-render.ts:263-264` — `case "asyncContent": return [];`. The real implementation lives only in `renderContentPage`'s top-level loop (`runtime-render.ts:260-261` → `renderAsyncContentBlock` at `:451`). |
| It renders **nothing** inside layout containers or on the home page | Measured: `page=top` frame1-LOADING true / frame2-RESOLVED true; `page=insection` true/true; **`page=inpanel` false/false; `page=incolumns` false/false**; `isHome` → false/false. Inside a panel, `load()` never even fires. |
| Its loader is width-blind | `config/types.ts:410` — `load: () => Promise<ContentBlock[]>`. No `ctx.width`, no theme, no colour mode: the three inputs an image needs. |
| Loaded content is unreachable by focus | `runtime-pages.ts:321` walks with default `STRUCTURAL_EDGES`, which `block-walker.ts:20-25` deliberately excludes `asyncContent` from, and passes no `resolveAsync`. Measured: focus items before resolve 1, after resolve 1, while the frame contains the async card. |
| It permanently disables the layout fast path | `runtime-pages.ts:241-247` `isVolatileContent` → `runtime-render.ts:48` `cacheHit` is false forever. Measured: `layoutCache.volatile: true`. |

**Resolution.** Sync-first, memoised.

```
renderImage(rt, block, ctx) -> string[]          // still synchronous
  1. geo   = imageCellSize(block, ctx.width)     // pure, sync, header-only probe
  2. rows  = serialCache.get(`${cellKey}:${colorMode}`)  -> return rows
  3. grid  = pixelCache.get(cellKey)             // resampled sub-cell RGBA
  4. miss  -> decode synchronously (budgeted), resample, store, serialise
  5. over budget / remote / unsupported -> placeholder of EXACTLY geo.rows
```

The one rule this imposes: **any new block behaviour must live in the `renderBlock` switch, never only in `renderContentPage`'s loop.** `asyncContent` is the standing proof that the second location makes a block silently vanish inside every layout container.

For genuinely oversized or remote sources, instantiate `AsyncContentManager` (`src/data/async-content.ts`) **directly** — its epoch-guarded keyed state machine is a good generic cache — keyed by the image cache key, with `rt.render()` as the completion callback. Do not route images through the `asyncContent` *block*.

### 3.2 The write path is hostile to escape payloads

**Verdict CLAIM 1: PARTIALLY_TRUE.** Three corrections to the survey.

**Correction 1 — "cannot survive" is false; survival is width-conditional.** `runtime-terminal.ts:121` only truncates when `stringWidth(line) > columns`. A real 55-byte sixel DCS with `stringWidth` 58 ≤ 80 was emitted **byte-identical, terminator and all**. The pipeline has no OSC/DCS/APC awareness whatsoever; it simply mangles anything that trips the width threshold. For any real image (thousands of base64 chars) that threshold is always tripped — so the practical conclusion holds — but a small-payload escape hatch genuinely exists.

**Correction 2 — the stated mechanism is wrong.** `cutToWidth` does *not* start counting base64 as width at the payload start. `base.ts:201-202`:

```js
if (ch === "\x1b") { inEscape = true; result += ch; continue; }
if (inEscape) { result += ch; if (ch === "m") inEscape = false; continue; }
```

Every byte after `ESC` is 0-width until a literal `m` appears. So the cut point is *(index of first `m`)* + `columns` visible cells. Measured on a 1269-byte kitty APC carrying a real 931-byte PNG: first `m` at payload index 109, ~185 of 1269 bytes retained, terminator gone, `\x1b[0m` appended inside the sequence. Corollary: **a payload containing no `m` at all passes through 100% intact** (proved: 209/209 bytes, `clipped=false`). For base64 that is a 3.1e-9 event, but it means the destruction is an accident of the `m` rule, not a width computation.

Same rule means any non-SGR CSI embedded in a composed line (e.g. `\x1b[2K`) swallows the rest of that line until the next `m`. That is a latent bug independent of images.

**Correction 3 — the C0 half is nearly all false.** `C0_EXCEPT_ESC = /[\x00-\x1a\x1c-\x1f\x7f]/g` strips **zero** bytes from kitty APC base64, from ST-terminated OSC 1337 and from sixel — every byte in those is ≥ 0x20 or is `ESC` itself. It strips exactly one thing: the **BEL terminator** of BEL-terminated OSC 1337 (1 byte). And even there truncation had already destroyed the payload.

Measured end to end at `columns=80` with a real PNG:

| Payload | survives C0 strip | byte-identical in output | terminator present |
|---|---|---|---|
| kitty APC, 1269 B | yes (0 lost) | **no** — 194 of 1274 emitted | no |
| iTerm2 OSC 1337, BEL | **no** (1 lost) | no | no |
| iTerm2 OSC 1337, ST | yes (0 lost) | no — 201 of 1281 | no |
| sixel DCS, 55 B (width 58 ≤ 80) | yes | **yes** | **yes** |
| kitty Unicode placeholder cell | yes | **yes**, `stringWidth` = 1 | n/a |

**Also found — the obvious workaround has its own hole.** Kitty's Unicode-placeholder mode encodes row/column in combining diacritics. 18 of the first 48 entries of kitty's `rowcolumn-diacritics` table return `charWidth` **1** instead of 0: `U+0483..U+0487` and `U+0592..U+05A1`, i.e. index 30 onward. `base.ts:43-53` covers `U+0300-036F`, `U+1AB0-1AFF`, `U+1DC0-1DFF`, `U+20D0-20FF`, `U+FE20-FE2F` but not `U+0483+` or `U+0591+`. Measured: a placeholder cell for row index 30 gives `stringWidth` **2**, not 1. So any placeholder image wider or taller than 30 cells silently inflates every row by one cell per column, breaking `padStr` centring, the focus gutter and the truncation guard.

**Resolution.**

- The **cell tier is unaffected**: it emits only `\x1b[...m` SGR plus glyphs ≥ U+2580. `stripAnsi`'s SGR-only regex is exactly correct for it, `cutToWidth`'s `m` rule is exactly correct for it, and no byte falls in the C0 range. Measured: a 79-cell truecolor half-block row has `stringWidth` 79, `cutToWidth(80)` returns it losslessly with `clipped=false`, and `renderPanel(width=40)` returns all 8 rows at exactly width 40.
- **Never** put a graphics payload inside `lines: string[]`. Two supported routes when protocols land later: (a) **reserve cells** in the text grid so layout/scroll/clip/centre all keep working on correctly-measured blank rows, and (b) emit the pixels **out of band** after the row loop, via the unfiltered `rt.writeOutput()` pipe (`runtime.ts:141` → `terminal-io.ts:48` / `ssh-server.ts:373`, neither of which sanitises anything).
- **Never use BEL.** Only ST (`\x1b\\`) survives the C0 strip.
- If placeholders are ever used, `charWidth` must first zero-width the full kitty diacritic set (at minimum `U+0483-0487` and `U+0591-05BD`).

### 3.3 Height measurement and focus rects

**Problem.** `estimateBlockHeight` is module-private and returns a hardcoded `10` for `image` while the renderer emits 15 at typical width. Callers do `cursorY += h + 1` for every block, so every `FocusRect` below an image is offset and `spatial.ts` misroutes arrow keys. Real images have real, variable heights, so this gets worse, not better.

**Resolution.** One exported pure function, called by **both** the renderer and `flex-engine.ts:315`:

```ts
imageCellSize(block, availWidth): { cols, rows, subW, subH, tier }
```

Backed by a **synchronous header-only dimension probe** — PNG IHDR width/height at fixed byte offsets 16–23, a short JPEG SOF0/SOF2 marker scan, GIF logical screen descriptor at offset 6, BMP DIB header — over a 4–64 KB `readSync`, memoised by `(absPath, mtimeMs, size)`. Microseconds, once. This is what makes the **very first placeholder frame already the correct height**, so nothing reflows when the decode lands.

Geometry math, applied at the **character-cell** level and only then converted to pixels (the inverse of today's bug):

```
cols = min(block.width ?? default, availWidth)
rows = block.height ?? max(1, round(cols * (srcH / srcW) * CELL_ASPECT))    // CELL_ASPECT = 0.5
pixel grid = cols * SX  ×  rows * SY      // SX,SY = subcell layout of the chosen tier
```

`CELL_ASPECT` becomes one exported constant, consolidating three scattered literals: `ascii/image.ts:140` (`* 0.5`), `ascii/shapes.ts:131` and `ascii/shapes-extra.ts:86` (`hScale = 2`).

**Invariant to pin with a test:** loading, loaded, error and no-decoder states must all return byte-identical row counts from the same `imageCellSize()` call.

**Do not** add `"image"` to `FOCUSABLE_TYPES` (`block-taxonomy.ts:15-19`). It shifts focus indices across every demo and is pinned by `test/focus-contract.test.ts`. Images are not actionable. Fixing the height alone restores every *sibling's* rect, which is the bug that actually misroutes arrow keys.

### 3.4 Caching

**Constraints.**

- `colorMode` is a module-level `let` (`colors.ts:62`) swapped per render **per SSH session** by `runtime.ts:407-419`. Caching baked ANSI without `colorMode` in the key lets a truecolor session poison a 256-colour session.
- `runtime-internal.ts:41-47` states the rule for per-terminal state: *"Lives on the runtime instance — exactly one per terminal stream ... Never hoist this to module scope."* That rule governs frame/placement state, not content-addressed decodes.
- Established precedent for content-addressed, session-independent artifacts is module scope: `page-loader.ts:12`, `resolver.ts:21`, `art-registry/index.ts:374`, `data/cache.ts:37`. **All of them are unbounded** — correct for compiled modules, fatal for decoded RGBA.
- Measured hazard: `base.ts:106` `WIDTH_CACHE_CAP = 8192` with a documented budget of *"8k entries × ~200 chars ≈ 3 MB"*. A truecolor half-block row is ~2.6–2.9 KB. Feeding 10,600 unique animated rows filled the cache 8192/8192 and grew `heapUsed` by **60.3 MB** — 20× the documented budget, shared process-wide across all SSH sessions.

**Resolution — two module-scope layers plus one per-runtime field.**

| Layer | Scope | Key | Value | Bound |
|---|---|---|---|---|
| L1 pixel | module | `sha1(absPath):mtimeMs:size:subW×subH:mode:dither:invert` — **no `colorMode`** | resampled sub-cell RGBA | byte-budgeted LRU, default 32–64 MB |
| L2 serial | module | `${L1key}:${colorMode}` | finished `string[]` | entry LRU, ~64–256 |
| `inflight` | module | L1 key | `Promise` | — |
| `imagePending` | **per runtime** | — | `Set<key>` | — |

Keeping `colorMode` out of L1 means a per-session mode swap can never evict a decode, and a truecolor session can never poison a 256-colour one. `mtimeMs` + `size` in the key means an edited file misses naturally — **there is no invalidation logic at all**, only eviction. A resize re-keys naturally via `cols×rows`; quantise target dimensions to a coarse grid before keying so a window-drag storm cannot thrash.

`inflight` is what makes `serve` affordable: `ssh-server.ts:64` allows 100 concurrent runtimes in one process, and without decode deduplication the same asset decodes 100 times.

Image rows should also **bypass `stringWidth` entirely** — their width is known exactly by construction (it is the cell count), and a length gate on the width cache keeps the documented 3 MB budget instead of 60 MB.

### 3.5 SSH and the test emulator

#### 3.5.1 Bandwidth — **CORRECTED, twice**

**Verdict CLAIM 5: PARTIALLY_TRUE.** Driving the real `writeToTerminal()` with synthetic half-block frames:

| geometry | image | mode | first frame | idle | scroll +1 | focus ±1 |
|---|---|---|---|---|---|---|
| 80×24 | 79×17 | truecolor | 53,688 B | **0** | 52,979 B | 52,983 B |
| 120×40 | 99×33 | truecolor | 126,785 B | **0** | 125,944 B | 125,970 B |
| 200×60 | 99×53 | truecolor | 208,402 B | **0** | 207,426 B | 207,452 B |
| 200×60 | 99×53 | 256 | 132,011 B | **0** | 131,031 B | 131,057 B |

**Correction 1 — the magnitude was overstated.** `CONTENT_MAX_WIDTH = 100` caps any content-page image at 99 columns. The 200×60 case is 208 KB, not the 493 KB a naive full-grid calculation gives.

**Correction 2 — "prohibitive" is too strong for one frame.** 208 KB is 17 ms at 100 Mbps, 67 ms at 25 Mbps, 333 ms at 5 Mbps. It never stalls SSH flow control either: `ssh2/lib/Channel.js:14-16` sets `PACKET_SIZE = 32 KiB`, `MAX_WINDOW = 2 MiB`, and the Duplex `highWaterMark` is 2 MiB. One frame is 10% of the window.

**Correction 3 — and this is the important one — the survey named the wrong problem.** "Only the first frame / animations / resizes" omits the dominant case: **scrolling**. `runtime-render.ts:336-338` re-slices `allContentLines` by `pageScrollOffset`, so a single ↓ keypress changes every viewport row and the diff recovers **0.5%** of the frame. Focus enter/leave has the same all-rows-change property, because `runtime-render.ts:279/:281` prefixes `▌` vs `" "` on every line of the focused block.

Held-key scroll at 30 repeats/s:

| geometry | truecolor | 256-colour |
|---|---|---|
| 80×24 | 11.1 Mbit/s | 7.1 Mbit/s |
| 120×40 | 28.8 Mbit/s | 18.2 Mbit/s |
| 200×60 | 47.8 Mbit/s | 30.3 Mbit/s |

**Correction 4 — the failure mechanism is misdiagnosed.** It is not link capacity. `ssh-server.ts:370-375` **discards** `channel.write()`'s backpressure boolean; `terminal-io.ts:48-50` does the same with `process.stdout.write`. `grep -rn "drain|writableLength|needDrain|cork" src/core src/io` → **zero hits**. Meanwhile `render()` runs synchronously per keypress with no frame coalescing (the 0 ms debounce at `runtime.ts:217-221` only guards the legacy global callback). So N buffered ↓ keystrokes enqueue N × 208 KB into a Writable that never pushes back, and ssh2's `data` handler never pauses input. The result on a slow link is **linear memory growth and multi-second input lag**, not a clean frame drop.

Encoding alternatives, same 99×53-cell picture:

| encoding | photo | flat/logo art |
|---|---|---|
| truecolor half-block, naive | 204,582 B | 200,817 B |
| 256 half-block, naive | 128,191 B | — |
| 256 + SGR run-length elision | **67,379 B** (1.9×) | 26,765 B (7.5×) |
| truecolor + RLE | ~204,000 B (≈0 saving) | 26,765 B |
| kitty graphics (real PNG + base64 + framing) | 41,092 B (5.0×) | **356 B** (605×) |

Note: RLE is nearly worthless for truecolor photos (adjacent 24-bit pixels rarely repeat exactly) but mandatory in 256-colour.

#### 3.5.2 The test emulator — **worse than the survey claimed**

**Verdict CLAIM 6: CONFIRMED, with the severity understated.**

`src/emulator/vterm.ts:28` declares exactly four parse states: `"ground" | "escape" | "csi" | "osc"`. The escape dispatch at `:206-224` enumerates only `[`, `]`, `(`, `=`, `>`, `7`, `8`, `M`; everything else falls into `else { this._parseState = "ground"; }` at `:221-222`. So `ESC P` (DCS/sixel) and `ESC _` (APC/kitty) return to ground and every subsequent payload byte (all ≥ 0x20) hits `_putChar` at `:201-202` and is **painted into the cell grid**.

Measured against the real `vterm`:

```
kitty APC   -> row0 |HELLO-BEFOREGa=T,f=100,s=10,v=10,m=0;iVB|
               row1 |ORw0KGgoAAAANSUhEUg==|              LEAKED
sixel DCS   -> row0 |HELLO-BEFOREq"1;1;10;10#0;2;0;0;0#1;2;10|  LEAKED
kitty chunked (m=1)                                       LEAKED
iTerm2 OSC 1337 (BEL)                                     clean
iTerm2 OSC 1337 (ST)                                      clean
bare ST                                                   clean
```

**Severity, measured.** Painting a realistic 24-row UI and then emitting one kitty image with a 4,004-byte base64 payload (a 200×200 PNG is 8–20 KB, so this is conservative):

```
UI rows still visible: 0 / 24
cursor: { row: 23, col: 58 }
ENTIRE UI SCROLLED OFF: YES
```

The payload wraps at `vterm.ts:330-333` → `_lineFeed` → `_scrollUp` (`:370-385`), scrolling all 24 rows of real UI out of the buffer. It is not a dirtied row; it is **total screen destruction**. Every `contains()`, `text()`, `menu()`, `cards()` and `matchesSnapshot()` assertion on any frame containing an image would fail.

**Refinements the survey missed:**

- **Scope.** The leak is specific to DCS and APC. **OSC is parsed correctly** (`vterm.ts:236-242`, terminating on BEL or ESC-backslash), so iTerm2 OSC 1337 passes through the emulator cleanly *today, with no code change*. "Graphics escapes" are not uniformly unsafe.
- **Tense.** No assertion is broken right now — `Image.ts:19` emits only a text placeholder and nothing in `src/` ever emits DCS or APC. This is a conditional prediction about the moment images are wired in.
- **BEL is doubly fatal.** `runtime-terminal.ts:56` strips `\x07`, so a BEL-terminated OSC 1337 arrives **unterminated**, and the emulator's `osc` state then swallows the entire rest of the session. Measured: *"parser stuck swallowing everything: YES."* `_parseState` is instance state with no per-`write()` reset, so one malformed frame silently freezes the screen for the whole suite.

**Resolution.**

- The **cell tier is entirely emulator-safe today**. `vterm-parser.ts:129-141` already implements SGR 48 for both `;5;n` and `;2;r;g;b` and stores fg/bg per cell. Measured round-trip: `cellAt(0,0)` → `{"char":"▀","fg":"#005014","bg":"#1400c8"}`. This is the one tier that is genuinely **assertable** — no pixel protocol can ever be.
- Before any protocol work, add `dcs`/`apc` (and ideally `pm`/`sos`) states to `vterm.ts`, consuming to ST exactly as `osc` does. ~10 lines. Ships alone with zero production behaviour change and hardens all 2485 assertions against any future string sequence.
- Record consumed payloads into a `graphics: {intro, byteLength, atRow, atCol}[]` sink so tests can assert *"an image of N bytes was placed at row 5"* without modelling pixels. `Cell` (`emulator/types.ts:17-26`) has no graphics field and should not grow one.

#### 3.5.3 Free capability data SSH is currently discarding

`ssh-server.ts:225` builds `ptyInfo = { cols, rows, term }`. RFC 4254 §6.2 `pty-req` also carries `uint32 terminal width, pixels` and `uint32 terminal height, pixels`; ssh2 parses them and `@types/ssh2` exposes them as `info.width` / `info.height`. `window-change` (`:231-232`) drops them too.

That is **exact cell pixel geometry with zero round trips**, on the one delivery path where probing is most expensive. Node's `process.stdout` exposes only `columns`/`rows`, so locally this requires a `CSI 16 t` probe; over SSH it is being handed over and thrown away.

Guards: RFC 4254 says *"Zero dimension parameters MUST be ignored"*, and Win32-OpenSSH hardcodes a fake 640×480 — reject zeros and reject cell aspect ratios outside roughly 1:1.2–1:3.

---

## 4. How terminal image rendering actually works

### 4.1 Cell-based techniques

Every cell technique is the same three-step algorithm:

1. Choose the character grid `cols × rows` from the available box and the source aspect ratio.
2. Resample the source to `cols·SX × rows·SY` sub-pixels, where `(SX, SY)` is the technique's sub-cell layout. This resample is deliberately non-uniform — the cell aspect is baked in.
3. For each cell, choose a glyph and one or two colours that minimise reconstruction error.

```ts
const SUBCELLS = {
  solid:    [1, 1],   // space + bg only
  ascii:    [1, 1],
  shading:  [1, 1],
  half:     [1, 2],   // U+2580
  quadrant: [2, 2],   // U+2596..U+259F
  sextant:  [2, 3],   // U+1FB00..U+1FB3B
  octant:   [2, 4],   // U+1CD00..U+1CDE5
  braille:  [2, 4],   // U+2800.. (ONE colour per cell)
};

// chafa's exact geometry, chafa_calc_canvas_geometry():
// fontRatio = cellWidth / cellHeight, typically 0.5
function fitCells(srcW, srcH, maxCols, maxRows, fontRatio = 0.5) {
  const srcAspect = srcW / srcH;
  let cols = maxCols;
  let rows = Math.ceil((cols / srcAspect) * fontRatio);
  if (rows > maxRows) { rows = maxRows; cols = Math.ceil(rows * (srcAspect / fontRatio)); }
  return { cols: Math.max(1, cols), rows: Math.max(1, rows) };
}
```

Sub-cell shapes on a 1:2 cell: half-block **1:1 (square)**, quadrant 1:2 (tall), sextant 3:4, octant **1:1 (square)**, braille 1:1.

#### Half-block — the universal floor

`▀` U+2580 UPPER HALF BLOCK, foreground = top pixel, background = bottom pixel. Two independent pixels per cell, exactly reproduced. This is lossless at 1×2.

```
"\x1b[38;2;R1;G1;B1;48;2;R2;G2;B2m▀"        truecolor, combined SGR  (36 B/cell avg)
"\x1b[38;5;F;48;5;Bm▀"                       256-colour              (22 B/cell avg)
"\x1b[38;2;R;G;Bm▀" + "\x1b[48;2;R;G;Bm"     separate  (41 B worst case — prefer combined)
```

Degenerate optimisation: when top and bottom are equal, emit `"\x1b[48;2;R;G;Bm "` — a **space with a background colour only**. Needs zero font coverage, is never ambiguous-width, and is shorter.

Measured fidelity delta of fg+bg over fg-only: **+3.17 dB PSNR**. Critically, fg-only scores *identically to a solid one-colour cell* (20.09 dB both) — the glyph carries no information. That is exactly what `image-renderers.ts` does today.

**Width caveat:** `U+2580-258F` and `U+2592-2595` are East Asian Width **Ambiguous**. Under a CJK locale or an "ambiguous = wide" terminal setting they occupy 2 cells and the image shears. `U+2596-259F` (quadrants), `U+2800-28FF` (braille), `U+1FB00+` and `U+1CD00+` are all **Neutral**.

#### Quadrant — 2×2, two colours, Neutral width

The 16-glyph table, with bit0 = top-left, bit1 = top-right, bit2 = bottom-left, bit3 = bottom-right (verified exhaustively against `UnicodeData.txt` names):

```ts
const QUAD = [
  0x0020, 0x2598, 0x259D, 0x2580, 0x2596, 0x258C, 0x259E, 0x259B,
  0x2597, 0x259A, 0x2590, 0x259C, 0x2584, 0x2599, 0x259F, 0x2588,
];
```

Choosing the partition — this is chafa's core algorithm, and for 4 sub-pixels exhaustive search over all 16 masks is both **faster and better** than 2-means (measured 23.89 vs 23.76 dB):

```ts
// fg = mean(covered), bg = mean(uncovered) is the closed-form optimum
// for a FIXED partition. Score = sum of squared RGB distance to the assigned pen.
function bestPartition(sub /* RGB[] */, masks /* number[] */) {
  let best = Infinity, bm = 0, bfg = [0,0,0], bbg = [0,0,0];
  for (const m of masks) {
    let fr=0,fg=0,fb=0,fc=0, br=0,bg=0,bb=0,bc=0;
    for (let i = 0; i < sub.length; i++) {
      const p = sub[i];
      if ((m >> i) & 1) { fr+=p[0]; fg+=p[1]; fb+=p[2]; fc++; }
      else              { br+=p[0]; bg+=p[1]; bb+=p[2]; bc++; }
    }
    const F = fc ? [fr/fc, fg/fc, fb/fc] : [0,0,0];
    const B = bc ? [br/bc, bg/bc, bb/bc] : [0,0,0];
    let err = 0;
    for (let i = 0; i < sub.length; i++) {
      const p = sub[i], q = ((m >> i) & 1) ? F : B;
      err += (p[0]-q[0])**2 + (p[1]-q[1])**2 + (p[2]-q[2])**2;
    }
    if (err < best) { best = err; bm = m; bfg = F; bbg = B; }
  }
  return { mask: bm, fg: bfg, bg: bbg };
}
```

For sextants (64 masks) and octants (256 masks) chafa shortlists candidates: seed a contrasting colour pair from the widest-range channel's extrema, threshold each sub-pixel to the nearer seed producing a bitmap, then take the ≤8 lowest Hamming distances against precomputed per-glyph coverage bitmaps.

Measured gains over half-block: quadrant **+0.63 dB**, octant **+1.29 dB**. Sharply diminishing — roughly 70% of the total achievable win comes from fixing half-blocks alone.

#### Sextant / octant codepoint mapping

Included for completeness. **See §5 for why these should not ship.**

```ts
function sextantCodepoint(v) {          // v in 0..63, bit i = position i+1, rows of 2
  if (v === 0)  return 0x0020;
  if (v === 21) return 0x258C;          // left column
  if (v === 42) return 0x2590;          // right column
  if (v === 63) return 0x2588;
  return 0x1FB00 + v - (v > 42 ? 3 : v > 21 ? 2 : 1);
}
// Octants: 26 of 256 patterns alias to pre-existing chars; the rest live in
// U+1CD00..U+1CDE5.  cp = 0x1CD00 + v - (count of alias keys < v).
// Alias keys (ascending): 00,01,02,03,05,0a,0f,14,28,3f,40,50,55,5a,5f,
//                         80,a0,a5,aa,af,c0,f0,f5,fa,fc,ff
```

#### Braille — for line art only

`U+2800 + bitmask`, dot layout `dot1 dot4 / dot2 dot5 / dot3 dot6 / dot7 dot8`:

```ts
const BRAILLE_BIT = [[0,3],[1,4],[2,5],[6,7]];   // [row][col] -> bit
```

Two independent disqualifiers for photographs:

1. All 8 dots share **one** SGR foreground; the unlit area shows the terminal background you did not choose.
2. Dots do not fill their sub-cell — a dot is a small disc with whitespace around it, roughly 55% areal coverage. Modelled honestly, braille scores **12.62 dB — worse than a plain solid one-colour block at 20.09 dB**, because the gaps drag lit regions toward the background.

Braille is right for 1-bit line art: plots, sparklines, waveforms, edge maps.

#### ASCII / shading ramps

`" .:-=+*#%@"` (10 levels) or `" ·:░▒▓█"`. Short ramps beat long ones: a 70-character ramp's steps are not perceptually uniform and adjacent glyphs are indistinguishable at terminal sizes. Apparent ink density also varies by typeface, so no ramp is correct for all fonts.

#### Colour quantization — the 256-colour path is measurably broken

This mattered more than any glyph choice back when Apple Terminal was hard-capped to 256 at `colors.ts:31`. That cap has since been lifted for build 470+ (macOS 26), so a current Apple Terminal gets truecolour and this section now describes the *older* Apple Terminals and every other 256-colour session.

```ts
// CURRENT — src/style/colors.ts:84-96
if (r === g && g === b) {                              // BUG 1: exact-grey gate
  return Math.round((r - 8) / 247 * 24) + 232;         // BUG 2: wrong ramp formula
}
const ri = Math.round(r / 255 * 5);                    // BUG 3: assumes uniform steps
```

Three independent defects:

1. **The xterm cube is not uniformly spaced.** Its levels are `0, 95, 135, 175, 215, 255` — the first step is 95 wide, the rest are 40. `Math.round(v/255*5)` models them as `0,51,102,153,204,255`. **107–112 of 256 channel values map to the wrong level.** Worst cases: `v=140` picks 175 (error 35) when 135 (error 5) exists; `v=180` picks 215 when 175 exists — 7× error.
2. **The greyscale ramp is gated on exact `r===g===b`.** A near-grey like `(28,26,28)` skips the 24-step ramp entirely and lands on cube index 59 = `(95,95,95)` — **error 117** where index 234 = `(28,28,28)` with error 2 was available. Near-greys dominate photographs, anti-aliased UI and screenshots.
3. **Even exact greys are wrong.** The ramp is `8 + 10i`, so the index is `(v-8)/10`, not `(v-8)/247*24`. 80 of 241 exact-grey inputs are suboptimal.

Measured RMSE over 140,608 samples: **current 51.65–53.0, corrected 28.5–31.8, exhaustive-optimal 28.35–31.63.** Roughly 1.9× worse than achievable, at ~20 distance evaluations.

```ts
const CUBE_LEVELS = [0x00, 0x5f, 0x87, 0xaf, 0xd7, 0xff];
const CUBE_IDX = new Uint8Array(256);
{ const bounds = [47, 115, 155, 195, 235];   // midpoints, chafa-palette.c
  for (let v = 0; v < 256; v++) { let k = 0; for (const b of bounds) if (v >= b) k++; CUBE_IDX[v] = k; } }

export function rgbTo256fixed(r, g, b) {
  const cube = 16 + 36*CUBE_IDX[r] + 6*CUBE_IDX[g] + CUBE_IDX[b];
  const lum  = (r*2 + g*5 + b) >> 3;
  const grey = 232 + Math.max(0, Math.min(23, Math.round((lum - 8) / 10)));
  return d2(r,g,b,grey) < d2(r,g,b,cube) ? grey : cube;   // ALWAYS evaluate both
}
```

Two further refinements worth taking:

- **Exclude palette indices 0–15 from image output.** The user's colour scheme redefines them arbitrarily, so the error model for them is fiction. Cost measured at **+0.16% RMSE** — free insurance, and it makes 256-colour output theme-independent.
- **DIN99d for the 16-colour path.** Chosen over CIEDE2000 because DIN99d is a *Euclidean* perceptual space: convert each palette entry once and keep using plain squared distance. Measured perceptual RMSE 43.85 → 35.81 (−18%) at 16 colours, and the two metrics disagree on 22.7% of inputs. Concrete current failures: `(157,92,52)` brown → RGB picks bright-black grey, DIN99d picks red; `(238,232,185)` cream → RGB picks white, DIN99d picks yellow.

#### Dithering — ordered, not Floyd-Steinberg, and for a systems reason

Measured on blurred PSNR (the metric that tracks perception):

| palette | none | ordered Bayer | Floyd-Steinberg |
|---|---|---|---|
| 256 | 24.97 dB | 29.30–30.08 dB | **36.02 dB** |
| 16 | 17.49 dB | 20.08–21.09 dB | **27.76 dB** |
| truecolor | — | disabled by chafa | disabled |

Floyd-Steinberg is genuinely the better image, by a lot. **Reject it as the default anyway.** FS is a sequential dependency chain: one changed pixel perturbs every subsequent pixel, so any scroll, resize or animation dirties 100% of rows and destroys the per-row diff at `runtime-terminal.ts:113`. Bayer is a pure function of `(x, y, colour)`, so unchanged regions stay byte-identical. Expose FS as an opt-in for static hero art.

chafa's amplitude scaling (`chafa-canvas.c`): base magnitude 1.0 fg/bg, 0.5 for 8-colour, 0.25 for 16, **0.1 for 256** — and the matrix is scaled `(raw − N²/2) × (256/N²) × magnitude`. Note the cube's first step is 95 wide vs 40 for the rest, so shadows need more amplitude than highlights.

Both dithers must operate on the **full RGB triple**. `ascii/image.ts:282-286` currently diffuses error on the greyscale array only, which cannot correct hue or saturation error at all.

**Better than dithering for 2-colour cells:** chafa's `use_quantized_error`. Snap the candidate's fg/bg *through the palette* before scoring the glyph, so the glyph choice compensates for palette error rather than the pixels being pre-noised. One extra lookup per candidate, no injected noise, and it is a pure function of the cell so it does not defeat the diff.

#### Byte-cost optimisation

chafa's `REUSE_ATTRIBUTES`: track the previous cell's fg/bg and emit only the parts that changed, using the combined `\x1b[38;2;…;48;2;…m` form when both change. Typically halves the stream on flat art; near-zero on truecolor photos but 1.9× on 256-colour.

### 4.2 The kitty graphics protocol

```
ESC _ G <k=v,k=v,...> ; <base64 payload> ESC \
\x1b  _ G                              ;                 \x1b \
```

Terminator is **ST**, not BEL. Payload is standard base64, max **4096 bytes per escape**, and every non-final chunk's payload length must be a multiple of 4.

Key reference (defaults in parentheses):

| key | meaning |
|---|---|
| `a` (`t`) | `t` transmit, `T` transmit+display, `p` place, `d` delete, `f` frame, `a` anim ctl, `q` query |
| `f` (`32`) | `24` RGB, `32` RGBA, `100` PNG |
| `t` (`d`) | `d` direct (base64 inline), `f` file, `t` temp file, `s` POSIX shm |
| `s`,`v` | source width/height in px (required for f=24/32) |
| `m` (`0`) | `1` more chunks follow, `0` final |
| `i` / `I` | image id / image number (terminal allocates the id) |
| `p` | placement id |
| `c`,`r` | display size in **columns / rows**; give only one and the other is derived preserving aspect |
| `x`,`y`,`w`,`h` | source rectangle in image pixels — **this is how you crop a partially-scrolled image** |
| `z` (`0`) | z-index; negative draws under text; `< -1073741824` draws under non-default backgrounds |
| `C` (`0`) | `1` = do not move the cursor |
| `U` (`0`) | `1` = create a **virtual** placement for Unicode placeholders |
| `q` (`0`) | `1` suppress OK, `2` suppress OK **and** errors |
| `o` | `z` = zlib-deflate the payload before base64 |

```js
// Transmit once (PNG, chunked, silent)
function* transmit(id, b64) {
  const CH = 4096;
  let first = true;
  for (let o = 0; o < b64.length; o += CH) {
    const part = b64.slice(o, o + CH);
    const more = o + CH < b64.length ? 1 : 0;
    yield first
      ? `\x1b_Ga=t,f=100,t=d,i=${id},q=2,m=${more};${part}\x1b\\`
      : `\x1b_Gm=${more},q=2;${part}\x1b\\`;
    first = false;
  }
}

// Place cheaply (~40 bytes). Same i AND same p replaces in place, no flicker.
`\x1b[${row};${col}H` + `\x1b_Ga=p,i=42,p=1,c=40,r=20,z=-1,C=1,q=2\x1b\\`

// Crop for partial scroll — only kitty can do this
`\x1b_Ga=p,i=42,p=1,y=${hiddenRows*cellH},h=${imgH - hiddenRows*cellH},c=40,r=${20-hiddenRows},C=1,q=2\x1b\\`

// Delete.  lowercase = placements only (data cached);  UPPERCASE = also free the data
"\x1b_Ga=d,d=A,q=2\x1b\\"          // everything
"\x1b_Ga=d,d=I,i=42,q=2\x1b\\"     // image 42 + its data
```

**Unicode placeholders (`U=1`) — the architecturally interesting mode.** Transmit without displaying, create a *virtual* placement, then draw the image by emitting **ordinary text**: `U+10EEEE` cells whose foreground colour encodes the 24-bit image id and whose combining diacritics encode row and column (row first, then column).

```js
const PLACEHOLDER = "\u{10EEEE}";   // UTF-8 F4 8E BB AE; ONE cell; surrogate pair in JS
const DIA = ["̅","̍","̎","̐","̒","̽",
             "̾","̿","͆","͊","͋", /* 250+ more */];

`\x1b_Ga=p,U=1,i=42,c=40,r=20,q=2\x1b\\`             // virtual placement, draws nothing

function placeholderRow(id, row, cols) {             // then just... text
  const r = (id>>16)&0xff, g = (id>>8)&0xff, b = id&0xff;
  let s = `\x1b[38;2;${r};${g};${b}m`;
  for (let c = 0; c < cols; c++) s += PLACEHOLDER + DIA[row] + DIA[c];
  return s + "\x1b[39m";
}
```

kitty's own spec: *"Since this character is just normal text, Unicode aware applications will move it around as needed when they redraw their screens, thereby automatically moving the displayed image as well."*

Why this matters for terminaltui specifically: placeholder cells are real text, so they diff, scroll, self-crop under `cutToWidth`, survive `\x1b[2K`, survive Panel clipping, survive Columns row concatenation, and survive tmux. It is the **only** pixel protocol that needs no change to `writeToTerminal`. Two prerequisites: the `charWidth` diacritic fix (§3.2), and the image-id foreground colour must **bypass `fgColorRgb`** — that function routes through `rgbTo256` whenever `colorMode === "256"`, which `runtime.ts:204-209` legitimately sets for an SSH client reporting `xterm-256color` that is really kitty.

**The erase-semantics trap.** The spec says `\x1b[2J` should delete all images but *"the other commands to erase text must have no effect on graphics."* `writeToTerminal` emits `\x1b[2K` per changed row and **never** `\x1b[2J`, and `doNavigate` (`runtime-pages.ts:72-84`) issues no clear and no invalidation at all. With classic cursor-anchored placements, page A's image would stay on screen over page B forever. With placeholders, the cells are text and vanish with the text.

**Storage.** kitty and Ghostty default to a 320 MB per-buffer quota with LRU eviction; images without placements are deleted preferentially. Virtual placements count as placements.

**Re-transmit onto a live id is unspecified** (kitty issue #8701): Ghostty accepts it as an update, kitty does not. Delete and re-create under a new id instead.

### 4.3 iTerm2 inline images (OSC 1337)

```
ESC ] 1337 ; File = <k=v;k=v...> : <base64> ST
```

**ST is explicitly permitted** in place of BEL — confirmed in iTerm2's own docs twice, empirically in mintty, and by the `term-image` library which uses ST exclusively. This unblocks the C0-strip problem.

Documented arguments: `name` (base64 filename), `size` (decoded byte count), `width`, `height`, `preserveAspectRatio` (default 1), `inline`. Units: bare `N` = cells, `Npx` = pixels, `N%` = percent of session, `auto`.

```js
`\x1b]1337;File=inline=1;size=${bytes};width=40;height=12:${b64}\x1b\\`
```

Traps:

- **`inline=1` is mandatory.** Default is 0, which makes iTerm2 silently *download* the payload to `~/Downloads` instead of rendering.
- **`size=` is the decoded byte count**, not the base64 length. xterm.js rejects any payload exceeding `CEIL(size*4/3)`, so an understated `size=` silently kills the image in VS Code.
- **No line breaks in the base64.** xterm.js enforces RFC 4648 §4 with no separator bytes; mintty emits fragments of the OSC to the screen when the payload contains CR/LF.
- **`doNotMoveCursor=1` is a WezTerm extension that iTerm2 itself does NOT implement.** Verified: it appears in the iTerm2 repo only inside its *kitty*-protocol code. Supported by WezTerm, mintty, Konsole, Rio.
- **Konsole's `preserveAspectRatio` is inverted** in current master (`keepAspect = val == "0"` fed into `Qt::AspectRatioMode`), and with only one dimension supplied it disables scaling entirely. **Omit the key on Konsole.**
- **Images are cell-backed in iTerm2** (written as `screen_char_t` into the grid), so `\x1b[2K` and scrolling destroy them exactly like text. The cursor ends on the image's last row, one column right of it, and linefeeds between image rows **scroll the screen**.
- **Hard 1 MiB ceiling** (`VT100XtermParser.m:250`), and the File= exemption from it is lost once tmux wraps the sequence.
- **No image handle, no delete, no replace.** Every redraw is a full re-transmit. Documented pathologies: iTerm2 issue #10420 (memory never freed, 300 GB reported), mintty #1010 (flicker residue), WezTerm #3882 (strong flicker in animation).

Multipart form (iTerm2 3.5+, tmux-friendly): `MultipartFile=` (no colon, no payload) → repeated `FilePart=` → `FileEnd`. iTerm2's own `imgcat` chunks `FilePart` at **200 bytes** to get through tmux. WezTerm and Rio do **not** support multipart.

### 4.4 Sixel

```
DCS P1 ; P2 ; P3 q  <data>  ST
\x1b P  0 ; 1 ; 0 q          \x1b \
```

- **P1** = pixel aspect (0/1 → 2:1, 7/8/9 → 1:1). Set 0 and use raster attributes.
- **P2** = background select. `0`/`2` = zero bits set to background; **`1` = zero bits remain untouched** (transparency).
- **P3** ignored by everything modern.

Body grammar, all bytes in `0x21..0x7E`:

```
"Pan;Pad;Ph;Pv          raster attributes  ->  "1;1;<W>;<H>
#Pc;2;R;G;B             define register, RGB as PERCENTAGES 0..100  (NOT 0..255)
#Pc                     select register
0x3F..0x7E              one sixel = 6 vertical px, value = code - 0x3F, LSB = TOP
!<n><char>              run-length repeat
$                       graphics CR: back to left margin, SAME band
-                       graphics NL: left margin, NEXT band
```

Worked example, 4×6 px, two colours — verified byte-identical to node-sixel's own encoder output:

```
\x1bP0;0;q"1;1;4;6#0;2;100;0;0#1;2;0;0;100#0~T?F$#1?i~w$\x1b\\
```

Encoder core (~40 lines):

```ts
for (let y0 = 0; y0 < h; y0 += 6) {              // per band
  const rows = Math.min(6, h - y0);
  for (let c = 0; c < pal.length; c++) {         // per colour pass over the SAME band
    let line = "", run = "", runLen = 0, any = false;
    for (let x = 0; x < w; x++) {
      let bits = 0;
      for (let k = 0; k < rows; k++) if (idx[(y0+k)*w + x] === c) bits |= 1 << k;   // LSB = TOP
      const ch = String.fromCharCode(0x3f + bits);
      if (bits) any = true;
      if (ch === run) runLen++; else { line += flush(run, runLen); run = ch; runLen = 1; }
    }
    line += flush(run, runLen);
    if (any) out.push("#" + c + line + "$");     // '$' = CR, next colour overlays
  }
  if (y0 + 6 < h) out.push("-");                 // '-' = next band
}
```

Traps:

- **RGB components are 0–100 percent.** Emitting 0–255 clips everything to white. Most common sixel encoder bug.
- **Palette size must be queried, not assumed.** `xterm -ti vt340` gives **16** registers; VT382 emulation gives 2. Query `\x1b[?1;1;0S` → `\x1b[?1;0;256S`. Set `\x1b[?1070h` once for private per-image registers, or a later image recolours an earlier one.
- **Cap `!n` repeat counts at 255.** CVE-2022-24130 was a repeat-counter overflow that crashed sixel decoders across C, C++, Java, Rust and Go. As the *emitter*, in `serve` mode, that is a DoS against someone else's terminal.
- **Never emit DECSDM** (`\x1b[?80h`/`l`). Its polarity is genuinely inverted between xterm <369, foot <1.8.2, mintty, Contour and mlterm — hackerb9 confirmed on real VT340 hardware that the VT330/340 manual is wrong. Unusable in portable code. Bracket every image with explicit CUP instead, and never place a sixel whose bottom edge reaches the last row.
- **Sixel is temporal and destructive.** Writing any glyph into a covered cell irrecoverably annihilates the pixels there. Notcurses documents that changing one text cell "underneath" an image can force repainting 781 cells.
- **No id, no crop, no delete, no z-order.** Every visual change means re-emitting the whole DCS.

Measured sizes (400×300): photographic 50.8 KB @16 colours, 73.7 KB @64, 146.4 KB @256; flat UI art 4.8 KB at any palette size. Pure-JS encode: 12.2 ms @64, 20.0 ms @256; 640×480 is 29–46 ms. Sixel gzips ~45%, so `ssh -C` helps materially — kitty's base64 PNG does not.

### 4.5 Decoder options

| package | installed size | packages | native | notes |
|---|---|---|---|---|
| `sharp` | 29.7 MB | 4 (+25 platform optionalDeps) | **yes** | declares `engines.node >= 20.9` — **conflicts with this project's `>=18`** |
| `jimp` | 33.8 MB | 31 | no | pulls `zod` (5.1 MB) and `gifwrap` (7.1 MB); **no WebP** |
| `pngjs` | 708 KB | 1 | no | uses built-in `node:zlib`; **synchronous** `PNG.sync.read` |
| `jpeg-js` | 104 KB | 1 | no | **synchronous** `decode()`; baseline only |
| `webp-wasm` | 552 KB | 1 | no | zero deps; worked first try |
| `@jsquash/webp` | 1024 KB | 1 | no | **fails in Node** — Emscripten glue calls `fetch()` on a `file://` URL; needs a manual `WebAssembly.compile` workaround |
| `omggif` | 39 KB | 1 | no | GIF |
| `sixel` (jerch) | 1.17 MB | 1 | no | encoder is pure JS; CommonJS only |

Measured decode times on this hardware: pngjs 8.5 ms (400×225), jpeg-js 14.7 ms (200×133), webp-wasm 8.6 ms (550×368). A hand-rolled `node:zlib` PNG decode measured 27 ms on 1600×1000.

Recommended: **`pngjs` + `jpeg-js`** as declared dependencies (812 KB, 2 packages, zero native, both synchronous), `webp-wasm` optional. Keep the hidden-specifier lazy `sharp` import (`ascii/image.ts:50-53`) as an optional accelerator for exotic formats — but if it stays, **declare it**, because the comment at `image.ts:5` claiming it is "an optional peer dependency" is currently false.

Do **not** hand-roll a baseline JPEG decoder (Huffman + IDCT + YCbCr + chroma subsampling + restart markers) to save 104 KB. That is a permanent maintenance liability with no upstream.

---

## 5. Terminal support matrix

Legend: **full** / **partial** (conditional or buggy) / **none** / **unknown**.

| Terminal | kitty gfx | kitty U=1 | iTerm2 OSC 1337 | sixel | truecolor | half-block | quadrant | sextant/octant | braille |
|---|---|---|---|---|---|---|---|---|---|
| kitty | full | full | none | **none** (declined) | yes | yes | yes | self-drawn | font |
| Ghostty | full | full | none (parsed, "unimplemented") | **none** (declined) | yes | yes | yes | self-drawn | font |
| WezTerm | partial (buggy) | no | full (+`doNotMoveCursor`) | partial ("preliminary") | yes | yes | yes | self-drawn | font |
| iTerm2 | unverified | no | **full** (reference) | partial (≥3.3) | yes | yes | yes | font | font |
| Konsole ≥22.04 | partial (`t=d` only, no anim) | no | partial (aspect inverted) | partial (buggy) | yes | yes | yes | font | font |
| **Apple Terminal** | **none** | **none** | **none** | **none** | 256 cap (see note) | **yes** | **yes** | **no (tofu)** | fallback, misaligned |
| Alacritty | none | none | none | none | yes | yes | yes | font | font |
| GNOME Terminal / VTE family | none | none | none | none (build flag, off by default) | yes | yes | yes | font | font |
| xterm | none | none | none | partial (`-ti vt340` + registers) | ≥331 | yes | yes | no | font |
| foot | none | none | none | full | yes | yes | yes | self-drawn | font |
| Contour | partial | no | no | full (does not clear graphics) | yes | yes | yes | self-drawn | font |
| mintty | none | none | full (legacy form only) | full ≥2.6 | yes | yes | yes | font | font |
| mlterm | none | none | unverified | full ≥3.1.9 | approximated | yes | yes | font | font |
| Rio | full | no | full | partial ("initial") | yes | yes | yes | font | font |
| Warp | partial (drops during shell init) | partial | partial (drops during shell init) | none | yes | yes | yes | font | known gap |
| Windows Terminal ≥1.22 | none | none | none | **full** | yes | yes | yes | Cascadia | font |
| Windows conhost | none | none | none | none | yes (VT mode) | font | font | no | no |
| VS Code / xterm.js | none | none | partial (opt-in setting) | partial (opt-in setting) | yes | yes | yes | font | synthesised |
| PuTTY / MobaXterm | none | none | none | none | partial | yes | font | no | font |
| Linux VT console | none | none | none | none | 16 (or 8) | **yes** (CP437) | no | no | no |
| tmux | passthrough only | **yes** (text) | passthrough only | ≥3.4 if built `--enable-sixel` | outer | yes | yes | outer | outer |
| GNU screen | none | none | none | none (DCS length-capped, no inner ESC) | opt-in | yes | yes | no | no |
| mosh | **none** (structural) | none | none | none | yes | yes | yes | no | no |

### Notes on the two first-class targets

**Apple Terminal — verified exhaustively.**

- No graphics protocol of any kind. `strings -a` over the 2.4 MB `Terminal` binary: `grep -ci sixel` → **0**; zero hits for `DECSIXEL`, `1337`, `inline image`, `kitty`, `regis`, `decdld`, `softfont`. The negative is meaningful, not a stripped binary — the same scan returns `-[TTVT100Emulator initWithShell:...]` and `TTVT100Emulator.m`. `grep -ril sixel` over the whole `.app` bundle → nothing. arewesixelyet.com agrees.
- **Actual default font, not assumed.** Decoding the NSKeyedArchiver blob in `defaults export com.apple.Terminal`: Default Window Settings = `Basic`, whose font is `SFMono-Regular`, resolved to Terminal.app's own bundled `SFMono-Terminal.ttf`. fontTools cmap dump of that exact file: block elements **16/16**, shades **3/3**, quadrants **10/10**, braille **0/256**, sextants **0/60**, octants **0/230**. Menlo is identical.
- **CoreText fallback test** with `CTFontCreateForString` (the API AppKit actually uses), cellWidth(M) = 7.418: `U+2580/2584/258C/2590/2588/2591-2593/2596-259F` all in-font at adv **7.418** (exact cell match). `U+2800/2847/28FF` fall back to **AppleBraille at adv 8.203 — a 10.6% width mismatch**. `U+1FB00/1FB1E/1FB3B/1CD00` fall back to **`.LastResort` at adv 26.971 — tofu**.
- **Profiles are not uniform.** `Basic`/`Man Page`/`Ocean`/`Red Sands`/`Silver Aerogel`/`Solid Colors` use SF Mono. `Pro` uses **Monaco** (block elements **1/16** — only U+2588; quadrants **0/10**). `Grass`/`Novel` use **Courier** (0/16 blocks). `Homebrew` uses **Andale Mono** (4/16, 0 quadrants). CoreText fallback rescues these to Menlo, but the only mode that needs **zero** glyph coverage is `space + SGR-48 background`.
- **Undocumented gotcha:** the Basic profile carries `FontWidthSpacing = 1.004032258064516`. Terminal.app stretches the cell ~0.4% wider than the glyph advance — the classic source of hairline seams between adjacent foreground block glyphs. Background paint fills the whole cell rect and does not seam.
- **Colour. — RESOLVED, cap lifted.** `colors.ts` used to hard-cap Apple Terminal to 256. macOS 26 Tahoe's Terminal.app does support 24-bit colour (announced at WWDC 2025, confirmed empirically in `termstandard/colors` #69) but does **not** set `COLORTERM`, so the depth is now sniffed from the build number: `parseInt(TERM_PROGRAM_VERSION) >= 470` → truecolor, anything lower or unparseable → 256. Confirmed by hand on `CFBundleVersion = 470.2`: a 60-step ramp spanning the cube's 0→95 gap rendered perfectly smooth, where a 256-snapping build shows three hard bands. Apple Terminal now takes the `quadrant` + truecolour path, which is the same path as every other cell terminal.
- **Probing it is actively dangerous.** A credible primary report shows Terminal.app routing APC/SOS/PM like DCS straight to the screen, and for an unknown OSC consuming one byte and printing the rest (`printf "\x1b]something\x1b\\"` renders `omething`). Detection must be a **positive allowlist**, never a denylist.

**Sextants and octants — CORRECTED, harder than the survey said.** Scanning every font in `/System/Library/Fonts`, `/System/Library/Fonts/Supplemental`, `/Library/Fonts`, `~/Library/Fonts` and Terminal.app's bundle:

```
U+2580 half-block :  145 fonts
U+2596 quadrant   :  110 fonts
U+2800 braille    :    7 fonts (Apple Braille family, Apple Symbols, .LastResort)
U+1FB00 sextant   :    1 font  — .LastResort
U+1CD00 octant    :    1 font  — .LastResort
```

`.LastResort` is Apple's tofu placeholder. **No real sextant or octant glyph exists anywhere on this machine**, including the user's 34 installed `JetBrainsMonoNerdFont-*.ttf` faces. kitty, foot, Ghostty, WezTerm and Contour are documented to rasterize these glyphs internally and ignore the font — but that is unverified on this machine, and swatches [8] and [9] of the probe script are the only way to settle it. **Recommendation: do not build sextant or octant tiers.** They buy at most +0.66 dB over quadrants, only on terminals that already have a real pixel protocol.

### Tier assignment

| Tier | Technique | Selected when |
|---|---|---|
| **4** | Quadrant, 2×2, fg+bg | `colorMode ∈ {truecolor, 256}` and unicode — **the default** |
| **3** | Half-block, 1×2, fg+bg | Multiplexer detected; unrecognised SSH `termType`; Linux VT console; explicit `mode: "half"` |
| **2** | Solid — space + bg only | `unicode === false`; degenerate cells inside every higher tier |
| **1** | Shading ramp ` ·:░▒▓█`, fg colour | `colorMode === "16"`; untrusted font |
| **0** | ASCII ramp ` .:-=+*#%@`, no colour | `colorMode === "none"`; `NO_COLOR`; non-TTY; CI; emulator with colour off |
| **−1** | Alt-text box of exactly the reserved row count | decode failed, format unsupported, over budget, or not yet resolved |
| sideways | Braille, 2×4, one colour | **explicit opt-in only** — line art, plots, waveforms |
| deferred | kitty `U=1` → iTerm2 OSC 1337 → sixel | see §8 phase 4+ |

---

## 6. Capability detection

Not needed for the cell tiers (§7 resolves those from `colorMode` + `TERM`/`termType` alone). Documented here because it is a prerequisite for any protocol tier, and because two of the hazards are live bugs today.

### 6.1 The stdin-corruption hazard

`matchEscapeSequence` (`input.ts:181-214`) handles **only** `ESC [` (CSI) and `ESC O` (SS3) and returns `null` at `:213` for everything else. `drainBuffer` then emits a bare `escape` keypress and consumes **one byte** (`:105-107`), leaving the rest of the reply to be parsed as ordinary characters and dispatched as keystrokes.

So a kitty reply `\x1b_Gi=31;OK\x1b\\` arrives at the app as: `escape`, `_`, `G`, `i`, `=`, `3`, `1`, `;`, `O`, `K`, `escape`, `\`. In navigation mode **`q` quits the app**. This is a latent bug *today*, independent of any image work — any terminal that volunteers an unsolicited DCS/APC/OSC reply can type into a focused input or kill the session.

Well-formed but unknown CSI is already handled safely: `:194-198` returns `{ length, key: null }` and `drainBuffer`'s `if (match.key)` drops it. That is the pattern to extend.

Second hazard: `ESCAPE_TIMEOUT_MS = 50` (`input.ts:21`). A partial CSI is held, but the timer at `:126-131` fires `drainBuffer(true)`, which emits a bare `escape` and re-parses the remainder as literals. Over SSH a fragmented reply straddling 50 ms corrupts input even for the otherwise-safe CSI family.

Third hazard, Node-specific: `process.stdin` is an EventEmitter. Every `data` listener receives the **same** chunk. Attaching a temporary probe listener does **not** hide the reply from an already-attached key handler. There is no way to consume bytes away from other listeners.

**Therefore the probe must run before `this._input.start()`.** The only safe window is between `setupTerminal()` (`runtime.ts:233`) and `_input.start()` (`runtime.ts:246`) — note raw mode is enabled inside `_input.start()` (`input.ts:39`), so a local probe needs raw mode turned on early or a temporary direct stdin listener. `textual-image` documents the identical constraint for Textual; `ratatui-image` and `viuer` both probe at construction time.

### 6.2 The ladder

**Step 0 — hard denylist, no probe bytes at all.**

- `TERM_PROGRAM === "Apple_Terminal"` — provably incapable, and echoes unknown OSC bodies to the screen.
- `STY` set, or `TERM`/`termType` starting `screen`/`tmux` — a multiplexer we cannot interrogate over SSH.
- `TERM` unset or `dumb`; `CI` set; `!stdout.isTTY || !stdin.isTTY` in dev; no pty-req in serve.
- `TERMINALTUI_IMAGE=off|cells`.

**Step 1 — one batched write, DA1 as sentinel.**

```js
const PROBE =
  "\x1b_Gi=31,s=1,v=1,a=q,t=d,f=24;AAAA\x1b\\" +  // kitty query (AAAA = one 1x1 RGB px)
  "\x1b[>0q" +                                     // XTVERSION  -> DCS >|<name> ST
  "\x1b[16t" +                                     // cell px    -> CSI 6;<h>;<w> t
  "\x1b[14t" + "\x1b[18t" +                        // fallbacks for cell px
  "\x1b[?1;1;0S" +                                 // sixel colour registers
  "\x1b[c";                                        // DA1 -- SENTINEL, MUST BE LAST
```

The **sentinel is the deadline, not a timer**. Terminals silently drop queries they do not implement, so a naive read-until-response deadlocks. DA1 is answered by essentially every VT-compatible terminal, so its arrival proves every earlier query has answered or been ignored. kitty's spec *requires* conforming terminals to answer `a=q` before processing later input, which is what makes "DA1 answered, graphics query did not" a definitive negative.

`\x1b[5n` → `\x1b[0n` (DSR) is the cleaner sentinel when you are *also* parsing DA1 for sixel, because `\x1b[0n` is an unambiguous fixed string while DA1's terminator is a bare `c` that can appear inside an earlier payload.

Still keep a **hard wall-clock backstop** — some terminals answer nothing at all. Real budgets in the wild: ratatui-image 2000 ms restarted on every byte, timg 250 ms for graphics / 50 ms for cell dims, terminal-query 100 ms, Yazi 1000 ms with a stderr warning at 400 ms. Recommend **250 ms local / 1200 ms SSH**.

**Step 2 — parse.**

```js
kitty  <- /\x1b_Gi=31;OK/.test(reply)
sixel  <- da1Params.includes("4")     // EXACT member test on the ';'-split list.
                                      // Never substring — "14"/"24"/"64" must not match.
cellPx <- /\x1b\[6;(\d+);(\d+)t/      // NOTE: HEIGHT first, then WIDTH
name   <- /\x1bP>\|([^\x1b]*)\x1b\\/  // XTVERSION; survives SSH, unlike TERM_PROGRAM
```

Record **`evidence: "probed" | "env" | "assumed"`**. A negative protocol verdict is only meaningful when the sentinel actually returned. Without this the failure is silent and shows up as "images look worse than they should" on exactly the terminals that support them best. Make it a unit-tested invariant, not a convention — this was a real false-negative bug in the probe script during this investigation.

**Step 3 — cell pixel size, best source first.**

1. `serve` only: pty-req `info.width` / `info.height`, rejecting zeros and Win32-OpenSSH's fake 640×480.
2. `\x1b[16t` reply.
3. `\x1b[14t` px ÷ `\x1b[18t` chars.
4. Fallback `CELL_ASPECT = 0.5` (roughly 10×20 px).

**Step 4 — env is a tiebreak, never authoritative.** `TERM_PROGRAM`, `KITTY_WINDOW_ID` and `ITERM_SESSION_ID` go **stale under tmux and screen** (inherited from whichever terminal first started the server). Over SSH the only real signals are `termType` from pty-req and `LC_TERMINAL` (which iTerm2 sets and OpenSSH forwards via the default `SendEnv LANG LC_*`). And `termType` under-detects exactly the best terminals: iTerm2, WezTerm and Ghostty commonly forward `TERM=xterm-256color`.

**Step 5 — the safety fix, ship it regardless of images.** Add string-sequence arms to `matchEscapeSequence`: OSC (`ESC ]` … BEL|ST), DCS (`ESC P` … ST), APC (`ESC _` … ST), PM (`ESC ^`), SOS (`ESC X`), each returning `{ length, key: null }`. Add a `pendingQuery` tap at `:197` so a probe can claim a reply. Add a `partial` return so a fragmented reply is held rather than flushed by the 50 ms timer.

**Multiplexer wrapping** (for later, when protocols land):

```js
const wrapTmux = s => "\x1bPtmux;" + s.replace(/\x1b/g, "\x1b\x1b") + "\x1b\\";
// Requires `set -g allow-passthrough on` (tmux >=3.3; `all` >=3.4 for invisible panes).
// DEFAULT IS OFF and there is no in-band way to detect it.
// GNU screen: DCS cannot carry an inner ESC at all, and is length-capped (256/512/768 B).
// mosh: structurally impossible — it drops sequences it does not model.
```

---

## 7. Recommended architecture

### 7.1 Shape

**Cell tier first, complete, with zero write-path changes.** Protocols are an opportunistic later addition behind a design that is banked but not built.

The four independent judgements converged on this despite different starting positions: the cell tier is the only path that reaches 100% of the weighted targets, is the only tier that is assertable in the test emulator, is the only tier available on Apple Terminal, and requires touching none of `runtime-terminal.ts`, `base.ts`, `input.ts`, `vterm.ts`, `Panel.ts` or `block-taxonomy.ts` — the six files where all the pinned-test risk lives.

### 7.2 New and changed files

**New — `src/image/`**

| File | Contents |
|---|---|
| `probe.ts` | Synchronous header-only dimension parse (PNG IHDR, JPEG SOF, GIF LSD, BMP DIB, WebP VP8X), memoised by `(absPath, mtimeMs, size)` with a 1000 ms `statSync` throttle |
| `geometry.ts` | `CELL_ASPECT = 0.5`; `imageCellSize(block, availWidth)` — the single sizing authority, called by both the renderer and `flex-engine.ts:315` |
| `decode.ts` | `decodeImage(source): RgbaImage` — **synchronous**. `pngjs` `PNG.sync.read`, `jpeg-js` `decode`, optional `webp-wasm`, optional hidden-specifier `sharp`. Byte and pixel budgets enforced **before** decode (decompression-bomb guard) |
| `resample.ts` | Box-filter area-average straight to the sub-cell grid, alpha composited over the resolved background in linear space |
| `perceptual.ts` | sRGB → DIN99d port, memoised in a bounded `Map<packedRGB, [L,a,b]>` |
| `quantize.ts` | Corrected xterm-256 table + midpoint LUT, always-evaluated grey candidate, DIN99d 16-colour nearest, indices 0–15 excluded |
| `glyphs.ts` | `SOLID` / `HALF` / `QUADRANT` / `BRAILLE` / `SHADING` / `ASCII` symbol sets with precomputed 8×8 coverage bitmaps |
| `cellfit.ts` | Per-cell partition search (exhaustive-16 for quadrants), `fg = mean(covered)`, `bg = mean(uncovered)`, `useQuantizedError` in indexed modes |
| `dither.ts` | Ordered Bayer 16×16 (default), Floyd-Steinberg (opt-in), both over the full RGB triple |
| `tier.ts` | Pure `(colorMode, unicode, terminalName/termType, isMultiplexed, explicit) → Tier` |
| `cache.ts` | L1 pixel LRU (byte-budgeted, **no `colorMode` in key**), L2 serial LRU, module-scope `inflight`, `clearImageCache()` for tests |
| `source.ts` | `resolveAsset(projectDir, path)` with traversal guard, symlink-escape refusal, non-regular-file refusal; `data:` URIs; `art:<name>`; remote via `fetch().arrayBuffer()` into `globalCache` |

**Changed**

| File | Change | Why |
|---|---|---|
| `src/style/colors.ts` | Add `bgColorRgb(r,g,b)` mirroring `fgColorRgb:143-152`; add `cellColorRgb(fg,bg)` emitting one combined SGR; fix `rgbTo256:84-96`; export `rgbTo16` | `bgColor:154` is hex-only and re-parses on every call, and is invoked by **zero** components — per-pixel backgrounds are currently inexpressible. The quantizer fix improves every 256-mode component, not just images |
| `src/components/Image.ts` | Full rewrite. `renderImage(rt, block, ctx): string[]` — sync cache lookup, exactly `imageCellSize().rows` lines in **all four states**, label truncated | Currently a placeholder box that overflows its own allocation and ignores its own `mode` parameter |
| `src/layout/flex-engine.ts:315` | `case "image": return imageCellSize(block, width).rows;` | Hardcoded `10` vs 15 actually emitted; offsets every sibling `FocusRect` |
| `src/core/runtime-block-render.ts:203-204` | `case "image": return renderImage(rt, resolveAsset(rt.projectDir, block.src), ctx, block);` | Needs `rt` for the loader and the project root; every other rt-aware case already has this shape |
| `src/core/runtime-internal.ts` | Add `projectDir: string` and `imagePending: Set<string>` | Per-terminal state stays on the runtime per `:41-47`; decoded pixels go to module scope |
| `src/core/runtime.ts` | Populate `projectDir` in `runFileBasedSite:548-574`; resolve the image tier beside the colour-mode decision at `:200-211` | Mirrors `detectRemoteColorMode:156-173`, the existing per-client inference. Never use `detectTerminal()` for SSH — it reads the **server's** env |
| `src/cli/serve.ts:86-107` | Set `projectDir` (already computed at `:21-22`); forward a `serve` field | Must move in lockstep with `runtime.ts` or images resolve against the wrong root over SSH |
| `src/router/types.ts` | Add `serve?: ServeConfig` to `FileBasedConfig` | **Verified missing.** `site.serve?.colorMode` is always undefined under `terminaltui serve` today. Fix before adding any `serve.images` knob |
| `src/config/types.ts` / `parser.ts` | Widen `ImageBlock` and `image()`; add `projectDir?` to `SiteConfig` | Current 3-field type cannot express colour, dithering, height, alt, alignment, or the `shading` mode |
| `src/ascii/image*.ts` | Keep `asciiImage()` as a public wrapper delegating to `src/image/`; fix the double-applied aspect and the dither/quantizer mismatch; delete dead `BRAILLE_OFFSET`/`BRAILLE_MAP`/`sampleColor` | Exported at `index.ts:148` and must keep working, but should not be a second, worse implementation |
| `src/emulator/assertions.ts` | Additive `imageAt(row, col, {rows, cols})` — asserts the region contains only expected-set glyphs and that a majority of cells carry a non-null bg | The one genuinely new test capability cells unlock; no pixel protocol can offer it |

**Explicitly unchanged:** `runtime-terminal.ts`, `base.ts`, `input.ts` (except the standalone safety PR), `emulator/vterm.ts` (except the standalone hardening PR), `Panel.ts`, `Columns.ts`, `block-taxonomy.ts`, `box-model.ts`.

On `box-model.ts:84` (`image: { border: true }`): leave it alone. Expose an opt-in `frame: true` instead. Flipping it to `false` would force an edit to the pinned assertion at `test/box-model.test.ts:197` (`image: 78`), and there is no reason for an image feature to touch that table.

### 7.3 API

```ts
export type ImageSource = string | Buffer | URL;
//   string  — path relative to the PROJECT root (not cwd), an absolute path,
//             an http(s) URL, or a data: URI
//   Buffer  — raw encoded bytes
//   URL     — explicitly typed remote source

export type ImageMode =
  | "auto"                                  // negotiate the ladder (default)
  | "quadrant" | "half" | "solid"           // cell tiers
  | "shading" | "ascii" | "braille";        // text tiers

export interface ImageOptions {
  /** Width in terminal CELLS. Default: fill the available content width. */
  width?: number;
  /** Height in terminal CELLS. Aspect preserved unless fit:"fill". */
  height?: number;
  /** Cap on derived rows. Default: viewportHeight - 2. */
  maxHeight?: number;
  /** Default "contain". */
  fit?: "contain" | "cover" | "fill";
  /** Default "center". */
  align?: "left" | "center" | "right";
  /** Force a tier. Default "auto". Pin this in demos and snapshot tests. */
  mode?: ImageMode;
  /** "auto" = ordered Bayer in 256/16, none in truecolor.
   *  "floyd-steinberg" is higher quality but defeats the row diff. */
  dither?: "auto" | "ordered" | "floyd-steinberg" | "none";
  /** Shown while decoding, on failure, and when the format is unsupported. */
  alt?: string;
  /** Hex composited under alpha. Default theme.background. */
  background?: string;
  invert?: boolean;
  /** Ramp for mode:"ascii". Default " .:-=+*#%@". */
  charset?: string;
  /** Draw a themed border. Default false. */
  frame?: boolean;
}

/**
 * Render an image. Uses the highest-fidelity cell technique the viewer's
 * terminal supports. Decoding is synchronous and cached; the block's row
 * count is fixed from the image header on the first frame, so layout never
 * shifts when pixels arrive.
 */
export function image(source: ImageSource, options?: ImageOptions): ImageBlock;

/** Exported so authors and the layout engine agree on geometry. */
export function imageCellSize(
  block: ImageBlock, availWidth: number,
): { cols: number; rows: number };
```

```ts
// demos/band/pages/discography.ts
import { image, card, columns, panel, section, text } from "terminaltui";

export default function Discography() {
  return {
    title: "Discography",
    content: [
      section("Latest", [
        columns([
          panel({ width: 30 }, [
            // 28 cells wide inside the panel; height derived from the real
            // PNG aspect ratio, clamped to 14 rows. Reserved on frame 1,
            // before a single pixel is decoded.
            image("./covers/nocturne.png", {
              width: 28, maxHeight: 14, alt: "Nocturne — 2026",
            }),
          ]),
          panel({}, [
            card({ title: "Nocturne", subtitle: "2026 · LP",
                   body: "Recorded live to tape at Studio B over four nights." }),
            text("Eleven tracks. No overdubs."),
          ]),
        ]),
      ]),

      // Line art: braille is right here and wrong for photographs.
      image("./charts/streams.png", { mode: "braille", width: 60 }),

      // Pin the tier so a demo snapshot is byte-stable across terminals.
      image("./art/logo.png", { width: 40, mode: "half", align: "center" }),
    ],
  };
}
```

### 7.4 Fallback ladder with triggers

| Tier | Trigger | Emits |
|---|---|---|
| **Quadrant** (default) | `colorMode ∈ {truecolor, 256}` and `caps.unicode` and not multiplexed | `\x1b[38;2;…;48;2;…m` + `U+2596-259F` |
| **Half-block** | multiplexer detected (`TMUX`/`STY`, or `termType` starts `screen`/`tmux`); unrecognised SSH `termType`; `TERM === "linux"`; `mode: "half"` | same SGR + `U+2580` |
| **Solid** | `caps.unicode === false`; also used per-cell inside every higher tier when top == bottom | `\x1b[48;2;…m ` |
| **Shading** | `colorMode === "16"`; untrusted font; `mode: "shading"` | fg SGR + ` ·:░▒▓█` |
| **ASCII** | `colorMode === "none"`; `NO_COLOR`; non-TTY; `TERM` unset/`dumb`; `mode: "ascii"` | ` .:-=+*#%@` |
| **Alt-text box** | decode failed / unsupported format / over budget / not yet resolved | bordered box of exactly the reserved row count carrying `alt`, truncated |
| **Braille** | `mode: "braille"` **only** — never auto | `U+2800 + mask`, one fg colour |

Every row **must** end with `reset`. Once a row emits a background colour, an unterminated row leaks it into the focus gutter, the `padStr` centring pad and visually into the next row. `truncateLine` appends a reset but only on the truncation path — rows that fit are emitted verbatim. Pin this with a test.

Do not reorder the `\x1b[0m` before `\x1b[2K` at `runtime-terminal.ts:120`. Under background-colour-erase, that reset is what makes EL clear with the *default* background instead of smearing the image row's colour across the whole terminal row.

### 7.5 What is banked but not built

For when protocols eventually land, three design decisions are settled and should be recorded rather than rediscovered:

1. **kitty Unicode placeholders are the only pixel path worth building first**, because they need zero write-path change. Prerequisite: the `charWidth` diacritic fix, plus emitting the image-id foreground colour with a literal `\x1b[38;2;r;g;bm` that bypasses `fgColorRgb`'s 256-quantization.
2. **The SGR-shaped sentinel.** `\x1b[70000;<opId>;<bandRow>m` is already zero-width to `stripAnsi`'s existing regex and already atomic to `cutToWidth`'s existing exit-on-`m` scanner. It survives truncation whole or is dropped whole (a dropped sentinel is exactly the signal that the anchor scrolled off screen), and SGR 70000 is unassigned so a leak is a silent no-op. This means a pixel tier can be added later **without ever touching the memoized width hot path**.
3. **The epilogue-ordering rule.** Cell-destructive protocol payloads (sixel, iTerm2) must be emitted **after** the entire row loop, inside the same single `writeOutput`. Within a frame, nothing can erase an image that is painted last. Pair with a damage set (re-emit only when a payload's band intersects the changed rows) so a static image costs zero bytes per frame.

---

## 8. Phased plan

Ordered by value per unit of risk. Each phase is independently shippable and independently revertable.

### Phase 0 — Standalone safety fixes (0.5 day, ship regardless of images)

Three separate PRs, none of which depends on the image work.

| PR | Change | Blast radius | Test |
|---|---|---|---|
| 0a | `input.ts` string-sequence arms: OSC/DCS/APC/PM/SOS → `{length, key: null}`; `partial` return for fragmented replies | Input parser only; extends the existing unknown-CSI drop at `:194-198` | New key-parser unit tests feeding synthetic replies; assert zero keypresses emitted |
| 0b | `vterm.ts` DCS/APC/PM/SOS consume-to-ST state (~12 lines replacing the catch-all `else` at `:220-222`); record payloads into a `graphics[]` sink | Emulator only; **zero production behaviour change** | Feed the exact kitty/sixel byte sequences that currently corrupt the grid; assert `text()` is unchanged and `graphics.length === 1` |
| 0c | `ssh-server.ts`: capture `info.width`/`info.height` from pty-req and window-change (with zero and Win32 guards); honour `channel.write()`'s backpressure boolean with a `pendingBytes` counter and `drain` listener | SSH path only | Mock pty-req with pixel dims; assert `pixelWidth`/`pixelHeight` surface and that zeros are rejected |

**Unlocks:** any future capability probe, any future protocol tier, and it closes a live bug where an unsolicited terminal reply can quit the app.

### Phase 1 — Colour foundation (0.5–1 day)

**Ships:** `bgColorRgb`, `cellColorRgb`, the `rgbTo256` fix (midpoint LUT + always-evaluated grey candidate + correct ramp formula), exported `rgbTo16`, DIN99d module. Plus the `renderBlocks` fg+bg rewrite in `src/ascii/image-renderers.ts` with SGR run elision and one trailing reset per row.

**Unlocks:** the highest-fidelity delta available anywhere in this plan (+3.17 dB), and it improves 256-colour output for **every** component in the framework, not just images.

**Blast radius:** `rgbTo256` changes 256-mode output framework-wide. Verified test-safe against the four assertions in `test/test-apple-terminal-colors.ts:70-75` — `(0,0,0)→16`, `(255,255,255)→231`, `(128,128,128)` in `[232,255]`, `(255,0,0)→196` all still hold. Demo snapshot suites must be re-run. **Land the quantizer fix as its own PR** so it can revert independently.

**Test:** unit tests asserting `stringWidth` of a fg+bg row equals the cell count; a `VirtualTerminal` round-trip asserting `cellAt` reports independent fg and bg; an RMSE regression over a fixed sample set.

### Phase 2 — Decoder and resampler (1–1.5 days)

**Ships:** `src/image/decode.ts` (pngjs + jpeg-js declared, webp-wasm optional, sharp optional accelerator), `resample.ts`, budget guards. Rewires `src/ascii/image.ts` to it. Fixes the double-applied aspect and the dither/quantizer mismatch. Deletes the dead code at `image.ts:23-32` and `:178-201`.

**Unlocks:** `asciiImage()` — a public export since forever — works for the first time in the project's history.

**Blast radius:** two new runtime dependencies (812 KB, 2 packages, no native code). This is a deliberate change to the "one required dependency" pitch and should be stated as such. Note `esbuild` is itself a platform-specific native binary, so that pitch already means "one native binary".

**Test:** decode a real fixture PNG and JPEG; assert dimensions, a known pixel value, and that budget rejection produces the alt-text path.

### Phase 3 — Cell engine (2 days)

**Ships:** `glyphs.ts`, `cellfit.ts`, `quantize.ts`, `perceptual.ts`, `dither.ts`, `tier.ts`, `geometry.ts`, `probe.ts`. All pure functions, no runtime integration.

**Unlocks:** the actual picture quality. Quadrant default, exhaustive-16 partition, `useQuantizedError`, ordered Bayer, DIN99d 16-colour.

**Blast radius:** none — nothing is wired in yet.

**Test:** codepoint tables verified **exhaustively** against `UnicodeData.txt` glyph names at build time rather than trusted (all 16 quadrants, 64 sextants and 256 octants were verified this way during the investigation). PSNR regression on a fixed fixture at each tier.

### Phase 4 — Wiring (2 days, split into two PRs)

**4a — cache and loader.** `src/image/cache.ts` (L1 pixel LRU without `colorMode`, L2 serial LRU with it, module-scope `inflight`), `imagePending` on `RuntimeInternal`.

**4b — integration.** `projectDir` threaded through `runtime.ts:548-574` and `cli/serve.ts:86-107` in lockstep, `resolveAsset` with the traversal guard, `Image.ts` rewritten, `runtime-block-render.ts:203-204`, `flex-engine.ts:315`, widened `ImageBlock`/`image()`, `FileBasedConfig.serve` gap closed.

**Unlocks:** images actually appear. Everything before this exists to de-risk it.

**Blast radius:** `flex-engine.ts:315` shifts `FocusRect` Y coordinates on any page containing an image. No demo uses `image()` today, so current blast radius is nil — but the Phase 6 demo becomes the first real consumer.

**Test:** emulator-driven — a page with an image renders expected-set glyphs with expected colours at expected rows; the row count is byte-identical across loading/loaded/error/no-decoder; a second render emits **zero bytes**; `terminaltui demo band` exercises the cwd ≠ projectDir case since it runs the project from inside `node_modules`.

### Phase 5 — Scroll and backpressure hardening (1 day)

**Ships:** render coalescing (at most one `writeOutput` per animation-frame tick for image-bearing pages, dropping intermediate scroll states); the `TerminalIO.write` backpressure return threaded into a frame-skip; SGR run elision for 256-colour; a per-session byte budget that downgrades the tier when repeatedly blown.

**Unlocks:** this is the phase that makes images usable over SSH. Without it, a held ↓ key on an image page sustains 11–48 Mbit/s and grows Node's writable buffer without bound across up to 100 sessions.

**Blast radius:** touches `runtime.ts`'s render scheduling. Should be measured, not assumed — the numbers in §3.5.1 are the baseline to beat.

**Test:** drive `writeToTerminal` with a synthetic scroll sequence and assert emitted-byte ceilings.

### Phase 6 — Demo, docs, polish (1 day)

**Ships:** the flagship demo (`demos/band/discography` is the best content fit; `demos/welcome/showcase` is the highest-visibility since it is what `npx terminaltui try` runs). `docs/images.md` added to the `README.md:356-367` table and to `llms.txt`. Rewrite `docs/components.md:184-193`, which currently documents behaviour that has never existed. Fill the missing image section in `docs/ascii-art.md`, which `README.md:364` already advertises. Add the server-side-resolution caveat to `docs/serve.md`. Update `claude/SKILL.md:796-804` and `:2115-2133` — that is what agents generate code from.

Note `package.json` `files` ships demo directories wholesale, so `demos/band/covers/*.png` publishes automatically; `.npmignore` only excludes `demos/*/dist/`, `demos/*/node_modules/` and `**/.terminaltui/`. Avoid `demos/mac-monitor` — it is darwin-only, carries its own `node_modules`, and is published standalone.

### Phase 7+ — Protocols (optional, 3–4 weeks, only if asked for)

kitty Unicode placeholders first (needs the `charWidth` diacritic fix and the Phase 0 probe infrastructure, but **no** `writeToTerminal` change). Then, only if there is real demand, the sentinel + epilogue + damage-set machinery for iTerm2 and sixel — the lowest-reach, highest-risk, least-value-per-line work in the whole plan.

### Total

**Roughly 8–10 focused days to a complete, shipped, universal image feature.** The critical path to visible value is Phases 1 → 2 → 3 → 4.

---

## 9. Open questions and things that need a human

### 9.1 Run the probe script

`devnotes/term-probe.mjs`

Zero dependencies, Node 18+. Flags: `--timeout=MS` (default 400), `--grace=MS` (120), `--no-query`, `--no-visual`, `--tmux`, `--self-test`.

**Run it interactively — `node term-probe.mjs` — never piped.** Terminals only answer an interactive tty. When it ran non-TTY during this investigation it correctly skipped the query phase and printed *"evidence quality: heuristic only"*, and its kitty/sixel verdicts degraded to env guesses. That is exactly the false-negative class the `evidence` field exists to prevent.

**Terminals to run it in, in priority order:**

1. **Kitty** (the current shell) — settles whether swatches [8] sextants and [9] octants render as real glyphs or as tofu, which is the one place the font scan and the kitty changelog disagree. Also confirms cell pixel size via `CSI 16 t` and whether DECRQM 2026 (synchronized output) is supported.
2. **Apple Terminal, Basic profile** — confirms quadrants [7] align, half-blocks [5]/[6] look right, braille [10] is visibly misaligned, and swatch [2] (32-cell truecolor discrimination ramp) shows banding rather than a smooth gradient, proving the 256 cap. Also worth running on macOS 26 to see whether [2] is now smooth, which would justify lifting the cap. **Run on build 470.2: [2] is smooth. Cap lifted — see §Apple Terminal above.**
3. **Apple Terminal, Pro profile** (Monaco) — confirms the `solid` floor tier is actually needed.
4. **iTerm2** — swatches [13] vs [14] disambiguate ST-vs-BEL terminator support for OSC 1337.
5. **A `terminaltui serve` session from at least two different clients** — confirms whether real SSH clients populate pty-req pixel dimensions at all (OpenSSH sources them from `TIOCGWINSZ ws_xpixel/ws_ypixel`, which many emulators report as 0).

**What to look for:**

- Swatches [12] kitty / [13] iTerm2 ST / [14] iTerm2 BEL / [15] sixel each reserve 5 blank rows. A blank gap means unsupported. A wall of base64 garbage means the terminal ignored the escape and dumped the payload as text.
- Every swatch row ends with a `|` at a fixed column. **If a row's `|` is misaligned with the others, that row's glyphs are rendering at the wrong display width in your font.** This is the direct visual answer for sextants [8] and octants [9].
- Trust the `evidence quality` line in the summary. When it says "heuristic only", every kitty/sixel verdict is an env guess and should not be believed as a negative.

### 9.2 Decisions that need a call

| Question | Options | Recommendation |
|---|---|---|
| Declare `pngjs` + `jpeg-js`? | Real deps (812 KB, 2 pkgs) / hand-roll / stay broken | **Declare them.** `esbuild` is already a native binary, so the "one dependency" pitch already means "one native binary". Hand-rolling a baseline JPEG decoder to save 104 KB is the worst maintenance trade in the whole plan. |
| Lift the Apple Terminal 256 cap on macOS 26? | Gate on `TERM_PROGRAM_VERSION >= 470` / leave it | **Done, as its own change, after the 256 path was finished.** Swatch [2] came out smooth on build 470.2, so the gate landed. It ships with `TERMINALTUI_COLOR` as the escape hatch, since a version sniff is a guess and there was otherwise no way left to view the 256 path. The 256 path is excellent regardless, which was the precondition. |
| WebP support? | `webp-wasm` (552 KB, 0 deps, works) / `@jsquash/webp` (needs a `WebAssembly.compile` workaround) / none | `webp-wasm`, as an `optionalDependency`. |
| Should image assets survive `terminaltui build` + `npm publish`? | esbuild `loader: {".png": "dataurl"}` in both compile paths / runtime file reads + extend `init.ts:130`'s `files: ["dist"]` | **Runtime file reads.** Data-URI inlining bloats the minified bundle, and baking absolute paths trips the framework's own warning at `build.ts:262-268`. Verified: esbuild 0.27.4 currently errors with `No loader is configured for ".png" files` in both `page-loader.ts:83-92` and `build.ts:37-53`. |
| Revive `config.artDir` and the `images/` slot? | Yes (`art-registry/loader.ts:44-52` already documents it) / delete it | Nice-to-have. `artDir` is declared at `config/types.ts:24`, forwarded at `runtime.ts:561`, and read by **nothing**. Reviving it means calling `loadArtDirectory` in both `runFileBasedSite` and serve's per-session path, with a guard against the overwrite warnings at `art-registry/index.ts:110-113`. |
| Make images focusable? | Add to `FOCUSABLE_TYPES` / per-block `focusable?: boolean` / never | **Never in v1.** It shifts focus indices across every demo and is pinned by `test/focus-contract.test.ts`. Images are not actionable. The real bug — the height estimate — is fixed independently. |
| Ship protocols at all? | kitty placeholders only / full ladder / never | Bank the design; build only if users ask. On the two documented first-class targets, protocols reach exactly one of them. |

### 9.3 Unverified claims flagged during research

- **kitty's procedural rendering of sextants/octants.** Sourced from the changelog, not read from source, and directly contradicted by the machine-wide font scan (only `.LastResort` covers them). Swatches [8]/[9] settle it.
- **kitty's `rowcolumn-diacritics.txt` length.** Two independent fetches reported **261** and **297** data lines; the file header only guarantees "more than 255". Never hardcode a count — vendor the file at build time and derive max rows/cols from its actual length, refusing the placeholder tier for boxes larger than that.
- **iTerm2's kitty-protocol support.** `terminfo.dev` claims it in 3.6.9; no iTerm2 primary source confirms it. Prefer OSC 1337 there regardless.
- **`\x1b]1337;Capabilities\x1b\\`** (used by `terminal-query`) does not appear in iTerm2's official escape-code documentation. Do not build on it.
- **iTerm2's Feature Reporting table assigns code `F` to both `FILE` and `FOCUS_REPORTING`** — a genuine collision in the published spec. A bare `F` in `TERM_FEATURES` is ambiguous.
- **`terminfo.dev`'s support tables are unreliable** — they claim Apple Terminal supports both kitty graphics and sixel (it supports neither) and that WezTerm supports neither (it supports both). Do not build a static table from aggregator sites.
- **`arewesixelyet.com` is stale** — still lists Windows Terminal as unsupported (sixel shipped in Preview 1.22, Aug 2024), Xfce Terminal as supported (only with a custom VTE build), and Termux as unsupported (it now handles sixel and iTerm2). Ghostty is not listed at all.
- **Real SSH pty-req pixel dimensions.** OpenSSH sources them from `TIOCGWINSZ ws_xpixel/ws_ypixel`, which many terminal emulators report as 0. Needs measurement by logging `info.width`/`info.height` at `ssh-server.ts:224` against real clients before pixel-accurate sizing is viable on the serve path.
- **Actual negotiated `outgoing.window` / `packetSize` for real OpenSSH clients.** ssh2's own maxima are 2 MiB / 32 KiB, but the peer advertises the outgoing window.

---

## 10. Appendix: sources

### Protocol specifications

- https://sw.kovidgoyal.net/kitty/graphics-protocol/
- https://raw.githubusercontent.com/kovidgoyal/kitty/master/docs/graphics-protocol.rst
- https://raw.githubusercontent.com/kovidgoyal/kitty/master/gen/rowcolumn-diacritics.txt
- https://github.com/kovidgoyal/kitty/pull/5664 (Unicode placeholders)
- https://github.com/kovidgoyal/kitty/issues/2457, /issues/8701, /discussions/4021
- https://iterm2.com/documentation-images.html
- https://iterm2.com/documentation-escape-codes.html
- https://iterm2.com/feature-reporting/
- https://vt100.net/docs/vt3xx-gp/chapter14.html (sixel, DEC VT330/340 reference)
- https://shuford.invisible-island.net/all_about_sixels.txt
- https://invisible-island.net/xterm/ctlseqs/ctlseqs.html
- https://invisible-island.net/xterm/manpage/xterm.html
- https://datatracker.ietf.org/doc/html/rfc4254 (SSH pty-req pixel dims, §6.2/§6.7)
- https://vtdn.dev/docs/dcs/xtversion/ , https://vtdn.dev/docs/dcs/xtgettcap/
- https://terminalguide.namepad.de/seq/csi_sc/
- https://docs.otty.sh/vt/osc/osc-1337

### Terminal implementations (source read)

- https://raw.githubusercontent.com/gnachman/iTerm2/master/sources/VT100/VT100Terminal.m
- https://raw.githubusercontent.com/gnachman/iTerm2/master/sources/VT100/VT100XtermParser.m
- https://raw.githubusercontent.com/gnachman/iTerm2/master/sources/InlineImages/VT100InlineImageHelper.m
- https://raw.githubusercontent.com/gnachman/iTerm2/master/OtherResources/Utilities/imgcat
- https://raw.githubusercontent.com/gnachman/iTerm2-shell-integration/main/utilities/it2check
- https://raw.githubusercontent.com/KDE/konsole/master/src/Vt102Emulation.cpp
- https://invent.kde.org/utilities/konsole/-/merge_requests/594
- https://raw.githubusercontent.com/mintty/mintty/master/wiki/CtrlSeqs.md
- https://raw.githubusercontent.com/wezterm/wezterm/main/wezterm-escape-parser/src/osc.rs
- https://raw.githubusercontent.com/raphamorim/rio/main/rio-backend/src/ansi/iterm2_image_protocol.rs
- https://raw.githubusercontent.com/ghostty-org/ghostty/main/src/terminal/osc/parsers/iterm2.zig
- https://raw.githubusercontent.com/ghostty-org/ghostty/main/src/termio/stream_handler.zig
- https://raw.githubusercontent.com/kovidgoyal/kitty/master/kitty/vt-parser.c , /kitty/screen.c , /kitty/window.py , /kitty/notifications.py
- https://raw.githubusercontent.com/GNOME/vte/master/meson_options.txt
- https://codeberg.org/dnkl/foot/issues/474 , /issues/481
- https://github.com/ghostty-org/ghostty/discussions/2496 , /discussions/11105
- https://github.com/microsoft/terminal — issue #17309, #18192
- https://devblogs.microsoft.com/commandline/windows-terminal-preview-1-22-release/
- https://code.visualstudio.com/docs/terminal/advanced
- https://wezterm.org/imgcat.html , /escape-sequences.html
- https://github.com/warpdotdev/warp/issues/10020 , /issues/9696
- https://gitlab.com/gnachman/iterm2/-/issues/11738 , /issues/10420 , /issues/7825
- https://github.com/mintty/mintty/issues/1010 , /issues/1127
- https://github.com/wezterm/wezterm/issues/1663 , /issues/3266 , /issues/3817 , /issues/3882 , /issues/5892
- https://garrett.damore.org/2025/12/macos-terminal-still-missing-mark-apple.html
- https://github.com/fish-shell/fish-shell/wiki/Terminal.app-characteristics
- https://github.com/termstandard/colors , /issues/69

### Multiplexers

- https://raw.githubusercontent.com/tmux/tmux/master/tmux.1 , /CHANGES
- https://man.openbsd.org/tmux.1
- https://github.com/tmux/tmux/wiki/FAQ
- https://github.com/tmux/tmux/issues/4902
- https://tmuxai.dev/tmux-allow-passthrough/

### Reference implementations and algorithms

- https://hpjansson.org/chafa/ and the source tree: chafa-work-cell.c, chafa-symbol-renderer.c, chafa-symbols.c, chafa-symbols-block.h, chafa-color.c/.h, chafa-dither.c, chafa-palette.c, chafa-canvas-printer.c, chafa-canvas.c, chafa-symbol-map.c, chafa-util.c, chafa-term-info.c, chafa-term-db.c, chafa-term.c, tools/chafa/chafa.c
- https://raw.githubusercontent.com/hpjansson/chafa/master/COPYING (LGPL-3.0+ — algorithm may be reimplemented, code may not be vendored into an MIT project)
- https://raw.githubusercontent.com/dankamongmen/notcurses/master/TERMINALS.md
- https://nick-black.com/dankwiki/index.php/Theory_and_Practice_of_Sprixels
- https://raw.githubusercontent.com/ratatui/ratatui-image/master/src/picker.rs , /src/picker/cap_parser.rs , /README.md
- https://raw.githubusercontent.com/atanunq/viuer/master/src/printer/kitty.rs
- https://raw.githubusercontent.com/hzeller/timg/main/src/term-query.cc
- https://raw.githubusercontent.com/sxyazi/yazi/main/yazi-adapter/src/{adapter,drivers/drivers,drivers/kgp,drivers/kgp_old,drivers/iip,drivers/sixel}.rs
- https://raw.githubusercontent.com/sxyazi/yazi/main/yazi-emulator/src/{emulator,mux,brand}.rs
- https://raw.githubusercontent.com/ranger/ranger/master/ranger/ext/img_display.py
- https://github.com/ranger/ranger/pull/3086/files (tmux passthrough form)
- https://raw.githubusercontent.com/AnonymouX47/term-image/main/src/term_image/image/iterm2.py , /_ctlseqs.py
- https://github.com/lnqs/textual-image
- https://github.com/saitoha/libsixel , https://raw.githubusercontent.com/libsixel/libsixel/master/md/Supported%20terminals.md
- https://raw.githubusercontent.com/libsixel/libsixel/master/src/tosixel.c
- https://github.com/hackerb9/vt340test/blob/main/README.md (DECSDM polarity on real hardware)
- https://jexer.sourceforge.io/sixel.html
- https://raw.githubusercontent.com/stefanhaustein/TerminalImageViewer/master/README.md
- http://paulbourke.net/dataformats/asciiart/

### npm ecosystem

- https://raw.githubusercontent.com/sindresorhus/supports-terminal-graphics/main/index.js , /readme.md
- https://raw.githubusercontent.com/sindresorhus/terminal-query/main/index.js
- https://raw.githubusercontent.com/sindresorhus/terminal-image/main/index.js
- https://raw.githubusercontent.com/sindresorhus/ansi-escapes/main/base.js
- https://raw.githubusercontent.com/jerch/node-sixel/master/README.md , https://registry.npmjs.org/sixel
- https://raw.githubusercontent.com/jerch/xterm-addon-image/master/README.md
- https://registry.npmjs.org/{sharp,jimp,pngjs,jpeg-js,upng-js,fast-png,image-decode,omggif,webp-wasm,@jsquash/webp,@jsquash/png,image-q,image-size,ink,ink-image,blessed,neo-blessed,ansi-escapes}
- https://raw.githubusercontent.com/jonschlinkert/detect-terminal/main/src/env.ts , /normalize.ts

### Unicode and fonts

- https://www.unicode.org/Public/UCD/latest/ucd/UnicodeData.txt
- https://www.unicode.org/Public/UCD/latest/ucd/EastAsianWidth.txt
- https://www.unicode.org/charts/PDF/U2800.pdf
- https://www.unicode.org/charts/PDF/Unicode-16.0/U160-1CC00.pdf
- https://en.wikipedia.org/wiki/Symbols_for_Legacy_Computing_Supplement
- https://github.com/microsoft/cascadia-code/issues/607
- https://wiki.archlinux.org/title/Linux_console

### Support tables (used with caution — see §9.3)

- https://www.arewesixelyet.com/ (stale on Windows Terminal, Termux, Xfce)
- https://terminfo.dev/extensions/kitty-graphics-protocol , /extensions/sixel-graphics (**demonstrably wrong on several rows — do not use**)
- https://terminaltrove.com/compare/terminals/
- https://formulae.brew.sh/cask/{iterm2,ghostty,kitty,warp,alacritty,wezterm} (install telemetry, macOS only)
- https://yazi-rs.github.io/docs/image-preview/
- https://github.com/o2sh/onefetch/wiki/Images-in-the-terminal
- https://dgl.cx/2023/09/ansi-terminal-security
- https://www.gabriel.urdhr.fr/2023/08/29/simple-iterm2-image/

---

*Investigation artifacts (probe script, measurement harnesses, verification scripts) live in the session scratchpad at `/private/tmp/claude-501/-Users-omar-Desktop-Projects-TUI/74a67d9d-1852-4d4c-88cf-79f07a3ce455/scratchpad/`.*
