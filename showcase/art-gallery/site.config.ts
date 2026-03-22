import {
  defineSite,
  page,
  markdown,
  link,
  card,
  accordion,
  divider,
  asciiArt,
  artCompose,
} from "../../src/index.js";

// --- Data for scene and pattern pages ---

const scenes: Array<{
  name: string;
  type: "mountains" | "cityscape" | "rocket" | "cat" | "robot" | "coffee-cup";
}> = [
  { name: "Mountains", type: "mountains" },
  { name: "Cityscape", type: "cityscape" },
  { name: "Rocket", type: "rocket" },
  { name: "Cat", type: "cat" },
  { name: "Robot", type: "robot" },
  { name: "Coffee Cup", type: "coffee-cup" },
];

const patternTypes: Array<{
  name: string;
  type: "circuit" | "bricks" | "stars" | "waves" | "diagonal" | "static";
}> = [
  { name: "Circuit", type: "circuit" },
  { name: "Bricks", type: "bricks" },
  { name: "Stars", type: "stars" },
  { name: "Waves", type: "waves" },
  { name: "Diagonal", type: "diagonal" },
  { name: "Static", type: "static" },
];

// --- Icon rendering helper ---

function renderIconRow(names: string[]): string[] {
  const iconArts: string[][] = [];
  for (const name of names) {
    const icon = asciiArt.getIcon(name);
    if (icon) {
      iconArts.push([name, ...icon]);
    }
  }
  if (iconArts.length === 0) return [];
  let composed = iconArts[0];
  for (let i = 1; i < iconArts.length; i++) {
    composed = artCompose.sideBySide(composed, iconArts[i], 3);
  }
  return ["", ...composed.map((l) => "  " + l), ""];
}

// --- Site definition ---

