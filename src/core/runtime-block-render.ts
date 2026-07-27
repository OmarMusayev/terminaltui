/**
 * Individual block rendering — the big switch statement that maps
 * block types to component renderers.
 */
import type { ContentBlock, DynamicBlock, ImageBlock, VideoBlock, ColumnsBlock, RowsBlock, GridBlock, PanelBlock, RowBlock, ContainerBlock, MenuBlock, ChatBlock } from "../config/types.js";
import { renderChat, type ChatState, type ChatMessage } from "../components/Chat.js";
import { fgColor, reset, bold } from "../style/colors.js";
import { computeBoxDimensions, COMPONENT_DEFAULTS } from "../layout/box-model.js";
import { isBlockFocusable as isTypeFocusable, FOCUSABLE_TYPES } from "./block-taxonomy.js";
import { containsBlock, stampBlockKeys, walk, ALL_EDGES } from "./block-walker.js";
import {
  framedImageBlock, frameHintRows, isPageFitImage, isResizableImage,
  type FrameLimits, type PageFitGrant,
} from "../image/frame.js";
import { renderText } from "../components/Text.js";
import { renderCard } from "../components/Card.js";
import { renderTimeline } from "../components/Timeline.js";
import { renderProgressBar } from "../components/ProgressBar.js";
import { renderTable } from "../components/Table.js";
import { renderLink } from "../components/Link.js";
import { renderDivider } from "../components/Divider.js";
import { renderSpacer } from "../components/Spacer.js";
import { renderQuote } from "../components/Quote.js";
import { renderBadge } from "../components/Badge.js";
import { renderHero } from "../components/Hero.js";
import { renderList } from "../components/List.js";
import { renderImage, imageCellSize } from "../components/Image.js";
import { renderVideo } from "../components/Video.js";
import { renderAccordion } from "../components/Accordion.js";
import { renderTabs } from "../components/Tabs.js";
import { renderGallery } from "../components/Gallery.js";
import { renderTextInput } from "../components/TextInput.js";
import { renderTextArea } from "../components/TextArea.js";
import { renderSelect } from "../components/Select.js";
import { renderCheckbox } from "../components/Checkbox.js";
import { renderToggle } from "../components/Toggle.js";
import { renderRadioGroup } from "../components/RadioGroup.js";
import { renderNumberInput } from "../components/NumberInput.js";
import { renderSearchInput, filterSearchItems } from "../components/SearchInput.js";
import { renderButton } from "../components/Button.js";
import { renderFormResult } from "../components/Form.js";
import { renderMenu as renderMenuComponent, type MenuItem } from "../components/Menu.js";
import { stringWidth, stripAnsi, type RenderContext } from "../components/base.js";
import { renderColumns, mergeRects } from "../components/layout/Columns.js";
import { rowColsToPanels, getBreakpoint, getEffectiveSpan } from "../layout/grid-system.js";
import { layoutColumns } from "../layout/panel-layout.js";
import { renderRows } from "../components/layout/Rows.js";
import { renderGrid } from "../components/layout/Grid.js";
import { renderPanel } from "../components/layout/Panel.js";
import type { RuntimeInternal } from "./runtime-internal.js";
import { layoutAvailHeight, viewportHeight } from "./layout-constants.js";

/**
 * Whether a block draws the focus indicator.
 *
 * Widens the type-keyed taxonomy predicate with the one case it cannot express:
 * an image is focusable only when it opted in with `resizable`. runtime-render
 * imports the name from HERE (not from block-taxonomy), so the ▌ gutter follows
 * focus onto a resizable image without block-taxonomy needing to know that an
 * OPTION can confer focusability.
 */
export function isBlockFocusable(block: ContentBlock): boolean {
  return isTypeFocusable(block) || isResizableImage(block) || isControlledVideo(block);
}

/**
 * A video is focusable only when it asked for a transport.
 *
 * Same opt-in as `image.resizable`, for the same reason: focusability is
 * otherwise decided by block TYPE, so making every video focusable would
 * insert a slot into every page that shows one and shift every focus index
 * below it.
 */
export function isControlledVideo(block: ContentBlock): block is VideoBlock {
  return block.type === "video" && block.controls === true;
}

/**
 * Legacy label-derived signature for components whose UI state is keyed via
 * getBlockKey (tabState/accordionState/galleryState/buttonLoading). Mirrors
 * the legacy-key lambdas at the getBlockKey call sites. Returns null for
 * types that carry no keyed UI state.
 */
function dynStateSignature(block: ContentBlock): string | null {
  switch (block.type) {
    case "tabs":
    case "accordion":
      return block.items.map((i) => i.label).join(",");
    case "gallery":
      return JSON.stringify(block.items.map((i) => i.title));
    case "button":
      return block.label;
    // Only a RESIZABLE image carries keyed state (its frame width). A plain
    // image is left with its structural path so nothing else re-keys.
    case "image":
      return block.resizable === true ? block.path : null;
    default:
      return null;
  }
}

