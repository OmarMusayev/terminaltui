import {
  link,
  form,
  textInput,
  textArea,
  select,
  numberInput,
  button,
  split,
  section,
} from "../../../src/index.js";

export const metadata = { label: "Contact", icon: "->" };

export default function Contact() {
  return [
    split({
      direction: "horizontal",
      ratio: 40,
      first: [
        section("Get in Touch", [
          link("Make a Reservation", "https://resy.com/the-rusty-fork", { icon: ">" }),
          link("Instagram", "https://instagram.com/therustyfork", { icon: ">" }),
          link("Email", "mailto:hello@therustyfork.com", { icon: ">" }),
          link("Phone", "tel:+15035550187", { icon: ">" }),
          link("Google Maps", "https://maps.google.com/?q=827+NW+Ironworks+Lane+Portland+OR", { icon: ">" }),
        ]),
      ],
      second: [
        form({
          id: "reservation",
          resetOnSubmit: true,
          onSubmit: async (data) => ({
            success: `Table reserved for ${data.name}, party of ${data.partySize}. See you soon!`,
          }),
          fields: [
            textInput({
              id: "name",
              label: "Name",
              validate: (v) => (v.length > 0 ? null : "Name is required"),
            }),
            textInput({
              id: "email",
              label: "Email",
              validate: (v) => (v.includes("@") ? null : "Please enter a valid email"),
            }),
            select({ id: "date", label: "Date", options: [
              { label: "Today", value: "today" },
              { label: "Tomorrow", value: "tomorrow" },
              { label: "This Friday", value: "friday" },
              { label: "This Saturday", value: "saturday" },
              { label: "This Sunday", value: "sunday" },
            ]}),
            numberInput({ id: "partySize", label: "Party Size", defaultValue: 2, min: 1, max: 12 }),
            textArea({ id: "specialRequests", label: "Special Requests", placeholder: "Allergies, celebrations, seating preferences...", rows: 3 }),
            button({ label: "Reserve Table", style: "primary" }),
          ],
        }),
      ],
    }),
  ];
}
