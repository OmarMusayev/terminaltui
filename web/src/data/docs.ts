/**
 * Documentation running order.
 *
 * The pages themselves are the repository's own /docs markdown — nothing is
 * duplicated or paraphrased here. This file only decides sequence, grouping and
 * the one-line summary shown on the index, because none of that belongs in a
 * markdown file that also has to read well on GitHub.
 */
export const docSections = [
  {
    title: "Start here",
    items: [
      { slug: "getting-started", label: "Getting started", blurb: "Install, scaffold, run. The five minutes before anything else makes sense." },
      { slug: "routing", label: "Routing", blurb: "How a file in pages/ becomes a screen, and what brackets in a filename do." },
      { slug: "cli-reference", label: "CLI reference", blurb: "Every command, its flags, and what it actually does." },
    ],
  },
  {
    title: "Building",
    items: [
      { slug: "components", label: "Components", blurb: "The authoring API: content, input, layout and navigation blocks." },
      { slug: "layouts", label: "Layouts", blurb: "The twelve-column grid, panels, columns and rows." },
      { slug: "state-data", label: "State and data", blurb: "Reactive state, computed values, persistence and fetching." },
      { slug: "api-routes", label: "API routes", blurb: "Files in api/ become GET endpoints your pages can call." },
    ],
  },
  {
    title: "Making it look right",
    items: [
      { slug: "themes", label: "Themes", blurb: "Twelve built-in themes, custom palettes, and how colour depth is negotiated." },
      { slug: "images", label: "Images", blurb: "Real PNG, JPEG and GIF in a terminal — coloured cells everywhere, true pixels on kitty." },
      { slug: "video", label: "Video", blurb: "Frame packs, playback controls, GIF support, real pixels and the portable cell fallback." },
      { slug: "ascii-art", label: "ASCII art", blurb: "Fourteen banner fonts, fifteen scenes, and the icon set." },
    ],
  },
  {
    title: "Shipping",
    items: [
      { slug: "serve", label: "SSH hosting", blurb: "One server, many sessions, per-client capability detection." },
      { slug: "testing", label: "Testing", blurb: "Drive a real PTY from your test suite and assert on what is on screen." },
      { slug: "create-command", label: "AI scaffolding", blurb: "Generate a tailored prompt so a coding agent can build the first draft." },
    ],
  },
] as const;

export const docOrder: string[] = docSections.flatMap((s) => s.items.map((i) => i.slug));

export function docMeta(slug: string) {
  for (const s of docSections) {
    const hit = s.items.find((i) => i.slug === slug);
    if (hit) return { ...hit, section: s.title };
  }
  return null;
}

/** Previous/next within the flattened running order. */
export function docNeighbours(slug: string) {
  const i = docOrder.indexOf(slug);
  return {
    prev: i > 0 ? docMeta(docOrder[i - 1]) : null,
    next: i >= 0 && i < docOrder.length - 1 ? docMeta(docOrder[i + 1]) : null,
  };
}
