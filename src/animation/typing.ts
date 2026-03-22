export interface TypingState {
  text: string;
  visibleChars: number;
  complete: boolean;
}

export function createTypingAnimation(text: string, speed: number = 2): {
  state: TypingState;
  advance: () => boolean;
  getText: () => string;
} {
  const state: TypingState = {
    text,
    visibleChars: 0,
    complete: false,
  };

  return {
    state,
    advance(): boolean {
      if (state.complete) return false;
      state.visibleChars = Math.min(state.text.length, state.visibleChars + speed);
      if (state.visibleChars >= state.text.length) {
        state.complete = true;
      }
      return !state.complete;
    },
    getText(): string {
      return state.text.slice(0, state.visibleChars);
    },
  };
}
