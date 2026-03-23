import { defineSite, page, markdown, link, quote, spacer, divider, ascii, themes, form, textInput, button } from "terminaltui";

export default defineSite({
  name: "VOID.SYS",
  tagline: "[ experimental digital art space ]",
  banner: ascii("VOID.SYS", { font: "Slant", gradient: ["#ff2a6d", "#05d9e8", "#d1f7ff"] }),
  theme: themes.cyberpunk,
  borders: "heavy",
  animations: {
    boot: true,
    transitions: "wipe",
    exitMessage: "[ CONNECTION TERMINATED ]",
  },

  pages: [
    page("manifesto", {
      title: "MANIFESTO",
      icon: "✦",
      content: [
        spacer(2),
        markdown("We build at the intersection of code and art."),
        markdown("Every pixel is a decision. Every frame is a statement."),
        spacer(),
        divider("dotted"),
        spacer(),
        quote("The terminal is not a limitation — it's a canvas.", "— VOID.SYS"),
      ],
    }),

    page("works", {
      title: "WORKS",
      icon: "◈",
      content: [
        markdown("**001** — STATIC PRAYER (2026)"),
        markdown("Generative ASCII art installation. Infinite unique frames."),
        spacer(),
        markdown("**002** — ECHO CHAMBER (2025)"),
        markdown("Interactive sound-reactive terminal visualization."),
        spacer(),
        markdown("**003** — DEAD PIXELS (2024)"),
        markdown("A love letter to broken screens and glitch aesthetics."),
      ],
    }),

    page("signal", {
      title: "SIGNAL",
      icon: "◉",
      content: [
        link("Instagram", "https://instagram.com/void.sys"),
        link("Are.na", "https://are.na/void-sys"),
        link("Transmissions", "mailto:signal@void.sys"),
        form({ id: "signal", onSubmit: async (data) => ({ success: "Signal received. You're in." }),
          fields: [
            textInput({ id: "handle", label: "Handle", placeholder: "your@signal.net", validate: v => v ? null : "Required" }),
            button({ label: "Connect", style: "primary" }),
          ],
        }),
        spacer(),
      ],
    }),
  ],
});
