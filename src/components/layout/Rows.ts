/**
 * Rows component — renders panels stacked vertically with fixed/flex heights.
 */
import type { RowsBlock } from "../../config/types.js";
import type { RenderContext } from "../base.js";
import { renderStackedPanels, type StackedRenderOptions } from "./stacked.js";

export type RowsRenderOptions = StackedRenderOptions;

/** Render a rows layout. Returns string[] of vertically stacked panels. */
export function renderRows(
  block: RowsBlock,
  ctx: RenderContext,
  opts: RowsRenderOptions,
): string[] {
  const { panels } = block;
  if (panels.length === 0) return [];
  return renderStackedPanels(panels, ctx, opts);
}
