import {
  card, markdown, divider, spacer, button, columns, panel, request,
} from "../../../src/index.js";
import type { ContentBlock } from "../../../src/index.js";
import { bookmarks } from "./home.js";

interface Post { id: number; userId: number; title: string; body: string; }
interface Comment { id: number; postId: number; name: string; email: string; body: string; }

export const metadata = {
  label: (p: { id: string }) => `Post #${p.id}`,
  icon: "->",
  loading: (p: { id: string }) => `Loading post #${p.id}...`,
};

export default async function PostDetail(p: { id: string }) {
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

  const commentCards: ContentBlock[] = comments.slice(0, 5).map((c: Comment) =>
    card({
      title: c.name,
      subtitle: c.email,
      body: c.body,
    })
  );

  if (comments.length > 5) {
    commentCards.push(markdown(`*...and ${comments.length - 5} more comments*`));
  }

  return [
    columns([
      panel({ width: "55%", content: [
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
      ]}),
      panel({ width: "45%", content: [
        divider("Comments"),
        spacer(),
        ...commentCards,
      ]}),
    ]),
  ];
}
