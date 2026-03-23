# Routing

terminaltui supports static pages, parameterized routes, programmatic navigation, and middleware.

## Static Pages

Use `page()` to define a page that appears in the navigation menu:

```ts
import { defineSite, page, markdown } from "terminaltui";

export default defineSite({
  pages: [
    page("home", {
      title: "Home",
      icon: "◆",
      content: [markdown("Welcome!")],
    }),
    page("about", {
      title: "About",
      icon: "◈",
      content: [markdown("About this site.")],
    }),
  ],
});
```

The first argument to `page()` is the page ID. `title` is what shows in the menu. `icon` is an optional single character displayed before the title.

Common icons: `"◆"` `"◈"` `"▣"` `"▤"` `"◉"` `"▸"` `"✦"` `"★"` `"●"` `"■"` `"▲"` `"♦"`

## Parameterized Routes

Use `route()` for pages that receive parameters. Unlike `page()`, the `title` and `content` can be functions that receive a `params` object:

```ts
import { route, card } from "terminaltui";

route("project", {
  title: (params) => `Project: ${params.name}`,
  content: async (params) => {
    const data = await fetchProject(params.name);
    return [card({ title: data.name, body: data.description })];
  },
  loading: "Loading project...",
})
```

Routes do not appear in the navigation menu by default. They are reached through programmatic navigation or card actions.

## Programmatic Navigation

### navigate(pageId, params?)

Navigate to any page or route from event handlers, middleware, or other logic:

```ts
import { navigate } from "terminaltui";

navigate("home");
navigate("project", { name: "my-app" });
```

### Card Action Navigation

Cards can navigate to routes when selected:

```ts
card({
  title: "My Project",
  body: "Click to view details",
  action: { navigate: "project", params: { name: "my-project" } },
})
```

## Middleware

Middleware functions run before a page renders. They can redirect, block access, or modify behavior.

### Global Middleware

Runs on every page navigation:

```ts
import { defineSite, middleware, redirect, requireEnv, rateLimit } from "terminaltui";

export default defineSite({
  middleware: [
    requireEnv(["API_KEY"]),
    rateLimit({ maxRequests: 100, windowMs: 60000 }),
  ],
  // ...
});
```

### Page-Level Middleware

Runs only when navigating to a specific page:

```ts
page("admin", {
  title: "Admin",
  middleware: [
    middleware(async (ctx) => {
      if (!isAdmin(ctx.state)) return redirect("home");
    }),
  ],
  content: [markdown("Admin panel.")],
})
```

### Custom Middleware

The `middleware()` function wraps a function that receives a `MiddlewareContext` and optionally returns a redirect:

```ts
middleware(async (ctx) => {
  // ctx.page   -- the target page ID
  // ctx.params -- route parameters
  // ctx.state  -- app state

  if (someCondition) {
    return redirect("login");  // redirect to another page
  }
  // return nothing to allow navigation
})
```

### Built-in Middleware

| Function | Description |
|----------|-------------|
| `requireEnv(vars)` | Check that environment variables exist |
| `rateLimit({ maxRequests, windowMs })` | Rate limit page access |
| `cache({ ttl })` | Cache page content for `ttl` milliseconds |

### Redirect

```ts
import { redirect } from "terminaltui";

redirect("home")                           // redirect to a page
redirect("project", { name: "my-app" })    // redirect to a route with params
```
