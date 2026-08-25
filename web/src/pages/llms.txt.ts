import llms from "../../../llms.txt?raw";

export const prerender = true;

export function GET() {
  return new Response(llms, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
