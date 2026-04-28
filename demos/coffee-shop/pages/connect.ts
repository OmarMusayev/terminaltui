import {
  divider,
  link,
  form,
  textInput,
  textArea,
  select,
  button,
  columns,
  panel,
} from "../../../src/index.js";

export const metadata = { label: "Connect", icon: "->" };

export default function Connect() {
  return [
    columns([
      panel({ width: "55%", content: [
        divider("Catering & Events"),
        form({
          id: "catering-inquiry",
          resetOnSubmit: true,
          onSubmit: async (data) => ({
            success: `Thanks, ${data.name}! We'll be in touch about your ${data.type} inquiry within 48 hours.`,
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
              id: "type",
              label: "Inquiry Type",
              options: [
                { label: "Catering", value: "catering" },
                { label: "Event", value: "event" },
                { label: "Wholesale", value: "wholesale" },
                { label: "Other", value: "other" },
              ],
            }),
            textArea({
              id: "details",
              label: "Details",
              rows: 3,
              placeholder: "Tell us about your event, order size, or question...",
            }),
            button({ label: "Submit Inquiry", style: "primary" }),
          ],
        }),
      ]}),
      panel({ width: "45%", content: [
        divider("Follow Along"),
        link("Instagram", "https://instagram.com/emberandbrew", { icon: ">" }),
        link("Order Online", "https://order.emberandbrew.com", { icon: ">" }),
        link("Wholesale Inquiries", "mailto:wholesale@emberandbrew.com", { icon: ">" }),
        link("Gift Cards", "https://emberandbrew.com/gift", { icon: ">" }),
      ]}),
    ]),
  ];
}
