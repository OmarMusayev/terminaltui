/**
 * Input component and form block type definitions.
 *
 * Extracted from types.ts to keep files under 400 lines.
 */

import type { Theme } from "../style/theme.js";

// ─── Content Block Base Types (needed for recursive references) ──────

// Forward-declared: the full ContentBlock union is in types.ts.
// These block types reference ContentBlock, so we accept it as a generic
// to avoid circular imports. The parent re-exports everything together.

// ─── Input Components ─────────────────────────────────────

export interface TextInputBlock {
  type: "textInput";
  id: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  maxLength?: number;
  validate?: (value: string) => string | null;
  mask?: boolean;
  transform?: (value: string) => string;
  onChange?: (value: string) => void;
}

export interface TextAreaBlock {
  type: "textArea";
  id: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  rows?: number;
  maxLength?: number;
  validate?: (value: string) => string | null;
  onChange?: (value: string) => void;
}

export interface SelectBlock {
  type: "select";
  id: string;
  label: string;
  options: { label: string; value: string }[];
  defaultValue?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
}

export interface CheckboxBlock {
  type: "checkbox";
  id: string;
  label: string;
  defaultValue?: boolean;
  onChange?: (value: boolean) => void;
}

export interface ToggleBlock {
  type: "toggle";
  id: string;
  label: string;
  defaultValue?: boolean;
  onLabel?: string;
  offLabel?: string;
  onChange?: (value: boolean) => void;
}

export interface RadioGroupBlock {
  type: "radioGroup";
  id: string;
  label: string;
  options: { label: string; value: string }[];
  defaultValue?: string;
  onChange?: (value: string) => void;
}

export interface NumberInputBlock {
  type: "numberInput";
  id: string;
  label: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface SearchInputBlock {
  type: "searchInput";
  id: string;
  label?: string;
  placeholder?: string;
  items: { label: string; value: string; keywords?: string[] }[];
  onSelect?: (value: string) => void;
  maxResults?: number;
  /**
   * What happens when a result is selected:
   * - "navigate": jump to a page matching the value, or scroll to a matching block on the current page
   * - "callback": call onSelect (default if onSelect is provided)
   */
  action?: "navigate" | "callback";
}

export interface ButtonBlock {
  type: "button";
  label: string;
  style?: "primary" | "secondary" | "danger";
  onPress?: () => void | Promise<void>;
  loading?: boolean;
  _formId?: string;
}

export interface FormBlock {
  type: "form";
  id: string;
  onSubmit: (data: Record<string, unknown>) => Promise<ActionResult> | ActionResult;
  fields: ContentBlock[];
  /** Reset all field values to defaults after successful submit. Default: false. */
  resetOnSubmit?: boolean;
}

export interface AsyncContentBlock {
  type: "asyncContent";
  load: () => Promise<ContentBlock[]>;
  loading?: string;
  fallback?: ContentBlock[];
  _asyncId?: string;
}

// ─── Dynamic Block ────────────────────────────────────────

export interface DynamicBlock {
  type: "dynamic";
  render: () => ContentBlock | ContentBlock[];
  deps?: string[];
  _dynamicId?: string;
}

// ─── Action Types ─────────────────────────────────────────

export type ActionResult = { success: string } | { error: string } | { info: string };

export interface CardAction {
  label?: string;
  style?: "primary" | "secondary" | "danger";
  confirm?: string;
  onPress?: () => void | Promise<void>;
  /** Navigate to a page or route. */
  navigate?: string;
  /** Route parameters for parameterized routes. */
  params?: RouteParams;
}

// ─── Link Options ──────────────────────────────────────────

export interface LinkOptions {
  icon?: string;
}

// ─── Custom Block ──────────────────────────────────────────

export interface CustomBlock {
  type: "custom";
  render: (width: number, theme: Theme) => string[];
}

// These are imported from other modules but needed for the types here.
// We use local type references to avoid circular dependencies.
import type { RouteParams } from "../routing/types.js";

// ContentBlock is the full union from types.ts — we import it here
// to type FormBlock.fields etc. This is safe because types.ts re-exports us.
import type { ContentBlock } from "./types.js";
