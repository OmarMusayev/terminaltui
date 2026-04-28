# SSH Hosting (`terminaltui serve`)

Host any terminaltui app over SSH so anyone with an SSH client can connect and use the app — no install required. Think `ssh chat.shazow.net` but for any terminaltui project.

```bash
terminaltui serve --port 2222
```

Then from any machine:

```bash
ssh localhost -p 2222
```

Each connection gets an independent `TUIRuntime` with its own state, color mode, and focus. Arrow keys, forms, navigation, and resize all work identically to local `dev`.

## Requirements

- `ssh2` is an optional peer dependency. Install it once: `npm install ssh2`. The `dev` and `build` commands work without it; only `serve` needs it.
- Node 18+.

## Quick start

From a project that already runs under `terminaltui dev`:

```bash
terminaltui serve
# → SSH server listening on :2222
# → Host key: .terminaltui/host_key (auto-generated as Ed25519)
```

From a different machine on the same network:

```bash
ssh user@your-host -p 2222
```

The first launch generates an Ed25519 host key at `.terminaltui/host_key` and re-uses it on every subsequent run, so SSH clients don't get host-key-changed warnings.

## CLI flags

| Flag | Default | Description |
|------|---------|-------------|
| `--port <N>` | `2222` | SSH port to listen on |
| `--host-key <path>` | `.terminaltui/host_key` | Host key path (auto-generated if missing) |
| `--max-connections <N>` | `100` | Maximum simultaneous SSH sessions |

You can also pass an explicit config path: `terminaltui serve path/to/config.ts`.

## Configuring `serve` in your project

Anything you can pass on the command line can also live in your `defineConfig()` under `serve`:

```ts
// config.ts
import { defineConfig } from "terminaltui";

export default defineConfig({
  name: "My Site",
  theme: "cyberpunk",
  serve: {
    port: 2222,
    hostKeyPath: ".terminaltui/host_key",
    maxConnections: 100,
    colorMode: "auto",          // "auto" | "truecolor" | "256" | "16"
    openUrls: false,            // see "Server-side execution" below
    auth: {
      passwords: { alice: "hunter2" },
    },
  },
});
```

CLI flags override `serve` config when both are present.

## Color mode (`colorMode`)

When a client connects, the server reads the SSH pty request's `term` value and picks a color mode automatically:

- `xterm-kitty`, `xterm-ghostty`, `iterm.app`, etc. → **truecolor**
- `xterm-256color`, `screen-256color` → **256-color**
- `vt100`, `xterm`, `screen` → **16-color**

Override this with `serve.colorMode: "truecolor" | "256" | "16"` if you know your audience. Each session keeps its own color mode — multi-user sessions don't clobber each other.

## Per-session isolation

Every accepted SSH connection gets:

- a fresh `TUIRuntime` (page stack, focus, scroll all reset)
- its own `SSHTerminalIO` (the SSH channel acts as stdin/stdout)
- its own color mode (per `colorMode` resolution above)
- isolated reactive state — nothing is shared across sessions unless you wire it up via shared modules

`SIGINT`/`SIGTERM` and `process.exit()` only attach to the local `dev` runtime — a single SSH disconnect can't kill the server.

## Server-side execution caveats

Because the runtime now lives on a server with potentially many users, a few things behave differently in serve mode:

- **`openUrl()` is a no-op** — instead of running `open` / `xdg-open` on the server, the URL is shown as a notification to the connected user. Override with `serve.openUrls: true` if you really want server-side opening (rarely correct).
- **Easter-egg functions are skipped** — function-valued easter egg commands aren't executed in serve mode, so a connected user can't trigger arbitrary server-side code.
- **Filesystem-touching APIs (e.g. `createPersistentState`) write on the server** — the server's filesystem is shared across all sessions. Scope persistent state by user explicitly if you don't want that.

`runtime.isServeMode` is `true` whenever the runtime is hosting an SSH session. Use it to gate server-only code paths.

## Authentication

Optional. If you don't set `serve.auth`, connections are accepted without authentication (suitable for read-only public TUIs).

```ts
serve: {
  auth: {
    passwords: {
      alice: "hunter2",
      bob: "correcthorse",
    },
  },
}
```

For anything more sophisticated (key auth, OAuth-bridged auth, dynamic password lookup), use the programmatic `SSHServer` API directly.

## Programmatic API

```ts
import { SSHServer, ProcessTerminalIO, TUIRuntime, runSite } from "terminaltui";
import type { TerminalIO } from "terminaltui";

const server = new SSHServer(
  { port: 2222, hostKeyPath: ".terminaltui/host_key", maxConnections: 100 },
  async (io: TerminalIO) => {
    const runtime = new TUIRuntime(siteConfig, io);
    await runtime.start();
    return runtime;
  },
);

await server.start();
```

`ProcessTerminalIO` is the default for local `dev` (wraps `process.stdin`/`process.stdout`). `SSHServer` instantiates an `SSHTerminalIO` per accepted session.

## Security checklist

Before exposing a `serve` instance to the public internet:

- Set a non-default `--port` and put it behind your firewall, or front it with a reverse proxy that handles SSH.
- Enable `auth.passwords` (or use the programmatic API for key auth).
- Set `maxConnections` to a value your machine can sustain.
- Audit any code paths gated by `runtime.isServeMode === false`. Anything you only want to run for local users should be wrapped.
- Review `openUrl()`, `createPersistentState()`, and any custom `api/*.ts` handlers — these all run server-side with shared filesystem and network.

## Troubleshooting

**`Error: ssh2 is required for the serve command.`** — Run `npm install ssh2`.

**`Permission denied` on `.terminaltui/host_key`** — Delete the file; the server will regenerate it. Make sure the directory is writable.

**Colors look wrong** — Try forcing `serve.colorMode: "256"` (the safe default). If a specific terminal still misbehaves, capture the connecting client's `TERM` and add it to the auto-detection.

**Disconnect kills the server** — Check that you haven't added a `process.on("SIGINT", () => process.exit())` somewhere outside the runtime; SSH disconnect handlers are scoped per-session by default.
