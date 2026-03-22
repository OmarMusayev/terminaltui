import {
  runSiteTests, page, card, link, markdown, divider, spacer,
  section, quote, themes,
} from "../emulator-harness.js";
import { writeFileSync } from "node:fs";

const config = {
  name: "Studio Kira",
  handle: "@studiokira",
  tagline: "Brand identity & web design for indie founders",
  theme: "catppuccin" as const,
  borders: "rounded" as const,
  pages: [
    page("services", {
      title: "Services",
      icon: "✨",
      content: [
        card({
          title: "Brand Identity Package",
          body: "Complete visual identity including logo design, color palette, typography system, and brand guidelines document. Includes 3 initial concepts, 2 rounds of revisions, and final deliverables in all formats.",
          subtitle: "$3,500",
          tags: ["Branding", "Logo", "Guidelines"],
        }),
        card({
          title: "Website Design & Build",
          body: "Custom website designed in Figma and built with Astro or Next.js. Includes responsive design, SEO optimization, CMS integration, and hosting setup. Up to 8 pages.",
          subtitle: "$5,000",
          tags: ["Web Design", "Development", "SEO"],
        }),
        card({
          title: "Brand + Web Bundle",
          body: "The full package: brand identity and website delivered together for a cohesive launch. Includes everything from both individual packages plus social media templates and launch strategy.",
          subtitle: "$7,500",
          tags: ["Full Package", "Best Value"],
        }),
        card({
          title: "Monthly Retainer",
          body: "Ongoing design support for growing businesses. Includes up to 20 hours of design work per month covering social media graphics, landing pages, email templates, and ad creative.",
          subtitle: "$2,000/mo",
          tags: ["Ongoing", "Flexible"],
        }),
      ],
    }),
    page("work", {
      title: "Work",
      icon: "💼",
      content: [
        card({
          title: "Murmur Coffee Roasters",
          body: "Complete rebrand for a specialty coffee roaster in Austin. New logo, packaging design for 12 single-origin bags, retail signage, and a Shopify storefront that increased online sales by 340%.",
          subtitle: "Brand + Web — 2025",
          tags: ["Coffee", "E-Commerce", "Packaging"],
        }),
        card({
          title: "Theorem Fitness",
          body: "Brand identity and member portal for a boutique gym. Designed a modular logo system that works across signage, apparel, and digital. The app UI won a 2025 Webby honoree mention.",
          subtitle: "Brand + App — 2025",
          tags: ["Fitness", "App Design", "Award Winner"],
        }),
        card({
          title: "Nightbloom Press",
          body: "Visual identity for an independent literary publisher. Designed a flexible system of botanical illustrations, custom serif wordmark, and book cover templates for their debut catalog.",
          subtitle: "Brand — 2024",
          tags: ["Publishing", "Editorial", "Illustration"],
        }),
        card({
          title: "Archway Analytics",
          body: "Marketing site and investor deck for a Series A data analytics startup. Clean, data-forward design that helped close a $12M round.",
          subtitle: "Web + Deck — 2024",
          tags: ["SaaS", "B2B", "Fundraising"],
        }),
        card({
          title: "Wild Provisions",
          body: "E-commerce site and brand identity for a sustainable outdoor gear company. Custom Shopify theme with 3D product viewers and a carbon-offset calculator at checkout.",
          subtitle: "Brand + Web — 2023",
          tags: ["E-Commerce", "Sustainability", "3D"],
        }),
      ],
    }),
    page("testimonials", {
      title: "Testimonials",
      icon: "💬",
      content: [
        quote(
          "Kira understood our vision before we could articulate it ourselves. The brand she built for Murmur is the reason people recognize our bags on the shelf.",
          "Jesse Morales, Murmur Coffee Roasters"
        ),
        quote(
          "Working with Studio Kira was the best investment we made during our Series A. The marketing site she designed gave us instant credibility with investors.",
          "Priya Sharma, Archway Analytics"
        ),
        quote(
          "She doesn't just design pretty things — she designs systems that scale. Two years later, our brand still feels fresh because the foundation she built is so solid.",
          "Dani Ortega, Theorem Fitness"
        ),
        quote(
          "Kira is the rare designer who understands both aesthetics and business. She pushed back on ideas that looked good but wouldn't convert, and she was always right.",
          "Robin Liu, Wild Provisions"
        ),
      ],
    }),
    page("contact", {
      title: "Contact",
      icon: "📬",
      content: [
        markdown(
          "## Let's Work Together\n\n" +
          "I take on 2-3 new projects per quarter to give every client my full attention. " +
          "If you're interested in working together, send me an email with a brief description " +
          "of your project, your timeline, and your budget range.\n\n" +
          "I typically respond within 48 hours. If we're a good fit, we'll schedule a free " +
          "30-minute discovery call to discuss your project in detail.\n\n" +
          "Currently booking for **Q3 2026**."
        ),
        spacer(1),
        link("Email", "mailto:hello@studiokira.co"),
        link("Instagram", "https://instagram.com/studiokira"),
        link("Dribbble", "https://dribbble.com/studiokira"),
      ],
    }),
  ],
};

const report = runSiteTests(config, "agent-7-freelancer");
writeFileSync("test-sites/freelancer/report.json", JSON.stringify(report, null, 2));

const p = report.tests_passed;
const f = report.tests_failed;
const b = report.bugs.length;
console.log(`\nAgent 7 — Freelancer (Studio Kira): ${p} passed, ${f} failed, ${b} bugs`);
if (report.bugs.length > 0) {
  for (const bug of report.bugs) console.log(`  [${bug.severity}] ${bug.title}`);
}
if (f > 0) {
  console.log("\nFailed tests:");
  console.log(report.notes);
}
