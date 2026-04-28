# CLI Reference

All commands are available via `npx terminaltui <command>` or, if installed globally, `terminaltui <command>`.

## Commands at a glance

| Command | Purpose |
|---------|---------|
| [`init`](#init) | Scaffold a new project from a template |
| [`create`](#create) | Interactive prompt builder for AI scaffolding |
| [`convert`](#convert) | Drop reference docs into an existing project so an AI can convert it |
| [`validate`](#validate) | Lint a file-based routing project for common mistakes |
| [`dev`](#dev) | Run your TUI locally with on-the-fly compilation |
| [`serve`](#serve) | Host your TUI over SSH (anyone can connect) |
| [`build`](#build) | Bundle for npm publish |
| [`demo`](#demo) | Run a built-in demo |
| [`test`](#test) | Run automated tests on the site in the current directory |
| [`art`](#art) | Manage ASCII art assets |
| [`help`](#help) / [`version`](#version) | Help and version output |

---

### init

Scaffold a new project from a template.

```bash
terminaltui init [template]
```

Templates: `minimal`, `portfolio`, `landing`, `restaurant`, `blog`, `creative`.

If no template is specified, you'll get an interactive prompt.

### create

Interactive prompt builder for new projects.

```bash
terminaltui create
```

Asks 10 questions about your project (name, description, pages, content, theme, style, ASCII art, interactive features, animations, extras), then generates a tailored AI prompt. See [Create Command](./create-command.md) for details.

### convert

Drop terminaltui reference docs into your project for AI-assisted website conversion.

```bash
terminaltui convert
```

Copies `TERMINALTUI_SKILL.md` and `TERMINALTUI_PROMPT.md` into the current directory with paths pre-filled. Open Claude (or another AI coding assistant) and point it at these files to convert your existing website into a TUI in a `tui/` subdirectory.

### validate

Lint a file-based routing project for common issues.

```bash
terminaltui validate
```

Catches missing `default` exports, dynamic-route name collisions, layout files in unreachable positions, and similar mistakes. Exits non-zero if any errors are found (warnings still pass). Only runs against `config.ts` + `pages/` projects.

### dev

Start the development preview. If your project defines API routes (files under `api/`), a local HTTP server starts automatically.

```bash
terminaltui dev [path]
```

With no argument, looks for `config.ts` alongside a `pages/` directory in the current working directory. Pass an explicit path to force a specific config file.

### serve

Host your TUI over SSH. Anyone on the network can connect via `ssh host -p PORT` and use the app interactively, no install required. Each connection gets an independent session.

```bash
terminaltui serve [path] [options]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--port <N>` | `2222` | SSH port |
| `--host-key <path>` | `.terminaltui/host_key` | Host key path (auto-generated as Ed25519 on first run) |
| `--max-connections <N>` | `100` | Max simultaneous connections |

You can also configure these in your project via the `serve` field on `defineConfig()`. See [SSH Hosting](./serve.md) for the full guide, including auth, color-mode handling, and security notes.

`ssh2` is an optional peer dependency — install it with `npm install ssh2` if it's not already pulled in.

### build

Bundle the site for npm publishing.

```bash
terminaltui build [path]
```

After building, run `npm publish` to make your site available via `npx your-package-name`. Build validation checks that the bundle contains a `runSite()` call and warns about hardcoded absolute paths.

### demo

Run a built-in demo from the published package — no install or scaffolding required.

```bash
terminaltui demo <name>
```

Available demos:

| Name | Theme | Highlights |
|------|-------|------------|
| `restaurant` | gruvbox | Tabbed menu, reservation form, split layout |
| `dashboard` | hacker | Live API data, persistent state, parameterized routes |
| `band` | rosePine | Album cards, tour dates, mailing list |
| `coffee-shop` | catppuccin | Tabbed menu, catering form |
| `conference` | nord | Schedule tabs, speaker grid, sponsor tiers |
| `developer-portfolio` | cyberpunk | Skill bars, sparklines, project grid |
| `freelancer` | custom | Testimonial quotes, contact form |
| `startup` | tokyoNight | Pricing tiers, feature accordion |
| `server-dashboard` | hacker | System metrics, container table, log stream |

Demo sources ship inside the published `terminaltui` package under `demos/<name>/` (config.ts + pages/). The CLI compiles them on the fly via `esbuild`.

### test

Run automated tests on the site in the current directory using the headless emulator.

```bash
terminaltui test [options]
```

| Flag | Description |
|------|-------------|
| `--cols=N` | Test at a specific terminal width (default: 80) |
| `--sizes` | Test at multiple widths: 40, 80, 120, 200 |
| `--verbose`, `-v` | Show screen output during tests |

### art

Manage ASCII art assets.

```bash
terminaltui art <subcommand>
```

Subcommands: `list`, `preview`, `create`, `validate`.

### help

Show the help message.

```bash
terminaltui help
terminaltui --help
terminaltui -h
```

### version

Print the installed version.

```bash
terminaltui version
terminaltui --version
terminaltui -v
```
