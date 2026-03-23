import type { RenderContext } from "./base.js";
import type { FormBlock, ContentBlock } from "../config/types.js";
import { fgColor, bold, dim, reset } from "../style/colors.js";
import { renderBox } from "./Box.js";

export interface FormRenderState {
  /** The success/error/info message to display after submit. */
  resultMessage?: string;
  resultType?: "success" | "error" | "info";
}

/**
 * Render the form wrapper.
 * The form itself delegates rendering of its fields to the runtime's renderBlock.
 * This function just renders the form result message if present.
 */
export function renderFormResult(
  state: FormRenderState,
  ctx: RenderContext,
): string[] {
  if (!state.resultMessage) return [];

  const theme = ctx.theme;
  let icon: string;
  let color: string;

  switch (state.resultType) {
    case "success":
      icon = "\u2713";
      color = theme.success;
      break;
    case "error":
      icon = "\u2717";
      color = theme.error;
      break;
    case "info":
    default:
      icon = "\u2139";
      color = theme.accent;
      break;
  }

  const content = [fgColor(color) + icon + " " + state.resultMessage + reset];
  return renderBox({
    content,
    width: ctx.width,
    border: (ctx.borderStyle as any) ?? "rounded",
    padding: 1,
    borderColor: color,
  }, ctx);
}

/** Collect all input field IDs from a form's fields array. */
export function collectFormFieldIds(fields: ContentBlock[]): string[] {
  const ids: string[] = [];
  for (const field of fields) {
    if ("id" in field && (field as any).type !== "form" && (field as any).type !== "button") {
      ids.push((field as any).id);
    }
  }
  return ids;
}

/** Get the default value for an input block. */
export function getInputDefault(block: ContentBlock): any {
  switch (block.type) {
    case "textInput":
    case "textArea":
      return (block as any).defaultValue ?? "";
    case "select":
    case "radioGroup":
      return (block as any).defaultValue ?? "";
    case "checkbox":
    case "toggle":
      return (block as any).defaultValue ?? false;
    case "numberInput":
      return (block as any).defaultValue ?? 0;
    case "searchInput":
      return "";
    default:
      return undefined;
  }
}
