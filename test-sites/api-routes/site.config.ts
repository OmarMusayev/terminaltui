import { defineSite, page, dynamic, fetcher, request, markdown, card, button } from "../../src/index.js";
import { readFileSync, readdirSync } from "node:fs";

let counter = 0;

export default defineSite({
  name: "API Routes Test",
  theme: "hacker",

  api: {
    // Test 1: Basic GET
    "GET /hello": async () => ({ message: "Hello from the API!" }),

    // Test 2: GET with timestamp
    "GET /time": async () => ({ time: new Date().toISOString() }),

    // Test 3: POST with echo
    "POST /echo": async (req) => ({ echoed: req.body }),

    // Test 4: URL params
    "GET /items/:id": async (req) => ({
      id: req.params.id,
      name: `Item ${req.params.id}`,
    }),

    // Test 5: Query strings
    "GET /search": async (req) => ({
      query: req.query.q || "(none)",
      page: req.query.page || "1",
    }),

    // Test 6: File system access
    "GET /readme": async () => {
      const content = readFileSync("./README.md", "utf-8");
      return { lines: content.split("\n").length, preview: content.substring(0, 200) };
    },

    "GET /files": async () => {
      const files = readdirSync(".").filter(f => !f.startsWith("."));
      return { files, count: files.length };
    },

    // Test 7: Stateful counter
    "GET /counter": async () => ({ count: ++counter }),
    "POST /counter/reset": async () => { counter = 0; return { count: 0 }; },

    // Test 8: Error handling
    "GET /fail": async () => {
      throw new Error("Intentional test error");
    },

    // Test 9: Multi-param
    "GET /users/:userId/posts/:postId": async (req) => ({
      userId: req.params.userId,
      postId: req.params.postId,
    }),

    // Test 10: All methods
    "PUT /items/:id": async (req) => ({ method: "PUT", id: req.params.id, body: req.body }),
    "DELETE /items/:id": async (req) => ({ method: "DELETE", id: req.params.id }),
    "PATCH /items/:id": async (req) => ({ method: "PATCH", id: req.params.id, body: req.body }),
  },

  pages: [
    page("dashboard", {
      title: "Dashboard",
      icon: "◆",
      content: [
        dynamic(["hello"], () => {
          const data = fetcher({ url: "/hello" });
          if (data.loading) return markdown("Loading...");
          if (data.error) return markdown(`Error: ${data.error.message}`);
          return markdown(`**API says:** ${data.data?.message}`);
        }),
        dynamic(["counter"], () => {
          const data = fetcher({ url: "/counter", refreshInterval: 3000 });
          if (data.loading) return markdown("Loading counter...");
          return markdown(`**Counter:** ${data.data?.count}`);
        }),
      ],
    }),

    page("files", {
      title: "Files",
      icon: "◈",
      content: [
        dynamic(["files"], () => {
          const data = fetcher({ url: "/files" });
          if (data.loading) return markdown("Loading files...");
          if (data.error) return markdown(`Error: ${data.error.message}`);
          return [
            markdown(`**${data.data?.count} files** in project root`),
            ...((data.data?.files as string[]) || []).slice(0, 10).map((f: string) =>
              markdown(`  - ${f}`)
            ),
          ];
        }),
      ],
    }),
  ],
});
