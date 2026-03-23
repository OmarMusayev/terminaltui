import {
  defineSite,
  page,
  card,
  markdown,
  themes,
  spacer,
  section,
  searchInput,
  table,
  // State
  createState,
  createPersistentState,
  computed,
  dynamic,
  // Data fetching
  fetcher,
  // Routing
  route,
} from "terminaltui";

// ─── Types ────────────────────────────────────────────────

interface Post {
  id: number;
  userId: number;
  title: string;
  body: string;
}

interface Comment {
  id: number;
  postId: number;
  name: string;
  email: string;
  body: string;
}

// ─── State ────────────────────────────────────────────────

const appState = createState({
  lastRefresh: new Date().toLocaleTimeString(),
  selectedPost: null as Post | null,
});

const savedItems = createPersistentState<{ ids: number[] }>({
  path: ".dashboard-saved.json",
  defaults: { ids: [] },
});

// ─── Data Fetching ────────────────────────────────────────

const postsFetcher = fetcher<Post[]>({
  url: "https://jsonplaceholder.typicode.com/posts",
  transform: (data: Post[]) => data.slice(0, 10),
  cache: true,
  cacheTTL: 120000,
  retry: 2,
});

// ─── Computed Values ──────────────────────────────────────

const stats = computed(() => {
  const posts = postsFetcher.data ?? [];
  const saved = savedItems.get("ids") ?? [];
  const uniqueAuthors = new Set(posts.map((p) => p.userId)).size;
  return {
    totalPosts: posts.length,
    uniqueAuthors,
    savedCount: saved.length,
    avgTitleLength: posts.length
      ? Math.round(posts.reduce((sum, p) => sum + p.title.length, 0) / posts.length)
      : 0,
  };
});

// ─── Helpers ──────────────────────────────────────────────

function isSaved(postId: number): boolean {
  const ids = savedItems.get("ids") ?? [];
  return ids.includes(postId);
}

