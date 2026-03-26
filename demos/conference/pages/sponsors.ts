import {
  card,
  section,
  markdown,
  link,
  spacer,
  row,
  col,
} from "../../../src/index.js";

export const metadata = { label: "Sponsors", icon: "$" };

export default function Sponsors() {
  return [
    markdown(`
## Our Sponsors

TermConf is made possible by companies building the future of the terminal. Interested in sponsoring? Packages start at $2,500.
    `),
    spacer(),

    // Gold Sponsors
    section("Gold Sponsors", [
      row([
        col(
          [
            card({
              title: "Warp",
              subtitle: "Keynote Stage Sponsor",
              body: "Reimagining the terminal with GPU-accelerated rendering and collaborative features. Main hall branding, keynote stage naming rights, and 20 attendee tickets.",
              tags: ["Gold", "20 Tickets"],
            }),
          ],
          { span: 6, sm: 12, xs: 12 },
        ),
        col(
          [
            card({
              title: "Charm",
              subtitle: "Workshop Space Sponsor",
              body: "Makers of Bubble Tea, Lip Gloss, and the tools that make beautiful CLIs possible. Workshop sponsorship, after-party host, and 15 attendee tickets.",
              tags: ["Gold", "15 Tickets"],
            }),
          ],
          { span: 6, sm: 12, xs: 12 },
        ),
      ]),
    ]),
    spacer(),

    // Silver Sponsors
    section("Silver Sponsors", [
      row([
        col(
          [
            card({
              title: "Anthropic",
              subtitle: "AI Track Sponsor",
              body: "Building Claude and pioneering AI-assisted developer workflows. AI track sponsorship, demo booth, and 10 attendee tickets.",
              tags: ["Silver", "10 Tickets"],
            }),
          ],
          { span: 4, sm: 6, xs: 12 },
        ),
        col(
          [
            card({
              title: "Vercel",
              subtitle: "DX Track Sponsor",
              body: "The platform for frontend developers with world-class CLI tooling. DX track sponsorship, swag bags, and 10 attendee tickets.",
              tags: ["Silver", "10 Tickets"],
            }),
          ],
          { span: 4, sm: 6, xs: 12 },
        ),
        col(
          [
            card({
              title: "Ghostty",
              subtitle: "Lounge Sponsor",
              body: "A fast, cross-platform terminal emulator focused on correctness and native rendering. Lounge naming rights, lanyard sponsor, and 8 attendee tickets.",
              tags: ["Silver", "8 Tickets"],
            }),
          ],
          { span: 4, sm: 6, xs: 12 },
        ),
      ]),
    ]),
    spacer(),

    // Community Sponsors
    section("Community Sponsors", [
      row([
        col(
          [
            card({
              title: "Nerd Fonts",
              subtitle: "Badge Sponsor",
              body: "Patches developer-targeted fonts with a high number of glyphs and icons. Conference badge sponsorship and 5 attendee tickets.",
              tags: ["Community", "5 Tickets"],
            }),
          ],
          { span: 4, sm: 6, xs: 12 },
        ),
        col(
          [
            card({
              title: "Starship",
              subtitle: "Coffee Station Sponsor",
              body: "A minimal, blazing-fast, and infinitely customizable cross-shell prompt. Coffee station sponsorship and 5 attendee tickets.",
              tags: ["Community", "5 Tickets"],
            }),
          ],
          { span: 4, sm: 6, xs: 12 },
        ),
        col(
          [
            card({
              title: "Zellij",
              subtitle: "Breakout Room Sponsor",
              body: "A modern terminal multiplexer with WebAssembly plugin support and floating panes. Breakout room sponsorship and 5 attendee tickets.",
              tags: ["Community", "5 Tickets"],
            }),
          ],
          { span: 4, sm: 6, xs: 12 },
        ),
      ]),
    ]),
    spacer(),
    link("Become a Sponsor", "https://termconf.dev/sponsors", { icon: "$" }),
    link("Contact: sponsors@termconf.dev", "mailto:sponsors@termconf.dev", { icon: ">" }),
  ];
}