// ─── Resizable image frames ───────────────────────────────

/**
 * Frame widths the viewer has chosen, per runtime, keyed exactly like
 * `rt.accordionState` — `rt.getBlockKey(block, legacy)`, i.e. the structural
 * path stamped by `stampBlockKeys` with a label-derived fallback.
 *
 * The MAP ITSELF hangs off a WeakMap instead of being a field on
 * `RuntimeInternal` alongside `accordionState`/`tabState`, which is where it
 * belongs and where a follow-up should move it. That is a file-ownership
 * constraint, not a design one: `runtime.ts` and `runtime-internal.ts` are
 * being edited in parallel by other work. The semantics are identical — one
 * store per TUIRuntime, so two concurrent SSH sessions cannot see each other's
 * frame sizes — and the entries die with the runtime.
 */
const FRAME_WIDTHS = new WeakMap<RuntimeInternal, Map<string, number>>();

/** This runtime's frame-width store, created on first use. */
export function imageFrameWidths(rt: RuntimeInternal): Map<string, number> {
  let store = FRAME_WIDTHS.get(rt);
  if (store === undefined) {
    store = new Map<string, number>();
    FRAME_WIDTHS.set(rt, store);
  }
  return store;
}

/**
 * What the RENDERER last managed to draw for a block, and the space it had.
 *
 * The input handler has no `RenderContext`, so it used to step the stored width
 * against the PAGE's content width. For an image inside a narrow pane the two
 * ceilings differ by the whole width of the surrounding chrome, and every press
 * in the gap moved the stored number without moving a pixel: measured at 17
 * dead `+` presses and then 17 dead `-` presses for a 20-cell image in a
 * 30-column panel, with "Frame at maximum size" only firing at the PAGE ceiling
 * — so the key looked broken. Recording the achieved geometry here costs
 * nothing (the renderer has already computed it for the hint row) and lets the
 * handler step from a number the renderer honoured.
 */
const FRAME_RENDERED = new WeakMap<RuntimeInternal, Map<string, RenderedFrame>>();

/** The last geometry a resizable frame actually rendered at. */
export interface RenderedFrame {
  /** Image-area columns geometry produced. */
  cols: number;
  /** The allocation those columns were clamped against. */
  limits: FrameLimits;
}

/** Record what the renderer drew for this block. */
function rememberFrameCols(
  rt: RuntimeInternal,
  block: ImageBlock,
  cols: number,
  limits: FrameLimits,
): void {
  let store = FRAME_RENDERED.get(rt);
  if (store === undefined) {
    store = new Map<string, RenderedFrame>();
    FRAME_RENDERED.set(rt, store);
  }
  store.set(imageFrameKey(rt, block), { cols, limits });
}

/**
 * The geometry this block last rendered at, or undefined before its first
 * frame — in which case the caller falls back to the page-level budget, which
 * is the only thing it can know.
 */
export function lastRenderedFrame(rt: RuntimeInternal, block: ImageBlock): RenderedFrame | undefined {
  return FRAME_RENDERED.get(rt)?.get(imageFrameKey(rt, block));
}

/**
 * State key for an image block. The legacy fallback is the source path, which
 * is what `dynStateSignature` above uses for the same blocks — two images of
 * the same file in one unstamped tree share a frame, exactly as two same-label
 * accordions did before path stamping.
 */
export function imageFrameKey(rt: RuntimeInternal, block: ImageBlock): string {
  return rt.getBlockKey(block, () => `image:${block.path}`);
}

/** The viewer's frame width for this block, or undefined for "as declared". */
export function imageFrameWidth(rt: RuntimeInternal, block: ImageBlock): number | undefined {
  return imageFrameWidths(rt).get(imageFrameKey(rt, block));
}

// ─── Video ────────────────────────────────────────────────

/**
 * Monotonic render counter, per runtime.
 *
 * The video scheduler infers that a block has left the tree by noticing that
 * the renderer stopped stamping its player — there is no per-block teardown
 * hook anywhere in this framework. The counter has to advance once per render
 * PASS rather than once per video block, or two videos on one page would each
 * see the other's stamps as their own progress.
 */
const RENDER_SEQ = new WeakMap<RuntimeInternal, number>();

export function videoRenderSeq(rt: RuntimeInternal): number {
  return RENDER_SEQ.get(rt) ?? 0;
}

export function bumpVideoRenderSeq(rt: RuntimeInternal): number {
  const next = videoRenderSeq(rt) + 1;
  RENDER_SEQ.set(rt, next);
  return next;
}

/** State key for a video block. Same shape as {@link imageFrameKey}. */
export function videoBlockKey(rt: RuntimeInternal, block: VideoBlock): string {
  return rt.getBlockKey(block, () => `video:${block.path}`);
}