function toggleSaved(postId: number): void {
  savedItems.update("ids", (ids: number[]) =>
    ids.includes(postId) ? ids.filter((id: number) => id !== postId) : [...ids, postId],
  );
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Site Config ──────────────────────────────────────────

export default defineSite({
  name: "JSONPlaceholder Monitor",
  tagline: "live dashboard — fetcher + state + routing demo",
  theme: themes.hacker,
  borders: "single",

  onInit: async () => {
    // Pre-fetch data before the UI renders
    await postsFetcher.refresh();
    appState.set("lastRefresh", new Date().toLocaleTimeString());
  },

  pages: [
    // ── Dashboard (Home) ────────────────────────────────
    page("dashboard", {
      title: "Dashboard",
      icon: "▣",
      content: [
        dynamic(["lastRefresh"], () => {
          const s = stats.get();
          return table(
            ["Metric", "Value"],
            [
              ["Total Posts", String(s.totalPosts)],
              ["Unique Authors", String(s.uniqueAuthors)],
              ["Saved Items", String(s.savedCount)],
              ["Avg Title Length", `${s.avgTitleLength} chars`],
              ["Last Refresh", appState.get("lastRefresh")],
            ],
          );
        }),
        spacer(),
        section("Recent Posts", [
          dynamic(() => {
            const posts = postsFetcher.data;
            if (postsFetcher.loading) {
              return markdown("*Loading posts...*");
            }
            if (postsFetcher.error) {
              return markdown(`**Error:** ${postsFetcher.error.message}`);
            }
            if (!posts || posts.length === 0) {
              return markdown("No posts available.");
            }
            return posts.slice(0, 5).map((post) =>
              card({
                title: capitalize(post.title),
                subtitle: `Author #${post.userId} · Post #${post.id}${isSaved(post.id) ? " · Saved" : ""}`,
                body: capitalize(post.body.slice(0, 120)) + "...",
                tags: [`user:${post.userId}`],
                action: {
                  navigate: "detail",
                  params: { id: String(post.id) },
                },
              }),
            );
          }),
        ]),
      ],
    }),

    // ── Items (full list) ───────────────────────────────
    page("items", {
      title: "All Items",
      icon: "▤",
      content: [
        searchInput({
          id: "item-search",
          placeholder: "Search posts by title...",
          action: "navigate",
          items: Array.from({ length: 10 }, (_, i) => ({
            label: `Post #${i + 1}`,
            value: "detail",
            keywords: ["post", String(i + 1)],
          })),
        }),
        spacer(),
        dynamic(() => {
          const posts = postsFetcher.data;
          if (postsFetcher.loading) {
            return markdown("*Fetching all items...*");
          }
          if (postsFetcher.error) {
            return markdown(`**Error:** ${postsFetcher.error.message}`);
          }
          if (!posts || posts.length === 0) {
            return markdown("No items to display.");
          }
          return posts.map((post) =>
            card({
              title: capitalize(post.title),
              subtitle: `Author #${post.userId} · ${post.body.split(" ").length} words${isSaved(post.id) ? " · Saved" : ""}`,
              body: capitalize(post.body.slice(0, 160)) + "...",
              tags: [`id:${post.id}`, `user:${post.userId}`],
              action: {
                navigate: "detail",
                params: { id: String(post.id) },
              },
            }),
          );
        }),
      ],
    }),

    // ── Saved Items ─────────────────────────────────────
    page("saved", {
      title: "Saved",
      icon: "★",
      content: [
        markdown("Items you've saved are persisted to disk and survive restarts."),
        spacer(),
        dynamic(() => {
          const ids = savedItems.get("ids") ?? [];
          const posts = postsFetcher.data ?? [];

          if (ids.length === 0) {
            return markdown("*No saved items yet. Navigate to a post detail page to save it.*");
          }

          const savedPosts = posts.filter((p) => ids.includes(p.id));

          if (savedPosts.length === 0) {
            return markdown(`*${ids.length} item(s) saved, but post data hasn't loaded yet.*`);
          }

          return savedPosts.map((post) =>
            card({
              title: capitalize(post.title),
              subtitle: `Author #${post.userId} · Post #${post.id}`,
              body: capitalize(post.body.slice(0, 140)) + "...",
              tags: ["saved", `user:${post.userId}`],
              action: {
                navigate: "detail",
                params: { id: String(post.id) },
              },
            }),
          );
        }),
      ],
    }),

    // ── About ───────────────────────────────────────────
    page("about", {
      title: "About",
      icon: "◆",
      content: [
        markdown(`**JSONPlaceholder Monitor** is a demo dashboard that showcases the advanced features of TerminalTUI.`),
        spacer(),
        section("Features Demonstrated", [
          markdown(`- **createState()** — reactive app state for tracking refresh times and selections
- **createPersistentState()** — saved items that persist to disk across restarts
- **fetcher()** — data fetching from jsonplaceholder.typicode.com with caching and retry
- **dynamic()** — reactive content blocks that re-render when state or fetched data changes
- **computed()** — derived stats (total posts, unique authors, avg title length) recalculated automatically
- **route()** — parameterized detail pages that load post data and comments on navigation
- **Card actions** — \`action: { navigate: "detail", params: { id } }\` for navigating to detail routes
- **onInit lifecycle** — pre-fetches data before the UI renders for a faster first paint`),
        ]),
        spacer(),
        markdown(`Data source: [JSONPlaceholder](https://jsonplaceholder.typicode.com) — a free fake REST API for testing and prototyping.`),
      ],
    }),

    // ── Detail Route (parameterized) ────────────────────
    route("detail", {
      title: (params) => `Item #${params.id}`,
      icon: "▶",
      content: async (params) => {
        const postId = Number(params.id);

        // Fetch the individual post and its comments in parallel
        const [postRes, commentsRes] = await Promise.all([
          globalThis.fetch(`https://jsonplaceholder.typicode.com/posts/${postId}`),
          globalThis.fetch(`https://jsonplaceholder.typicode.com/posts/${postId}/comments`),
        ]);

        if (!postRes.ok) {
          return [markdown(`**Error:** Could not load post #${postId} (HTTP ${postRes.status})`)];
        }

        const post: Post = await postRes.json();
        const comments: Comment[] = commentsRes.ok ? await commentsRes.json() : [];

        const saved = isSaved(post.id);

        return [
          card({
            title: capitalize(post.title),
            subtitle: `Author #${post.userId} · Post #${post.id}${saved ? " · Saved" : ""}`,
            body: capitalize(post.body),
            tags: [`user:${post.userId}`, saved ? "saved" : "unsaved"],
            action: {
              label: saved ? "Unsave" : "Save",
              style: saved ? "secondary" : "primary",
              onPress: () => toggleSaved(post.id),
            },
          }),
          spacer(),
          section(`Comments (${comments.length})`, [
            ...comments.map((comment) =>
              card({
                title: capitalize(comment.name),
                subtitle: comment.email,
                body: capitalize(comment.body),
              }),
            ),
          ]),
        ];
      },
      loading: (params) => `Loading item #${params.id}...`,
    }),
  ],
});
