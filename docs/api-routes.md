# API Routes

Define backend endpoints directly in your `site.config.ts`. No Express, no Fastify, no separate server — terminaltui starts a local HTTP server automatically when you define routes.

## Why API Routes?

terminaltui has `fetcher()`, `request()`, and `liveData()` for **calling** APIs. But if your TUI needs to read system info, run shell commands, query a database, or manage Docker containers, you'd normally need a separate server.

API routes close that gap. Define your endpoints in the same config file as your pages. The framework handles the server.

## Quick Start

```ts
import { defineSite, page, dynamic, fetcher, markdown } from "terminaltui";

export default defineSite({
  name: "My Dashboard",
  api: {
    "GET /hello": async () => ({ message: "Hello from the API!" }),
  },
  pages: [
    page("home", {
      title: "Home",
      content: [
        dynamic(["hello"], () => {
          const data = fetcher({ url: "/hello" });
          if (data.loading) return markdown("Loading...");
          return markdown(`API says: ${data.data?.message}`);
        }),
      ],
    }),
  ],
});
```

Run `terminaltui dev` and the API server starts alongside the TUI.

## Route Syntax

Routes are defined as keys in the `api` object using the format `"METHOD /path"`:

```ts
api: {
  "GET /stats": async () => { ... },
  "POST /items": async (req) => { ... },
  "PUT /items/:id": async (req) => { ... },
  "DELETE /items/:id": async (req) => { ... },
  "PATCH /items/:id": async (req) => { ... },
}
```

### URL Parameters

Use `:param` in the path to capture URL segments:

```ts
"GET /users/:userId/posts/:postId": async (req) => {
  // req.params.userId, req.params.postId
  return { userId: req.params.userId, postId: req.params.postId };
},
```

### Query Strings

Query parameters are automatically parsed:

```ts
// GET /search?q=hello&page=2
"GET /search": async (req) => {
  return { query: req.query.q, page: req.query.page };
},
```

## Request Object

Every route handler receives an `ApiRequest`:

```ts
interface ApiRequest {
  method: string;                    // "GET", "POST", etc.
  path: string;                      // "/items/42"
  params: Record<string, string>;    // { id: "42" } from :id
  query: Record<string, string>;     // { q: "hello" } from ?q=hello
  body: unknown;                     // Parsed JSON body (POST/PUT/PATCH only)
  headers: Record<string, string>;   // Request headers
}
```

For `GET` and `DELETE`, `body` is `undefined`. For `POST`, `PUT`, and `PATCH`, the body is automatically parsed as JSON.

## Response

Return any JSON-serializable value. The framework sends it as `application/json` with status 200:

```ts
"GET /data": async () => {
  return { items: [1, 2, 3], total: 3 };
},
```

### Error Handling

If your handler throws, the framework returns HTTP 500 with the error message:

```ts
"GET /risky": async () => {
  throw new Error("Something went wrong");
},
// Returns: HTTP 500 { "error": "Something went wrong" }
```

The TUI does **not** crash — errors are contained to the API response.

## Common Patterns

### Reading System Info

```ts
import { execSync } from "child_process";
import { hostname, cpus, totalmem, freemem, uptime } from "os";

api: {
  "GET /system": async () => ({
    hostname: hostname(),
    cpuCores: cpus().length,
    memoryGB: (totalmem() / 1073741824).toFixed(1),
    freeGB: (freemem() / 1073741824).toFixed(1),
    uptime: Math.round(uptime()),
  }),
  "GET /disk": async () => {
    const df = execSync("df -h /").toString().trim();
    return { output: df };
  },
}
```

### Running Shell Commands

```ts
import { execSync } from "child_process";

api: {
  "GET /containers": async () => {
    const output = execSync('docker ps --format "{{json .}}"').toString().trim();
    const containers = output.split("\n").filter(Boolean).map(JSON.parse);
    return { containers };
  },
  "POST /containers/:id/restart": async (req) => {
    execSync(`docker restart ${req.params.id}`);
    return { success: true };
  },
}
```

