import {
  defineSite,
  page,
  card,
  link,
  section,
  markdown,
  themes,
  spacer,
  searchInput,
  skillBar,
  form,
  textInput,
  button,
} from "terminaltui";

export default defineSite({
  name: "Byte-Sized",
  tagline: "bite-sized takes on code, systems, and the craft of software — by Sam Torres",
  theme: themes.dracula,
  borders: "rounded",

  pages: [
    page("posts", {
      title: "Posts",
      icon: "▤",
      content: [
        searchInput({
          id: "post-search",
          placeholder: "Search posts...",
          action: "navigate",
          items: [
            { label: "Ownership in Rust Changed How I Think About State", value: "ownership-rust", keywords: ["Rust", "memory", "ownership", "state management"] },
            { label: "Why I Stopped Writing Utility Types by Hand", value: "utility-types", keywords: ["TypeScript", "generics", "utility types", "DRY"] },
            { label: "Designing for Failure: Circuit Breakers in Distributed Systems", value: "circuit-breakers", keywords: ["system design", "distributed", "resilience", "microservices"] },
            { label: "The Hidden Cost of any in TypeScript", value: "hidden-cost-any", keywords: ["TypeScript", "type safety", "any", "refactoring"] },
            { label: "Event Sourcing from Scratch with Rust and SQLite", value: "event-sourcing", keywords: ["Rust", "event sourcing", "SQLite", "architecture"] },
          ],
        }),
        spacer(),
        card({
          title: "Ownership in Rust Changed How I Think About State",
          subtitle: "Mar 2026",
          body: "After six months writing Rust full-time, I started seeing ownership violations everywhere — even in TypeScript. Here's how the borrow checker rewired my mental model for managing shared state.",
          tags: ["Rust", "State Management", "Deep Dive"],
        }),
        card({
          title: "Why I Stopped Writing Utility Types by Hand",
          subtitle: "Feb 2026",
          body: "I used to handcraft mapped types for every project. Then I realized the standard library already solves 90% of the problem — and the remaining 10% probably means your API surface is too complex.",
          tags: ["TypeScript", "Generics", "Hot Take"],
        }),
        card({
          title: "Designing for Failure: Circuit Breakers in Distributed Systems",
          subtitle: "Jan 2026",
          body: "Your service will go down. The question is whether it takes everything else with it. A practical guide to implementing circuit breakers, bulkheads, and graceful degradation.",
          tags: ["System Design", "Distributed Systems", "Reliability"],
        }),
        card({
          title: "The Hidden Cost of any in TypeScript",
          subtitle: "Dec 2025",
          body: "A single `any` can silently disable type checking across an entire call chain. I traced a production bug through four files to find the one escape hatch that let it through.",
          tags: ["TypeScript", "Type Safety", "War Story"],
        }),
        card({
          title: "Event Sourcing from Scratch with Rust and SQLite",
          subtitle: "Nov 2025",
          body: "You don't need Kafka to try event sourcing. I built a minimal event store in 200 lines of Rust with SQLite as the backing store, and it taught me more than any blog post could.",
          tags: ["Rust", "Event Sourcing", "Tutorial"],
        }),
      ],
    }),

    page("about", {
      title: "About",
      icon: "◆",
      content: [
        markdown(`I'm **Sam Torres** — a software engineer who writes about the things I'm learning, building, and occasionally breaking.

I've spent the last few years working across the stack: TypeScript on the frontend, Rust when performance matters, and a healthy amount of time staring at distributed system diagrams on whiteboards.

Byte-Sized started because I kept writing long Slack messages to teammates explaining concepts. Figured I might as well put them somewhere public.

When I'm not coding, you'll find me trail running, reading sci-fi, or convincing myself that *this* is the weekend I'll finally learn Haskell.`),
        spacer(),
        section("Languages & Tools", [
          skillBar("TypeScript", 93),
          skillBar("Rust", 82),
          skillBar("Go", 68),
          skillBar("PostgreSQL", 85),
          skillBar("System Design", 88),
          skillBar("Linux / Infra", 75),
        ]),
        spacer(),
        link("GitHub", "https://github.com/samtorres"),
        link("Twitter / X", "https://x.com/samtorres"),
      ],
    }),

    page("subscribe", {
      title: "Subscribe",
      icon: "◉",
      content: [
        markdown(`Get new posts delivered straight to your inbox. No spam, no tracking pixels, just writing about software — roughly twice a month.`),
        spacer(),
        form({
          id: "newsletter",
          onSubmit: async (data) => {
            // In a real app this would hit a Buttondown/Mailchimp API
            return { success: `Subscribed ${data.email}! Check your inbox to confirm.` };
          },
          fields: [
            textInput({
              id: "email",
              label: "Email address",
              placeholder: "you@example.com",
              validate: (v) => v.includes("@") ? null : "Please enter a valid email address",
            }),
            button({ label: "Subscribe", style: "primary" }),
          ],
        }),
        spacer(2),
        section("Other ways to follow", [
          link("RSS Feed", "https://bytesized.dev/rss.xml"),
          link("Twitter / X", "https://x.com/samtorres"),
          link("Mastodon", "https://hachyderm.io/@samtorres"),
          link("Bluesky", "https://bsky.app/profile/samtorres.dev"),
        ]),
      ],
    }),
  ],
});
