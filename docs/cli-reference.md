# CLI Reference

All commands are available via `npx terminaltui <command>` or, if installed globally, `terminaltui <command>`.

## Commands

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

### dev

Start the development preview. If your config defines API routes, a local HTTP server starts automatically.

```bash
terminaltui dev [path]
```

Looks for `site.config.ts` (or `.js`, `.mjs`) in the current directory. Pass a path to use a specific config file.

### build

Bundle the site for npm publishing.

```bash
terminaltui build
```

After building, run `npm publish` to make your site available via `npx your-package-name`.

### test

Run automated tests on the site in the current directory.

```bash
terminaltui test [options]
```

| Flag | Description |
|------|-------------|
| `--cols=N` | Test at specific terminal width (default: 80) |
| `--sizes` | Test at multiple widths: 40, 80, 120, 200 |
| `--verbose`, `-v` | Show screen output during tests |

### art

Manage ASCII art assets.

```bash
terminaltui art <subcommand>
```

Subcommands: `list`, `preview`, `create`, `validate`.

### convert

Drop terminaltui reference docs into your project for AI-assisted website conversion.

```bash
terminaltui convert
```

This copies `TERMINALTUI_SKILL.md` and `TERMINALTUI_PROMPT.md` into your project directory with paths pre-filled. Open your AI coding assistant and point it at these files to convert your existing website into a TUI.

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
