import type { ContentBlock } from "../config/types.js";

/** State for an async content block or async page. */
export interface AsyncState {
  status: "loading" | "loaded" | "error";
  content?: ContentBlock[];
  error?: Error;
  lastLoadTime?: number;
}

/** State for a single input field. */
export interface InputFieldState {
  value: any;
  cursorPos: number;
  error: string | null;
  /** For select/search: whether dropdown is open */
  open: boolean;
  /** For select/search: highlighted option index */
  highlightIndex: number;
  /** For textarea: scroll offset within the textarea */
  scrollOffset: number;
}

/** Create default input field state. */
export function createInputState(defaultValue?: any): InputFieldState {
  const val = defaultValue ?? "";
  return {
    value: val,
    cursorPos: typeof val === "string" ? val.length : 0,
    error: null,
    open: false,
    highlightIndex: 0,
    scrollOffset: 0,
  };
}

/** Fetcher state for rendering. */
export interface FetcherState<T = any> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}
