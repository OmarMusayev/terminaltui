import {
  card, spacer, link, table,
  form, textInput, textArea, select, button,
  split,
} from "../../../src/index.js";

export const metadata = { label: "Contact", icon: "@" };

export default function Contact() {
  return [
    split({
      direction: "horizontal",
      ratio: 40,
      border: true,
      first: [
        card({
          title: "Currently Booking Q3 2026",
          subtitle: "Availability",
          body: "Accepting new projects for July through September 2026. I work best with founders and small teams who care deeply about craft. Minimum engagement: $4,000. Most projects run 4-14 weeks depending on scope.",
          tags: ["Open", "Q3 2026"],
        }),
        spacer(),
        table(
          ["Service", "Starting At", "Timeline"],
          [
            ["Brand Identity", "$8,000", "6-8 weeks"],
            ["Web Design", "$12,000", "8-10 weeks"],
            ["UX Audit", "$4,000", "2-3 weeks"],
            ["Design System", "$15,000", "10-14 weeks"],
          ],
        ),
        spacer(),
        link("Email", "mailto:hello@studiokira.design", { icon: ">" }),
        link("Dribbble", "https://dribbble.com/studiokira", { icon: ">" }),
        link("Are.na", "https://are.na/studiokira", { icon: ">" }),
        link("LinkedIn", "https://linkedin.com/in/studiokira", { icon: ">" }),
        link("Read.cv", "https://read.cv/kira", { icon: ">" }),
      ],
      second: [
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
      ],
    }),
  ];
}
