# Video

`video()` plays a moving picture in the terminal, through the same cell engine that draws [images](images.md) — the same tier ladder, the same resampler, the same glyph fitter.

```ts
import { video } from "terminaltui";

content: [
  video("./assets/trailer.mp4", { controls: true, alt: "Trailer" }),
]
```

**There is no video decoder at runtime.** The expensive half of the problem — demuxing, inter-frame decoding, and scaling the source raster down near its terminal display size — happens once, ahead of time, and what ships is a `.tvf` frame pack of small JPEGs. ffmpeg is needed to *pack* an mp4 and never to play one. A `.gif` needs nothing at all: the GIF decoder is pure TypeScript.

## Quick start

```ts
// pages/watch.ts
import { markdown, video } from "terminaltui";

export default function Watch() {
  return [
    markdown("### Trailer"),
    video("./assets/trailer.mp4", {
      fitPage: true,     // size to the rows the page has left
      controls: true,    // Space plays/pauses, ←/→ scrub
      border: true,
      poster: 12,        // frame shown while paused
    }),
  ];
}
```

The first time this page renders, the mp4 is packed in the background and the block shows its alt box; when the pack lands the page repaints with the picture. The pack is cached in `.terminaltui/video/`, so it happens once.

To do the packing up front instead — which is what you want for anything you ship:

```bash
terminaltui video pack assets/trailer.mp4 -o assets/trailer.tvf
terminaltui video info assets/trailer.tvf
```

then point the block at the `.tvf`.

## Options

Everything `image()` takes, plus the transport:

| Option | Default | Meaning |
|---|---|---|
| `width` / `height` | fill available | Size in terminal **cells**. Aspect is preserved unless `fit: "fill"`. |
| `maxHeight` | — | Hard cap on derived rows. |
| `fit` | `"contain"` | `contain` never letterboxes — the block just gets smaller. |
| `align` | `"center"` | Horizontal placement in the block's allocation. |
| `mode` | `"auto"` | Force a tier. `auto` negotiates the ladder. |
| `border` | `false` | `true` for the site style, or a style name. Added **outside** `width`. |
| `fitPage` | `false` | Size to the rows the page has left. See [images](images.md). |
| `fps` | pack's rate | Presentation rate. **Clamped to the pack** — see below. |
| `loop` | `true` | Restart at the end. |
| `autoplay` | **`false`** | Start on its own. See below. |
| `poster` | `0` | Frame index shown while idle or paused. |
| `controls` | `false` | Transport row + a focus slot. Space, ←/→. |

### `autoplay` defaults to false, on purpose

A page that starts moving the moment it is opened can never be screenshotted, and never lets a test harness decide the screen has settled — `waitForIdle` settles by observing that the screen *stopped changing*. Set `autoplay: true` deliberately, and prefer `controls: true` so the viewer can stop it.

### `fps` can only slow playback down

Asking a 12 fps pack for 60 fps does not invent frames; it would present each one five times, which is five times the bandwidth for the same picture. Pack at a higher rate if you want a higher rate:

```bash
terminaltui video pack clip.mp4 --fps 24
```

## Sources

| Extension | Needs | Notes |
|---|---|---|
| `.tvf` | nothing | Already a pack. Opened directly. |
| `.gif` | nothing | Decoded and packed in pure TypeScript, including per-frame delays. |
| `.mp4` `.mov` `.webm` `.mkv` | ffmpeg, at pack time | Packed in a background process; the block shows its alt box until it lands. |
| `http(s)://…` | — | Cannot be opened synchronously. Download and pack it. |

If ffmpeg is missing, an mp4 renders its alt box with the install command in the reason — and GIF sources keep working, because that path never touches ffmpeg.

## `terminaltui video`

```
terminaltui video pack <source> [options]   build a .tvf frame pack
terminaltui video info <pack.tvf>           describe an existing pack

  -o, --out <path>     output path (default: alongside the source)
  --width <px>         max frame width; height follows the aspect (default 960)
  --fps <n>            frames per second (default 12)
  --quality <2-31>     JPEG quality, lower is better (default 5)
  --start <seconds>    seek into the source before packing
  --duration <seconds> how much of the source to take
```

**Why 960 px by default, and why it is a ceiling.** `--width` never *enlarges* a source: a 320 px GIF stays 320 px, because upscaling adds bytes and no detail.

The number matters more than it looks. The quadrant tier samples two sub-pixels per cell horizontally, so a block `N` cells wide needs `2N` pixels just to reach 1:1 — and at 1:1 nothing averages the JPEG's 8x8 DCT blocks away, so each one lands as a 4x4 block of *cells* and the picture reads as visibly blocky. You want roughly 2x that, i.e. `4N` pixels.

