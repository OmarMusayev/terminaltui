import {
  defineSite,
  page,
  card,
  timeline,
  section,
  accordion,
  markdown,
  link,
  spacer,
  asciiArt,
  artCompose,
} from "../../src/index.js";

export default defineSite({
  name: "Kai Nakamura",
  handle: "@kainakamura",
  tagline: "Building the infrastructure that builds the future",
  banner: {
    text: "KAI",
    font: "Larry 3D",
    gradient: ["#ff0080", "#7928ca"],
    shadow: true,
  },
  theme: "cyberpunk",
  animations: {
    boot: true,
    transitions: "slide",
    exitMessage: "// connection terminated. see you in the codebase.",
  },
  pages: [
    page("home", {
      title: "Home",
      icon: "~",
      content: [
        {
          type: "custom" as const,
          render: (width: number) => {
            const cityscape = asciiArt.scene("cityscape", { width });
            return artCompose.colorize(cityscape, "#7928ca");
          },
        },
        spacer(),
        {
          type: "text" as const,
          content: "infrastructure engineer · open source · rust",
          style: "plain" as const,
        },
        spacer(),
        {
          type: "text" as const,
          content:
            "Staff engineer focused on distributed systems, developer tooling, and making infrastructure disappear. Currently building the next generation of data pipelines at Dataflow. Open source maintainer and Rust evangelist.",
          style: "markdown" as const,
        },
      ],
    }),

    page("projects", {
      title: "Projects",
      icon: ">>",
      content: [
        section("Featured Projects", [
          card({
            title: "Conduit",
            subtitle: "2025",
            body: "A high-performance stream processing framework written in Rust. Handles 2M+ events/sec with sub-millisecond latency. Used in production by 40+ companies for real-time data pipelines.",
            tags: ["Rust", "Streaming", "Open Source"],
            url: "https://github.com/kainakamura/conduit",
          }),
          card({
            title: "Nebula Deploy",
            subtitle: "2024",
            body: "Zero-downtime deployment orchestrator for Kubernetes. Declarative rollout strategies with automatic canary analysis and rollback. Reduced deployment failures by 94% at Dataflow.",
            tags: ["Go", "Kubernetes", "DevOps"],
            url: "https://github.com/kainakamura/nebula-deploy",
          }),
          card({
            title: "Lattice",
            subtitle: "2024",
            body: "Distributed service mesh with built-in observability. Provides automatic mTLS, traffic splitting, and circuit breaking without sidecar proxies. 10x lower resource overhead.",
            tags: ["Rust", "Networking", "Infrastructure"],
            url: "https://github.com/kainakamura/lattice",
          }),
        ]),
        spacer(),
        section("Open Source Contributions", [
          card({
            title: "tokio-uring",
            subtitle: "2023",
            body: "Major contributor to the io_uring runtime for Tokio. Implemented zero-copy buffer management and multishot accept, improving throughput by 3x for high-connection workloads.",
            tags: ["Rust", "Linux", "Async"],
            url: "https://github.com/tokio-rs/tokio-uring",
          }),
          card({
            title: "kube-rs",
            subtitle: "2023",
            body: "Core maintainer of the Rust Kubernetes client. Designed the controller-runtime reconciler pattern and watcher framework used by hundreds of operators in production.",
            tags: ["Rust", "Kubernetes", "API"],
            url: "https://github.com/kube-rs/kube",
          }),
          card({
            title: "OpenTelemetry Rust SDK",
            subtitle: "2022",
            body: "Contributed the batch span processor and OTLP exporter. Reduced memory allocations by 60% through arena-based allocation and zero-copy serialization.",
            tags: ["Rust", "Observability", "CNCF"],
            url: "https://github.com/open-telemetry/opentelemetry-rust",
          }),
        ]),
      ],
    }),

    page("experience", {
      title: "Experience",
      icon: "[]",
      content: [
        timeline([
          {
            title: "Staff Engineer",
            subtitle: "Dataflow",
            period: "2024 – Present",
            description:
              "Leading the platform infrastructure team. Architecting the next-generation stream processing engine in Rust. Managing a team of 8 engineers across three time zones. Reduced infrastructure costs by 40% through workload optimization.",
          },
          {
            title: "Senior Software Engineer",
            subtitle: "Stripe",
            period: "2021 – 2024",
            description:
              "Core contributor to the payment processing pipeline. Built the real-time fraud detection system processing 500k transactions/sec. Designed the internal service mesh that reduced inter-service latency by 65%.",
          },
          {
            title: "Software Engineer",
            subtitle: "Google",
            period: "2019 – 2021",
            description:
              "Worked on Borg/Kubernetes infrastructure. Contributed to cluster autoscaler improvements that saved $12M annually. Developed internal tooling for automated capacity planning across 30+ regions.",
          },
          {
            title: "Junior Developer",
            subtitle: "Nexus Systems (YC W18)",
            period: "2017 – 2019",
            description:
              "First engineering hire at an early-stage startup. Built the entire backend from scratch in Go. Handled everything from database design to CI/CD pipelines. Company acquired in 2020.",
          },
        ]),
      ],
    }),

    page("skills", {
      title: "Skills",
      icon: "##",
      content: [
        accordion([
          {
            label: "Languages",
            content: [
              markdown(`
**Rust** — Primary language. 5+ years in production systems, async runtimes, unsafe optimization. Contributed to tokio, serde, and the compiler.

**Go** — 7 years. Built backend services, CLI tools, and Kubernetes operators. Deep experience with concurrency patterns and the runtime.

**TypeScript** — 4 years. Full-stack tooling, Node.js services, and developer experience infrastructure.

**Python** — ML pipelines, data analysis, and rapid prototyping. Comfortable with numpy/pandas ecosystem.
`),
            ],
          },
          {
            label: "Infrastructure",
            content: [
              markdown(`
**Kubernetes** — Deep expertise. Built custom controllers, operators, and schedulers. Core contributor to kube-rs.

**AWS** — Extensive production experience across EC2, ECS, Lambda, DynamoDB, Kinesis, and networking. Certified Solutions Architect.

**Terraform** — Infrastructure-as-code for multi-region deployments. Written custom providers and modules for internal platforms.

**Docker** — Container optimization, multi-stage builds, and runtime security. Built internal base image pipelines.
`),
            ],
          },
        ]),
      ],
    }),

    page("blog", {
      title: "Blog",
      icon: "//",
      content: [
        card({
          title: "Why We Rewrote Our Pipeline in Rust",
          subtitle: "March 2026",
          body: "The story of migrating 2M events/sec from JVM to Rust. We cut P99 latency from 45ms to 800μs and reduced our AWS bill by 60%. Here's what went right, what went wrong, and what we'd do differently.",
          url: "https://kai.dev/blog/rust-pipeline-rewrite",
        }),
        card({
          title: "Zero-Copy Deserialization in Production",
          subtitle: "January 2026",
          body: "How we eliminated 3GB/sec of memory allocations using arena allocators and zero-copy parsing. A deep dive into rkyv, flatbuffers, and custom formats for real-time data processing.",
          url: "https://kai.dev/blog/zero-copy-deserialization",
        }),
        card({
          title: "Building a Service Mesh Without Sidecars",
          subtitle: "November 2025",
          body: "Sidecar proxies add latency and resource overhead. We built Lattice, a kernel-level service mesh using eBPF that provides mTLS, load balancing, and observability with zero additional containers.",
          url: "https://kai.dev/blog/service-mesh-without-sidecars",
        }),
        card({
          title: "The Case for io_uring in Production",
          subtitle: "August 2025",
          body: "After running io_uring in production for 18 months, here are our benchmarks, war stories, and the gotchas nobody tells you about. Spoiler: it's not always faster.",
          url: "https://kai.dev/blog/io-uring-in-production",
        }),
        card({
          title: "Kubernetes Operators That Don't Break",
          subtitle: "May 2025",
          body: "Lessons from maintaining kube-rs and building 12 production operators. Covers idempotency, leader election, finalizers, and the reconciliation patterns that actually work at scale.",
          url: "https://kai.dev/blog/kubernetes-operators",
        }),
      ],
    }),

    page("links", {
      title: "Links",
      icon: "->",
      content: [
        link("GitHub", "https://github.com/kainakamura", { icon: ">" }),
        link("Twitter", "https://twitter.com/kainakamura", { icon: ">" }),
        link("Blog", "https://kai.dev/blog", { icon: ">" }),
        link("Resume", "https://kai.dev/resume.pdf", { icon: ">" }),
        link("LinkedIn", "https://linkedin.com/in/kainakamura", { icon: ">" }),
        link("Email", "mailto:kai@nakamura.dev", { icon: ">" }),
      ],
    }),
  ],
});
