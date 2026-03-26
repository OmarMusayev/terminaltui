import {
  markdown, spacer, link, container,
} from "../../../src/index.js";

export const metadata = { label: "About", icon: "i" };

export default function About() {
  return [
    container([
      markdown(`## Dashboard Demo

This demo showcases the terminaltui application framework with modern spatial layouts:

- **row() + col()** — 12-column responsive grid for stat cards on Home
- **split()** — horizontal split panels for post detail + comments, form + instructions
- **container()** — centered content with max width on Posts and About pages
- **createState / createPersistentState** — reactive + persistent state (bookmarks survive restarts)
- **dynamic()** — content blocks re-render when state changes
- **computed()** — bookmark count derives from persistent state
- **fetcher()** — loads posts with caching (120s TTL) and retry
- **request.get / request.post** — fetch details, create posts
- **route()** — parameterized post detail page with loading states
- **searchInput** — search with \`action: "navigate"\`
- **form** — create posts with validation and \`resetOnSubmit\`
- **onInit / onNavigate** — lifecycle hooks for pre-fetching and tracking

**API:** jsonplaceholder.typicode.com — posts and comments fetched live.`),
      spacer(),
      link("JSONPlaceholder API", "https://jsonplaceholder.typicode.com", { icon: ">" }),
      link("terminaltui on GitHub", "https://github.com/terminaltui", { icon: ">" }),
    ], { maxWidth: 80, padding: 1 }),
  ];
}
