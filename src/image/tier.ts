/**
 * Tier negotiation — which rendering technique an image actually uses.
 *
 * Pure and total: `(mode, capabilities, graphics) -> tier`, with no probing, no
 * escape bytes on the wire and no I/O. That matters more than it looks. Report
 * §6.1 documents that probing is actively dangerous on the primary target
 * (Apple Terminal echoes unknown OSC bodies to the screen) and that unsolicited
 * replies can be dispatched as keystrokes, so the cell tiers deliberately
 * resolve from `colorMode` + `TERM`/`termType` alone. The pixel tier needs a
 * verdict this module cannot reach on its own, so it is PASSED IN rather than
 * fetched: keeping `selectTier` a pure function of its arguments is what makes
 * it deterministic in tests and identical for two concurrent SSH sessions on
 * different terminals.
 *
 * The ladder is report §7.4, with the kitty pixel tier bolted on top. Its guard
 * clauses are evaluated most-restrictive first, so a capability set that trips
 * several rows resolves to the tier that can actually be drawn — a "none"
 * colour mode reaches ASCII even under tmux, where the half-block row would
 * otherwise have claimed it and emitted a grid of glyphs with every SGR
 * suppressed.
 *
 * TWO ESCAPE HATCHES, TWO JOBS. `TERMINALTUI_IMAGE` selects among the CELL
 * tiers and any non-neutral value ("off", "half", "ascii", …) pins one, which
 * necessarily defeats pixels — you cannot pin a glyph tier and also get a
 * bitmap. `TERMINALTUI_GRAPHICS` (owned by capability.ts) is the pixel switch:
 * `off` kills the kitty tier outright, `kitty` forces it on for a terminal we
 * mis-detect. Both must be able to defeat this tier, and both do — the first
 * here, the second inside `detectGraphics()` before its verdict ever arrives.
 */

import type { ImageCapabilities, ImageMode, ImageTier } from "./types.js";

/**
 * Environment variable that overrides negotiation entirely.
 *
 * Exported because capability.ts names it in the reason string it attaches to a
 * denied pixel verdict, and two spellings of the same variable is exactly the
 * drift this module's escape-hatch rules are trying to avoid.
 */
export const IMAGE_TIER_ENV = "TERMINALTUI_IMAGE";

/**
 * The one value that pins the cell PATH without pinning a tier inside it.
 *
 * `parseImageTierOverride` maps it to "auto" so the cell ladder still
 * negotiates, which means it cannot be distinguished from a neutral value by
 * that function's result alone — hence the named constant and the special case
 * in {@link imageEnvPinsCells}.
 */
const IMAGE_ENV_CELLS = "cells";

/**
 * The kitty graphics tier: real pixels, delivered as Unicode placeholder cells.
 *
 * Deliberately NOT a member of `ImageTier`. Every consumer of that union —
 * `subCellFactor`, `subCellGridSize`, `renderCells`, the glyph fitter — answers
 * a question about GLYPHS, and there is no honest answer for a tier that emits
 * none. Widening the union would have forced a fabricated sub-cell factor and a
 * dead `case` in three exhaustive switches. Instead the pixel tier is a
 * separate member of `RenderTier`, and `src/components/Image.ts` branches on it
 * BEFORE anything glyph-shaped is consulted.
 */
export const KITTY_TIER = "kitty";

/**
 * What negotiation can return: every cell tier, plus the pixel path.
 *
 * Cache keys are typed on this rather than `ImageTier` so a kitty entry and a
 * quadrant entry for the same image at the same size can never collide.
 */
export type RenderTier = ImageTier | typeof KITTY_TIER;

/**
 * The single fact about the terminal that cells cannot supply.
 *
 * Structurally a subset of `GraphicsCapability` from capability.ts, taken by
 * value rather than imported so this module keeps zero runtime dependencies and
 * stays trivially testable. Gate on `kittyPlaceholders`, never on `kitty`:
 * Konsole reports `kitty: true` with no placeholder support at all, and
 * emitting U+10EEEE cells there paints a grid of tofu.
 */
export interface GraphicsGate {
  kittyPlaceholders: boolean;
}

/** Every tier name, in descending fidelity order. Useful for validation and docs. */
const IMAGE_TIERS: readonly ImageTier[] = [
  "quadrant",
  "half",
  "solid",
  "shading",
  "ascii",
  "braille",
  "alt",
];

/** True when `value` names a rendering tier. */
function isImageTier(value: string): value is ImageTier {
  return (IMAGE_TIERS as readonly string[]).includes(value);
}

