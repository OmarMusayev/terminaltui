export interface StaggerState {
  items: string[];
  visibleCount: number;
  complete: boolean;
}

export function createStaggerAnimation(items: string[], delayFrames: number = 3): {
  state: StaggerState;
  advance: () => boolean;
  getVisibleItems: () => string[];
} {
  const state: StaggerState = {
    items,
    visibleCount: 0,
    complete: false,
  };

  let frameCount = 0;

  return {
    state,
    advance(): boolean {
      if (state.complete) return false;
      frameCount++;
      if (frameCount % delayFrames === 0) {
        state.visibleCount++;
      }
      if (state.visibleCount >= state.items.length) {
        state.visibleCount = state.items.length;
        state.complete = true;
      }
      return !state.complete;
    },
    getVisibleItems(): string[] {
      return state.items.slice(0, state.visibleCount);
    },
  };
}