function renderVideoBlock(rt: RuntimeInternal, block: VideoBlock, ctx: RenderContext): string[] {
  // Focus is identified by BLOCK IDENTITY, the same way the resizable-image
  // handler does it — the focus item holds the block object itself, so this
  // needs no second key and cannot disagree with the input handler.
  const focusedItem = rt.pageFocusItems[rt.pageFocusIndex];
  const focused = focusedItem?.kind === "block" && focusedItem.block === block;
  return renderVideo(block, ctx, {
    rt,
    blockKey: videoBlockKey(rt, block),
    pageId: rt.router.currentPage,
    renderSeq: videoRenderSeq(rt),
    projectDir: projectDirOf(rt),
    maxCols: pageFitCeiling(block, ctx),
    focused,
  });
}

// ─── Page-fit image budgets ───────────────────────────────

/**
 * What the page GRANTED each `fitPage` image, per runtime.
 *
 * The renderer is the only thing that can compute the row half — the leftover is
 * `viewport - (rows every other block actually drew)`, and only the render loop
 * has drawn them. But the layout estimator has to size the same image to the
 * same row count or every FocusRect below it lands wrong, and it runs BEFORE
 * composition and cannot render anything. So the renderer publishes what it
 * granted and the estimator reads it back — the same escape hatch, for the same
 * reason, as FRAME_RENDERED above.
 *
 * The column half rides along for a related but distinct reason: a page-fit
 * image is composed against the whole terminal (`pageFitWidth`) while the
 * estimator's walk is seeded with the content column, so the estimator cannot
 * derive it either. See {@link PageFitGrant}.
 *
 * Per runtime, not per block object, and keyed by `imageFrameKey` so the entry
 * follows the block's structural path: two SSH sessions at different terminal
 * heights must not fight over one number.
 *
 * Only the page loop ever writes here, which is what keeps the estimator honest
 * about the places `fitPage` is inert. An image inside a panel (or a container,
 * or a tab body) is composed by its own container and never granted anything, so
 * the estimator reads `undefined` for it and measures it exactly as it does
 * today.
 */
const PAGE_FIT_GRANTS = new WeakMap<RuntimeInternal, Map<string, PageFitGrant>>();

/** What the page last granted this image, or undefined before its first frame. */
export function pageFitGrant(
  rt: RuntimeInternal,
  block: ImageBlock | VideoBlock,
): PageFitGrant | undefined {
  return PAGE_FIT_GRANTS.get(rt)?.get(mediaFitKey(rt, block));
}

/**
 * Grant key for either medium.
 *
 * The two key functions are separate because their legacy fallbacks differ
 * (`image:<path>` vs `video:<path>`), and a page holding an image and a video
 * of the same path must not have them share a grant.
 */
export function mediaFitKey(rt: RuntimeInternal, block: ImageBlock | VideoBlock): string {
  return block.type === "video" ? videoBlockKey(rt, block) : imageFrameKey(rt, block);
}

/**
 * Record the page's grant.
 *
 * @returns true when either number CHANGED — i.e. the rects the estimator
 *   already computed this frame describe a different image and the walk must be
 *   redone. False on every steady-state frame, so the re-walk costs nothing once
 *   the budget has converged.
 */
export function setPageFitGrant(
  rt: RuntimeInternal,
  block: ImageBlock | VideoBlock,
  grant: PageFitGrant,
): boolean {
  let store = PAGE_FIT_GRANTS.get(rt);
  if (store === undefined) {
    store = new Map<string, PageFitGrant>();
    PAGE_FIT_GRANTS.set(rt, store);
  }
  const key = mediaFitKey(rt, block);
  const prev = store.get(key);
  if (prev !== undefined && prev.rows === grant.rows && prev.cols === grant.cols) return false;
  store.set(key, grant);
  return true;
}

/**
 * The space a frame may occupy, as the RENDERER sees it.
 *
 * `flex-engine`'s walk computes the same thing as `panelHeight ?? availHeight`,
 * and `computeFocusLayout` seeds that walk with `layoutAvailHeight(rows)` — the
 * expression below. The two therefore cap the frame at the same row, which is
 * what keeps the reserved height and the drawn height equal.
 */
/**
 * Column ceiling for a block, or undefined for "the standard 99".
 *
 * Only a `fitPage` image gets one, and it is simply its own allocation — the
 * page hands it `pageFitWidth(columns)` and nothing narrower should apply. Every
 * other block, including a `fitPage` image nested somewhere the page never
 * composed (a panel, a tab body), gets `undefined` and keeps the content-column
 * ceiling it has always had. Note that even for those the answer would be inert:
 * geometry clamps columns to `availWidth - border` first, and inside a container
 * that is already below 99.
 *
 * The estimator must apply the SAME ceiling — it does, from `PageFitGrant.cols`,
 * which is this same number recorded by the page loop.
 */
export function pageFitCeiling(
  block: ImageBlock | VideoBlock,
  ctx: RenderContext,
): number | undefined {
  return isPageFitImage(block) ? Math.max(1, Math.floor(ctx.width)) : undefined;
}

