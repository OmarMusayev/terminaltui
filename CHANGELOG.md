# Changelog

## [2.3.0] - 2026-07-27

Video. `video("trailer.mp4")` plays a moving picture in the terminal, through the same cell engine that draws stills — and with no video decoder at runtime. The expensive half of the problem is moved to build time: a source is packed once into a `.tvf` frame pack of small, already-scaled JPEGs, and playback is a 0.6 ms decode into the existing resample → glyph-fit → ANSI path. ffmpeg is needed to *pack* an mp4 and never to play one; a `.gif` needs nothing at all, because the GIF decoder is now pure TypeScript and ships in the box.

### Added

- **`video(path, options)` and the `video` block.** Takes a `.tvf` pack, a `.gif`, or anything ffmpeg can read. A raw source is packed on first use into `.terminaltui/video/<hash>.tvf` and reused from there. Options mirror `image()` — `width`, `height`, `maxHeight`, `fit`, `align`, `mode`, `dither`, `background`, `invert`, `charset`, `border`, `fitPage` — plus `fps`, `loop`, `autoplay`, `poster` and `controls`.

  **`autoplay` defaults to false**, and the default is load-bearing rather than timid: a page that starts moving the moment it is opened can never be screenshotted, and never lets a test harness decide the screen has settled. `controls: true` buys a transport row and a focus slot (Space plays and pauses, ←/→ scrub), opt-in for the same reason `image.resizable` is — focusability is otherwise decided by block type, so making every video focusable would shift every focus index below one.

- **The `.tvf` frame pack, and `terminaltui video pack | info`.** Magic, a JSON header, and a run of independently-decodable JPEGs at 400 px, 12 fps by default. The header carries the frame offsets, so a frame is a zero-copy `subarray`; it also carries an optional per-frame delay table, because real GIFs are routinely variable-rate and flattening a held title card into a mean rate is the difference between a loop that reads as deliberate and one that reads as broken. `decodePack` **validates the offsets rather than trusting them** and never throws — it is called from inside a synchronous render pass, where a throw kills the frame.

- **A pure-TypeScript animated GIF decoder** (`src/image/gif.ts`): LZW with mid-stream clears and the self-referential KwKwK case, interlacing, transparency, all four disposal methods, and the NETSCAPE loop extension. Verified frame-by-frame against ffmpeg's own output rather than against itself. `image("x.gif")` also renders now — it previously reported `no-decoder` and fell back to alt text.

- **A synchronous MP4 dimension probe** (`src/video/mp4-probe.ts`). Walks the ISO-BMFF box tree with positioned reads, skipping `mdat` by its size, so a 4.4 MB file costs a few kilobytes to size. It exists because a block's row count must be fixed **before any pixel is decoded** — and `moov` sits at the tail of most real files, so a prefix read finds nothing.

- **`TERMINALTUI_VIDEO=off`** freezes every video on its poster, absolutely: not just autoplay, but `play()` and the transport too, because a guarantee a keypress can revoke is not one. The bundled PTY emulator sets it for every app it launches, so a demo containing a video cannot hang a suite's `waitForIdle`.

- **Synchronized output (DEC 2026) while a video is playing.** Rows are emitted one cursor-position at a time, so a terminal may repaint between any two of them; on a picture where every row changes every frame that is a visible horizontal tear. The batch is now bracketed with BSU/ESU — but only while something is actually moving, so output with no video playing is byte-identical to before and every existing byte-budget assertion still holds.

- **The `cinema` demo.** `npx tsx src/cli/index.ts dev demos/cinema/config.ts`.

### Fixed

- **A derived block lost its state key.** `getBlockKey` is a `WeakMap` keyed on object identity, and the page-fit transform returns `{...block, maxHeight}` — a new object — so the renderer addressed one key while everything holding the original block (the focus items, and therefore every input handler) addressed another. It cost a `fitPage` video its entire transport: the player was registered under one key and looked up under the other, so Space did nothing. Now carried across by `inheritBlockKey`.

- **Real pixels on kitty and Ghostty.** A playing video transmits one image per frame at the pack's native size, placed with the same Unicode placeholder cells the still path uses; every other terminal draws coloured cells. Both paths emit exactly the same number of rows, so a terminal that gains or loses pixel support never reflows the page, and a pinned `mode` never transmits (so snapshots stay byte-stable).

  This nearly did not ship. Video was first built cells-only, on a measurement that pixels cost 37–44 MiB/s — but that number came from the *still-image* path, which resamples a source UP to `cols*10 x rows*20` before transmitting: 2000x1120 and 11.4 MB a frame for a 200-cell block. A video frame needs none of it, because kitty's `s`/`v` are independent of `c`/`r`. Sending the pack frame at its native size is 1.6 MB, 18.8 MiB/s at 12 fps. Still ~30x the cell path, so `mode: "quadrant"` and `TERMINALTUI_GRAPHICS=off` are documented escapes for SSH and slow links.

### Notes

- The frame budget at 24 fps is 41.6 ms; the pipeline spends about 2.1 ms of it. CPU is not the limit — the wire is, which is why the pack default is 12 fps rather than 24.
- The default pack width is a **ceiling** (960 px) and never enlarges a source. It is not 400 px, which was the original value and was wrong: it was derived from the 99-column content cap, and `fitPage` deliberately lifts that cap, so a full-screen block sampled a 400 px pack at 1:1 and rendered its JPEG blocks as 4x4 blocks of cells.

## [2.2.0] - 2026-07-25

Real pixels. On kitty and Ghostty, `image()` now transmits the decoded image to the terminal and draws it with Unicode placeholder cells — actual pixels, not block glyphs — while every other terminal keeps the cell renderer. Which path a terminal gets is negotiated automatically, including over SSH, and no probe byte is ever written to a terminal that could be damaged by one. Images can also be resized by the viewer at runtime, and a bigger frame is a fresh resample rather than a magnification, so it carries genuinely more detail. Separately, the 256-color path no longer blotches: the grey-ramp-versus-color-cube decision is taken away from RGB distance in the band where RGB distance oscillates at pixel frequency. And Apple Terminal is no longer capped at 256 colors on macOS 26, which does more for image quality there than any amount of quantizer work could.

### Added

