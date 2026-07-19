/**
 * Unified content-block tree walker.
 *
 * One generator for every semantic traversal of the block tree (focus
 * collection, form registration, search, containment). The geometry walker
 * in layout/flex-engine.ts stays separate — it is inseparable from the
 * layout math — but consumes the same ordering rules via block-taxonomy.ts,
 * and test/focus-contract.test.ts pins the two together.
 */
import type { ContentBlock, DynamicBlock, AsyncContentBlock } from "../config/types.js";

/** Every container edge a walk can descend. */
export type ContainerEdge =
  | "section" | "form" | "columns" | "rows" | "grid" | "panel"
  | "row" | "container" | "dynamic" | "tabs" | "accordion" | "asyncContent";

/**
 * Structural containers: what the focus walk descends (dynamic included;
 * tabs/accordion item content and asyncContent excluded). The default.
 */
export const STRUCTURAL_EDGES: ReadonlySet<ContainerEdge> = new Set<ContainerEdge>([
  "section", "form", "columns", "rows", "grid", "panel",
  "row", "container", "dynamic",
]);

// NOTE: there is deliberately no "STRUCTURAL_EDGES minus dynamic" set for
// focus-slot counting. Any count over a dynamic-skipping walk disagrees with
// collectFocusItems' index space on pages containing dynamic() — the exact
// off-by-N class of bug the unified walker exists to prevent. Count focus
// slots with a resolveDynamic-aware walk (or on trees known to be
// dynamic-free, e.g. countFocusSlots in runtime-pages.ts).

/** Everything, including tabs/accordion item content — for search and key-stamping. */
export const ALL_EDGES: ReadonlySet<ContainerEdge> = new Set<ContainerEdge>([
  ...STRUCTURAL_EDGES, "tabs", "accordion", "asyncContent",
]);

export interface WalkEntry {
  block: ContentBlock;
  /**
   * Structural path from the walk root: child index at each level, with a
   * named edge segment for keyed containers. Examples: "2", "1/panels.0/3",
   * "0/items.2/1" (tab #2's second child), "4/dyn/0". Deterministic across
   * renders for a stable tree.
   */
  path: string;
  /** Ancestor chain, outermost first. */
  parents: readonly ContentBlock[];
}

export interface WalkOptions {
  /** Container edges to descend. Default: STRUCTURAL_EDGES. */
  descend?: ReadonlySet<ContainerEdge>;
  /** Required to descend "dynamic" edges. */
  resolveDynamic?: (b: DynamicBlock) => ContentBlock[];
  /** Required to descend "asyncContent" edges (null = not loaded yet). */
  resolveAsync?: (b: AsyncContentBlock) => ContentBlock[] | null;
  /** Prefix prepended to every emitted path (for sub-tree stamping). */
  pathPrefix?: string;
}

/** Pre-order walk. Yields every block including containers; callers filter. */
export function* walk(blocks: ContentBlock[], opts: WalkOptions = {}): Generator<WalkEntry> {
  yield* walkInner(blocks, opts.pathPrefix ?? "", [], opts.descend ?? STRUCTURAL_EDGES, opts);
}

function* walkInner(
  blocks: ContentBlock[],
  prefix: string,
  parents: readonly ContentBlock[],
  descend: ReadonlySet<ContainerEdge>,
  opts: WalkOptions,
): Generator<WalkEntry> {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const path = prefix === "" ? String(i) : `${prefix}/${i}`;
    yield { block, path, parents };

    if (!descend.has(block.type as ContainerEdge)) continue;
    const childParents: readonly ContentBlock[] = [...parents, block];

    switch (block.type) {
      case "section":
        yield* walkInner(block.content, path, childParents, descend, opts);
        break;
      case "form":
        yield* walkInner(block.fields, path, childParents, descend, opts);
        break;
      case "columns":
      case "rows": {
        for (let p = 0; p < block.panels.length; p++) {
          yield* walkInner(block.panels[p].content, `${path}/panels.${p}`, childParents, descend, opts);
        }
        break;
      }
      case "grid": {
        const items = block.config.items;
        for (let g = 0; g < items.length; g++) {
          yield* walkInner(items[g].content, `${path}/items.${g}`, childParents, descend, opts);
        }
        break;
      }
      case "panel":
        yield* walkInner(block.config.content, path, childParents, descend, opts);
        break;
      case "row": {
        for (let c = 0; c < block.cols.length; c++) {
          yield* walkInner(block.cols[c].content, `${path}/cols.${c}`, childParents, descend, opts);
        }
        break;
      }
      case "container":
        yield* walkInner(block.content, path, childParents, descend, opts);
        break;
      case "dynamic": {
        if (opts.resolveDynamic) {
          yield* walkInner(opts.resolveDynamic(block), `${path}/dyn`, childParents, descend, opts);
        }
        break;
      }
      case "tabs":
      case "accordion": {
        for (let t = 0; t < block.items.length; t++) {
          yield* walkInner(block.items[t].content, `${path}/items.${t}`, childParents, descend, opts);
        }
        break;
      }
      case "asyncContent": {
        if (opts.resolveAsync) {
          const resolved = opts.resolveAsync(block);
          if (resolved) yield* walkInner(resolved, `${path}/async`, childParents, descend, opts);
        }
        break;
      }
    }
  }
}

/** First entry matching a predicate, or null. */
export function findFirst(
  blocks: ContentBlock[],
  pred: (e: WalkEntry) => boolean,
  opts?: WalkOptions,
): WalkEntry | null {
  for (const e of walk(blocks, opts)) {
    if (pred(e)) return e;
  }
  return null;
}

/**
 * Stamp structural-path state keys (`${pageId}#${walkPath}`) onto every
 * block in the tree, including tabs/accordion item content (ALL_EDGES).
 * Dynamic and asyncContent children are NOT descended here — they are
 * stamped at their own resolution sites (resolveDynamic cache fill and
 * asyncContent first-seen) with the parent's path as prefix, because their
 * child arrays are (re)created after this pass runs.
 *
 * Deterministic for a stable tree: re-stamping refreshed content arrays
 * yields the same keys, so component state survives refresh.
 */
export function stampBlockKeys(
  rt: { blockKeys: WeakMap<ContentBlock, string> },
  pageId: string,
  blocks: ContentBlock[],
  pathPrefix?: string,
): void {
  for (const e of walk(blocks, { descend: ALL_EDGES, pathPrefix })) {
    rt.blockKeys.set(e.block, `${pageId}#${e.path}`);
  }
}

/** Identity containment. Descends STRUCTURAL_EDGES by default. */
export function containsBlock(
  blocks: ContentBlock[],
  target: ContentBlock,
  opts?: WalkOptions,
): boolean {
  return findFirst(blocks, e => e.block === target, opts) !== null;
}
