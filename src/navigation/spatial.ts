/**
 * Spatial navigation algorithm — finds the nearest focusable item
 * in a given direction based on screen position.
 *
 * Used by Android TV, Roku, CSS spatial-navigation spec, game console UIs.
 */
import type { FocusRect } from "../layout/types.js";

export type Direction = "up" | "down" | "left" | "right";

/**
 * Find the best focus target in the given direction from the current focus.
 * Returns the focusIndex of the best candidate, or null if none found.
 */
export function findNextFocus(
  currentIndex: number,
  direction: Direction,
  allRects: FocusRect[],
): number | null {
  const current = allRects.find(r => r.focusIndex === currentIndex);
  if (!current) return null;

  const candidates = allRects.filter(r => {
    if (r.focusIndex === currentIndex) return false;
    return isInDirection(current, r, direction);
  });

  if (candidates.length === 0) return null;

  let best = candidates[0];
  let bestScore = spatialScore(current, best, direction);

  for (let i = 1; i < candidates.length; i++) {
    const score = spatialScore(current, candidates[i], direction);
    if (score < bestScore) {
      best = candidates[i];
      bestScore = score;
    }
  }

  return best.focusIndex;
}

/** Check if `target` is in the given direction from `from`. */
function isInDirection(from: FocusRect, target: FocusRect, direction: Direction): boolean {
  switch (direction) {
    case "right":
      // Target's left edge must be to the right of current's left edge
      return target.x > from.x;
    case "left":
      // Target's right edge must be to the left of current's right edge
      return target.x + target.width < from.x + from.width;
    case "down":
      // Target's top edge must be below current's top edge
      return target.y > from.y;
    case "up":
      // Target's bottom edge must be above current's bottom edge
      return target.y + target.height < from.y + from.height;
  }
}

/**
 * Score a candidate based on distance + alignment.
 * Lower score = better candidate.
 *
 * The secondary axis is weighted 2x so that items directly in the
 * pressed direction are preferred over items that are far off-axis.
 */
function spatialScore(from: FocusRect, to: FocusRect, direction: Direction): number {
  const fromCX = from.x + from.width / 2;
  const fromCY = from.y + from.height / 2;
  const toCX = to.x + to.width / 2;
  const toCY = to.y + to.height / 2;

  let primaryDist: number;
  let secondaryDist: number;

  if (direction === "left" || direction === "right") {
    primaryDist = Math.abs(toCX - fromCX);
    secondaryDist = Math.abs(toCY - fromCY);
  } else {
    primaryDist = Math.abs(toCY - fromCY);
    secondaryDist = Math.abs(toCX - fromCX);
  }

  // Heavy weight on secondary axis — prefer items that are aligned
  return primaryDist + secondaryDist * 2;
}
