import { defineConfig } from "../../src/index.js";

export default defineConfig({
  name: "Alex Rivera",
  tagline: "senior fullstack engineer",
  banner: {
    text: "ALEX",
    font: "ANSI Shadow",
    gradient: ["#ff2a6d", "#05d9e8"],
  },
  theme: "cyberpunk",
  animations: {
    boot: true,
    
    exitMessage: "$ logout",
  },
});
