import {
  card, spacer, searchInput,
  row, col, container,
} from "../../../src/index.js";

export const metadata = { label: "Work", icon: ">>" };

export default function Work() {
  return [
    searchInput({
      id: "project-search",
      placeholder: "Search projects...",
      action: "navigate",
      items: [
        { label: "Solstice Wellness — Rebrand & Web", value: "solstice", keywords: ["healthcare", "branding", "web design"] },
        { label: "Terraform Coffee — Identity & Packaging", value: "terraform", keywords: ["food", "beverage", "packaging"] },
        { label: "Luminary Finance — Product Design", value: "luminary", keywords: ["fintech", "dashboard", "data viz"] },
        { label: "Arcadia Games — Design System", value: "arcadia", keywords: ["gaming", "components", "retro"] },
        { label: "Verdant Architecture — Portfolio Site", value: "verdant", keywords: ["architecture", "portfolio", "minimalism"] },
        { label: "Thread & Bone — Brand Identity", value: "thread-bone", keywords: ["fashion", "identity", "handcraft"] },
      ],
    }),
    spacer(),
    container([
      row([
        col([
          card({
            title: "Solstice Wellness",
            subtitle: "2026 — Rebrand & Web Redesign",
            body: "Complete rebrand for a holistic wellness platform serving 40,000 monthly users. Crafted a warm, grounded visual identity that bridges clinical trust with approachable warmth. New site architecture reduced bounce rate by 28% and increased trial signups by 34%.",
            tags: ["Healthcare", "Branding", "Web Design"],
          }),
        ], { span: 6, xs: 12 }),
        col([
          card({
            title: "Terraform Coffee",
            subtitle: "2025 — Identity & Packaging",
            body: "Brand identity and packaging design for a specialty roaster expanding to 200+ retail locations. Designed a modular label system that scales across 20+ single-origin varieties while maintaining shelf cohesion. Featured in Brand New and Dieline.",
            tags: ["Food & Beverage", "Packaging", "Identity"],
          }),
        ], { span: 6, xs: 12 }),
      ], { gap: 1 }),
      row([
        col([
          card({
            title: "Luminary Finance",
            subtitle: "2025 — Product Design",
            body: "Product design for a personal finance dashboard used by 12,000 active users. Simplified complex portfolio data into clean, scannable interfaces with custom data visualizations. Reduced average task completion time by 40% in usability testing.",
            tags: ["Fintech", "Product Design", "Data Visualization"],
          }),
        ], { span: 6, xs: 12 }),
        col([
          card({
            title: "Arcadia Games",
            subtitle: "2024 — Design System",
            body: "Design system for an indie game studio's web presence spanning storefront, community hub, and developer docs. Built a retro-modern component library with pixel-art-inspired tokens. 140 components, fully documented, adopted by a team of 8 engineers.",
            tags: ["Gaming", "Design System", "Documentation"],
          }),
        ], { span: 6, xs: 12 }),
      ], { gap: 1 }),
      row([
        col([
          card({
            title: "Verdant Architecture",
            subtitle: "2024 — Portfolio Website",
            body: "Portfolio website for a sustainable architecture firm known for mass timber projects. Minimalist gallery-driven layout with full-bleed photography, project case studies, and a custom CMS. Inquiries doubled within three months of launch.",
            tags: ["Architecture", "Portfolio", "Minimalism"],
          }),
        ], { span: 6, xs: 12 }),
        col([
          card({
            title: "Thread & Bone",
            subtitle: "2023 — Brand Identity",
            body: "Brand identity for an independent fashion label working with deadstock fabrics. Hand-drawn logotype, textile-inspired patterns, and a tactile visual language that translates from woven labels to digital lookbooks. Nominated for a Brand Impact Award.",
            tags: ["Fashion", "Identity", "Handcraft"],
          }),
        ], { span: 6, xs: 12 }),
      ], { gap: 1 }),
    ], { maxWidth: 95 }),
  ];
}