/**
 * TERM prefixes known to draw quadrants and half blocks correctly.
 *
 * Consulted ONLY for an explicitly supplied `termType`, i.e. the SSH pty-req
 * path, where report §7.4 makes "unrecognised remote TERM" a half-block
 * trigger. Under-detection is the safe direction here: iTerm2, WezTerm and
 * Ghostty all forward `xterm-256color` over SSH and land in this list anyway,
 * while a genuinely unknown remote gets the conservative tier.
 */
const RECOGNISED_TERM_PREFIXES = [
  "xterm",
  "rxvt",
  "alacritty",
  "kitty",
  "foot",
  "wezterm",
  "ghostty",
  "contour",
  "konsole",
  "vte",
  "iterm",
  "mintty",
  "st-",
  "ansi",
];

/** TERM values whose terminals we treat as multiplexed or glyph-poor. */
const CONSERVATIVE_TERM_PREFIXES = ["screen", "tmux"];

/**
 * Resolve the tier for one image block.
 *
 * Precedence: the `TERMINALTUI_IMAGE` escape hatch, then an explicit mode,
 * then the capability ladder. An explicit mode is honoured verbatim — that is
 * the whole point of pinning `mode` in a demo or a snapshot test, and a tier
 * that silently demoted on the author's machine would not be byte-stable.
 *
 * @param mode What the author asked for. "auto" negotiates.
 * @param caps The viewer's terminal capabilities.
 * @param graphics The pixel verdict from `detectGraphics()` /
 *   `getGraphicsCapability()`. Omitted (the default) means "cells only", which
 *   is why every existing caller keeps its exact behaviour and why the failure
 *   direction of a missing wire-up is a correct picture rather than escape
 *   bytes aimed at a terminal that cannot read them.
 */
export function selectTier(
  mode: ImageMode,
  caps: ImageCapabilities,
  graphics?: GraphicsGate,
): RenderTier {
  const override = imageTierOverride();
  const requested = override ?? mode;
  if (requested !== "auto") return requested;

  // Top of the ladder. Checked before every cell row because a terminal that
  // can draw pixels can also draw all of them — none of the guards below
  // describes a limitation the kitty protocol shares. Note this sits AFTER the
  // override/explicit-mode return above: `TERMINALTUI_IMAGE=off` and a block
  // that pins `mode: "half"` both mean "do not negotiate", and negotiating a
  // richer tier anyway would make those two knobs unusable for their one real
  // job — byte-stable output on a machine the author does not control.
  //
  // `imageEnvPinsCells()` is re-checked rather than assumed: the only value
  // that reaches this line with the variable set is "cells", which
  // `parseImageTierOverride` deliberately collapses to "auto" so the cell
  // ladder below still negotiates. Without this guard `TERMINALTUI_IMAGE=cells`
  // would return pixels on a kitty terminal, and this module's promise that a
  // non-neutral value defeats the pixel tier would hold only because
  // capability.ts happens to deny the gate first.
  if (graphics?.kittyPlaceholders === true && imageEnvPinsCells() === null) return KITTY_TIER;

  // No SGR is emitted at all in this mode, so every colour tier degenerates to
  // an empty rectangle. The ASCII ramp is the only one that carries
  // information without colour.
  if (caps.colorMode === "none") return "ascii";

  // Solid is the only tier that needs zero glyph coverage: a space plus a
  // background SGR. Report §5 measured Apple Terminal profiles carrying as
  // little as 1/16 block elements, so this is a real fallback, not a formality.
  if (!caps.unicode) return "solid";

  // NOTE: 16 colours used to return "shading" here, on the theory that a
  // foreground-only luminance ramp reads better than a false quadrant. Rendered
  // side by side through this renderer at the demo's own size, it does not: the
  // ramp carries ONE sample per cell where quadrant carries four, and the
  // quadrant image is a legible posterised photograph (grey nebula, black
  // pillars, cyan tips) where the ramp is a coarse smear. So 16 colours falls
  // through to the same ladder as everything else. The knob that mattered was
  // the DITHER, not the tier: `dither.ts` used to pick Floyd-Steinberg at 16
  // and that turned either tier into scattered coloured dots on black with no
  // identifiable content at all.

  // Multiplexers and unrecognised remotes: halves need only U+2580, which is
  // in every font that has block elements at all.
  if (caps.conservative) return "half";

  return "quadrant";
}

