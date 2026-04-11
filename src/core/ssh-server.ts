/**
 * SSH Server — hosts a TUI app over SSH.
 * Each connection gets an independent TUIRuntime with the SSH channel as I/O.
 */
import { generateKeyPairSync, createPrivateKey } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname } from "node:path";
import type { TerminalIO } from "./terminal-io.js";

export interface ServeOptions {
  port: number;
  hostKeyPath: string;
  maxConnections?: number;
  auth?: {
    passwords?: Record<string, string>;
  };
}

interface Session {
  id: string;
  clientIp: string;
  runtime: any;
  terminalIO: TerminalIO;
}

export class SSHServer {
  private server: any = null;
  private sessions = new Map<string, Session>();
  private sessionCounter = 0;
  private options: Required<Pick<ServeOptions, "port" | "hostKeyPath" | "maxConnections">> & Pick<ServeOptions, "auth">;
  private createRuntime: (terminalIO: TerminalIO) => Promise<any>;

  constructor(options: ServeOptions, createRuntime: (terminalIO: TerminalIO) => Promise<any>) {
    this.options = {
      port: options.port,
      hostKeyPath: options.hostKeyPath,
      maxConnections: options.maxConnections ?? 100,
      auth: options.auth,
    };
    this.createRuntime = createRuntime;
  }

  async start(): Promise<void> {
    let SSH2Server: any;
    try {
      const ssh2 = await import("ssh2");
      SSH2Server = ssh2.Server ?? ssh2.default?.Server;
      if (!SSH2Server) throw new Error("Server class not found");
    } catch (e: any) {
      console.error("\x1b[31mError:\x1b[0m ssh2 is required for the serve command.");
      console.error("Install it with: npm install ssh2");
      if (e.message !== "Server class not found") console.error("  Detail:", e.message);
      process.exit(1);
    }

    const hostKey = this.ensureHostKey();

    this.server = new SSH2Server(
      { hostKeys: [hostKey] },
      (client: any, info: any) => this.handleClient(client, info),
    );

    this.server.listen(this.options.port, "0.0.0.0", () => {
      console.log("");
      console.log("  \x1b[1m\x1b[35mterminaltui serve\x1b[0m");
      console.log("");
      console.log(`  \x1b[32m\u25B6\x1b[0m Listening on \x1b[36mssh://0.0.0.0:${this.options.port}\x1b[0m`);
      console.log(`  \x1b[2mMax connections: ${this.options.maxConnections}\x1b[0m`);
      console.log(`  \x1b[2mHost key: ${this.options.hostKeyPath}\x1b[0m`);
      console.log("");
      console.log(`  Connect with: \x1b[1mssh localhost -p ${this.options.port}\x1b[0m`);
      console.log("");
    });

    this.server.on("error", (err: Error) => {
      console.error("[terminaltui serve] Server error:", err.message);
    });
  }

  stop(): void {
    // Clean up all sessions
    for (const [id, session] of this.sessions) {
      try {
        session.runtime?.cleanup?.();
        session.terminalIO.dispose();
      } catch { /* ignore cleanup errors */ }
    }
    this.sessions.clear();

    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  get activeConnections(): number {
    return this.sessions.size;
  }

  private ensureHostKey(): string {
    if (existsSync(this.options.hostKeyPath)) {
      return readFileSync(this.options.hostKeyPath, "utf-8");
    }

    // Generate RSA key using ssh-keygen (produces OpenSSH format that ssh2 supports)
    const dir = dirname(this.options.hostKeyPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    console.log(`  \x1b[2mGenerating host key: ${this.options.hostKeyPath}\x1b[0m`);
    try {
      execSync(`ssh-keygen -t rsa -b 2048 -f "${this.options.hostKeyPath}" -N "" -q`, { stdio: "pipe" });
    } catch {
      // Fallback: generate with Node.js crypto (PEM format, widely supported)
      const { privateKey } = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        privateKeyEncoding: { type: "pkcs1", format: "pem" },
        publicKeyEncoding: { type: "pkcs1", format: "pem" },
      });
      writeFileSync(this.options.hostKeyPath, privateKey, { mode: 0o600 });
    }

    return readFileSync(this.options.hostKeyPath, "utf-8");
  }

