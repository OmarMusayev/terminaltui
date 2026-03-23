export interface WebSocketOptions {
  type: "websocket";
  url: string;
  onMessage: (data: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
  protocols?: string[];
}

export interface SSEOptions {
  type: "sse";
  url: string;
  onMessage: (event: { data: string; type: string; lastEventId: string }) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  headers?: Record<string, string>;
}

export interface LiveDataConnection {
  send(data: string): void;
  close(): void;
  readonly connected: boolean;
}

export function liveData(options: WebSocketOptions | SSEOptions): LiveDataConnection {
  if (options.type === "websocket") {
    return createWebSocketConnection(options);
  }
  return createSSEConnection(options);
}

function createWebSocketConnection(options: WebSocketOptions): LiveDataConnection {
  // Use dynamic import for WebSocket since it may not be available in all envs
  let ws: any = null;
  let _connected = false;
  let _closed = false;
  let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  async function connect(): Promise<void> {
    if (_closed) return;
    try {
      // Node 18+ has WebSocket globally, or use ws package
      const WebSocket = globalThis.WebSocket ?? (await import("ws" as any)).default;
      ws = new WebSocket(options.url, options.protocols);

      ws.onopen = () => {
        _connected = true;
        options.onConnect?.();
      };

      ws.onmessage = (event: any) => {
        const data = typeof event.data === "string" ? event.data : String(event.data);
        options.onMessage(data);
      };

      ws.onclose = () => {
        _connected = false;
        options.onDisconnect?.();
        if (!_closed && options.reconnect) {
          _reconnectTimer = setTimeout(connect, options.reconnectInterval ?? 3000);
        }
      };

      ws.onerror = (err: any) => {
        options.onError?.(err instanceof Error ? err : new Error("WebSocket error"));
      };
    } catch (err) {
      options.onError?.(err instanceof Error ? err : new Error(String(err)));
      if (!_closed && options.reconnect) {
        _reconnectTimer = setTimeout(connect, options.reconnectInterval ?? 3000);
      }
    }
  }

  connect();

  return {
    send(data: string): void {
      if (ws && _connected) ws.send(data);
    },
    close(): void {
      _closed = true;
      if (_reconnectTimer) clearTimeout(_reconnectTimer);
      if (ws) ws.close();
    },
    get connected() { return _connected; },
  };
}

function createSSEConnection(options: SSEOptions): LiveDataConnection {
  let _connected = false;
  let _closed = false;
  let _controller: AbortController | null = null;

  async function connect(): Promise<void> {
    if (_closed) return;
    _controller = new AbortController();

    try {
      const response = await globalThis.fetch(options.url, {
        headers: { Accept: "text/event-stream", ...options.headers },
        signal: _controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`SSE connection failed: ${response.status}`);
      }

      _connected = true;
      options.onConnect?.();

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!_closed) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let eventType = "message";
        let eventData = "";
        let lastEventId = "";

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            eventData += (eventData ? "\n" : "") + line.slice(5).trim();
          } else if (line.startsWith("id:")) {
            lastEventId = line.slice(3).trim();
          } else if (line === "") {
            // Empty line = end of event
            if (eventData) {
              options.onMessage({ data: eventData, type: eventType, lastEventId });
              eventData = "";
              eventType = "message";
            }
          }
        }
      }
    } catch (err) {
      if (!_closed) {
        options.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      _connected = false;
      options.onDisconnect?.();
    }
  }

  connect();

  return {
    send(_data: string): void {
      // SSE is server->client only; send is a no-op
    },
    close(): void {
      _closed = true;
      _controller?.abort();
    },
    get connected() { return _connected; },
  };
}