- **The kitty graphics tier.** On kitty and Ghostty an image is transmitted once (`a=T,U=1,t=d`, chunked, `q=2` so nothing lands in stdin) and placed with one `U+10EEEE` cell per image cell, each carrying zero-width row and column diacritics, with the image id in the row's foreground color. The **Unicode-placeholder** variant specifically, because a placement row is measured, clipped, scrolled and diffed exactly like any other row: `stringWidth()` reports it as `cols` columns, `cutToWidth` clips it into a still-valid partial image, `Panel` scrolls it, and an unchanged image writes zero bytes per frame. The classic cursor-anchored placement cannot be used at all here — the framework never emits `\x1b[2J`, so such a placement would outlive the page that drew it.

  Payloads go out after the frame through the unfiltered output pipe, never through the row composer (which would shred base64 at the first `m`). The runtime transmits an image exactly once per (source, size, terminal), deletes it when its id stops being placed — navigation, a resize that re-keys it, teardown — and deletes-then-re-transmits after an out-of-band repaint, because transmitting onto a live id is unspecified across terminals. Source buffers are sampled at 10×20 px per cell, capped at 1.2 M pixels. Every failure (no runtime, a footprint past kitty's 297-entry diacritic table, an undecodable source) **demotes to the cell ladder**; nothing throws and no block ever changes height.

- **Automatic graphics detection.** A hard denylist that writes nothing (Apple Terminal, tmux/screen, `TERM` unset or `dumb`, CI, non-TTY stdio), then a positive env allowlist (kitty and Ghostty get pixels; WezTerm and Konsole are decisively refused — neither has the placeholder variant), then, for a local interactive TTY that names no terminal we recognize, one active probe: kitty graphics query + `XTVERSION` + primary DA as a sentinel, hard 300 ms deadline, run after terminal setup and before input starts. `XTVERSION` is part of it because a positive graphics answer does not imply placeholder support. Over SSH the client's pty-req `TERM` is the only evidence consulted and no probe is ever sent.

- **`TERMINALTUI_GRAPHICS`.** `off`/`none`/`0`/`false` is absolute — no pixels, no probe bytes, checked before everything else. `kitty`/`on`/`1`/`true` forces pixels on, overriding detection and the denylist, for a terminal we mis-detect. Anything else, including a typo, falls through to normal negotiation. The bundled PTY emulator now sets `off` for every app it launches, so a suite's cell assertions do not depend on whether the contributor runs kitty.

- **`TERMINALTUI_COLOR`.** Overrides detected color depth framework-wide: `truecolor`/`24bit`, `256`, `16` or `none`. Unrecognized values are ignored rather than obeyed, and `NO_COLOR` still outranks it. It exists because the Apple Terminal branch below is a *version sniff* — a guess, and a guess needs a way out — and because it is otherwise impossible to preview the 256-color render on a terminal that reports truecolor. Documented in [docs/themes.md](docs/themes.md#color-depth).

- **Resizable image frames.** `image(path, { resizable: true })` makes the block focusable and lets the viewer grow it with `+`/`=`, shrink it with `-`/`_` and reset it with `0`, in 4-cell steps, with an always-present hint row showing the live `cols x rows`. Because the engine samples per cell, growing the frame is a fresh resample into a larger sub-cell grid — measured through the real renderer, three presses took a photograph from 20×5 to 32×8 cells and from 52 to 79 distinct colors on screen — and on the pixel path it transmits a proportionally larger buffer under a new id. The frame is clamped to the content column, to the block's real allocation, and to the visible height (a resizable frame may not grow its own bottom edge off screen), with an 8-cell floor. Sizes are per-runtime state keyed like accordion/tab state: they survive navigation and terminal resize, and two SSH sessions cannot see each other's. Focusability is opt-in because it is otherwise type-keyed — making every image focusable would shift every focus index below one.

- **Page-fit images: `image(path, { fitPage: true })`.** The answer to "what `width` makes this fit?", which is a question with no fixed answer — the number is chosen by looking at one window, and it is wrong again the moment the terminal's font size changes, usually by scrolling a page that was meant to be seen at once. The page now composes every other block first, hands this image the rows that are left in the content viewport, and lets geometry back-solve the column count from the source's own aspect. Re-derived every frame, so a resize re-fits the page instead of breaking it. `width` still applies as a ceiling and `maxHeight` as a tighter cap, so `{ fitPage: true }` alone is the usual form; several fitted images on one page split the leftover evenly.

  A fitted picture is composed against the **whole terminal**, not the 100-column centred content column the rest of the page lives in. That column is a measure chosen for prose, and because `contain` derives rows from columns, applying it to a picture capped the picture's *height* too — a 1080x709 source saturated at 34 rows however many it was granted, so on a 90-row window a quarter of the screen stayed black, and the band grew a row for every row the window gained. Rows a picture still cannot spend (aspect, not width, is the binding constraint at some sizes) are kept as symmetric margin **inside the image's own slot** rather than left at the foot of the page, which both reads as the margin of a one-sheet and makes the block occupy exactly the rows the layout estimator reserved for it. Only a `fitPage` image leaves the content column; every other block, including an image without the flag, is positioned exactly as before.

  Deliberately inert in three places — on a `resizable` image (the viewer's chosen size wins, and the two vertical clamps must not stack), inside a panel/columns/rows/grid cell (the pane's inner height already governs the image), and on the home page. It confers **no** focus slot, and an image that does not opt in is byte-identical to before: it may still run off the bottom and be scrolled to. The budget is spent by rewriting the block's `maxHeight` before geometry runs — algebraically the same input to the same clamp as an `availHeight` argument, swept over 2160 combinations of source, border, width, fit and budget with zero divergences — rather than by populating `ctx.panelHeight` at page level, which would additionally truncate composed rows and re-cap every resizable frame. Because the renderer is the only thing that can know the leftover (it has composed the siblings) and the layout estimator is what places every focus rect, the number travels renderer → per-runtime store → estimator, with a same-frame re-walk closing the one-frame lag, so rects are correct on the first paint. One real cost, pinned rather than hidden: the rendered size now depends on the terminal's row count, so a height change is a fresh resample and, on kitty/Ghostty, a new image id and a new transmission — repeated frames at one height, and width-only churn, are still free.

- **A `custom` block can size itself vertically.** `render` gains an optional third argument, `CustomRenderContext` — `{ availRows, columns, rows }` — so ASCII-art display type can pick its font from the room it actually has instead of from a constant. `availRows` is the enclosing sequence's TOTAL budget (the page viewport, or a pane's inner height), never the rows left after the block's siblings: a block sized to the leftover could not be measured until its siblings were, and a `fitPage` image sized from that measurement would close the loop. Nothing clamps to it. Widening a callback's parameter list is source-compatible, so every existing `(width, theme) => string[]` keeps working.

  The layout pass **measures** a `custom` block by calling its `render`, instead of charging it a flat 3 rows as it always had. That constant was wrong by construction for exactly the pattern this argument exists to enable: a 6-row banner put the focus rectangle of the block beneath it two rows above where that block was drawn, and a 7-row one put it four rows out, so spatial focus navigation misrouted. The measurement passes the same theme and the same `availRows` the renderer will, and the walk runs on navigation and resize rather than per frame; a `render` that throws is charged the old constant rather than taking the frame down.

- `detectTerminal()` gains `term`, `isMultiplexed` and `graphics`, and accepts `{ termType }` so a serve session describes the *client's* terminal. `FRAME_MIN_COLS` (8) and `FRAME_STEP_COLS` (4) are exported for help screens.

- **A third image cache: the kitty registry**, holding the image id, the placement rows and a *thunk* that can rebuild the transmission. The base64 is never resident, so an entry costs kilobytes rather than megabytes. It gets 6% of the shared budget with a 512 KB floor that holds even at `TERMINALTUI_IMAGE_CACHE_BYTES=0` — an evicted entry takes its image id with it, and a new id means a fresh multi-megabyte transmission every frame, which is a hang rather than a slow path.

- **[docs/images.md](docs/images.md)** gains sections on the pixel tier, the detection ladder, resizable frames, 256-color output and both environment knobs; `claude/SKILL.md` and the README are updated to match.

### Fixed

- **The `Block` banner font drew M, V and W as H, U and H.** All three were a horizontal bar between two full-height stems, differing only in how high the bar sat, which at four rows is not a cue anyone can read: a real capture of a page set in it showed "TRY: TERMINALTUI.DEV" as "TRY: TERHINALTUI.DEU" and "WATCHING" as "HATCHING" — a mangled URL, from the one face compact enough to set one at mid-range window sizes. The three are redrawn so the interior stroke changes column as it changes row (M gains a descending V, V a one-column point, W a centre stem and two feet), each one column wider because centring a middle stem needs an odd ink width. Pinned verbatim by `test/test-banner-alignment.ts`, which also sweeps every bundled face for letters that render identically to a different letter.

- **Apple Terminal is no longer capped at 256 colors on macOS 26.** The cap dated from a Terminal.app that genuinely could not do 24-bit; build 470 (Tahoe, announced at WWDC 2025, corroborated by `termstandard/colors` #69) can. It is the one significant terminal that gained truecolor without ever setting `COLORTERM`, so there is no capability signal to read and the depth is now sniffed from `TERM_PROGRAM_VERSION` — its `CFBundleVersion`. 470 and above get truecolor; anything lower, absent or unparseable stays 256, which is the safe end of the guess (over-reporting paints codes the terminal will mangle, under-reporting merely quantizes). Verified by hand on build 470.2 with a 60-step ramp across the cube's 0→95 gap: smooth, where a 256-snapping build renders three hard bands. Apple Terminal keeps the `quadrant` tier and is still never probed for pixels — the graphics denylist is unchanged and unrelated — but that tier is now fed 24-bit color, which is the entire difference between a washed-out photograph and a faithful one. `TERMINALTUI_COLOR` overrides it either way.

- **256-color images no longer blotch.** Which of the two xterm families a color lands on — the finely spaced grey ramp (step 10) or the coarse color cube (steps 40–95) — was decided by plain RGB distance, whose winner flips at pixel frequency: `(68,18,22)` went to a saturated cube red while its neighbour `(70,21,24)`, 4 units away and identical in chroma, went to a flat grey 78 units away. On a photograph that reads as hard islands of saturated blue, red and teal in a grey field. Below a chroma of 40 the grey ramp now wins outright; above it the exact nearest neighbour over all 240 entries still decides. The floor is anchored in the palette (the smallest non-zero chroma the cube can express is `sqrt(2/3)×40 = 32.7`, so below it every colored entry over-states the pixel's chroma) and is the largest value that leaves saturated UI art bit-identical. Measured on the pillars photograph: 58% fewer grey/cube flips, 52% fewer isolated specks, for +3.3% RMSE and a drop in retained chroma from 36% to 26% — a deliberate trade, chosen from rendered screenshots rather than scores. The decision now lives in exactly one predicate shared by the palette emitter and the image ditherer, so the two can no longer disagree about what gets painted.

- **SSH sessions negotiated their cell tier against the server, not the client.** `deriveCapabilities()` takes a remote `TERM` precisely so a serve session stops consulting the daemon's `TERM`/`TMUX`/`STY`, and production called it without one — so the "unrecognized remote `TERM` falls back to half blocks" rule was dead code, and a daemon started inside tmux downgraded *every* client to half blocks. The client's `TERM` is now published per render pass, like the color mode. Local runs are byte-identical.

- **Character widths for combining marks.** `charWidth()`'s hand-written combining-mark list has been replaced by one generated range table (Mn + Me + Cf, unioned with the exact blocks the old list covered), which is what makes kitty's 297 row/column diacritics measure zero and `U+10EEEE` measure one. It also fixes two pre-existing errors: `U+302A`–`U+302D` and `U+3099`–`U+309A` were counted as 2 columns because they sit inside CJK blocks (combining voiced-sound marks were inflating Japanese text by a cell each), and format characters such as `U+0600`–`U+0605` and `U+2060`–`U+206F` were counted as 1. The hot path is faster too: box-drawing lookups −30%, ASCII −18%.

- **`TERMINALTUI_IMAGE` was parsed twice and the two copies had drifted.** A typo such as `=quadrnat` was ignored by the tier ladder (as documented — a typo must degrade to normal negotiation) but read as a cell pin by the graphics detector, which silently killed pixels; and `=cells` did not defeat the pixel tier on its own, only because the detector happened to deny the gate first. Both modules now call one exported predicate, so each holds its documented guarantee independently.

- **The test emulator misreported chunked graphics transmissions.** One kitty transfer is ~275 APC escapes of which only the first carries the control keys, and the sink's 256-record cap evicted exactly that one — a perfect transmission was reported as 256 anonymous continuations. Continuations are now coalesced into their control record, with a `chunks` count and a `byteLength` covering the whole transfer.

- **Emulator children inherited `KITTY_WINDOW_ID`.** The emulator rewrites `TERM` but passed the marker through, so with `node-pty` installed every emulated app on a kitty or Ghostty machine would have switched to the pixel tier and broken every cell assertion. `src/emulator/pty.ts` now defaults `TERMINALTUI_GRAPHICS=off`, placed before caller-supplied env so a graphics test can still opt in.

- **`runtime.isBlockFocusable()` disagreed with focus assignment** for a resizable image: it answered from the type-keyed taxonomy while the four walkers that assign focus indices answered from the widened predicate. Routed through the widened one.

### Changed

- **256-color photographs are slightly more desaturated than in 2.1.0**, uniformly, in exchange for the blotching fix above. Dark and mid-tone regions below the chroma floor now render neutral by rule rather than by accident of the cube's bracket phase. Saturated content above the floor is bit-identical.
- **An unrecognized remote `TERM` over SSH now negotiates conservatively** — `half` blocks (or `shading` when the same `TERM` also reads as 16-color) — rather than inheriting the server's negotiation, including for a client that sends no `TERM` at all. That is the safe direction, and it is what the remote branch was always meant to do.
- Unicode detection is broader: `LC_CTYPE` joins `LANG`/`LC_ALL`, the locale match is case-insensitive `utf-?8`, and kitty/Ghostty/Konsole/VTE/Alacritty/foot/Contour/Rio/VS Code/Hyper/Warp/Tabby markers are recognized. Every clause is additive, so nothing that detected as Unicode-capable before can stop doing so.
- `docs/images.md`'s "why no graphics protocols" section is now "why not iTerm2 or sixel": neither has a cell-anchored variant, so both would need an out-of-band emission plane plus damage tracking that placeholders make unnecessary.

## [2.1.0] - 2026-07-25

Images. `image("./photo.png")` now renders real pixels as colored terminal cells — no `sharp`, no native build, no graphics protocol. The block shipped in 1.x and had never drawn anything but the literal text `[Image: ./photo.png]` in a box; `asciiImage()` had never once returned an image either. Both go through one new engine now, and it works on Apple Terminal, over SSH, inside tmux, and in the headless test emulator, because the output is ordinary styled text. Several defects found while building it are fixed too, most of them nothing to do with images — the worst dispatched a terminal's unsolicited replies as keystrokes.

### Added

- **Images render.** `image(path, options?)` decodes PNG and JPEG synchronously and fits every cell to a Unicode block glyph with an independent foreground and background color. Six tiers, negotiated automatically from the viewer's terminal: `quadrant` (2×2 sub-cells, the default at 256-color and truecolor), `half` (1×2, used when a multiplexer is detected), `solid` (background only, needs zero glyph coverage), `shading` (a luminance ramp, 16 colors), `ascii` (no color at all), plus opt-in `braille` for line art. New options: `width`, `height`, `maxHeight`, `fit`, `align`, `mode`, `dither`, `alt`, `background`, `invert`, `charset`, `border`. Full reference in [docs/images.md](docs/images.md).

  Measured on the shared test lattice, the fidelity ordering the tiers promise actually holds: quadrant beats half by 1.98 dB and half beats solid by 2.35 dB in truecolor (0.54 dB and 0.83 dB at 256 colors with ordered dithering).

- **Every failure reserves the same space as a success.** A missing file, a corrupt file, a GIF/WebP/BMP, an `http(s)` URL, an oversized source, a path outside the project — all render a bordered alt-text box at *exactly* the geometry the image would have occupied. Row count comes from the file header (0.015 ms, no pixel decode), so nothing below an image ever shifts, whether the pixels arrive or not.
- **`pngjs` and `jpeg-js` are now dependencies.** Both are pure JavaScript with synchronous APIs — no native build step and nothing to install separately. `sharp` is no longer referenced anywhere in the framework.
- **Two-level image cache.** L1 holds the resampled pixel grid keyed on `(path, mtime, size, geometry, tier, background, invert)`; L2 holds the finished ANSI rows and adds color mode, dither and charset. Color mode is deliberately absent from L1, so two SSH sessions at different color depths share one decode instead of evicting each other. An L2 hit returns the same array instance as the previous frame, so the per-row frame diff writes zero bytes for an unchanged image: a 1600×1000 PNG at 80 columns costs 32 ms cold and 0.0024 ms warm.
- **`TERMINALTUI_IMAGE`** overrides tier negotiation — `off` forces every image to its alt box (row counts unchanged), a tier name forces that tier, `auto` forces re-negotiation over an explicit `mode`. **`TERMINALTUI_IMAGE_CACHE_BYTES`** sets the cache budget (default 32 MB; `0` disables caching).
- `imageCellSize()` and `setImageProjectDir()` are exported, along with the image types (`ImageMode`, `ImageFit`, `ImageAlign`, `ImageDither`, `ImageTier`, `ImageGeometry`). `imageCellSize()` is the same function the layout engine calls, so an author can compute a block's footprint exactly as the framework will.
- **An Images page in the `welcome` demo** (`npx terminaltui try`), rendering one photograph through all six tiers side by side.
- **[docs/images.md](docs/images.md)**, added to the README's docs table, plus the `asciiImage()` section that [docs/ascii-art.md](docs/ascii-art.md) was already being advertised as containing. The image entries in `docs/components.md` and `claude/SKILL.md` are rewritten to the real API — both described options that never existed.
- Three checked-in image fixtures under `test/fixtures/`, and `test/image-quality-harness.ts` — a measurement tool that re-parses rendered ANSI back into pixels and asserts the quality ordering holds at every color mode. Run it with `npx tsx test/image-quality-harness.ts`.

### Fixed

- **`asciiImage()` returns an image.** It lazy-loaded `sharp`, which is declared in no manifest and installed nowhere, so every call in the function's history returned `["[Image: install sharp for image support]", "  npm install sharp"]`. It now decodes with the bundled decoders and renders through the shared engine, so a fix in one path reaches both.
- **Half blocks carry two colors.** The `blocks` renderer painted the *average* of the upper and lower half-pixels as a single foreground color, so the `▀` glyph encoded nothing: measured, it scored within 0.00 dB of a flat one-color cell. It now emits `fg(top) + bg(bottom) + "▀"`, worth **+2.35 dB** in truecolor.
- **Sub-cell modes are no longer squashed 2× vertically.** The old pipeline scaled the pixel target by the cell aspect ratio *and* then stepped `y` by 2 (blocks) or 4 (braille). A 1600×1000 source at 60 columns produced 10 rows where the correct answer is 19. `CELL_ASPECT` now lives in one module and is applied exactly once, and the harness verifies the round trip per tier.
- **The layout engine sizes image blocks from the file.** `flex-engine.ts` returned a hardcoded `10` rows for every image block regardless of the image, so every focus rect below one landed on the wrong row — the old placeholder itself drew 15 rows at a 40-column width. The estimator and the renderer now call the same `imageCellSize()`, so they cannot disagree.
- **256-color quantization picks the right color.** `rgbTo256()` assumed the 6×6×6 color cube was evenly spaced (it is 0/95/135/175/215/255), used the wrong grey-ramp formula, and only considered the grey ramp when `r === g === b` exactly. Near-grey `rgb(28,26,28)` mapped to `rgb(95,95,95)` — a distance of 117 where 2 was available. It is now provably nearest-neighbor over the full 240-entry palette; RMSE across all 16,777,216 colors drops from **53.07 to 31.77**. This affects every `fgColor`/`bgColor` call on a 256-color terminal, Apple Terminal included. All four pinned assertions in the Apple Terminal color suite still hold, and no snapshot moved.
- **Unsolicited terminal replies are no longer dispatched as keystrokes.** The input parser understood `CSI` but not the five string-terminated families (`OSC`, `DCS`, `APC`, `PM`, `SOS`), so any terminal that answered a query on its own — a kitty graphics ack, a sixel `DECRQSS` reply, `XTVERSION`, `XTGETTCAP`, an OSC 11 background query, an OSC 52 clipboard reply — was parsed byte by byte into keypresses. A kitty ack emitted 12 keypresses; a sixel reply emitted 46, one of which was a literal `q`. All eleven synthetic replies now emit zero. A fragmented reply is buffered against a 500 ms *absolute* deadline measured from the first partial byte — not a silence window, which continuous typing would re-arm indefinitely — and an unterminated one is dropped after 64 KiB rather than growing the buffer forever. Alt-chords built on those five introducers (Alt+`]`, Alt+`_`, …) still produce the same `[escape, char]` pair: immediately when a real key follows (the run is then provably not a reply), and 500 ms later otherwise.
- **The test emulator no longer prints graphics payloads to its screen.** `VirtualTerminal` handled `OSC` but treated `DCS`/`APC`/`PM`/`SOS` as unknown escapes and rendered their bodies as text — a 4 KB kitty APC over a painted 24-row UI left 0 of 24 rows readable. All five families are now consumed to their terminator and logged to a new `vt.graphics()` sink (`{ protocol, controlData, byteLength, row, col }`), so a suite can assert on a graphics payload instead of finding it smeared across the grid.
- **Relative image paths resolve against the project root.** `terminaltui dev demos/x/config.ts` runs from the repo root while the page lives in `demos/x/`, so `./logo.png` resolved against the wrong directory. `runtime.projectDir` is now threaded through both entry points and set before the first layout pass — without that ordering, frame 1 reserved 30 rows for an image the renderer drew in 19. `terminaltui build` output sets it from the bundle's own location.
- **`serve` config in a file-based project.** `FileBasedConfig` carried no `serve` field, so `defineConfig({ serve: { colorMode: "16" } })` in a file-based `config.ts` was a hard TypeScript error (TS2769) — the option was not merely ignored at runtime, it was unwritable. It is now declared and populated through both entry points.

### Changed

- **`image()` blocks are centered and unbordered by default.** The old placeholder was left-aligned and always bordered; `align` defaults to `"center"` and the border is opt-in via `border: true` (or a style name, matching `card`/`table`/`panel`).
- `mode: "blocks"` on an `image()` block is accepted as an alias for the `"half"` tier, so existing pages keep rendering.
- `asciiImage()` widths are capped at 99 cells, the framework's content column — `{ width: 400 }` returns 99 columns.
- `asciiImage({ mode: "blocks", color: false })` renders the shading ramp instead of half-block glyphs: with both pens suppressed a half block only encodes "the two halves differ", which is not an image.
- `asciiImage`'s `threshold` applies to `"braille"` only, and omitting it now picks a per-image cut with Otsu's method rather than always using 128. `dithering` is a documented no-op in truecolor and whenever `color` is `false`.

## [2.0.3] - 2026-07-21

Two fixes found by hands-on testing of the dashboard demo: panel content below the fold is now reachable, and the CLI can run its bundled demos from a repo checkout.

### Fixed

- **Panels scroll to keep the focused block visible.** Panels in `columns` / `rows` / `grid` layouts hard-clipped content taller than their region — overflowing blocks were never rendered, while arrow-key focus still walked into them invisibly (the dashboard demo's comments panel: focus vanished and down-arrow appeared dead). The active panel now slides its clip window to follow the focused block (one line of headroom below when content continues past it; blocks taller than the window anchor to their own top), and hidden overflow is hinted with dim `↑ more` / `↓ more` markers, clamped to the panel's inner width so narrow bordered panels keep their right border. Inactive overflowing panels keep their top-clip but gain the `↓ more` hint. Fixed dashboard-style regions still never grow — overflow scrolls inside the panel.
- **Compiled pages/configs bind to the framework copy that compiled them.** Compiled `.terminaltui/*.mjs` output imported the framework as the bare specifier `terminaltui`, resolved from the output file's location. Running the repo's own CLI against its bundled demos (`npx terminaltui demo <name>` inside a checkout) found nothing — `Cannot find package 'terminaltui'` — and in consumer projects the compiled site could bind to a *different installed version* than the running CLI, putting two framework instances in one process. The esbuild alias now rewrites both relative `src/index` imports and the bare specifier to the `file://` URL of the entry next to the running dist bundle, falling back to the old bare-specifier behavior when that probe fails.

### Changed

- Windows CI runs the render-diff suite's deterministic portion only: the emulator's piped-stdio fallback cannot boot or drive a live app on Windows, so the E2E section that launches the startup demo is skipped there with a logged reason. The failing suites' individual `✘` assertion lines are now echoed into the CI log by the test runner, so matrix-only failures are diagnosable.

### Added

- Regression coverage: a panel scroll-window unit suite (22 assertions on window math, markers, and border safety) and a dashboard-QA E2E case that walks focus through the overflowing comments panel and asserts the window follows.

## [2.0.2] - 2026-07-20

Dynamic routes actually receive their params now. This bug predates the v2 overhaul — any page opened with navigation params (`[id].ts` routes, or a card action with `params`) got `undefined` instead of a context, and function-typed `metadata.label`s were painted into the header as raw source. The dashboard demo's post-detail page showed both symptoms.

### Fixed

- **Content loaders receive navigation params.** The runtime now passes the current route params to a page's content loader on every navigation, and the file-router builds the documented `{ params }` context from them for dynamic routes and any param-carrying navigation. Previously the loader was always called with `undefined` — a `[id].ts` page (or a static page opened via `action: { navigate, params }`) crashed on its params and hung on the loading spinner.
- **Function-typed `metadata.label` resolves at render time.** `label: (p) => \`Post #${p.id}\`` now renders the resolved string in the page header instead of the function's source code. `metadata.loading` gains the same function form and is actually passed through to the page (it was silently dropped before).
- **Params changes invalidate cached page content.** Revisiting a parameterized page with different params shows its loading state instead of the previous params' content, and a slow in-flight load that was superseded by a newer navigation discards its result instead of clobbering it (per-key load generation in the async manager).
- **Param-less search navigation clears stale params.** Jumping to a page via fuzzy search no longer leaves the previous dynamic page's params live on the runtime.
- **Back-navigation restores the params a page was opened with.** History entries now carry their params. Previously, going back to a parameterized page after any forward navigation re-resolved its function label against cleared params — the header read "Post #undefined" over the correct content. Back also re-enters the page lifecycle now, so `refreshInterval` timers restart on back instead of staying dead (cached content for matching params still shows instantly).
- **`terminaltui build` output threads params.** The AOT build's generated entry point called every page function with no arguments — its own parallel loader path, untouched by the dev-router fix — so param pages crashed in built bundles even after the fix above. The generated loaders now build the same `{ params }` context as the dev router, and `metadata.loading` is included in the bundle.
- **Windows CI: the CLI dispatch suite runs.** The suite spawned the extensionless `node_modules/.bin/tsx` shim, which Windows `spawnSync` can't execute without a shell (ENOENT, 0/24). It now invokes tsx's JS entry with the current node binary on all platforms.

### Added

- Regression coverage: a router params suite (23 assertions on context threading, metadata passthrough, history param restore, and build codegen) and a post-detail section in the dashboard QA suite — the first E2E tests that actually open a param-driven route, including the jump-away-and-back round trip.
- `docs/routing.md` documents param-carrying navigation to static pages and the function forms of `metadata.label` / `metadata.loading`.

## [2.0.1] - 2026-07-20

Fixes for the emulator and the test suites, found by running the v2.0.0 CI matrix on Linux, macOS, and Node 18. No changes to the framework runtime — apps behave exactly as on 2.0.0.

### Fixed

- **Emulator: `close()` now kills the whole process tree.** `TUIEmulator.launch({ command })` runs the command through a shell, so a launch like `npx tsx app.ts` is a tree (shell → npx → tsx → node). The child-process fallback signalled only the direct child, which on Linux left the app itself alive holding the emulator's pipe ends open — the calling process would never exit. The fallback now spawns into its own process group and signals the group (`taskkill /T /F` on Windows), then destroys the pipes after escalating to `SIGKILL`.
- **Emulator: launched commands can find locally installed binaries.** `spawnPTY` prepends the host project's `node_modules/.bin` to the child's `PATH`, so a command run from a scratch directory resolves project-local tools instead of falling back to a registry download. The prepend is case-correct on Windows (`Path`), where writing a second `PATH` key broke command resolution entirely.

### Changed

- Test suites launch apps as `tsx run.ts` rather than `npx tsx run.ts`. On a cold npx cache — every fresh CI runner — npx would install `tsx` mid-test and print progress into the emulated terminal, so boot assertions sampled a half-rendered screen.
- Test suites use `dirname(fileURLToPath(import.meta.url))` instead of `import.meta.dirname`, which is undefined on Node 18 (added in 20.11) and crashed suites at module load there. The package's supported range has always been `>= 18`; only the tests were affected.

## [2.0.0] - 2026-07-19

The v2 overhaul. Five waves of work land in one major release: two audit-driven bug-fix passes, a full demo/QA repair, a dead-code and packaging cleanup, a typed core-runtime rewrite with correct component-state keying, and a line-diffed render pipeline that writes 67.7% fewer bytes to the terminal. Same pixels. A third of the bytes. The two behavior changes worth reading before you upgrade are **component state is now keyed by page + tree path instead of display label** and **`ssh2` is now an optional peer dependency** — see Breaking and the migration guide below.

> **Note on 1.9.0:** `package.json` was bumped to 1.9.0 during this work, but 1.9.0 was **never published to npm** — the last release on npm is 1.8.2. There is no intermediate version for anyone to have upgraded through, so 2.0.0 rolls up everything since 1.8.2 (commits `0928dd7`, `0449b00`, `0c54ded`, `eb76224`, `c75aaa5`), including the packaging changes that had been tagged internally as "1.9.0".

### Breaking

- **Component state is keyed by page + tree path, not display label.** Accordion open/closed, active tab, gallery index, and button loading state used to be stored under the component's display label in a shared map. They are now stamped with the page id plus the block's position in the content tree (a walker-assigned path, via a `WeakMap`). Two consequences:
  - **Two components with the same label no longer share state.** Previously an accordion titled `"Details"` on `/faq` and another titled `"Details"` on `/help` toggled together. They are now fully independent.
  - **State survives navigation and refresh.** Previously leaving a page and returning reset that page's accordions/tabs/gallery to their defaults. State now persists across navigation and page refresh. Dynamic (regenerated) subtrees get shape-tolerant keys, so a re-render of the same structure keeps its state instead of resetting.

  Before / after, two same-labeled accordions on different pages:

  ```
  // 1.x — state keyed by label "Details"
  //   expand "Details" on /faq        -> "Details" on /help also shows expanded
  //   navigate /faq -> /home -> /faq   -> "Details" is collapsed again (state lost)

  // 2.0 — state keyed by page + tree path
  //   expand "Details" on /faq        -> "Details" on /help is unaffected (independent)
  //   navigate /faq -> /home -> /faq   -> "Details" is still expanded (state kept)
  ```

- **`ssh2` moved from `optionalDependencies` to an optional `peerDependency`** (install-semantics change). `terminaltui serve` still needs `ssh2`, but it is no longer pulled in transitively — install it in your own project: `npm i ssh2`. `terminaltui dev` and everything else work without it. `serve` resolves `ssh2` via a cwd-aware import fallback so global/`npx` installs find a project-local copy. `node-pty` remains an optional peer as well.

Public exports of `terminaltui` and `terminaltui/emulator` are otherwise unchanged.

### Performance

Wave 5 rewrote the frame writer as a line diff and memoized the two hottest string operations.

- **Terminal bytes written: 269,355 → 87,027 = −67.7%** across a scripted navigation run (per-demo: startup −69.0%, developer-portfolio −66.2%). **Zero-change frames now write 0 bytes** — an unchanged re-render emits nothing.
- **Method:** measured through the emulator against the same PTY backend at 120×40, a 41-keypress scripted navigation, reported as 3-run medians. Correctness was proven by a dual-`VirtualTerminal` oracle that replays both `text()` and `ansi()` output of the old and new writers and asserts the **final on-screen grids are byte-identical** across styled rewrites, overlays, shrink, and resize.
- **How:** `writeToTerminal` is now two-phase — compose the final styled per-row strings (bottom-row overlay precedence preserved), then diff against a previous-frame buffer and emit only changed rows as `CUP` + `EL` + payload. Per-frame `frameState` lives on the runtime instance (one per terminal stream), so concurrent SSH sessions cannot cross-contaminate. Full redraws still happen on the first frame, on any resize, and from every out-of-band writer (error, stop, cleanup, stderr warnings), preserving the legacy self-heal behavior.
- **Width/ANSI memoization:** `stringWidth` is memoized at its single choke point (bounded `Map`, cap 8192 entries, FIFO eviction; strings shorter than 8 chars skip the cache), so every hot caller (`Panel` pad/clip, `truncate`/`wrapText`, the terminal truncation guard) benefits with no call-site edits; `stripAnsi` gained a zero-alloc fast path for strings with no ESC. Output was proven byte-identical before and after memoization (0.0% delta).
- **`PageLayoutCache` (wave 4):** non-volatile pages now skip focus collection, form registration, and rect computation on every frame. Volatile pages (dynamic/async) keep the exact per-frame path; the cache invalidates on page enter, resize, refresh, content-identity change, and a focus-slot fingerprint so in-place mutations still rebuild.

### Fixed

Input, Unicode width, SSH, and data (wave 1 — 36 fixes from a multi-agent audit):

- **Escape-sequence parser is now stateful** — sequences split across stdin chunks parse correctly, surrogate pairs are never split mid-codepoint, and a lone `ESC` is recognized via a 50 ms hold.
- **`SIGINT`/`SIGTERM` now actually exit** (codes 130/143); `cleanup()` no longer tears down process-globals under SSH; the exit cursor position is 1-based. The site `onError` lifecycle hook is now wired into the render, action, and navigation error paths.
- **SSH per-connection session tracking** — one client disconnecting no longer kills other sessions from the same IP; a serve-mode crash guard restores every client's terminal before exit.
- **Text-editing cursor/scroll/wrap math is done in code points and display cells** (new shared `text-cursor` helper), so emoji and CJK are no longer torn or misaligned. `Quote`, `Menu`, gradient lines, scenes, and bar charts compute width via `stringWidth` instead of UTF-16 code units.
- **Data fetching** — the `fetcher` custom-fetch instance leak is fixed (opt-in key option); the SSE parser buffers partial events across chunks and handles CRLF.
- **Emulator vterm gained wide-character support** — 2-column CJK/emoji render with continuation cells.
- **`runtime-pages`** — page refresh timers are cleared on navigation, a background refresh no longer clobbers the current page's focus, and dynamic render errors surface as an error block instead of vanishing.

Demo/QA repair (wave 2 — root-cause framework bugs, not demo typos):

- **`columns()`/`rows()` rejected the documented `panel()` block form** — consumers read `p.content` off the wrong shape and crashed with `blocks is not iterable`. Both shapes now normalize, with a `toBlockArray()` guard at page-content boundaries.
- **Auto-scroll anchored viewport-tall focused blocks to their end**, clipping tab headers off the top; it now anchors to the start.
- **`screen`/`terminal-io` now honor `COLUMNS`/`LINES`** when stdout reports no size, so the emulator's non-PTY fallback renders at the requested size instead of 80×24 (this had been hiding below-the-fold content in every demo).
- **Emulator `resize()` works in the non-PTY fallback** via an in-band `CSI 8;rows;cols t` channel; the launch timeout is inactivity-based instead of an absolute deadline that killed long-running QA suites mid-run.
- The dashboard demo prefetches its data at boot (its loading state was previously unescapable).

Cleanup-pass fixes (wave 3):

- **Command-buffer backspace deletes whole code points** (no surrogate tearing after an emoji), and the printable-char guard accepts astral characters (`codePointLength`, not `.length`).
- **`TextArea`** — the cursor cell at the end of a full line no longer overflows the right border by one column.
- **`Quote`** — fancy-style attribution is width-aware truncated to fit.
- **`detect-terminal`** — a TTY with no `TERM` keeps a 16-color floor; only `NO_COLOR` forces monochrome on a TTY.

Review repairs from the typed-runtime and render-diff work (waves 4–5):

- Late async page loads no longer stamp component state under the wrong page id; non-current-page refresh writebacks no longer store unstamped arrays.
- `findFocusIndexByPanelTitle` is path-based — empty panels return no-jump instead of drifting focus to the next block; panels inside `rows` became title-matchable.
- Overlay controls are sanitized at compose time and C0-except-`ESC` is stripped from every payload, so a stray `\n` in a notification can no longer scroll the screen and desync the frame buffer; out-of-band writers force a heal.

### Changed

- **Input behavior (observable):** `Escape` on the home page is now a no-op instead of quitting (`q`/`Ctrl+C` quit); left-arrow at the leftmost focusable no longer acts as "back" (matches the keybindings design note); returning home resets the menu selection to the first item.
- **Typed core-runtime internals (wave 4):** a new `RuntimeInternal` interface replaces 23 `this as any` casts and 7 per-module ad-hoc runtime interfaces; `serve.ts` writes `runtime.fileRouter` typed.
- **One block walker, one taxonomy (wave 4):** a single pre-order `block-walker` replaces 11 drifting ad-hoc tree walks; `block-taxonomy` centralizes `FOCUSABLE_TYPES` (chat is now focusable, gallery is not — resolving a flex/legacy engine disagreement) and drives the flex engine from the same set. `layout-constants` replaces numerically identical scattered literals.
- **Dead code removed (wave 3):** files `cli/art-commands.ts`, `art-registry/art-helpers.ts`, `components/ScrollView.ts`, `ascii/box-drawing.ts`, `helpers/clipboard.ts`, plus unreferenced exports (`drawBox`/`drawBoxWithTitle`, `gradientText`, `createArtPack`, `getScreenSize`, `getSpinnerFrames`, `shouldStack`, `isTracking`, `styledInverse`, and unused layout types). Each was independently re-verified unreferenced, including dynamic/registry lookups.
- **Duplication consolidated (wave 3, public names/signatures preserved):** `detectTerminal()` delegates color depth to `detectColorSupport()`; the chart helpers are defined once in `dataviz-charts.ts`; `Columns`/`Rows` stacked-panel rendering shares `layout/stacked.ts`; `truncate()`/`truncateLine()` share one width-aware core.
- **Demos** got curated menu order via `metadata.order`/`menu.order`.
- **CI:** the `--demos` E2E job is now a blocking gate (previously advisory/`continue-on-error`); a full-tree `npm audit` step restores `ssh2` advisory coverage.
- **Packaging:** `exports` gained default conditions and `./package.json`; `sideEffects: false`; a prepack build and tarball dupe-guards; `engines.node >= 18` is now declared and documented (ESM-only). `demos/mac-monitor` ships its sources like every other demo.

### Added

- **`TUIEmulator.bytesReceived` and `TUIEmulator.resetBytesReceived()`** — a new public emulator capability (on the `terminaltui/emulator` export) to measure exactly how many bytes a run writes to the terminal. This is how the render benchmark above is taken; you can assert on it in your own tests.
- **New test suites:** `render-diff` (83 tests, incl. the grid-identity oracle and a 0-byte no-op E2E), `width-cache` (90 tests, incl. an 18-entry Unicode corpus checked against an uncached reference after 8k-entry churn), `focus-contract` (a 21-slot fixture covering every container kind, asserting rect count equals focus count against golden paths), and 4 CLI unit suites (+112 tests: create-prompt mapping, command dispatch, project guards, art helpers).
- **Test suite grew from 2,142 to 3,323 tests across 52 suites.** The default subset is 2,440 tests across 33 suites (~20s); the full `--demos` sweep runs the demo/QA E2E suites through a real PTY emulator (~17 min) and is now a blocking CI gate.

### Migration from 1.x

1. **Component state (accordion / tabs / gallery / button loading).** State is now keyed by page + tree path, so:
   - If you relied on **two same-labeled components sharing state**, they no longer do — that was incidental behavior of label-based keying. There is no code change needed unless you were depending on the shared toggle.
   - If you relied on a page's components **resetting when you navigate away and back**, they no longer reset — state persists across navigation and refresh. If you need a component to start fresh, reset it explicitly in your own state rather than expecting navigation to clear it.
2. **SSH hosting (`terminaltui serve`).** `ssh2` is now an optional peer dependency. Add it to your project: `npm i ssh2`. Nothing else changes; `terminaltui dev` does not need it.
3. **Keybindings.** `Escape` no longer quits from the home page — use `q` or `Ctrl+C`. Left-arrow at the leftmost item no longer navigates back.

---

## [1.8.2] - 2026-06-01

Infrastructure and correctness release. Adds a CI pipeline and a publish guard, removes a self-referential dependency that bloated every install, and fixes a color bug where text attributes ignored runtime color-mode changes. CI caught that color bug on its first run — it passed locally but failed on bare-environment runners.

### Fixed

- **`bold`/`dim`/`italic`/`underline`/`inverse`/`reset` ignored `setColorMode()`** — they were evaluated once at module load from the ambient color mode, so any runtime mode change (notably per-SSH-connection color derived from the client's `TERM`) left them frozen to whatever was detected at import. They're now live bindings recomputed by `setColorMode()`.
- **The package depended on itself** — `dependencies` listed `terminaltui`, so every install pulled a nested older copy of the package. Removed; runtime dependencies are now just `esbuild`, matching the README's "1 required dependency."
- **`createPersistentState` test used a hardcoded `/tmp/` path** — now `os.tmpdir()`, so the suite runs on Windows.

### Added

- **CI pipeline** (`.github/workflows/ci.yml`) — typecheck + test + build across Ubuntu (node 18/20/22), macOS, and Windows, plus a production-dependency `npm audit`. The full suite (2,142 assertions) now runs on every push and pull request.
- **`prepublishOnly` guard** — `typecheck && test && build` runs before publish, so a broken build can't ship.

### Changed

- Pinned `tsx` as a devDependency (tests no longer rely on `npx` auto-download).
- Pinned `picomatch` to `^4.0.4` via `overrides` to clear a high-severity advisory in dev tooling.

---

## [1.8.1] - 2026-05-14

Hotfix for v1.8.0. `npx terminaltui try` crashed at startup with `Cannot find module '<pkg>/demos/src/index.js'` — the demos' relative framework imports (`../../src/index.js`) were externalized as literal strings, then resolved relative to the compiled `.mjs`'s location (one level deeper than the source), so the path landed inside `demos/` instead of the package root.

### Fixed

- **`runDemo()` failed when invoked from an installed copy of the package** — added an esbuild `onResolve` plugin in `compileFile` that rewrites any relative `*/src/index.js` (or `.ts`) import to the bare specifier `"terminaltui"`. Node's normal package resolution then finds the framework regardless of where the `.mjs` cache file ends up. Local dev (tsx mode) is unaffected — `compileFile` short-circuits in that mode and never runs esbuild.

---

## [1.8.0] - 2026-05-14

Launch-readiness release. Adds `npx terminaltui try` as a one-command pitch, ships two new bundled demos (`welcome`, `mac-monitor`), exposes `setTheme()` as a runtime helper, and fixes three bugs that surfaced while building the launch tour.

### Added

- **`npx terminaltui try`** — opens a 5-page guided tour of the framework (home, components showcase, themes picker, live data, get-started) in a Synthwave palette. Doubles as a smoke test for someone discovering the framework via README. Source under `demos/welcome/`.
- **`mac-monitor` demo** — bundled real-time macOS system monitor (CPU, memory, processes, network). Lives at `demos/mac-monitor/`; runs with `npx terminaltui dev demos/mac-monitor/site.config.ts`.
- **`setTheme(name)`** is now exported from the package root — call from a button's `onPress` to swap the active theme in-place. Returns `false` if the name isn't recognized; the runtime re-renders on success.
- **Code of Conduct, security policy, PR template** under `CODE_OF_CONDUCT.md`, `SECURITY.md`, `.github/PULL_REQUEST_TEMPLATE.md`.

### Fixed

- **`menu-builder` crashed when `metadata.label` was a function** — both `resolveMenuLabel` and the sort comparator assumed string labels, and parameterized routes that derive their menu label at runtime (`label: ({ params }) => …`) threw `a.label.localeCompare is not a function` on first render. Now type-checked + coerced with `String(...)` in the comparator.
- **`:theme tokyoNight` and `:theme rosePine` failed** — `executeCommand` lowercased the entire trimmed input before dispatch, so the camelCase argument never matched the theme registry key. Now splits verb from argument and only lowercases the verb. Added `test/test-commands.test.ts` (+11 assertions) to pin the behavior.
- **Number-key page jumps only worked from the home menu** — README claimed they worked from anywhere; `runtime-input.ts` had an `isHome()` guard that contradicted the docs. Guard removed.
- **`init` scaffolder hardcoded `^1.6.0`** — generated `package.json` files pinned the framework two versions behind. Now reads the framework's own version dynamically by walking up to the nearest `package.json`.

### Changed

- **README repositioned as "Next.js for the terminal"** — added comparison table vs Ink/Pastel/Bubble Tea, hero recording, test-count badge.
- Test count: 2,127 → 2,142 across 26 suites.

### Notes

- Memory: the build hosts a 2,400×1,500 GPU-encoded MP4 + 1,440×900 GIF + 1,600×1,000 social-share PNG under `assets/recordings/`. These are not shipped to npm consumers (not in the `files` array).

---

## [1.7.0] - 2026-05-01

Project-wide review pass. Two production-impacting bugs, multi-session SSH correctness, and a sweep of dead code from the 1.6.0 cleanup that didn't get fully removed.

### Fixed (production bugs)

- **`:theme` command crashed on use** — `runtime-pages.ts` used `require()` inside an ESM-only package; the first `:theme dracula` raised `ReferenceError: require is not defined`. Switched to a static import.
- **`requireEnv` and `rateLimit` middleware were silently bypassed** — `runMiddleware().catch()` fell through to `doNavigate`, so a thrown middleware (which is how both built-ins signal failure) rendered the page anyway. Throws now surface a `Blocked: <message>` feedback line and the navigation aborts.
- **Concurrent SSH sessions clobbered each other** — `_renderCallback`, `_navigateFn`, and `apiBaseUrl` were module-level globals; the most recent `runtime.start()` won, so older sessions' `state.set()` and `navigate()` calls hit the wrong runtime. Added `core/runtime-context.ts` with `AsyncLocalStorage`; helpers consult the active context first and fall back to the legacy global for tests / cross-package fetcher imports.
- **`createPersistentState()` leaked process listeners** — each call added three (`exit`/`SIGINT`/`SIGTERM`) handlers; SSH sessions or hot-reloads triggered `MaxListenersExceededWarning`. Now a single shared exit-flush handler is registered once.
- **`asyncContent` render storm** — the loading branch scheduled `setTimeout(rt.render, 100)` on every render, compounding to N²-style render bursts. One guarded spinner timer per runtime now.
- **`stringWidth` adopted unevenly** — `Timeline.ts`, `Divider.ts`, the inline accordion in `runtime-render.ts`, and `TextInput.ts` masking used `.length` (UTF-16 code units) where they needed display width or codepoint count. CJK and emoji rendered miscounted.
- **`ascii/image.ts` emitted raw 24-bit ANSI** — bypassed the 256-color fallback path, so colored ASCII images rendered as garbage in Apple Terminal. Added `fgColorRgb()` to `style/colors.ts`; image renderers route through it.

### Removed (breaking)

These were either internal-only by design or removed in 1.6.0 but the export survived:

- `componentRegistry`, `Component` (interface), `ComponentRegistry` class — the registry was decorative; `runtime-block-render.ts`'s switch was authoritative. Replaced internally with a `FOCUSABLE_TYPES` set.
- `ApiServer`, `setApiBaseUrl`, `FileRouter` — internal classes that should never have been part of the public surface.
- `dynamic(deps, render)` overload — `deps` was stored but never read. Single-arg API only.

### Changed

- **Test runner**: `test/run-all.ts` now globs `test-*.ts` and `**/*.test.ts` instead of an allowlist of 10 files. Default suite went from 1,469 to 2,127 passing assertions across 25 suites. `--stress`, `--demos`, and `--all` flags opt into the slower suites.
- **`terminaltui serve` single-file path removed** — `startSingleFileSession` deleted; running `serve` on a non-file-based project prints a clear error pointing at `terminaltui init`.
- **`compileFile` skips esbuild bundling under tsx/ts-node** — projects whose pages import the framework via relative paths no longer trip on native binaries (`ssh2`'s `.node` files). Bundle path also externalizes relative `src/index.js` imports for the rare projects that compile production builds.
- **`compileFile` cache key is sha1 of absolute path** instead of last-80-char tail. Eliminates the (theoretical) collision when two deeply nested projects share a path tail.
- **`box-model` is closer to the single source of truth it claimed to be** — `flex-engine.estimateBlockHeight` (card branch) now derives chrome from `COMPONENT_DEFAULTS`; `components/layout/Panel.ts` uses `computeBoxDimensions` instead of inline arithmetic with mislabeled variable names.

### Security hardening

- `exec` / `execSync` → `spawn` / `spawnSync` with array args in `helpers/open-url.ts`, `helpers/clipboard.ts`, and `core/ssh-server.ts` (host-key generation). No shell interpolation.
- `terminaltui art create <type> <name>` validates `name` against `/^[a-z0-9][a-z0-9_-]*$/i` (path-traversal guard).
- `api/server.ts` caps request bodies at 1 MB.

### Notes

- SSH `serve` keeps its allow-all default; password auth remains opt-in via `auth.passwords`.
- `ARCHITECTURE.md` rewritten to match the post-1.6.0 reality (removed `routing/` section, dropped `runSite` references, fixed the dependency graph, documented `runtime-context`).

### Removed dead files (no behavior change)

`src/core/renderer.ts` (Cell-diff renderer, 0 importers), `src/layout/engine.ts`, `src/layout/constraints.ts`, `src/ascii/fonts-extra.ts`, `src/cli/init-templates.ts`, `src/components/registry.ts`. Plus the matching test cleanup (5 stress harnesses + 9 directory-based tests + 3 manual harnesses, all of which targeted the single-file API removed in 1.6.0).

---

## [1.6.1] - 2026-04-28

### Fixed

- **`terminaltui init` now scaffolds the file-based shape** — every template was still emitting the pre-1.6.0 layout (`site.config.ts` with a `pages: [...]` array) using removed exports `defineSite`/`page`, plus `banner: ascii(...)` (a content block, not a banner spec). Running `npm run dev` on a fresh project failed immediately with `No config.ts found alongside a pages/ directory`. All six templates (minimal, portfolio, landing, restaurant, blog, creative) now emit `config.ts` with `defineConfig({...})` + `pages/<name>.ts` files exporting `metadata` and a default render function, matching the demo layout.
- **Typo'd template/theme names no longer fall back silently** — `init` now prints `'X' is not a known template — using 'minimal'` instead of accepting any string and quietly defaulting.

---

## [1.6.0] - 2026-04-28

### Removed (breaking)

- **Single-file `site.config.ts` mode** — `defineSite()`, `page()`, `route()`, `runSite()`, and the `terminaltui migrate` command are gone. The framework is now file-based only (`config.ts` + `pages/` + optional `api/`).
- **Layout `split()` and `box()`** — `split()` was redundant with `columns([panel, panel])`; `box()` was redundant with `panel({border, padding, content})`. Use the explicit forms.
- **Animation transitions** — `transition.ts`, `typing.ts`, `stagger.ts`, `fade.ts`, `effects.ts` (matrix rain / glitch / sparkle) deleted. The `transitions` field on `AnimationConfig` is gone. `boot` and `exitMessage` survive; spinner/engine survive.
- **ASCII community-pack public API** — `registerArtPack`, `useArtPack`, `listArt`, `getArtInfo`, `createArtPack`, `registerFont/Scene/Icon/Pattern` no longer exported. The internal art registry stays as plumbing for built-in assets.
- **`artCompose`** (overlay/mirror/rotate/colorize/shadow on string[] art) — niche, not used by demos. Gone.
- **`brailleSparkline`, `dotMatrix`, `braillePattern`** — exotic, deleted. Use `asciiArt.sparkline()` for sparklines.
- **Tetris demo** — broken since 1.0.5; removed (folder + gif + README reference).
- **`PanelFocusManager`** dead code (deprecated since 1.0.5).
- **`runPreview` CLI stub** — never implemented; deleted.
- **`src/routing/`** folder — `navigate()` moved into `src/router/`; route/middleware types moved to `router/types.ts` and `middleware/types.ts`.

### Changed

- Demo bundling dropped — demo sources ship in the npm package under `demos/<name>/` (config.ts + pages/) and are compiled on the fly by `npx terminaltui demo <name>`. No more `dist/demos/*.js` artifacts.
- Renamed `src/components/Box.ts` is unchanged (it's the rendering utility used by Card/Form/etc., not the deleted layout `box()`).
- `terminaltui dev` now requires `config.ts + pages/`; running it on a `site.config.ts` errors clearly instead of going through the deprecated path.

### Migration from 1.5.x

If you were using `defineSite`/`page`/`route`/`split`/`box`:
- Convert your project layout to `config.ts` + `pages/` (one file per page).
- Replace `split({direction: "horizontal", ratio: 30, first, second})` with `columns([panel({width: "30%", content: first}), panel({width: "70%", content: second})])`. Vertical splits become `rows(...)` with `height` instead of `width`.
- Replace `box({content, border, padding})` with `panel({content, border, padding})` (no title/scroll) or `container({content, padding})` (centered).

---

## [1.5.1] - 2026-04-10

### Fixed

- **SSH color mode detects client TERM** — reads `term` from the SSH pty request (e.g. `xterm-kitty` → truecolor, `xterm-256color` → 256, `vt100` → 16) instead of hardcoding 256 for all SSH sessions
- **openUrl() is a no-op in serve mode** — displays the URL as a notification instead of executing shell commands (`open`/`xdg-open`) on the server. Configurable via `serve.openUrls: true` in site config
- **Color mode is per-runtime** — each SSH session maintains its own color mode. Multi-user sessions no longer clobber each other's colors via the global singleton
- **Reset before erase-line prevents color bleed** — prepends `\x1b[0m` before each `\x1b[2K` so a missed reset on one line can't flood subsequent lines with background color
- **Easter egg functions disabled in serve mode** — function-valued easter egg commands are skipped over SSH to prevent unintended server-side execution
- **Primary button focus style is subtler** — focused primary buttons use bold border + bold accent text instead of a solid background fill that dominated the page

### Added

- **`serve` config in SiteConfig** — configure SSH hosting from `defineSite()` or `defineConfig()`: `port`, `hostKeyPath`, `maxConnections`, `colorMode`, `openUrls`, `auth`
- **`termType` on TerminalIO interface** — exposes the client's TERM string for color capability detection
- **`isServeMode` getter on TUIRuntime** — indicates whether the runtime is serving over SSH

---

## [1.5.0] - 2026-04-10

### Added

- **SSH Hosting (`terminaltui serve`)** — host any TUI app over SSH so users connect with `ssh host -p PORT`, zero install required. Each connection gets an independent session with full interactivity (navigation, forms, resize).
  - `--port <N>` flag (default: 2222)
  - `--host-key <path>` flag (auto-generates Ed25519 key on first run)
  - `--max-connections <N>` flag (default: 100)
  - Per-session `TerminalIO` abstraction — SSH channel used as I/O target
  - Session logging (connect/disconnect with client IP and active count)
- **`TerminalIO` interface** — abstracts terminal I/O away from `process.stdin`/`process.stdout`, enabling pluggable I/O targets (SSH channels, PTYs, custom streams)
- **`ProcessTerminalIO`** — default implementation wrapping `process.stdin`/`process.stdout` for local `dev` usage
- **`SSHServer` and `ServeOptions` exports** — programmatic API for embedding SSH hosting in custom setups

### Changed

- **`TUIRuntime` accepts optional `TerminalIO`** — constructor now takes an optional second argument for custom I/O. Defaults to `ProcessTerminalIO` for full backward compatibility.
- **`InputManager` and `Screen` use `TerminalIO`** — no longer hardcoded to `process.stdin`/`process.stdout`. Both accept a `TerminalIO` via `attachIO()`.
- **`writeToTerminal` uses `\r\n`** — fixes rendering over SSH where raw `\n` doesn't return cursor to column 1
- **SSH sessions use 256-color mode** — since the server can't detect the remote client's terminal capabilities, SSH sessions default to 256-color (safe for all terminals)
- **Process signals scoped to local sessions** — `SIGINT`/`SIGTERM` handlers and `process.exit()` only attach for `ProcessTerminalIO`, preventing a single SSH disconnect from killing the server
- **`ssh2` added as optional dependency** — only required for `terminaltui serve`. The `dev` command works without it.

---

## [1.4.0] - 2026-04-09

### Fixed

- **Single-file build produces functional bundles** — `terminaltui build` on `site.config.ts` now wraps the entry with `runSite()` so the published npm package actually starts the TUI (#1)
- **File-based routing build uses relative paths** — `_entry.ts` no longer hardcodes absolute filesystem paths; all imports are relative and resolved at bundle time (#2)
- **`compileFile()` throws clear errors** — when esbuild is unavailable outside dev mode, a descriptive error is thrown instead of silently returning a raw `.ts` path that Node.js can't import (#3)
- **`_entry.ts` cleaned up after build** — intermediate build artifacts are deleted from `dist/` after successful bundling, preventing them from being published to npm (#5)

### Added

- **`text()` content helper** — `import { text } from "terminaltui"` creates a plain text content block. Previously referenced in docs but not exported (#4)
- **Build validation** — after bundling, the build checks that the output contains a `runSite()` call and warns about any hardcoded absolute paths (#7)
- **Page Visibility documentation** — clear docs on how to hide pages from menus in both single-file and file-based routing modes (#8)
- **Banner config clarification** — docs now show both `ascii()` helper and plain object forms for the `banner` field (#9)

### Changed

- **Version jump from 1.0.9 to 1.4.0** — versions 1.1.0 through 1.3.0 were experimental publishes from a separate codebase and have been deprecated on npm. This release continues from the stable 1.0.x line (#6)

### Deprecated

- **npm versions 1.1.0–1.3.0** — these were experimental/incompatible releases. Use 1.4.0+ instead.

---

## [1.0.5] - 2026-03-26

### Added

- **Spatial Navigation Engine** — arrow keys now move to the nearest focusable item by screen position (like a TV remote / Android TV D-pad), replacing the old panel-based Tab cycling
  - `findNextFocus()` algorithm scores candidates by distance + alignment (2x weight on axis alignment)
  - Direction-filtered: only items in the arrow direction are candidates
  - ← from leftmost position goes back; automatic for all layout functions
  - New `computeFocusPositions()` in flex-engine walks the entire content tree and assigns FocusRect screen coordinates to every focusable item

- **12-Column Responsive Grid System** — Bootstrap-style layout primitives
  - `container(content, { maxWidth, padding, center })` — centered content wrapper
  - `row(cols, { gap })` — 12-column grid row with responsive column wrapping
  - `col(content, { span, offset, xs, sm, md, lg })` — grid column with breakpoint-aware spans
  - Responsive breakpoints: xs (<60 cols), sm (60-89), md (90-119), lg (≥120)
  - Rows auto-wrap when effective spans exceed 12 at the current breakpoint
  - Nesting support — rows inside cols inside rows

- **Unified Box Model** — single source of truth for component width calculation
  - `computeBoxDimensions(allocatedWidth, { border, padding, margin })` — every component calls this
  - `COMPONENT_DEFAULTS` — centralized padding/border/margin defaults for all 28+ components
  - Zero manual `width - N` math remaining in any component file

- **File-Based Routing** — Next.js App Router-style directory-based page routing
  - `config.ts` + `pages/` directory structure replaces single `site.config.ts` for larger projects
  - Page files: `export default function About() { return [...] }` with optional `export const metadata`
  - Layout files: `pages/layout.ts` wraps siblings/descendants, receives `{ children }`
  - Nested layouts compose from outside in (root → section → page)
  - Dynamic routes: `pages/projects/[slug].ts` receives `{ params: { slug } }`
  - Async pages: `export default async function Dashboard() { ... }`
  - File-based API routes: `api/stats.ts` exports `GET()`, `POST()`, etc.
  - Auto-generated menu from filesystem (ordering via `metadata.order`, labels via `metadata.label`)
  - Manual menu override in `defineConfig({ menu: { items: [...] } })`
  - New `menu({ source: "auto" })` component for inline auto-menu rendering
  - `MenuBlock` content type added to the block union
  - `FileRouter` class: scanner → route table → menu builder → page loader → layout chain
  - 9 router module files: types, scanner, route-table, menu-builder, page-loader, layout-chain, api-loader, resolver, index

- **`terminaltui migrate`** CLI command — converts existing `site.config.ts` to file-based routing structure (config.ts + pages/ + api/)

- **`defineConfig()` overload** — now accepts file-based routing config (`{ name, theme, menu, ... }`) in addition to the existing env-var schema

- **9 demos migrated to file-based routing** — each demo now has both `site.config.ts` (backward compat) and `config.ts` + `pages/` (new structure)

- **169 new router unit tests** across 8 test files (scanner, route-table, menu-builder, page-loader, layout-chain, api-loader, resolver, migrate) plus 1 integration test

- **204 demo navigation tests** — emulator-based tests for all 9 demos

- **103 box model tests** and **41 grid system tests**

### Changed

- **All 9 demos rebuilt with spatial layouts** — split, grid, row/col, container patterns throughout
  - developer-portfolio: row/col grid for skills, container for centered content
  - restaurant: tabs for menu, split for contact form, row/col for menu items
  - startup: row/col for features and pricing, accordion for quickstart
  - band: row/col for discography and press quotes, container for about
  - coffee-shop: tabs for menu, row/col for beans and hours
  - conference: tabs for schedule, row/col for speakers and sponsors
  - freelancer: row/col for services, work portfolio, and testimonials
  - dashboard: row/col for stat cards, split for posts
  - server-dashboard: row/col for resource cards, split for system info

- **Navigation model** — spatial navigation replaces Tab-based panel cycling on all layout pages; Tab still works as sequential fallback
  - ↑↓/jk move to nearest item above/below by screen position
  - ←→/hl move to nearest item left/right; ← from leftmost goes back

- **CLI `dev` command** auto-detects project type: file-based (`config.ts` + `pages/`) vs single-file (`site.config.ts`)

- **CLI `findConfig()`** now checks for `config.ts` + `pages/` before falling back to `site.config.ts`

### Fixed

- Card height equalization causing excessive whitespace in side-by-side layouts
- Border clipping at very narrow terminal widths (<10 cols)
- Search input dropdown filling entire viewport
- Focus prefix overflow causing content to exceed terminal width
- Percentage column overflow in layoutColumns
- Button ignoring ctx.width (labels now truncate to fit)
- Section/accordion/timeline content overflow beyond allocated width
- Responsive row wrapping not honoring breakpoints
- Emulator resize not triggering app re-render (SIGWINCH forwarding)
- Table cells missing right-padding in truncation

### Removed

- `PanelFocusManager` — no longer imported or used (file still exists as dead code); superseded by spatial navigation

### Breaking Changes

- **Navigation behavior change**: Arrow keys on layout pages now use spatial navigation instead of panel-based Tab cycling. The `panelArrows` config option still exists but has no effect. Users who relied on Tab to switch panels can still use Tab (sequential fallback), but arrow keys now move spatially.

## [1.0.4] - 2026-03-24

### Changed
- Modularized codebase: split runtime into runtime-input, runtime-pages, runtime-render, runtime-block-render, runtime-forms
- Lazy-load fonts (reduced startup time)
- Updated docs: component registry, fixed npm import paths, added ARCHITECTURE.md references

## [1.0.3] - 2026-03-24

### Added
- `terminaltui demo` command — run 8 built-in demos from npm
- Server dashboard demo with nested layouts

### Changed
- Rebuilt all 8 demos with split-pane layouts (columns, rows, split, grid)

## [1.0.2] - 2026-03-24

### Added
- Split-pane layouts: `columns()`, `rows()`, `split()`, `grid()`, `panel()`
- Panel focus management (Tab/Shift+Tab between panels)
- Active panel border indicator
- Responsive collapse for narrow terminals

## [1.0.1] - 2026-03-23

### Fixed
- 8 bugs found during full framework verification (P0-P3)
- Menu navigation now enforces middleware
- Lifecycle hooks fire on menu navigation
- Route function titles resolve correctly
- `computed()` auto-invalidates
- `section()` gives clear error on wrong args
- Viewport scrolls past last focusable item
- Emulator `goHome()` and `navigateTo()` fixes

## [1.0.0] - 2026-03-22

### Added
- Initial release: 21+ content blocks, 10 themes, ASCII art system, state management, data fetching, routing, middleware, API routes, forms, CLI, emulator, Claude integration
