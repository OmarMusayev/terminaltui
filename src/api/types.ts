// ─── API Route Types ──────────────────────────────────────

export interface ApiRequest {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  headers: Record<string, string>;
}

export type ApiHandler = (req: ApiRequest) => Promise<unknown> | unknown;

export type WsHandler = (ws: WsConnection, req: ApiRequest) => void;

export interface WsConnection {
  send(data: string): void;
  close(): void;
  on(event: "message", cb: (data: string) => void): void;
  on(event: "close", cb: () => void): void;
}

export interface ParsedRoute {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: ApiHandler | WsHandler;
}
