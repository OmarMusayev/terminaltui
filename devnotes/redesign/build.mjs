/**
 * build.mjs — inlines the real captured terminal frames into a template.
 *
 *   node devnotes/redesign/build.mjs devnotes/redesign/site-a.tpl.html site-a.html
 *
 * The template must contain the literal token __FRAMES_JSON__ exactly once,
 * positioned inside a <script> as the right-hand side of an assignment, e.g.
 *
 *     const FRAMES = __FRAMES_JSON__;
 *
 * The emitted file is fully self-contained: no build step, no fetch, no deps.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const [tpl, out] = process.argv.slice(2);
if (!tpl || !out) {
  console.error("usage: node devnotes/redesign/build.mjs <template> <output>");
  process.exit(1);
}

const html = readFileSync(resolve(ROOT, tpl), "utf8");
if (!html.includes("__FRAMES_JSON__")) {
  console.error(`error: ${tpl} has no __FRAMES_JSON__ token`);
  process.exit(1);
}

const frames = JSON.parse(readFileSync(resolve(ROOT, "devnotes/frames.json"), "utf8"));

// Strip </script> defensively: the payload is embedded inside a <script> block
// and a literal closing tag anywhere in the data would end it early.
const json = JSON.stringify(frames).replace(/<\/script/gi, "<\\/script");

const built = html.replace("__FRAMES_JSON__", () => json);
writeFileSync(resolve(ROOT, out), built);

const kb = (n) => (n / 1024).toFixed(0) + "kb";
console.log(
  `built ${out}  (${kb(built.length)} total, ${kb(json.length)} of it real terminal frames)`,
);
