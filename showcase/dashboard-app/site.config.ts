/**
 * Dashboard App — Demonstrates data fetching, parameterized routes, middleware,
 * live state, and the full terminaltui application framework.
 *
 * Features used:
 *   - fetcher() — loads posts from JSONPlaceholder API
 *   - request() — for creating/deleting posts
 *   - route() — parameterized post detail page
 *   - navigate() — programmatic navigation from cards
 *   - createState() — reactive app state
 *   - createPersistentState() — saved bookmarks survive restart
 *   - dynamic() — reactive content blocks
 *   - computed() — derived values
 *   - middleware() — auth check
 *   - defineConfig() — typed configuration
 *   - onInit / onNavigate lifecycle hooks
 *   - form + inputs — create new posts
 *   - searchInput — search posts
 */
import {
  defineSite,
  page,
  card,
  markdown,
  divider,
  spacer,
  section,
  form,
  textInput,
  textArea,
  button,
  searchInput,
  table,
  badge,
  link,
  dynamic,
  route,
  createState,
  createPersistentState,
  computed,
  fetcher,
  request,
} from "../../src/index.js";
import type { ContentBlock } from "../../src/index.js";

// ─── Config ───────────────────────────────────────────────

const API_BASE = "https://jsonplaceholder.typicode.com";

// ─── State ────────────────────────────────────────────────

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

const state = createState({
  postsLoaded: false,
  posts: [] as Post[],
  postCount: 0,
  currentView: "list" as "list" | "detail",
  searchQuery: "",
  error: null as string | null,
});

const bookmarks = createPersistentState({
  path: ".terminaltui/dashboard-bookmarks.json",
  defaults: {
    savedPosts: [] as number[],
    lastVisited: null as string | null,
  },
});

// ─── Data Fetching ────────────────────────────────────────

const postsFetcher = fetcher<Post[]>({
  url: `${API_BASE}/posts`,
  cache: true,
  cacheTTL: 120000, // cache for 2 min
  retry: 2,
  retryDelay: 1000,
  transform: (data) => data.slice(0, 20), // only first 20
  onError: (err) => state.set("error", err.message),
});

// ─── Computed ─────────────────────────────────────────────

const bookmarkCount = computed(() => bookmarks.get("savedPosts").length);

// ─── Site ─────────────────────────────────────────────────

