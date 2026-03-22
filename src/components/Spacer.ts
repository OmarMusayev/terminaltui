export function renderSpacer(lines: number = 1): string[] {
  return Array(Math.max(0, lines)).fill("");
}