`fitPage` blocks are composed against the **whole terminal**, not the 99-column content column, so on a 240-column window `N` is 240 and you want ~960 px. That is where the default comes from. A small, fixed-width block needs far less — pack it smaller and save the bytes.

## Pixels on kitty, cells everywhere else

On kitty and Ghostty a playing video is transmitted as **real pixels**, one image per frame, placed with the same Unicode placeholder cells the still-image path uses. Everywhere else — Apple Terminal, tmux, SSH to an unknown client — it is drawn as coloured cells.

Both paths produce **exactly the same number of rows**, so a terminal that gains or loses pixel support does not reflow the page.

Direct pixel payloads use kitty's level-1 zlib transport when it saves at least 12.5%; tiny or incompressible frames stay on the valid raw path. The bandwidth is real and worth knowing. Measured on the bundled cinema clip:

```
kitty pixels, 848x352 frame     437 KiB      5.12 MiB/s at 12 fps
quadrant cells, full width       52 KiB      0.61 MiB/s at 12 fps
```

That is about 8x the bytes for a picture that is not made of block glyphs. A local pty absorbs it; an SSH link may not. If playback stutters, force the cell path:

```ts
video("clip.tvf", { mode: "quadrant" })   // per block
```
```bash
TERMINALTUI_GRAPHICS=off                  # whole session
```

A pinned `mode` never transmits, which also keeps snapshot tests byte-stable.

**What this is NOT.** An earlier version of this engine drew video as cells on every terminal, on the grounds that pixels cost 37–44 MiB/s. That number was measured against the *still-image* path, which resamples a source UP to `cols*10 x rows*20` before transmitting — 2000x1120, 11.4 MB a frame, for a 200-cell block. A video frame needs none of that: kitty's `s`/`v` (source size) are independent of `c`/`r` (cell footprint), so the pack frame goes out at its native size and the terminal scales it. Native-sized transmission cut the original estimate substantially; zlib cuts the measured wire cost by roughly another two thirds.

A fresh image id is allocated every frame, because re-transmitting onto a live id is unspecified (kitty issue #8701). The runtime's existing departure sweep deletes the previous one, so this costs a ~26-byte delete per frame and no new lifecycle. The id space lasts 105 hours of continuous 24 fps playback.

## The frame budget

At 24 fps a frame gets 41.6 ms. Measured, on an M4 Max, for a full-width block:

```
JPEG decode            0.6 ms
resample to sub-cells  0.2 ms
fit glyphs + colours   0.5 ms
compose and write      0.8 ms
------------------------------
total                  2.1 ms      5% of the budget
```

That table is the portable coloured-cell path. On the bundled 848x352 clip, the Kitty transmit encoder — RGB conversion, zlib, base64 and chunk framing — averages 5.44 ms per frame, still inside a 24fps frame budget.

CPU is not the limit — the wire is. The ceiling is how much escape-sequence traffic the terminal's parser will swallow, which is why the pack default is 12 fps.

## Tearing

Rows are emitted one cursor-position at a time, so a terminal is free to repaint between any two of them. On a picture where every row changes every frame, that shows up as a horizontal tear.

While a video is playing, the framework brackets each batch in **synchronized output** (DEC private mode 2026), which tells the terminal to buffer the whole batch and swap it atomically. kitty, Ghostty, WezTerm and iTerm2 honour it. Apple Terminal does not implement it and ignores the sequence, so a full-width video there can still tear — a smaller block, or a lower `fps`, reduces it.

The brackets are emitted **only while something is moving**, so a page with no video produces byte-identical output to a build without this feature.

## `TERMINALTUI_VIDEO`

`off` (or `none`/`0`/`false`) freezes every video on its poster — not just autoplay, but `play()` and the transport too, because a guarantee a keypress can revoke is not one.

The bundled PTY emulator sets it for every app it launches, so a demo page containing a video cannot hang a test suite. Opt back in per-launch when you are testing playback itself:

```ts
const emu = await TUIEmulator.launch({
  command: "tsx run.ts",
  env: { TERMINALTUI_VIDEO: "on" },
});
```

and assert motion by polling for distinct screens — never with `waitForIdle`, which cannot settle against something that is deliberately still changing.

## Testing a page with video

```ts
// The picture moved.
const seen = new Set<string>();
const until = Date.now() + 1500;
while (Date.now() < until) {
  seen.add(emu.screen.ansi());
  await new Promise(r => setTimeout(r, 40));
}
assert(seen.size >= 4);
```

`ansi()` rather than `text()`: the picture is drawn with spaces and quadrant glyphs whose identity is carried almost entirely by colour, so two completely different frames have nearly identical plain text.

## Demo

```bash
npx tsx src/cli/index.ts dev demos/cinema/config.ts
```

Sintel © Blender Foundation, [durian.blender.org](https://durian.blender.org), CC-BY 3.0.
