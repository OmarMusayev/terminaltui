import type { ContentBlock } from "../config/types.js";

export interface DynamicBlock {
  type: "dynamic";
  render: () => ContentBlock | ContentBlock[];
  deps?: string[];
  _dynamicId: string;
}

let dynamicIdCounter = 0;

/**
 * Create a dynamic content block that re-renders when state changes.
 *
 * Overload 1: dynamic(renderFn) — re-renders on any state change
 * Overload 2: dynamic(deps, renderFn) — re-renders when specified keys change
 */
export function dynamic(
  depsOrRender: string[] | (() => ContentBlock | ContentBlock[]),
  maybeRender?: () => ContentBlock | ContentBlock[],
): DynamicBlock {
  if (typeof depsOrRender === "function") {
    return {
      type: "dynamic",
      render: depsOrRender,
      _dynamicId: `dynamic-${dynamicIdCounter++}`,
    };
  }
  return {
    type: "dynamic",
    deps: depsOrRender,
    render: maybeRender!,
    _dynamicId: `dynamic-${dynamicIdCounter++}`,
  };
}
