# terminaltui: declarative terminal apps in TypeScript, zero deps, publish via npx

I built a Node.js framework for creating interactive terminal applications from a single `site.config.ts` file. The developer experience was my main focus.

**The DX:**

Everything is TypeScript with full type inference. You import builder functions (`page`, `card`, `markdown`, `form`, `textInput`, etc.), compose them declaratively, and the framework handles rendering, keyboard navigation, scrolling, and focus management. No manual ANSI codes, no cursor math.

```ts
import { defineSite, page, card, markdown, ascii } from "terminaltui";

export default defineSite({
  name: "My App",
  banner: ascii("My App", { font: "ANSI Shadow", gradient: ["#ff6b6b", "#4ecdc4"] }),
  theme: "dracula",
  pages: [
    page("home", { title: "Home", content: [markdown("Welcome!")] }),
  ],
});
```

`terminaltui init [template]` scaffolds a project. `terminaltui dev` gives you a hot-reloading preview. `terminaltui build` bundles for npm. After `npm publish`, anyone runs your app with `npx your-package`.

The framework includes reactive state (`createState` with get/set/update/batch/subscribe), data fetching (`fetcher` with caching, retry, auto-refresh; `request.get/post/put/delete/patch`), real-time connections (`liveData` for WebSocket and SSE), parameterized routing, and middleware (auth guards, rate limiting, caching).

There's also a testing emulator -- `TUIEmulator.launch()` gives you a headless terminal you can drive with `press`, `type`, `waitForText`, and `assert.textVisible`. It's the Puppeteer equivalent for terminal apps.

Zero runtime dependencies. Optional `node-pty` peer dep for the emulator. Node 18+, ESM only.

The `npx` distribution model is what got me excited about this. No binary downloads, no app stores, no Electron. Just `npx my-site` and it runs.

```
npm install terminaltui
npx terminaltui init portfolio
npx terminaltui dev
```
