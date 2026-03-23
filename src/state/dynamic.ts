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
 * Overload 2: dynamic(deps, renderFn) — accepts a deps array for forward compatibility.
 *   Currently all dynamic blocks re-render on any state change regardless of deps.
 *   Targeted re-rendering based on deps is planned for a future release.
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
