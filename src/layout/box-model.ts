/**
 * Universal box model for terminaltui components.
 * Every component that renders content calls computeBoxDimensions()
 * to determine how much space it has for text and children.
 *
 * The model:
 *
 *   +---------------- allocated width -----------------+
 *   | margin                                           |
 *   |  +------------ outer width -----------------+   |
 *   |  | border                                    |   |
 *   |  |  +-------- inner width ---------------+   |   |
 *   |  |  | padding                            |   |   |
 *   |  |  |  +---- content width -----------+  |   |   |
 *   |  |  |  |                              |  |   |   |
 *   |  |  |  |  Text wraps here.            |  |   |   |
 *   |  |  |  |  Children render here.       |  |   |   |
 *   |  |  |  |                              |  |   |   |
 *   |  |  |  +------------------------------+  |   |   |
 *   |  |  +------------------------------------+   |   |
 *   |  +-------------------------------------------+  |
 *   +--------------------------------------------------+
 *
 *   content = allocated - (margin * 2) - (border * 2) - (padding * 2)
 */

export interface BoxDimensions {
  /** Total width given by parent */
  allocated: number;
  /** Space outside border, each side */
  margin: number;
  /** Border thickness each side (0 or 1) */
  border: number;
  /** Space inside border, each side */
  padding: number;
  /** Width available for text and children — the number you actually use */
  content: number;
}

export interface BoxOptions {
  margin?: number;
  border?: boolean | number;
  padding?: number;
}

export function computeBoxDimensions(
  allocatedWidth: number,
  options: BoxOptions,
): BoxDimensions {
  const margin = options.margin ?? 0;
  const border = typeof options.border === "boolean"
    ? (options.border ? 1 : 0)
    : (options.border ?? 0);
  const padding = options.padding ?? 0;

  const chrome = (margin * 2) + (border * 2) + (padding * 2);
  const content = Math.max(0, allocatedWidth - chrome);

  return { allocated: allocatedWidth, margin, border, padding, content };
}

/**
 * Default box model values for every component type.
 *
 * These match the actual rendering behavior of each component.
 * Components can override per-instance via their config options.
 */
export const COMPONENT_DEFAULTS: Record<string, BoxOptions> = {
  // --- Display components ---
  card:        { padding: 1, border: true,  margin: 0 },
  text:        { padding: 0, border: false, margin: 0 },
  hero:        { padding: 0, border: false, margin: 0 },
  table:       { padding: 0, border: true,  margin: 0 },
  quote:       { padding: 1, border: true,  margin: 1 },
  badge:       { padding: 0, border: false, margin: 0 },
  progressBar: { padding: 0, border: false, margin: 0 },
  link:        { padding: 0, border: false, margin: 0 },
  list:        { padding: 0, border: false, margin: 0 },
  section:     { padding: 0, border: false, margin: 0 },
  divider:     { padding: 0, border: false, margin: 0 },
  spacer:      { padding: 0, border: false, margin: 0 },
  timeline:    { padding: 1, border: true,  margin: 1 },
  gallery:     { padding: 0, border: false, margin: 0 },
  image:       { padding: 0, border: true,  margin: 0 },
  markdown:    { padding: 0, border: false, margin: 0 },

  // --- Interactive components ---
  menu:        { padding: 0, border: false, margin: 0 },
  accordion:   { padding: 2, border: false, margin: 0 },
  tabs:        { padding: 2, border: false, margin: 0 },
  scrollView:  { padding: 0, border: false, margin: 0 },

  // --- Input components ---
  textInput:   { padding: 1, border: true,  margin: 0 },
  textArea:    { padding: 1, border: true,  margin: 0 },
  select:      { padding: 1, border: true,  margin: 0 },
  checkbox:    { padding: 0, border: false, margin: 0 },
  toggle:      { padding: 0, border: false, margin: 0 },
  radioGroup:  { padding: 0, border: false, margin: 0 },
  numberInput: { padding: 1, border: true,  margin: 0 },
  searchInput: { padding: 1, border: true,  margin: 0 },
  button:      { padding: 2, border: true,  margin: 1 },
  form:        { padding: 1, border: true,  margin: 0 },

  // --- Layout components ---
  // These distribute width to children, not bordered containers.
  box:         { padding: 0, border: false, margin: 0 },
};
