# Routing

terminaltui uses Next.js-style file-based routing. A project is a `config.ts` plus a `pages/` directory.

```
my-site/
├── config.ts          # theme, banner, global settings, optional menu override
├── pages/
│   ├── home.ts        # /home (landing page)
│   ├── about.ts       # /about
│   ├── projects/
│   │   ├── index.ts   # /projects
│   │   └── [slug].ts  # /projects/:slug — dynamic route
│   ├── admin/
│   │   ├── layout.ts  # wraps every page under /admin
│   │   └── index.ts   # /admin
│   └── contact.ts     # /contact
└── api/
    └── stats.ts       # GET /api/stats — see api-routes.md
```

## Page files

Each file under `pages/` is a page. Default-export a function that returns content blocks; optionally export `metadata`.

```ts
// pages/about.ts
import { card, timeline } from "terminaltui";

export const metadata = {
  label: "About",       // menu label (defaults to title-cased filename)
  icon: "◈",
  order: 2,             // menu sort order (lower first)
  hidden: false,        // hide from auto-generated menu
};

export default function About() {
  return [
    card({ title: "About Me", body: "Full-stack developer." }),
    timeline([{ date: "2024", title: "Started terminaltui" }]),
  ];
}
```

Pages can be `async`:

```ts
export default async function Dashboard() {
  const data = await fetchData();
  return [card({ title: data.name, body: data.body })];
}
```

## Dynamic routes — `[param].ts`

A bracketed filename creates a dynamic route. The `params` object is passed to your default export:

```ts
// pages/projects/[slug].ts
export default function Project({ params }: { params: { slug: string } }) {
  return [card({ title: params.slug, body: "Project details." })];
}
```

Navigate to it with `navigate("projects/[slug]", { slug: "my-app" })` or via a card action.

## Layout files — `layout.ts`

A `layout.ts` wraps every sibling and descendant page. Layouts compose from outside in (root layout → section layout → page).

```ts
// pages/admin/layout.ts
import { card } from "terminaltui";

export default function AdminLayout({ children }: { children: any[] }) {
  return [
    card({ title: "Admin", body: "You're in the admin section." }),
    ...children,
  ];
}
```

## API routes

`api/*.ts` files become HTTP endpoints. Each file can export `GET`, `POST`, `PUT`, `DELETE`, etc.

```ts
// api/stats.ts
export async function GET() {
  return { users: 45231, uptime: 99.97 };
}
```

`api/stats.ts` → `GET /api/stats`. See [API Routes](./api-routes.md) for parameters, request bodies, and error handling.

## Auto-menu vs manual menu

By default, the home menu is generated from the filesystem (alphabetical, respecting `metadata.order` and skipping `metadata.hidden`). Override it in `config.ts`:

```ts
import { defineConfig } from "terminaltui";

export default defineConfig({
  name: "My Site",
  theme: "cyberpunk",
  menu: {
    items: [
      { id: "home", label: "Home", icon: "◆" },
      { id: "projects", label: "Projects", icon: "▣" },
      { id: "contact", label: "Contact", icon: "◉" },
    ],
  },
});
```

You can also drop a `menu({ source: "auto" })` block into any page to render the auto-menu inline.

## Hiding pages

Use `metadata.hidden = true`, or omit the page from a manual `menu.items` list. The page is still routable (e.g., via `navigate()` or `[param]`), it just doesn't appear in the menu.

## Programmatic navigation — `navigate(pageId, params?)`

Navigate to any page from event handlers, async content, or middleware:

```ts
import { navigate } from "terminaltui";

navigate("home");
navigate("projects/[slug]", { slug: "my-app" });
```

### Card action navigation

Cards can navigate when activated:

```ts
card({
  title: "My Project",
  body: "Click to view details",
  action: { navigate: "projects/[slug]", params: { slug: "my-project" } },
})
```

## Middleware

Middleware functions run before a page renders. They can redirect, block access, or modify behavior.

### Global middleware

Runs on every page navigation. Defined on `defineConfig({ middleware: [...] })`:

```ts
import { defineConfig, requireEnv, rateLimit } from "terminaltui";

export default defineConfig({
  name: "My Site",
  middleware: [
    requireEnv(["API_KEY"]),
    rateLimit({ maxRequests: 100, windowMs: 60000 }),
  ],
});
```

### Page-level middleware

Export `metadata.middleware` from a page file:

```ts
// pages/admin/index.ts
import { middleware, redirect, markdown } from "terminaltui";

export const metadata = {
  label: "Admin",
  middleware: [
    middleware(async (ctx) => {
      if (!isAdmin(ctx.state)) return redirect("home");
    }),
  ],
};

export default function Admin() {
  return [markdown("Admin panel.")];
}
```

### Custom middleware

The `middleware()` function wraps a handler that receives a `MiddlewareContext` and optionally returns a redirect:

```ts
middleware(async (ctx) => {
  // ctx.page   — the target page id
  // ctx.params — route parameters (for dynamic routes)
  // ctx.state  — app state, if configured

  if (someCondition) {
    return redirect("login");  // redirect to another page
  }
  // return nothing to allow navigation
})
```

### Built-in middleware

| Function | Description |
|----------|-------------|
| `requireEnv(vars)` | Check that environment variables exist |
| `rateLimit({ maxRequests, windowMs })` | Rate limit page access |

### `redirect()`

```ts
import { redirect } from "terminaltui";

redirect("home")                                          // redirect to a page
redirect("projects/[slug]", { slug: "my-app" })           // redirect to a dynamic route with params
```
