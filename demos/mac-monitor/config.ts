import { defineConfig } from "../../src/index.js";

export default defineConfig({
  name: "Mac Monitor",
  tagline: "real-time system dashboard",
  theme: "hacker",
  banner: {
    text: "MAC MONITOR",
    font: "ANSI Shadow",
  },
  animations: {
    boot: true,
    
  },
  menu: {
    items: [
      { label: ">> Overview", page: "home" },
      { label: "## CPU", page: "cpu" },
      { label: "[] Memory", page: "memory" },
      { label: "^^ GPU", page: "gpu" },
      { label: "// Disk", page: "disk" },
      { label: "<> Network", page: "network" },
      { label: "++ Battery", page: "battery" },
      { label: "$$ Processes", page: "processes" },
    ],
  },
});
