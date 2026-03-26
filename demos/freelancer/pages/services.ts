import {
  card, divider, spacer,
  row, col,
} from "../../../src/index.js";

export const metadata = { label: "Services", icon: "*" };

export default function Services() {
  return [
    divider("What I Do"),
    spacer(),
    row([
      col([
        card({
          title: "Brand Identity",
          subtitle: "$8,000",
          body: "Complete visual identity systems built from research, not assumptions. Logo design, color systems, typography selection, a 50-page brand book, and a full asset library. Three concept rounds with structured feedback. Typical timeline: 6-8 weeks.",
          tags: ["Logo", "Guidelines", "Typography", "Color Systems"],
        }),
      ], { span: 6, xs: 12 }),
      col([
        card({
          title: "Web Design",
          subtitle: "$12,000",
          body: "Responsive website design with obsessive attention to layout, whitespace, and micro-interactions. Figma deliverables with full component libraries, responsive breakpoints, and developer-ready specs. Includes user flow mapping, content strategy, and two revision rounds. Typical timeline: 8-10 weeks.",
          tags: ["Figma", "Responsive", "Components", "Content Strategy"],
        }),
      ], { span: 6, xs: 12 }),
    ], { gap: 1 }),
    row([
      col([
        card({
          title: "UX Audit",
          subtitle: "$4,000",
          body: "A thorough evaluation of your existing product experience. Heuristic analysis, user flow mapping, accessibility review, and a prioritized list of improvements with mockups for the top 5 issues. Delivered as a 30-page report with before/after comparisons. Typical timeline: 2-3 weeks.",
          tags: ["Research", "Accessibility", "Analysis", "Quick Turn"],
        }),
      ], { span: 6, xs: 12 }),
      col([
        card({
          title: "Design System",
          subtitle: "$15,000",
          body: "Scalable design systems for growing engineering teams. Token architecture, component libraries in Figma and code, comprehensive documentation, governance guidelines, and a half-day team onboarding workshop. Built to evolve with your product across platforms. Typical timeline: 10-14 weeks.",
          tags: ["Tokens", "Documentation", "Components", "Scale"],
        }),
      ], { span: 6, xs: 12 }),
    ], { gap: 1 }),
  ];
}
