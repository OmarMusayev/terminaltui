# terminaltui: a declarative framework for building terminal apps from a single config file

I've been working on a TypeScript framework that takes a single `site.config.ts` and produces a fully interactive terminal application with keyboard navigation, theming, forms, and state management.

**How it works under the hood:**

The rendering pipeline maintains a virtual screen buffer. Each frame walks the content tree, measures blocks using Unicode-aware string width (not `.length` -- CJK, emoji, and box-drawing characters need proper handling), lays everything out vertically, and diffs against the previous frame. Only changed regions get ANSI escape sequences written to stdout.

The focus system keeps a flat list of focusable components. Arrow keys traverse the list, and the viewport auto-scrolls to follow. Components self-declare focusability: cards and inputs register, markdown and tables don't.

Input handling switches between navigation mode (arrow keys move between items) and edit mode (keystrokes go to a text input). Enter/Escape toggle between them. This is what makes forms usable in a terminal context.

All colors are mapped to the 256-color ANSI palette at render time rather than assuming truecolor support. This avoids the garbage output you get in terminals like Apple Terminal that don't handle truecolor sequences.

Zero runtime dependencies. Optional `node-pty` peer dep for the headless testing emulator (think Puppeteer for TUIs).

The API is purely declarative -- 20+ display components, 10 input components, reactive state, data fetching with caching/retry, WebSocket/SSE, parameterized routing, and middleware. TypeScript throughout with full type inference.

Interested in feedback on the rendering approach and the API design.
