import type { RenderContext } from "./base.js";
import { truncate, stringWidth } from "./base.js";
import { fgColor, bold, dim, underline, reset } from "../style/colors.js";
import { computeBoxDimensions, COMPONENT_DEFAULTS } from "../layout/box-model.js";

export function renderLink(label: string, url: string, ctx: RenderContext, options?: { icon?: string; focused?: boolean }): string[] {
  const theme = ctx.theme;
  const icon = options?.icon ?? "\u2192";
  const isFocused = options?.focused ?? ctx.focused ?? false;
  const dims = computeBoxDimensions(ctx.width, COMPONENT_DEFAULTS.link);
  const width = dims.content;

  if (isFocused) {
    // Focused format: "  ❯ icon label  url"
    const prefix = "  \u276f " + icon + " ";
    const separator = "  ";
    const prefixLen = stringWidth(prefix);
    const availForLabel = width - prefixLen;

    if (availForLabel <= 0) {
      return [fgColor(theme.accent) + bold + truncate(prefix, width) + reset];
    }

    const labelUrlLen = stringWidth(label) + stringWidth(separator) + stringWidth(url);
    if (prefixLen + labelUrlLen <= width) {
      // Everything fits
      return [
        fgColor(theme.accent) + bold + prefix + underline + label + reset +
        fgColor(theme.muted) + dim + separator + url + reset
      ];
    }

    // Try truncating URL to fit
    const availForUrl = width - prefixLen - stringWidth(label) - stringWidth(separator);
    if (availForUrl >= 4) {
      const truncatedUrl = truncate(url, availForUrl);
      return [
        fgColor(theme.accent) + bold + prefix + underline + label + reset +
        fgColor(theme.muted) + dim + separator + truncatedUrl + reset
      ];
    }

    // No room for URL, truncate label if needed
    const truncatedLabel = truncate(label, availForLabel);
    return [
      fgColor(theme.accent) + bold + prefix + underline + truncatedLabel + reset
    ];
  }

  // Unfocused format: "    icon label  url"
  const prefix = "    " + icon + " ";
  const separator = "  ";
  const prefixLen = stringWidth(prefix);
  const availForLabel = width - prefixLen;

  if (availForLabel <= 0) {
    return [fgColor(theme.text) + truncate(prefix, width) + reset];
  }

  const labelUrlLen = stringWidth(label) + stringWidth(separator) + stringWidth(url);
  if (prefixLen + labelUrlLen <= width) {
    // Everything fits
    return [
      fgColor(theme.text) + prefix + label + reset +
      fgColor(theme.subtle) + dim + separator + url + reset
    ];
  }

  // Try truncating URL to fit
  const availForUrl = width - prefixLen - stringWidth(label) - stringWidth(separator);
  if (availForUrl >= 4) {
    const truncatedUrl = truncate(url, availForUrl);
    return [
      fgColor(theme.text) + prefix + label + reset +
      fgColor(theme.subtle) + dim + separator + truncatedUrl + reset
    ];
  }

  // No room for URL, truncate label if needed
  const truncatedLabel = truncate(label, availForLabel);
  return [
    fgColor(theme.text) + prefix + truncatedLabel + reset
  ];
}
