import { defineSite, page, link, markdown, themes } from "terminaltui";

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
      ],
    }),
  ],
});
