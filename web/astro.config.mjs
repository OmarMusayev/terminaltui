import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://terminaltui.dev",
  integrations: [
    mdx(),
    sitemap({
      // Design explorations remain shareable, but only the selected Paper
      // routes belong in the production search index.
      filter: (page) => {
        const path = new URL(page).pathname;
        return !path.startsWith("/d/") && !path.startsWith("/logo/");
      },
    }),
  ],
  vite: { plugins: [tailwind()] },
  image: {
    // Nothing on this site needs raster transforms — every image is either an
    // inline SVG or real terminal output reproduced as styled spans. Skipping
    // the sharp service keeps the install free of native modules.
    service: { entrypoint: "astro/assets/services/noop" },
  },
  build: { inlineStylesheets: "auto" },
  markdown: {
    /**
     * Dual themes rather than a fixed dark slab. The page is full of real,
     * full-colour terminal captures; a permanently-dark code block would be a
     * second saturated rectangle competing with them, and it would blur the
     * most useful distinction on the page — source you type versus output you
     * get. Code follows the page theme and stays quiet.
     */
    shikiConfig: {
      themes: { light: "github-light", dark: "github-dark" },
      wrap: false,
    },
    rehypePlugins: [rehypeWrapTables, rehypeDocLinks],
  },
});

/**
 * A wide table inside prose is the classic cause of a page that scrolls
 * sideways on a phone. Wrapping each one in its own scroll container keeps the
 * overflow local to the table.
 */
/**
 * The docs are the repository's own markdown, so their links are written for
 * GitHub: sibling `.md` files, and paths into the source tree. Rewrite the
 * former to site routes and send the latter to GitHub, so neither 404s here.
 *
 * Doc routes are `<base>/docs/<slug>/`, so a sibling is always `../<slug>/`
 * regardless of which direction is rendering it.
 */
const REPO_BLOB = "https://github.com/OmarMusayev/terminaltui/blob/main/";
const DOC_SLUGS = new Set([
  "api-routes", "ascii-art", "cli-reference", "components", "create-command",
  "getting-started", "images", "layouts", "routing", "serve", "state-data",
  "testing", "themes", "video",
]);

function rehypeDocLinks() {
  return (tree, file) => {
    // Only touch files that came from the docs collection.
    const id = file?.data?.astro?.frontmatter?.__docSlug ?? file?.path ?? "";
    const isDoc = typeof id === "string" && /[\\/]docs[\\/][^\\/]+\.md$/.test(id);
    if (!isDoc) return;

    const walk = (node) => {
      if (node.type === "element" && node.tagName === "a") {
        const href = node.properties?.href;
        if (typeof href === "string" && !/^(https?:|mailto:|#)/.test(href)) {
          const [pathPart, hash = ""] = href.split("#");
          const clean = pathPart.replace(/^\.\//, "").replace(/^docs\//, "");
          const slug = clean.replace(/\.md$/, "");
          if (clean.endsWith(".md") && DOC_SLUGS.has(slug)) {
            node.properties.href = `../${slug}/${hash ? "#" + hash : ""}`;
          } else if (pathPart) {
            node.properties.href = REPO_BLOB + pathPart.replace(/^\.\//, "") + (hash ? "#" + hash : "");
            node.properties.rel = "noopener";
          }
        }
      }
      (node.children || []).forEach(walk);
    };
    walk(tree);
  };
}

function rehypeWrapTables() {
  return (tree) => {
    const walk = (node) => {
      if (!node.children) return;
      node.children = node.children.map((child) => {
        walk(child);
        if (child.type === "element" && child.tagName === "table") {
          return {
            type: "element",
            tagName: "div",
            properties: { className: ["table-scroll"] },
            children: [child],
          };
        }
        return child;
      });
    };
    walk(tree);
  };
}
