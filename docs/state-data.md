# State & Data

terminaltui provides reactive state management, computed values, data fetching, and real-time connections. All are imported from `"terminaltui"`.

## Reactive State

### createState(initial)

Creates a reactive state container. Changes trigger UI re-renders of any `dynamic()` blocks that read the state.

```ts
import { createState } from "terminaltui";

const state = createState({ count: 0, name: "world" });
```

### Reading State

```ts
state.get()          // returns { count: 0, name: "world" }
state.get("count")   // returns 0
state.get("name")    // returns "world"
```

### Writing State

```ts
state.set("count", 1);
state.update("count", (prev) => prev + 1);
```

`set` replaces the value directly. `update` receives the previous value and returns the new one.

### Batching Updates

When changing multiple keys at once, wrap them in `batch()` to fire a single re-render instead of one per change:

```ts
state.batch(() => {
  state.set("count", 10);
  state.set("name", "hello");
});
```

### Subscribing to Changes

```ts
// Listen to a specific key
const unsubscribe = state.on("count", (newVal, oldVal) => {
  console.log(`count changed: ${oldVal} -> ${newVal}`);
});

// Listen to all changes
state.on("*", (key, newVal) => {
  console.log(`${key} changed to ${newVal}`);
});

// Stop listening
unsubscribe();
```

### Using State in the UI

The `dynamic()` block re-renders whenever the state it reads changes:

```ts
import { createState, dynamic, markdown } from "terminaltui";

const state = createState({ count: 0 });

// Re-renders on any state change
dynamic(() => markdown(`Count: ${state.get("count")}`))

// Re-renders only when "count" changes (more efficient)
dynamic(["count"], () => markdown(`Count: ${state.get("count")}`))
```

## Computed Values

### computed(fn)

Cached derived values. The function runs once and caches the result. Call `.invalidate()` to force recalculation on the next `.get()`.

```ts
import { computed } from "terminaltui";

const total = computed(() => state.get("price") * state.get("quantity"));
console.log(total.get());  // cached result

total.invalidate();         // next get() will recompute
```

## Persistent State

### createPersistentState(options)

State that persists to disk as JSON. Same API as `createState`. Survives app restarts.

```ts
import { createPersistentState } from "terminaltui";

const prefs = createPersistentState({
  path: "./data/prefs.json",
  defaults: { theme: "dracula", fontSize: 14 },
  encrypt: false,
});

prefs.get("theme");          // reads from file-backed state
prefs.set("theme", "nord");  // writes to disk automatically
```

| Option | Type | Description |
|--------|------|-------------|
| `path` | `string` | File path for JSON persistence |
| `defaults` | `T` | Default values when file doesn't exist |
| `encrypt` | `boolean` | Encrypt the data on disk |

---

## Data Fetching

### fetcher(options)

Reactive data fetcher with caching, retry logic, and auto-refresh. Returns a result object that updates as the request progresses.

```ts
import { fetcher } from "terminaltui";

const api = fetcher({
  url: "https://api.example.com/data",
  refreshInterval: 30000,
  retry: 3,
  retryDelay: 1000,
  cache: true,
  cacheTTL: 60000,
  transform: (data) => data.items,
  onError: (err) => console.error(err),
});
```

#### Fetcher Options

| Option | Type | Description |
|--------|------|-------------|
| `url` | `string` | URL to fetch |
| `fetch` | `() => Promise<T>` | Custom fetch function (alternative to url) |
| `method` | `string` | HTTP method |
| `headers` | `Record<string, string>` | Request headers |
| `body` | `any` | Request body |
| `refreshInterval` | `number` | Auto-refresh interval in ms |
| `cache` | `boolean` | Enable caching (default: true) |
| `cacheTTL` | `number` | Cache TTL in ms (default: 60000) |
| `retry` | `number` | Retry count (default: 0) |
| `retryDelay` | `number` | Retry delay in ms (default: 1000) |
| `transform` | `(data) => T` | Transform the response |
| `onError` | `(err) => void` | Error handler |

#### Fetcher Result

```ts
api.data       // T | null -- the fetched data
api.loading    // boolean -- whether a request is in progress
api.error      // Error | null -- the last error
api.refresh()  // manually trigger a re-fetch
api.mutate(d)  // optimistically update data
api.clear()    // clear cached data
api.destroy()  // stop auto-refresh and clean up
```

#### Using with API Routes

If your config defines API routes, relative URLs automatically resolve to the local API server:

```ts
// Hits your "GET /stats" API route — no port number needed
const stats = fetcher({ url: "/stats", refreshInterval: 5000 });
```

See [API Routes](./api-routes.md) for the full reference.

### request(options) / request.get / .post / .put / .delete / .patch

Simple HTTP request helper for one-shot requests. Returns a promise.

```ts
import { request } from "terminaltui";

// Full form
const res = await request({
  url: "https://api.example.com/data",
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: { name: "test" },
  timeout: 5000,
});

// Shorthand methods
const res = await request.get("https://api.example.com/data");
const res = await request.post("https://api.example.com/data", { name: "test" });
const res = await request.put("https://api.example.com/data/1", { name: "updated" });
const res = await request.delete("https://api.example.com/data/1");
const res = await request.patch("https://api.example.com/data/1", { name: "patched" });
```

#### Passing Headers with Shorthand Methods

The third argument is a flat headers object (not `{ headers: {...} }`):

```ts
const res = await request.post(
  "https://api.example.com/data",
  { name: "test" },
  { Authorization: "Bearer sk-..." }
);
```

#### Request Result

```ts
res.data     // T | null
res.error    // Error | null
res.status   // number (HTTP status code)
res.ok       // boolean (true if 2xx)
```

---

## Real-Time Data

### liveData(options)

Real-time data via WebSocket or Server-Sent Events. Returns a `LiveDataConnection`.

#### WebSocket

```ts
import { liveData } from "terminaltui";

const ws = liveData({
  type: "websocket",
  url: "wss://api.example.com/ws",
  onMessage: (data) => {
    state.set("messages", [...state.get("messages"), data]);
  },
  onConnect: () => console.log("Connected"),
  onDisconnect: () => console.log("Disconnected"),
  onError: (err) => console.error(err),
  reconnect: true,
  reconnectInterval: 5000,
});

ws.send("hello");
ws.close();
ws.connected;  // boolean
```

#### Server-Sent Events (SSE)

```ts
const sse = liveData({
  type: "sse",
  url: "https://api.example.com/events",
  onMessage: (event) => {
    // event.data, event.type, event.lastEventId
    state.set("latest", event.data);
  },
  headers: { Authorization: "Bearer ..." },
});
```

#### Combining with dynamic()

Connect real-time data to the UI using state and dynamic blocks:

```ts
const state = createState({ price: 0 });

const ws = liveData({
  type: "websocket",
  url: "wss://api.example.com/prices",
  onMessage: (data) => state.set("price", data.price),
  reconnect: true,
});

// In your page content:
dynamic(["price"], () => markdown(`Current price: **$${state.get("price")}**`))
```
