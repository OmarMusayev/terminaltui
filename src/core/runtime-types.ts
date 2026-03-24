import type { ContentBlock } from "../config/types.js";

/** A focusable item on a content page. */
export type FocusItem =
  | { kind: "block"; block: ContentBlock }
  | { kind: "accordion-item"; accordion: ContentBlock & { type: "accordion" }; itemIndex: number }
  | { kind: "timeline-item"; timeline: ContentBlock & { type: "timeline" }; itemIndex: number };

/** Form submission result shown after submit. */
export interface FormResult {
  message: string;
  type: "success" | "error" | "info";
}
