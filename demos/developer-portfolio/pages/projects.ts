import {
  card, spacer, searchInput,
  row, col,
} from "../../../src/index.js";

export const metadata = { label: "Projects", icon: ">>" };

export default function Projects() {
  return [
    searchInput({
      id: "search-projects",
      placeholder: "Search projects...",
      action: "navigate",
      items: [
        { label: "Patchwork", value: "patchwork", keywords: ["React", "collaborative", "editor"] },
        { label: "Vektor", value: "vektor", keywords: ["CLI", "TypeScript", "database"] },
        { label: "Halflight", value: "halflight", keywords: ["React Native", "meditation", "mobile"] },
        { label: "Terracotta", value: "terracotta", keywords: ["design system", "components", "open source"] },
        { label: "Canopy", value: "canopy", keywords: ["real-time", "analytics", "dashboard"] },
        { label: "Fathom", value: "fathom", keywords: ["NLP", "search", "semantic"] },
      ],
    }),
    spacer(),
    row([
      col([
        card({
          title: "Patchwork",
          subtitle: "Lead Engineer @ Stitch (2024 - Present)",
          body: "A collaborative document editor built on CRDTs that handles 50k+ concurrent users. Real-time cursors, inline comments, version history, and a plugin SDK used by 200+ teams. Built with React, Hocuspocus, and Y.js.",
          tags: ["React", "CRDTs", "WebSockets", "TypeScript"],
          url: "https://stitch.dev/patchwork",
        }),
      ], { span: 6, xs: 12 }),
      col([
        card({
          title: "Vektor",
          subtitle: "Open Source (2024)",
          body: "A type-safe database query builder and migration toolkit for TypeScript. Compiles queries at build time for zero-runtime overhead. Supports PostgreSQL, SQLite, and MySQL with full IntelliSense. 4.2k GitHub stars.",
          tags: ["TypeScript", "PostgreSQL", "CLI", "Open Source"],
          url: "https://github.com/arivera/vektor",
        }),
      ], { span: 6, xs: 12 }),
    ], { gap: 1 }),
    row([
      col([
        card({
          title: "Halflight",
          subtitle: "Co-founder @ Halflight (2022 - 2023)",
          body: "A meditation and breathwork app with adaptive audio that responds to biometric data from Apple Watch. 180k downloads in the first year. Featured in the App Store and covered by TechCrunch.",
          tags: ["React Native", "HealthKit", "Audio", "Mobile"],
          url: "https://halflight.app",
        }),
      ], { span: 6, xs: 12 }),
      col([
        card({
          title: "Terracotta",
          subtitle: "Open Source (2023)",
          body: "A headless component library for React with built-in accessibility, animation primitives, and theme tokens. Used by 900+ projects. Fully tree-shakable with zero dependencies outside React.",
          tags: ["React", "Design System", "A11y", "Open Source"],
          url: "https://github.com/arivera/terracotta",
        }),
      ], { span: 6, xs: 12 }),
    ], { gap: 1 }),
    row([
      col([
        card({
          title: "Canopy",
          subtitle: "Senior Engineer @ Verdant (2021 - 2022)",
          body: "Real-time analytics dashboard for e-commerce brands. Ingests 2M events/day through a custom pipeline built on Kafka and ClickHouse. Sub-second query times on datasets with billions of rows.",
          tags: ["Next.js", "Kafka", "ClickHouse", "Real-time"],
          url: "https://verdant.io/canopy",
        }),
      ], { span: 6, xs: 12 }),
      col([
        card({
          title: "Fathom",
          subtitle: "Open Source (2022)",
          body: "A semantic search engine for codebases. Uses transformer embeddings to index and query code by meaning rather than keywords. Supports 12 languages. Powers internal search at three mid-size companies.",
          tags: ["Python", "NLP", "Search", "Open Source"],
          url: "https://github.com/arivera/fathom",
        }),
      ], { span: 6, xs: 12 }),
    ], { gap: 1 }),
  ];
}
