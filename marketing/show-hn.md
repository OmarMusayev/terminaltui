# Show HN: terminaltui -- Turn any website into a terminal app

I've been working on terminaltui, a TypeScript framework that lets you build fully interactive terminal apps from a single config file. You define pages, content blocks, forms, themes, and ASCII art in a declarative API, and the framework handles rendering, keyboard navigation, scrolling, focus management, and 256-color theming.

The result is a real terminal app that anyone can run with `npx your-site`.

Why? Terminals are having a moment. People are spending more time in them than ever -- between AI coding assistants, modern CLI tools, and the general aesthetic appeal of a well-themed terminal. Meanwhile, distributing a terminal app is trivially easy: `npx` and it just runs. No browser, no Electron, no app store.

The framework covers a lot of ground: 20+ content components (cards, tables, forms, galleries, accordions), 10 input components (text, select, checkbox, radio, search), reactive state management, data fetching with caching and retry, WebSocket/SSE support, parameterized routing with middleware, 10 built-in color themes, and a full ASCII art system with 14 banner fonts, scenes, icons, and data visualization.

There's also an AI conversion feature. Run `terminaltui convert` in any existing web project and it drops reference docs that let Claude (or any coding AI) read your site and produce a TUI version automatically.

Zero runtime dependencies. TypeScript throughout. Node 18+.

I built this because I wanted my portfolio to be something people actually remember opening. Turns out a lot of sites work surprisingly well as terminal apps -- restaurants, documentation, landing pages, dashboards.

Would love feedback on the API design, the component set, or anything else. Happy to answer questions.
