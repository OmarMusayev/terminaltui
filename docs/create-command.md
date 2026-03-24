# terminaltui create

Build a new TUI project from scratch using an interactive questionnaire. No coding required — describe what you want, and an AI assistant builds it.

## Overview

```bash
terminaltui create
```

The `create` command asks you 10 questions about your project, then assembles a tailored AI prompt. You paste that prompt into Claude Code (or any AI coding assistant), and it generates a complete `site.config.ts` with all the content, styling, and interactivity.

No LLM runs during the questionnaire — it's pure string interpolation. The AI only comes in when you paste the generated prompt.

## How It Works

1. Run `terminaltui create`
2. Answer 10 questions about your project
3. The command creates a new directory with:
   - `TERMINALTUI_SKILL.md` — full framework API reference
   - `TERMINALTUI_CREATE_PROMPT.md` — your tailored build prompt
   - `package.json` — pre-configured with terminaltui dependency
4. Open Claude Code in that directory
5. Paste the instructions from `TERMINALTUI_CREATE_PROMPT.md`
6. AI generates `site.config.ts` — run `terminaltui dev` to preview

## The 10 Questions

| # | Question | What it controls | Example answer |
|---|----------|-----------------|----------------|
| 1 | Project name | Directory name, `npx` command, banner text | `tokyo-ramen` |
| 2 | Description | Content, tone, and purpose of the site | `A ramen restaurant in downtown Tokyo. Cozy atmosphere, 20 seats, open since 1987.` |
| 3 | Pages | Site structure and navigation | `Menu`, `About`, `Location`, `Reviews` |
| 4 | Content | Real text, or "skip" to let AI generate | Menu items with prices, or `skip` |
| 5 | Theme | Color scheme and visual mood | `gruvbox` (warm), `cyberpunk` (neon), or `auto` |
| 6 | Visual style | Banner font, density, overall feel | `bold`, `minimal`, `retro`, `playful`, `professional` |
| 7 | ASCII art | Decorative scenes and art | `coffee-cup, mountains` or `auto` or `none` |
| 8 | Interactive features | Forms, search, dynamic content | `reservation form, search menu` |
| 9 | Animations | Boot sequence and page transitions | `full`, `subtle`, or `none` |
| 10 | Extra instructions | Anything else | `Include a weekly special section` |

## init vs create vs convert

| Command | When to use | What happens |
|---------|------------|--------------|
| `terminaltui init [template]` | You want a template to edit manually | Scaffolds a project with placeholder content |
| `terminaltui create` | You want to describe something new | Generates an AI prompt tailored to your answers |
| `terminaltui convert` | You have an existing website | Drops conversion docs for AI to read your site |

**Use `create` when:** you don't have an existing website, you want AI to generate all the content and config, and you want to describe what you want in plain language.

**Use `init` when:** you prefer to write the config yourself from a starting template.

**Use `convert` when:** you already have a website (HTML, React, Vue, etc.) and want a TUI version of it.

## Tips for Better Results

- **Be specific in the description.** "A sushi restaurant" is okay. "A high-end omakase restaurant in Manhattan, 12 seats, prix fixe menu, opened 2019, Japanese minimalist aesthetic" is much better.
- **List all your pages.** The more pages you specify, the more complete the generated site will be.
- **Paste real content.** If you have actual menu items, team bios, or product descriptions, paste them in question 4. The AI will use your real content instead of generating placeholder text.
- **Pick a theme that matches your vibe.** Each theme has a mood — `gruvbox` is warm and earthy (great for restaurants), `cyberpunk` is neon and edgy (great for tech), `nord` is clean and professional.
- **Use "auto" when unsure.** For theme, ASCII art, and style, "auto" lets the AI choose based on your description.

## Example Walkthrough

Here's a full session creating a restaurant site:

```
$ terminaltui create

  ╭─────────────────────────────────────╮
  │  terminaltui create                 │
  │  Interactive Project Builder        │
  ╰─────────────────────────────────────╯

? Project name: tokyo-ramen

? Describe your project:
  A cozy ramen restaurant in Shibuya, Tokyo.
  Family-owned since 1987. Known for rich tonkotsu
  broth and handmade noodles. 20 seats, always a line.

? List your pages (one per line, blank line to finish):
  Menu
  Our Story
  Location & Hours
  Reviews

? Paste your content (or type "skip"):
  skip

? Choose a theme: gruvbox

? Visual style: bold

? ASCII art: auto

? Interactive features: none

? Animations: subtle

? Extra instructions:
  Include a "Daily Special" section on the menu page.
  The vibe should feel warm and inviting.

  Creating tokyo-ramen/ ...
  ╭──────────────────────────────────────────╮
  │                                          │
  │  Project created: tokyo-ramen/           │
  │                                          │
  │  Next steps:                             │
  │  1. cd tokyo-ramen                       │
  │  2. Open Claude Code                     │
  │  3. Paste the prompt from                │
  │     TERMINALTUI_CREATE_PROMPT.md         │
  │                                          │
  ╰──────────────────────────────────────────╯
```

The generated `TERMINALTUI_CREATE_PROMPT.md` contains a detailed prompt that tells the AI exactly what to build, including your answers, the framework API reference, and specific instructions for the theme, style, and features you chose.
