import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIContext } from "astro";
import { product } from "@/data/product";

export async function GET(context: APIContext) {
  const posts = (await getCollection("blog", ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );

  return rss({
    title: "terminaltui — engineering notes",
    description:
      "Notes from building a terminal application framework: rendering, terminal compatibility, and the bugs found along the way.",
    site: context.site ?? product.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      categories: [...post.data.tags],
      link: `/blog/${post.id}/`,
    })),
    customData: "<language>en</language>",
  });
}
