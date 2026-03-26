import {
  markdown, divider, spacer, sparkline, skillBar,
  row, col, container,
} from "../../../src/index.js";

export const metadata = { label: "About", icon: "~" };

export default function About() {
  return [
    container([
      markdown(`
# About Me

I'm Alex Rivera, a senior fullstack engineer based in Brooklyn, NY with eight years of experience building products that scale. I specialize in TypeScript, React, and Node.js on the frontend and backend, with deep expertise in PostgreSQL, Redis, and cloud-native infrastructure on AWS and GCP.

I've led engineering teams at two YC-backed startups through Series B, shipped consumer products used by millions, and contributed to open-source projects across the JavaScript ecosystem. I care deeply about developer experience, test coverage, and writing code that the next person can actually read. When I'm not coding, I'm rock climbing, reading science fiction, or tinkering with mechanical keyboards.
      `),
      spacer(),
      sparkline([4, 7, 12, 9, 15, 22, 18, 25, 30, 28, 35, 42, 38, 45, 40, 52, 48, 55, 60, 58]),
      spacer(),
      divider("Skills"),
      spacer(),
      row([
        col([
          skillBar("TypeScript / JavaScript", 95),
          skillBar("React / Next.js", 92),
        ], { span: 4, sm: 6, xs: 12 }),
        col([
          skillBar("Node.js / Express / Fastify", 90),
          skillBar("PostgreSQL / Redis", 88),
        ], { span: 4, sm: 6, xs: 12 }),
        col([
          skillBar("AWS / GCP / Docker", 85),
        ], { span: 4, sm: 6, xs: 12 }),
      ], { gap: 1 }),
    ], { maxWidth: 90, padding: 1 }),
  ];
}
