import {
  card, row, col,
} from "../../../src/index.js";

export const metadata = { label: "Writing", icon: "//" };

export default function Writing() {
  return [
    row([
      col([
        card({
          title: "CRDTs in Production: What Nobody Tells You",
          subtitle: "February 2026",
          body: "After two years running CRDTs in a collaborative editor used by 200+ teams, here are the real tradeoffs. Tombstone bloat, clock drift, and the undo problem are harder than any blog post suggests. Includes our solutions and benchmarks.",
          url: "https://alexrivera.dev/blog/crdts-in-production",
        }),
      ], { span: 6, xs: 12 }),
      col([
        card({
          title: "Replacing Redux with Signals: A Migration Story",
          subtitle: "October 2025",
          body: "How we migrated a 120k-line React app from Redux to a signals-based architecture over three months without a single day of downtime. Bundle size dropped 34% and re-render counts fell by 80%.",
          url: "https://alexrivera.dev/blog/replacing-redux-with-signals",
        }),
      ], { span: 6, xs: 12 }),
    ], { gap: 1 }),
    row([
      col([
        card({
          title: "The Case for Boring Technology in 2025",
          subtitle: "July 2025",
          body: "PostgreSQL, Express, and server-rendered HTML got us to 15k users and $2M ARR. A defense of choosing proven tools over the latest framework, and why the most productive stack is the one your team already knows.",
          url: "https://alexrivera.dev/blog/boring-technology-2025",
        }),
      ], { span: 6, xs: 12 }),
      col([
        card({
          title: "Building Accessible Components from Scratch",
          subtitle: "March 2025",
          body: "The lessons I learned building Terracotta, a headless component library with first-class accessibility. Covers ARIA patterns, focus management, screen reader testing, and why most component libraries get it wrong.",
          url: "https://alexrivera.dev/blog/accessible-components",
        }),
      ], { span: 6, xs: 12 }),
    ], { gap: 1 }),
  ];
}
