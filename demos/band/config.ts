import { defineConfig } from "../../src/index.js";

export default defineConfig({
  name: "Glass Cathedral",
  tagline: "atmospheric post-rock from Portland, OR",
  banner: {
    text: "GLASS CATHEDRAL",
    font: "Ghost",
    gradient: ["#ebbcba", "#c4a7e7"],
  },
  theme: "rosePine",
  borders: "double",
  animations: {
    boot: true,
    
  },
});
