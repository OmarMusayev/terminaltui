import {
  card,
  hero,
  markdown,
  spacer,
  row,
  col,
  container,
} from "../../../src/index.js";

export const metadata = { label: "Home", icon: "~" };

export default function Home() {
  return [
    hero({
      title: "The Terminal Renaissance",
      subtitle:
        "June 15-16, Portland OR. Two days of talks on CLI tools, TUI frameworks, and terminal culture. 30+ speakers, hands-on workshops, and the largest gathering of terminal enthusiasts on the West Coast.",
      cta: { label: "Register Now", url: "https://termconf.dev/register" },
    }),
    spacer(),
    container(
      [
        markdown(`
## Why TermConf?

The terminal is having a moment. From GPU-accelerated emulators to rich TUI frameworks, from AI-powered shells to elegant CLI tools, the command line is being reimagined for a new generation.

TermConf brings together the builders, designers, and thinkers pushing the terminal forward. Whether you ship CLI tools, design TUI interfaces, or simply live in your terminal, this is your conference.
        `),
      ],
      { maxWidth: 90 },
    ),
    spacer(),
    row(
      [
        col(
          [
            card({
              title: "30+ Talks",
              subtitle: "Two stages, two days",
              body: "From keynotes to deep dives, covering GPU rendering, AI-powered shells, TUI frameworks, and the art of designing for 80 columns.",
              tags: ["Keynotes", "Deep Dives"],
            }),
          ],
          { span: 4, sm: 6, xs: 12 },
        ),
        col(
          [
            card({
              title: "Hands-On Workshops",
              subtitle: "Build something real",
              body: "Half-day workshops on Bubble Tea, Rust CLI tooling, terminal rendering, and AI-assisted development. Limited to 30 seats each.",
              tags: ["Bubble Tea", "Rust CLI", "AI Dev"],
            }),
          ],
          { span: 4, sm: 6, xs: 12 },
        ),
        col(
          [
            card({
              title: "Networking",
              subtitle: "Meet your terminal people",
              body: "Open lounge with power outlets at every seat, after-party at a Portland brewery, and hallway track conversations that turn into open source collaborations.",
              tags: ["Lounge", "After-Party"],
            }),
          ],
          { span: 4, sm: 6, xs: 12 },
        ),
      ],
      { gap: 1 },
    ),
    spacer(),
    row([
      col(
        [
          card({
            title: "Tickets",
            subtitle: "Early bird pricing ends May 1st",
            body: "General admission $299. Student tickets $99. Group discounts available for teams of 5+.",
            tags: ["$299 General", "$99 Student"],
          }),
        ],
        { span: 6, sm: 12, xs: 12 },
      ),
      col(
        [
          card({
            title: "Conference at a Glance",
            subtitle: "June 15-16, 2026",
            body: "30+ speakers across 12 sessions. Hands-on workshops, open lounge, and after-party. The largest gathering of terminal enthusiasts on the West Coast.",
            tags: ["2 Days", "30+ Speakers", "800 Seats"],
          }),
        ],
        { span: 6, sm: 12, xs: 12 },
      ),
    ]),
  ];
}