export function frameLimitsOf(rt: RuntimeInternal, width: number, panelHeight?: number): FrameLimits {
  return {
    availWidth: width,
    availRows: panelHeight ?? layoutAvailHeight(rt.screenSize.rows),
  };
}

/**
 * Render an image, applying the viewer's frame size and appending the hint row.
 *
 * A non-resizable image takes the early return and is byte-identical to what it
 * rendered before this feature existed.
 */
function renderImageBlock(rt: RuntimeInternal, block: ImageBlock, ctx: RenderContext): string[] {
  const root = projectDirOf(rt);
  // A page-fit image is sized by whoever allocated its slot, so its slot is its
  // only ceiling — `pageFitCeiling` is the identity on every other block, and on
  // this one it lifts the 99-column content-column cap that otherwise stopped
  // the picture growing long before the granted rows ran out.
  if (!isResizableImage(block)) return renderImage(block, ctx, root, pageFitCeiling(block, ctx));

  const limits = frameLimitsOf(rt, ctx.width, ctx.panelHeight);
  const sized = framedImageBlock(block, imageFrameWidth(rt, block), limits);
  const geom = imageCellSize(sized, ctx.width, ctx.panelHeight, root);
  // Remember what geometry ACTUALLY produced, so the input handler steps from a
  // width the renderer honoured. It has no RenderContext and used to step
  // against the PAGE's content width, which for an image inside a 24-column
  // pane ran 17 presses ahead of the picture with no feedback at all.
  rememberFrameCols(rt, block, geom.cols, limits);
  // A new array rather than a push onto the returned one: `renderImage` composes
  // a fresh array today, but its L2 cache hands out a SHARED `string[]` one
  // frame earlier in the same call chain, and appending to a cached array would
  // grow it by a row every frame. Copying costs one allocation per resizable
  // image per frame and cannot be wrong.
  //
  // The hint rows come from `frameHintRows()`, the same function `flex-engine`
  // charges the block for. The renderer used to append one literal row and the
  // estimator to add the constant, so the two agreed only by the coincidence
  // that both equalled 1; setting FRAME_HINT_ROWS to 2 produced an immediate
  // 6-versus-7 disagreement, which puts every FocusRect below the image at the
  // wrong Y.
  const rows = [...renderImage(sized, ctx, root)];
  const hintRows = frameHintRows(block);
  // A frame is clamped to the visible rows, so on a short terminal it renders
  // NARROWER than the author declared and `+` is inert from the first press.
  // Saying so beats printing a bare number that contradicts the page's own copy
  // and leaving the viewer to conclude the key is broken.
  const wanted = sized.width;
  const capped = typeof wanted === "number" && Number.isFinite(wanted) && geom.cols < Math.floor(wanted);
  for (let i = 0; i < hintRows; i++) {
    rows.push(frameHint(geom, sized.align ?? "center", ctx, i, capped));
  }
  return rows;
}

/**
 * The affordance row under a resizable frame.
 *
 * Always emitted (see FRAME_HINT_ROWS): a hint that appeared only on focus
 * would make the block's height depend on focus, which `flex-engine` cannot
 * see. Focus changes its CONTENT, never its row count.
 *
 * CONTRAST. The keys used to be painted `theme.subtle` plus SGR `dim`, which
 * measured 1.36:1 against the page background off a real capture — against a
 * WCAG floor of 4.5:1 — so the one statement of which keys do anything was
 * invisible at normal screen brightness, in the FOCUSED state, which is the
 * moment the row exists to speak. `theme.muted` with no `dim` is roughly four
 * times the luminance ratio, and the resting row keeps the word "resizable"
 * readable because that is the feature's only discovery surface.
 *
 * WIDTH. Every other row `renderImage` returns is exactly `blockCols` wide by
 * construction; this is the one that could exceed its slot, and inside a
 * bordered panel the overflow was not merely clipped — `Panel.ts` truncates the
 * composed row and the character it ate was the panel's own right border. So
 * the text degrades through progressively shorter forms and the row count stays
 * 1 in every branch, because flex-engine charges for it unconditionally.
 *
 * @param index Which hint row this is. Only row 0 has content today; the
 *   parameter exists so FRAME_HINT_ROWS can grow without the renderer and the
 *   estimator disagreeing again.
 */
