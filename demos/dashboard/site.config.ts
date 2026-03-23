import {
  defineSite, page, card, markdown, divider, spacer, badge, link, table,
  form, textInput, textArea, button, searchInput,
  dynamic, route, createState, createPersistentState, computed, fetcher, request,
} from "../../src/index.js";
import type { ContentBlock } from "../../src/index.js";

interface Post { id: number; userId: number; title: string; body: string; }
interface Comment { id: number; postId: number; name: string; email: string; body: string; }

const state = createState({ posts: [] as Post[], loaded: false });

const bookmarks = createPersistentState({
  path: ".terminaltui/dashboard.json",
  defaults: { saved: [] as number[] },
});

const bookmarkCount = computed(() => bookmarks.get("saved").length);

const postsFetcher = fetcher<Post[]>({
  url: "https://jsonplaceholder.typicode.com/posts",
  cache: true, cacheTTL: 120000, retry: 2,
  transform: (d: any) => d.slice(0, 15),
});

// ─── Site ─────────────────────────────────────────────────

export default defineSite({
  name: "Dashboard",
  tagline: "API-powered dashboard with live data",
  banner: {
    text: "DASHBOARD",
    font: "Sub-Zero",
  },
  theme: "hacker",
  borders: "single",
  animations: {
    boot: true,
    exitMessage: "Connection terminated.",
  },

  onInit: async () => {
    await postsFetcher.refresh();
    if (postsFetcher.data) {
      state.batch(() => {
        state.set("posts", postsFetcher.data!);
        state.set("loaded", true);
      });
    }
  },

  onNavigate: (from, to) => {
    bookmarkCount.invalidate();
  },

  pages: [
    page("home", {
      title: "Dashboard",
      icon: "~",
      content: [
        dynamic(() => {
          const loaded = state.get("loaded");
          const posts = state.get("posts");
          bookmarkCount.invalidate();
          const saved = bookmarkCount.get();

          if (!loaded) {
            return markdown("*Connecting to API...*");
          }

          return table(
            ["Metric", "Value"],
            [
              ["Posts Loaded", String(posts.length)],
              ["Bookmarks", String(saved)],
              ["API Status", "Online"],
              ["Cache TTL", "120s"],
            ],
          );
        }),

        spacer(),

        dynamic(() => {
          const posts = state.get("posts");
          if (posts.length === 0) return spacer(0) as ContentBlock;

          return [
            divider("Recent Posts"),
            ...posts.slice(0, 5).map((post: Post) =>
              card({
                title: post.title,
                subtitle: `#${post.id} by User ${post.userId}`,
                body: post.body.slice(0, 100) + "...",
                action: {
                  navigate: "post",
                  params: { id: String(post.id) },
                },
              })
            ),
          ] as ContentBlock[];
        }),
      ],
    }),

    page("posts", {
      title: "Posts",
      icon: "#",
      content: [
        dynamic(() => {
          const posts = state.get("posts");
          return searchInput({
            id: "post-search",
            placeholder: "Search posts by title...",
            items: posts.map((p: Post) => ({
              label: `#${p.id}: ${p.title}`,
              value: String(p.id),
              keywords: [p.body.slice(0, 40), `user-${p.userId}`],
            })),
            action: "navigate",
            maxResults: 10,
          });
        }),

        spacer(),

        dynamic(() => {
          const posts = state.get("posts");
          const loaded = state.get("loaded");

          if (!loaded) return markdown("*Fetching posts from API...*");
          if (posts.length === 0) return markdown("*No posts available.*");

          return posts.map((post: Post) =>
            card({
              title: post.title,
              subtitle: `Post #${post.id} by User ${post.userId}`,
              body: post.body.slice(0, 120) + "...",
              action: {
                navigate: "post",
                params: { id: String(post.id) },
              },
            })
          );
        }),
      ],
    }),

    route("post", {
      title: (p) => `Post #${p.id}`,
      icon: "->",
      content: async (p) => {
        const postRes = await request.get<Post>(
          `https://jsonplaceholder.typicode.com/posts/${p.id}`,
        );
        if (!postRes.ok || !postRes.data) {
          return [markdown(`**Error:** Could not load post #${p.id}`)];
        }
        const post = postRes.data;

        const commentsRes = await request.get<Comment[]>(
          `https://jsonplaceholder.typicode.com/posts/${p.id}/comments`,
        );
        const comments = commentsRes.data ?? [];

        const isBookmarked = bookmarks.get("saved").includes(Number(p.id));

        const content: ContentBlock[] = [
          card({
            title: post.title,
            subtitle: `Post #${post.id} by User ${post.userId}`,
            body: post.body,
            tags: isBookmarked ? ["Bookmarked"] : [],
          }),
          spacer(),
          button({
            label: isBookmarked ? "Remove Bookmark" : "Bookmark This Post",
            style: isBookmarked ? "secondary" : "primary",
            onPress: () => {
              const postId = Number(p.id);
              if (isBookmarked) {
                bookmarks.update("saved", (prev: number[]) =>
                  prev.filter((n: number) => n !== postId),
                );
                return { success: "Bookmark removed" };
              } else {
                bookmarks.update("saved", (prev: number[]) => [...prev, postId]);
                return { success: "Post bookmarked!" };
              }
            },
          }),
          spacer(),
          divider("Comments"),
          spacer(),
          ...comments.slice(0, 5).map((c: Comment) =>
            card({
              title: c.name,
              subtitle: c.email,
              body: c.body,
            })
          ),
        ];

        if (comments.length > 5) {
          content.push(markdown(`*...and ${comments.length - 5} more comments*`));
        }

        return content;
      },
      loading: (p) => `Loading post #${p.id}...`,
    }),

    page("bookmarks", {
      title: "Bookmarks",
      icon: "*",
      content: [
        dynamic(() => {
          const savedIds = bookmarks.get("saved");
          const posts = state.get("posts");

          if (savedIds.length === 0) {
            return [
              markdown("No bookmarks yet."),
              spacer(),
              markdown("*Navigate to a post and bookmark it to see it here.*"),
            ] as ContentBlock[];
          }

          const savedPosts = posts.filter((p: Post) => savedIds.includes(p.id));
          if (savedPosts.length === 0 && posts.length === 0) {
            return markdown("*Loading posts to resolve bookmarks...*");
          }

          return [
            markdown(`**${savedPosts.length} bookmarked post${savedPosts.length !== 1 ? "s" : ""}:**`),
            spacer(),
            ...savedPosts.map((post: Post) =>
              card({
                title: post.title,
                subtitle: `Post #${post.id} — Bookmarked`,
                body: post.body.slice(0, 100) + "...",
                action: {
                  navigate: "post",
                  params: { id: String(post.id) },
                },
              })
            ),
            spacer(),
            button({
              label: "Clear All Bookmarks",
              style: "danger",
              onPress: () => {
                bookmarks.set("saved", []);
                return { success: "All bookmarks cleared" };
              },
            }),
          ] as ContentBlock[];
        }),
      ],
    }),

    page("new-post", {
      title: "New Post",
      icon: "+",
      content: [
        markdown("## Create a New Post"),
        markdown("*Sends a POST request to JSONPlaceholder API (test endpoint).*"),
        spacer(),

        form({
          id: "new-post-form",
          resetOnSubmit: true,
          onSubmit: async (data) => {
            const res = await request.post<Post>(
              "https://jsonplaceholder.typicode.com/posts",
              {
                title: data.title,
                body: data.body,
                userId: 1,
              },
            );

            if (!res.ok) {
              return { error: res.error?.message ?? "Failed to create post" };
            }

            if (res.data) {
              state.update("posts", (prev: Post[]) => [
                { ...res.data!, id: prev.length + 1 },
                ...prev,
              ]);
            }

            return { success: `Post created: "${data.title}"` };
          },
          fields: [
            textInput({
              id: "title",
              label: "Title",
              placeholder: "Enter a title...",
              validate: (v) => (v.trim() ? null : "Title is required"),
            }),
            textArea({
              id: "body",
              label: "Body",
              rows: 5,
              placeholder: "Write the post content...",
              validate: (v) => (v.trim() ? null : "Body is required"),
            }),
            button({ label: "Publish Post", style: "primary" }),
          ],
        }),
      ],
    }),

    page("about", {
      title: "About",
      icon: "i",
      content: [
        markdown(`## Dashboard Demo

This demo showcases the terminaltui application framework:

- **createState / createPersistentState** — reactive + persistent state (bookmarks survive restarts)
- **dynamic()** — content blocks re-render when state changes
- **computed()** — bookmark count derives from persistent state
- **fetcher()** — loads posts with caching (120s TTL) and retry
- **request.get / request.post** — fetch details, create posts
- **route()** — parameterized post detail page with loading states
- **searchInput** — search with \`action: "navigate"\`
- **form** — create posts with validation and \`resetOnSubmit\`
- **onInit / onNavigate** — lifecycle hooks for pre-fetching and tracking

**API:** jsonplaceholder.typicode.com — posts and comments fetched live.`),
        spacer(),
        link("JSONPlaceholder API", "https://jsonplaceholder.typicode.com", { icon: ">" }),
        link("terminaltui on GitHub", "https://github.com/terminaltui", { icon: ">" }),
      ],
    }),
  ],
});