### Reading and Writing Files

```ts
import { readFileSync, readdirSync, writeFileSync } from "fs";

api: {
  "GET /files": async (req) => {
    const dir = req.query.dir || ".";
    const entries = readdirSync(dir, { withFileTypes: true })
      .filter(e => !e.name.startsWith("."))
      .map(e => ({ name: e.name, isDir: e.isDirectory() }));
    return { entries };
  },
  "GET /file": async (req) => {
    const content = readFileSync(req.query.path, "utf-8");
    return { content };
  },
}
```

### CRUD Operations

```ts
const items: { id: number; name: string }[] = [];
let nextId = 1;

api: {
  "GET /items": async () => ({ items }),
  "POST /items": async (req) => {
    const { name } = req.body as any;
    const item = { id: nextId++, name };
    items.push(item);
    return { success: true, item };
  },
  "PUT /items/:id": async (req) => {
    const item = items.find(i => i.id === Number(req.params.id));
    if (!item) throw new Error("Not found");
    Object.assign(item, req.body);
    return { success: true, item };
  },
  "DELETE /items/:id": async (req) => {
    const idx = items.findIndex(i => i.id === Number(req.params.id));
    if (idx === -1) throw new Error("Not found");
    items.splice(idx, 1);
    return { success: true };
  },
}
```

## Using with fetcher and request

### Relative URLs Auto-Resolve

When the API server is running, any URL starting with `/` in `fetcher()`, `request.*()`, or `liveData()` is automatically routed to the local server:

```ts
// These hit your API routes — no port number needed
const stats = fetcher({ url: "/stats" });
const res = await request.post("/items", { name: "test" });
const ws = liveData({ type: "websocket", url: "/stream", onMessage: ... });

// Absolute URLs still go to external servers
const ext = fetcher({ url: "https://api.example.com/data" });
```

### Auto-Refresh with fetcher

Use `refreshInterval` to poll an API route for live-updating data:

```ts
dynamic(["live"], () => {
  const data = fetcher({ url: "/system/stats", refreshInterval: 5000 });
  if (data.loading) return markdown("Loading...");
  return markdown(`CPU: ${data.data?.cpuUsage}%`);
}),
```

### POST from Form Actions

Use `request.post()` in form `onSubmit` or button `onPress` to call API routes:

```ts
form({
  id: "create-item",
  onSubmit: async (data) => {
    const res = await request.post("/items", { name: data.name });
    if (res.ok) return { success: "Created!" };
    return { error: "Failed" };
  },
  fields: [
    textInput({ id: "name", label: "Name" }),
    button({ label: "Create", style: "primary" }),
  ],
}),
```

## Security

The API server **only** binds to `127.0.0.1` (localhost). It is not accessible from the network. This is important because API routes can:

- Run shell commands
- Read and write files
- Access databases
- Do anything Node.js can do

When distributed via `npx`, the API server runs on the user's machine. This is the intended behavior — the TUI interacts with the local system.

**Never expose the API port to the network.**

## Build and Distribution

API routes work in production builds too. When you run `terminaltui build`:

- Route handlers are bundled into the output
- The built package starts the API server automatically
- When someone runs `npx your-package`, the API server starts alongside the TUI

## How It Works

1. `terminaltui dev` (or the built package) checks for an `api` field in the config
2. If routes are defined, a local HTTP server starts on a random available port
3. The port is stored internally so `fetcher()` and `request()` can resolve relative URLs
4. When the TUI exits (q, Ctrl+C, SIGTERM), the API server shuts down cleanly
5. Sites without `api` work exactly as before — no server is started

## Limitations

- **Single-user only** — the API server runs locally, not on a shared host
- **No built-in authentication** — since it's localhost, auth isn't needed
- **No HTTPS** — localhost traffic doesn't need encryption
- **Synchronous shell commands block the event loop** — use `exec()` (async) instead of `execSync()` for long-running commands