/**
 * Build the capability set the ladder consumes.
 *
 * `conservative` is the multiplexer / unknown-remote flag. Report §6.2 step 0
 * denylists `STY` and a `screen`/`tmux` TERM because a multiplexer cannot be
 * interrogated from inside, and §7.4 adds `TERM === "linux"` — the Linux VT
 * console draws CP437 half blocks but has no quadrants at all.
 *
 * @param colorMode The mode colour is actually emitted in. Structurally the
 *   same union as `ColorMode` in style/colors.ts; taken by value rather than
 *   imported so this module keeps zero runtime dependencies.
 * @param unicode Whether non-ASCII glyphs may be emitted.
 * @param termType The remote `TERM` from an SSH pty-req. Omit for a local run,
 *   where `process.env.TERM` is authoritative. NEVER pass the server's own
 *   TERM for a remote session (report §7.2).
 */
export function deriveCapabilities(
  colorMode: ImageCapabilities["colorMode"],
  unicode: boolean,
  termType?: string,
): ImageCapabilities {
  const env = process.env;
  const remote = termType !== undefined;
  const term = (remote ? termType : env.TERM ?? "").toLowerCase().trim();

  let conservative =
    // A multiplexer inherits and forwards its own TERM, so these env markers
    // are the only reliable signal when TERM has been rewritten.
    (!remote && (env.TMUX !== undefined || env.STY !== undefined)) ||
    CONSERVATIVE_TERM_PREFIXES.some(p => term.startsWith(p)) ||
    term === "linux";

  // Unrecognised remote TERM: we have no local env to cross-check against, so
  // fall back to the tier that needs the least from the far end.
  if (!conservative && remote && !RECOGNISED_TERM_PREFIXES.some(p => term.startsWith(p))) {
    conservative = true;
  }

  return { colorMode, unicode, conservative };
}

/**
 * Read the `TERMINALTUI_IMAGE` escape hatch.
 *
 * Exists for two audiences: a user on a terminal we mis-detect, and demo
 * snapshots that must be byte-stable across machines. It outranks an explicit
 * block mode precisely so that `TERMINALTUI_IMAGE=off` is an unconditional
 * kill switch (report §6.2 step 0 lists it in the hard denylist).
 *
 * Read on every call rather than memoised at load, so a test can set the
 * variable after import.
 */
function imageTierOverride(env: NodeJS.ProcessEnv = process.env): ImageMode | null {
  return parseImageTierOverride(env[IMAGE_TIER_ENV]);
}

/**
 * Parse one `TERMINALTUI_IMAGE` value. Returns null for anything unrecognised,
 * so a typo degrades to normal negotiation instead of disabling images.
 *
 * `"kitty"` is deliberately NOT a value here. This variable names the cell tier
 * to pin; the pixel path is switched by `TERMINALTUI_GRAPHICS`, which
 * capability.ts owns and which is the only knob that can also FORCE pixels on.
 * capability.ts mirrors the neutral list below in its `IMAGE_ENV_NEUTRAL`, so
 * any value that pins a tier here also denies graphics there — the two
 * variables cannot end up disagreeing about whether cells were requested.
 */
function parseImageTierOverride(raw: string | undefined): ImageMode | null {
  if (raw === undefined) return null;
  const value = raw.toLowerCase().trim();
  if (value === "") return null;

  // "off" means "never draw pixels", which is the alt-text box — not a blank
  // block. The reserved row count is unchanged either way.
  if (value === "off" || value === "none" || value === "0" || value === "false") return "alt";
  if (value === IMAGE_ENV_CELLS || value === "auto" || value === "on" || value === "1" || value === "true") {
    return "auto";
  }
  return isImageTier(value) ? value : null;
}

/**
 * Whether `TERMINALTUI_IMAGE` asks for the CELL path, which necessarily rules
 * pixels out. Returns the raw value (for a reason string), or null when the
 * variable is absent or neutral.
 *
 * THIS IS THE ONLY COPY OF THAT QUESTION. capability.ts used to answer it from
 * a mirrored list of neutral values, and the two had already drifted: an
 * unrecognised value such as `TERMINALTUI_IMAGE=quadrnat` was ignored here — as
 * documented on `parseImageTierOverride`, a typo must degrade to normal
 * negotiation — while capability.ts read it as a cell pin and silently switched
 * a kitty terminal back to glyphs. Both modules now call this.
 *
 * @param env Environment to read. Defaults to `process.env`.
 */
export function imageEnvPinsCells(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env[IMAGE_TIER_ENV];
  if (raw === undefined) return null;
  if (raw.toLowerCase().trim() === IMAGE_ENV_CELLS) return raw;
  const parsed = parseImageTierOverride(raw);
  // "auto" is the neutral answer; anything else names a glyph tier, and you
  // cannot pin a glyph tier and also get a bitmap.
  return parsed !== null && parsed !== "auto" ? raw : null;
}