function frameHint(
  geom: { cols: number; rows: number; blockCols: number },
  align: "left" | "center" | "right",
  ctx: RenderContext,
  index: number,
  capped: boolean,
): string {
  const width = Math.max(0, Math.floor(ctx.width));
  if (index > 0 || width <= 0) return reset;

  // Indent to the picture's own left edge. The image is centred in the content
  // column while the hint started at column 0, so on a wide terminal the keys
  // floated hundreds of pixels to the left of the thing they describe.
  const slack = Math.max(0, width - geom.blockCols);
  const indent = align === "left" ? 0 : align === "right" ? slack : slack >> 1;

  const size = `${geom.cols}x${geom.rows}`;
  const lead = fgColor(ctx.focused ? ctx.theme.accent : ctx.theme.muted);
  const keys = fgColor(ctx.theme.muted);
  // Widest form that fits, longest first. Measured with `stringWidth`, never
  // `.length`: `↔` is East Asian Ambiguous and doubles under a CJK locale, and
  // this is the one row whose overflow eats a panel border.
  const tails = ctx.focused
    ? capped
      ? ["  fits window   +/- resize", "  fits window", "  +/-"]
      : ["   +/- resize   0 reset", "  +/-"]
    : capped
      ? ["  resizable, fits window", "  resizable"]
      : ["  resizable"];
  const forms: Array<[string, string]> = [
    ...tails.map(t => [`↔ ${size}`, t] as [string, string]),
    [`↔ ${size}`, ""],
    ["↔", ""],
  ];
  for (const [head, tail] of forms) {
    if (indent + stringWidth(head) + stringWidth(tail) <= width) {
      return " ".repeat(indent) + lead + head + (tail ? keys + tail : "") + reset;
    }
  }
  return reset;
}

/** Resolve a dynamic block's children using cache for stable object references. */
export function resolveDynamic(rt: RuntimeInternal, block: DynamicBlock): ContentBlock[] {
  const id = block._dynamicId ?? "";
  const cached = rt.dynamicCache.get(id);
  if (cached) return cached;
  let blocks: ContentBlock[];
  try {
    const result = block.render();
    blocks = Array.isArray(result) ? result : [result];
  } catch (err) {
    // Surface user render() errors instead of silently rendering nothing.
    const msg = err instanceof Error ? err.message : String(err);
    blocks = [{ type: "text", content: `[dynamic block error: ${msg}]`, style: "plain" }];
  }
  // Errors are cached like normal results so a throwing render() re-evaluates
  // on the next state change instead of re-throwing every frame.
  if (id) rt.dynamicCache.set(id, blocks);
  // Stamp regenerated children under the parent's structural path — paths
  // are deterministic across regenerations of a shape-stable tree, so
  // path-keyed state survives per-frame re-rendering. Optional-chained:
  // partial test stubs and unstamped parents degrade to the legacy label keys.
  const parentKey = rt.blockKeys?.get(block);
  if (parentKey) {
    const sep = parentKey.indexOf("#");
    stampBlockKeys(rt, parentKey.slice(0, sep), blocks, `${parentKey.slice(sep + 1)}/dyn`);
    // Structural paths are index-based, but a dynamic() regeneration may
    // legally change shape (a conditional sibling appearing, a list item
    // inserted above) — shifting every index below the change and silently
    // resetting path-keyed component state mid-session. Overwrite the keys
    // of stateful components with shape-tolerant ones: scoped to this
    // dynamic block's own key for cross-page uniqueness, label-derived
    // within the subtree (like the legacy keys) so index shifts don't reset
    // state. Same-signature duplicates inside one dynamic subtree share
    // state — the legacy keys shared them globally, so this is still
    // strictly tighter.
    for (const e of walk(blocks, { descend: ALL_EDGES })) {
      const sig = dynStateSignature(e.block);
      if (sig !== null) {
        rt.blockKeys.set(e.block, `${parentKey}/dyn:${e.block.type}:${sig}`);
      }
    }
  }
  return blocks;
}

/** Invalidate dynamic cache so next render re-evaluates. */
export function invalidateDynamicCache(rt: RuntimeInternal): void {
  rt.dynamicCache.clear();
}

/**
 * Whether the given block type occupies a single focus slot.
 * @deprecated Import from block-taxonomy.ts instead.
 */
export function isFocusableType(type: string): boolean {
  return FOCUSABLE_TYPES.has(type as ContentBlock["type"]);
}

/**
 * Root that relative asset paths resolve against.
 *
 * `rt.projectDir` is populated for file-based projects (`runFileBasedSite`) and
 * over SSH (`serve.ts`); `site.projectDir` is the explicit escape hatch for a
 * hand-written config launched from somewhere other than its own directory.
 * With neither, `resolveImagePath()` falls back to `process.cwd()` — which the
 * layout estimator also falls back to, so the two still agree.
 */
export function projectDirOf(rt: RuntimeInternal): string | undefined {
  return nonEmpty(rt.projectDir) ?? nonEmpty(rt.site?.projectDir);
}

