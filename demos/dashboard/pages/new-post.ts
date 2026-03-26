import {
  markdown, divider, spacer, badge,
  form, textInput, textArea, button,
  split, request,
} from "../../../src/index.js";
import { state } from "./home.js";
import type { Post } from "./home.js";

export const metadata = { label: "New Post", icon: "+" };

export default function NewPost() {
  return [
    split({
      direction: "horizontal",
      ratio: 60,
      first: [
        markdown("## Create a New Post"),
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
      second: [
        markdown("## Instructions"),
        spacer(),
        markdown("*Sends a POST request to JSONPlaceholder API (test endpoint).*"),
        spacer(),
        divider("Tips"),
        spacer(),
        markdown("- Give your post a descriptive **title**"),
        markdown("- Write clear, engaging **body** content"),
        markdown("- Posts appear in the dashboard after creation"),
        spacer(),
        divider("Preview"),
        spacer(),
        markdown("Your post will be submitted to the API and added to the local post list. It will appear on the Home and Posts pages immediately."),
        spacer(),
        badge("API: jsonplaceholder.typicode.com"),
      ],
    }) as any,
  ];
}
