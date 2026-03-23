import {
  defineSite,
  page,
  card,
  quote,
  divider,
  markdown,
  link,
  spacer,
  searchInput,
  form,
  textInput,
  textArea,
  select,
  button,
} from "../../src/index.js";
import type { Theme } from "../../src/index.js";

const studioTheme: Theme = {
  accent: "#c4a882",
  accentDim: "#a68b6b",
  text: "#e8dcc8",
  muted: "#a89984",
  subtle: "#665c54",
  success: "#a9b665",
  warning: "#d8a657",
  error: "#ea6962",
  border: "#665c54",
  bg: "#1d2021",
};

export default defineSite({
  name: "Studio Kira",
  tagline: "design that moves people",
  banner: {
    text: "STUDIO KIRA",
    font: "Calvin S",
  },
  theme: studioTheme,
  borders: "dashed",
  pages: [
    page("services", {
      title: "Services",
      icon: "*",
      content: [
        card({
          title: "Brand Identity",
          subtitle: "$8,000",
          body: "Complete visual identity systems built from research, not assumptions. Logo design, color systems, typography selection, a 50-page brand book, and a full asset library. Three concept rounds with structured feedback. Typical timeline: 6-8 weeks.",
          tags: ["Logo", "Guidelines", "Typography", "Color Systems"],
        }),
        card({
          title: "Web Design",
          subtitle: "$12,000",
          body: "Responsive website design with obsessive attention to layout, whitespace, and micro-interactions. Figma deliverables with full component libraries, responsive breakpoints, and developer-ready specs. Includes user flow mapping, content strategy, and two revision rounds. Typical timeline: 8-10 weeks.",
          tags: ["Figma", "Responsive", "Components", "Content Strategy"],
        }),
        card({
          title: "UX Audit",
          subtitle: "$4,000",
          body: "A thorough evaluation of your existing product experience. Heuristic analysis, user flow mapping, accessibility review, and a prioritized list of improvements with mockups for the top 5 issues. Delivered as a 30-page report with before/after comparisons. Typical timeline: 2-3 weeks.",
          tags: ["Research", "Accessibility", "Analysis", "Quick Turn"],
        }),
        card({
          title: "Design System",
          subtitle: "$15,000",
          body: "Scalable design systems for growing engineering teams. Token architecture, component libraries in Figma and code, comprehensive documentation, governance guidelines, and a half-day team onboarding workshop. Built to evolve with your product across platforms. Typical timeline: 10-14 weeks.",
          tags: ["Tokens", "Documentation", "Components", "Scale"],
        }),
      ],
    }),

    page("work", {
      title: "Work",
      icon: ">>",
      content: [
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
        card({
          title: "Solstice Wellness",
          subtitle: "2026 — Rebrand & Web Redesign",
          body: "Complete rebrand for a holistic wellness platform serving 40,000 monthly users. Crafted a warm, grounded visual identity that bridges clinical trust with approachable warmth. New site architecture reduced bounce rate by 28% and increased trial signups by 34%.",
          tags: ["Healthcare", "Branding", "Web Design"],
        }),
        card({
          title: "Terraform Coffee",
          subtitle: "2025 — Identity & Packaging",
          body: "Brand identity and packaging design for a specialty roaster expanding to 200+ retail locations. Designed a modular label system that scales across 20+ single-origin varieties while maintaining shelf cohesion. Featured in Brand New and Dieline.",
          tags: ["Food & Beverage", "Packaging", "Identity"],
        }),
        card({
          title: "Luminary Finance",
          subtitle: "2025 — Product Design",
          body: "Product design for a personal finance dashboard used by 12,000 active users. Simplified complex portfolio data into clean, scannable interfaces with custom data visualizations. Reduced average task completion time by 40% in usability testing.",
          tags: ["Fintech", "Product Design", "Data Visualization"],
        }),
        card({
          title: "Arcadia Games",
          subtitle: "2024 — Design System",
          body: "Design system for an indie game studio's web presence spanning storefront, community hub, and developer docs. Built a retro-modern component library with pixel-art-inspired tokens. 140 components, fully documented, adopted by a team of 8 engineers.",
          tags: ["Gaming", "Design System", "Documentation"],
        }),
        card({
          title: "Verdant Architecture",
          subtitle: "2024 — Portfolio Website",
          body: "Portfolio website for a sustainable architecture firm known for mass timber projects. Minimalist gallery-driven layout with full-bleed photography, project case studies, and a custom CMS. Inquiries doubled within three months of launch.",
          tags: ["Architecture", "Portfolio", "Minimalism"],
        }),
        card({
          title: "Thread & Bone",
          subtitle: "2023 — Brand Identity",
          body: "Brand identity for an independent fashion label working with deadstock fabrics. Hand-drawn logotype, textile-inspired patterns, and a tactile visual language that translates from woven labels to digital lookbooks. Nominated for a Brand Impact Award.",
          tags: ["Fashion", "Identity", "Handcraft"],
        }),
      ],
    }),

    page("testimonials", {
      title: "Testimonials",
      icon: "\"",
      content: [
        quote(
          "Kira didn't just design our brand — she understood our story and gave it a visual language. Every detail feels intentional. Two years later, we still get compliments on our identity daily.",
          "Elena Marchetti, Founder at Solstice Wellness",
        ),
        spacer(),
        quote(
          "Working with Studio Kira transformed how our team thinks about design. The system she built isn't just beautiful — it's practical, scalable, and our engineers actually enjoy using it.",
          "James Chen, CTO at Luminary Finance",
        ),
        spacer(),
        quote(
          "The packaging Kira designed sells itself. We've watched customers pick up our bags purely because of the label design. She turned our beans into a shelf experience.",
          "Rosa Gutierrez, Co-founder at Terraform Coffee",
        ),
        spacer(),
        quote(
          "Kira has a rare talent for making the complex feel simple. Our portfolio went from a cluttered mess to a calm, confident showcase. Inquiries doubled within three months.",
          "David Okafor, Principal at Verdant Architecture",
        ),
        spacer(),
        quote(
          "She designed our entire component library in eight weeks and it's been running for two years without a major revision. That's how you know the architecture is solid.",
          "Mika Tanaka, Lead Engineer at Arcadia Games",
        ),
      ],
    }),

    page("contact", {
      title: "Contact",
      icon: "@",
      content: [
        card({
          title: "Currently Booking Q3 2026",
          subtitle: "Availability",
          body: "Accepting new projects for July through September 2026. I work best with founders and small teams who care deeply about craft. Minimum engagement: $4,000. Most projects run 4-14 weeks depending on scope.",
          tags: ["Open", "Q3 2026"],
        }),
        divider(),
        form({
          id: "contact-form",
          resetOnSubmit: true,
          onSubmit: async (data) => ({
            success: `Thanks, ${data.name}. I'll review your ${data.projectType} inquiry and reply within 48 hours.`,
          }),
          fields: [
            textInput({
              id: "name",
              label: "Name",
              validate: (v) => (v.trim() ? null : "Required"),
            }),
            textInput({
              id: "email",
              label: "Email",
              validate: (v) => (v.includes("@") ? null : "Enter a valid email"),
            }),
            select({
              id: "projectType",
              label: "Project Type",
              options: [
                { label: "Brand Identity", value: "brand" },
                { label: "Web Design", value: "web" },
                { label: "UX Audit", value: "audit" },
                { label: "Design System", value: "system" },
                { label: "Something Else", value: "other" },
              ],
            }),
            textArea({
              id: "message",
              label: "Tell me about your project",
              rows: 4,
              placeholder: "Budget range, timeline, what you're hoping to achieve...",
            }),
            button({ label: "Send Message", style: "primary" }),
          ],
        }),
        spacer(),
        link("Email", "mailto:hello@studiokira.design", { icon: ">" }),
        link("Dribbble", "https://dribbble.com/studiokira", { icon: ">" }),
        link("Are.na", "https://are.na/studiokira", { icon: ">" }),
        link("LinkedIn", "https://linkedin.com/in/studiokira", { icon: ">" }),
        link("Read.cv", "https://read.cv/kira", { icon: ">" }),
      ],
    }),
  ],
});