  private handleClient(client: any, info: any): void {
    const clientIp = info?.ip || "unknown";

    if (this.sessions.size >= this.options.maxConnections) {
      console.log(`  \x1b[33m\u2717\x1b[0m Rejected ${clientIp} (max connections reached)`);
      client.end();
      return;
    }

    // Handle authentication
    client.on("authentication", (ctx: any) => {
      if (!this.options.auth?.passwords) {
        // No auth configured — accept all
        ctx.accept();
        return;
      }

      if (ctx.method === "password") {
        const expected = this.options.auth.passwords[ctx.username];
        if (expected && expected === ctx.password) {
          ctx.accept();
        } else {
          ctx.reject(["password"]);
        }
      } else if (ctx.method === "none") {
        ctx.reject(["password"]);
      } else {
        ctx.reject();
      }
    });

    client.on("ready", () => {
      const sessionId = `session-${++this.sessionCounter}`;
      console.log(`  \x1b[32m\u2713\x1b[0m Connected: ${clientIp} [${sessionId}] (${this.sessions.size + 1} active)`);

      client.on("session", (accept: any) => {
        const session = accept();
        let ptyInfo: { cols: number; rows: number } = { cols: 80, rows: 24 };

        session.on("pty", (accept: any, _reject: any, info: any) => {
          ptyInfo = { cols: info.cols || 80, rows: info.rows || 24 };
          console.log(`  \x1b[2m  pty: ${ptyInfo.cols}x${ptyInfo.rows} term=${info.term || "unknown"}\x1b[0m`);
          accept?.();
        });

        session.on("window-change", (_accept: any, _reject: any, info: any) => {
          ptyInfo.cols = info.cols || ptyInfo.cols;
          ptyInfo.rows = info.rows || ptyInfo.rows;
          // Trigger resize on the TerminalIO
          const s = this.sessions.get(sessionId);
          if (s) {
            const io = s.terminalIO as SSHTerminalIO;
            io.handleResize(ptyInfo.cols, ptyInfo.rows);
          }
        });

        session.on("shell", (accept: any) => {
          const channel = accept();
          this.startSession(sessionId, clientIp, channel, ptyInfo);
        });
      });
    });

    client.on("end", () => {
      this.cleanupClientSessions(clientIp);
    });

    client.on("error", (err: Error) => {
      // Suppress common SSH errors (client disconnect, etc.)
      if (!err.message.includes("ECONNRESET")) {
        console.error(`  \x1b[33m!\x1b[0m Client error (${clientIp}): ${err.message}`);
      }
    });
  }

  private async startSession(sessionId: string, clientIp: string, channel: any, ptyInfo: { cols: number; rows: number }): Promise<void> {
    const terminalIO = new SSHTerminalIO(channel, ptyInfo.cols, ptyInfo.rows);

    const session: Session = {
      id: sessionId,
      clientIp,
      runtime: null,
      terminalIO,
    };
    this.sessions.set(sessionId, session);

    channel.on("close", () => {
      this.endSession(sessionId);
    });

    channel.on("end", () => {
      this.endSession(sessionId);
    });

    channel.on("error", () => {
      this.endSession(sessionId);
    });

    try {
      const runtime = await this.createRuntime(terminalIO);
      session.runtime = runtime;
    } catch (err: any) {
      console.error(`  \x1b[31m\u2717\x1b[0m Failed to start session ${sessionId}: ${err.message}`);
      terminalIO.write("\r\nError starting TUI. Please try again.\r\n");
      terminalIO.dispose();
      this.sessions.delete(sessionId);
    }
  }

  private endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.sessions.delete(sessionId);
    console.log(`  \x1b[31m\u2717\x1b[0m Disconnected: ${session.clientIp} [${sessionId}] (${this.sessions.size} active)`);

    try {
      session.runtime?.cleanup?.();
    } catch { /* ignore */ }
    try {
      session.terminalIO.dispose();
    } catch { /* ignore */ }
  }

  private cleanupClientSessions(clientIp: string): void {
    for (const [id, session] of this.sessions) {
      if (session.clientIp === clientIp) {
        this.endSession(id);
      }
    }
  }
}

/**
 * SSHTerminalIO — TerminalIO backed by an SSH channel.
 */
class SSHTerminalIO implements TerminalIO {
  private channel: any;
  private _columns: number;
  private _rows: number;
  private resizeCallbacks: Array<(cols: number, rows: number) => void> = [];
  private dataCallbacks: Array<(data: string) => void> = [];
  private disposed = false;

  constructor(channel: any, cols: number, rows: number) {
    this.channel = channel;
    this._columns = cols;
    this._rows = rows;

    // Forward channel data to registered listeners
    channel.on("data", (data: Buffer) => {
      if (this.disposed) return;
      const str = data.toString("utf-8");
      for (const cb of this.dataCallbacks) cb(str);
    });
  }

  get columns(): number {
    return this._columns;
  }

  get rows(): number {
    return this._rows;
  }

  write(data: string): void {
    if (this.disposed) return;
    try {
      this.channel.write(data);
    } catch { /* channel may be closed */ }
  }

  onResize(cb: (cols: number, rows: number) => void): void {
    this.resizeCallbacks.push(cb);
  }

  onData(cb: (data: string) => void): void {
    this.dataCallbacks.push(cb);
  }

  removeDataListener(cb: (data: string) => void): void {
    const idx = this.dataCallbacks.indexOf(cb);
    if (idx >= 0) this.dataCallbacks.splice(idx, 1);
  }

  setRawMode(_enabled: boolean): void {
    // SSH channels are always in raw mode — no-op
  }

  handleResize(cols: number, rows: number): void {
    this._columns = cols;
    this._rows = rows;
    for (const cb of this.resizeCallbacks) cb(cols, rows);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resizeCallbacks = [];
    this.dataCallbacks = [];
    try {
      this.channel.end();
    } catch { /* ignore */ }
  }
}
