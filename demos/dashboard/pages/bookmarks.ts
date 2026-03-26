import {
  card, markdown, spacer, button, dynamic,
} from "../../../src/index.js";
import type { ContentBlock } from "../../../src/index.js";
import { state, bookmarks } from "./home.js";
import type { Post } from "./home.js";

export const metadata = { label: "Bookmarks", icon: "*" };

export default function Bookmarks() {
  return [
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
  ];
}
