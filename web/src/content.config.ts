import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    /** Shown on the index and used as the meta description. Keep under 160 chars. */
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    /** Pulled out on the index as the lead post. At most one. */
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    /** Optional: a demo key from frames.json to use as the post's opening figure. */
    frame: z.object({ demo: z.string(), label: z.string().optional() }).optional(),
  }),
});

/**
 * The real documentation, read straight out of the repository's /docs folder —
 * one source of truth for the README, the package and the website. The files
 * carry no frontmatter, so the title comes from the first H1 and the ordering
 * and blurbs live in src/data/docs.ts.
 */
const docs = defineCollection({
  loader: glob({ base: "../docs", pattern: "**/*.md" }),
  schema: z.object({}).passthrough(),
});

export const collections = { blog, docs };