export default defineSite({
  name: "ASCII Art Gallery",
  tagline: "A visual showroom for terminal art",
  banner: {
    text: "ART",
    font: "DOS Rebel",
    gradient: [
      "#ff5555",
      "#ffb86c",
      "#f1fa8c",
      "#50fa7b",
      "#8be9fd",
      "#bd93f9",
      "#ff79c6",
    ],
    shadow: true,
    border: "rounded",
  },
  theme: "dracula",
  borders: "rounded",
  animations: {
    boot: true,
    transitions: "fade",
    exitMessage: "Art is never finished, only abandoned. — Leonardo da Vinci",
  },
  easterEggs: {
    konami: true,
  },
  pages: [
    // ─── Scenes ─────────────────────────────────────────────
    page("scenes", {
      title: "Scenes",
      icon: "~",
      content: scenes.flatMap((scene) => [
        card({
          title: scene.name,
          subtitle: "Decorative ASCII scene",
        }),
        {
          type: "custom" as const,
          render: (width: number, theme: any) => {
            const sceneWidth = Math.min(width - 4, 70);
            const art = asciiArt.scene(scene.type, { width: sceneWidth });
            const colored = artCompose.colorize(art, theme.accent);
            return ["", ...colored.map((l: string) => "  " + l), ""];
          },
        },
      ]),
    }),

    // ─── Shapes ─────────────────────────────────────────────
    page("shapes", {
      title: "Shapes",
      icon: "<>",
      content: [
        card({
          title: "Heart / Star / Diamond",
          subtitle: "Curved and pointed forms",
        }),
        {
          type: "custom" as const,
          render: () => {
            const heart = artCompose.colorize(asciiArt.heart(5), "#ff5555");
            const star = artCompose.colorize(asciiArt.star(5, 5), "#f1fa8c");
            const diamond = artCompose.colorize(
              asciiArt.diamond(5),
              "#8be9fd",
            );
            const row = artCompose.sideBySide(
              artCompose.sideBySide(heart, star, 4),
              diamond,
              4,
            );
            return ["", ...row.map((l: string) => "  " + l), ""];
          },
        },
        card({
          title: "Circle / Hexagon / Triangle",
          subtitle: "Regular polygons",
        }),
        {
          type: "custom" as const,
          render: () => {
            const circle = artCompose.colorize(asciiArt.circle(4), "#50fa7b");
            const hexagon = artCompose.colorize(
              asciiArt.hexagon(4),
              "#bd93f9",
            );
            const triangle = artCompose.colorize(
              asciiArt.triangle(7),
              "#ffb86c",
            );
            const row = artCompose.sideBySide(
              artCompose.sideBySide(circle, hexagon, 4),
              triangle,
              4,
            );
            return ["", ...row.map((l: string) => "  " + l), ""];
          },
        },
      ],
    }),

    // ─── Patterns ───────────────────────────────────────────
    page("patterns", {
      title: "Patterns",
      icon: "::",
      content: patternTypes.flatMap((pattern) => [
        card({
          title: pattern.name,
          subtitle: "Tileable fill pattern",
        }),
        {
          type: "custom" as const,
          render: (_width: number, theme: any) => {
            const pat = asciiArt.pattern(40, 4, pattern.type);
            const colored = artCompose.colorize(pat, theme.accent);
            return ["", ...colored.map((l: string) => "  " + l), ""];
          },
        },
      ]),
    }),

    // ─── Data Art ───────────────────────────────────────────
    page("data-art", {
      title: "Data Art",
      icon: "%",
      content: [
        card({
          title: "Bar Chart",
          subtitle: "Language popularity comparison",
        }),
        {
          type: "custom" as const,
          render: (width: number) => {
            const chartWidth = Math.min(width - 8, 55);
            const bars = asciiArt.barChart(
              [
                { label: "Rust", value: 92 },
                { label: "Go", value: 78 },
                { label: "Python", value: 85 },
                { label: "TypeScript", value: 88 },
                { label: "C++", value: 65 },
              ],
              { width: chartWidth, showValues: true },
            );
            return ["", ...bars.map((l: string) => "    " + l), ""];
          },
        },

        card({
          title: "Pie Chart",
          subtitle: "OS market share distribution",
        }),
        {
          type: "custom" as const,
          render: () => {
            const pie = asciiArt.pieChart(
              [
                { label: "Linux", value: 45 },
                { label: "macOS", value: 35 },
                { label: "Windows", value: 15 },
                { label: "BSD", value: 5 },
              ],
              6,
            );
            return ["", ...pie.map((l: string) => "    " + l), ""];
          },
        },

        card({
          title: "Sparkline",
          subtitle: "Composite sine-wave signal",
        }),
        {
          type: "custom" as const,
          render: (width: number) => {
            const chartWidth = Math.min(width - 8, 55);
            const sparkData: number[] = [];
            for (let i = 0; i < 20; i++) {
              sparkData.push(
                Math.sin(i * 0.4) * 50 + 50 + Math.sin(i * 1.2) * 20,
              );
            }
            const spark = asciiArt.sparkline(
              sparkData,
              Math.min(chartWidth, 40),
            );
            return ["", ...spark.map((l: string) => "    " + l), ""];
          },
        },

        card({
          title: "Braille Graph",
          subtitle: "Sine wave at braille resolution",
        }),
        {
          type: "custom" as const,
          render: (width: number) => {
            const chartWidth = Math.min(width - 8, 55);
            const sineData: number[] = [];
            for (let i = 0; i < 60; i++) {
              sineData.push(Math.sin(i * 0.15) * 40 + 50);
            }
            const graphWidth = Math.min(Math.floor(chartWidth / 2), 30);
            const graph = asciiArt.graph(sineData, graphWidth, 10);
            return ["", ...graph.map((l: string) => "    " + l), ""];
          },
        },
      ],
    }),

    // ─── Icons ──────────────────────────────────────────────
    page("icons", {
      title: "Icons",
      icon: "*",
      content: [
        accordion([
          {
            label: "Tech & Dev",
            content: [
              {
                type: "custom" as const,
                render: () =>
                  renderIconRow([
                    "laptop",
                    "terminal",
                    "code",
                    "folder",
                    "file",
                    "git",
                  ]),
              },
            ],
          },
          {
            label: "People & Communication",
            content: [
              {
                type: "custom" as const,
                render: () =>
                  renderIconRow(["person", "users", "mail", "phone", "book"]),
              },
            ],
          },
          {
            label: "Media & Creative",
            content: [
              {
                type: "custom" as const,
                render: () =>
                  renderIconRow(["music", "film", "camera", "pen"]),
              },
            ],
          },
          {
            label: "Objects & Travel",
            content: [
              {
                type: "custom" as const,
                render: () =>
                  renderIconRow(["briefcase", "cup", "food", "car", "plane"]),
              },
            ],
          },
          {
            label: "Symbols & Nature",
            content: [
              {
                type: "custom" as const,
                render: () =>
                  renderIconRow(["heart", "star", "globe", "pin", "clock"]),
              },
            ],
          },
          {
            label: "Status & Indicators",
            content: [
              {
                type: "custom" as const,
                render: () =>
                  renderIconRow([
                    "check",
                    "cross",
                    "warning",
                    "chart",
                    "chain",
                  ]),
              },
            ],
          },
        ]),
      ],
    }),

    // ─── About ──────────────────────────────────────────────
    page("about", {
      title: "About",
      icon: "?",
      content: [
        markdown(`
## About the ASCII Art System

This gallery showcases the built-in ASCII art system available in the TUI framework. Every piece of art you see here is generated programmatically — no pre-made text files, no external dependencies.
        `),
        accordion([
          {
            label: "Scenes",
            content: [
              markdown(
                "Pre-built decorative scenes like mountains, cityscapes, rockets, and more. Each scene is resolution-aware and scales to your terminal width.",
              ),
            ],
          },
          {
            label: "Shapes",
            content: [
              markdown(
                "Geometric primitives: circles, hearts, stars, diamonds, triangles, and hexagons. All rendered with box-drawing and block characters for crisp edges.",
              ),
            ],
          },
          {
            label: "Patterns",
            content: [
              markdown(
                "Tileable pattern fills for backgrounds and decorative regions. Circuits, bricks, waves, static, and more. Configurable density and reproducible with seeds.",
              ),
            ],
          },
          {
            label: "Data Visualization",
            content: [
              markdown(
                "Bar charts, pie charts, sparklines, heatmaps, and braille-resolution line graphs. Turn your data into terminal-native visualizations.",
              ),
            ],
          },
          {
            label: "Icons",
            content: [
              markdown(
                "30+ hand-drawn icons using box-drawing characters. Laptops, terminals, hearts, globes, and everything in between.",
              ),
            ],
          },
          {
            label: "Composition",
            content: [
              markdown(
                "Stack, tile, overlay, mirror, rotate, colorize, and gradient your art. The `artCompose` API lets you build complex scenes from simple pieces.",
              ),
            ],
          },
        ]),
        markdown(`
### Design Philosophy

Terminal art lives within constraints: monospace fonts, limited colors, and a character grid. These constraints are features, not bugs. The ASCII art system embraces them, using Unicode box-drawing characters, block elements, and braille patterns to create art that feels native to the terminal.

Every generator is deterministic, resolution-aware, and theme-compatible. Art adapts to your terminal width and color scheme automatically.
        `),
        divider(),
        link("Source Code", "https://github.com/example/tui", { icon: ">" }),
        link("Documentation", "https://tui.dev/docs/ascii-art", {
          icon: ">",
        }),
        link("NPM Package", "https://npmjs.com/package/@tui/core", {
          icon: ">",
        }),
      ],
    }),
  ],
});