function nonEmpty(value: string | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Render a section header: accent-bold title + rule + blank line. */
export function renderSectionHeader(title: string, ctx: RenderContext): string[] {
  const sectionDims = computeBoxDimensions(ctx.width, COMPONENT_DEFAULTS.section);
  return [
    fgColor(ctx.theme.accent) + bold + "  " + title + reset,
    fgColor(ctx.theme.border) + "  " + "─".repeat(Math.max(0, sectionDims.content - 4)) + reset,
    "",
  ];
}

/** Render content blocks as string lines. */
export function renderContentBlocks(rt: RuntimeInternal, blocks: ContentBlock[], ctx: RenderContext): string[] {
  const lines: string[] = [];
  for (const block of blocks) {
    // Pass focused context to blocks inside layouts when they match the current focus
    let blockCtx = ctx;
    const isFocused = !!rt.currentFocusedBlock && block === rt.currentFocusedBlock;
    if (isFocused) {
      blockCtx = { ...ctx, focused: true };
    }
    const trackStart = lines.length;
    const blockLines = renderBlock(rt, block, blockCtx);
    lines.push(...blockLines);
    if (ctx.focusTrack && rt.currentFocusedBlock &&
        (isFocused || containsBlock([block], rt.currentFocusedBlock))) {
      ctx.focusTrack.start = trackStart;
      ctx.focusTrack.end = lines.length;
    }
    lines.push("");
  }
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

/** Render a single content block to string lines. */
export function renderBlock(rt: RuntimeInternal, block: ContentBlock, ctx: RenderContext): string[] {
  switch (block.type) {
    case "text":
      return renderText(block.content, ctx, block.style);
    case "card":
      return renderCard(block, ctx);
    case "timeline":
      return renderTimeline(block.items, ctx, block.style);
    case "table":
      return renderTable(block.headers, block.rows, ctx);
    case "list":
      return renderList(block.items, ctx, block.style);
    case "quote":
      return renderQuote(block.text, ctx, { attribution: block.attribution, style: block.style });
    case "hero":
      return renderHero(block, ctx);
    case "gallery": {
      const galleryKey = rt.getBlockKey(block, () => JSON.stringify(block.items.map((i: any) => i.title)));
      const scrollIdx = rt.galleryState.get(galleryKey) ?? 0;
      return renderGallery(block.items, ctx, { columns: block.columns, scrollIndex: scrollIdx });
    }
    case "tabs": {
      const tabKey = rt.getBlockKey(block, () => block.items.map((i: any) => i.label).join(","));
      const activeIdx = rt.tabState.get(tabKey) ?? 0;
      return renderTabs(block.items, activeIdx, ctx, (blocks, c) => renderContentBlocks(rt, blocks, c));
    }
    case "accordion": {
      const accKey = rt.getBlockKey(block, () => block.items.map((i: any) => i.label).join(","));
      const openIdx = rt.accordionState.get(accKey) ?? -1;
      return renderAccordion(block.items, openIdx, ctx, (blocks, c) => renderContentBlocks(rt, blocks, c));
    }
    case "link":
      return renderLink(block.label, block.url, ctx, { icon: block.icon });
    case "progressBar":
      return renderProgressBar(block.label, block.value, ctx, { max: block.max, showPercent: block.showPercent });
    case "badge":
      return [renderBadge(block.text, ctx, { color: block.color, style: block.style })];
    case "image":
      return renderImageBlock(rt, block, ctx);
    case "video":
      return renderVideoBlock(rt, block, ctx);
    case "divider":
      return renderDivider(ctx, { style: block.style, label: block.label, color: block.color });
    case "spacer":
      return renderSpacer(block.lines);
    case "section": {
      const sectionLines: string[] = renderSectionHeader(block.title, ctx);
      sectionLines.push(...renderContentBlocks(rt, block.content, ctx));
      return sectionLines;
    }
    case "custom":
      // The third argument is the vertical twin of `ctx.width`: the rows the
      // enclosing sequence has, so display type can pick a font from the room it
      // actually has. `ctx.availRows` is set by whoever owns that sequence (the
      // page loop, or `renderPanel` for a pane); the fallback covers the paths
      // that own no sequence of their own — the home page, a tab body, an
      // accordion panel — where the page viewport is still the honest answer.
      return block.render(ctx.width, ctx.theme, {
        availRows: ctx.availRows ?? ctx.panelHeight ?? viewportHeight(rt.screenSize.rows),
        columns: rt.screenSize.columns,
        rows: rt.screenSize.rows,
      });
    case "textInput": {
      const state = rt.getInputState(block.id, block.defaultValue ?? "");
      return renderTextInput(block, { value: state.value as string, cursorPos: state.cursorPos, editing: !!ctx.editing, error: state.error }, ctx);
    }
    case "textArea": {
      const state = rt.getInputState(block.id, block.defaultValue ?? "");
      return renderTextArea(block, { value: state.value as string, cursorPos: state.cursorPos, editing: !!ctx.editing, error: state.error, scrollOffset: state.scrollOffset }, ctx);
    }
    case "select": {
      const state = rt.getInputState(block.id, block.defaultValue ?? "");
      return renderSelect(block, { value: state.value as string, open: state.open, highlightIndex: state.highlightIndex }, ctx);
    }
    case "checkbox": {
      const state = rt.getInputState(block.id, block.defaultValue ?? false);
      return renderCheckbox(block, state.value as boolean, ctx);
    }
    case "toggle": {
      const state = rt.getInputState(block.id, block.defaultValue ?? false);
      return renderToggle(block, state.value as boolean, ctx);
    }
    case "radioGroup": {
      const state = rt.getInputState(block.id, block.defaultValue ?? "");
      return renderRadioGroup(block, { value: state.value as string, highlightIndex: state.highlightIndex }, ctx);
    }
    case "numberInput": {
      const state = rt.getInputState(block.id, block.defaultValue ?? 0);
      return renderNumberInput(block, { value: state.value as number, editing: !!ctx.editing, textBuffer: "" }, ctx);
    }
    case "searchInput": {
      const state = rt.getInputState(block.id, "");
      const maxResults = block.maxResults ?? 10;
      const filtered = filterSearchItems(block.items, state.value as string, maxResults);
      return renderSearchInput(block, { query: state.value as string, cursorPos: state.cursorPos, editing: !!ctx.editing, highlightIndex: state.highlightIndex, filteredItems: filtered }, ctx);
    }
    case "button": {
      const isLoading = rt.buttonLoading.get(rt.getBlockKey(block, () => block.label)) ?? false;
      return renderButton(block, ctx, isLoading);
    }
    case "form": {
      const formLines = renderContentBlocks(rt, block.fields, ctx);
      const formResult = rt.formResults.get(block.id);
      if (formResult) {
        formLines.push("");
        formLines.push(...renderFormResult({ resultMessage: formResult.message, resultType: formResult.type }, ctx));
      }
      return formLines;
    }
    case "asyncContent":
      return [];
    case "dynamic": {
      const dynamicBlocks = resolveDynamic(rt, block as DynamicBlock);
      return renderContentBlocks(rt, dynamicBlocks, ctx);
    }
    case "columns": {
      const { rows: termRows } = rt.screenSize;
      const availHeight = layoutAvailHeight(termRows);
      const colsBlock = block as ColumnsBlock;
      const activeIdx = findActivePanelIndex(colsBlock.panels.map(p => p.content), rt.currentFocusedBlock);
      return renderColumns(colsBlock, ctx, {
        availableHeight: availHeight,
        activePanelIndex: activeIdx,
        renderContent: (blocks, c) => renderContentBlocks(rt, blocks, c),
      });
    }
    case "rows": {
      const { rows: termRows } = rt.screenSize;
      const availHeight = layoutAvailHeight(termRows);
      const rowsBlk = block as RowsBlock;
      const activeIdx = findActivePanelIndex(rowsBlk.panels.map(p => p.content), rt.currentFocusedBlock);
      return renderRows(rowsBlk, ctx, {
        availableHeight: availHeight,
        activePanelIndex: activeIdx,
        renderContent: (blocks, c) => renderContentBlocks(rt, blocks, c),
      });
    }
    case "grid": {
      const { rows: termRows } = rt.screenSize;
      const availHeight = layoutAvailHeight(termRows);
      const gridBlk = block as GridBlock;
      const activeIdx = findActivePanelIndex(gridBlk.config.items.map(i => i.content), rt.currentFocusedBlock);
      return renderGrid(gridBlk, ctx, {
        availableHeight: availHeight,
        activePanelIndex: activeIdx,
        renderContent: (blocks, c) => renderContentBlocks(rt, blocks, c),
      });
    }
    case "panel": {
      const { rows: termRows } = rt.screenSize;
      const availHeight = layoutAvailHeight(termRows);
      return renderPanel((block as PanelBlock).config, ctx, {
        width: ctx.width,
        height: availHeight,
        renderContent: (blocks, c) => renderContentBlocks(rt, blocks, c),
      });
    }
    case "row": {
      return renderRowBlock(rt, block as RowBlock, ctx);
    }
    case "container": {
      return renderContainerBlock(rt, block as ContainerBlock, ctx);
    }
    case "menu": {
      // Menu block — render inline menu (auto or manual items)
      return renderMenuBlock(rt, block as any, ctx);
    }
    case "chat": {
      const chatBlock = block as ChatBlock;
      const state = rt.getInputState(chatBlock.id, {
        messages: [] as ChatMessage[],
        input: "",
        cursorPos: 0,
        loading: false,
        error: null,
      });
      const chatState: ChatState = {
        messages: (state.value as any)?.messages ?? [],
        input: (state.value as any)?.input ?? state.value as string ?? "",
        cursorPos: state.cursorPos ?? 0,
        loading: (state.value as any)?.loading ?? false,
        error: (state.value as any)?.error ?? null,
      };
      return renderChat(chatBlock, chatState, ctx);
    }
    default:
      return [];
  }
}

/** Find which panel (by content array index) contains the focused block. */
function findActivePanelIndex(contentArrays: ContentBlock[][], focusedBlock?: ContentBlock): number {
  if (!focusedBlock) return -1;
  for (let i = 0; i < contentArrays.length; i++) {
    if (containsBlock(contentArrays[i], focusedBlock)) return i;
  }
  return -1;
}

/** Render a 12-column grid row with responsive wrapping. */
function renderRowBlock(rt: RuntimeInternal, block: RowBlock, ctx: RenderContext): string[] {
  const { cols, gap = 1 } = block;
  if (cols.length === 0) return [];

  const { rows: termRows, columns: termCols } = rt.screenSize;
  const availHeight = layoutAvailHeight(termRows);

  // Resolve effective spans based on current terminal breakpoint
  const bp = getBreakpoint(termCols);
  const autoSpan = Math.max(1, Math.floor(12 / cols.length));
  const spans = cols.map(c => getEffectiveSpan(c, bp, autoSpan));

  // Group columns into wrapped rows (each row gets up to 12 spans)
  const wrappedRows: { col: typeof cols[number]; span: number }[][] = [[]];
  let currentRowSpan = 0;
  for (let i = 0; i < cols.length; i++) {
    const offset = cols[i].offset ?? 0;
    const totalSpan = spans[i] + offset;
    if (currentRowSpan + totalSpan > 12 && wrappedRows[wrappedRows.length - 1].length > 0) {
      wrappedRows.push([]);
      currentRowSpan = 0;
    }
    wrappedRows[wrappedRows.length - 1].push({ col: cols[i], span: spans[i] });
    currentRowSpan += totalSpan;
  }

  // Render each wrapped row independently
  const allLines: string[] = [];
  for (const rowCols of wrappedRows) {
    const rowColConfigs = rowCols.map(r => r.col);
    const panels = rowColsToPanels(rowColConfigs, ctx.width, gap, termCols);
    const activeIdx = findActivePanelIndex(panels.map(p => p.content), rt.currentFocusedBlock);
    const rects = layoutColumns(panels, ctx.width, availHeight);
    const rowLines = mergeRects(rects, ctx, ctx.width, availHeight, activeIdx,
      (blocks, c) => renderContentBlocks(rt, blocks, c));

    // Trim trailing blank lines so rows take only as much space as content needs.
    // Blank lines are those containing only spaces, ANSI codes, and divider chars.
    while (rowLines.length > 0) {
      const last = rowLines[rowLines.length - 1];
      const visual = stripAnsi(last);
      if (/^[\s\u2502\u2506\u250a\u2503]*$/.test(visual)) {
        rowLines.pop();
      } else {
        break;
      }
    }

    if (allLines.length > 0) allLines.push(""); // gap between wrapped rows
    allLines.push(...rowLines);
  }
  return allLines;
}

/** Render a menu block (for file-based routing auto-menu or inline manual menu). */
function renderMenuBlock(rt: RuntimeInternal, block: any, ctx: RenderContext): string[] {
  let items: MenuItem[] = [];

  if (block.items && block.items.length > 0) {
    // Manual items
    items = block.items.map((item: any) => ({
      label: item.label,
      icon: item.icon,
      id: item.page,
    }));
  } else if (block.source === "auto") {
    // Auto-generated from file router or site pages
    const fileRouter = rt.fileRouter;
    if (fileRouter) {
      const menuItems = fileRouter.getMenuItems();
      items = menuItems.map((m: any) => ({
        label: m.label,
        icon: m.icon,
        id: m.page,
      }));
    } else {
      // Fallback: use site pages (single-file mode)
      const site = rt.site;
      if (site?.pages) {
        items = site.pages
          .filter((p: any) => typeof p.title === "string")
          .map((p: any) => ({ label: p.title, icon: p.icon, id: p.id }));
      }
    }
  }

  // Render using the existing menu renderer
  return renderMenuComponent(items, 0, ctx);
}

/** Render a container block (centers content with optional max width). */
function renderContainerBlock(rt: RuntimeInternal, block: ContainerBlock, ctx: RenderContext): string[] {
  const padding = block.padding ?? 0;
  const maxWidth = block.maxWidth ?? ctx.width;
  const innerWidth = Math.max(1, Math.min(ctx.width, maxWidth) - padding * 2);
  const containerCtx: RenderContext = { ...ctx, width: innerWidth };

  const lines: string[] = [];
  for (const child of block.content) {
    let childCtx = containerCtx;
    if (rt.currentFocusedBlock && child === rt.currentFocusedBlock) {
      childCtx = { ...containerCtx, focused: true };
    }
    const rendered = renderBlock(rt, child, childCtx);

    // Center if needed and padding
    const center = block.center !== false;
    const totalPad = ctx.width - innerWidth;
    const leftPad = center ? Math.floor(totalPad / 2) : padding;
    const padStr = " ".repeat(leftPad);

    for (const line of rendered) {
      lines.push(padStr + line);
    }
    lines.push("");
  }
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}
