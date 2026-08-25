export const prerender = true;

export function GET({ site }: { site?: URL }) {
  const origin = (site ?? new URL("https://terminaltui.dev")).origin;
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /d/",
    "Disallow: /logo/",
    `Sitemap: ${origin}/sitemap-index.xml`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
