/**
 * `terminaltui serve` — host a TUI app over SSH.
 * Anyone can connect with `ssh host -p <port>` and see the TUI rendered
 * in their terminal, zero install required.
 */
import { resolve, dirname, join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import type { TerminalIO } from "../core/terminal-io.js";

interface ServeFlags {
  configPath: string;
  port: number;
  hostKeyPath: string;
  maxConnections: number;
}

export async function runServe(args: string[]): Promise<void> {
  const flags = parseFlags(args);

  // Detect project type
  const absPath = resolve(flags.configPath);
  const projectDir = dirname(absPath);
  const isFileBased = detectFileBased(projectDir, absPath);

  // Dynamically import SSHServer (ssh2 checked at runtime)
  const { SSHServer } = await import("../core/ssh-server.js");

  if (!isFileBased) {
    console.error(
      `\n  Single-file site configs are no longer supported.\n\n` +
      `  Use a file-based project: a directory with config.ts (or config.js)\n` +
      `  alongside a pages/ directory. See terminaltui init for a starter.\n`,
    );
    process.exit(1);
  }

  const server = new SSHServer(
    {
      port: flags.port,
      hostKeyPath: flags.hostKeyPath,
      maxConnections: flags.maxConnections,
    },
    async (terminalIO: TerminalIO) => startFileBasedSession(projectDir, terminalIO),
  );

  // Graceful shutdown
  const shutdown = () => {
    console.log("\n  \x1b[2mShutting down...\x1b[0m");
    server.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await server.start();
}

async function startFileBasedSession(projectDir: string, terminalIO: TerminalIO): Promise<any> {
  const outDir = join(projectDir, ".terminaltui");
  mkdirSync(outDir, { recursive: true });

  const configPath = join(projectDir, "config.ts");
  const pagesDir = join(projectDir, "pages");
  const apiDir = join(projectDir, "api");

  const { loadFileBasedConfig } = await import("../router/page-loader.js");
  const config = await loadFileBasedConfig(configPath, outDir);

  const { runFileBasedSite } = await import("../core/runtime.js");
  // runFileBasedSite returns void but starts the runtime — we need the runtime ref
  // We'll use a wrapper that creates and starts the runtime
  const { FileRouter } = await import("../router/resolver.js");
  const { TUIRuntime } = await import("../core/runtime.js");

  const router = new FileRouter({
    config,
    pagesDir,
    apiDir: existsSync(apiDir) ? apiDir : undefined,
    outDir,
  });

  await router.initialize();
  const pages = await router.buildPagesArray();
  const apiRoutes = await router.loadApiRoutes();

  const siteConfig = {
    name: config.name,
    handle: config.handle,
    tagline: config.tagline,
    banner: config.banner,
    theme: config.theme,
    borders: config.borders,
    animations: config.animations,
    navigation: config.navigation,
    easterEggs: config.easterEggs,
    footer: config.footer,
    statusBar: config.statusBar,
    artDir: config.artDir,
    middleware: config.middleware,
    menu: config.menu,
    pages,
    api: { ...(apiRoutes || {}) },
    onInit: config.onInit,
    onExit: config.onExit,
    onNavigate: config.onNavigate,
    onError: config.onError,
  };

  const runtime = new TUIRuntime({ config: siteConfig }, terminalIO);
  (runtime as any)._fileRouter = router;
  await runtime.start();
  return runtime;
}

function detectFileBased(projectDir: string, configPath: string): boolean {
  const configName = configPath.split("/").pop() || "";
  if (configName === "config.ts" || configName === "config.js") {
    const pagesDir = join(projectDir, "pages");
    return existsSync(pagesDir);
  }
  return false;
}

function parseFlags(args: string[]): ServeFlags {
  let configPath: string | null = null;
  let port = 2222;
  let hostKeyPath = join(process.cwd(), ".terminaltui", "host_key");
  let maxConnections = 100;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--port" && args[i + 1]) {
      port = parseInt(args[++i], 10);
    } else if (arg.startsWith("--port=")) {
      port = parseInt(arg.split("=")[1], 10);
    } else if (arg === "--host-key" && args[i + 1]) {
      hostKeyPath = resolve(args[++i]);
    } else if (arg.startsWith("--host-key=")) {
      hostKeyPath = resolve(arg.split("=")[1]);
    } else if (arg === "--max-connections" && args[i + 1]) {
      maxConnections = parseInt(args[++i], 10);
    } else if (arg.startsWith("--max-connections=")) {
      maxConnections = parseInt(arg.split("=")[1], 10);
    } else if (!arg.startsWith("--") && arg !== "serve") {
      configPath = arg;
    }
  }

  if (!configPath) {
    // Auto-detect config
    configPath = findConfig();
    if (!configPath) {
      console.error("Error: No config.ts (with pages/) or site.config.ts found in current directory.");
      console.error("Run 'terminaltui init' to create one, or pass a path: terminaltui serve path/to/config.ts");
      process.exit(1);
    }
  }

  return { configPath, port, hostKeyPath, maxConnections };
}

function findConfig(): string | null {
  const cwd = process.cwd();
  const configTs = join(cwd, "config.ts");
  if (existsSync(configTs) && existsSync(join(cwd, "pages"))) {
    return configTs;
  }
  const candidates = ["site.config.ts", "site.config.js", "site.config.mjs"];
  for (const c of candidates) {
    const p = join(cwd, c);
    if (existsSync(p)) return p;
  }
  return null;
}
