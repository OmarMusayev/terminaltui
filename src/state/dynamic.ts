import type { ContentBlock } from "../config/types.js";

export interface DynamicBlock {
  type: "dynamic";
  render: () => ContentBlock | ContentBlock[];
  _dynamicId: string;
}

let dynamicIdCounter = 0;

/**
 * Create a dynamic content block that re-renders when any state changes.
 *
 * Targeted re-rendering based on a deps array was previously claimed but
 * never implemented; if you need that, scope state into a smaller container.
 */
export function dynamic(render: () => ContentBlock | ContentBlock[]): DynamicBlock {
  return {
    type: "dynamic",
    render,
    _dynamicId: `dynamic-${dynamicIdCounter++}`,
  };
}
