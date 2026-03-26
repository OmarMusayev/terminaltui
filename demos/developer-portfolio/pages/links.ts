import {
  link, row, col,
} from "../../../src/index.js";

export const metadata = { label: "Links", icon: "->" };

export default function Links() {
  return [
    row([
      col([link("GitHub", "https://github.com/arivera", { icon: ">" })], { span: 6, xs: 12 }),
      col([link("Twitter", "https://twitter.com/alexrivera_dev", { icon: ">" })], { span: 6, xs: 12 }),
    ], { gap: 1 }),
    row([
      col([link("LinkedIn", "https://linkedin.com/in/alexrivera", { icon: ">" })], { span: 6, xs: 12 }),
      col([link("Email", "mailto:alex@alexrivera.dev", { icon: ">" })], { span: 6, xs: 12 }),
    ], { gap: 1 }),
    row([
      col([link("Blog", "https://alexrivera.dev/blog", { icon: ">" })], { span: 6, xs: 12 }),
      col([link("Resume", "https://alexrivera.dev/resume.pdf", { icon: ">" })], { span: 6, xs: 12 }),
    ], { gap: 1 }),
    row([
      col([link("Mastodon", "https://hachyderm.io/@alexrivera", { icon: ">" })], { span: 6, xs: 12 }),
      col([link("Polywork", "https://polywork.com/alexrivera", { icon: ">" })], { span: 6, xs: 12 }),
    ], { gap: 1 }),
  ];
}
