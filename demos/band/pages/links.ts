import {
  divider,
  link,
  spacer,
  form,
  textInput,
  button,
  row,
  col,
} from "../../../src/index.js";

export const metadata = { label: "Links", icon: "->" };

export default function Links() {
  return [
    form({
      id: "mailing-list",
      resetOnSubmit: true,
      onSubmit: async (data) => ({
        success: `You're on the list. We'll send updates to ${data.email}.`,
      }),
      fields: [
        textInput({
          id: "email",
          label: "Join the mailing list",
          placeholder: "your@email.com",
          validate: (v) => (v.includes("@") ? null : "Please enter a valid email"),
        }),
        button({ label: "Subscribe", style: "primary" }),
      ],
    }),
    spacer(),
    divider("Listen"),
    row([
      col([
        link("Spotify", "https://open.spotify.com/artist/glasscathedral", { icon: ">" }),
        link("Apple Music", "https://music.apple.com/artist/glass-cathedral", { icon: ">" }),
      ], { span: 6, xs: 12 }),
      col([
        link("Bandcamp", "https://glasscathedral.bandcamp.com", { icon: ">" }),
      ], { span: 6, xs: 12 }),
    ], { gap: 1 }),
    divider("Follow"),
    row([
      col([
        link("Instagram", "https://instagram.com/glasscathedral", { icon: ">" }),
        link("Twitter", "https://twitter.com/glass_cathedral", { icon: ">" }),
      ], { span: 6, xs: 12 }),
      col([
        link("Merch Store", "https://glasscathedral.bigcartel.com", { icon: ">" }),
        link("Booking", "mailto:booking@glasscathedral.com", { icon: ">" }),
      ], { span: 6, xs: 12 }),
    ], { gap: 1 }),
  ];
}
