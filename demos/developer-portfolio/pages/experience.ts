import {
  card, spacer, section, timeline,
} from "../../../src/index.js";

export const metadata = { label: "Experience", icon: "[]" };

export default function Experience() {
  return [
    section("Work History", [
      timeline([
        {
          title: "Lead Engineer",
          subtitle: "Stitch",
          period: "2024 - Present",
          description: "Leading a team of six engineers building Patchwork, a collaborative editing platform. Architected the CRDT sync layer, designed the plugin SDK, and drove adoption from 40 to 200+ enterprise teams. Reduced editor crash rate by 97% through a custom OT fallback system.",
        },
        {
          title: "Senior Fullstack Engineer",
          subtitle: "Verdant",
          period: "2021 - 2024",
          description: "Built the real-time analytics stack from the ground up. Designed the event ingestion pipeline handling 2M events/day, implemented the query engine on ClickHouse, and led the frontend team shipping the dashboard used by 500+ e-commerce brands.",
        },
        {
          title: "Co-founder & CTO",
          subtitle: "Halflight",
          period: "2022 - 2023",
          description: "Co-founded a wellness startup building an adaptive meditation app. Led all technical decisions, built the React Native app, integrated HealthKit biometrics, and shipped the audio engine. Reached 180k downloads before the company was acqui-hired.",
        },
        {
          title: "Software Engineer",
          subtitle: "Basecamp Labs (YC S19)",
          period: "2019 - 2021",
          description: "First engineering hire at a seed-stage project management startup. Built the core product in React and Node.js, set up CI/CD and infrastructure on AWS, and helped scale from 0 to 15k active users before Series A.",
        },
      ]),
    ]),
    spacer(),
    section("Education", [
      card({
        title: "B.S. Computer Science",
        subtitle: "Carnegie Mellon University -- 2015 - 2019",
        body: "Concentration in software engineering and human-computer interaction. Teaching assistant for Distributed Systems (15-440). Capstone project on real-time collaborative editing algorithms.",
      }),
      spacer(),
      card({
        title: "Recurse Center",
        subtitle: "Brooklyn, NY -- Fall 2019",
        body: "Twelve-week self-directed programming retreat. Focused on systems programming in Rust, built a toy database engine, and contributed to open-source developer tools.",
      }),
    ]),
  ];
}
