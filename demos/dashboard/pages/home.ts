import {
  card, markdown, divider, spacer, button, table,
  dynamic, createState, createPersistentState, computed, fetcher,
  split, row, col,
} from "../../../src/index.js";
import type { ContentBlock } from "../../../src/index.js";

interface Post { id: number; userId: number; title: string; body: string; }

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

export const metadata = { label: "Dashboard", icon: "~" };

export default function Home() {
  return [
    dynamic(() => {
      const loaded = state.get("loaded");
      const posts = state.get("posts");
      bookmarkCount.invalidate();
      const saved = bookmarkCount.get();

      if (!loaded) {
        return markdown("*Connecting to API...*");
      }

      const recentPosts = posts.slice(0, 5);

      return [
        // Top row: 4 stat cards in a responsive 12-column grid
        row([
          col([
            card({
              title: "Total Posts",
              subtitle: String(posts.length),
              body: "Loaded from API",
              tags: ["live"],
            }),
          ], { span: 3, sm: 6, xs: 12 }),
          col([
            card({
              title: "Active Users",
              subtitle: String(new Set(posts.map((p: Post) => p.userId)).size),
              body: "Unique authors",
              tags: ["users"],
            }),
          ], { span: 3, sm: 6, xs: 12 }),
          col([
            card({
              title: "Uptime",
              subtitle: "99.97%",
              body: "Last 30 days",
              tags: ["healthy"],
            }),
          ], { span: 3, sm: 6, xs: 12 }),
          col([
            card({
              title: "Response Time",
              subtitle: "42ms",
              body: "Avg latency",
              tags: ["fast"],
            }),
          ], { span: 3, sm: 6, xs: 12 }),
        ], { gap: 1 }),

        spacer(),

        // Bottom split: recent posts table on left, status + actions on right
        split({
          direction: "horizontal",
          ratio: 60,
          first: [
            divider("Recent Posts"),
            spacer(),
            table(
              ["#", "Title", "Author"],
              recentPosts.map((post: Post) => [
                String(post.id),
                post.title.length > 35 ? post.title.slice(0, 35) + "..." : post.title,
                `User ${post.userId}`,
              ]),
            ),
            spacer(),
            ...recentPosts.map((post: Post) =>
              card({
                title: post.title,
                subtitle: `#${post.id} by User ${post.userId}`,
                body: post.body.slice(0, 80) + "...",
                action: {
                  navigate: "post",
                  params: { id: String(post.id) },
                },
              })
            ),
          ],
          second: [
            divider("System Status"),
            spacer(),
            table(
              ["Metric", "Value"],
              [
                ["Posts Loaded", String(posts.length)],
                ["Bookmarks", String(saved)],
                ["API Status", "Online"],
                ["Cache TTL", "120s"],
                ["Fetcher", "OK"],
              ],
            ),
            spacer(),
            divider("Quick Actions"),
            spacer(),
            button({
              label: "Refresh Posts",
              style: "primary",
              onPress: async () => {
                await postsFetcher.refresh();
                if (postsFetcher.data) {
                  state.batch(() => {
                    state.set("posts", postsFetcher.data!);
                    state.set("loaded", true);
                  });
                }
                return { success: "Posts refreshed" };
              },
            }),
            spacer(),
            button({
              label: "Clear Bookmarks",
              style: "danger",
              onPress: () => {
                bookmarks.set("saved", []);
                return { success: "Bookmarks cleared" };
              },
            }),
          ],
        }) as any,
      ] as ContentBlock[];
    }),
  ];
}

// Exported for use by other pages in this demo
export { state, bookmarks, bookmarkCount, postsFetcher };
export type { Post };
