import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import type { ApiRequest, ApiHandler, ParsedRoute } from "./types.js";
import { parseRoutes, matchRoute } from "./router.js";

export class ApiServer {
  private routes: ParsedRoute[] = [];
  private server: Server | null = null;
  private port = 0;

  /**
   * Register routes from the config's api object.
   * Keys are "METHOD /path" strings, values are handler functions.
   */
  registerRoutes(api: Record<string, ApiHandler>): void {
    this.routes = parseRoutes(api);
  }

  /**
   * Start listening on a random available port bound to localhost only.
   * Returns the assigned port number.
   */
  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on("error", reject);

      this.server.listen(0, "127.0.0.1", () => {
        const addr = this.server!.address();
        this.port = typeof addr === "object" && addr ? addr.port : 0;
        resolve(this.port);
      });
    });
  }

  /**
   * Gracefully stop the server.
   */
  async stop(): Promise<void> {
    if (!this.server) return;
    return new Promise((resolve) => {
      this.server!.close(() => resolve());
    });
  }

  getPort(): number {
    return this.port;
  }

  getBaseUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || "/", `http://127.0.0.1:${this.port}`);
    const method = (req.method || "GET").toUpperCase();
    const pathname = url.pathname;

    // CORS headers (localhost-only, but keeps browser-based tooling happy)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Content-Type", "application/json");

    // Handle preflight
    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Find matching route
    const match = matchRoute(this.routes, method, pathname);
    if (!match) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    // Parse query string
    const query: Record<string, string> = {};
    url.searchParams.forEach((v, k) => {
      query[k] = v;
    });

    // Parse body for POST/PUT/PATCH
    let body: unknown = undefined;
    if (["POST", "PUT", "PATCH"].includes(method)) {
      body = await this.parseBody(req);
    }

    const apiReq: ApiRequest = {
      method,
      path: pathname,
      params: match.params,
      query,
      body,
      headers: req.headers as Record<string, string>,
    };

    try {
      const result = await (match.route.handler as ApiHandler)(apiReq);
      const json = JSON.stringify(result);
      res.writeHead(200);
      res.end(json);
    } catch (err: any) {
      const message = err?.message || "Internal server error";
      res.writeHead(500);
      res.end(JSON.stringify({ error: message }));
    }
  }

  private parseBody(req: IncomingMessage): Promise<unknown> {
    // 1 MB cap. The server is bound to 127.0.0.1 today, so this is mostly
    // defense-in-depth — but it stops a runaway page-side fetch from
    // ballooning the host process by streaming a giant body.
    const MAX_BODY_BYTES = 1 * 1024 * 1024;
    return new Promise((resolve, reject) => {
      let data = "";
      let bytes = 0;
      let aborted = false;
      req.on("data", (chunk: Buffer) => {
        if (aborted) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          aborted = true;
          req.destroy(new Error("Request body too large"));
          reject(new Error("Request body too large"));
          return;
        }
        data += chunk.toString();
      });
      req.on("end", () => {
        if (aborted) return;
        if (!data) {
          resolve(undefined);
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
      req.on("error", reject);
    });
  }
}