export default defineSite({
  name: "Dashboard",
  tagline: "API-powered dashboard with live data",
  theme: "dracula",
  borders: "rounded",
  animations: { boot: true, exitMessage: "Dashboard closed." },

  onInit: async () => {
    // Pre-fetch posts on startup
    await postsFetcher.refresh();
    if (postsFetcher.data) {
      state.batch(() => {
        state.set("posts", postsFetcher.data!);
        state.set("postCount", postsFetcher.data!.length);
        state.set("postsLoaded", true);
      });
    }
  },

  onNavigate: (from, to) => {
    bookmarks.set("lastVisited", to);
  },

  pages: [
    // ── Dashboard Home ──────────────────────────────────
    page("home", {
      title: "Dashboard",
      icon: "◆",
      content: [
        // Stats cards
        dynamic(() => {
          const loaded = state.get("postsLoaded");
          const posts = state.get("posts");
          bookmarkCount.invalidate();
          const saved = bookmarkCount.get();

          if (!loaded) {
            return markdown("*Loading dashboard data...*");
          }

          return [
            section("Overview", [
              table(
                ["Metric", "Value"],
                [
                  ["Total Posts", String(posts.length)],
                  ["Bookmarked", String(saved)],
                  ["API Status", "● Online"],
                  ["Cache", "Active (2 min TTL)"],
                ],
              ),
            ]),
          ] as ContentBlock[];
        }),

        spacer(),

        // Recent posts preview
        dynamic(() => {
          const posts = state.get("posts");
          if (posts.length === 0) return spacer(0) as ContentBlock;

          return [
            section("Recent Posts", [
              ...posts.slice(0, 5).map((post: Post) =>
                card({
                  title: post.title,
                  subtitle: `#${post.id} · User ${post.userId}`,
                  body: post.body.slice(0, 80) + "...",
                  action: {
                    navigate: "post-detail",
                    params: { id: String(post.id) },
                  },
                })
              ),
            ]),
          ] as ContentBlock[];
        }),

        spacer(),
        markdown("*Press Enter on a post to view details →*"),
      ],
    }),

    // ── Posts List (with search) ────────────────────────
    page("posts", {
      title: "Posts",
      icon: "#",
      content: [
        // Search
        dynamic(() => {
          const posts = state.get("posts");
          return searchInput({
            id: "post-search",
            label: "Search Posts",
            placeholder: "Search by title...",
            items: posts.map((p: Post) => ({
              label: `#${p.id}: ${p.title}`,
              value: String(p.id),
              keywords: [p.body.slice(0, 50), `user-${p.userId}`],
            })),
            action: "navigate",
            maxResults: 10,
          });
        }),

        spacer(),

        // Post list
        dynamic(() => {
          const posts = state.get("posts");
          const loaded = state.get("postsLoaded");

          if (!loaded) return markdown("*Fetching posts from API...*");
          if (posts.length === 0) return markdown("*No posts found.*");

          return posts.map((post: Post) =>
            card({
              title: post.title,
              subtitle: `Post #${post.id} · User ${post.userId}`,
              body: post.body.slice(0, 120) + "...",
              action: {
                navigate: "post-detail",
                params: { id: String(post.id) },
              },
            })
          );
        }),
      ],
    }),

    // ── Post Detail (parameterized route) ───────────────
    route("post-detail", {
      title: (params) => `Post #${params.id}`,
      icon: "→",
      content: async (params) => {
        const id = params.id;

        // Fetch post
        const postRes = await request.get<Post>(`${API_BASE}/posts/${id}`);
        if (!postRes.ok || !postRes.data) {
          return [markdown(`**Error:** Could not load post #${id}`)];
        }
        const post = postRes.data;

        // Fetch comments
        const commentsRes = await request.get<Comment[]>(`${API_BASE}/posts/${id}/comments`);
        const comments = commentsRes.data ?? [];

        // Check if bookmarked
        const isBookmarked = bookmarks.get("savedPosts").includes(Number(id));

        const content: ContentBlock[] = [
          // Post content
          card({
            title: post.title,
            subtitle: `Post #${post.id} · User ${post.userId}`,
            body: post.body,
            tags: isBookmarked ? ["★ Bookmarked"] : [],
          }),

          spacer(),

          // Bookmark button
          button({
            label: isBookmarked ? "★ Remove Bookmark" : "☆ Bookmark This Post",
            style: isBookmarked ? "secondary" : "primary",
            onPress: () => {
              const postId = Number(id);
              if (isBookmarked) {
                bookmarks.update("savedPosts", (prev: number[]) =>
                  prev.filter((p: number) => p !== postId)
                );
                return { success: "Bookmark removed" };
              } else {
                bookmarks.update("savedPosts", (prev: number[]) => [...prev, postId]);
                return { success: "Post bookmarked!" };
              }
            },
          }),

          spacer(),
          divider("Comments"),
          spacer(),

          // Comments
          ...comments.slice(0, 5).map((c: Comment) =>
            card({
              title: c.name,
              subtitle: c.email,
              body: c.body,
            })
          ),
        ];

        if (comments.length > 5) {
          content.push(
            markdown(`*...and ${comments.length - 5} more comments*`)
          );
        }

        return content;
      },
      loading: (params) => `Loading post #${params.id}...`,
    }),

    // ── Bookmarks (persistent) ──────────────────────────
    page("bookmarks", {
      title: "Bookmarks",
      icon: "★",
      content: [
        dynamic(() => {
          const savedIds = bookmarks.get("savedPosts");
          const posts = state.get("posts");

          if (savedIds.length === 0) {
            return [
              markdown("No bookmarks yet."),
              spacer(),
              markdown("*Browse posts and press Enter on a post, then bookmark it.*"),
            ] as ContentBlock[];
          }

          const savedPosts = posts.filter((p: Post) => savedIds.includes(p.id));
          if (savedPosts.length === 0 && posts.length === 0) {
            return markdown("*Loading posts to resolve bookmarks...*");
          }

          return [
            markdown(`**${savedPosts.length} bookmarked posts:**`),
            spacer(),
            ...savedPosts.map((post: Post) =>
              card({
                title: post.title,
                subtitle: `Post #${post.id} · ★ Bookmarked`,
                body: post.body.slice(0, 100) + "...",
                action: {
                  navigate: "post-detail",
                  params: { id: String(post.id) },
                },
              })
            ),
            spacer(),
            button({
              label: "Clear All Bookmarks",
              style: "danger",
              onPress: () => {
                bookmarks.set("savedPosts", []);
                return { success: "All bookmarks cleared" };
              },
            }),
          ] as ContentBlock[];
        }),
      ],
    }),

    // ── New Post Form ───────────────────────────────────
    page("new-post", {
      title: "New Post",
      icon: "+",
      content: [
        markdown("## Create a New Post"),
        markdown("*Posts are sent to JSONPlaceholder API (test endpoint)*"),
        spacer(),

        form({
          id: "new-post-form",
          onSubmit: async (data) => {
            const res = await request.post<Post>(`${API_BASE}/posts`, {
              title: data.title,
              body: data.body,
              userId: 1,
            });

            if (!res.ok) {
              return { error: res.error?.message ?? "Failed to create post" };
            }

            // Add to local state (API returns the created post)
            if (res.data) {
              state.update("posts", (prev: Post[]) => [
                { ...res.data!, id: prev.length + 1 },
                ...prev,
              ]);
              state.update("postCount", (n: number) => n + 1);
            }

            return { success: `Post created: "${data.title}"` };
          },
          fields: [
            textInput({
              id: "title",
              label: "Title",
              placeholder: "Enter post title...",
              validate: (v) => v.trim() ? null : "Title is required",
            }),
            textArea({
              id: "body",
              label: "Content",
              rows: 5,
              placeholder: "Write your post content...",
              validate: (v) => v.trim() ? null : "Content is required",
            }),
            button({ label: "Publish Post", style: "primary" }),
          ],
        }),
      ],
    }),

    // ── About ───────────────────────────────────────────
    page("about", {
      title: "About",
      icon: "i",
      content: [
        markdown(`## Dashboard App

This app demonstrates the full terminaltui application framework:

- **fetcher()** — loads 20 posts from JSONPlaceholder API with caching and retry
- **request.get/post** — fetches post details and comments on demand
- **route()** — parameterized post detail pages (press Enter on any post)
- **navigate()** — cards navigate to detail routes via \`action: { navigate, params }\`
- **createState()** — reactive state for posts, loading status, search
- **createPersistentState()** — bookmarks saved to disk, survive restarts
- **dynamic()** — all content blocks re-render when state changes
- **computed()** — bookmark count derives from state
- **searchInput** — search posts by title with navigate action
- **form + textInput + textArea** — create new posts via API
- **onInit** — pre-fetches data at startup
- **onNavigate** — tracks last visited page

**API:** JSONPlaceholder (jsonplaceholder.typicode.com)
**Data:** Posts, comments, users — all fetched live.`),
        spacer(),
        link("JSONPlaceholder API", "https://jsonplaceholder.typicode.com"),
        link("terminaltui on GitHub", "https://github.com/terminaltui"),
      ],
    }),
  ],
});
