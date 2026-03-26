import {
  card, markdown, spacer, searchInput, dynamic, container,
} from "../../../src/index.js";
import type { ContentBlock } from "../../../src/index.js";
import { state } from "./home.js";
import type { Post } from "./home.js";

export const metadata = { label: "Posts", icon: "#" };

export default function Posts() {
  return [
    dynamic(() => {
      const posts = state.get("posts");
      const loaded = state.get("loaded");

      if (!loaded) return markdown("*Fetching posts from API...*");
      if (posts.length === 0) return markdown("*No posts available.*");

      return [
        container([
          dynamic(() => {
            const currentPosts = state.get("posts");
            return searchInput({
              id: "post-search",
              placeholder: "Search posts by title...",
              items: currentPosts.map((p: Post) => ({
                label: `#${p.id}: ${p.title}`,
                value: String(p.id),
                keywords: [p.body.slice(0, 40), `user-${p.userId}`],
              })),
              action: "navigate",
              maxResults: 10,
            });
          }),

          spacer(),

          ...posts.map((post: Post) =>
            card({
              title: post.title,
              subtitle: `Post #${post.id} by User ${post.userId}`,
              body: post.body.slice(0, 120) + "...",
              action: {
                navigate: "post",
                params: { id: String(post.id) },
              },
            })
          ),
        ], { maxWidth: 95 }),
      ] as ContentBlock[];
    }),
  ];
}
