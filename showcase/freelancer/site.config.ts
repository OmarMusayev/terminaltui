import {
  defineSite,
  page,
  card,
  markdown,
  link,
  divider,
  spacer,
  form,
  textInput,
  textArea,
  button,
} from "../../src/index.js";
import type { Theme } from "../../src/index.js";

const warmEarth: Theme = {
  accent: "#c4956a",
  accentDim: "#a07850",
  text: "#e8d5c4",
  muted: "#9c8578",
  subtle: "#6b5549",
  success: "#b5c4a0",
  warning: "#d4a96a",
  error: "#c47060",
  border: "#7a6358",
  bg: "#2c2218",
};

export default defineSite({
  name: "Studio Kira",
  tagline: "Design with intention",
  banner: {
    text: "KIRA",
    font: "Colossal",
  },
  theme: warmEarth,
  borders: "dashed",
  animations: {
    transitions: "fade",
    exitMessage: "Thanks for visiting Studio Kira.",
  },
  pages: [
    page("services", {
      title: "Services",
      icon: "*",
      content: [
        card({
          title: "Brand Identity",
          subtitle: "Starting at $3,000",
          body: "Complete visual identity systems from the ground up. Logo design, color palettes, typography selection, brand guidelines, and asset libraries. Includes three concept rounds, a 40-page brand book, and all source files. Typical timeline: 4-6 weeks.",
          tags: ["Logo", "Guidelines", "Typography", "Color"],
        }),
        card({
          title: "Web Design",
          subtitle: "Starting at $5,000",
          body: "Responsive website design with obsessive attention to layout, whitespace, and interaction. Figma deliverables with full component libraries, responsive breakpoints, and developer-ready specs. Includes user flow mapping and two revision rounds. Typical timeline: 6-8 weeks.",
          tags: ["Figma", "Responsive", "Components", "UX"],
        }),
        card({
          title: "Product Design",
          subtitle: "Starting at $8,000",
          body: "End-to-end product design for web and mobile applications. User research, information architecture, wireframes, high-fidelity prototypes, and usability testing. Embedded with your team for the full engagement. Typical timeline: 8-12 weeks.",
          tags: ["Product", "Research", "Prototyping", "Mobile"],
        }),
        card({
          title: "Design Systems",
          subtitle: "Starting at $12,000",
          body: "Scalable design systems built for growing teams. Token architecture, component libraries in Figma and code, documentation, governance guidelines, and team onboarding workshops. Built to evolve with your product. Typical timeline: 10-14 weeks.",
          tags: ["Systems", "Tokens", "Documentation", "Scale"],
        }),
      ],
    }),

    page("work", {
      title: "Work",
      icon: ">>",
      content: [
        card({
          title: "Solstice Wellness",
          subtitle: "2026",
          body: "Complete rebrand and web redesign for a holistic wellness platform. Crafted a warm, grounded visual identity that bridges clinical trust with approachable warmth. Increased trial signups by 34%.",
          tags: ["Healthcare", "Branding", "Web"],
        }),
        card({
          title: "Terraform Coffee",
          subtitle: "2025",
          body: "Brand identity and packaging design for a specialty roaster. Designed a modular label system that scales across 20+ single-origin varieties while maintaining shelf cohesion. Featured in Brand New.",
          tags: ["Food & Beverage", "Packaging", "Identity"],
        }),
        card({
          title: "Luminary Finance",
          subtitle: "2025",
          body: "Product design for a personal finance dashboard. Simplified complex portfolio data into clean, scannable interfaces. Reduced average task completion time by 40% in usability testing.",
          tags: ["Fintech", "Product Design", "Data Viz"],
        }),
        card({
          title: "Arcadia Games",
          subtitle: "2024",
          body: "Design system for an indie game studio's web presence. Built a retro-modern component library with pixel-art-inspired tokens. Powers their storefront, community hub, and developer docs.",
          tags: ["Gaming", "Design System", "Web"],
        }),
        card({
          title: "Verdant Architecture",
          subtitle: "2024",
          body: "Portfolio website for a sustainable architecture firm. Minimalist gallery-driven layout with full-bleed photography, project case studies, and a custom CMS integration.",
          tags: ["Architecture", "Portfolio", "Minimalism"],
        }),
        card({
          title: "Thread & Bone",
          subtitle: "2023",
          body: "Brand identity for an independent fashion label. Hand-drawn logotype, textile-inspired patterns, and a tactile visual language that translates from woven labels to digital lookbooks.",
          tags: ["Fashion", "Identity", "Handcraft"],
        }),
      ],
    }),

    page("testimonials", {
      title: "Testimonials",
      icon: "\"",
      content: [
        card({
          title: "Elena Marchetti",
          subtitle: "Founder at Solstice Wellness",
          body: "Kira didn't just design our brand — she understood our story and gave it a visual language. Every detail feels intentional. Two years later, we still get compliments on our identity daily.",
        }),
        card({
          title: "James Chen",
          subtitle: "CTO at Luminary Finance",
          body: "Working with Studio Kira transformed how our team thinks about design. The system she built isn't just beautiful — it's practical, scalable, and our engineers actually enjoy using it.",
        }),
        card({
          title: "Rosa Gutierrez",
          subtitle: "Co-founder at Terraform Coffee",
          body: "The packaging Kira designed for us sells itself. We've watched customers pick up our bags purely because of the label design. She turned our beans into a shelf experience.",
        }),
        card({
          title: "David Okafor",
          subtitle: "Principal at Verdant Architecture",
          body: "Kira has a rare talent for making the complex feel simple. Our architecture portfolio went from a cluttered mess to a calm, confident showcase. Inquiries doubled within three months.",
        }),
      ],
    }),

    page("contact", {
      title: "Contact",
      icon: "@",
      content: [
        card({
          title: "Availability",
          subtitle: "Currently Booking Q3 2026",
          body: "Accepting new projects for Q3 2026 and beyond. I work best with founders and small teams who care deeply about craft and are willing to invest in design that lasts. Minimum engagement: $3,000. Typical projects run 4-14 weeks.",
          tags: ["Open", "Q3 2026"],
        }),
        markdown(`
### How it works

1. **Intro call** — 30 minutes to discuss your project, goals, and timeline
2. **Proposal** — A detailed scope, timeline, and investment breakdown within 48 hours
3. **Kickoff** — Discovery phase begins with a deep dive into your brand and audience
4. **Delivery** — Iterative design with regular check-ins and structured feedback rounds
        `),
        divider(),
        form({
          id: "contact",
          onSubmit: async (data) => ({ success: "Message sent! I'll get back to you soon." }),
          fields: [
            textInput({ id: "name", label: "Your Name", validate: (v) => v ? null : "Required" }),
            textInput({ id: "email", label: "Email", validate: (v) => v.includes("@") ? null : "Invalid email" }),
            textArea({ id: "message", label: "Message", rows: 4, placeholder: "Tell me about your project..." }),
            button({ label: "Send Message", style: "primary" }),
          ],
        }),
        spacer(),
        link("Email", "mailto:hello@studiokira.design", { icon: ">" }),
        link("Dribbble", "https://dribbble.com/studiokira", { icon: ">" }),
        link("Twitter", "https://twitter.com/studiokira", { icon: ">" }),
      ],
    }),
  ],
});
