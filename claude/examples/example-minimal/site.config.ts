import { defineSite, page, link, markdown, themes, form, textInput, textArea, button, spacer } from "terminaltui";

export default defineSite({
  name: "Jane Doe",
  tagline: "hello world",
  theme: themes.dracula,
  pages: [
    page("about", {
      title: "About",
      icon: "◆",
      content: [markdown("Hi! I'm Jane. Welcome to my terminal.")],
    }),
    page("links", {
      title: "Links",
      icon: "◉",
      content: [
        link("GitHub", "https://github.com/janedoe"),
        link("Email", "mailto:jane@example.com"),
        form({ id: "contact", onSubmit: async (data) => ({ success: "Message sent!" }),
          fields: [
            textInput({ id: "email", label: "Email", placeholder: "you@email.com", validate: v => v.includes("@") ? null : "Invalid email" }),
            textArea({ id: "message", label: "Message", rows: 3 }),
            button({ label: "Send", style: "primary" }),
          ],
        }),
        spacer(),
      ],
    }),
  ],
});
